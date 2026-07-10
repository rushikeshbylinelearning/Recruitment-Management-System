/**
 * Planner Service
 * 
 * Business logic and permission enforcement for the HR Planner Workspace.
 * Validates role-based task assignment restrictions and maintains activity logs.
 * 
 * Implements requirements:
 * - R3 (Task Creation): Assignment permission checks based on role
 * - R4 (Notifications): Activity logging for notification triggers
 * - R15 (Permissions): Role-based authorization enforcement
 */

import { query } from '../config/database.js';

/**
 * Check if a user has permission to assign a task to a specific assignee.
 * 
 * Assignment rules (R3, R15):
 * - Admin: Can assign to any active user
 * - Recruiter: Can only assign to self or HR Intern users
 * - HR Intern: Can only assign to self
 * - Non-active users: Assignment always rejected
 * 
 * @param {Object} assigner - The user attempting to assign the task (full user object with id, role, etc.)
 * @param {number} assigneeId - The user ID to assign the task to
 * @param {Object} db - Database connection (optional, uses default query if not provided)
 * @returns {Promise<Object>} { allowed: boolean, reason?: string }
 * 
 * @example
 * const result = await checkAssignmentPermission(req.user, 42, db);
 * if (!result.allowed) {
 *   return res.status(403).json({ message: result.reason });
 * }
 */
export async function checkAssignmentPermission(assigner, assigneeId, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  try {
    // Fetch the assignee user record
    const assignees = await queryFn(
      'SELECT id, role, status FROM users WHERE id = ?',
      [assigneeId]
    );

    // User does not exist
    if (!assignees || assignees.length === 0) {
      return { allowed: false, reason: 'User not found' };
    }

    const assignee = assignees[0];

    // User is not active (R3.5)
    if (assignee.status !== 'Active') {
      return { allowed: false, reason: 'User not active' };
    }

    // Admin can assign to any active user (R3.3)
    if (assigner.role === 'Admin') {
      return { allowed: true };
    }

    // Recruiter can assign to self or HR Intern (R3.2, R15.13)
    if (assigner.role === 'Recruiter') {
      if (assignee.id === assigner.id) {
        return { allowed: true };
      }
      if (assignee.role === 'HR Intern') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Recruiter can only assign to self or HR Interns' };
    }

    // HR Intern can only assign to self (R3.4, R15.14)
    if (assigner.role === 'HR Intern') {
      if (assignee.id === assigner.id) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Intern can only assign to self' };
    }

    // Fallback: role not recognized or no permission
    return { allowed: false, reason: 'Insufficient permissions for task assignment' };
  } catch (error) {
    console.error('[PlannerService] checkAssignmentPermission error:', error);
    throw error;
  }
}

/**
 * Log an activity event to the task_activity_logs table.
 * 
 * This is an append-only operation — never UPDATE or DELETE from activity logs (R9, R15.11).
 * Activity logs are immutable audit records for compliance and accountability.
 * 
 * @param {number} taskId - The task ID this activity relates to
 * @param {number} userId - The user ID who performed the action
 * @param {string} actionType - The type of action (must match ENUM in task_activity_logs table)
 * @param {Object} details - Optional JSON object with action-specific details
 * @param {Object} db - Database connection (optional, uses default query if not provided)
 * @returns {Promise<void>}
 * 
 * Valid actionType values (from design.md):
 * 'task_created', 'task_edited', 'task_moved', 'priority_changed',
 * 'task_assigned', 'task_completed', 'checklist_updated', 'file_uploaded',
 * 'file_deleted', 'comment_added', 'label_changed', 'status_changed',
 * 'bucket_moved', 'task_deleted', 'task_restored'
 * 
 * @example
 * await logActivity(taskId, req.user.id, 'task_assigned', {
 *   assignee_id: 42,
 *   assignee_name: 'John Doe',
 *   assigned_by_admin: true
 * }, db);
 */
