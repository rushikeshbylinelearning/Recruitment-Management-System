/**
 * Planner Global Search API Route
 *
 * Implements Requirement R13: Advanced Filtering and Search
 *
 * Routes:
 * - GET /api/planner/search â€” Search across planner tasks with filters and pagination
 *
 * Query Parameters:
 *   q             â€” text search string (FULLTEXT + notes LIKE)
 *   assignedTo    â€” user ID
 *   assignedBy    â€” user ID (created_by alias)
 *   priority      â€” low | medium | high
 *   status        â€” pending | in_progress | completed
 *   labelId       â€” label ID
 *   planId        â€” plan ID
 *   bucketId      â€” bucket ID
 *   dueDateFrom   â€” date string (inclusive lower bound)
 *   dueDateTo     â€” date string (inclusive upper bound)
 *   datePreset    â€” today | tomorrow | thisWeek | thisMonth | overdue | upcoming
 *   completionMin â€” number 0â€“100 (minimum completion_percentage)
 *   hasAttachments â€” 'true' | 'false'
 *   createdBy     â€” user ID
 *   page          â€” page number (default 1)
 *   pageSize      â€” page size (default 20, max 100)
 */

import express from 'express';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import { asyncHandler, ValidationError } from '../../middleware/errorHandler.js';
import { query } from '../../config/database.js';

