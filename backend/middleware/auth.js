import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import config from '../config/config.js';

// Verify JWT token
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from database
    const users = await query(
      'SELECT id, username, email, name, role, status FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = users[0];
    
    if (user.status !== 'Active') {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is not active' 
      });
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

    req.user = {
      ...user,
      permissions: permissions.map(p => ({
        module: p.module,
        actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions
      })),
      interviewerProfile
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

// Check user permissions
export const checkPermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Admin has all permissions
    if (req.user.role === 'Admin') {
      return next();
    }

    // Check if user has the required permission
    const hasPermission = req.user.permissions.some(permission => 
      permission.module === module && 
      permission.actions.includes(action)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        success: false, 
        message: `Insufficient permissions. Required: ${module}:${action}` 
      });
    }

    next();
  };
};

// Check if user is admin
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  next();
};

// Check if user can access resource (own data or admin)
export const canAccessResource = (resourceUserIdField = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Admin can access all resources
    if (req.user.role === 'Admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (resourceUserId && resourceUserId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to this resource' 
      });
    }

    next();
  };
};

