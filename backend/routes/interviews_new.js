import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateInterview, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all interviews
router.get('/', authenticateToken, checkPermission('interviews', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const type = req.query.type || '';
  const candidateId = req.query.candidateId || '';
  const interviewerId = req.query.interviewerId || '';

  // Build WHERE conditions
  let whereConditions = [];
  let params = [];

  if (status) {
    whereConditions.push('i.status = ?');
    params.push(status);
  }

  if (type) {
    whereConditions.push('i.type = ?');
    params.push(type);
  }

  if (candidateId) {
    whereConditions.push('i.candidate_id = ?');
    params.push(candidateId);
  }

  if (interviewerId) {
    whereConditions.push('i.interviewer_id = ?');
    params.push(interviewerId);
  }

  // Create WHERE clause
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM interviews i ${whereClause}`;
  const countResult = await query(countQuery, params);
  const total = countResult[0].total;

  // Get interviews with candidate and interviewer details
  const interviewsQuery = `SELECT 
       i.*,
       c.name as candidate_name,
       c.position as candidate_position,
       c.email as candidate_email,
       u.name as interviewer_name,
       u.email as interviewer_email
     FROM interviews i
     LEFT JOIN candidates c ON i.candidate_id = c.id
     LEFT JOIN users u ON i.interviewer_id = u.id
     ${whereClause}
     ORDER BY i.scheduled_date DESC 
     LIMIT ? OFFSET ?`;

  const interviews = await query(interviewsQuery, [...params, limit, offset]);

  res.json({
    success: true,
    data: {
      interviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// Get interview by ID
router.get('/:id', authenticateToken, checkPermission('interviews', 'view'), validateId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const interviews = await query(
    `SELECT 
       i.*,
       c.name as candidate_name,
       c.position as candidate_position,
       c.email as candidate_email,
       c.phone as candidate_phone,
       u.name as interviewer_name,
       u.email as interviewer_email
     FROM interviews i
     LEFT JOIN candidates c ON i.candidate_id = c.id
     LEFT JOIN users u ON i.interviewer_id = u.id
     WHERE i.id = ?`,
    [id]
  );

  if (interviews.length === 0) {
    throw new NotFoundError('Interview not found');
  }
  const interview = interviews[0];
  res.json({
    success: true,
    data: {
      interview: interviews[0]
    }
  });
}));

// Create new interview
router.post('/', authenticateToken, checkPermission('interviews', 'create'), asyncHandler(async (req, res) => {
  const {
    candidate_id,
    interviewer_id,
    scheduled_date,
    type,
    location,
    meeting_link,
    notes,
    status = 'Scheduled'
  } = req.body;

  // Validate required fields
  if (!candidate_id || !interviewer_id || !scheduled_date || !type) {
    throw new ValidationError('Missing required fields: candidate_id, interviewer_id, scheduled_date, type');
  }

  // Check if candidate exists
  const candidate = await query('SELECT id FROM candidates WHERE id = ?', [candidate_id]);
  if (candidate.length === 0) {
    throw new ValidationError('Candidate not found');
  }

  // Check if interviewer exists
  const interviewer = await query('SELECT id FROM users WHERE id = ? AND role = "Interviewer"', [interviewer_id]);
  if (interviewer.length === 0) {
    throw new ValidationError('Interviewer not found or invalid role');
  }

  // Check for scheduling conflicts
  const conflictCheck = await query(
    `SELECT id FROM interviews 
     WHERE interviewer_id = ? 
     AND scheduled_date = ? 
     AND status IN ('Scheduled', 'In Progress')`,
    [interviewer_id, scheduled_date]
  );

  if (conflictCheck.length > 0) {
    throw new ValidationError('Interviewer has a scheduling conflict at this time');
  }

  // Create interview
  const result = await query(
    `INSERT INTO interviews (candidate_id, interviewer_id, scheduled_date, type, location, meeting_link, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [candidate_id, interviewer_id, scheduled_date, type, location || null, meeting_link || null, notes || null, status]
  );

  res.status(201).json({
    success: true,
    data: {
      interviewId: result.insertId
    },
    message: 'Interview created successfully'
  });
}));

