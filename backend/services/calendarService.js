/**
 * Calendar Service
 *
 * Aggregation layer — never duplicates planner task data.
 * Virtual planner task events are built from planner_tasks.due_date at query time.
 */

import { query } from '../config/database.js';
import { checkTaskOwnership } from './plannerService.js';

/** Default category colours (fallback if DB seed missing) */
export const DEFAULT_CATEGORY_COLOURS = {
  planner_task: { bg: '#3B82F6', border: '#2563EB', dot: '#3B82F6', hover: '#60A5FA' },
  note:         { bg: '#8B5CF6', border: '#7C3AED', dot: '#8B5CF6', hover: '#A78BFA' },
  meeting:      { bg: '#10B981', border: '#059669', dot: '#10B981', hover: '#34D399' },
  deadline:     { bg: '#EF4444', border: '#DC2626', dot: '#EF4444', hover: '#F87171' },
  reminder:     { bg: '#F97316', border: '#EA580C', dot: '#F97316', hover: '#FB923C' },
  follow_up:    { bg: '#EAB308', border: '#CA8A04', dot: '#EAB308', hover: '#FACC15' },
  interview:    { bg: '#06B6D4', border: '#0891B2', dot: '#06B6D4', hover: '#22D3EE' },
  holiday:      { bg: '#6366F1', border: '#4F46E5', dot: '#6366F1', hover: '#818CF8' },
  leave:        { bg: '#EC4899', border: '#DB2777', dot: '#EC4899', hover: '#F472B6' },
  birthday:     { bg: '#F472B6', border: '#EC4899', dot: '#F472B6', hover: '#F9A8D4' },
  custom:       { bg: '#64748B', border: '#475569', dot: '#64748B', hover: '#94A3B8' },
};

const PRIORITY_BORDER = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

/**
 * Log calendar audit event
 */
export async function logCalendarAudit(userId, entityType, entityId, actionType, details = {}, db = null) {
  const sql = 'INSERT INTO calendar_audit_logs (user_id, entity_type, entity_id, action_type, action_details) VALUES (?, ?, ?, ?, ?)';
  const params = [userId, entityType, entityId, actionType, JSON.stringify(details)];
  if (db && typeof db.execute === 'function') {
    await db.execute(sql, params);
  } else if (db && typeof db === 'function') {
    await db(sql, params);
  } else {
    await query(sql, params);
  }
}

/**
 * Get category map keyed by slug
 */
export async function getCategoryMap(db = null) {
  const queryFn = db ? db.query.bind(db) : query;
  const rows = await queryFn(
    'SELECT id, slug, name, bg_colour, border_colour, dot_colour, hover_colour FROM calendar_categories WHERE is_system = 1 OR user_id IS NULL'
  );
  const map = {};
  for (const row of rows) {
    map[row.slug] = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      bg: row.bg_colour,
      border: row.border_colour,
      dot: row.dot_colour,
      hover: row.hover_colour,
    };
  }
  return map;
}

function buildColours(categorySlug, categoryMap, overrideColour, priority, isCompleted) {
  const cat = categoryMap[categorySlug] || DEFAULT_CATEGORY_COLOURS[categorySlug] || DEFAULT_CATEGORY_COLOURS.custom;
  const colours = {
    bg: overrideColour || cat.bg || cat.bg_colour,
    border: cat.border || cat.border_colour,
    dot: cat.dot || cat.dot_colour,
    hover: cat.hover || cat.hover_colour,
    priorityBorder: priority ? (PRIORITY_BORDER[priority] || null) : null,
    completed: isCompleted,
  };
  if (isCompleted) {
    colours.bg = '#9CA3AF';
    colours.border = '#6B7280';
    colours.strikethrough = true;
  }
  return colours;
}

/**
 * Fetch virtual planner task calendar items for a date range.
 * Never reads from calendar_events — source of truth is planner_tasks.
 */
