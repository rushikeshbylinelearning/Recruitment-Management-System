import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import activityLogger from '../services/activityLogger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/form-builder/forms - Get all forms with analytics
router.get('/forms', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = 'WHERE f.name LIKE ? OR f.description LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }

    const forms = await query(
      `SELECT f.*, j.title as job_title, u.name as created_by_name,
        (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.id) as submission_count,
        (SELECT COUNT(*) FROM form_fields WHERE form_id = f.id AND is_active = TRUE) as field_count,
        (SELECT COUNT(*) FROM form_analytics WHERE form_id = f.id AND event_type = 'view') as view_count,
        (SELECT COUNT(*) FROM form_analytics WHERE form_id = f.id AND event_type = 'submission') as analytics_submission_count
       FROM forms f
       LEFT JOIN job_postings j ON f.job_id = j.id
       LEFT JOIN users u ON f.created_by = u.id
       ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Calculate conversion rate for each form
    const formsWithAnalytics = forms.map(form => {
      const views = form.view_count || 0;
      const submissions = form.analytics_submission_count || 0;
      const conversion_rate = views > 0 ? ((submissions / views) * 100).toFixed(2) : 0;
      
      return {
        ...form,
        analytics: {
          views,
          submissions,
          conversion_rate: parseFloat(conversion_rate)
        }
      };
    });

    const [{ total }] = await query(
      `SELECT COUNT(*) as total FROM forms f ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        forms: formsWithAnalytics,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forms'
    });
  }
});

// GET /api/form-builder/forms/:id - Get form by ID with fields
router.get('/forms/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [form] = await query(
      `SELECT f.*, j.title as job_title, u.name as created_by_name
       FROM forms f
       LEFT JOIN job_postings j ON f.job_id = j.id
       LEFT JOIN users u ON f.created_by = u.id
       WHERE f.id = ?`,
      [id]
    );

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    const fields = await query(
      `SELECT * FROM form_fields WHERE form_id = ? ORDER BY order_index ASC`,
      [id]
    );

    // Parse JSON fields
    const parsedFields = fields.map(field => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null,
      validation_rules: field.validation_rules ? JSON.parse(field.validation_rules) : null
    }));

    const mappings = await query(
      `SELECT * FROM form_field_mappings WHERE form_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        form,
        fields: parsedFields,
        mappings
      }
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch form'
    });
  }
});

// POST /api/form-builder/forms - Create new form
router.post('/forms',
  [
    body('name').trim().notEmpty().withMessage('Form name is required'),
    body('slug').trim().notEmpty().withMessage('Form slug is required')
      .matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('description').optional().trim(),
    body('job_id').optional({ nullable: true }).isInt(),
    body('token_validity_hours')
      .optional()
      .isInt({ min: 1, max: 720 })
      .withMessage('Token validity must be between 1 and 720 hours')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { name, slug, description, job_id, token_validity_hours } = req.body;
      const userId = req.user.id;
      const parsedTokenValidity = parseInt(token_validity_hours, 10);
      const tokenValidityHours = Number.isNaN(parsedTokenValidity) ? 24 : parsedTokenValidity;

      // Check if slug already exists
      const [existing] = await query(
        'SELECT id FROM forms WHERE slug = ?',
        [slug]
      );

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A form with this slug already exists'
        });
      }

      // Generate access token
      const accessToken = crypto.randomBytes(32).toString('hex');

      const result = await query(
        `INSERT INTO forms (name, slug, description, job_id, access_token, token_validity_hours, token_expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?)`,
        [
          name,
          slug,
          description || null,
          job_id || null,
          accessToken,
          tokenValidityHours,
          tokenValidityHours,
          userId
        ]
      );

      // Log form creation activity
      await activityLogger.log({
        entityType: 'form',
        entityId: result.insertId,
        actionType: 'form_created',
        description: `Form "${name}" created`,
        metadata: {
          formId: result.insertId,
          formName: name,
          slug,
          jobId: job_id || null,
          tokenValidityHours
        },
        createdBy: userId
      });

      res.status(201).json({
        success: true,
        message: 'Form created successfully',
        data: {
          formId: result.insertId,
          accessToken
        }
      });
    } catch (error) {
      console.error('Error creating form:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create form'
      });
    }
  }
);

// PUT /api/form-builder/forms/:id - Update form
router.put('/forms/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean(),
    body('job_id').optional(),
    body('token_validity_hours')
      .optional()
      .isInt({ min: 1, max: 720 })
      .withMessage('Token validity must be between 1 and 720 hours')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, is_active, job_id, token_validity_hours } = req.body;

      const updates = [];
      const params = [];
      const changedFields = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
        changedFields.push('name');
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
        changedFields.push('description');
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
        changedFields.push('is_active');
      }
      if (job_id !== undefined) {
        updates.push('job_id = ?');
        params.push(job_id || null);
        changedFields.push('job_id');
      }
      if (token_validity_hours !== undefined) {
        updates.push('token_validity_hours = ?');
        params.push(token_validity_hours);
        updates.push('token_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)');
        params.push(token_validity_hours);
        changedFields.push('token_validity_hours');
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      params.push(id);

      await query(
        `UPDATE forms SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      // Log form modification activity
      await activityLogger.log({
        entityType: 'form',
        entityId: id,
        actionType: 'form_modified',
        description: `Form updated`,
        metadata: {
          formId: id,
          changedFields,
          updates: { name, description, is_active, job_id, token_validity_hours }
        },
        createdBy: req.user.id
      });

      // If form was deactivated, log that specifically
      if (is_active === false) {
        await activityLogger.log({
          entityType: 'form',
          entityId: id,
          actionType: 'form_deactivated',
          description: `Form deactivated`,
          metadata: {
            formId: id
          },
          createdBy: req.user.id
        });
      }

      res.json({
        success: true,
        message: 'Form updated successfully'
      });
    } catch (error) {
      console.error('Error updating form:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update form'
      });
    }
  }
);