// Update interview
router.put('/:id', authenticateToken, checkPermission('interviews', 'edit'), validateId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    candidate_id,
    interviewer_id,
    scheduled_date,
    type,
    location,
    meeting_link,
    notes,
    status
  } = req.body;

  // Check if interview exists
  const existingInterview = await query('SELECT * FROM interviews WHERE id = ?', [id]);
  if (existingInterview.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  // Validate required fields if provided
  if (candidate_id) {
    const candidate = await query('SELECT id FROM candidates WHERE id = ?', [candidate_id]);
    if (candidate.length === 0) {
      throw new ValidationError('Candidate not found');
    }
  }

  if (interviewer_id) {
    const interviewer = await query('SELECT id FROM users WHERE id = ? AND role = "Interviewer"', [interviewer_id]);
    if (interviewer.length === 0) {
      throw new ValidationError('Interviewer not found or invalid role');
    }
  }

  // Check for scheduling conflicts (excluding current interview)
  if (interviewer_id && scheduled_date) {
    const conflictCheck = await query(
      `SELECT id FROM interviews 
       WHERE interviewer_id = ? 
       AND scheduled_date = ? 
       AND status IN ('Scheduled', 'In Progress')
       AND id != ?`,
      [interviewer_id, scheduled_date, id]
    );

    if (conflictCheck.length > 0) {
      throw new ValidationError('Interviewer has a scheduling conflict at this time');
    }
  }

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];

  if (candidate_id !== undefined) {
    updateFields.push('candidate_id = ?');
    updateValues.push(candidate_id);
  }
  if (interviewer_id !== undefined) {
    updateFields.push('interviewer_id = ?');
    updateValues.push(interviewer_id);
  }
  if (scheduled_date !== undefined) {
    updateFields.push('scheduled_date = ?');
    updateValues.push(scheduled_date);
  }
  if (type !== undefined) {
    updateFields.push('type = ?');
    updateValues.push(type);
  }
  if (location !== undefined) {
    updateFields.push('location = ?');
    updateValues.push(location);
  }
  if (meeting_link !== undefined) {
    updateFields.push('meeting_link = ?');
    updateValues.push(meeting_link);
  }
  if (notes !== undefined) {
    updateFields.push('notes = ?');
    updateValues.push(notes);
  }
  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (updateFields.length === 0) {
    throw new ValidationError('No fields to update');
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await query(
    `UPDATE interviews SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  res.json({
    success: true,
    message: 'Interview updated successfully'
  });
}));

// Delete interview
router.delete('/:id', authenticateToken, checkPermission('interviews', 'delete'), validateId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if interview exists
  const interview = await query('SELECT * FROM interviews WHERE id = ?', [id]);
  if (interview.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  // Check if interview can be deleted (not completed)
  if (interview[0].status === 'Completed') {
    throw new ValidationError('Cannot delete completed interviews');
  }

  await query('DELETE FROM interviews WHERE id = ?', [id]);

  res.json({
    success: true,
    message: 'Interview deleted successfully'
  });
}));

// Update interview status
router.patch('/:id/status', authenticateToken, checkPermission('interviews', 'edit'), validateId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError('Invalid status. Must be one of: ' + validStatuses.join(', '));
  }

  // Check if interview exists
  const interview = await query('SELECT * FROM interviews WHERE id = ?', [id]);
  if (interview.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  await query(
    'UPDATE interviews SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, id]
  );

  res.json({
    success: true,
    message: 'Interview status updated successfully'
  });
}));

// Get interviewer's interviews
router.get('/interviewer/:interviewerId', authenticateToken, checkPermission('interviews', 'view'), validateId('interviewerId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const interviewerId = req.params.interviewerId;

  // Check if user can access this data
  if (req.user.id !== interviewerId && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('Access denied');
  }

  const interviews = await query(
    `SELECT i.*, c.name as candidate_name, c.position as candidate_position 
     FROM interviews i
     LEFT JOIN candidates c ON i.candidate_id = c.id
     WHERE i.interviewer_id = ?
     ORDER BY i.scheduled_date DESC`,
    [interviewerId]
  );

  res.json({
    success: true,
    data: {
      interviews
    }
  });
}));

// Get interview statistics
router.get('/stats/overview', authenticateToken, checkPermission('interviews', 'view'), asyncHandler(async (req, res) => {
  const stats = await query(`
    SELECT 
      COUNT(*) as total_interviews,
      COUNT(CASE WHEN status = 'Scheduled' THEN 1 END) as scheduled_interviews,
      COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_interviews,
      COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled_interviews,
      COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_interviews,
      COUNT(CASE WHEN scheduled_date >= CURDATE() AND scheduled_date < DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as this_week_interviews,
      COUNT(CASE WHEN scheduled_date >= CURDATE() AND scheduled_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN 1 END) as today_interviews
    FROM interviews
  `);

  res.json({
    success: true,
    data: {
      stats: stats[0]
    }
  });
}));

export default router;







