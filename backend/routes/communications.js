import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateCommunication, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all communications
router.get('/', authenticateToken, checkPermission('communications', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const type = req.query.type || '';
  const status = req.query.status || '';
  const candidateId = req.query.candidateId || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (type) {
    whereClause += ' AND c.type = ?';
    params.push(type);
  }

  if (status) {
    whereClause += ' AND c.status = ?';
    params.push(status);
  }

  if (candidateId) {
    whereClause += ' AND c.candidate_id = ?';
    params.push(candidateId);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM communications c ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get communications
  const communications = await query(
    `SELECT c.*, cand.name as candidate_name, cand.position as candidate_position, u.name as created_by_name 
     FROM communications c
     LEFT JOIN candidates cand ON c.candidate_id = cand.id
     LEFT JOIN users u ON c.created_by = u.id
     ${whereClause}
     ORDER BY c.date DESC 
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: {
      communications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get communication by ID
router.get('/:id', authenticateToken, checkPermission('communications', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const communicationId = req.params.id;

  const communications = await query(
    `SELECT c.*, cand.name as candidate_name, cand.position as candidate_position, u.name as created_by_name 
     FROM communications c
     LEFT JOIN candidates cand ON c.candidate_id = cand.id
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.id = ?`,
    [communicationId]
  );

  if (communications.length === 0) {
    throw new NotFoundError('Communication not found');
  }

  res.json({
    success: true,
    data: { communication: communications[0] }
  });
}));

// Create new communication
router.post('/', authenticateToken, checkPermission('communications', 'create'), validateCommunication, handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    candidateId,
    type,
    content,
    status,
    followUp
  } = req.body;

  // Validate candidate exists
  const candidates = await query('SELECT id, name FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new ValidationError('Candidate not found');
  }

  // Create communication
  const result = await query(
    `INSERT INTO communications (candidate_id, type, date, content, status, follow_up, created_by) 
     VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
    [candidateId, type, content, status, followUp || null, req.user.id]
  );

  res.status(201).json({
    success: true,
    message: 'Communication logged successfully',
    data: {
      communicationId: result.insertId
    }
  });
}));

// Update communication
router.put('/:id', authenticateToken, checkPermission('communications', 'edit'), validateId('id'), validateCommunication, handleValidationErrors, asyncHandler(async (req, res) => {
  const communicationId = req.params.id;
  const {
    candidateId,
    type,
    content,
    status,
    followUp
  } = req.body;

  // Check if communication exists
  const existingCommunications = await query('SELECT id, created_by FROM communications WHERE id = ?', [communicationId]);
  if (existingCommunications.length === 0) {
    throw new NotFoundError('Communication not found');
  }

  // Check if user can update this communication
  const communication = existingCommunications[0];
  if (communication.created_by !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only update your own communications');
  }

  // Validate candidate exists
  const candidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new ValidationError('Candidate not found');
  }

  // Update communication
  await query(
    `UPDATE communications SET candidate_id = ?, type = ?, content = ?, status = ?, follow_up = ?, updated_at = NOW() 
     WHERE id = ?`,
    [candidateId, type, content, status, followUp || null, communicationId]
  );

  res.json({
    success: true,
    message: 'Communication updated successfully'
  });
}));

// Delete communication
router.delete('/:id', authenticateToken, checkPermission('communications', 'delete'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const communicationId = req.params.id;

  // Check if communication exists
  const existingCommunications = await query('SELECT id, created_by FROM communications WHERE id = ?', [communicationId]);
  if (existingCommunications.length === 0) {
    throw new NotFoundError('Communication not found');
  }

  // Check if user can delete this communication
  const communication = existingCommunications[0];
  if (communication.created_by !== req.user.id && req.user.role !== 'Admin') {
    throw new ValidationError('You can only delete your own communications');
  }

  // Delete communication
  await query('DELETE FROM communications WHERE id = ?', [communicationId]);

  res.json({
    success: true,
    message: 'Communication deleted successfully'
  });
}));

// Get candidate communications
router.get('/candidate/:candidateId', authenticateToken, checkPermission('communications', 'view'), validateId('candidateId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.candidateId;

  // Validate candidate exists
  const candidates = await query('SELECT id, name FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const communications = await query(
    `SELECT c.*, u.name as created_by_name 
     FROM communications c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.candidate_id = ?
     ORDER BY c.date DESC`,
    [candidateId]
  );

  res.json({
    success: true,
    data: {
      candidate: candidates[0],
      communications
    }
  });
}));

// Update communication status
router.patch('/:id/status', authenticateToken, checkPermission('communications', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const communicationId = req.params.id;
  const { status } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const validStatuses = ['Sent', 'Received', 'Pending'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError('Invalid status');
  }

  // Check if communication exists
  const existingCommunications = await query('SELECT id, created_by FROM communications WHERE id = ?', [communicationId]);
  if (existingCommunications.length === 0) {
    throw new NotFoundError('Communication not found');
  }

  // Check if user can update this communication
  const communication = existingCommunications[0];
  if (communication.created_by !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only update your own communications');
  }

  // Update status
  await query(
    'UPDATE communications SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, communicationId]
  );

  res.json({
    success: true,
    message: 'Communication status updated successfully'
  });
}));

// Get communication statistics
router.get('/stats/overview', authenticateToken, checkPermission('communications', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const stats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM communications) as total_communications,
       (SELECT COUNT(*) FROM communications WHERE type = 'Email') as emails,
       (SELECT COUNT(*) FROM communications WHERE type = 'Phone') as phone_calls,
       (SELECT COUNT(*) FROM communications WHERE type = 'WhatsApp') as whatsapp_messages,
       (SELECT COUNT(*) FROM communications WHERE type = 'LinkedIn') as linkedin_messages,
       (SELECT COUNT(*) FROM communications WHERE status = 'Sent') as sent,
       (SELECT COUNT(*) FROM communications WHERE status = 'Received') as received,
       (SELECT COUNT(*) FROM communications WHERE status = 'Pending') as pending`,
    []
  );

  // Get communications by date (last 30 days)
  const dailyStats = await query(
    `SELECT DATE(date) as date, COUNT(*) as count, type 
     FROM communications 
     WHERE date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(date), type
     ORDER BY date DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      statistics: stats[0],
      dailyStats
    }
  });
}));

export default router;

