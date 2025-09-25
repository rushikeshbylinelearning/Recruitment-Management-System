import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission, requireAdmin } from '../middleware/auth.js';
import { validateUser, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Helper function to get default permissions for a role
const getDefaultPermissions = (role) => {
  const rolePermissions = {
    'Admin': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'candidates', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'communications', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'tasks', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'team', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'analytics', actions: ['view'] },
      { module: 'settings', actions: ['view', 'edit'] },
    ],
    'HR Manager': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit'] },
      { module: 'candidates', actions: ['view', 'create', 'edit'] },
      { module: 'communications', actions: ['view', 'create', 'edit'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view'] },
      { module: 'analytics', actions: ['view'] },
    ],
    'Team Lead': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'edit'] },
      { module: 'candidates', actions: ['view', 'edit'] },
      { module: 'communications', actions: ['view', 'create', 'edit'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view'] },
      { module: 'analytics', actions: ['view'] },
    ],
    'Recruiter': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view'] },
      { module: 'candidates', actions: ['view', 'edit'] },
      { module: 'communications', actions: ['view', 'create'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'analytics', actions: ['view'] },
    ],
    'Interviewer': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'candidates', actions: ['view'] },
      { module: 'communications', actions: ['view'] },
      { module: 'tasks', actions: ['view', 'edit'] },
    ],
  };
  
  return rolePermissions[role] || [];
};

// Get all users (Admin/HR Manager only)
router.get('/', authenticateToken, checkPermission('team', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  // Ensure limit and offset are numbers
  const limitNum = Number(limit);
  const offsetNum = Number(offset);
  const search = req.query.search || '';

  let whereClause = '';
  let params = [];

  if (search) {
    whereClause = 'WHERE name LIKE ? OR email LIKE ? OR username LIKE ?';
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM users ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get users - build the query dynamically to avoid parameter issues
  let usersQuery = `SELECT id, username, email, name, role, avatar, status, last_login, created_at, updated_at 
     FROM users ${whereClause} 
     ORDER BY created_at DESC 
     LIMIT ${limitNum} OFFSET ${offsetNum}`;
  
  const users = await query(usersQuery, params);

  // Get permissions for each user
  for (let user of users) {
    const permissions = await query(
      'SELECT module, actions FROM permissions WHERE user_id = ?',
      [user.id]
    );
    user.permissions = permissions.map(p => ({
      module: p.module,
      actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions
    }));

    // Get interviewer profile if applicable
    if (user.role === 'Interviewer') {
      const profiles = await query(
        'SELECT * FROM interviewer_profiles WHERE user_id = ?',
        [user.id]
      );
      user.interviewerProfile = profiles.length > 0 ? profiles[0] : null;
    }
  }

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Create new user (Admin/HR Manager only)
router.post('/', authenticateToken, checkPermission('team', 'create'), validateUser, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, email, name, password, role, avatar, status } = req.body;

  // Check if username or email already exists
  const existingUsers = await query(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );

  if (existingUsers.length > 0) {
    throw new ConflictError('Username or email already exists');
  }

  // Hash password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Insert new user
  const result = await query(
    'INSERT INTO users (username, email, name, password_hash, role, avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [username, email, name, hashedPassword, role, avatar || null, status || 'Active']
  );

  const userId = result.insertId;

  // Set default permissions based on role
  const defaultPermissions = getDefaultPermissions(role);
  for (const permission of defaultPermissions) {
    await query(
      'INSERT INTO permissions (user_id, module, actions) VALUES (?, ?, ?)',
      [userId, permission.module, JSON.stringify(permission.actions)]
    );
  }

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { userId }
  });
}));

