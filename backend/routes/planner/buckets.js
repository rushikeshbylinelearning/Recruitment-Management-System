/**
 * Buckets API Routes
 *
 * Endpoints for managing buckets within HR Planner Workspace plans.
 * Implements Requirement R2: Dynamic Bucket Management
 *
 * Routes:
 * - GET    /api/planner/plans/:planId/buckets   - List buckets for a plan with task counts and progress
 * - POST   /api/planner/plans/:planId/buckets   - Create a new bucket in a plan
 * - PUT    /api/planner/buckets/:id             - Rename / update a bucket
 * - DELETE /api/planner/buckets/:id             - Soft-delete a bucket (409 if has tasks, ?moveTo reassigns)
 * - PUT    /api/planner/buckets/reorder         - Reorder buckets via [{id, position}] array (transaction)
 * - PATCH  /api/planner/buckets/:id/collapse    - Toggle collapsed boolean
 */

import express from 'express';
import { query, transaction } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '../../middleware/errorHandler.js';
import { validateBucketName } from '../../utils/plannerValidation.js';
import { checkPlanAccess } from '../../services/plannerService.js';
import { calculateBucketProgress } from '../../utils/progressCalculator.js';

const router = express.Router();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Helper: assert that the current user can access the given plan.
 * Throws ForbiddenError when access is denied, NotFoundError when the plan
 * does not exist or has been soft-deleted.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function assertPlanAccess(planId, userId, userRole) {
  // Verify the plan exists first so we can return 404 vs 403 correctly.
  const plans = await query(
    'SELECT id FROM plans WHERE id = ? AND is_deleted = 0',
    [planId]
  );
  if (plans.length === 0) {
    throw new NotFoundError('Plan not found');
  }

  const hasAccess = await checkPlanAccess(planId, userId, userRole);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this plan');
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Helper: assert that the current user can access the plan that owns a bucket.
 * Returns the bucket row so callers can reuse it.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function assertBucketAccess(bucketId, userId, userRole) {
  const buckets = await query(
    'SELECT id, plan_id, name, collapsed FROM buckets WHERE id = ? AND is_deleted = 0',
    [bucketId]
  );
  if (buckets.length === 0) {
    throw new NotFoundError('Bucket not found');
  }

  const bucket = buckets[0];
  const hasAccess = await checkPlanAccess(bucket.plan_id, userId, userRole);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this bucket');
  }

  return bucket;
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/plans/:planId/buckets
 *
 * Returns all non-deleted buckets for a plan, ordered by position.
 * Each bucket includes:
 *   - task_count   : number of non-deleted tasks
 *   - completed    : number of completed tasks
 *   - progress_pct : Math.floor(completed / task_count * 100), or 0 when empty
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/plans/:planId/buckets',
  authenticate,
  asyncHandler(async (req, res) => {
    const planId = parseInt(req.params.planId, 10);
    if (isNaN(planId)) throw new ValidationError('Invalid plan ID');

    await assertPlanAccess(planId, req.user.id, req.user.role);

    // Fetch buckets with aggregated task counts in one query to avoid N+1.
    const buckets = await query(
      `SELECT
         b.id, b.name, b.description, b.colour, b.icon,
         b.position, b.collapsed,
         b.created_at, b.updated_at, b.created_by, b.updated_by,
         COUNT(t.id)                                                   AS task_count,
         SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)      AS completed_count
       FROM buckets b
       LEFT JOIN planner_tasks t
         ON t.bucket_id = b.id AND t.is_deleted = 0
       WHERE b.plan_id = ? AND b.is_deleted = 0
       GROUP BY b.id
       ORDER BY b.position ASC`,
      [planId]
    );

    // Attach progress percentage using the shared utility.
    const enriched = buckets.map((bucket) => {
      const taskCount = Number(bucket.task_count);
      const completedCount = Number(bucket.completed_count);

      // Build a minimal tasks array that calculateBucketProgress expects.
      const taskStatuses = [
        ...Array(completedCount).fill({ status: 'completed' }),
        ...Array(taskCount - completedCount).fill({ status: 'pending' }),
      ];

      return {
        ...bucket,
        task_count: taskCount,
        completed_count: completedCount,
        progress_pct: calculateBucketProgress(taskStatuses),
      };
    });

    res.json({ success: true, data: { buckets: enriched } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/plans/:planId/buckets
 *
 * Create a new bucket in a plan.
 *
 * Body:
 *   - name        (required) : 1â€“100 characters
 *   - description (optional)
 *   - colour      (optional) : hex colour (default: #6B7280)
 *   - icon        (optional)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/plans/:planId/buckets',
  authenticate,
  asyncHandler(async (req, res) => {
    const planId = parseInt(req.params.planId, 10);
    if (isNaN(planId)) throw new ValidationError('Invalid plan ID');

    await assertPlanAccess(planId, req.user.id, req.user.role);

    const { name, description, colour, icon } = req.body;

    if (!validateBucketName(name)) {
      throw new ValidationError('Bucket name must be between 1 and 100 characters');
    }

    // Determine the next position so the new bucket appears last.
    const posRows = await query(
      'SELECT COALESCE(MAX(position), -1) AS max_pos FROM buckets WHERE plan_id = ? AND is_deleted = 0',
      [planId]
    );
    const nextPosition = Number(posRows[0].max_pos) + 1;

    const result = await query(
      `INSERT INTO buckets
         (plan_id, name, description, colour, icon, position, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        name.trim(),
        description || null,
        colour || '#6B7280',
        icon || null,
        nextPosition,
        req.user.id,
        req.user.id,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Bucket created successfully',
      data: { bucketId: result.insertId },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/buckets/reorder
 *
 * NOTE: This route MUST be registered before PUT /api/planner/buckets/:id so
 * that "reorder" is not misinterpreted as a numeric :id.
 *
 * Body: Array of { id: number, position: number }
 * Updates all positions in a single database transaction.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/buckets/reorder',
  authenticate,
  asyncHandler(async (req, res) => {
    const { body } = req;

    if (!Array.isArray(body) || body.length === 0) {
      throw new ValidationError('Request body must be a non-empty array of { id, position }');
    }

    // Validate each entry.
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
          'Each reorder entry must have a positive integer id and a non-negative integer position'
        );
      }
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify the user has access to every bucket's plan.
    // Fetch plan_ids for all supplied bucket IDs.
    const ids = body.map((e) => e.id);
    const placeholders = ids.map(() => '?').join(', ');
    const buckets = await query(
      `SELECT id, plan_id FROM buckets WHERE id IN (${placeholders}) AND is_deleted = 0`,
      ids
    );

    if (buckets.length !== ids.length) {
      throw new NotFoundError('One or more buckets not found');
    }

    // All buckets must belong to the same plan.
    const planIds = [...new Set(buckets.map((b) => b.plan_id))];
    if (planIds.length > 1) {
      throw new ValidationError('All buckets in a reorder request must belong to the same plan');
    }

    await assertPlanAccess(planIds[0], userId, userRole);

    // Apply all position updates inside a transaction.
    await transaction(async (conn) => {
      for (const { id, position } of body) {
        await conn.execute(
          'UPDATE buckets SET position = ?, updated_by = ?, updated_at = NOW() WHERE id = ? AND is_deleted = 0',
          [position, userId, id]
        );
      }
    });

    res.json({ success: true, message: 'Buckets reordered successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/buckets/:id
 *
 * Rename or update a bucket's metadata.
 *
 * Body (all optional, at least one required):
 *   - name        : 1â€“100 characters
 *   - description
 *   - colour
 *   - icon
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/buckets/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const bucketId = parseInt(req.params.id, 10);
    if (isNaN(bucketId)) throw new ValidationError('Invalid bucket ID');

    await assertBucketAccess(bucketId, req.user.id, req.user.role);

    const { name, description, colour, icon } = req.body;

    if (name !== undefined && !validateBucketName(name)) {
      throw new ValidationError('Bucket name must be between 1 and 100 characters');
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (colour !== undefined) {
      updates.push('colour = ?');
      params.push(colour);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(icon);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updates.push('updated_by = ?');
    params.push(req.user.id);
    params.push(bucketId);

    await query(
      `UPDATE buckets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Bucket updated successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * DELETE /api/planner/buckets/:id
 *
 * Soft-delete a bucket.
 *
 * Behaviour:
 *   - If the bucket has non-deleted tasks AND no ?moveTo param â†’ 409 Conflict
 *     (response includes task_count)
 *   - If ?moveTo=<bucketId> is provided â†’ reassign all non-deleted tasks to
 *     that bucket, then soft-delete this bucket
 *   - If the bucket is empty â†’ soft-delete immediately
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.delete(
  '/buckets/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const bucketId = parseInt(req.params.id, 10);
    if (isNaN(bucketId)) throw new ValidationError('Invalid bucket ID');

    const bucket = await assertBucketAccess(bucketId, req.user.id, req.user.role);

    // Count non-deleted tasks in this bucket.
    const taskRows = await query(
      'SELECT COUNT(*) AS cnt FROM planner_tasks WHERE bucket_id = ? AND is_deleted = 0',
      [bucketId]
    );
    const taskCount = Number(taskRows[0].cnt);

    if (taskCount > 0) {
      const moveToParam = req.query.moveTo;

      if (!moveToParam) {
        // Return 409 with task count so the UI can prompt the user.
        throw new ConflictError(
          `Bucket contains ${taskCount} task(s). Provide ?moveTo=<bucketId> to reassign them, or delete the tasks first.`
        );
      }

      const moveToId = parseInt(moveToParam, 10);
      if (isNaN(moveToId) || moveToId <= 0) {
        throw new ValidationError('moveTo must be a positive integer bucket ID');
      }

      if (moveToId === bucketId) {
        throw new ValidationError('moveTo cannot be the same as the bucket being deleted');
      }

      // Validate the destination bucket exists, belongs to the same plan, and is accessible.
      const destBuckets = await query(
        'SELECT id, plan_id FROM buckets WHERE id = ? AND is_deleted = 0',
        [moveToId]
      );
      if (destBuckets.length === 0) {
        throw new NotFoundError('Destination bucket not found');
      }
      if (destBuckets[0].plan_id !== bucket.plan_id) {
        throw new ValidationError('Destination bucket must belong to the same plan');
      }

      // Reassign tasks.
      await query(
        'UPDATE planner_tasks SET bucket_id = ?, updated_by = ?, updated_at = NOW() WHERE bucket_id = ? AND is_deleted = 0',
        [moveToId, req.user.id, bucketId]
      );
    }

    // Soft-delete the bucket.
    await query(
      'UPDATE buckets SET is_deleted = 1, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [req.user.id, bucketId]
    );

    res.json({ success: true, message: 'Bucket deleted successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PATCH /api/planner/buckets/:id/collapse
 *
 * Toggle the collapsed boolean for a bucket.
 * Returns the new collapsed state.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.patch(
  '/buckets/:id/collapse',
  authenticate,
  asyncHandler(async (req, res) => {
    const bucketId = parseInt(req.params.id, 10);
    if (isNaN(bucketId)) throw new ValidationError('Invalid bucket ID');

    const bucket = await assertBucketAccess(bucketId, req.user.id, req.user.role);

    const newCollapsed = bucket.collapsed ? 0 : 1;

    await query(
      'UPDATE buckets SET collapsed = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [newCollapsed, req.user.id, bucketId]
    );

    res.json({
      success: true,
      message: `Bucket ${newCollapsed ? 'collapsed' : 'expanded'} successfully`,
      data: { collapsed: Boolean(newCollapsed) },
    });
  })
);

export default router;

