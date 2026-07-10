/**
 * Calendar Notes API
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
import { sanitizeHtml } from '../../utils/htmlSanitizer.js';
import {
  validateEventTitle,
  validateDate,
  validateTime,
  validateColour,
  validateReminderType,
} from '../../utils/calendarValidation.js';
import {
  checkNoteOwnership,
  logCalendarAudit,
  computeReminderDateTime,
} from '../../services/calendarService.js';

const router = express.Router();

router.post(
  '/notes',
  authenticate,
  asyncHandler(async (req, res) => {
    const titleResult = validateEventTitle(req.body.title);
    if (!titleResult.valid) throw new ValidationError(titleResult.error);

    const dateResult = validateDate(req.body.note_date || req.body.date, 'Note date');
    if (!dateResult.valid) throw new ValidationError(dateResult.error);

    const timeResult = validateTime(req.body.start_time);
    if (!timeResult.valid) throw new ValidationError(timeResult.error);

    const colourResult = validateColour(req.body.colour || '#8B5CF6');
    if (!colourResult.valid) throw new ValidationError(colourResult.error);

    let reminderId = null;
    if (req.body.reminder_type) {
      const remResult = validateReminderType(req.body.reminder_type);
      if (!remResult.valid) throw new ValidationError(remResult.error);
      const remindAt = computeReminderDateTime(
        remResult.value,
        dateResult.value,
        timeResult.value
      );
      const remInsert = await query(
        'INSERT INTO calendar_reminders (user_id, reminder_type, remind_at) VALUES (?, ?, ?)',
        [req.user.id, remResult.value, remindAt]
      );
      reminderId = remInsert.insertId;
    }

    const content = req.body.note_content
      ? sanitizeHtml(req.body.note_content)
      : null;

    const result = await query(
      `INSERT INTO calendar_notes
         (user_id, title, note_content, note_date, start_time, colour, is_pinned,
          reminder_id, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        titleResult.value,
        content,
        dateResult.value,
        timeResult.value,
        colourResult.value || '#8B5CF6',
        req.body.is_pinned ? 1 : 0,
        reminderId,
        req.user.id,
        req.user.id,
      ]
    );

    await logCalendarAudit(req.user.id, 'note', result.insertId, 'note_created', {
      title: titleResult.value,
    });

    res.status(201).json({ success: true, data: { noteId: result.insertId } });
  })
);

router.get(
  '/notes/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.id, 10);
    if (isNaN(noteId)) throw new ValidationError('Invalid note ID');

    const hasAccess = await checkNoteOwnership(noteId, req.user.id, req.user.role);
    if (!hasAccess) throw new ForbiddenError('Access denied');

    const rows = await query(
      'SELECT * FROM calendar_notes WHERE id = ? AND is_deleted = 0',
      [noteId]
    );
    if (rows.length === 0) throw new NotFoundError('Note not found');

    res.json({ success: true, data: { note: rows[0] } });
  })
);

router.put(
  '/notes/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.id, 10);
    if (isNaN(noteId)) throw new ValidationError('Invalid note ID');

    const hasAccess = await checkNoteOwnership(noteId, req.user.id, req.user.role);
    if (!hasAccess) throw new ForbiddenError('Access denied');

    const updates = [];
    const params = [];

    if (req.body.title !== undefined) {
      const r = validateEventTitle(req.body.title);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('title = ?'); params.push(r.value);
    }
    if (req.body.note_content !== undefined) {
      updates.push('note_content = ?'); params.push(sanitizeHtml(req.body.note_content));
    }
    if (req.body.note_date !== undefined || req.body.date !== undefined) {
      const r = validateDate(req.body.note_date || req.body.date);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('note_date = ?'); params.push(r.value);
    }
    if (req.body.start_time !== undefined) {
      const r = validateTime(req.body.start_time);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('start_time = ?'); params.push(r.value);
    }
    if (req.body.colour !== undefined) {
      const r = validateColour(req.body.colour);
      if (!r.valid) throw new ValidationError(r.error);
      updates.push('colour = ?'); params.push(r.value);
    }
    if (req.body.is_pinned !== undefined) {
      updates.push('is_pinned = ?'); params.push(req.body.is_pinned ? 1 : 0);
    }

    if (updates.length === 0) throw new ValidationError('No fields to update');

    updates.push('updated_by = ?'); params.push(req.user.id);
    params.push(noteId);

    await query(`UPDATE calendar_notes SET ${updates.join(', ')} WHERE id = ?`, params);
    await logCalendarAudit(req.user.id, 'note', noteId, 'note_updated', req.body);

    res.json({ success: true, message: 'Note updated' });
  })
);

router.delete(
  '/notes/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.id, 10);
    if (isNaN(noteId)) throw new ValidationError('Invalid note ID');

    const hasAccess = await checkNoteOwnership(noteId, req.user.id, req.user.role);
    if (!hasAccess) throw new ForbiddenError('Access denied');

    await query(
      'UPDATE calendar_notes SET is_deleted = 1, updated_by = ? WHERE id = ?',
      [req.user.id, noteId]
    );
    await logCalendarAudit(req.user.id, 'note', noteId, 'note_deleted', {});

    res.json({ success: true, message: 'Note deleted' });
  })
);

export default router;
