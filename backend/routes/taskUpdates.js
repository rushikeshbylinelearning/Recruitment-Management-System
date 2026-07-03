/**
 * Task Updates (EOD / Daily Work Update) Routes
 * POST   /api/task-updates          — submit a work update
 * GET    /api/task-updates          — list updates (Admin: all; others: own)
 * GET    /api/task-updates/:id      — single update with ownership check
 * GET    /api/task-updates/task/:taskId  — all updates for a task
 * GET    /api/task-updates/user/:userId  — all updates submitted by a user
 */
import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { createNotification } from '../services/inAppNotifications.js';
import { sendPushToUser, sendPushToAdmins } from '../services/pushNotificationService.js';
import { body, param, query as qv, validationResult } from 'express-validator';

const router = express.Router();

// ─── Ensure table exists on startup ─────────────────────────────────────────

const ENSURE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS task_updates (
  id                INT           NOT NULL AUTO_INCREMENT,
  task_id           INT           NULL,
  submitted_by      INT           NOT NULL,
  submitted_by_role VARCHAR(50)   NOT NULL,
  assigned_to       INT           NULL,
  task_title        VARCHAR(200)  NULL,
  work_summary      TEXT          NOT NULL,
  today_progress    TEXT          NULL,
  blockers          TEXT          NULL,
  next_plan         TEXT          NULL,
  attachments       JSON          NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_task_id        (task_id),
  INDEX idx_submitted_by   (submitted_by),
  INDEX idx_assigned_to    (assigned_to),
  INDEX idx_created_at     (created_at),
  INDEX idx_task_submitted (task_id, submitted_by, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(ENSURE_TABLE_SQL);
  tableReady = true;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// ─── Shared SQL for full update row ──────────────────────────────────────────

const SELECT_UPDATE_SQL = `
  SELECT
    tu.id,
    tu.task_id,
    tu.submitted_by,
    tu.submitted_by_role,
    tu.assigned_to,
    tu.task_title,
    tu.work_summary,
    tu.today_progress,
    tu.blockers,
    tu.next_plan,
    tu.attachments,
    tu.created_at,
    tu.updated_at,
    submitter.name  AS submitted_by_name,
    submitter.email AS submitted_by_email,
    assignee.name   AS assigned_to_name,
    t.status        AS task_status,
    t.priority      AS task_priority,
    t.due_date      AS task_due_date,
    t.category      AS task_category
  FROM task_updates tu
  LEFT JOIN users submitter ON submitter.id = tu.submitted_by
  LEFT JOIN users assignee  ON assignee.id  = tu.assigned_to
  LEFT JOIN tasks t          ON t.id         = tu.task_id
`;

function mapRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    taskStatus: row.task_status || null,
    taskPriority: row.task_priority || null,
    taskDueDate: row.task_due_date || null,
    taskCategory: row.task_category || null,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_name || 'Unknown',
    submittedByEmail: row.submitted_by_email || null,
    submittedByRole: row.submitted_by_role,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name || null,
    workSummary: row.work_summary,
    todayProgress: row.today_progress || null,
    blockers: row.blockers || null,
    nextPlan: row.next_plan || null,
    attachments: (() => {
      try {
        if (!row.attachments) return [];
        return typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments;
      } catch { return []; }
    })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── POST /api/task-updates ───────────────────────────────────────────────────
// Submit a work update. Recruiter and HR Intern only (not Admin unless owns task).

router.post('/',
  authenticateToken,
  [
    body('taskId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Task ID must be a valid integer'),
    body('workSummary').trim().isLength({ min: 10 }).withMessage('Work summary must be at least 10 characters'),
    body('todayProgress').optional().trim(),
    body('blockers').optional().trim(),
    body('nextPlan').optional().trim(),
  ],
  handleValidation,
  asyncHandler(async (req, res) => {
    await ensureTable();

    const { taskId, workSummary, todayProgress, blockers, nextPlan, attachments } = req.body;
    const submitterId = Number(req.user.id);
    const submitterRole = req.user.role;

    // Resolve task info only when a taskId is provided
    let task = null;
    if (taskId) {
      // Admin cannot submit unless they are also the assignee
      if (submitterRole === 'Admin') {
        const ownedTasks = await query(
          'SELECT id, assigned_to FROM tasks WHERE id = ? AND (assigned_to = ? OR created_by = ?)',
          [taskId, submitterId, submitterId]
        );
        if (ownedTasks.length === 0) {
          throw new ValidationError('Admins can only submit updates for tasks they own or created.');
        }
      }

      // Verify task exists
      const tasks = await query(
        `SELECT t.id, t.title, t.assigned_to, t.created_by,
                assignee.name AS assignee_name
         FROM tasks t
         LEFT JOIN users assignee ON assignee.id = t.assigned_to
         WHERE t.id = ?`,
        [taskId]
      );

      if (tasks.length === 0) throw new NotFoundError('Task not found');
      task = tasks[0];

      // Non-admin: must be assigned to this task
      if (submitterRole !== 'Admin' && Number(task.assigned_to) !== submitterId) {
        throw new ValidationError('You can only submit updates for tasks assigned to you.');
      }
    }

    // Sanitize attachments
    let attachmentsJson = null;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      attachmentsJson = JSON.stringify(attachments);
    }

    // Insert update (never overwrites — always new record)
    const result = await query(
      `INSERT INTO task_updates
         (task_id, submitted_by, submitted_by_role, assigned_to, task_title,
          work_summary, today_progress, blockers, next_plan, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task ? task.id : null,
        submitterId,
        submitterRole,
        task ? task.assigned_to : null,
        task ? task.title : null,
        workSummary.trim(),
        todayProgress?.trim() || null,
        blockers?.trim() || null,
        nextPlan?.trim() || null,
        attachmentsJson,
      ]
    );

    const newUpdateId = result.insertId;

    // ── Notifications ──────────────────────────────────────────────────────────
    try {
      const submitterName = req.user.name || req.user.username || 'Someone';
      const link = '/tasks';
      const pushPayload = {
        type: 'task_update',
        url:  link,
        tag:  `task-update-${newUpdateId}`,
      };

      const taskLabel = task ? `"${task.title}"` : 'a general update';

      // Always notify Admin(s) — in-app + push
      const admins = await query(
        "SELECT id FROM users WHERE role = 'Admin' AND id != ?",
        [submitterId]
      );
      for (const admin of admins) {
        await createNotification(admin.id, {
          type: 'task_update',
          title: 'Work Update Submitted',
          message: `${submitterName} (${submitterRole}) submitted a work update for ${taskLabel}`,
          link,
        });
        await sendPushToUser(admin.id, {
          title: `📋 Work Update${task ? ` — ${task.title}` : ''}`,
          body:  `${submitterName} (${submitterRole}) just submitted their EOD update.`,
          ...pushPayload,
        });
      }

      // If an HR Intern submitted — also notify the recruiter who created the task
      if (task && submitterRole === 'HR Intern' && task.created_by && task.created_by !== submitterId) {
        const creators = await query(
          "SELECT id, role FROM users WHERE id = ? AND role = 'Recruiter' AND status = 'Active'",
          [task.created_by]
        );
        for (const creator of creators) {
          await createNotification(creator.id, {
            type: 'task_update',
            title: 'Intern Submitted Work Update',
            message: `${submitterName} submitted a work update for "${task.title}"`,
            link,
          });
          await sendPushToUser(creator.id, {
            title: `📋 Intern Update — ${task.title}`,
            body:  `${submitterName} submitted their EOD update for your task.`,
            ...pushPayload,
          });
        }
      }

      // Also notify recruiter who owns the task (assigned_to) if different from creator/submitter
      if (
        task &&
        submitterRole === 'HR Intern' &&
        task.assigned_to &&
        task.assigned_to !== submitterId &&
        task.assigned_to !== task.created_by
      ) {
        const assigneeRecruiter = await query(
          "SELECT id, role FROM users WHERE id = ? AND role = 'Recruiter' AND status = 'Active'",
          [task.assigned_to]
        );
        for (const r of assigneeRecruiter) {
          await createNotification(r.id, {
            type: 'task_update',
            title: 'Intern Work Update',
            message: `${submitterName} submitted a work update for "${task.title}"`,
            link,
          });
          await sendPushToUser(r.id, {
            title: `📋 Intern Update — ${task.title}`,
            body:  `${submitterName} submitted their EOD update for your task.`,
            ...pushPayload,
          });
        }
      }
    } catch (notifErr) {
      console.error('[taskUpdates] Notification error (non-fatal):', notifErr.message, notifErr.stack || '');
    }

    // ── Activity log ───────────────────────────────────────────────────────────
    try {
      await query(
        `INSERT INTO activity_logs (entity_type, entity_id, action_type, description, metadata, created_by)
         VALUES ('task_update', ?, 'work_update_submitted', ?, ?, ?)`,
        [
          String(newUpdateId),
          `${req.user.name || req.user.username} submitted work update${task ? ` for task "${task.title}"` : ''}`,
          JSON.stringify({ taskId: task ? task.id : null, updateId: newUpdateId, role: submitterRole }),
          submitterId,
        ]
      );
    } catch (logErr) {
      console.error('[taskUpdates] Activity log error (non-fatal):', logErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Work update submitted successfully',
      data: { updateId: newUpdateId },
    });
  })
);

// ─── GET /api/task-updates ────────────────────────────────────────────────────
// List updates. Admin sees all; others see only their own.
// Query params: page, limit, taskId, userId, date (YYYY-MM-DD), search

router.get('/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    await ensureTable();

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { taskId, userId, date, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    // Non-admin: only own submissions
    if (req.user.role !== 'Admin') {
      where += ' AND tu.submitted_by = ?';
      params.push(req.user.id);
    }

    if (taskId) { where += ' AND tu.task_id = ?';       params.push(parseInt(taskId)); }
    if (userId) { where += ' AND tu.submitted_by = ?';  params.push(parseInt(userId)); }
    if (date)   { where += ' AND DATE(tu.created_at) = ?'; params.push(date); }
    if (search) {
      where += ' AND (tu.task_title LIKE ? OR tu.work_summary LIKE ? OR submitter.name LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM task_updates tu
      LEFT JOIN users submitter ON submitter.id = tu.submitted_by
      ${where}
    `;
    const countResult = await query(countSql, params);
    const total = countResult[0].total;

    const rowsSql = `
      ${SELECT_UPDATE_SQL}
      ${where}
      ORDER BY tu.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await query(rowsSql, params);

    res.json({
      success: true,
      data: {
        updates: rows.map(mapRow),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  })
);

// ─── GET /api/task-updates/task/:taskId ──────────────────────────────────────
// All updates for a specific task. Recruiter sees updates on their own tasks + intern submissions.

router.get('/task/:taskId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    await ensureTable();

    const taskId = parseInt(req.params.taskId);
    if (!taskId || isNaN(taskId)) throw new ValidationError('Invalid task ID');

    // Verify task exists
    const tasks = await query('SELECT id, assigned_to, created_by FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) throw new NotFoundError('Task not found');
    const task = tasks[0];

    // Non-admin: must be the assignee or creator
    if (req.user.role !== 'Admin') {
      if (task.assigned_to !== req.user.id && task.created_by !== req.user.id) {
        throw new ValidationError('You do not have access to updates for this task.');
      }
    }

    const rows = await query(
      `${SELECT_UPDATE_SQL} WHERE tu.task_id = ? ORDER BY tu.created_at DESC`,
      [taskId]
    );

    res.json({
      success: true,
      data: { updates: rows.map(mapRow), total: rows.length },
    });
  })
);

// ─── GET /api/task-updates/user/:userId ──────────────────────────────────────
// All updates submitted by a specific user.

router.get('/user/:userId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    await ensureTable();

    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) throw new ValidationError('Invalid user ID');

    // Non-admin can only view own updates
    if (req.user.role !== 'Admin' && req.user.id !== userId) {
      throw new ValidationError('Access denied.');
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await query(
      'SELECT COUNT(*) AS total FROM task_updates WHERE submitted_by = ?',
      [userId]
    );
    const total = countResult[0].total;

    const rows = await query(
      `${SELECT_UPDATE_SQL} WHERE tu.submitted_by = ? ORDER BY tu.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        updates: rows.map(mapRow),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  })
);

// ─── GET /api/task-updates/:id ────────────────────────────────────────────────
// Single update — must come after named-param routes to avoid clash

router.get('/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    await ensureTable();

    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) throw new ValidationError('Invalid update ID');

    const rows = await query(`${SELECT_UPDATE_SQL} WHERE tu.id = ?`, [id]);
    if (rows.length === 0) throw new NotFoundError('Update not found');

    const update = mapRow(rows[0]);

    // Ownership check: Admin, or submitter, or task assignee/creator
    if (req.user.role !== 'Admin') {
      if (
        update.submittedBy !== req.user.id &&
        update.assignedTo  !== req.user.id
      ) {
        // Also allow the task creator
        const taskRow = await query('SELECT created_by FROM tasks WHERE id = ?', [update.taskId]);
        const isCreator = taskRow.length > 0 && taskRow[0].created_by === req.user.id;
        if (!isCreator) {
          throw new ValidationError('Access denied.');
        }
      }
    }

    res.json({ success: true, data: { update } });
  })
);

