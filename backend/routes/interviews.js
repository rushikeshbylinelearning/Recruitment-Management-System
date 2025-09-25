import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateInterview, validateInterviewFeedback, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all interviews
router.get('/', authenticateToken, checkPermission('interviews', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const type = req.query.type || '';
  const interviewerId = req.query.interviewerId || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (status) {
    whereClause += ' AND i.status = ?';
    params.push(status);
  }

  if (type) {
    whereClause += ' AND i.type = ?';
    params.push(type);
  }

  if (interviewerId) {
    whereClause += ' AND i.interviewer_id = ?';
    params.push(interviewerId);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM interviews i ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get interviews
  const interviews = await query(
    `SELECT i.*, c.name as candidate_name, c.position as candidate_position, u.name as interviewer_name 
     FROM interviews i
     LEFT JOIN candidates c ON i.candidate_id = c.id
     LEFT JOIN users u ON i.interviewer_id = u.id
     ${whereClause}
     ORDER BY i.scheduled_date DESC 
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Get feedback for each interview
  for (let interview of interviews) {
    const feedback = await query(
      'SELECT * FROM interview_feedback WHERE interview_id = ?',
      [interview.id]
    );
    interview.feedback = feedback.length > 0 ? feedback[0] : null;
  }

  res.json({
    success: true,
    data: {
      interviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get interview by ID
router.get('/:id', authenticateToken, checkPermission('interviews', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const interviewId = req.params.id;

  const interviews = await query(
    `SELECT i.*, c.name as candidate_name, c.position as candidate_position, u.name as interviewer_name 
     FROM interviews i
     LEFT JOIN candidates c ON i.candidate_id = c.id
     LEFT JOIN users u ON i.interviewer_id = u.id
     WHERE i.id = ?`,
    [interviewId]
  );

  if (interviews.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  const interview = interviews[0];

  // Get feedback
  const feedback = await query(
    'SELECT * FROM interview_feedback WHERE interview_id = ?',
    [interviewId]
  );
  interview.feedback = feedback.length > 0 ? feedback[0] : null;

  // Parse JSON fields in feedback
  if (interview.feedback) {
    try {
      interview.feedback.ratings = JSON.parse(interview.feedback.ratings || '[]');
      interview.feedback.strengths = JSON.parse(interview.feedback.strengths || '[]');
      interview.feedback.weaknesses = JSON.parse(interview.feedback.weaknesses || '[]');
    } catch (e) {
      interview.feedback.ratings = [];
      interview.feedback.strengths = [];
      interview.feedback.weaknesses = [];
    }
  }

  res.json({
    success: true,
    data: { interview }
  });
}));

// Create new interview
router.post('/', authenticateToken, checkPermission('interviews', 'create'), validateInterview, handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    candidateId,
    interviewerId,
    scheduledDate,
    duration,
    type,
    status,
    meetingLink,
    location,
    round
  } = req.body;

  // Validate candidate exists
  const candidates = await query('SELECT id, name FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new ValidationError('Candidate not found');
  }

  // Validate interviewer exists and is an interviewer
  const interviewers = await query('SELECT id, name, role FROM users WHERE id = ? AND role = ?', [interviewerId, 'Interviewer']);
  if (interviewers.length === 0) {
    throw new ValidationError('Interviewer not found or not authorized');
  }

  // Check for scheduling conflicts
  const conflicts = await query(
    `SELECT id FROM interviews 
     WHERE interviewer_id = ? AND status = 'Scheduled' 
     AND scheduled_date BETWEEN DATE_SUB(?, INTERVAL ? MINUTE) AND DATE_ADD(?, INTERVAL ? MINUTE)`,
    [interviewerId, scheduledDate, duration, scheduledDate, duration]
  );

  if (conflicts.length > 0) {
    throw new ValidationError('Interviewer has a scheduling conflict');
  }

  // Create interview
  const result = await query(
    `INSERT INTO interviews (candidate_id, interviewer_id, scheduled_date, duration, type, status, meeting_link, location, round) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [candidateId, interviewerId, scheduledDate, duration, type, status, meetingLink, location, round]
  );

  res.status(201).json({
    success: true,
    message: 'Interview scheduled successfully',
    data: {
      interviewId: result.insertId
    }
  });
}));