// DELETE /api/form-builder/forms/:id - Delete form
router.delete('/forms/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get form name before deletion for logging
    const [form] = await query('SELECT name FROM forms WHERE id = ?', [id]);
    
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    await query('DELETE FROM forms WHERE id = ?', [id]);

    // Log form deletion activity
    await activityLogger.log({
      entityType: 'form',
      entityId: id,
      actionType: 'form_deleted',
      description: `Form "${form.name}" deleted`,
      metadata: {
        formId: id,
        formName: form.name
      },
      createdBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Form deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete form'
    });
  }
});

// POST /api/form-builder/forms/:id/generate-share-link
// Generates a unique shareable link token for this form.
// Each call produces a distinct token so every distributed link is unique.
router.post('/forms/:id/generate-share-link', async (req, res) => {
  try {
    const { id } = req.params;

    const [form] = await query('SELECT id, slug FROM forms WHERE id = ?', [id]);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }

    // Ensure the share tokens table exists
    await query(`
      CREATE TABLE IF NOT EXISTS form_share_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        form_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        used_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        INDEX idx_token (token),
        INDEX idx_form_id (form_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const shareToken = crypto.randomBytes(32).toString('hex');
    // Share links are valid for 30 days by default
    await query(
      `INSERT INTO form_share_tokens (form_id, token, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [id, shareToken]
    );

    // Use FRONTEND_URL env var so the link points to the correct frontend
    // (dev: http://localhost:5173, prod: https://hr.bylinelms.com)
    // Falls back to the request origin only if FRONTEND_URL is not set.
    // When behind a reverse proxy (nginx/Apache), req.protocol may be 'http'
    // even though the public URL is https — use X-Forwarded-Proto to detect the real protocol.
    const detectedProtocol = req.headers['x-forwarded-proto']?.split(',')[0]?.trim() || req.protocol;
    const frontendBase = (process.env.FRONTEND_URL || `${detectedProtocol}://${req.get('host')}`)
      .split(',')[0]   // FRONTEND_URL may be comma-separated; take the first entry
      .trim()
      .replace(/\/$/, ''); // strip trailing slash

    const link = `${frontendBase}/apply/${form.slug}?share=${shareToken}`;
    console.log('[FormBuilder] Generated share link:', link);

    res.json({
      success: true,
      data: { shareToken, link }
    });
  } catch (error) {
    console.error('Error generating share link:', error);
    res.status(500).json({ success: false, message: 'Failed to generate share link' });
  }
});

