/**
 * Checklists API Routes
 *
 * Endpoints for managing checklist items within tasks in the HR Planner Workspace.
 * Implements Requirement R6: Checklist Management
 *
 * Routes:
 * - GET  /api/planner/tasks/:taskId/checklists          - List checklist items (ORDER BY position ASC)
 * - POST /api/planner/tasks/:taskId/checklists          - Add a checklist item
 * - PUT  /api/planner/checklists/:id                   - Update item_text and/or is_checked
 * - DELETE /api/planner/checklists/:id                 - Hard-delete a checklist item
 * - PUT  /api/planner/tasks/:taskId/checklists/reorder  - Reorder items (transaction)
 */

import express from 'express';
import { query, transaction } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../../middleware/errorHandler.js';
import { validateChecklistItem } from '../../utils/plannerValidation.js';
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
 * GET /api/planner/tasks/:taskId/checklists
 *
 * Returns all checklist items for a task, ordered by position ASC.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/tasks/:taskId/checklists',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskExists(taskId);

    const items = await query(
      `SELECT id, item_text, is_checked, position, created_at, updated_at
         FROM task_checklists
        WHERE task_id = ?
        ORDER BY position ASC`,
      [taskId]
    );

    res.json({ success: true, data: { items } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/tasks/:taskId/checklists
 *
 * Add a new checklist item to a task.
 * Auto-assigns position at the end of the current list.
 * Logs 'checklist_updated' activity.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/tasks/:taskId/checklists',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskExists(taskId);

    const { item_text } = req.body;
    if (!validateChecklistItem(item_text)) {
      throw new ValidationError('item_text must be between 1 and 500 characters');
    }

    const userId = req.user.id;

    // Determine next position
    const posRows = await query(
      'SELECT COALESCE(MAX(position), -1) AS max_pos FROM task_checklists WHERE task_id = ?',
      [taskId]
    );
    const nextPosition = Number(posRows[0].max_pos) + 1;

    const result = await query(
      `INSERT INTO task_checklists (task_id, item_text, is_checked, position, created_by, updated_by)
       VALUES (?, ?, 0, ?, ?, ?)`,
      [taskId, item_text.trim(), nextPosition, userId, userId]
    );

    await logActivity(taskId, userId, 'checklist_updated', {
      action: 'added',
      item_id: result.insertId,
      item_text: item_text.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Checklist item added',
      data: { itemId: result.insertId },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/tasks/:taskId/checklists/reorder
 *
 * NOTE: Registered BEFORE /checklists/:id so "reorder" is not treated as an ID.
 *
 * Reorder checklist items for a task.
 * Body: Array of { id: number, position: number }
 * Wrapped in a transaction.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/tasks/:taskId/checklists/reorder',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskExists(taskId);

    const { body } = req;
    if (!Array.isArray(body) || body.length === 0) {
      throw new ValidationError('Request body must be a non-empty array of { id, position }');
    }

    for (const entry of body) {
      if (
        !entry ||
        typeof entry.id !== 'number' ||
        typeof entry.position !== 'number' ||
        !Number.isInteger(entry.id) ||
        !Number.isInteger(entry.position) ||
        entry.id <= 0 ||
        entry.position < 0
      ) {
        throw new ValidationError(
          'Each reorder entry must have positive integer id and non-negative integer position'
        );
      }
    }

    await transaction(async (conn) => {
      for (const { id, position } of body) {
        await conn.execute(
          `UPDATE task_checklists SET position = ?, updated_at = NOW() WHERE id = ? AND task_id = ?`,
          [position, id, taskId]
        );
      }
    });

    res.json({ success: true, message: 'Checklist items reordered successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/checklists/:id
 *
 * Update item_text and/or is_checked for a checklist item.
 * Logs 'checklist_updated' activity.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/checklists/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) throw new ValidationError('Invalid checklist item ID');

    const rows = await query(
      'SELECT id, task_id, item_text, is_checked FROM task_checklists WHERE id = ?',
      [itemId]
    );
    if (rows.length === 0) throw new NotFoundError('Checklist item not found');

    const item = rows[0];
    const { item_text, is_checked } = req.body;
    const userId = req.user.id;

    if (item_text !== undefined && !validateChecklistItem(item_text)) {
      throw new ValidationError('item_text must be between 1 and 500 characters');
    }

    const updates = [];
    const params = [];

    if (item_text !== undefined) { updates.push('item_text = ?'); params.push(item_text.trim()); }
    if (is_checked !== undefined) { updates.push('is_checked = ?'); params.push(is_checked ? 1 : 0); }

    if (updates.length === 0) throw new ValidationError('No fields to update');

    updates.push('updated_by = ?');
    params.push(userId);
    params.push(itemId);

    await query(
      `UPDATE task_checklists SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    await logActivity(item.task_id, userId, 'checklist_updated', {
      action: 'updated',
      item_id: itemId,
      ...(item_text !== undefined && { item_text: item_text.trim() }),
      ...(is_checked !== undefined && { is_checked: Boolean(is_checked) }),
    });

    res.json({ success: true, message: 'Checklist item updated' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * DELETE /api/planner/checklists/:id
 *
 * Hard-delete a checklist item (no soft-delete for checklist items).
 * Logs 'checklist_updated' activity.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.delete(
  '/checklists/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) throw new ValidationError('Invalid checklist item ID');

    const rows = await query(
      'SELECT id, task_id, item_text FROM task_checklists WHERE id = ?',
      [itemId]
    );
    if (rows.length === 0) throw new NotFoundError('Checklist item not found');

    const item = rows[0];
    const userId = req.user.id;

    await query('DELETE FROM task_checklists WHERE id = ?', [itemId]);

    await logActivity(item.task_id, userId, 'checklist_updated', {
      action: 'deleted',
      item_id: itemId,
      item_text: item.item_text,
    });

    res.json({ success: true, message: 'Checklist item deleted' });
  })
);

export default router;


