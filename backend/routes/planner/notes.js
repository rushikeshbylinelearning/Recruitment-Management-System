/**
 * Notes API Routes
 *
 * Endpoints for managing rich-text notes attached to tasks in the HR Planner Workspace.
 * Implements Requirement R7: Task Notes with Rich Text
 *
 * Routes:
 * - GET /api/planner/tasks/:taskId/notes  - Get the note for a task
 * - PUT /api/planner/tasks/:taskId/notes  - Upsert the note for a task (INSERT ... ON DUPLICATE KEY UPDATE)
 *
 * Security:
 * - note_content is run through sanitizeHtml() before storage (XSS prevention)
 * - Raw input is limited to 50,000 characters before sanitization
 * - Activity is logged without the full note content (privacy)
 */

import express from 'express';
import { query } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../../middleware/errorHandler.js';
import { sanitizeHtml } from '../../utils/htmlSanitizer.js';
import { logActivity } from '../../services/plannerService.js';

const router = express.Router();

const NOTE_MAX_RAW_LENGTH = 50_000;

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Helper: verify a task exists and is not soft-deleted.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function assertTaskExists(taskId) {
  const tasks = await query(
    'SELECT id FROM planner_tasks WHERE id = ? AND is_deleted = 0',
    [taskId]
  );
  if (tasks.length === 0) throw new NotFoundError('Task not found');
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/tasks/:taskId/notes
 *
 * Returns the note_content for the given task, or null if no note exists yet.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/tasks/:taskId/notes',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskExists(taskId);

    const rows = await query(
      'SELECT note_content, updated_at FROM task_notes WHERE task_id = ?',
      [taskId]
    );

    const noteContent = rows.length > 0 ? rows[0].note_content : null;
    const updatedAt = rows.length > 0 ? rows[0].updated_at : null;

    res.json({ success: true, data: { note_content: noteContent, updated_at: updatedAt } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/tasks/:taskId/notes
 *
 * Create or update the note for a task (upsert).
 * Uses INSERT ... ON DUPLICATE KEY UPDATE â€” task_notes has UNIQUE task_id.
 *
 * Body: { note_content: string }
 *
 * Processing:
 *   1. Enforce 50,000 char limit on raw input
 *   2. Run sanitizeHtml() to strip XSS vectors
 *   3. Upsert into task_notes
 *   4. Log 'task_edited' without full content
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/tasks/:taskId/notes',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskExists(taskId);

    const { note_content } = req.body;

    if (note_content === undefined || note_content === null) {
      throw new ValidationError('note_content is required');
    }

    if (typeof note_content !== 'string') {
      throw new ValidationError('note_content must be a string');
    }

    // Enforce raw input length limit before sanitization
    if (note_content.length > NOTE_MAX_RAW_LENGTH) {
      throw new ValidationError(
        `note_content must not exceed ${NOTE_MAX_RAW_LENGTH.toLocaleString()} characters`
      );
    }

    const sanitized = sanitizeHtml(note_content);
    const userId = req.user.id;

    // Upsert â€” task_notes.task_id has a UNIQUE constraint
    await query(
      `INSERT INTO task_notes (task_id, note_content, created_by, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         note_content = VALUES(note_content),
         updated_by   = VALUES(updated_by),
         updated_at   = NOW()`,
      [taskId, sanitized, userId, userId]
    );

    // Log activity without full note content (privacy / log size)
    await logActivity(taskId, userId, 'task_edited', {
      changed_fields: { notes: 'updated' },
    });

    res.json({ success: true, message: 'Note saved successfully' });
  })
);

export default router;

