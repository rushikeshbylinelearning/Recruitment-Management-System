/**
 * Calendar Events API
 *
 * CRUD for calendar_events (meetings, custom events, deadlines, etc.)
 * Does NOT create planner tasks — use planner API for that.
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
  validateEventTitle,
  validateDate,
  validateTime,
  validateColour,
  validateCategorySlug,
  validateReminderType,
  validateRecurrenceFrequency,
} from '../../utils/calendarValidation.js';
import {
  checkEventOwnership,
  logCalendarAudit,
  computeReminderDateTime,
} from '../../services/calendarService.js';

const router = express.Router();

async function connQuery(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

async function connInsert(conn, sql, params = []) {
  const [result] = await conn.execute(sql, params);
  return result.insertId;
}

async function getCategoryIdBySlug(slug, conn) {
  const rows = await connQuery(
    conn,
    'SELECT id FROM calendar_categories WHERE slug = ? AND (is_system = 1 OR user_id IS NULL) LIMIT 1',
    [slug]
  );
  if (rows.length === 0) throw new ValidationError(`Unknown category: ${slug}`);
  return rows[0].id;
}

router.post(
  '/events',
  authenticate,
  asyncHandler(async (req, res) => {
    const titleResult = validateEventTitle(req.body.title);
    if (!titleResult.valid) throw new ValidationError(titleResult.error);

    const dateResult = validateDate(req.body.event_date || req.body.date, 'Event date');
    if (!dateResult.valid) throw new ValidationError(dateResult.error);

    const startResult = validateTime(req.body.start_time);
    if (!startResult.valid) throw new ValidationError(startResult.error);
    const endResult = validateTime(req.body.end_time);
    if (!endResult.valid) throw new ValidationError(endResult.error);

    const categorySlug = req.body.category || req.body.type || 'custom';
    const catResult = validateCategorySlug(categorySlug);
    if (!catResult.valid) throw new ValidationError(catResult.error);

    const colourResult = validateColour(req.body.colour);
    if (!colourResult.valid) throw new ValidationError(colourResult.error);

    const eventId = await transaction(async (conn) => {
      const categoryId = await getCategoryIdBySlug(catResult.value, conn);

      let reminderId = null;
      if (req.body.reminder_type) {
        const remResult = validateReminderType(req.body.reminder_type);
        if (!remResult.valid) throw new ValidationError(remResult.error);
        const remindAt = computeReminderDateTime(
          remResult.value,
          dateResult.value,
          startResult.value
        );
        reminderId = await connInsert(
          conn,
          'INSERT INTO calendar_reminders (user_id, reminder_type, remind_at) VALUES (?, ?, ?)',
          [req.user.id, remResult.value, remindAt]
        );
      }

      let recurrenceId = null;
      if (req.body.recurrence?.frequency) {
        const freqResult = validateRecurrenceFrequency(req.body.recurrence.frequency);
        if (!freqResult.valid) throw new ValidationError(freqResult.error);
        recurrenceId = await connInsert(
          conn,
          `INSERT INTO calendar_recurrence
             (frequency, interval_value, days_of_week, day_of_month, end_date, occurrence_count, custom_rule)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            freqResult.value,
            req.body.recurrence.interval || 1,
            req.body.recurrence.days_of_week || null,
            req.body.recurrence.day_of_month || null,
            req.body.recurrence.end_date || null,
            req.body.recurrence.occurrence_count || null,
            req.body.recurrence.custom_rule ? JSON.stringify(req.body.recurrence.custom_rule) : null,
          ]
        );
      }

      const insertId = await connInsert(
        conn,
        `INSERT INTO calendar_events
           (user_id, category_id, title, description, event_date, start_time, end_time,
            all_day, location, colour, status, priority, recurrence_id, reminder_id,
            created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          categoryId,
          titleResult.value,
          req.body.description || null,
          dateResult.value,
          startResult.value,
          endResult.value,
          req.body.all_day ? 1 : 0,
          req.body.location || null,
          colourResult.value,
          req.body.status || 'pending',
          req.body.priority || 'medium',
          recurrenceId,
          reminderId,
          req.user.id,
          req.user.id,
        ]
      );

      await logCalendarAudit(req.user.id, 'event', insertId, 'event_created', {
        title: titleResult.value,
        category: catResult.value,
      }, conn);

      return insertId;
    });

    res.status(201).json({ success: true, data: { eventId } });
  })
);

router.get(
  '/events/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) throw new ValidationError('Invalid event ID');

    const hasAccess = await checkEventOwnership(eventId, req.user.id, req.user.role);
    if (!hasAccess) throw new ForbiddenError('Access denied');

    const rows = await query(
      `SELECT e.*, c.slug AS category_slug, c.name AS category_name
       FROM calendar_events e
       JOIN calendar_categories c ON e.category_id = c.id
       WHERE e.id = ? AND e.is_deleted = 0`,
      [eventId]
    );
    if (rows.length === 0) throw new NotFoundError('Event not found');

    res.json({ success: true, data: { event: rows[0] } });
  })
);

router.put(
  '/events/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) throw new ValidationError('Invalid event ID');

    const hasAccess = await checkEventOwnership(eventId, req.user.id, req.user.role);
    if (!hasAccess) throw new ForbiddenError('Access denied');

    const updates = [];
    const params = [];

    if (req.body.title !== undefined) {
      const r = validateEventTitle(req.body.title);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('title = ?'); params.push(r.value);
    }
    if (req.body.description !== undefined) {
      updates.push('description = ?'); params.push(req.body.description);
    }
    if (req.body.event_date !== undefined || req.body.date !== undefined) {
      const r = validateDate(req.body.event_date || req.body.date);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('event_date = ?'); params.push(r.value);
    }
    if (req.body.start_time !== undefined) {
      const r = validateTime(req.body.start_time);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('start_time = ?'); params.push(r.value);
    }
    if (req.body.end_time !== undefined) {
      const r = validateTime(req.body.end_time);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('end_time = ?'); params.push(r.value);
    }
    if (req.body.all_day !== undefined) {
      updates.push('all_day = ?'); params.push(req.body.all_day ? 1 : 0);
    }
    if (req.body.location !== undefined) {
      updates.push('location = ?'); params.push(req.body.location);
    }
    if (req.body.colour !== undefined) {
      const r = validateColour(req.body.colour);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('colour = ?'); params.push(r.value);
    }
    if (req.body.status !== undefined) {
      updates.push('status = ?'); params.push(req.body.status);
    }
    if (req.body.priority !== undefined) {
      updates.push('priority = ?'); params.push(req.body.priority);
    }

    if (updates.length === 0) throw new ValidationError('No fields to update');

    updates.push('updated_by = ?'); params.push(req.user.id);
    params.push(eventId);

    await query(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`, params);
    await logCalendarAudit(req.user.id, 'event', eventId, 'event_updated', req.body);

    res.json({ success: true, message: 'Event updated' });
  })
);

router.delete(
  '/events/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) throw new ValidationError('Invalid event ID');

    const hasAccess = await checkEventOwnership(eventId, req.user.id, req.user.role);
    if (!hasAccess) throw new ForbiddenError('Access denied');

    await query(
      'UPDATE calendar_events SET is_deleted = 1, updated_by = ? WHERE id = ?',
      [req.user.id, eventId]
    );
    await logCalendarAudit(req.user.id, 'event', eventId, 'event_deleted', {});

    res.json({ success: true, message: 'Event deleted' });
  })
);

export default router;
