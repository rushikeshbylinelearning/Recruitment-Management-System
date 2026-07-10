/**
 * Admin Monitor Mode API Routes
 *
 * Endpoints for admin users to monitor and manage recruiter/intern workspaces.
 * Implements Requirement R14 (Admin Workspace Monitor Mode).
 *
 * All routes require role === 'Admin' â€” enforced by the requireAdmin middleware.
 *
 * Routes:
 * - GET  /api/planner/admin/users                          - List active Recruiters & HR Interns
 * - GET  /api/planner/admin/workspace/:userId              - Get full workspace for a user
 * - POST /api/planner/admin/workspace/:userId/tasks        - Create a task in a user's workspace
 * - GET  /api/planner/admin/workspace/:userId/stats        - Get task stats for a user
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
import { validateTaskTitle } from '../../utils/plannerValidation.js';
import {
  checkAssignmentPermission,
  logActivity,
} from '../../services/plannerService.js';
import { sendTaskAssignmentNotification } from '../../services/notificationService.js';

const router = express.Router();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Middleware: requireAdmin
 *
 * Reusable guard that ensures the authenticated user has the 'Admin' role.
 * Must be used after `authenticate` so that req.user is populated.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    throw new ForbiddenError('Admin access required');
  }
  next();
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/admin/users
 *
 * Returns all active Recruiters and HR Interns, ordered by role then name.
 * Used by admin to pick a user to monitor.
 *
 * Response: { success: true, data: { users: [ { id, name, email, role } ] } }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/users',
  authenticate,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    const users = await query(
      `SELECT id, name, email, role
         FROM users
        WHERE role IN ('Recruiter', 'HR Intern')
          AND status = 'Active'
        ORDER BY role ASC, name ASC`
    );

    res.json({ success: true, data: { users } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/admin/workspace/:userId
 *
 * Returns the complete workspace for the specified user:
 *   plans (owned by userId, not deleted)
 *     â””â”€ buckets (for each plan, not deleted, ordered by position)
 *          â””â”€ tasks (for each bucket, not deleted, ordered by position, with assignee name)
 *
 * Response: { success: true, data: { plans: [ { ...plan, buckets: [ { ...bucket, tasks: [...] } ] } ] } }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/workspace/:userId',
  authenticate,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) throw new ValidationError('Invalid userId');

    // Verify target user exists
    const targetUsers = await query(
      'SELECT id, name, role FROM users WHERE id = ? AND status = ?',
      [targetUserId, 'Active']
    );
    if (targetUsers.length === 0) {
      throw new NotFoundError('User not found or not active');
    }

    // Fetch all plans owned by the target user
    const plans = await query(
      `SELECT id, name, description, owner_id, created_at, updated_at
         FROM plans
        WHERE owner_id = ? AND is_deleted = 0
        ORDER BY created_at ASC`,
      [targetUserId]
    );

    if (plans.length === 0) {
      return res.json({ success: true, data: { plans: [] } });
    }

    const planIds = plans.map((p) => p.id);

    // Fetch all buckets for these plans
    const buckets = await query(
      `SELECT id, plan_id, name, position, created_at, updated_at
         FROM buckets
        WHERE plan_id IN (${planIds.map(() => '?').join(', ')}) AND is_deleted = 0
        ORDER BY position ASC`,
      planIds
    );

    const bucketIds = buckets.map((b) => b.id);

    // Fetch all tasks for these buckets (with assignee name)
    let tasks = [];
    if (bucketIds.length > 0) {
      tasks = await query(
        `SELECT
           t.id,
           t.bucket_id,
           t.title,
           t.description,
           t.priority,
           t.status,
           t.assigned_to,
           t.due_date,
           t.position,
           t.created_by,
           t.estimated_time,
           t.completion_percentage,
           t.created_at,
           t.updated_at,
           u.name AS assignee_name
         FROM planner_tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.bucket_id IN (${bucketIds.map(() => '?').join(', ')}) AND t.is_deleted = 0
         ORDER BY t.position ASC`,
        bucketIds
      );
    }

    // Build nested structure: plan â†’ buckets â†’ tasks
    const tasksByBucket = tasks.reduce((acc, task) => {
      if (!acc[task.bucket_id]) acc[task.bucket_id] = [];
      acc[task.bucket_id].push(task);
      return acc;
    }, {});

    const bucketsByPlan = buckets.reduce((acc, bucket) => {
      if (!acc[bucket.plan_id]) acc[bucket.plan_id] = [];
      acc[bucket.plan_id].push({
        ...bucket,
        tasks: tasksByBucket[bucket.id] || [],
      });
      return acc;
    }, {});

    const enrichedPlans = plans.map((plan) => ({
      ...plan,
      buckets: bucketsByPlan[plan.id] || [],
    }));

    res.json({ success: true, data: { plans: enrichedPlans } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/admin/workspace/:userId/tasks
 *
 * Create a task inside a bucket belonging to the target user's workspace.
 *
 * Body:
 *   Required: bucket_id, title
 *   Optional: description, priority, assigned_to, due_date, status, estimated_time
 *
 * Validation:
 *   - bucket_id must belong to a plan owned by targetUserId
 *   - If assigned_to provided: checkAssignmentPermission(admin, assigned_to)
 *
 * Side effects:
 *   - created_by = req.user.id (admin)
 *   - If assigned_to: sendTaskAssignmentNotification
 *   - logActivity 'task_created' with admin_user_id in action_details
 *
 * Response: 201 { success: true, message, data: { taskId } }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/workspace/:userId/tasks',
  authenticate,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) throw new ValidationError('Invalid userId');

    const {
      bucket_id,
      title,
      description,
      priority,
      assigned_to,
      due_date,
      status,
      estimated_time,
    } = req.body;

    // Validate required fields
    if (!bucket_id || isNaN(parseInt(bucket_id, 10))) {
      throw new ValidationError('bucket_id is required and must be a valid integer');
    }
    if (!validateTaskTitle(title)) {
      throw new ValidationError('Task title must be between 1 and 255 characters');
    }

    const bucketId = parseInt(bucket_id, 10);

    // Verify the bucket belongs to a plan owned by the target user
    const buckets = await query(
      `SELECT b.id, b.plan_id, p.owner_id
         FROM buckets b
         JOIN plans p ON b.plan_id = p.id
        WHERE b.id = ? AND b.is_deleted = 0 AND p.is_deleted = 0 AND p.owner_id = ?`,
      [bucketId, targetUserId]
    );

    if (buckets.length === 0) {
      throw new NotFoundError('Bucket not found in this user\'s workspace');
    }

    // Check assignment permission if assigned_to is provided
    if (assigned_to != null) {
      const permCheck = await checkAssignmentPermission(req.user, assigned_to, null);
      if (!permCheck.allowed) {
        throw new ForbiddenError(permCheck.reason || 'Assignment not permitted');
      }
    }

    // Determine next position in the bucket
    const posRows = await query(
      'SELECT COALESCE(MAX(position), -1) AS max_pos FROM planner_tasks WHERE bucket_id = ? AND is_deleted = 0',
      [bucketId]
    );
    const nextPosition = Number(posRows[0].max_pos) + 1;

    const taskStatus = status || 'pending';
    const adminId = req.user.id;

    const result = await query(
      `INSERT INTO planner_tasks
         (bucket_id, title, description, priority, assigned_to, due_date,
          status, estimated_time, position, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bucketId,
        title.trim(),
        description || null,
        priority || null,
        assigned_to || null,
        due_date || null,
        taskStatus,
        estimated_time || null,
        nextPosition,
        adminId,
        adminId,
      ]
    );

    const taskId = result.insertId;

    // Send assignment notification if a user is assigned
    if (assigned_to != null) {
      const assignees = await query(
        'SELECT id, name, email FROM users WHERE id = ?',
        [assigned_to]
      );
      if (assignees.length > 0) {
        const taskRecord = {
          id: taskId,
          title: title.trim(),
          description: description || null,
          priority: priority || null,
          status: taskStatus,
          due_date: due_date || null,
        };
        await sendTaskAssignmentNotification(taskRecord, assignees[0], req.user);
      }
    }

    // Log activity â€” include admin_user_id so the audit trail shows this was an admin action
    await logActivity(taskId, adminId, 'task_created', {
      title: title.trim(),
      bucket_id: bucketId,
      assigned_to: assigned_to || null,
      admin_user_id: adminId,
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: { taskId },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/admin/workspace/:userId/stats
 *
 * Returns aggregated task statistics for the target user across all their plans:
 *   - total_tasks:           all non-deleted tasks in the user's buckets
 *   - completed_tasks:       tasks with status = 'completed'
 *   - overdue_tasks:         tasks where due_date < CURDATE() and status != 'completed'
 *   - completion_percentage: Math.floor(completed / total * 100) or 0
 *
 * Response: { success: true, data: { stats: { total_tasks, completed_tasks, overdue_tasks, completion_percentage } } }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/workspace/:userId/stats',
  authenticate,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) throw new ValidationError('Invalid userId');

    // Verify target user exists
    const targetUsers = await query(
      'SELECT id FROM users WHERE id = ? AND status = ?',
      [targetUserId, 'Active']
    );
    if (targetUsers.length === 0) {
      throw new NotFoundError('User not found or not active');
    }

    // Count total tasks, completed tasks, and overdue tasks in one query
    const statsRows = await query(
      `SELECT
         COUNT(*)                                                              AS total_tasks,
         SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)             AS completed_tasks,
         SUM(CASE WHEN t.due_date < CURDATE()
                   AND t.status != 'completed' THEN 1 ELSE 0 END)            AS overdue_tasks
       FROM planner_tasks t
       JOIN buckets b       ON t.bucket_id = b.id AND b.is_deleted = 0
       JOIN plans   p       ON b.plan_id   = p.id AND p.is_deleted = 0
       WHERE p.owner_id = ? AND t.is_deleted = 0`,
      [targetUserId]
    );

    const row = statsRows[0];
    const totalTasks = Number(row.total_tasks) || 0;
    const completedTasks = Number(row.completed_tasks) || 0;
    const overdueTasks = Number(row.overdue_tasks) || 0;
    const completionPercentage =
      totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        stats: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          overdue_tasks: overdueTasks,
          completion_percentage: completionPercentage,
        },
      },
    });
  })
);

export default router;

