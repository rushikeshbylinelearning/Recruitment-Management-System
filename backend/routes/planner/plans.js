/**
 * Plans API Routes
 * 
 * Endpoints for managing HR Planner Workspace plans.
 * Implements Requirement R1: Dynamic Plan Management
 * 
 * Routes:
 * - GET    /api/planner/plans          - List all plans for current user
 * - POST   /api/planner/plans          - Create new plan
 * - GET    /api/planner/plans/:id      - Get single plan with buckets
 * - PUT    /api/planner/plans/:id      - Update plan details
 * - DELETE /api/planner/plans/:id      - Soft-delete a plan
 * - POST   /api/planner/plans/:id/archive   - Archive a plan
 * - POST   /api/planner/plans/:id/restore   - Restore archived/deleted plan
 */

import express from 'express';
import { query } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import { asyncHandler, NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import { validatePlanName } from '../../utils/plannerValidation.js';

const router = express.Router();

/**
 * GET /api/planner/plans
 * List all plans for the current user.
 * 
 * Authorization:
 * - Admin: sees all non-deleted plans
 * - Recruiter/Intern: sees only their own plans (owner_id = user.id) or plans they're members of
 * 
 * Query params:
 * - includeArchived: 'true' to include archived plans (default: false)
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const includeArchived = req.query.includeArchived === 'true';

  let plans;

  if (userRole === 'Admin') {
    // Admin sees all non-deleted plans
    const whereClause = includeArchived 
      ? 'WHERE p.is_deleted = 0' 
      : 'WHERE p.is_deleted = 0 AND p.is_archived = 0';

    plans = await query(
      `SELECT 
        p.id, p.name, p.description, p.colour, p.icon, 
        p.owner_id, p.visibility, p.is_archived, 
        p.created_at, p.updated_at, p.created_by, p.updated_by,
        u.name as owner_name
       FROM plans p
       LEFT JOIN users u ON p.owner_id = u.id
       ${whereClause}
       ORDER BY p.is_archived ASC, p.updated_at DESC`
    );
  } else {
    // Recruiter/Intern: only their own plans or plans they're members of
    const whereClause = includeArchived
      ? 'AND p.is_deleted = 0'
      : 'AND p.is_deleted = 0 AND p.is_archived = 0';

    plans = await query(
      `SELECT DISTINCT
        p.id, p.name, p.description, p.colour, p.icon,
        p.owner_id, p.visibility, p.is_archived,
        p.created_at, p.updated_at, p.created_by, p.updated_by,
        u.name as owner_name
       FROM plans p
       LEFT JOIN users u ON p.owner_id = u.id
       LEFT JOIN plan_members pm ON p.id = pm.plan_id
       WHERE (p.owner_id = ? OR pm.user_id = ?)
       ${whereClause}
       ORDER BY p.is_archived ASC, p.updated_at DESC`,
      [userId, userId]
    );
  }

  res.json({
    success: true,
    data: { plans }
  });
}));

/**
 * POST /api/planner/plans
 * Create a new plan.
 * 
 * Body:
 * - name (required): plan name (1-100 characters)
 * - description (optional): plan description
 * - colour (optional): hex color code (default: #3B82F6)
 * - icon (optional): icon identifier
 * - visibility (optional): 'private', 'shared', 'department', 'admin_only' (default: 'private')
 * 
 * Authorization: All authenticated users can create plans
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, description, colour, icon, visibility } = req.body;
  const userId = req.user.id;

  // Validate plan name (R1.2)
  if (!validatePlanName(name)) {
    throw new ValidationError('Plan name must be between 1 and 100 characters');
  }

  // Validate visibility
  const validVisibilities = ['private', 'shared', 'department', 'admin_only'];
  const planVisibility = visibility && validVisibilities.includes(visibility) 
    ? visibility 
    : 'private';

  // Set default colour
  const planColour = colour || '#3B82F6';

  // Create plan (R1.1, R1.6)
  const result = await query(
    `INSERT INTO plans 
      (name, description, colour, icon, owner_id, visibility, created_by, updated_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description || null, planColour, icon || null, userId, planVisibility, userId, userId]
  );

  res.status(201).json({
    success: true,
    message: 'Plan created successfully',
    data: { 
      planId: result.insertId 
    }
  });
}));

/**
 * GET /api/planner/plans/:id
 * Get a single plan with its buckets.
 * 
 * Authorization:
 * - Admin: can access any plan
 * - Recruiter/Intern: can only access their own plans or plans they're members of
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const planId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  if (isNaN(planId)) {
    throw new ValidationError('Invalid plan ID');
  }

  // Fetch plan
  let plans;
  
  if (userRole === 'Admin') {
    plans = await query(
      `SELECT 
        p.id, p.name, p.description, p.colour, p.icon,
        p.owner_id, p.visibility, p.is_archived, p.is_deleted,
        p.created_at, p.updated_at, p.created_by, p.updated_by,
        u.name as owner_name
       FROM plans p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.id = ? AND p.is_deleted = 0`,
      [planId]
    );
  } else {
    // Check ownership or membership
    plans = await query(
      `SELECT DISTINCT
        p.id, p.name, p.description, p.colour, p.icon,
        p.owner_id, p.visibility, p.is_archived, p.is_deleted,
        p.created_at, p.updated_at, p.created_by, p.updated_by,
        u.name as owner_name
       FROM plans p
       LEFT JOIN users u ON p.owner_id = u.id
       LEFT JOIN plan_members pm ON p.id = pm.plan_id
       WHERE p.id = ? 
         AND (p.owner_id = ? OR pm.user_id = ?)
         AND p.is_deleted = 0`,
      [planId, userId, userId]
    );
  }

  if (plans.length === 0) {
    throw new NotFoundError('Plan not found');
  }

  const plan = plans[0];

  // Fetch buckets for this plan
  const buckets = await query(
    `SELECT 
      id, name, description, colour, icon, position, collapsed,
      created_at, updated_at, created_by, updated_by
     FROM buckets
     WHERE plan_id = ? AND is_deleted = 0
     ORDER BY position ASC`,
    [planId]
  );

  res.json({
    success: true,
    data: {
      plan,
      buckets
    }
  });
}));

/**
 * PUT /api/planner/plans/:id
 * Update plan details (name, description, colour, icon, visibility).
 * 
 * Body:
 * - name (optional): new plan name (1-100 characters)
 * - description (optional): new description
 * - colour (optional): new hex color code
 * - icon (optional): new icon identifier
 * - visibility (optional): new visibility setting
 * 
 * Authorization:
 * - Admin: can update any plan
 * - Recruiter/Intern: can only update plans they own
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const planId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;
  const { name, description, colour, icon, visibility } = req.body;

  if (isNaN(planId)) {
    throw new ValidationError('Invalid plan ID');
  }

  // Check if plan exists and user has permission
  let plans;
  
  if (userRole === 'Admin') {
    plans = await query(
      'SELECT id, owner_id FROM plans WHERE id = ? AND is_deleted = 0',
      [planId]
    );
  } else {
    plans = await query(
      'SELECT id, owner_id FROM plans WHERE id = ? AND owner_id = ? AND is_deleted = 0',
      [planId, userId]
    );
  }

  if (plans.length === 0) {
    throw new NotFoundError('Plan not found or access denied');
  }

  // Validate name if provided
  if (name !== undefined && !validatePlanName(name)) {
    throw new ValidationError('Plan name must be between 1 and 100 characters');
  }

  // Validate visibility if provided
  const validVisibilities = ['private', 'shared', 'department', 'admin_only'];
  if (visibility !== undefined && !validVisibilities.includes(visibility)) {
    throw new ValidationError('Invalid visibility value');
  }

  // Build update query dynamically
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (colour !== undefined) {
    updates.push('colour = ?');
    params.push(colour);
  }
  if (icon !== undefined) {
    updates.push('icon = ?');
    params.push(icon);
  }
  if (visibility !== undefined) {
    updates.push('visibility = ?');
    params.push(visibility);
  }

  if (updates.length === 0) {
    throw new ValidationError('No fields to update');
  }

  updates.push('updated_by = ?');
  params.push(userId);
  params.push(planId);

  await query(
    `UPDATE plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
    params
  );

  res.json({
    success: true,
    message: 'Plan updated successfully'
  });
}));

/**
 * DELETE /api/planner/plans/:id
 * Soft-delete a plan (set is_deleted = 1).
 * 
 * Authorization:
 * - Admin: can delete any plan
 * - Recruiter/Intern: can only delete plans they own
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const planId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  if (isNaN(planId)) {
    throw new ValidationError('Invalid plan ID');
  }

  // Check if plan exists and user has permission
  let plans;
  
  if (userRole === 'Admin') {
    plans = await query(
      'SELECT id FROM plans WHERE id = ? AND is_deleted = 0',
      [planId]
    );
  } else {
    plans = await query(
      'SELECT id FROM plans WHERE id = ? AND owner_id = ? AND is_deleted = 0',
      [planId, userId]
    );
  }

  if (plans.length === 0) {
    throw new NotFoundError('Plan not found or access denied');
  }

  // Soft-delete the plan (R1.7)
  await query(
    'UPDATE plans SET is_deleted = 1, updated_by = ?, updated_at = NOW() WHERE id = ?',
    [userId, planId]
  );

  res.json({
    success: true,
    message: 'Plan deleted successfully'
  });
}));

/**
 * POST /api/planner/plans/:id/archive
 * Archive a plan (set is_archived = 1).
 * 
 * Authorization:
 * - Admin: can archive any plan
 * - Recruiter/Intern: can only archive plans they own
 */
router.post('/:id/archive', authenticate, asyncHandler(async (req, res) => {
  const planId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  if (isNaN(planId)) {
    throw new ValidationError('Invalid plan ID');
  }

  // Check if plan exists and user has permission
  let plans;
  
  if (userRole === 'Admin') {
    plans = await query(
      'SELECT id, is_archived FROM plans WHERE id = ? AND is_deleted = 0',
      [planId]
    );
  } else {
    plans = await query(
      'SELECT id, is_archived FROM plans WHERE id = ? AND owner_id = ? AND is_deleted = 0',
      [planId, userId]
    );
  }

  if (plans.length === 0) {
    throw new NotFoundError('Plan not found or access denied');
  }

  const plan = plans[0];

  if (plan.is_archived) {
    throw new ValidationError('Plan is already archived');
  }

  // Archive the plan (R1.5)
  await query(
    'UPDATE plans SET is_archived = 1, status = "archived", updated_by = ?, updated_at = NOW() WHERE id = ?',
    [userId, planId]
  );

  res.json({
    success: true,
    message: 'Plan archived successfully'
  });
}));

/**
 * POST /api/planner/plans/:id/restore
 * Restore an archived or soft-deleted plan.
 * 
 * Authorization:
 * - Admin: can restore any plan
 * - Recruiter/Intern: can only restore plans they own
 */
router.post('/:id/restore', authenticate, asyncHandler(async (req, res) => {
  const planId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  if (isNaN(planId)) {
    throw new ValidationError('Invalid plan ID');
  }

  // Check if plan exists and user has permission
  let plans;
  
  if (userRole === 'Admin') {
    plans = await query(
      'SELECT id, is_archived, is_deleted FROM plans WHERE id = ?',
      [planId]
    );
  } else {
    plans = await query(
      'SELECT id, is_archived, is_deleted FROM plans WHERE id = ? AND owner_id = ?',
      [planId, userId]
    );
  }

  if (plans.length === 0) {
    throw new NotFoundError('Plan not found or access denied');
  }

  const plan = plans[0];

  if (!plan.is_archived && !plan.is_deleted) {
    throw new ValidationError('Plan is not archived or deleted');
  }

  // Restore the plan (R1.3)
  await query(
    'UPDATE plans SET is_archived = 0, is_deleted = 0, status = "active", updated_by = ?, updated_at = NOW() WHERE id = ?',
    [userId, planId]
  );

  res.json({
    success: true,
    message: 'Plan restored successfully'
  });
}));

export default router;

