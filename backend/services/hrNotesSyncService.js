/**
 * Sync candidate text notes (candidates.notes) into hr_notes — single source of truth for UI.
 */
import { query } from '../config/database.js';

const VALID_INTERACTION_TYPES = new Set([
  'Phone Call',
  'Email',
  'Interview',
  'Stage Change',
  'General Note',
  'System Event',
]);

let cachedFallbackAuthorId = null;

/**
 * Resolve author_id for hr_notes inserts (column is NOT NULL in production).
 * @param {number|string|null|undefined} authorId
 * @returns {Promise<number|string|null>}
 */
export async function resolveHrNoteAuthorId(authorId) {
  if (authorId != null && authorId !== '') {
    return authorId;
  }
  if (cachedFallbackAuthorId != null) {
    return cachedFallbackAuthorId;
  }
  const admins = await query(
    `SELECT id FROM users
     WHERE role IN ('admin', 'hr', 'Admin', 'HR')
     ORDER BY id ASC LIMIT 1`
  );
  if (admins.length > 0) {
    cachedFallbackAuthorId = admins[0].id;
    return cachedFallbackAuthorId;
  }
  const anyUser = await query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
  cachedFallbackAuthorId = anyUser[0]?.id ?? null;
  return cachedFallbackAuthorId;
}

/**
 * @param {string|null|undefined} interactionType
 * @returns {string}
 */
export function normalizeInteractionType(interactionType) {
  const trimmed = typeof interactionType === 'string' ? interactionType.trim() : '';
  if (VALID_INTERACTION_TYPES.has(trimmed)) {
    return trimmed;
  }
  return 'General Note';
}

/**
 * @param {string|null|undefined} stage
 * @returns {string}
 */
export function normalizeNoteStage(stage) {
  const trimmed = typeof stage === 'string' ? stage.trim() : '';
  return trimmed || 'Applied';
}

/**
 * Insert one HR note row.
 * @returns {Promise<boolean>} false if skipped or failed
 */
export async function insertHrNote({
  candidateId,
  noteText,
  stage = 'Applied',
  authorId,
  interactionType = 'General Note',
}) {
  const text = typeof noteText === 'string' ? noteText.trim() : '';
  if (!candidateId || !text) {
    return false;
  }

  const resolvedAuthorId = await resolveHrNoteAuthorId(authorId);
  if (resolvedAuthorId == null) {
    console.error(
      `[hrNotesSyncService] Cannot insert hr_note for ${candidateId}: no users in database for author_id`
    );
    return false;
  }

  try {
    await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        candidateId,
        normalizeNoteStage(stage),
        text,
        normalizeInteractionType(interactionType),
        resolvedAuthorId,
      ]
    );
    return true;
  } catch (err) {
    console.error(
      `[hrNotesSyncService] Failed to insert hr_note for candidate ${candidateId}:`,
      err.message
    );
    return false;
  }
}

/**
 * If candidates.notes has text but no hr_notes exist, create one hr_notes row.
 * @param {string} candidateId
 * @param {{ authorId?: number|string|null, stage?: string }} options
 * @returns {Promise<boolean>} true if a row was inserted
 */
export async function syncCandidatesNotesColumnToHrNotes(candidateId, options = {}) {
  const rows = await query(
    `SELECT c.id, c.notes, c.stage,
            (SELECT COUNT(*) FROM hr_notes hn WHERE hn.candidate_id = c.id) AS hr_note_count
     FROM candidates c
     WHERE c.id = ?`,
    [candidateId]
  );

  if (rows.length === 0) {
    return false;
  }

  const row = rows[0];
  const text = typeof row.notes === 'string' ? row.notes.trim() : '';
  if (!text || Number(row.hr_note_count) > 0) {
    return false;
  }

  return insertHrNote({
    candidateId: row.id,
    noteText: text,
    stage: options.stage || row.stage || 'Applied',
    authorId: options.authorId,
    interactionType: 'General Note',
  });
}