// Get user by ID
router.get('/:id', authenticateToken, checkPermission('team', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const users = await query(
    `SELECT id, username, email, name, role, avatar, status, last_login, created_at, updated_at 
     FROM users WHERE id = ?`,
    [userId]
  );

  if (users.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = users[0];

  // Get permissions
  const permissions = await query(
    'SELECT module, actions FROM permissions WHERE user_id = ?',
    [user.id]
  );
  user.permissions = permissions.map(p => ({
    module: p.module,
    actions: JSON.parse(p.actions)
  }));

  // Get interviewer profile if applicable
  if (user.role === 'Interviewer') {
    const profiles = await query(
      'SELECT * FROM interviewer_profiles WHERE user_id = ?',
      [user.id]
    );
    user.interviewerProfile = profiles.length > 0 ? profiles[0] : null;
  }

  // Get user statistics
  const stats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'Completed') as tasks_completed,
       (SELECT COUNT(*) FROM candidates WHERE assigned_to = ?) as candidates_processed,
       (SELECT COUNT(*) FROM job_assignments WHERE user_id = ?) as assigned_jobs`,
    [userId, userId, userId]
  );

  user.statistics = stats[0];

  res.json({
    success: true,
    data: { user }
  });
}));

// Update user
router.put('/:id', authenticateToken, checkPermission('team', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { username, email, name, role, avatar, status } = req.body;

  // Debug log
  console.log('Update user request body:', req.body);
  console.log('Parsed fields:', { username, email, name, role, avatar, status });

  // Validate required fields for update
  if (!username || !email || !name || !role) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: [
        { field: 'required', message: 'Username, email, name, and role are required' }
      ]
    });
  }

  // Check if user exists
  const existingUsers = await query('SELECT id FROM users WHERE id = ?', [userId]);
  if (existingUsers.length === 0) {
    throw new NotFoundError('User not found');
  }

  // Check if username or email is already taken by another user
  const conflictUsers = await query(
    'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
    [username, email, userId]
  );

  if (conflictUsers.length > 0) {
    throw new ConflictError('Username or email already exists');
  }

  // Update user - ensure no undefined values
  const updateParams = [
    username,
    email, 
    name,
    role,
    avatar || null,
    status || 'Active', // Default status if not provided
    userId
  ];

  await query(
    'UPDATE users SET username = ?, email = ?, name = ?, role = ?, avatar = ?, status = ?, updated_at = NOW() WHERE id = ?',
    updateParams
  );

  res.json({
    success: true,
    message: 'User updated successfully'
  });
}));

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Check if user exists
  const existingUsers = await query('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (existingUsers.length === 0) {
    throw new NotFoundError('User not found');
  }

  // Prevent deleting admin users
  if (existingUsers[0].role === 'Admin') {
    throw new ValidationError('Cannot delete admin users');
  }

  // Delete user (cascading will handle related records)
  await query('DELETE FROM users WHERE id = ?', [userId]);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

// Update user permissions
router.put('/:id/permissions', authenticateToken, checkPermission('team', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    throw new ValidationError('Permissions must be an array');
  }

  // Check if user exists
  const existingUsers = await query('SELECT id FROM users WHERE id = ?', [userId]);
  if (existingUsers.length === 0) {
    throw new NotFoundError('User not found');
  }

  // Delete existing permissions
  await query('DELETE FROM permissions WHERE user_id = ?', [userId]);

  // Insert new permissions
  for (const permission of permissions) {
    if (permission.module && permission.actions && Array.isArray(permission.actions)) {
      await query(
        'INSERT INTO permissions (user_id, module, actions) VALUES (?, ?, ?)',
        [userId, permission.module, JSON.stringify(permission.actions)]
      );
    }
  }

  res.json({
    success: true,
    message: 'Permissions updated successfully'
  });
}));

// Update interviewer profile
router.put('/:id/interviewer-profile', authenticateToken, checkPermission('team', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { department, expertise, interviewTypes } = req.body;

  // Check if user exists and is an interviewer
  const users = await query('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (users.length === 0) {
    throw new NotFoundError('User not found');
  }

  if (users[0].role !== 'Interviewer') {
    throw new ValidationError('User is not an interviewer');
  }

  // Check if profile exists
  const existingProfiles = await query('SELECT id FROM interviewer_profiles WHERE user_id = ?', [userId]);

  if (existingProfiles.length > 0) {
    // Update existing profile
    await query(
      'UPDATE interviewer_profiles SET department = ?, expertise = ?, interview_types = ?, updated_at = NOW() WHERE user_id = ?',
      [department, JSON.stringify(expertise || []), JSON.stringify(interviewTypes || []), userId]
    );
  } else {
    // Create new profile
    await query(
      'INSERT INTO interviewer_profiles (user_id, department, expertise, interview_types, total_interviews, average_rating) VALUES (?, ?, ?, ?, 0, 0.00)',
      [userId, department, JSON.stringify(expertise || []), JSON.stringify(interviewTypes || [])]
    );
  }

  res.json({
    success: true,
    message: 'Interviewer profile updated successfully'
  });
}));

// Get user dashboard data
router.get('/:id/dashboard', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Check if user can access this data (own data or admin/hr manager)
  if (req.user.id !== userId && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('Access denied');
  }

  // Get user tasks
  const tasks = await query(
    `SELECT id, title, description, priority, status, due_date, created_at 
     FROM tasks 
     WHERE assigned_to = ? 
     ORDER BY due_date ASC 
     LIMIT 10`,
    [userId]
  );

  // Get user candidates
  const candidates = await query(
    `SELECT id, name, position, stage, applied_date, score 
     FROM candidates 
     WHERE assigned_to = ? 
     ORDER BY applied_date DESC 
     LIMIT 10`,
    [userId]
  );

  // Get upcoming interviews
  const interviews = await query(
    `SELECT i.id, i.scheduled_date, i.type, i.status, c.name as candidate_name, c.position
     FROM interviews i
     JOIN candidates c ON i.candidate_id = c.id
     WHERE i.interviewer_id = ? AND i.status = 'Scheduled' AND i.scheduled_date > NOW()
     ORDER BY i.scheduled_date ASC
     LIMIT 10`,
    [userId]
  );

  // Get statistics
  const stats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'Completed') as tasks_completed,
       (SELECT COUNT(*) FROM candidates WHERE assigned_to = ?) as candidates_processed,
       (SELECT COUNT(*) FROM job_assignments WHERE user_id = ?) as assigned_jobs,
       (SELECT COUNT(*) FROM interviews WHERE interviewer_id = ? AND status = 'Completed') as interviews_completed`,
    [userId, userId, userId, userId]
  );

  res.json({
    success: true,
    data: {
      tasks,
      candidates,
      interviews,
      statistics: stats[0]
    }
  });
}));

export default router;

