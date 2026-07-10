/**
 * Calendar Items API — aggregation endpoint
 *
 * GET /api/calendar/items?start=&end=&filters
 * Returns unified calendar items (virtual planner tasks + events + notes)
 */

import express from 'express';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import { asyncHandler, ValidationError } from '../../middleware/errorHandler.js';
import { parseDateRange } from '../../utils/calendarValidation.js';
import { aggregateCalendarItems, getCategoryMap, getPinnedNotes } from '../../services/calendarService.js';

const router = express.Router();

router.get(
  '/items',
  authenticate,
  asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    const range = parseDateRange(start, end);
    if (!range.valid) throw new ValidationError(range.error);

    const filters = {
      q: req.query.q,
      types: req.query.types,
      categorySlug: req.query.category,
      status: req.query.status,
      priority: req.query.priority,
      planId: req.query.planId,
      bucketId: req.query.bucketId,
      assignedTo: req.query.assignedTo,
      showCompleted: req.query.showCompleted,
      highPriority: req.query.highPriority === 'true',
      showNotesOnly: req.query.notesOnly === 'true',
      viewUserId: req.query.viewUserId,
    };

    const items = await aggregateCalendarItems(
      req.user.id,
      req.user.role,
      range.start,
      range.end,
      filters
    );

    res.json({ success: true, data: { items, count: items.length } });
  })
);

router.get(
  '/categories',
  authenticate,
  asyncHandler(async (req, res) => {
    const categories = await getCategoryMap();
    res.json({ success: true, data: { categories: Object.values(categories) } });
  })
);

router.get(
  '/pinned-notes',
  authenticate,
  asyncHandler(async (req, res) => {
    const notes = await getPinnedNotes(req.user.id);
    res.json({ success: true, data: { notes } });
  })
);

export default router;
