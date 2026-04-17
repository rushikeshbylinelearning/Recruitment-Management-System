/**
 * Public Forms API Routes
 * Handles public-facing form access and submission endpoints
 * Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5, 5.2-5.5, 8.1, 9.4, 14.1, 15.1-15.4, 18.1-18.3
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { query } from '../config/database.js';
import { validateToken } from '../middleware/tokenValidator.js';
import { formSubmissionLimiter } from '../middleware/rateLimiter.js';
import validationService from '../services/validationService.js';
import formSubmissionProcessor from '../services/formSubmissionProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/form-submissions');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PDF and DOC files are allowed'));
  }
});

/**
 * GET /api/public/forms/:slug
 * Fetch form configuration with token validation
 * Requirements: 1.2, 1.3, 1.5, 8.1, 9.4, 15.1-15.4
 */
router.get('/forms/:slug', validateToken, async (req, res) => {
  try {
    const form = req.form; // Attached by validateToken middleware

    // Get form fields
    const fields = await query(
      `SELECT id, label, field_key, field_type, is_required, options, placeholder, order_index
       FROM form_fields
       WHERE form_id = ? AND is_active = TRUE
       ORDER BY order_index ASC`,
      [form.id]
    );

    // Parse JSON options for select fields
    const parsedFields = fields.map(field => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null
    }));

    // Get active jobs for Job Profile dropdown (Requirements: 15.1-15.4)
    const jobs = await query(
      `SELECT id, title, department
       FROM job_postings
       WHERE status = 'Active'
       ORDER BY title ASC`
    );

    res.json({
      success: true,
      data: {
        form: {
          id: form.id,
          name: form.name,
          slug: form.slug,
          description: form.description
        },
        fields: parsedFields,
        job_options: jobs
      }
    });
  } catch (error) {
    console.error('[PublicForms] Error fetching form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load form. Please try again later.'
    });
  }
});

/**
 * POST /api/public/forms/:slug/submit
 * Submit form with rate limiting and validation
 * Requirements: 2.1-2.5, 3.1-3.5, 5.2-5.5, 16.1-16.5, 18.1-18.3
 */
router.post('/forms/:slug/submit',
  validateToken,
  formSubmissionLimiter,
  upload.single('resume'),
  async (req, res) => {
    try {
      const form = req.form; // Attached by validateToken middleware
      const formData = req.body;

      // Get form fields for validation
      const fields = await query(
        `SELECT id, label, field_key, field_type, is_required, options
         FROM form_fields
         WHERE form_id = ? AND is_active = TRUE`,
        [form.id]
      );

      // Validate form submission using ValidationService (Requirements: 2.1-2.5)
      const validation = validationService.validateFormSubmission(fields, formData);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      // Check for duplicate email
      const existingCandidates = await query(
        'SELECT id FROM candidates WHERE email = ?',
        [formData.email]
      );

      if (existingCandidates.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A candidate with this email already exists'
        });
      }

      // Sanitize all text inputs (Requirements: 5.4, 5.5, 13.2, 13.3)
      const sanitizedData = {};
      for (const [key, value] of Object.entries(formData)) {
        if (typeof value === 'string') {
          sanitizedData[key] = validationService.sanitizeText(value);
        } else {
          sanitizedData[key] = value;
        }
      }

      // Process submission using FormSubmissionProcessor (Requirements: 3.1-3.5)
      const result = await formSubmissionProcessor.processSubmission(
        form.id,
        sanitizedData,
        req.file,
        req.ip,
        req.get('user-agent')
      );

      if (!result.success) {
        // Log error analytics
        await query(
          `INSERT INTO form_analytics (form_id, event_type, ip_address, metadata)
           VALUES (?, 'error', ?, ?)`,
          [form.id, req.ip, JSON.stringify({ error: result.error })]
        ).catch(err => console.error('[PublicForms] Failed to log error analytics:', err));

        return res.status(500).json({
          success: false,
          message: 'Failed to submit application. Please try again later.'
        });
      }

      // Log successful submission analytics
      await query(
        `INSERT INTO form_analytics (form_id, event_type, ip_address, metadata)
         VALUES (?, 'submission', ?, ?)`,
        [form.id, req.ip, JSON.stringify({ candidate_id: result.candidateId })]
      ).catch(err => console.error('[PublicForms] Failed to log submission analytics:', err));

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        data: {
          candidate_id: result.candidateId,
          submission_id: result.submissionId
        }
      });
    } catch (error) {
      console.error('[PublicForms] Error submitting form:', error);

      // Log error analytics
      try {
        const form = req.form;
        if (form) {
          await query(
            `INSERT INTO form_analytics (form_id, event_type, ip_address, metadata)
             VALUES (?, 'error', ?, ?)`,
            [form.id, req.ip, JSON.stringify({ error: error.message })]
          );
        }
      } catch (logError) {
        console.error('[PublicForms] Failed to log error analytics:', logError);
      }

      res.status(500).json({
        success: false,
        message: 'Failed to submit application. Please try again later.'
      });
    }
  }
);

/**
 * POST /api/public/forms/:slug/track-view
 * Track form view for analytics
 * Requirements: 14.1
 */
router.post('/forms/:slug/track-view', validateToken, async (req, res) => {
  try {
    const form = req.form; // Attached by validateToken middleware

    // Insert form view analytics
    await query(
      `INSERT INTO form_analytics (form_id, event_type, ip_address, user_agent)
       VALUES (?, 'view', ?, ?)`,
      [form.id, req.ip, req.get('user-agent')]
    );

    res.json({
      success: true,
      message: 'View tracked successfully'
    });
  } catch (error) {
    console.error('[PublicForms] Error tracking view:', error);
    // Don't fail the request if analytics tracking fails
    res.json({
      success: true,
      message: 'View tracking failed but form is accessible'
    });
  }
});

export default router;
