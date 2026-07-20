/**
 * Tasks API Routes
 *
 * Endpoints for managing tasks within HR Planner Workspace buckets.
 * Implements Requirement R3: Dynamic Task Creation and Management
 *
 * Routes:
 * - GET    /api/planner/buckets/:bucketId/tasks  - Card data for board view
 * - PUT    /api/planner/tasks/reorder            - Reorder tasks (must be before /:id)
 * - POST   /api/planner/tasks                   - Create a new task
 * - GET    /api/planner/tasks/:id               - Full task detail for drawer
 * - PUT    /api/planner/tasks/:id               - Update task fields
 * - DELETE /api/planner/tasks/:id               - Soft-delete a task
 * - POST   /api/planner/tasks/:id/move          - Move task to another bucket
 */

import express from 'express';
import { query, transaction } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../middleware/errorHandler.js';
import {
  validateTaskTitle,
  validateRecurrenceType,
  validateDueTime,
} from '../../utils/plannerValidation.js';
import { calculateChecklistProgress } from '../../utils/progressCalculator.js';
import {
  checkAssignmentPermission,
  checkCrossPlanMove,
  logActivity,
  checkTaskOwnership,
  resetStaleDailyTasks,
  getTimerState,
} from '../../services/plannerService.js';
import { sendTaskAssignmentNotification } from '../../services/notificationService.js';

/** Normalize TIME for MySQL (HH:mm → HH:mm:00) or null to clear. */
function normalizeDueTime(value) {
  if (value === null || value === '') return null;
  const trimmed = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
}

