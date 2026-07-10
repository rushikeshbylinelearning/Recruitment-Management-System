/**
 * Planner Routes Index
 * 
 * Consolidates all planner sub-routers into a single entry point.
 * Mounted at /api/planner in server.js
 * 
 * Structure:
 * - Plans router at /plans (uses / and /:id internally)
 * - All other sub-routers at / (they include full path segments)
 * - Admin router at /admin
 */

import express from 'express';
import { authenticateToken as authenticate } from '../../middleware/auth.js';

// Import all planner sub-routers
import plannerPlansRoutes from './plans.js';
import plannerBucketsRoutes from './buckets.js';
import plannerTasksRoutes from './tasks.js';
import plannerLabelsRoutes from './labels.js';
import plannerChecklistsRoutes from './checklists.js';
import plannerNotesRoutes from './notes.js';
import plannerCommentsRoutes from './comments.js';
import plannerActivityRoutes from './activity.js';
import plannerAttachmentsRoutes from './attachments.js';
import plannerSearchRoutes from './search.js';
import plannerAdminRoutes from './admin.js';

const router = express.Router();

// Apply authentication and rate limiting at the planner router level
// This ensures all planner routes are protected
router.use(authenticate);

// Mount all sub-routers
// Plans uses '/plans' prefix (routes are / and /:id internally)
router.use('/plans', plannerPlansRoutes);

// All other routers mount at / since they have full path segments in their definitions
// (e.g., /buckets/:id, /tasks, /labels, etc.)
router.use('/', plannerBucketsRoutes);
router.use('/', plannerTasksRoutes);
router.use('/', plannerLabelsRoutes);
router.use('/', plannerChecklistsRoutes);
router.use('/', plannerNotesRoutes);
router.use('/', plannerCommentsRoutes);
router.use('/', plannerActivityRoutes);
router.use('/', plannerAttachmentsRoutes);
router.use('/', plannerSearchRoutes);

// Admin router at /admin
router.use('/admin', plannerAdminRoutes);

export default router;

