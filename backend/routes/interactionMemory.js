/**
 * Interaction Memory System Routes
 * Handles: candidates, notes, pipeline, snapshots, admin view
 */
import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { 
  linkInteractionToCandidate,
  checkForDuplicateCandidate
} from '../services/integrationService.js';

const router = express.Router();

// ─── helpers ────────────────────────────────────────────────────────────────

const CREATE_DAILY_SNAPSHOTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT  NOT NULL,
  snap_date     DATE NOT NULL,
  total_calls   INT  DEFAULT 0,
  interested    INT  DEFAULT 0,
  no_response   INT  DEFAULT 0,
  follow_ups    INT  DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_date (user_id, snap_date),
  INDEX idx_user (user_id),
  INDEX idx_date (snap_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

let dailySnapshotsChecked = false;

function isMissingSnapshotTableError(error) {
  if (!error) return false;
  const sqlMessage = String(error.sqlMessage || error.message || '').toLowerCase();
  return error.sqlState === '42S02'
    || error.errno === 1932
    || sqlMessage.includes('daily_snapshots')
    || sqlMessage.includes("doesn't exist");
}

async function ensureDailySnapshotsTable() {
  if (dailySnapshotsChecked) return;
  await query(CREATE_DAILY_SNAPSHOTS_TABLE_SQL);
  dailySnapshotsChecked = true;
}

async function upsertSnapshot(userId, status) {
  const today = new Date().toISOString().slice(0, 10);
  const params = [userId, today, status, status, status, status, status, status];
  const upsertSql = `INSERT INTO daily_snapshots (user_id, snap_date, total_calls, interested, no_response, follow_ups)
   VALUES (?, ?, 1,
     IF(? = 'Interested', 1, 0),
     IF(? = 'No Response', 1, 0),
     IF(? = 'Follow-up', 1, 0)
   )
   ON DUPLICATE KEY UPDATE
     total_calls  = total_calls  + 1,
     interested   = interested   + IF(? = 'Interested', 1, 0),
     no_response  = no_response  + IF(? = 'No Response', 1, 0),
     follow_ups   = follow_ups   + IF(? = 'Follow-up', 1, 0)`;

  try {
    await query(upsertSql, params);
  } catch (error) {
    if (!isMissingSnapshotTableError(error)) {
      throw error;
    }

    try {
      await ensureDailySnapshotsTable();
      await query(upsertSql, params);
    } catch (snapshotError) {
      // Snapshot counters are non-critical; do not fail interaction logging.
      console.error('[interactionMemory] Failed to persist daily snapshot:', snapshotError);
    }
  }
}

/**
 * Helper function to find existing interaction candidate by phone or email
 * Handles missing data gracefully - checks phone first, then email
 */
async function findExistingInteractionCandidate(cleanPhone, cleanEmail) {
  let existingInteraction = null;
  
  // Check by phone first if provided
  if (cleanPhone) {
    const phoneResults = await query(
      'SELECT id, candidate_id FROM interaction_candidates WHERE phone = ?',
      [cleanPhone]
    );
    if (phoneResults.length > 0) {
      return phoneResults[0];
    }
  }
  
  // Check by email if phone not found and email is provided
  if (cleanEmail) {
    const emailResults = await query(
      'SELECT id, candidate_id FROM interaction_candidates WHERE email = ?',
      [cleanEmail]
    );
    if (emailResults.length > 0) {
      return emailResults[0];
    }
  }
  
  return null;
}

/**
 * Helper function to generate placeholder name when name is missing
 * Uses phone or email as fallback
 */
function generatePlaceholderName(name, cleanPhone, cleanEmail) {
  if (name && name.trim()) {
    return name.trim();
  }
  return cleanPhone ? `Contact ${cleanPhone}` : `Contact ${cleanEmail}`;
}

// ─── CANDIDATES ─────────────────────────────────────────────────────────────

// POST /api/interaction/candidates/add-or-update (also aliased as /api/interaction/log)
router.post('/candidates/add-or-update', authenticateToken, asyncHandler(async (req, res) => {
  const { name, phone, email, source, note, priority, status, follow_up_date } = req.body;

  // Validate that at least one contact method exists
  if ((!phone || !phone.trim()) && (!email || !email.trim())) {
    throw new ValidationError('At least one contact method (phone or email) is required');
  }
  if (!note || !note.trim()) throw new ValidationError('note is required');

  const cleanPhone = phone ? phone.trim() : null;
  const cleanEmail = email ? email.trim() : null;
  const userId = req.user.id;

  // Step 1: Check if candidate exists in main candidates table by phone or email
  const duplicateCheck = await checkForDuplicateCandidate(cleanPhone, cleanEmail);
  
  let mainCandidateId = null;
  let mainCandidateInfo = null;
  
  if (duplicateCheck) {
    // Candidate exists in main pipeline
    const mainCandidate = duplicateCheck.candidate;
    mainCandidateId = mainCandidate.id;
    mainCandidateInfo = {
      id: mainCandidate.id,
      name: mainCandidate.name,
      email: mainCandidate.email,
      phone: mainCandidate.phone,
      stage: mainCandidate.stage,
      matchedBy: duplicateCheck.matchedBy
    };
  }

  // Step 3: Check if interaction candidate already exists (by phone or email)
  const existingInteraction = await findExistingInteractionCandidate(cleanPhone, cleanEmail);

  let interactionCandidateId;
  let isNew = false;

  if (existingInteraction) {
    interactionCandidateId = existingInteraction.id;
    
    // Update interaction candidate with main candidate_id if not already linked
    if (!existingInteraction.candidate_id && mainCandidateId) {
      await linkInteractionToCandidate(interactionCandidateId, mainCandidateId);
    }
    
    // Handle missing name with placeholder for update
    const updateName = generatePlaceholderName(name, cleanPhone, cleanEmail);
    
    // Update name/email/phone/source if provided
    await query(
      `UPDATE interaction_candidates SET name=?, email=?, phone=?, source=?, candidate_id=?, updated_at=NOW() WHERE id=?`,
      [updateName, cleanEmail, cleanPhone, source || 'Manual', mainCandidateId, interactionCandidateId]
    );
  } else {
    // Handle missing name with placeholder for insert
    const insertName = generatePlaceholderName(name, cleanPhone, cleanEmail);
    
    // Create new interaction candidate with link to main candidate
    const result = await query(
      `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [insertName, cleanPhone, cleanEmail, source || 'Manual', mainCandidateId, userId]
    );
    interactionCandidateId = result.insertId;
    isNew = true;
  }

  // Step 4: Insert interaction_notes record
  const noteResult = await query(
    `INSERT INTO interaction_notes (candidate_id, note, status, priority, follow_up_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      interactionCandidateId,
      note.trim(),
      status || 'No Response',
      priority || 3,
      follow_up_date || null,
      userId
    ]
  );

  // Step 5: Update daily_snapshots
  await upsertSnapshot(userId, status || 'No Response');

  // Step 6: Return candidate info in response
  const interactionCandidate = await query(
    `SELECT ic.*, u.name AS created_by_name
     FROM interaction_candidates ic
     LEFT JOIN users u ON ic.created_by = u.id
     WHERE ic.id = ?`,
    [interactionCandidateId]
  );

  res.status(isNew ? 201 : 200).json({
    success: true,
    isNew,
    data: interactionCandidate[0],
    mainCandidate: mainCandidateInfo // Include main candidate info if linked
  });
}));

// GET /api/interaction/candidates/search?phone=&name=&email=&date=YYYY-MM-DD&recruiterId=
router.get('/candidates/search', authenticateToken, asyncHandler(async (req, res) => {
  const { phone, name, email, date, recruiterId, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let conditions = [];
  let params = [];

  // Date filter: candidates that have at least one note on this date
  if (date) {
    conditions.push('EXISTS (SELECT 1 FROM interaction_notes n WHERE n.candidate_id = ic.id AND DATE(n.created_at) = ?)');
    params.push(date);
  }

  // Recruiter filter: filter by created_by (only for Admin/HR Manager)
  if (recruiterId && (req.user.role === 'Admin' || req.user.role === 'HR Manager')) {
    conditions.push('ic.created_by = ?');
    params.push(recruiterId);
  }

  if (phone) { conditions.push('ic.phone LIKE ?'); params.push(`%${phone}%`); }
  if (name)  { conditions.push('ic.name LIKE ?');  params.push(`%${name}%`); }
  if (email) { conditions.push('ic.email LIKE ?'); params.push(`%${email}%`); }

  // Build WHERE clause
  let where = '';
  if (conditions.length) {
    // Separate structural filters (date, recruiter) from search filters (phone, name, email)
    const structuralFilters = [];
    const searchFilters = [];
    
    if (date) structuralFilters.push(conditions.shift());
    if (recruiterId && (req.user.role === 'Admin' || req.user.role === 'HR Manager')) {
      structuralFilters.push(conditions.shift());
    }
    searchFilters.push(...conditions);
    
    if (structuralFilters.length && searchFilters.length) {
      where = `WHERE ${structuralFilters.join(' AND ')} AND (${searchFilters.join(' OR ')})`;
    } else if (structuralFilters.length) {
      where = `WHERE ${structuralFilters.join(' AND ')}`;
    } else if (searchFilters.length) {
      where = `WHERE ${searchFilters.join(' OR ')}`;
    }
  }

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT ic.*, u.name AS created_by_name,
              (SELECT COUNT(*) FROM interaction_notes n WHERE n.candidate_id = ic.id) AS note_count,
              (SELECT n2.status FROM interaction_notes n2 WHERE n2.candidate_id = ic.id ORDER BY n2.created_at DESC LIMIT 1) AS latest_status,
              (SELECT n3.follow_up_date FROM interaction_notes n3 WHERE n3.candidate_id = ic.id ORDER BY n3.created_at DESC LIMIT 1) AS latest_follow_up
       FROM interaction_candidates ic
       LEFT JOIN users u ON ic.created_by = u.id
       ${where}
       ORDER BY ic.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    ),
    query(
      `SELECT COUNT(*) AS total FROM interaction_candidates ic ${where}`,
      params
    )
  ]);

  res.json({
    success: true,
    data: rows,
    pagination: {
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(countRows[0].total / Number(limit))
    }
  });
}));