// Update interview
router.put('/:id', authenticateToken, checkPermission('interviews', 'edit'), validateId('id'), validateInterview, handleValidationErrors, asyncHandler(async (req, res) => {
  const interviewId = req.params.id;
  const {
    candidateId,
    interviewerId,
    scheduledDate,
    duration,
    type,
    status,
    meetingLink,
    location,
    round
  } = req.body;

  // Check if interview exists
  const existingInterviews = await query('SELECT id FROM interviews WHERE id = ?', [interviewId]);
  if (existingInterviews.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  // Validate candidate exists
  const candidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new ValidationError('Candidate not found');
  }

  // Validate interviewer exists and is an interviewer
  const interviewers = await query('SELECT id FROM users WHERE id = ? AND role = ?', [interviewerId, 'Interviewer']);
  if (interviewers.length === 0) {
    throw new ValidationError('Interviewer not found or not authorized');
  }

  // Check for scheduling conflicts (excluding current interview)
  const conflicts = await query(
    `SELECT id FROM interviews 
     WHERE interviewer_id = ? AND status = 'Scheduled' AND id != ?
     AND scheduled_date BETWEEN DATE_SUB(?, INTERVAL ? MINUTE) AND DATE_ADD(?, INTERVAL ? MINUTE)`,
    [interviewerId, interviewId, scheduledDate, duration, scheduledDate, duration]
  );

  if (conflicts.length > 0) {
    throw new ValidationError('Interviewer has a scheduling conflict');
  }

  // Update interview
  await query(
    `UPDATE interviews SET candidate_id = ?, interviewer_id = ?, scheduled_date = ?, duration = ?, type = ?, 
     status = ?, meeting_link = ?, location = ?, round = ?, updated_at = NOW() 
     WHERE id = ?`,
    [candidateId, interviewerId, scheduledDate, duration, type, status, meetingLink, location, round, interviewId]
  );

  res.json({
    success: true,
    message: 'Interview updated successfully'
  });
}));

// Delete interview
router.delete('/:id', authenticateToken, checkPermission('interviews', 'delete'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const interviewId = req.params.id;

  // Check if interview exists
  const existingInterviews = await query('SELECT id FROM interviews WHERE id = ?', [interviewId]);
  if (existingInterviews.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  // Delete interview (cascading will handle feedback)
  await query('DELETE FROM interviews WHERE id = ?', [interviewId]);

  res.json({
    success: true,
    message: 'Interview deleted successfully'
  });
}));

// Submit interview feedback
router.post('/:id/feedback', authenticateToken, checkPermission('interviews', 'edit'), validateId('id'), validateInterviewFeedback, handleValidationErrors, asyncHandler(async (req, res) => {
  const interviewId = req.params.id;
  const {
    ratings,
    overallRating,
    comments,
    recommendation,
    strengths = [],
    weaknesses = [],
    additionalNotes
  } = req.body;

  // Check if interview exists and is completed
  const interviews = await query('SELECT id, interviewer_id, status FROM interviews WHERE id = ?', [interviewId]);
  if (interviews.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  const interview = interviews[0];
  if (interview.status !== 'Completed') {
    throw new ValidationError('Interview must be completed before submitting feedback');
  }

  // Check if user is the interviewer
  if (interview.interviewer_id !== req.user.id && req.user.role !== 'Admin') {
    throw new ValidationError('Only the interviewer can submit feedback');
  }

  // Check if feedback already exists
  const existingFeedback = await query('SELECT id FROM interview_feedback WHERE interview_id = ?', [interviewId]);
  if (existingFeedback.length > 0) {
    throw new ValidationError('Feedback already submitted for this interview');
  }

  // Create feedback
  await query(
    `INSERT INTO interview_feedback (interview_id, interviewer_id, ratings, overall_rating, comments, recommendation, strengths, weaknesses, additional_notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [interviewId, req.user.id, JSON.stringify(ratings), overallRating, comments, recommendation, 
     JSON.stringify(strengths), JSON.stringify(weaknesses), additionalNotes]
  );

  res.status(201).json({
    success: true,
    message: 'Interview feedback submitted successfully'
  });
}));

// Update interview status
router.patch('/:id/status', authenticateToken, checkPermission('interviews', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const interviewId = req.params.id;
  const { status } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const validStatuses = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError('Invalid status');
  }

  // Check if interview exists
  const existingInterviews = await query('SELECT id, interviewer_id FROM interviews WHERE id = ?', [interviewId]);
  if (existingInterviews.length === 0) {
    throw new NotFoundError('Interview not found');
  }

  const interview = existingInterviews[0];

  // Check if user can update this interview
  if (interview.interviewer_id !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only update your own interviews');
  }

  // Update status
  await query(
    'UPDATE interviews SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, interviewId]
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

  // Get feedback for each interview
  for (let interview of interviews) {
    const feedback = await query(
      'SELECT * FROM interview_feedback WHERE interview_id = ?',
      [interview.id]
    );
    interview.feedback = feedback.length > 0 ? feedback[0] : null;
  }

  res.json({
    success: true,
    data: { interviews }
  });
}));

// Get upcoming interviews
router.get('/upcoming/list', authenticateToken, checkPermission('interviews', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const interviewerId = req.query.interviewerId;

  let whereClause = 'WHERE i.status = "Scheduled" AND i.scheduled_date > NOW()';
  let params = [];

  if (interviewerId) {
    whereClause += ' AND i.interviewer_id = ?';
    params.push(interviewerId);
  }

  const interviews = await query(
    `SELECT i.*, c.name as candidate_name, c.position as candidate_position, u.name as interviewer_name 
     FROM interviews i
     LEFT JOIN candidates c ON i.candidate_id = c.id
     LEFT JOIN users u ON i.interviewer_id = u.id
     ${whereClause}
     ORDER BY i.scheduled_date ASC 
     LIMIT ?`,
    [...params, limit]
  );

  res.json({
    success: true,
    data: { interviews }
  });
}));

export default router;

