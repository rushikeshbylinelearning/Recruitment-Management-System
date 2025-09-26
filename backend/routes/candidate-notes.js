import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateId, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all notes for a candidate
router.get('/candidate/:candidateId', authenticateToken, checkPermission('candidates', 'view'), validateId('candidateId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.candidateId;
  const { noteType, userRole } = req.query;

  let whereClause = 'WHERE cn.candidate_id = ?';
  let params = [candidateId];

  if (noteType) {
    whereClause += ' AND cn.note_type = ?';
    params.push(noteType);
  }

  if (userRole) {
    whereClause += ' AND cn.user_role = ?';
    params.push(userRole);
  }

  // Check if user can view private notes
  const canViewPrivate = req.user.role === 'Admin' || req.user.role === 'HR Manager';
  if (!canViewPrivate) {
    whereClause += ' AND cn.is_private = FALSE';
  }

  const notes = await query(
    `SELECT cn.*, u.name as user_name, u.role as user_role_name
     FROM candidate_notes cn
     LEFT JOIN users u ON cn.user_id = u.id
     ${whereClause}
     ORDER BY cn.created_at DESC`,
    params
  );

  res.json({
    success: true,
    data: { notes }
  });
}));

// Add a new note for a candidate
router.post('/candidate/:candidateId', authenticateToken, checkPermission('candidates', 'edit'), validateId('candidateId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.candidateId;
  const { noteType, content, isPrivate } = req.body;

  if (!noteType || !content) {
    throw new ValidationError('Note type and content are required');
  }

  // Validate note type
  const validNoteTypes = ['Pre-Interview', 'Interview', 'Post-Interview', 'General'];
  if (!validNoteTypes.includes(noteType)) {
    throw new ValidationError('Invalid note type');
  }

  // Check if candidate exists
  const candidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Determine user role for the note
  const userRole = req.user.role === 'HR Manager' ? 'HR Manager' : 
                  req.user.role === 'Interviewer' ? 'Interviewer' :
                  req.user.role === 'Admin' ? 'Admin' : 'Recruiter';

  // Create note
  const result = await query(
    `INSERT INTO candidate_notes (candidate_id, user_id, user_role, note_type, content, is_private) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [candidateId, req.user.id, userRole, noteType, content, isPrivate || false]
  );

  res.status(201).json({
    success: true,
    message: 'Note added successfully',
    data: {
      noteId: result.insertId
    }
  });
}));

// Update a note
router.put('/:noteId', authenticateToken, checkPermission('candidates', 'edit'), validateId('noteId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const noteId = req.params.noteId;
  const { content, isPrivate } = req.body;

  if (!content) {
    throw new ValidationError('Content is required');
  }

  // Check if note exists and user can edit it
  const notes = await query(
    'SELECT * FROM candidate_notes WHERE id = ?',
    [noteId]
  );

  if (notes.length === 0) {
    throw new NotFoundError('Note not found');
  }

  const note = notes[0];

  // Check if user can edit this note (only the author or admin/hr manager)
  if (note.user_id !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only edit your own notes');
  }

  // Update note
  await query(
    'UPDATE candidate_notes SET content = ?, is_private = ?, updated_at = NOW() WHERE id = ?',
    [content, isPrivate || false, noteId]
  );

  res.json({
    success: true,
    message: 'Note updated successfully'
  });
}));

// Delete a note
router.delete('/:noteId', authenticateToken, checkPermission('candidates', 'edit'), validateId('noteId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const noteId = req.params.noteId;

  // Check if note exists and user can delete it
  const notes = await query(
    'SELECT * FROM candidate_notes WHERE id = ?',
    [noteId]
  );

  if (notes.length === 0) {
    throw new NotFoundError('Note not found');
  }

  const note = notes[0];

  // Check if user can delete this note (only the author or admin/hr manager)
  if (note.user_id !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only delete your own notes');
  }

  // Delete note
  await query('DELETE FROM candidate_notes WHERE id = ?', [noteId]);

  res.json({
    success: true,
    message: 'Note deleted successfully'
  });
}));

// Get note by ID
router.get('/:noteId', authenticateToken, checkPermission('candidates', 'view'), validateId('noteId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const noteId = req.params.noteId;

  const notes = await query(
    `SELECT cn.*, u.name as user_name, u.role as user_role_name
     FROM candidate_notes cn
     LEFT JOIN users u ON cn.user_id = u.id
     WHERE cn.id = ?`,
    [noteId]
  );

  if (notes.length === 0) {
    throw new NotFoundError('Note not found');
  }

  const note = notes[0];

  // Check if user can view private notes
  const canViewPrivate = req.user.role === 'Admin' || req.user.role === 'HR Manager';
  if (note.is_private && !canViewPrivate && note.user_id !== req.user.id) {
    throw new ValidationError('Access denied to private note');
  }

  res.json({
    success: true,
    data: { note }
  });
}));

export default router;
