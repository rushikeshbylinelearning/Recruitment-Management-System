import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission, requireAdmin } from '../middleware/auth.js';
import { validateId, validatePagination, validateEmailTemplate, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get system settings
router.get('/system', authenticateToken, checkPermission('settings', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const settings = await query('SELECT * FROM system_settings ORDER BY setting_key', []);

  const formattedSettings = {};
  settings.forEach(setting => {
    try {
      formattedSettings[setting.setting_key] = JSON.parse(setting.setting_value);
    } catch (e) {
      formattedSettings[setting.setting_key] = setting.setting_value;
    }
  });

  res.json({
    success: true,
    data: { settings: formattedSettings }
  });
}));

// Update system settings
router.put('/system', authenticateToken, requireAdmin, handleValidationErrors, asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    throw new ValidationError('Settings object is required');
  }

  // Update each setting
  for (const [key, value] of Object.entries(settings)) {
    await query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_by) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       setting_value = VALUES(setting_value), 
       updated_by = VALUES(updated_by), 
       updated_at = NOW()`,
      [key, JSON.stringify(value), req.user.id]
    );
  }

  res.json({
    success: true,
    message: 'System settings updated successfully'
  });
}));

// Get email templates
router.get('/email-templates', authenticateToken, checkPermission('settings', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt((page - 1) * limit);
  const type = req.query.type || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (type) {
    whereClause += ' AND type = ?';
    params.push(type);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM email_templates ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get templates
  const templates = await query(
    `SELECT et.*, u.name as created_by_name 
     FROM email_templates et
     LEFT JOIN users u ON et.created_by = u.id
     ${whereClause}
     ORDER BY et.created_at DESC 
     LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
    params
  );

  res.json({
    success: true,
    data: {
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get email template by ID
router.get('/email-templates/:id', authenticateToken, checkPermission('settings', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const templateId = req.params.id;

  const templates = await query(
    `SELECT et.*, u.name as created_by_name 
     FROM email_templates et
     LEFT JOIN users u ON et.created_by = u.id
     WHERE et.id = ?`,
    [templateId]
  );

  if (templates.length === 0) {
    throw new NotFoundError('Email template not found');
  }

  res.json({
    success: true,
    data: { template: templates[0] }
  });
}));

// Create email template
router.post('/email-templates', authenticateToken, checkPermission('settings', 'edit'), validateEmailTemplate, handleValidationErrors, asyncHandler(async (req, res) => {
  console.log('🔍 DEBUG: Email template creation request received');
  console.log('Request body:', req.body);
  console.log('User:', req.user);
  console.log('Headers:', req.headers);
  
  const { name, subject, content, category, variables = [], isActive = true } = req.body;

  if (!name || !subject || !content || !category) {
    throw new ValidationError('Name, subject, content, and category are required');
  }

  const validCategories = ['Interview Invite', 'Rejection', 'Offer', 'Follow-up', 'Custom'];
  if (!validCategories.includes(category)) {
    throw new ValidationError('Invalid template category');
  }

  const result = await query(
    `INSERT INTO email_templates (name, subject, body, type, variables, is_active, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, subject, content, category, JSON.stringify(variables), isActive, req.user.id]
  );

  res.status(201).json({
    success: true,
    message: 'Email template created successfully',
    data: {
      templateId: result.insertId
    }
  });
}));

// Update email template
router.put('/email-templates/:id', authenticateToken, checkPermission('settings', 'edit'), validateId('id'), validateEmailTemplate, handleValidationErrors, asyncHandler(async (req, res) => {
  const templateId = req.params.id;
  const { name, subject, content, category, variables = [], isActive } = req.body;

  // Check if template exists
  const existingTemplates = await query('SELECT id FROM email_templates WHERE id = ?', [templateId]);
  if (existingTemplates.length === 0) {
    throw new NotFoundError('Email template not found');
  }

  if (!name || !subject || !content || !category) {
    throw new ValidationError('Name, subject, content, and category are required');
  }

  const validCategories = ['Interview Invite', 'Rejection', 'Offer', 'Follow-up', 'Custom'];
  if (!validCategories.includes(category)) {
    throw new ValidationError('Invalid template category');
  }

  await query(
    `UPDATE email_templates SET name = ?, subject = ?, body = ?, type = ?, variables = ?, is_active = ?, updated_at = NOW() 
     WHERE id = ?`,
    [name, subject, content, category, JSON.stringify(variables), isActive, templateId]
  );

  res.json({
    success: true,
    message: 'Email template updated successfully'
  });
}));

// Delete email template
router.delete('/email-templates/:id', authenticateToken, requireAdmin, validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const templateId = req.params.id;

  // Check if template exists
  const existingTemplates = await query('SELECT id FROM email_templates WHERE id = ?', [templateId]);
  if (existingTemplates.length === 0) {
    throw new NotFoundError('Email template not found');
  }

  await query('DELETE FROM email_templates WHERE id = ?', [templateId]);

  res.json({
    success: true,
    message: 'Email template deleted successfully'
  });
}));

// Get role permissions
router.get('/role-permissions', authenticateToken, checkPermission('settings', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const roles = ['Admin', 'HR Manager', 'Recruiter', 'Interviewer'];
  
  const rolePermissions = {};
  
  for (const role of roles) {
    const users = await query('SELECT id FROM users WHERE role = ? LIMIT 1', [role]);
    if (users.length > 0) {
      const permissions = await query(
        'SELECT module, actions FROM permissions WHERE user_id = ?',
        [users[0].id]
      );
      rolePermissions[role] = permissions.map(p => ({
        module: p.module,
        actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions
      }));
    }
  }

  res.json({
    success: true,
    data: { rolePermissions }
  });
}));

// Update role permissions
router.put('/role-permissions', authenticateToken, requireAdmin, handleValidationErrors, asyncHandler(async (req, res) => {
  const { rolePermissions } = req.body;

  if (!rolePermissions || typeof rolePermissions !== 'object') {
    throw new ValidationError('Role permissions object is required');
  }

  // Update permissions for each role
  for (const [role, permissions] of Object.entries(rolePermissions)) {
    const users = await query('SELECT id FROM users WHERE role = ?', [role]);
    
    for (const user of users) {
      // Delete existing permissions
      await query('DELETE FROM permissions WHERE user_id = ?', [user.id]);
      
      // Insert new permissions
      for (const permission of permissions) {
        if (permission.module && permission.actions && Array.isArray(permission.actions)) {
          await query(
            'INSERT INTO permissions (user_id, module, actions) VALUES (?, ?, ?)',
            [user.id, permission.module, JSON.stringify(permission.actions)]
          );
        }
      }
    }
  }

  res.json({
    success: true,
    message: 'Role permissions updated successfully'
  });
}));

// Get system health
router.get('/health', authenticateToken, checkPermission('settings', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get database statistics
  const dbStats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM users) as total_users,
       (SELECT COUNT(*) FROM job_postings) as total_jobs,
       (SELECT COUNT(*) FROM candidates) as total_candidates,
       (SELECT COUNT(*) FROM interviews) as total_interviews,
       (SELECT COUNT(*) FROM tasks) as total_tasks,
       (SELECT COUNT(*) FROM communications) as total_communications`,
    []
  );

  // Get recent activity
  const recentActivity = await query(
    `SELECT 
       'user' as type, COUNT(*) as count, 'Last 24 hours' as period
     FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
     UNION ALL
     SELECT 
       'candidate' as type, COUNT(*) as count, 'Last 24 hours' as period
     FROM candidates WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
     UNION ALL
     SELECT 
       'interview' as type, COUNT(*) as count, 'Last 24 hours' as period
     FROM interviews WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    []
  );

  res.json({
    success: true,
    data: {
      database: dbStats[0],
      recentActivity
    }
  });
}));

// Export data
router.post('/export', authenticateToken, requireAdmin, handleValidationErrors, asyncHandler(async (req, res) => {
  const { dataType } = req.body;

  if (!dataType) {
    throw new ValidationError('Data type is required');
  }

  const validTypes = ['users', 'jobs', 'candidates', 'interviews', 'tasks', 'communications'];
  if (!validTypes.includes(dataType)) {
    throw new ValidationError('Invalid data type');
  }

  let data;
  let filename;

  switch (dataType) {
    case 'users':
      data = await query(
        `SELECT id, username, email, name, role, status, created_at, updated_at 
         FROM users ORDER BY created_at DESC`,
        []
      );
      filename = `users_export_${new Date().toISOString().split('T')[0]}.json`;
      break;
    
    case 'jobs':
      data = await query(
        `SELECT * FROM job_postings ORDER BY created_at DESC`,
        []
      );
      filename = `jobs_export_${new Date().toISOString().split('T')[0]}.json`;
      break;
    
    case 'candidates':
      data = await query(
        `SELECT * FROM candidates ORDER BY created_at DESC`,
        []
      );
      filename = `candidates_export_${new Date().toISOString().split('T')[0]}.json`;
      break;
    
    case 'interviews':
      data = await query(
        `SELECT * FROM interviews ORDER BY created_at DESC`,
        []
      );
      filename = `interviews_export_${new Date().toISOString().split('T')[0]}.json`;
      break;
    
    case 'tasks':
      data = await query(
        `SELECT * FROM tasks ORDER BY created_at DESC`,
        []
      );
      filename = `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
      break;
    
    case 'communications':
      data = await query(
        `SELECT * FROM communications ORDER BY created_at DESC`,
        []
      );
      filename = `communications_export_${new Date().toISOString().split('T')[0]}.json`;
      break;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json({
    success: true,
    data: {
      exportDate: new Date().toISOString(),
      recordCount: data.length,
      records: data
    }
  });
}));

export default router;