export async function logActivity(taskId, userId, actionType, details = {}, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  try {
    // Append-only insert (R9.8, R15.11)
    await queryFn(
      'INSERT INTO task_activity_logs (task_id, user_id, action_type, action_details) VALUES (?, ?, ?, ?)',
      [taskId, userId, actionType, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('[PlannerService] logActivity error:', error);
    throw error;
  }
}

/**
 * Check if a user owns a task or has permission to modify it.
 * 
 * Ownership rules:
 * - Admin: Can access any task
 * - Recruiter/Intern: Can only access tasks they created or are assigned to
 * 
 * @param {number} taskId - The task ID to check
 * @param {number} userId - The user ID attempting to access the task
 * @param {string} userRole - The user's role (Admin, Recruiter, HR Intern)
 * @param {Object} db - Database connection (optional, uses default query if not provided)
 * @returns {Promise<boolean>} True if user has access, false otherwise
 * 
 * @example
 * const hasAccess = await checkTaskOwnership(taskId, req.user.id, req.user.role, db);
 * if (!hasAccess) {
 *   return res.status(403).json({ message: 'Access denied' });
 * }
 */
export async function checkTaskOwnership(taskId, userId, userRole, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  try {
    // Admin has access to all tasks (R15.2)
    if (userRole === 'Admin') {
      return true;
    }

    // Check if user created the task, is assigned to it, or owns the plan the task belongs to.
    // This covers the case where an admin creates a task in a recruiter/intern's plan —
    // the plan owner must be able to see and open that task.
    const tasks = await queryFn(
      `SELECT t.id
         FROM planner_tasks t
         JOIN buckets b ON t.bucket_id = b.id
         JOIN plans   p ON b.plan_id   = p.id
        WHERE t.id = ?
          AND t.is_deleted = 0
          AND (
            t.created_by  = ?
            OR t.assigned_to = ?
            OR p.owner_id = ?
          )`,
      [taskId, userId, userId, userId]
    );

    return tasks && tasks.length > 0;
  } catch (error) {
    console.error('[PlannerService] checkTaskOwnership error:', error);
    throw error;
  }
}

/**
 * Check if a user has access to a specific plan.
 * 
 * Access rules:
 * - Admin: Can access any plan
 * - Plan owner: Always has access
 * - Plan members: Check plan_members table for membership
 * - Private plans: Only owner and members
 * - Shared plans: Owner and members
 * 
 * @param {number} planId - The plan ID to check
 * @param {number} userId - The user ID attempting to access the plan
 * @param {string} userRole - The user's role (Admin, Recruiter, HR Intern)
 * @param {Object} db - Database connection (optional, uses default query if not provided)
 * @returns {Promise<boolean>} True if user has access, false otherwise
 * 
 * @example
 * const hasAccess = await checkPlanAccess(planId, req.user.id, req.user.role, db);
 * if (!hasAccess) {
 *   return res.status(403).json({ message: 'Access denied to this plan' });
 * }
 */
export async function checkPlanAccess(planId, userId, userRole, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  try {
    // Admin has access to all plans (R15.2)
    if (userRole === 'Admin') {
      return true;
    }

    // Check if user is plan owner
    const plans = await queryFn(
      'SELECT id FROM plans WHERE id = ? AND owner_id = ? AND is_deleted = 0',
      [planId, userId]
    );

    if (plans && plans.length > 0) {
      return true;
    }

    // Check if user is a plan member
    const members = await queryFn(
      'SELECT id FROM plan_members WHERE plan_id = ? AND user_id = ?',
      [planId, userId]
    );

    return members && members.length > 0;
  } catch (error) {
    console.error('[PlannerService] checkPlanAccess error:', error);
    throw error;
  }
}

/**
 * Check if moving a task to a target bucket crosses plan boundaries.
 * 
 * Cross-plan moves are not allowed for data integrity (R11.9).
 * This function validates that the task and target bucket belong to the same plan.
 * 
 * @param {number} taskId - The task being moved
 * @param {number} targetBucketId - The destination bucket
 * @param {Object} db - Database connection (optional, uses default query if not provided)
 * @returns {Promise<Object>} { allowed: boolean, reason?: string }
 * 
 * @example
 * const moveCheck = await checkCrossPlanMove(taskId, targetBucketId, db);
 * if (!moveCheck.allowed) {
 *   return res.status(400).json({ message: moveCheck.reason });
 * }
 */
export async function checkCrossPlanMove(taskId, targetBucketId, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  try {
    // Get the task's current bucket and plan
    const tasks = await queryFn(
      `SELECT t.id, t.bucket_id, b.plan_id as current_plan_id
       FROM planner_tasks t
       JOIN buckets b ON t.bucket_id = b.id
       WHERE t.id = ? AND t.is_deleted = 0`,
      [taskId]
    );

    if (!tasks || tasks.length === 0) {
      return { allowed: false, reason: 'Task not found' };
    }

    const task = tasks[0];

    // Get the target bucket's plan
    const targetBuckets = await queryFn(
      'SELECT id, plan_id FROM buckets WHERE id = ? AND is_deleted = 0',
      [targetBucketId]
    );

    if (!targetBuckets || targetBuckets.length === 0) {
      return { allowed: false, reason: 'Target bucket not found' };
    }

    const targetBucket = targetBuckets[0];

    // Check if plans match (R11.9)
    if (task.current_plan_id !== targetBucket.plan_id) {
      return { 
        allowed: false, 
        reason: 'Cannot move task across plans. Task and target bucket must be in the same plan.' 
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('[PlannerService] checkCrossPlanMove error:', error);
    throw error;
  }
}

// Default export with all functions
export default {
  checkAssignmentPermission,
  logActivity,
  checkTaskOwnership,
  checkPlanAccess,
  checkCrossPlanMove
};