const router = express.Router();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Helper: assert that a task exists and the user has access to it.
 * Returns the task row so callers can reuse it.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function assertTaskAccess(taskId, userId, userRole) {
  const tasks = await query(
    'SELECT id, bucket_id, title, assigned_to, created_by FROM planner_tasks WHERE id = ? AND is_deleted = 0',
    [taskId]
  );

  if (tasks.length === 0) {
    throw new NotFoundError('Task not found');
  }

  const hasAccess = await checkTaskOwnership(taskId, userId, userRole);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this task');
  }

  return tasks[0];
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/buckets/:bucketId/tasks
 *
 * Returns card-level data for all non-deleted tasks in a bucket, ordered by
 * position. Used to populate the board view.
 *
 * Each task includes:
 *   - Core fields: id, title, priority, status, assigned_to, due_date,
 *     completion_percentage, position, created_by, is_deleted
 *   - assignee_name, assignee_avatar (initials derived from name)
 *   - labels: JSON array of { id, name, colour }
 *   - checklist_total, checklist_checked: counts from task_checklists
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/buckets/:bucketId/tasks',
  authenticate,
  asyncHandler(async (req, res) => {
    const bucketId = parseInt(req.params.bucketId, 10);
    if (isNaN(bucketId)) throw new ValidationError('Invalid bucket ID');

    // Verify bucket exists
    const buckets = await query(
      'SELECT id FROM buckets WHERE id = ? AND is_deleted = 0',
      [bucketId]
    );
    if (buckets.length === 0) {
      throw new NotFoundError('Bucket not found');
    }

    // Lazy-reset stale daily tasks in this bucket before listing
    const staleIds = await query(
      `SELECT id FROM planner_tasks
        WHERE bucket_id = ? AND is_deleted = 0
          AND recurrence_type = 'daily' AND status = 'completed'
          AND (last_completed_at IS NULL OR DATE(last_completed_at) < CURDATE())`,
      [bucketId]
    );
    if (staleIds.length > 0) {
      await resetStaleDailyTasks(staleIds.map((r) => r.id));
    }

    const tasks = await query(
      `SELECT
         t.id,
         t.title,
         t.priority,
         t.status,
         t.assigned_to,
         t.due_date,
         t.due_time,
         t.recurrence_type,
         t.last_completed_at,
         t.timer_elapsed_seconds,
         t.timer_started_at,
         t.completion_percentage,
         t.position,
         t.created_by,
         t.is_deleted,
         u.name                                             AS assignee_name,
         uc.name                                            AS created_by_name,
         (SELECT GROUP_CONCAT(
            JSON_OBJECT('id', l.id, 'name', l.name, 'colour', l.colour)
          )
          FROM task_labels tl
          JOIN labels l ON tl.label_id = l.id
          WHERE tl.task_id = t.id
         )                                                  AS labels_json,
         (SELECT COUNT(*)
          FROM task_checklists ci
          WHERE ci.task_id = t.id
         )                                                  AS checklist_total,
         (SELECT COUNT(*)
          FROM task_checklists ci
          WHERE ci.task_id = t.id AND ci.is_checked = 1
         )                                                  AS checklist_checked
       FROM planner_tasks t
       LEFT JOIN users u  ON t.assigned_to = u.id
       LEFT JOIN users uc ON t.created_by  = uc.id
       WHERE t.bucket_id = ? AND t.is_deleted = 0
       ORDER BY t.position ASC`,
      [bucketId]
    );

    // Parse labels JSON and derive avatar initials
    const enriched = tasks.map((task) => {
      let labels = [];
      if (task.labels_json) {
        try {
          // GROUP_CONCAT produces comma-separated JSON objects — wrap in array
          labels = JSON.parse(`[${task.labels_json}]`);
        } catch {
          labels = [];
        }
      }

      const assigneeAvatar = task.assignee_name
        ? task.assignee_name
            .split(' ')
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
        : null;

      const timer = getTimerState(task);

      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        assigned_to: task.assigned_to,
        due_date: task.due_date,
        due_time: task.due_time,
        recurrence_type: task.recurrence_type || 'none',
        last_completed_at: task.last_completed_at,
        timer_elapsed_seconds: timer.timer_elapsed_seconds,
        timer_started_at: timer.timer_started_at,
        completion_percentage: task.completion_percentage,
        position: task.position,
        created_by: task.created_by,
        is_deleted: task.is_deleted,
        assignee_name: task.assignee_name,
        assignee_avatar: assigneeAvatar,
        labels,
        checklist_total: Number(task.checklist_total),
        checklist_checked: Number(task.checklist_checked),
        created_by_name: task.created_by_name || null,
      };
    });

    res.json({ success: true, data: { tasks: enriched } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/tasks/reorder
 *
 * NOTE: Registered BEFORE /:id so "reorder" is not treated as a numeric ID.
 *
 * Body: Array of { id: number, position: number, bucket_id: number }
 * Updates position and bucket_id for each task in a single transaction.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/tasks/reorder',
  authenticate,
  asyncHandler(async (req, res) => {
    const { body } = req;

    if (!Array.isArray(body) || body.length === 0) {
      throw new ValidationError(
        'Request body must be a non-empty array of { id, position, bucket_id }'
      );
    }

    for (const entry of body) {
      if (
        !entry ||
        typeof entry.id !== 'number' ||
        typeof entry.position !== 'number' ||
        typeof entry.bucket_id !== 'number' ||
        !Number.isInteger(entry.id) ||
        !Number.isInteger(entry.position) ||
        !Number.isInteger(entry.bucket_id) ||
        entry.id <= 0 ||
        entry.position < 0 ||
        entry.bucket_id <= 0
      ) {
        throw new ValidationError(
          'Each reorder entry must have positive integer id, bucket_id, and non-negative integer position'
        );
      }
    }

    const userId = req.user.id;

    await transaction(async (conn) => {
      for (const { id, position, bucket_id } of body) {
        await conn.execute(
          `UPDATE planner_tasks
             SET position = ?, bucket_id = ?, updated_by = ?, updated_at = NOW()
           WHERE id = ? AND is_deleted = 0`,
          [position, bucket_id, userId, id]
        );
      }
    });

    res.json({ success: true, message: 'Tasks reordered successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/tasks
 *
 * Create a new task inside a bucket.
 *
 * Body:
 *   Required: bucket_id, title
 *   Optional: description, priority, assigned_to, due_date, reminder_date,
 *             status, estimated_time, completion_percentage, job_id, candidate_id
 *
 * Side effects:
 *   - If assigned_to is provided: checkAssignmentPermission + sendTaskAssignmentNotification
 *   - logActivity: 'task_created'
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/tasks',
  authenticate,
  asyncHandler(async (req, res) => {
    const {
      bucket_id,
      title,
      description,
      priority,
      assigned_to,
      due_date,
      reminder_date,
      status,
      estimated_time,
      completion_percentage,
      job_id,
      candidate_id,
      recurrence_type,
      due_time,
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!bucket_id || isNaN(parseInt(bucket_id, 10))) {
      throw new ValidationError('bucket_id is required and must be a valid integer');
    }
    if (!validateTaskTitle(title)) {
      throw new ValidationError('Task title must be between 1 and 255 characters');
    }
    if (recurrence_type !== undefined && !validateRecurrenceType(recurrence_type)) {
      throw new ValidationError("recurrence_type must be 'none' or 'daily'");
    }
    if (due_time !== undefined && !validateDueTime(due_time)) {
      throw new ValidationError('due_time must be HH:mm or HH:mm:ss');
    }

    const bucketId = parseInt(bucket_id, 10);

    // Verify bucket exists and user has access to its plan
    const buckets = await query(
      `SELECT b.id, b.plan_id
         FROM buckets b
         JOIN plans p ON b.plan_id = p.id
        WHERE b.id = ? AND b.is_deleted = 0 AND p.is_deleted = 0`,
      [bucketId]
    );
    if (buckets.length === 0) {
      throw new NotFoundError('Bucket not found');
    }

    // Check assignment permission if assigned_to is provided
    if (assigned_to != null) {
      const permCheck = await checkAssignmentPermission(req.user, assigned_to, null);
      if (!permCheck.allowed) {
        throw new ForbiddenError(permCheck.reason || 'Assignment not permitted');
      }
    }

    // Determine position (append to end of bucket)
    const posRows = await query(
      'SELECT COALESCE(MAX(position), -1) AS max_pos FROM planner_tasks WHERE bucket_id = ? AND is_deleted = 0',
      [bucketId]
    );
    const nextPosition = Number(posRows[0].max_pos) + 1;

    const taskStatus = status || 'pending';
    const taskPriority = priority || null;
    const taskCompletionPct = completion_percentage != null ? completion_percentage : 0;
    const taskRecurrence = recurrence_type || 'none';
    const taskDueTime = due_time !== undefined ? normalizeDueTime(due_time) : null;
    const lastCompletedAt = taskStatus === 'completed' ? new Date() : null;

    const result = await query(
      `INSERT INTO planner_tasks
         (bucket_id, title, description, priority, assigned_to, due_date, reminder_date,
          status, estimated_time, completion_percentage, job_id, candidate_id,
          recurrence_type, last_completed_at, due_time,
          position, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bucketId,
        title.trim(),
        description || null,
        taskPriority,
        assigned_to || null,
        due_date || null,
        reminder_date || null,
        taskStatus,
        estimated_time || null,
        taskCompletionPct,
        job_id || null,
        candidate_id || null,
        taskRecurrence,
        lastCompletedAt,
        taskDueTime,
        nextPosition,
        userId,
        userId,
      ]
    );

    const taskId = result.insertId;

    // Send assignment notification if task is assigned
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
          priority: taskPriority,
          status: taskStatus,
          due_date: due_date || null,
        };
        await sendTaskAssignmentNotification(taskRecord, assignees[0], req.user);
      }
    }

    // Log activity
    await logActivity(taskId, userId, 'task_created', {
      title: title.trim(),
      bucket_id: bucketId,
      assigned_to: assigned_to || null,
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: { taskId },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/tasks/:id
 *
 * Returns full task detail for the task drawer.
 *
 * Includes:
 *   - All task fields + assignee name + assigner (created_by user) name
 *   - labels: array of { id, name, colour }
 *   - checklist: array of { id, item_text, is_checked, position }
 *   - notes: array of { note_content }
 *   - attachment_count, comment_count
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/tasks/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    // Ownership / access check
    await assertTaskAccess(taskId, req.user.id, req.user.role);

    // Lazy-reset this task if it is a stale daily completion
    await resetStaleDailyTasks([taskId]);

    // Fetch full task row + assignee name + assigner name
    const tasks = await query(
      `SELECT
         t.*,
         u_assignee.name  AS assignee_name,
         u_creator.name   AS assigner_name
       FROM planner_tasks t
       LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
       LEFT JOIN users u_creator  ON t.created_by  = u_creator.id
       WHERE t.id = ? AND t.is_deleted = 0`,
      [taskId]
    );

    if (tasks.length === 0) {
      throw new NotFoundError('Task not found');
    }

    const task = tasks[0];
    Object.assign(task, getTimerState(task));

    // Fetch labels
    const labels = await query(
      `SELECT l.id, l.name, l.colour
         FROM task_labels tl
         JOIN labels l ON tl.label_id = l.id
        WHERE tl.task_id = ?`,
      [taskId]
    );

    // Fetch checklist items
    const checklist = await query(
      `SELECT id, item_text, is_checked, position
         FROM task_checklists
        WHERE task_id = ?
        ORDER BY position ASC`,
      [taskId]
    );

    // Fetch notes
    const notes = await query(
      `SELECT note_content
         FROM task_notes
        WHERE task_id = ?
        ORDER BY created_at ASC`,
      [taskId]
    );

    // Attachment count (no full list)
    const attachmentRows = await query(
      'SELECT COUNT(*) AS cnt FROM task_attachments WHERE task_id = ?',
      [taskId]
    );
    const attachmentCount = Number(attachmentRows[0].cnt);

    // Comment count
    const commentRows = await query(
      'SELECT COUNT(*) AS cnt FROM task_comments WHERE task_id = ?',
      [taskId]
    );
    const commentCount = Number(commentRows[0].cnt);

    res.json({
      success: true,
      data: {
        task: {
          ...task,
          labels,
          checklist,
          checklist_progress: calculateChecklistProgress(
            checklist.map((c) => ({ is_checked: Boolean(c.is_checked) }))
          ),
          notes,
          attachment_count: attachmentCount,
          comment_count: commentCount,
        },
      },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/tasks/:id
 *
 * Update task fields dynamically.
 *
 * Side effects:
 *   - If assigned_to is changing: checkAssignmentPermission
 *   - logActivity: 'task_edited' with changedFields
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put(
  '/tasks/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    const task = await assertTaskAccess(taskId, req.user.id, req.user.role);
    const userId = req.user.id;

    // Load current status / timer fields for completion side effects
    const currentRows = await query(
      `SELECT status, recurrence_type, timer_started_at, completion_percentage
         FROM planner_tasks WHERE id = ? AND is_deleted = 0`,
      [taskId]
    );
    const current = currentRows[0] || {};

    const {
      title,
      description,
      priority,
      assigned_to,
      due_date,
      reminder_date,
      status,
      estimated_time,
      completion_percentage,
      job_id,
      candidate_id,
      recurrence_type,
      due_time,
    } = req.body;

    // Validate title if provided
    if (title !== undefined && !validateTaskTitle(title)) {
      throw new ValidationError('Task title must be between 1 and 255 characters');
    }
    if (recurrence_type !== undefined && !validateRecurrenceType(recurrence_type)) {
      throw new ValidationError("recurrence_type must be 'none' or 'daily'");
    }
    if (due_time !== undefined && !validateDueTime(due_time)) {
      throw new ValidationError('due_time must be HH:mm or HH:mm:ss');
    }

    // Check assignment permission if assigned_to is changing
    if (assigned_to !== undefined && assigned_to !== task.assigned_to) {
      if (assigned_to != null) {
        const permCheck = await checkAssignmentPermission(req.user, assigned_to, null);
        if (!permCheck.allowed) {
          throw new ForbiddenError(permCheck.reason || 'Assignment not permitted');
        }
      }
    }

    // Build dynamic update
    const updates = [];
    const params = [];
    const changedFields = {};

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title.trim());
      changedFields.title = title.trim();
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
      changedFields.description = description;
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
      changedFields.priority = priority;
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
      changedFields.assigned_to = assigned_to;
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(due_date);
      changedFields.due_date = due_date;
    }
    if (reminder_date !== undefined) {
      updates.push('reminder_date = ?');
      params.push(reminder_date);
      changedFields.reminder_date = reminder_date;
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      changedFields.status = status;
    }
    if (estimated_time !== undefined) {
      updates.push('estimated_time = ?');
      params.push(estimated_time);
      changedFields.estimated_time = estimated_time;
    }
    if (completion_percentage !== undefined) {
      updates.push('completion_percentage = ?');
      params.push(completion_percentage);
      changedFields.completion_percentage = completion_percentage;
    }
    if (job_id !== undefined) {
      updates.push('job_id = ?');
      params.push(job_id);
      changedFields.job_id = job_id;
    }
    if (candidate_id !== undefined) {
      updates.push('candidate_id = ?');
      params.push(candidate_id);
      changedFields.candidate_id = candidate_id;
    }
    if (recurrence_type !== undefined) {
      updates.push('recurrence_type = ?');
      params.push(recurrence_type);
      changedFields.recurrence_type = recurrence_type;
    }
    if (due_time !== undefined) {
      const normalized = normalizeDueTime(due_time);
      updates.push('due_time = ?');
      params.push(normalized);
      changedFields.due_time = normalized;
    }

    // Completion side effects
    if (status !== undefined && status === 'completed' && current.status !== 'completed') {
      updates.push('last_completed_at = NOW()');
      changedFields.last_completed_at = 'NOW()';
      if (completion_percentage === undefined) {
        updates.push('completion_percentage = 100');
        changedFields.completion_percentage = 100;
      }
      // Pause running timer into elapsed
      if (current.timer_started_at) {
        updates.push(
          `timer_elapsed_seconds = timer_elapsed_seconds + GREATEST(0, TIMESTAMPDIFF(SECOND, timer_started_at, NOW()))`
        );
        updates.push('timer_started_at = NULL');
        changedFields.timer_paused_on_complete = true;
      }
    } else if (status !== undefined && status !== 'completed' && current.status === 'completed') {
      updates.push('last_completed_at = NULL');
      changedFields.last_completed_at = null;
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updates.push('updated_by = ?');
    params.push(userId);
    params.push(taskId);

    await query(
      `UPDATE planner_tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    const activityType =
      status === 'completed' && current.status !== 'completed'
        ? 'task_completed'
        : 'task_edited';
    await logActivity(taskId, userId, activityType, { changed_fields: changedFields });

    res.json({ success: true, message: 'Task updated successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * DELETE /api/planner/tasks/:id
 *
 * Soft-delete a task (set is_deleted = 1).
 * Logs activity: 'task_deleted'
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.delete(
  '/tasks/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    const task = await assertTaskAccess(taskId, req.user.id, req.user.role);
    const userId = req.user.id;

    await query(
      'UPDATE planner_tasks SET is_deleted = 1, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [userId, taskId]
    );

    await logActivity(taskId, userId, 'task_deleted', { title: task.title });

    res.json({ success: true, message: 'Task deleted successfully' });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/tasks/:id/move
 *
 * Move a task to another bucket within the same plan.
 *
 * Body: { targetBucketId: number }
 *
 * Rejects cross-plan moves via checkCrossPlanMove().
 * Logs activity: 'task_moved'
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/tasks/:id/move',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    await assertTaskAccess(taskId, req.user.id, req.user.role);

    const { targetBucketId } = req.body;

    if (!targetBucketId || isNaN(parseInt(targetBucketId, 10))) {
      throw new ValidationError('targetBucketId is required and must be a valid integer');
    }

    const targetId = parseInt(targetBucketId, 10);

    // Reject cross-plan moves
    const moveCheck = await checkCrossPlanMove(taskId, targetId);
    if (!moveCheck.allowed) {
      throw new ValidationError(moveCheck.reason || 'Cross-plan move not allowed');
    }

    const userId = req.user.id;

    await query(
      'UPDATE planner_tasks SET bucket_id = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [targetId, userId, taskId]
    );

    await logActivity(taskId, userId, 'task_moved', { target_bucket_id: targetId });

    res.json({ success: true, message: 'Task moved successfully' });
  })
);

/* ────────────────────────────────────────────────────────────────────────────
 * Timer endpoints — stopwatch start / pause / reset
 * ──────────────────────────────────────────────────────────────────────────── */

async function fetchTimerRow(taskId) {
  const rows = await query(
    `SELECT timer_elapsed_seconds, timer_started_at
       FROM planner_tasks WHERE id = ? AND is_deleted = 0`,
    [taskId]
  );
  if (!rows.length) throw new NotFoundError('Task not found');
  return rows[0];
}

router.post(
  '/tasks/:id/timer/start',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');
    await assertTaskAccess(taskId, req.user.id, req.user.role);

    const row = await fetchTimerRow(taskId);
    if (!row.timer_started_at) {
      await query(
        `UPDATE planner_tasks
            SET timer_started_at = NOW(), updated_by = ?, updated_at = NOW()
          WHERE id = ? AND is_deleted = 0`,
        [req.user.id, taskId]
      );
    }

    const updated = await fetchTimerRow(taskId);
    res.json({ success: true, data: getTimerState(updated) });
  })
);

router.post(
  '/tasks/:id/timer/pause',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');
    await assertTaskAccess(taskId, req.user.id, req.user.role);

    await query(
      `UPDATE planner_tasks
          SET timer_elapsed_seconds = timer_elapsed_seconds
              + GREATEST(0, TIMESTAMPDIFF(SECOND, timer_started_at, NOW())),
              timer_started_at = NULL,
              updated_by = ?,
              updated_at = NOW()
        WHERE id = ? AND timer_started_at IS NOT NULL AND is_deleted = 0`,
      [req.user.id, taskId]
    );

    const updated = await fetchTimerRow(taskId);
    res.json({ success: true, data: getTimerState(updated) });
  })
);

router.post(
  '/tasks/:id/timer/reset',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');
    await assertTaskAccess(taskId, req.user.id, req.user.role);

    await query(
      `UPDATE planner_tasks
          SET timer_elapsed_seconds = 0,
              timer_started_at = NULL,
              updated_by = ?,
              updated_at = NOW()
        WHERE id = ? AND is_deleted = 0`,
      [req.user.id, taskId]
    );

    const updated = await fetchTimerRow(taskId);
    res.json({ success: true, data: getTimerState(updated) });
  })
);

export default router;