// GET /api/form-builder/forms/:id/share-links - List all share tokens for a form
router.get('/forms/:id/share-links', async (req, res) => {
  try {
    const { id } = req.params;

    const [form] = await query('SELECT id, slug FROM forms WHERE id = ?', [id]);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }

    const tokens = await query(
      `SELECT id, token, created_at, expires_at, used_count, is_active
       FROM form_share_tokens
       WHERE form_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    const detectedProtocol = req.headers['x-forwarded-proto']?.split(',')[0]?.trim() || req.protocol;
    const frontendBase = (process.env.FRONTEND_URL || `${detectedProtocol}://${req.get('host')}`)
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');

    const links = tokens.map(t => ({
      ...t,
      link: `${frontendBase}/apply/${form.slug}?share=${t.token}`
    }));

    res.json({ success: true, data: { links } });
  } catch (error) {
    console.error('Error fetching share links:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch share links' });
  }
});

// PATCH /api/form-builder/share-links/:tokenId/revoke - Revoke a share token
router.patch('/share-links/:tokenId/revoke', async (req, res) => {
  try {
    const { tokenId } = req.params;
    await query('UPDATE form_share_tokens SET is_active = FALSE WHERE id = ?', [tokenId]);
    res.json({ success: true, message: 'Share link revoked successfully' });
  } catch (error) {
    console.error('Error revoking share link:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke share link' });
  }
});

// POST /api/form-builder/forms/:id/regenerate-token - Regenerate access token
router.post('/forms/:id/regenerate-token', async (req, res) => {
  try {
    const { id } = req.params;
    const newToken = crypto.randomBytes(32).toString('hex');
    const [form] = await query(
      'SELECT token_validity_hours FROM forms WHERE id = ?',
      [id]
    );

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    await query(
      'UPDATE forms SET access_token = ?, token_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id = ?',
      [newToken, form.token_validity_hours || 24, id]
    );

    res.json({
      success: true,
      message: 'Access token regenerated',
      data: { accessToken: newToken }
    });
  } catch (error) {
    console.error('Error regenerating token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate token'
    });
  }
});

// POST /api/form-builder/forms/:id/fields - Add field to form
router.post('/forms/:id/fields',
  [
    body('label').trim().notEmpty().withMessage('Field label is required'),
    body('field_key').trim().notEmpty().withMessage('Field key is required'),
    body('field_type').isIn(['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'file'])
      .withMessage('Invalid field type'),
    body('is_required').optional().isBoolean(),
    body('options').optional().isArray(),
    body('placeholder').optional().trim(),
    body('order_index').optional().isInt()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { label, field_key, field_type, is_required, options, placeholder, order_index, validation_rules } = req.body;

      // Check if field_key already exists for this form
      const [existing] = await query(
        'SELECT id FROM form_fields WHERE form_id = ? AND field_key = ?',
        [id, field_key]
      );

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A field with this key already exists in this form'
        });
      }

      const result = await query(
        `INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, options, placeholder, order_index, validation_rules)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          label,
          field_key,
          field_type,
          is_required || false,
          options ? JSON.stringify(options) : null,
          placeholder || null,
          order_index || 0,
          validation_rules ? JSON.stringify(validation_rules) : null
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Field added successfully',
        data: { fieldId: result.insertId }
      });
    } catch (error) {
      console.error('Error adding field:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add field'
      });
    }
  }
);

// PUT /api/form-builder/fields/:fieldId - Update field
router.put('/fields/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { label, is_required, options, placeholder, order_index, is_active, validation_rules } = req.body;

    const updates = [];
    const params = [];

    if (label !== undefined) {
      updates.push('label = ?');
      params.push(label);
    }
    if (is_required !== undefined) {
      updates.push('is_required = ?');
      params.push(is_required);
    }
    if (options !== undefined) {
      updates.push('options = ?');
      params.push(JSON.stringify(options));
    }
    if (placeholder !== undefined) {
      updates.push('placeholder = ?');
      params.push(placeholder);
    }
    if (order_index !== undefined) {
      updates.push('order_index = ?');
      params.push(order_index);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }
    if (validation_rules !== undefined) {
      updates.push('validation_rules = ?');
      params.push(JSON.stringify(validation_rules));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(fieldId);

    await query(
      `UPDATE form_fields SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Field updated successfully'
    });
  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update field'
    });
    }
});