const router = express.Router();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /search
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/search',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'Admin';

    // â”€â”€ Parse & validate pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let page = parseInt(req.query.page, 10);
    let pageSize = parseInt(req.query.pageSize, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 20;
    if (pageSize > 100) pageSize = 100;

    const offset = (page - 1) * pageSize;

    // â”€â”€ Extract filter params â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const {
      q,
      assignedTo,
      assignedBy,
      priority,
      status,
      labelId,
      planId,
      bucketId,
      dueDateFrom,
      dueDateTo,
      datePreset,
      completionMin,
      hasAttachments,
      createdBy,
    } = req.query;

    // Validate priority
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      throw new ValidationError('priority must be one of: low, medium, high');
    }

    // Validate status
    if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
      throw new ValidationError('status must be one of: pending, in_progress, completed');
    }

    // Validate datePreset
    const validPresets = ['today', 'tomorrow', 'thisWeek', 'thisMonth', 'overdue', 'upcoming'];
    if (datePreset && !validPresets.includes(datePreset)) {
      throw new ValidationError(
        `datePreset must be one of: ${validPresets.join(', ')}`
      );
    }

    // Validate completionMin
    let completionMinVal = null;
    if (completionMin !== undefined && completionMin !== '') {
      completionMinVal = parseInt(completionMin, 10);
      if (isNaN(completionMinVal) || completionMinVal < 0 || completionMinVal > 100) {
        throw new ValidationError('completionMin must be a number between 0 and 100');
      }
    }

    // Validate hasAttachments
    if (hasAttachments !== undefined && !['true', 'false'].includes(hasAttachments)) {
      throw new ValidationError("hasAttachments must be 'true' or 'false'");
    }

    // â”€â”€ Build FROM / JOIN clause â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Base joins: tasks â†’ buckets â†’ plans â†’ assignee user â†’ creator user
    let fromClause = `
      FROM planner_tasks t
      JOIN buckets b  ON b.id  = t.bucket_id   AND b.is_deleted  = 0
      JOIN plans   p  ON p.id  = b.plan_id     AND p.is_deleted  = 0
      LEFT JOIN users ua ON ua.id = t.assigned_to
      LEFT JOIN users uc ON uc.id = t.created_by
    `;

    // Optional JOIN for label filter
    if (labelId) {
      const labelIdInt = parseInt(labelId, 10);
      if (isNaN(labelIdInt) || labelIdInt <= 0) {
        throw new ValidationError('labelId must be a positive integer');
      }
      fromClause += `
      INNER JOIN task_labels tl ON tl.task_id = t.id AND tl.label_id = ${labelIdInt}
      `;
    }

    // Optional JOIN for full-text search on notes
    let noteJoined = false;
    if (q && q.trim()) {
      fromClause += `
      LEFT JOIN task_notes tn ON tn.task_id = t.id
      `;
      noteJoined = true;
    }

    // â”€â”€ Build WHERE conditions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const conditions = [];
    const params = [];

    // Always: soft-delete filters (already in JOIN conditions for b and p)
    conditions.push('t.is_deleted = 0');

    // Access control: non-Admin can only see tasks in plans they own or are members of
    if (!isAdmin) {
      conditions.push(
        `(p.owner_id = ? OR EXISTS (
          SELECT 1 FROM plan_members pm
          WHERE pm.plan_id = p.id AND pm.user_id = ?
        ))`
      );
      params.push(userId, userId);
    }

    // Text search: FULLTEXT on title/description + notes LIKE
    if (q && q.trim()) {
      const searchTerm = q.trim();
      // Build boolean mode search term â€” wrap in quotes for phrase or append * for prefix
      const ftTerm = searchTerm.includes(' ')
        ? `"${searchTerm.replace(/"/g, '')}"`
        : `${searchTerm.replace(/[+\-><()~*"@]/g, '')}*`;

      conditions.push(
        `(MATCH(t.title, t.description) AGAINST(? IN BOOLEAN MODE) OR ${noteJoined ? 'tn.note_content LIKE ?' : '0'})`
      );
      params.push(ftTerm);
      if (noteJoined) {
        params.push(`%${searchTerm}%`);
      }
    }

    // assignedTo filter
    if (assignedTo) {
      const assignedToInt = parseInt(assignedTo, 10);
      if (isNaN(assignedToInt) || assignedToInt <= 0) {
        throw new ValidationError('assignedTo must be a positive integer');
      }
      conditions.push('t.assigned_to = ?');
      params.push(assignedToInt);
    }

    // assignedBy / created_by filter
    if (assignedBy) {
      const assignedByInt = parseInt(assignedBy, 10);
      if (isNaN(assignedByInt) || assignedByInt <= 0) {
        throw new ValidationError('assignedBy must be a positive integer');
      }
      conditions.push('t.created_by = ?');
      params.push(assignedByInt);
    }

    // createdBy filter (separate from assignedBy for named param clarity)
    if (createdBy) {
      const createdByInt = parseInt(createdBy, 10);
      if (isNaN(createdByInt) || createdByInt <= 0) {
        throw new ValidationError('createdBy must be a positive integer');
      }
      conditions.push('t.created_by = ?');
      params.push(createdByInt);
    }

    // priority filter
    if (priority) {
      conditions.push('t.priority = ?');
      params.push(priority);
    }

    // status filter
    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    // planId filter
    if (planId) {
      const planIdInt = parseInt(planId, 10);
      if (isNaN(planIdInt) || planIdInt <= 0) {
        throw new ValidationError('planId must be a positive integer');
      }
      conditions.push('p.id = ?');
      params.push(planIdInt);
    }

    // bucketId filter
    if (bucketId) {
      const bucketIdInt = parseInt(bucketId, 10);
      if (isNaN(bucketIdInt) || bucketIdInt <= 0) {
        throw new ValidationError('bucketId must be a positive integer');
      }
      conditions.push('t.bucket_id = ?');
      params.push(bucketIdInt);
    }

    // dueDateFrom filter
    if (dueDateFrom) {
      conditions.push('t.due_date >= ?');
      params.push(dueDateFrom);
    }

    // dueDateTo filter
    if (dueDateTo) {
      conditions.push('t.due_date <= ?');
      params.push(dueDateTo);
    }

    // datePreset filter (overrides dueDateFrom/dueDateTo if both provided, but applied additively)
    if (datePreset) {
      switch (datePreset) {
        case 'today':
          conditions.push('t.due_date = CURDATE()');
          break;
        case 'tomorrow':
          conditions.push('t.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
          break;
        case 'thisWeek':
          conditions.push(
            't.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)'
          );
          break;
        case 'thisMonth':
          conditions.push(
            't.due_date BETWEEN CURDATE() AND LAST_DAY(CURDATE())'
          );
          break;
        case 'overdue':
          conditions.push("t.due_date < CURDATE() AND t.status != 'completed'");
          break;
        case 'upcoming':
          conditions.push("t.due_date > CURDATE() AND t.status != 'completed'");
          break;
        default:
          break;
      }
    }

    // completionMin filter
    if (completionMinVal !== null) {
      conditions.push('t.completion_percentage >= ?');
      params.push(completionMinVal);
    }

    // hasAttachments filter
    if (hasAttachments === 'true') {
      conditions.push(
        'EXISTS (SELECT 1 FROM task_attachments ta WHERE ta.task_id = t.id AND ta.is_deleted = 0)'
      );
    } else if (hasAttachments === 'false') {
      conditions.push(
        'NOT EXISTS (SELECT 1 FROM task_attachments ta WHERE ta.task_id = t.id AND ta.is_deleted = 0)'
      );
    }

    // â”€â”€ Assemble WHERE clause â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // â”€â”€ COUNT query (for pagination total) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const countSql = `SELECT COUNT(DISTINCT t.id) AS total ${fromClause} ${whereClause}`;
    const countRows = await query(countSql, params);
    const total = Number(countRows[0].total);

    // â”€â”€ Data query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const dataSql = `
      SELECT DISTINCT
        t.id,
        t.title,
        t.priority,
        t.status,
        t.assigned_to,
        t.due_date,
        t.completion_percentage,
        ua.name  AS assignee_name,
        p.id     AS plan_id,
        p.name   AS plan_name,
        b.id     AS bucket_id,
        b.name   AS bucket_name
      ${fromClause}
      ${whereClause}
      ORDER BY t.id DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, pageSize, offset];
    const tasks = await query(dataSql, dataParams);

    // â”€â”€ Build response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const totalPages = Math.ceil(total / pageSize);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
        },
      },
    });
  })
);

export default router;

