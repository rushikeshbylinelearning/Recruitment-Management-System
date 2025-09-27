import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateEmailTemplate, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Get all email templates
router.get('/', authenticateToken, checkPermission('communications', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const category = req.query.category || '';

  try {
    let countQuery, countParams;
    let templatesQuery, templatesParams;

    if (category) {
      // With category filter (using 'type' column)
      countQuery = `SELECT COUNT(*) as total FROM email_templates WHERE type = ?`;
      countParams = [category];
      
      templatesQuery = `SELECT et.*, u.name as created_by_name 
                       FROM email_templates et
                       LEFT JOIN users u ON et.created_by = u.id
                       WHERE et.type = ?
                       ORDER BY et.created_at DESC 
                       LIMIT ${limit} OFFSET ${offset}`;
      templatesParams = [category];
    } else {
      // Without category filter
      countQuery = `SELECT COUNT(*) as total FROM email_templates`;
      countParams = [];
      
      templatesQuery = `SELECT et.*, u.name as created_by_name 
                       FROM email_templates et
                       LEFT JOIN users u ON et.created_by = u.id
                       ORDER BY et.created_at DESC 
                       LIMIT ${limit} OFFSET ${offset}`;
      templatesParams = [];
    }

    // Get total count
    const countResult = await query(countQuery, countParams);
    const total = countResult[0].total;

    // Get templates
    const templates = await query(templatesQuery, templatesParams);

    res.status(200).json({
      success: true,
      message: 'Email templates retrieved successfully',
      data: { 
        templates, 
        total, 
        page, 
        limit 
      }
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email templates',
      error: error.message
    });
  }
}));

// Get email template by ID
router.get('/:id', authenticateToken, checkPermission('communications', 'view'), validateId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const templates = await query(
    `SELECT et.*, u.name as created_by_name 
     FROM email_templates et
     LEFT JOIN users u ON et.created_by = u.id
     WHERE et.id = ?`,
    [id]
  );

  if (templates.length === 0) {
    throw new NotFoundError('Email template not found');
  }

  res.status(200).json({
    success: true,
    message: 'Email template retrieved successfully',
    data: { template: templates[0] }
  });
}));

// Create new email template
router.post('/', authenticateToken, checkPermission('communications', 'create'), validateEmailTemplate, handleValidationErrors, asyncHandler(async (req, res) => {
  const { name, subject, content, category, variables } = req.body;
  const userId = req.user.id;

  // Map category to type for the database
  const typeMapping = {
    'General': 'Custom',
    'Interview': 'Interview Invite',
    'Rejection': 'Rejection',
    'Offer': 'Offer',
    'Follow-up': 'Follow-up'
  };
  
  const type = typeMapping[category] || 'Custom';

  const result = await query(
    `INSERT INTO email_templates (name, subject, body, type, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())`,
    [name, subject, content, type, userId]
  );

  res.status(201).json({
    success: true,
    message: 'Email template created successfully',
    data: { templateId: result.insertId }
  });
}));

// Update email template
router.put('/:id', authenticateToken, checkPermission('communications', 'edit'), validateId, validateEmailTemplate, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, subject, content, category, isActive, variables } = req.body;

  // Check if template exists
  const existingTemplate = await query(
    'SELECT id FROM email_templates WHERE id = ?',
    [id]
  );

  if (existingTemplate.length === 0) {
    throw new NotFoundError('Email template not found');
  }

  await query(
    `UPDATE email_templates 
     SET name = ?, subject = ?, content = ?, category = ?, is_active = ?, variables = ?, updated_at = NOW()
     WHERE id = ?`,
    [name, subject, content, category, isActive !== undefined ? isActive : true, JSON.stringify(variables || []), id]
  );

  res.status(200).json({
    success: true,
    message: 'Email template updated successfully'
  });
}));

// Delete email template
router.delete('/:id', authenticateToken, checkPermission('communications', 'delete'), validateId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if template exists
  const existingTemplate = await query(
    'SELECT id FROM email_templates WHERE id = ?',
    [id]
  );

  if (existingTemplate.length === 0) {
    throw new NotFoundError('Email template not found');
  }

  await query('DELETE FROM email_templates WHERE id = ?', [id]);

  res.status(200).json({
    success: true,
    message: 'Email template deleted successfully'
  });
}));

// Send email template to candidates
router.post('/:id/send', authenticateToken, checkPermission('communications', 'create'), validateId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { candidateIds, customData } = req.body;

  if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
    throw new ValidationError('candidateIds is required and must be a non-empty array');
  }

  // Get template
  const templates = await query(
    'SELECT * FROM email_templates WHERE id = ?',
    [id]
  );

  if (templates.length === 0) {
    throw new NotFoundError('Email template not found');
  }

  const template = templates[0];

  // Get candidates
  const placeholders = candidateIds.map(() => '?').join(',');
  const candidates = await query(
    `SELECT id, name, email, position FROM candidates WHERE id IN (${placeholders})`,
    candidateIds
  );

  const results = [];
  let sent = 0;
  let failed = 0;

  // Send actual emails using the email service
  for (const candidate of candidates) {
    try {
      // Prepare variables for template replacement
      const variables = {
        candidate_name: candidate.name,
        company_name: customData?.company_name || 'Your Company',
        job_title: candidate.position,
        hr_name: req.user.name,
        interview_date: customData?.interview_date || '',
        interview_time: customData?.interview_time || ''
      };

      // Send email using the email service
      const emailResult = await emailService.sendTemplateEmail(
        candidate.email,
        template.subject,
        template.content,
        variables
      );

      if (emailResult.success) {
        // Create communication record
        await query(
          `INSERT INTO communications (candidate_id, type, content, status, created_by, date)
           VALUES (?, 'Email', ?, 'Sent', ?, NOW())`,
          [candidate.id, emailResult.messageId, req.user.id]
        );

        results.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          success: true,
          messageId: emailResult.messageId
        });
        sent++;
      } else {
        results.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          success: false,
          error: emailResult.error
        });
        failed++;
      }
    } catch (error) {
      console.error(`Failed to send email to ${candidate.email}:`, error);
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.name,
        success: false,
        error: error.message
      });
      failed++;
    }
  }

  res.status(200).json({
    success: true,
    message: 'Email template sending completed',
    data: {
      sent,
      failed,
      results
    }
  });
}));

// Get template categories
router.get('/categories', authenticateToken, checkPermission('communications', 'view'), asyncHandler(async (req, res) => {
  const categories = await query(
    `SELECT category as name, COUNT(*) as count 
     FROM email_templates 
     GROUP BY category 
     ORDER BY count DESC`
  );

  res.status(200).json({
    success: true,
    message: 'Template categories retrieved successfully',
    data: { categories }
  });
}));

// Get template variables
router.get('/variables', authenticateToken, checkPermission('communications', 'view'), asyncHandler(async (req, res) => {
  const variables = [
    { name: 'candidate_name', description: 'Candidate\'s full name', example: 'John Doe' },
    { name: 'company_name', description: 'Company name', example: 'Your Company' },
    { name: 'job_title', description: 'Job position title', example: 'Software Engineer' },
    { name: 'interview_date', description: 'Interview date', example: '2024-01-15' },
    { name: 'interview_time', description: 'Interview time', example: '2:00 PM' },
    { name: 'hr_name', description: 'HR representative name', example: 'Jane Smith' }
  ];

  res.status(200).json({
    success: true,
    message: 'Template variables retrieved successfully',
    data: { variables }
  });
}));

export default router;