export async function fetchPlannerTaskItems(userId, userRole, startDate, endDate, filters = {}, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  let accessClause = '';
  const params = [startDate, endDate];

  if (userRole !== 'Admin') {
    accessClause = `AND (
      t.created_by = ?
      OR t.assigned_to = ?
      OR p.owner_id = ?
    )`;
    params.push(userId, userId, userId);
  }

  let filterClause = '';
  if (filters.planId) {
    filterClause += ' AND p.id = ?';
    params.push(parseInt(filters.planId, 10));
  }
  if (filters.bucketId) {
    filterClause += ' AND b.id = ?';
    params.push(parseInt(filters.bucketId, 10));
  }
  if (filters.assignedTo) {
    filterClause += ' AND t.assigned_to = ?';
    params.push(parseInt(filters.assignedTo, 10));
  }
  if (filters.priority) {
    filterClause += ' AND t.priority = ?';
    params.push(filters.priority);
  }
  if (filters.status) {
    filterClause += ' AND t.status = ?';
    params.push(filters.status);
  } else if (filters.showCompleted === false || filters.showCompleted === 'false') {
    filterClause += " AND t.status != 'completed'";
  }
  if (filters.highPriority) {
    filterClause += " AND t.priority = 'high'";
  }

  const tasks = await queryFn(
    `SELECT
       t.id,
       t.title,
       t.description,
       t.priority,
       t.status,
       t.due_date,
       t.reminder_date,
       t.assigned_to,
       t.bucket_id,
       b.name AS bucket_name,
       b.plan_id,
       p.name AS plan_name,
       u.name AS assignee_name
     FROM planner_tasks t
     JOIN buckets b ON t.bucket_id = b.id
     JOIN plans p ON b.plan_id = p.id
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.is_deleted = 0
       AND t.due_date IS NOT NULL
       AND t.due_date BETWEEN ? AND ?
       ${accessClause}
       ${filterClause}
     ORDER BY t.due_date ASC, t.title ASC
     LIMIT 5000`,
    params
  );

  const categoryMap = await getCategoryMap(db);

  return tasks.map((t) => {
    const isCompleted = t.status === 'completed';
    return {
      id: `task-${t.id}`,
      source: 'planner_task',
      type: 'planner_task',
      planner_task_id: t.id,
      title: t.title,
      description: t.description,
      event_date: t.due_date,
      start_time: null,
      end_time: null,
      all_day: true,
      status: t.status,
      priority: t.priority,
      location: null,
      plan_id: t.plan_id,
      plan_name: t.plan_name,
      bucket_id: t.bucket_id,
      bucket_name: t.bucket_name,
      assigned_to: t.assigned_to,
      assignee_name: t.assignee_name,
      reminder_date: t.reminder_date,
      colours: buildColours('planner_task', categoryMap, null, t.priority, isCompleted),
    };
  });
}

/**
 * Fetch calendar events (meetings, custom, etc.) for date range
 */
export async function fetchCalendarEvents(userId, userRole, startDate, endDate, filters = {}, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  let userClause = 'e.user_id = ?';
  const params = [startDate, endDate];

  if (userRole === 'Admin' && filters.viewUserId) {
    params.push(parseInt(filters.viewUserId, 10));
  } else {
    params.push(userId);
  }

  let filterClause = '';
  if (filters.categorySlug) {
    filterClause += ' AND c.slug = ?';
    params.push(filters.categorySlug);
  }
  if (filters.status) {
    filterClause += ' AND e.status = ?';
    params.push(filters.status);
  } else if (filters.showCompleted === false || filters.showCompleted === 'false') {
    filterClause += " AND e.status != 'completed'";
  }

  const events = await queryFn(
    `SELECT
       e.id,
       e.title,
       e.description,
       e.event_date,
       e.start_time,
       e.end_time,
       e.all_day,
       e.location,
       e.colour,
       e.status,
       e.priority,
       e.recurrence_id,
       c.slug AS category_slug,
       c.name AS category_name
     FROM calendar_events e
     JOIN calendar_categories c ON e.category_id = c.id
     WHERE e.is_deleted = 0
       AND e.event_date BETWEEN ? AND ?
       AND ${userClause}
       ${filterClause}
     ORDER BY e.event_date ASC, e.start_time ASC
     LIMIT 5000`,
    params
  );

  const categoryMap = await getCategoryMap(db);

  return events.map((e) => {
    const isCompleted = e.status === 'completed';
    return {
      id: `event-${e.id}`,
      source: 'calendar_event',
      type: e.category_slug,
      event_id: e.id,
      title: e.title,
      description: e.description,
      event_date: e.event_date,
      start_time: e.start_time,
      end_time: e.end_time,
      all_day: !!e.all_day,
      status: e.status,
      priority: e.priority,
      location: e.location,
      recurrence_id: e.recurrence_id,
      colours: buildColours(e.category_slug, categoryMap, e.colour, e.priority, isCompleted),
    };
  });
}

/**
 * Fetch calendar notes for date range
 */