// GET /api/interaction/candidates/:id
router.get('/candidates/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rows = await query(
    `SELECT ic.*, u.name AS created_by_name,
            ip.stage
     FROM interaction_candidates ic
     LEFT JOIN users u ON ic.created_by = u.id
     LEFT JOIN interaction_pipeline ip ON ip.candidate_id = ic.id
     WHERE ic.id = ?`,
    [id]
  );
  if (!rows.length) throw new NotFoundError('Candidate not found');
  res.json({ success: true, data: rows[0] });
}));

// GET /api/interaction/candidates/by-phone/:phone
router.get('/candidates/by-phone/:phone', authenticateToken, asyncHandler(async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const rows = await query(
    `SELECT ic.*, u.name AS created_by_name, ip.stage
     FROM interaction_candidates ic
     LEFT JOIN users u ON ic.created_by = u.id
     LEFT JOIN interaction_pipeline ip ON ip.candidate_id = ic.id
     WHERE ic.phone = ?`,
    [phone]
  );
  if (!rows.length) {
    return res.json({ success: true, exists: false, data: null });
  }
  // Also fetch latest note
  const latestNote = await query(
    `SELECT n.*, u.name AS author_name FROM interaction_notes n
     LEFT JOIN users u ON n.created_by = u.id
     WHERE n.candidate_id = ? ORDER BY n.created_at DESC LIMIT 1`,
    [rows[0].id]
  );
  res.json({ success: true, exists: true, data: rows[0], latestNote: latestNote[0] || null });
}));