// DELETE /api/form-builder/fields/:fieldId - Delete field
router.delete('/fields/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;

    await query('DELETE FROM form_fields WHERE id = ?', [fieldId]);

    res.json({
      success: true,
      message: 'Field deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete field'
    });
  }
});

// PUT /api/form-builder/forms/:id/reorder - Reorder form fields
router.put('/forms/:id/reorder',
  [
    body('field_ids').isArray().withMessage('field_ids must be an array'),
    body('field_ids.*').isInt().withMessage('Each field_id must be an integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { field_ids } = req.body;

      // Verify all fields belong to this form
      const fields = await query(
        `SELECT id FROM form_fields WHERE form_id = ? AND id IN (${field_ids.map(() => '?').join(',')})`,
        [id, ...field_ids]
      );

      if (fields.length !== field_ids.length) {
        return res.status(400).json({
          success: false,
          message: 'Some field IDs do not belong to this form'
        });
      }

      // Update order_index for each field
      for (let i = 0; i < field_ids.length; i++) {
        await query(
          'UPDATE form_fields SET order_index = ? WHERE id = ?',
          [i, field_ids[i]]
        );
      }

      res.json({
        success: true,
        message: 'Fields reordered successfully'
      });
    } catch (error) {
      console.error('Error reordering fields:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reorder fields'
      });
    }
  }
);

// GET /api/form-builder/forms/:id/analytics - Get form analytics
router.get('/forms/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;

    const [stats] = await query(
      `SELECT 
        COUNT(DISTINCT CASE WHEN event_type = 'view' THEN id END) as views,
        COUNT(DISTINCT CASE WHEN event_type = 'submission' THEN id END) as submissions,
        COUNT(DISTINCT CASE WHEN event_type = 'error' THEN id END) as errors
       FROM form_analytics
       WHERE form_id = ?`,
      [id]
    );

    const recentActivity = await query(
      `SELECT event_type, created_at, ip_address
       FROM form_analytics
       WHERE form_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json({
      success: true,
      data: {
        stats,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

// GET /api/form-builder/forms/:id/submissions - Get form submissions
router.get('/forms/:id/submissions', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const submissions = await query(
      `SELECT fs.*, c.name as candidate_name, c.email as candidate_email
       FROM form_submissions fs
       LEFT JOIN candidates c ON fs.candidate_id = c.id
       WHERE fs.form_id = ?
       ORDER BY fs.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [id, parseInt(limit), parseInt(offset)]
    );

    const [{ total }] = await query(
      'SELECT COUNT(*) as total FROM form_submissions WHERE form_id = ?',
      [id]
    );

    // Parse submission data
    const parsedSubmissions = submissions.map(sub => ({
      ...sub,
      submission_data: JSON.parse(sub.submission_data)
    }));

    res.json({
      success: true,
      data: {
        submissions: parsedSubmissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
});

export default router;
