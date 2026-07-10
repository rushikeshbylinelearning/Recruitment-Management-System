/**
 * Activity API Routes
 *
 * Read-only endpoint for the task activity log in the HR Planner Workspace.
 * Implements Requirement R9: Activity Log (append-only, never mutated)
 *
 * Routes:
 * - GET /api/planner/tasks/:taskId/activity  - List activity log entries for a task (ORDER BY created_at ASC)
 */

import express from 'express';
import { query } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../../middleware/errorHandler.js';

const router = express.Router();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/tasks/:taskId/activity
 *
 * Returns all activity log entries for a task, ordered by created_at ASC.
 * Joins users table to include the name of the user who performed each action.
 *
 * The activity log is append-only â€” this endpoint is strictly read-only.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/tasks/:taskId/activity',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    // Verify task exists
    const tasks = await query(
      'SELECT id FROM planner_tasks WHERE id = ? AND is_deleted = 0',
      [taskId]
    );
    if (tasks.length === 0) throw new NotFoundError('Task not found');

    const entries = await query(
      `SELECT
         a.id,
         a.task_id,
         a.user_id,
         a.action_type,
         a.action_details,
         a.created_at,
         u.name AS user_name
       FROM task_activity_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.task_id = ?
       ORDER BY a.created_at ASC`,
      [taskId]
    );

    res.json({ success: true, data: { entries } });
  })
);

export default router;