// ─── NOTES ──────────────────────────────────────────────────────────────────

// POST /api/interaction/notes
router.post('/notes', authenticateToken, asyncHandler(async (req, res) => {
  const { candidate_id, note, status, priority, follow_up_date } = req.body;
  if (!candidate_id) throw new ValidationError('candidate_id is required');
  if (!note || !note.trim()) throw new ValidationError('note is required');

  const userId = req.user.id;

  const result = await query(
    `INSERT INTO interaction_notes (candidate_id, note, status, priority, follow_up_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [candidate_id, note.trim(), status || 'No Response', priority || 3, follow_up_date || null, userId]
  );

  await upsertSnapshot(userId, status || 'No Response');

  const rows = await query(
    `SELECT n.*, u.name AS author_name FROM interaction_notes n
     LEFT JOIN users u ON n.created_by = u.id
     WHERE n.id = ?`,
    [result.insertId]
  );

  res.status(201).json({ success: true, data: rows[0] });
}));

// GET /api/interaction/notes/by-candidate/:candidateId
router.get('/notes/by-candidate/:candidateId', authenticateToken, asyncHandler(async (req, res) => {
  const { candidateId } = req.params;
  const rows = await query(
    `SELECT n.*, u.name AS author_name
     FROM interaction_notes n
     LEFT JOIN users u ON n.created_by = u.id
     WHERE n.candidate_id = ?
     ORDER BY n.created_at DESC`,
    [candidateId]
  );
  res.json({ success: true, data: rows });
}));

// ─── PIPELINE ────────────────────────────────────────────────────────────────

// POST /api/interaction/pipeline/move
router.post('/pipeline/move', authenticateToken, asyncHandler(async (req, res) => {
  const { candidate_id, stage } = req.body;
  const validStages = ['Contacted','Interested','Applied','Interview','Selected','Rejected'];
  if (!candidate_id) throw new ValidationError('candidate_id is required');
  if (!validStages.includes(stage)) throw new ValidationError('Invalid stage');

  await query(
    `INSERT INTO interaction_pipeline (candidate_id, stage, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE stage = ?, updated_by = ?, updated_at = NOW()`,
    [candidate_id, stage, req.user.id, stage, req.user.id]
  );

  res.json({ success: true, message: `Moved to ${stage}` });
}));

// GET /api/interaction/pipeline/all
router.get('/pipeline/all', authenticateToken, asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT ip.*, ic.name, ic.phone, ic.email, ic.source,
            (SELECT n.status FROM interaction_notes n WHERE n.candidate_id = ic.id ORDER BY n.created_at DESC LIMIT 1) AS latest_status,
            (SELECT n2.priority FROM interaction_notes n2 WHERE n2.candidate_id = ic.id ORDER BY n2.created_at DESC LIMIT 1) AS priority
     FROM interaction_pipeline ip
     JOIN interaction_candidates ic ON ic.id = ip.candidate_id
     ORDER BY ip.updated_at DESC`
  );
  res.json({ success: true, data: rows });
}));

// ─── SNAPSHOTS ───────────────────────────────────────────────────────────────

// GET /api/interaction/snapshots/:userId  (admin can view any; others only own)
router.get('/snapshots/:userId', authenticateToken, asyncHandler(async (req, res) => {
  const targetId = Number(req.params.userId);
  const requesterId = req.user.id;
  const isAdmin = req.user.role === 'Admin';

  if (!isAdmin && requesterId !== targetId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const rows = await query(
    `SELECT * FROM daily_snapshots WHERE user_id = ? ORDER BY snap_date DESC LIMIT 30`,
    [targetId]
  );

  res.json({ success: true, data: rows });
}));

// GET /api/interaction/snapshots  (own snapshots)
router.get('/snapshots', authenticateToken, asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT * FROM daily_snapshots WHERE user_id = ? ORDER BY snap_date DESC LIMIT 30`,
    [req.user.id]
  );
  res.json({ success: true, data: rows });
}));

// ─── ADMIN: recruiter activity ────────────────────────────────────────────────

// GET /api/interaction/admin/recruiters  (Admin only)
router.get('/admin/recruiters', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Ensure the daily_snapshots table exists before querying
  await ensureDailySnapshotsTable();

  // Check whether optional tables exist so we can degrade gracefully
  const [snapshotExists, notesExists, icExists] = await Promise.all([
    query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'daily_snapshots'"),
    query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'interaction_notes'"),
    query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'interaction_candidates'"),
  ]);

  const hasSnapshots = snapshotExists[0].cnt > 0;
  const hasNotes = notesExists[0].cnt > 0 && icExists[0].cnt > 0;

  const snapshotJoin = hasSnapshots
    ? `LEFT JOIN daily_snapshots ds ON ds.user_id = u.id AND ds.snap_date = '${today}'`
    : '';

  const snapshotCols = hasSnapshots
    ? `COALESCE(ds.total_calls, 0)  AS today_calls,
       COALESCE(ds.interested, 0)   AS today_interested,
       COALESCE(ds.no_response, 0)  AS today_no_response,
       COALESCE(ds.follow_ups, 0)   AS today_follow_ups,`
    : `0 AS today_calls, 0 AS today_interested, 0 AS today_no_response, 0 AS today_follow_ups,`;

  const notesSub = hasNotes
    ? `(SELECT COUNT(*) FROM interaction_notes n
         JOIN interaction_candidates ic ON ic.id = n.candidate_id
         WHERE ic.created_by = u.id) AS total_notes`
    : `0 AS total_notes`;

  const recruiters = await query(
    `SELECT u.id, u.name, u.email, u.role,
            ${snapshotCols}
            ${notesSub}
     FROM users u
     ${snapshotJoin}
     WHERE u.role IN ('Recruiter','HR Manager','Admin')
     ORDER BY today_calls DESC`
  );

  res.json({ success: true, data: recruiters });
}));

// GET /api/interaction/admin/recruiter/:userId  (Admin only - full activity)
router.get('/admin/recruiter/:userId', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  const { userId } = req.params;

  const [user, snapshots, recentNotes] = await Promise.all([
    query('SELECT id, name, email, role FROM users WHERE id = ?', [userId]),
    query(
      'SELECT * FROM daily_snapshots WHERE user_id = ? ORDER BY snap_date DESC LIMIT 14',
      [userId]
    ),
    query(
      `SELECT n.*, ic.name AS candidate_name, ic.phone
       FROM interaction_notes n
       JOIN interaction_candidates ic ON ic.id = n.candidate_id
       WHERE n.created_by = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    )
  ]);

  if (!user.length) throw new NotFoundError('User not found');

  res.json({
    success: true,
    data: {
      user: user[0],
      snapshots,
      recentNotes
    }
  });
}));

