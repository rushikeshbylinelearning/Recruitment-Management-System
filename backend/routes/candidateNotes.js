import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// POST /api/candidate-notes
router.post(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { candidateId, noteText } = req.body;

    // Validate UUID format (8-4-4-4-12 hex characters)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!candidateId || typeof candidateId !== 'string' || !uuidRegex.test(candidateId)) {
      throw new ValidationError('candidateId must be a valid UUID');
    }

    if (!noteText || typeof noteText !== 'string' || noteText.trim().length === 0) {
      throw new ValidationError('noteText must be a non-empty string');
    }

    const authorId = req.user.id;
    const trimmedText = noteText.trim();

    const result = await query(
      `INSERT INTO candidate_notes (candidate_id, author_id, note_text, created_at)
       VALUES (?, ?, ?, NOW())`,
      [candidateId, authorId, trimmedText]
    );

    const notes = await query(
      `SELECT cn.id, cn.candidate_id, cn.author_id, cn.note_text, cn.created_at,
              u.name AS author_name
       FROM candidate_notes cn
       LEFT JOIN users u ON cn.author_id = u.id
       WHERE cn.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: notes[0] });
  })
);

// GET /api/candidate-notes?candidateId=:id
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { candidateId } = req.query;

    // Validate UUID format (8-4-4-4-12 hex characters)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!candidateId || typeof candidateId !== 'string' || !uuidRegex.test(candidateId)) {
      throw new ValidationError('candidateId query param must be a valid UUID');
    }

    const notes = await query(
      `SELECT cn.id, cn.candidate_id, cn.author_id, cn.note_text, cn.created_at,
              u.name AS author_name
       FROM candidate_notes cn
       LEFT JOIN users u ON cn.author_id = u.id
       WHERE cn.candidate_id = ?
       ORDER BY cn.created_at DESC`,
      [candidateId]
    );

    res.json({ success: true, data: notes });
  })
);

export default router;