/**
 * Backfill all candidates that have candidates.notes but no hr_notes rows.
 * @param {{ authorId?: number|string|null, limit?: number }} options
 * @returns {Promise<{ scanned: number, inserted: number, failed: number }>}
 */
export async function backfillOrphanCandidateNotes(options = {}) {
  const limit = options.limit ?? 10000;
  const authorId = await resolveHrNoteAuthorId(options.authorId);

  const orphans = await query(
    `SELECT c.id, c.notes, c.stage
     FROM candidates c
     WHERE c.notes IS NOT NULL AND TRIM(c.notes) != ''
       AND NOT EXISTS (SELECT 1 FROM hr_notes hn WHERE hn.candidate_id = c.id)
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [limit]
  );

  let inserted = 0;
  let failed = 0;

  for (const row of orphans) {
    const ok = await insertHrNote({
      candidateId: row.id,
      noteText: row.notes,
      stage: row.stage,
      authorId,
      interactionType: 'General Note',
    });
    if (ok) {
      inserted += 1;
    } else {
      failed += 1;
    }
  }

  return { scanned: orphans.length, inserted, failed };
}

/**
 * Fix hr_notes rows with invalid/empty interaction_type from legacy bulk import.
 */
export async function repairEmptyInteractionTypes() {
  const result = await query(
    `UPDATE hr_notes
     SET interaction_type = 'General Note'
     WHERE interaction_type IS NULL
        OR TRIM(interaction_type) = ''
        OR interaction_type = 'Bulk Import'`
  );
  return result.affectedRows ?? 0;
}

/**
 * Copy notes from candidate_notes_ratings into hr_notes when not already present.
 */
export async function backfillFromCandidateNotesRatings(options = {}) {
  const limit = options.limit ?? 20000;
  const authorId = await resolveHrNoteAuthorId(options.authorId);

  const rows = await query(
    `SELECT cnr.candidate_id, cnr.notes, cnr.user_id, cnr.created_at,
            COALESCE(c.stage, 'Applied') AS stage
     FROM candidate_notes_ratings cnr
     LEFT JOIN candidates c ON c.id = cnr.candidate_id
     WHERE cnr.notes IS NOT NULL AND TRIM(cnr.notes) != ''
       AND NOT EXISTS (
         SELECT 1 FROM hr_notes hn
         WHERE hn.candidate_id = cnr.candidate_id
           AND hn.note_text = cnr.notes
       )
     ORDER BY cnr.created_at ASC
     LIMIT ?`,
    [limit]
  );

  let inserted = 0;
  let failed = 0;

  for (const row of rows) {
    const ok = await insertHrNote({
      candidateId: row.candidate_id,
      noteText: row.notes,
      stage: row.stage,
      authorId: row.user_id ?? authorId,
      interactionType: 'General Note',
    });
    if (ok) inserted += 1;
    else failed += 1;
  }

  return { scanned: rows.length, inserted, failed };
}

/**
 * Ensure one candidate has hr_notes from candidates.notes and candidate_notes_ratings.
 */
export async function ensureCandidateNotesSynced(candidateId, options = {}) {
  await syncCandidatesNotesColumnToHrNotes(candidateId, options);

  const cnrRows = await query(
    `SELECT cnr.notes, cnr.user_id, COALESCE(c.stage, 'Applied') AS stage
     FROM candidate_notes_ratings cnr
     LEFT JOIN candidates c ON c.id = cnr.candidate_id
     WHERE cnr.candidate_id = ?
       AND cnr.notes IS NOT NULL AND TRIM(cnr.notes) != ''
       AND NOT EXISTS (
         SELECT 1 FROM hr_notes hn
         WHERE hn.candidate_id = cnr.candidate_id AND hn.note_text = cnr.notes
       )`,
    [candidateId]
  );

  for (const row of cnrRows) {
    await insertHrNote({
      candidateId,
      noteText: row.notes,
      stage: row.stage,
      authorId: row.user_id ?? options.authorId,
      interactionType: 'General Note',
    });
  }
}

/**
 * Build notes map for list/modal responses (shape expected by frontend).
 * @param {string[]} candidateIds
 * @returns {Promise<Record<string, object[]>>}
 */
export async function buildNotesMapForCandidates(candidateIds) {
  const notesMap = {};
  if (!candidateIds?.length) {
    return notesMap;
  }

  const placeholders = candidateIds.map(() => '?').join(',');
  const hrNotes = await query(
    `SELECT hn.id, hn.candidate_id, hn.stage, hn.note_text AS notes,
            hn.interaction_type, hn.author_id AS user_id, hn.created_at, hn.updated_at,
            u.name AS user_name, u.role AS user_role
     FROM hr_notes hn
     LEFT JOIN users u ON hn.author_id = u.id
     WHERE hn.candidate_id IN (${placeholders})
       AND hn.note_text IS NOT NULL AND TRIM(hn.note_text) != ''
     ORDER BY hn.created_at DESC`,
    candidateIds
  );

  for (const note of hrNotes) {
    if (!notesMap[note.candidate_id]) {
      notesMap[note.candidate_id] = [];
    }
    notesMap[note.candidate_id].push({
      id: note.id,
      candidate_id: note.candidate_id,
      stage: normalizeNoteStage(note.stage),
      notes: note.notes,
      note_text: note.notes,
      interaction_type: normalizeInteractionType(note.interaction_type),
      user_id: note.user_id,
      user_name: note.user_name || 'Unknown',
      user_role: note.user_role || null,
      created_at: note.created_at,
      updated_at: note.updated_at,
    });
  }

  // Fallback: bulk import stores text in candidates.notes when hr_notes row is missing
  const missingIds = candidateIds.filter((id) => !notesMap[id]?.length);
  if (missingIds.length > 0) {
    const ph = missingIds.map(() => '?').join(',');
    const legacyRows = await query(
      `SELECT c.id, c.notes, c.stage, c.created_at
       FROM candidates c
       WHERE c.id IN (${ph})
         AND c.notes IS NOT NULL AND TRIM(c.notes) != ''`,
      missingIds
    );
    for (const row of legacyRows) {
      notesMap[row.id] = [
        {
          id: `legacy-col-${row.id}`,
          candidate_id: row.id,
          stage: normalizeNoteStage(row.stage),
          notes: row.notes.trim(),
          note_text: row.notes.trim(),
          interaction_type: 'General Note',
          user_id: null,
          user_name: 'Bulk Import',
          user_role: null,
          created_at: row.created_at,
          updated_at: row.created_at,
        },
      ];
    }
  }

  return notesMap;
}

/**
 * Fetch hr_notes rows for API (after sync). Includes legacy candidates.notes as synthetic row if needed.
 */
export async function fetchHrNotesForCandidate(candidateId, options = {}) {
  await ensureCandidateNotesSynced(candidateId, options);

  const hrNotes = await query(
    `SELECT hn.id, hn.candidate_id, hn.stage, hn.note_text, hn.interaction_type,
            hn.author_id, hn.created_at, hn.updated_at,
            u.name AS author_name, u.role AS author_role
     FROM hr_notes hn
     LEFT JOIN users u ON hn.author_id = u.id
     WHERE hn.candidate_id = ?
     ORDER BY hn.created_at DESC`,
    [candidateId]
  );

  if (hrNotes.length > 0) {
    return hrNotes;
  }

  const legacy = await query(
    `SELECT id, notes, stage, created_at FROM candidates WHERE id = ?`,
    [candidateId]
  );
  const text = legacy[0]?.notes?.trim();
  if (!text) {
    return [];
  }

  return [
    {
      id: `legacy-col-${candidateId}`,
      candidate_id: candidateId,
      stage: normalizeNoteStage(legacy[0].stage),
      note_text: text,
      interaction_type: 'General Note',
      author_id: null,
      created_at: legacy[0].created_at,
      updated_at: legacy[0].created_at,
      author_name: 'Bulk Import',
      author_role: null,
    },
  ];
}