// ─── GET /api/task-updates/admin/user-stats ───────────────────────────────────
// Admin-only: per-user task + update summary for the Recruiter Monitor cards

router.get('/admin/user-stats',
  authenticateToken,
  asyncHandler(async (req, res) => {
    await ensureTable();

    if (req.user.role !== 'Admin') {
      throw new ValidationError('Admin access required');
    }

    const today = new Date().toISOString().slice(0, 10);

    const rows = await query(
      `SELECT
         u.id,
         u.name,
         u.role,
         u.email,
         COALESCE(SUM(CASE WHEN t.status = 'Pending'     THEN 1 ELSE 0 END), 0) AS pending_tasks,
         COALESCE(SUM(CASE WHEN t.status = 'Completed'   THEN 1 ELSE 0 END), 0) AS completed_tasks,
         COALESCE(SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END), 0) AS inprogress_tasks,
         COALESCE(COUNT(DISTINCT t.id), 0) AS total_tasks,
         COALESCE(
           (SELECT COUNT(*) FROM task_updates tu2
            WHERE tu2.submitted_by = u.id AND DATE(tu2.created_at) = ?), 0
         ) AS today_updates,
         (SELECT MAX(tu3.created_at) FROM task_updates tu3 WHERE tu3.submitted_by = u.id) AS last_submission
       FROM users u
       LEFT JOIN tasks t ON t.assigned_to = u.id
       WHERE u.status = 'Active' AND u.role IN ('Recruiter', 'HR Intern')
       GROUP BY u.id, u.name, u.role, u.email
       ORDER BY u.name ASC`,
      [today]
    );

    res.json({ success: true, data: { users: rows } });
  })
);

export default router;
