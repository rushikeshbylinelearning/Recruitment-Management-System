/**
 * Comments API Routes
 *
 * Endpoints for managing comments on tasks in the HR Planner Workspace.
 * Supports threaded comments via parent_comment_id.
 * Implements Requirement R10: Comments and Collaboration
 *
 * Routes:
 * - GET    /api/planner/tasks/:taskId/comments  - List non-deleted comments with author name
 * - POST   /api/planner/tasks/:taskId/comments  - Add a comment (optional parent_comment_id)
 * - PUT    /api/planner/comments/:id            - Edit own comment (owner or Admin only)
 * - DELETE /api/planner/comments/:id            - Soft-delete own comment (owner or Admin only)
 */

import express from 'express';
import { query } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../middleware/errorHandler.js';
import { logActivity } from '../../services/plannerService.js';

const router = express.Router();

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
 * GET /api/planner/tasks/:taskId/comments
 *
 * Returns all non-deleted comments for a task, ordered by created_at ASC.
 * Joins users table to include author name.
 * Includes parent_comment_id for client-side threading.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/tasks/:taskId/comments',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskExists(taskId);

    const comments = await query(
      `SELECT
         c.id,
         c.task_id,
         c.user_id,
         c.comment_text,
         c.parent_comment_id,
         c.created_at,
         c.updated_at,
         u.name AS author_name
       FROM task_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.task_id = ? AND c.is_deleted = 0
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    res.json({ success: true, data: { comments } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/tasks/:taskId/comments
 *
 * Add a comment to a task.
 * Body: { comment_text: string, parent_comment_id?: number }
 * Logs 'comment_added' activity.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/tasks/:taskId/comments',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskExists(taskId);

    const { comment_text, parent_comment_id } = req.body;
    const userId = req.user.id;

    if (!comment_text || typeof comment_text !== 'string' || comment_text.trim().length === 0) {
      throw new ValidationError('comment_text is required and must not be empty');
    }

    // Validate parent comment if provided
    if (parent_comment_id != null) {
      const parentRows = await query(
        'SELECT id FROM task_comments WHERE id = ? AND task_id = ? AND is_deleted = 0',
        [parent_comment_id, taskId]
      );
      if (parentRows.length === 0) {
        throw new NotFoundError('Parent comment not found');
      }
    }

    const result = await query(
      `INSERT INTO task_comments (task_id, user_id, comment_text, parent_comment_id)
       VALUES (?, ?, ?, ?)`,
      [taskId, userId, comment_text.trim(), parent_comment_id || null]
    );

    await logActivity(taskId, userId, 'comment_added', {
      comment_id: result.insertId,
      ...(parent_comment_id != null && { parent_comment_id }),
    });

    res.status(201).json({
      success: true,
      message: 'Comment added',
      data: { commentId: result.insertId },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/comments/:id
 *
 * Edit a comment. Only the comment owner or an Admin may edit.
 * Body: { comment_text: string }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/comments/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) throw new ValidationError('Invalid comment ID');

    const rows = await query(
      'SELECT id, task_id, user_id FROM task_comments WHERE id = ? AND is_deleted = 0',
      [commentId]
    );
    if (rows.length === 0) throw new NotFoundError('Comment not found');

    const comment = rows[0];
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only owner or Admin may edit
    if (comment.user_id !== userId && userRole !== 'Admin') {
      throw new ForbiddenError('You can only edit your own comments');
    }

    const { comment_text } = req.body;
    if (!comment_text || typeof comment_text !== 'string' || comment_text.trim().length === 0) {
      throw new ValidationError('comment_text is required and must not be empty');
    }

    await query(
      'UPDATE task_comments SET comment_text = ?, updated_at = NOW() WHERE id = ?',
      [comment_text.trim(), commentId]
    );

    res.json({ success: true, message: 'Comment updated' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * DELETE /api/planner/comments/:id
 *
 * Soft-delete a comment. Only the comment owner or an Admin may delete.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.delete(
  '/comments/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) throw new ValidationError('Invalid comment ID');

    const rows = await query(
      'SELECT id, task_id, user_id FROM task_comments WHERE id = ? AND is_deleted = 0',
      [commentId]
    );
    if (rows.length === 0) throw new NotFoundError('Comment not found');

    const comment = rows[0];
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only owner or Admin may delete
    if (comment.user_id !== userId && userRole !== 'Admin') {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await query(
      'UPDATE task_comments SET is_deleted = 1, updated_at = NOW() WHERE id = ?',
      [commentId]
    );

    res.json({ success: true, message: 'Comment deleted' });
  })
);

export default router;

