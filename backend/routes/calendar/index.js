/**
 * Calendar index — mounts all calendar sub-routers at /api/calendar
 */

import express from 'express';
import calendarItemsRoutes from './items.js';
import calendarEventsRoutes from './events.js';
import calendarNotesRoutes from './notes.js';

const router = express.Router();

router.use('/', calendarItemsRoutes);
router.use('/', calendarEventsRoutes);
router.use('/', calendarNotesRoutes);

export default router;
