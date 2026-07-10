/**
 * Labels API Routes
 *
 * Endpoints for managing labels and applying them to tasks in the HR Planner Workspace.
 * Implements Requirement R8: Label Management
 *
 * Routes:
 * - GET    /api/planner/labels                            - List all non-deleted labels
 * - POST   /api/planner/labels                           - Create a new label
 * - PUT    /api/planner/labels/:id                       - Update a label
 * - DELETE /api/planner/labels/:id                       - Soft-delete a label (cascades task_labels via FK)
 * - POST   /api/planner/tasks/:taskId/labels             - Apply a label to a task
 * - DELETE /api/planner/tasks/:taskId/labels/:labelId    - Remove a label from a task
 */

import express from 'express';
import { query } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../../middleware/errorHandler.js';
import { validateLabelName } from '../../utils/plannerValidation.js';
import { logActivity } from '../../services/plannerService.js';

const router = express.Router();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/labels
 *
 * Returns all non-deleted labels.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/labels',
  authenticate,
  asyncHandler(async (req, res) => {
    const labels = await query(
      `SELECT id, name, colour, icon, category, is_system, created_by, created_at, updated_at
         FROM labels
        WHERE is_deleted = 0
        ORDER BY name ASC`
    );

    res.json({ success: true, data: { labels } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/labels
 *
 * Create a new label.
 * Body: { name, colour, icon?, category? }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/labels',
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, colour, icon, category } = req.body;
    const userId = req.user.id;

    if (!validateLabelName(name)) {
      throw new ValidationError('Label name must be between 1 and 50 characters');
    }

    if (!colour || typeof colour !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(colour)) {
      throw new ValidationError('colour is required and must be a valid hex colour (e.g. #3B82F6)');
    }

    const result = await query(
      `INSERT INTO labels (name, colour, icon, category, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), colour, icon || null, category || 'custom', userId]
    );

    res.status(201).json({
      success: true,
      message: 'Label created successfully',
      data: { labelId: result.insertId },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/labels/:id
 *
 * Update label name, colour, icon, or category.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/labels/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const labelId = parseInt(req.params.id, 10);
    if (isNaN(labelId)) throw new ValidationError('Invalid label ID');

    const labels = await query(
      'SELECT id FROM labels WHERE id = ? AND is_deleted = 0',
      [labelId]
    );
    if (labels.length === 0) throw new NotFoundError('Label not found');

    const { name, colour, icon, category } = req.body;

    if (name !== undefined && !validateLabelName(name)) {
      throw new ValidationError('Label name must be between 1 and 50 characters');
    }

    if (colour !== undefined && (typeof colour !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(colour))) {
      throw new ValidationError('colour must be a valid hex colour (e.g. #3B82F6)');
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (colour !== undefined) { updates.push('colour = ?'); params.push(colour); }
    if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }

    if (updates.length === 0) throw new ValidationError('No fields to update');

    params.push(labelId);
    await query(
      `UPDATE labels SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Label updated successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * DELETE /api/planner/labels/:id
 *
 * Soft-delete a label (is_deleted = 1).
 * task_labels rows are removed automatically via ON DELETE CASCADE on the FK.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.delete(
  '/labels/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const labelId = parseInt(req.params.id, 10);
    if (isNaN(labelId)) throw new ValidationError('Invalid label ID');

    const labels = await query(
      'SELECT id FROM labels WHERE id = ? AND is_deleted = 0',
      [labelId]
    );
    if (labels.length === 0) throw new NotFoundError('Label not found');

    await query(
      'UPDATE labels SET is_deleted = 1, updated_at = NOW() WHERE id = ?',
      [labelId]
    );

    res.json({ success: true, message: 'Label deleted successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/tasks/:taskId/labels
 *
 * Apply a label to a task (INSERT IGNORE to handle duplicate gracefully).
 * Body: { labelId }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/tasks/:taskId/labels',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    const { labelId } = req.body;
    if (!labelId || isNaN(parseInt(labelId, 10))) {
      throw new ValidationError('labelId is required and must be a valid integer');
    }
    const parsedLabelId = parseInt(labelId, 10);

    // Verify task exists
    const tasks = await query(
      'SELECT id FROM planner_tasks WHERE id = ? AND is_deleted = 0',
      [taskId]
    );
    if (tasks.length === 0) throw new NotFoundError('Task not found');

    // Verify label exists
    const labelRows = await query(
      'SELECT id FROM labels WHERE id = ? AND is_deleted = 0',
      [parsedLabelId]
    );
    if (labelRows.length === 0) throw new NotFoundError('Label not found');

    await query(
      'INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)',
      [taskId, parsedLabelId]
    );

    res.status(201).json({ success: true, message: 'Label applied to task' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * DELETE /api/planner/tasks/:taskId/labels/:labelId
 *
 * Remove a label from a task. Logs 'label_changed' activity.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.delete(
  '/tasks/:taskId/labels/:labelId',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    const labelId = parseInt(req.params.labelId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');
    if (isNaN(labelId)) throw new ValidationError('Invalid label ID');

    // Verify task exists
    const tasks = await query(
      'SELECT id FROM planner_tasks WHERE id = ? AND is_deleted = 0',
      [taskId]
    );
    if (tasks.length === 0) throw new NotFoundError('Task not found');

    await query(
      'DELETE FROM task_labels WHERE task_id = ? AND label_id = ?',
      [taskId, labelId]
    );

    await logActivity(taskId, req.user.id, 'label_changed', {
      action: 'removed',
      label_id: labelId,
    });

    res.json({ success: true, message: 'Label removed from task' });
  })
);

export default router;