export async function fetchCalendarNotes(userId, userRole, startDate, endDate, filters = {}, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  const targetUserId = (userRole === 'Admin' && filters.viewUserId)
    ? parseInt(filters.viewUserId, 10)
    : userId;

  const notes = await queryFn(
    `SELECT
       n.id,
       n.title,
       n.note_content,
       n.note_date,
       n.start_time,
       n.colour,
       n.is_pinned,
       n.reminder_id
     FROM calendar_notes n
     WHERE n.is_deleted = 0
       AND n.user_id = ?
       AND n.note_date BETWEEN ? AND ?
     ORDER BY n.note_date ASC, n.start_time ASC
     LIMIT 5000`,
    [targetUserId, startDate, endDate]
  );

  const categoryMap = await getCategoryMap(db);

  return notes.map((n) => ({
    id: `note-${n.id}`,
    source: 'calendar_note',
    type: 'note',
    note_id: n.id,
    title: n.title,
    description: n.note_content,
    event_date: n.note_date,
    start_time: n.start_time,
    end_time: null,
    all_day: !n.start_time,
    is_pinned: !!n.is_pinned,
    reminder_id: n.reminder_id,
    colours: buildColours('note', categoryMap, n.colour, null, false),
  }));
}

/**
 * Aggregate all calendar items for visible date range
 */
export async function aggregateCalendarItems(userId, userRole, startDate, endDate, filters = {}, db = null) {
  const includeTypes = filters.types ? filters.types.split(',') : null;

  const promises = [];

  const wantTasks = !includeTypes || includeTypes.includes('planner_task');
  const wantEvents = !includeTypes || includeTypes.some((t) => t !== 'planner_task' && t !== 'note');
  const wantNotes = !includeTypes || includeTypes.includes('note');

  if (wantTasks && filters.showNotesOnly !== true) {
    promises.push(fetchPlannerTaskItems(userId, userRole, startDate, endDate, filters, db));
  } else {
    promises.push(Promise.resolve([]));
  }

  if (wantEvents && filters.showNotesOnly !== true) {
    promises.push(fetchCalendarEvents(userId, userRole, startDate, endDate, filters, db));
  } else {
    promises.push(Promise.resolve([]));
  }

  if (wantNotes) {
    promises.push(fetchCalendarNotes(userId, userRole, startDate, endDate, filters, db));
  } else {
    promises.push(Promise.resolve([]));
  }

  const [tasks, events, notes] = await Promise.all(promises);
  let items = [...tasks, ...events, ...notes];

  // Server-side search filter
  if (filters.q) {
    const q = filters.q.toLowerCase();
    items = items.filter((item) =>
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.location?.toLowerCase().includes(q) ||
      item.plan_name?.toLowerCase().includes(q) ||
      item.bucket_name?.toLowerCase().includes(q)
    );
  }

  // Sort by date then time
  items.sort((a, b) => {
    const dateCmp = String(a.event_date).localeCompare(String(b.event_date));
    if (dateCmp !== 0) return dateCmp;
    const timeA = a.start_time || '00:00:00';
    const timeB = b.start_time || '00:00:00';
    return timeA.localeCompare(timeB);
  });

  return items;
}

/**
 * Get pinned notes for planner dashboard
 */
export async function getPinnedNotes(userId, db = null) {
  const queryFn = db ? db.query.bind(db) : query;
  return queryFn(
    `SELECT id, title, note_content, note_date, colour, is_pinned, created_at, updated_at
     FROM calendar_notes
     WHERE user_id = ? AND is_pinned = 1 AND is_deleted = 0
     ORDER BY updated_at DESC
     LIMIT 20`,
    [userId]
  );
}

/**
 * Check calendar event ownership
 */
export async function checkEventOwnership(eventId, userId, userRole, db = null) {
  if (userRole === 'Admin') return true;
  const queryFn = db ? db.query.bind(db) : query;
  const rows = await queryFn(
    'SELECT id FROM calendar_events WHERE id = ? AND user_id = ? AND is_deleted = 0',
    [eventId, userId]
  );
  return rows.length > 0;
}

/**
 * Check calendar note ownership
 */
export async function checkNoteOwnership(noteId, userId, userRole, db = null) {
  if (userRole === 'Admin') return true;
  const queryFn = db ? db.query.bind(db) : query;
  const rows = await queryFn(
    'SELECT id FROM calendar_notes WHERE id = ? AND user_id = ? AND is_deleted = 0',
    [noteId, userId]
  );
  return rows.length > 0;
}

/**
 * Compute reminder datetime from type and event date/time
 */
export function computeReminderDateTime(reminderType, eventDate, startTime) {
  const base = startTime
    ? new Date(`${eventDate}T${startTime}`)
    : new Date(`${eventDate}T09:00:00`);

  const offsets = {
    '5min': 5 * 60 * 1000,
    '10min': 10 * 60 * 1000,
    '15min': 15 * 60 * 1000,
    '30min': 30 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '2hours': 2 * 60 * 60 * 1000,
  };

  if (offsets[reminderType]) {
    return new Date(base.getTime() - offsets[reminderType]);
  }
  if (reminderType === 'tomorrow') {
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (reminderType === 'next_week') {
    const d = new Date(base);
    d.setDate(d.getDate() - 7);
    return d;
  }
  return base;
}

export { checkTaskOwnership };