// ─── FOLLOW-UP REMINDERS ─────────────────────────────────────────────────────

// GET /api/interaction/follow-ups/today
router.get('/follow-ups/today', authenticateToken, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const isAdmin = req.user.role === 'Admin';

  const rows = await query(
    `SELECT n.*, ic.name AS candidate_name, ic.phone, ic.email,
            u.name AS author_name
     FROM interaction_notes n
     JOIN interaction_candidates ic ON ic.id = n.candidate_id
     LEFT JOIN users u ON n.created_by = u.id
     WHERE n.follow_up_date = ?
       ${isAdmin ? '' : 'AND n.created_by = ?'}
     ORDER BY n.created_at DESC`,
    isAdmin ? [today] : [today, req.user.id]
  );

  res.json({ success: true, data: rows });
}));

// ─── ROUTE ALIASES ───────────────────────────────────────────────────────────

// POST /api/interaction/log (alias for /api/interaction/candidates/add-or-update)
// This provides a simpler endpoint name for logging interactions
router.post('/log', authenticateToken, asyncHandler(async (req, res) => {
  const { name, phone, email, source, note, priority, status, follow_up_date } = req.body;

  // Validate that at least one contact method exists
  if ((!phone || !phone.trim()) && (!email || !email.trim())) {
    throw new ValidationError('At least one contact method (phone or email) is required');
  }
  if (!note || !note.trim()) throw new ValidationError('note is required');

  const cleanPhone = phone ? phone.trim() : null;
  const cleanEmail = email ? email.trim() : null;
  const userId = req.user.id;

  // Step 1: Check if candidate exists in main candidates table by phone or email
  const duplicateCheck = await checkForDuplicateCandidate(cleanPhone, cleanEmail);
  
  let mainCandidateId = null;
  let mainCandidateInfo = null;
  
  if (duplicateCheck) {
    // Candidate exists in main pipeline
    const mainCandidate = duplicateCheck.candidate;
    mainCandidateId = mainCandidate.id;
    mainCandidateInfo = {
      id: mainCandidate.id,
      name: mainCandidate.name,
      email: mainCandidate.email,
      phone: mainCandidate.phone,
      stage: mainCandidate.stage,
      matchedBy: duplicateCheck.matchedBy
    };
  }

  // Step 3: Check if interaction candidate already exists (by phone or email)
  const existingInteraction = await findExistingInteractionCandidate(cleanPhone, cleanEmail);

  let interactionCandidateId;
  let isNew = false;

  if (existingInteraction) {
    interactionCandidateId = existingInteraction.id;
    
    // Update interaction candidate with main candidate_id if not already linked
    if (!existingInteraction.candidate_id && mainCandidateId) {
      await linkInteractionToCandidate(interactionCandidateId, mainCandidateId);
    }
    
    // Handle missing name with placeholder for update
    const updateName = generatePlaceholderName(name, cleanPhone, cleanEmail);
    
    // Update name/email/phone/source if provided
    await query(
      `UPDATE interaction_candidates SET name=?, email=?, phone=?, source=?, candidate_id=?, updated_at=NOW() WHERE id=?`,
      [updateName, cleanEmail, cleanPhone, source || 'Manual', mainCandidateId, interactionCandidateId]
    );
  } else {
    // Handle missing name with placeholder for insert
    const insertName = generatePlaceholderName(name, cleanPhone, cleanEmail);
    
    // Create new interaction candidate with link to main candidate
    const result = await query(
      `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [insertName, cleanPhone, cleanEmail, source || 'Manual', mainCandidateId, userId]
    );
    interactionCandidateId = result.insertId;
    isNew = true;
  }

  // Step 4: Insert interaction_notes record
  await query(
    `INSERT INTO interaction_notes (candidate_id, note, status, priority, follow_up_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      interactionCandidateId,
      note.trim(),
      status || 'No Response',
      priority || 3,
      follow_up_date || null,
      userId
    ]
  );

  // Step 5: Update daily_snapshots
  await upsertSnapshot(userId, status || 'No Response');

  // Step 6: Return candidate info in response
  const interactionCandidate = await query(
    `SELECT ic.*, u.name AS created_by_name
     FROM interaction_candidates ic
     LEFT JOIN users u ON ic.created_by = u.id
     WHERE ic.id = ?`,
    [interactionCandidateId]
  );

  res.status(isNew ? 201 : 200).json({
    success: true,
    isNew,
    data: interactionCandidate[0],
    mainCandidate: mainCandidateInfo // Include main candidate info if linked
  });
}));

export default router;
