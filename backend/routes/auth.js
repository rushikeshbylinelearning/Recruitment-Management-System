import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { query, transaction } from '../config/database.js';
import config from '../config/config.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUser, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, ValidationError, UnauthorizedError, ConflictError } from '../middleware/errorHandler.js';

const router = express.Router();

// Rate limiting for login attempts only
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // Limit each IP to 5 login requests per windowMs
//   message: {
//     success: false,
//     message: 'Too many login attempts from this IP, please try again after 15 minutes.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Login endpoint with rate limiting
router.post('/login', 
  // loginLimiter, 
  asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ValidationError('Username and password are required');
  }

  // Find user by username or email
  const users = await query(
    `SELECT id, username, email, name, password_hash, role, status, last_login 
     FROM users 
     WHERE (username = ? OR email = ?) AND status = 'Active'`,
    [username, username]
  );

  if (users.length === 0) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const user = users[0];

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Get user permissions
  const permissions = await query(
    'SELECT module, actions FROM permissions WHERE user_id = ?',
    [user.id]
  );

  // Get interviewer profile if applicable
  let interviewerProfile = null;
  if (user.role === 'Interviewer') {
    const profiles = await query(
      'SELECT * FROM interviewer_profiles WHERE user_id = ?',
      [user.id]
    );
    interviewerProfile = profiles.length > 0 ? profiles[0] : null;
  }

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  // Update last login
  await query(
    'UPDATE users SET last_login = NOW() WHERE id = ?',
    [user.id]
  );

  // Remove password from response
  const { password_hash, ...userWithoutPassword } = user;

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        ...userWithoutPassword,
        permissions: permissions.map(p => ({
          module: p.module,
          actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions
        })),
        interviewerProfile
      },
      token
    }
  });
}));

// Self-registration endpoint (no authentication required)
router.post('/register', validateUser, handleValidationErrors, asyncHandler(async (req, res) => {
  // Self-registration - no permission check required

  const { username, email, name, password, role, avatar } = req.body;
  
  // Normalize role to match database enum values
  const roleMap = {
    'admin': 'Admin',
    'hr manager': 'HR Manager',
    'hr': 'HR Manager',
    'team lead': 'Team Lead',
    'lead': 'Team Lead',
    'recruiter': 'Recruiter',
    'interviewer': 'Interviewer'
  };
  
  const normalizedRole = roleMap[role.toLowerCase()] || role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  // Check if username or email already exists
  const existingUsers = await query(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );

  if (existingUsers.length > 0) {
    throw new ConflictError('Username or email already exists');
  }

  // Hash password
  const saltRounds = config.security.bcryptRounds;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user in transaction
  const result = await transaction(async (connection) => {
    // Insert user
    const [userResult] = await connection.execute(
      `INSERT INTO users (username, email, name, password_hash, role, avatar, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [username, email, name, passwordHash, normalizedRole, avatar || null]
    );

    const userId = userResult.insertId;

    // Set default permissions based on role
    const defaultPermissions = getDefaultPermissions(normalizedRole);
    for (const permission of defaultPermissions) {
      await connection.execute(
        'INSERT INTO permissions (user_id, module, actions) VALUES (?, ?, ?)',
        [userId, permission.module, JSON.stringify(permission.actions)]
      );
    }

    // Create interviewer profile if role is Interviewer
    if (role === 'Interviewer') {
      await connection.execute(
        `INSERT INTO interviewer_profiles (user_id, department, expertise, interview_types, total_interviews, average_rating) 
         VALUES (?, ?, ?, ?, 0, 0.00)`,
        [userId, '', JSON.stringify([]), JSON.stringify([])]
      );
    }

    return userId;
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      userId: result
    }
  });
}));

// Change password endpoint
router.post('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters long');
  }

  // Get current user with password
  const users = await query(
    'SELECT password_hash FROM users WHERE id = ?',
    [req.user.id]
  );

  if (users.length === 0) {
    throw new UnauthorizedError('User not found');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Hash new password
  const saltRounds = config.security.bcryptRounds;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await query(
    'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
    [newPasswordHash, req.user.id]
  );

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// Get current user profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const users = await query(
    `SELECT id, username, email, name, role, avatar, status, last_login, created_at 
     FROM users WHERE id = ?`,
    [req.user.id]
  );

  if (users.length === 0) {
    throw new UnauthorizedError('User not found');
  }

  const user = users[0];

  // Get permissions
  const permissions = await query(
    'SELECT module, actions FROM permissions WHERE user_id = ?',
    [user.id]
  );

  // Get interviewer profile if applicable
  let interviewerProfile = null;
  if (user.role === 'Interviewer') {
    const profiles = await query(
      'SELECT * FROM interviewer_profiles WHERE user_id = ?',
      [user.id]
    );
    interviewerProfile = profiles.length > 0 ? profiles[0] : null;
  }

  res.json({
    success: true,
    data: {
      user: {
        ...user,
        permissions: permissions.map(p => ({
          module: p.module,
          actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions
        })),
        interviewerProfile
      }
    }
  });
}));

// Update user profile
router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const { name, email, avatar } = req.body;

  if (!name || !email) {
    throw new ValidationError('Name and email are required');
  }

  // Check if email is already taken by another user
  const existingUsers = await query(
    'SELECT id FROM users WHERE email = ? AND id != ?',
    [email, req.user.id]
  );

  if (existingUsers.length > 0) {
    throw new ConflictError('Email already exists');
  }

  // Update user profile
  await query(
    'UPDATE users SET name = ?, email = ?, avatar = ?, updated_at = NOW() WHERE id = ?',
    [name, email, avatar || null, req.user.id]
  );

  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
}));

// Logout endpoint (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  // Since we're using JWT, logout is handled client-side by removing the token
  // In a more secure implementation, you might want to maintain a blacklist of tokens
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Verify token endpoint
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

// Helper function to get default permissions based on role
function getDefaultPermissions(role) {
  const permissions = {
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
      { module: 'jobs', actions: ['view'] },
      { module: 'candidates', actions: ['view'] },
      { module: 'tasks', actions: ['view'] },
      { module: 'team', actions: ['view'] },
      { module: 'interviews', actions: ['view', 'edit'] },
    ]
  };

  return permissions[role] || [];
}

export default router;

