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
import { triggerAssessmentPortalWebhook } from './rmsWebhook.js';
import validationService from '../services/validationService.js';
import { normalizeFormData } from '../utils/formDataNormalizer.js';
import {
  checkDuplicateSubmission,
  processPublicSubmission,
} from '../services/publicSubmissionService.js';
import { ensurePublicApplicationSchema } from '../services/ensurePublicApplicationSchema.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

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
/**
 * Build a map of field_key → multer file from any uploaded parts.
 */
function collectUploadedFiles(req) {
  const map = {};
  const list = req.files?.length
    ? req.files
    : req.file
      ? [req.file]
      : [];
  for (const file of list) {
    if (file?.fieldname) {
      map[file.fieldname] = file;
    }
  }
  return map;
}

/**
 * Pick the resume/CV file for candidate storage (any file-type form field).
 */
function resolveResumeUpload(filesByFieldKey, fields) {
  if (filesByFieldKey.resume) {
    return filesByFieldKey.resume;
  }
  const fileFieldKeys = fields
    .filter((f) => f.field_type === 'file')
    .map((f) => f.field_key);
  for (const key of fileFieldKeys) {
    if (filesByFieldKey[key]) {
      return filesByFieldKey[key];
    }
  }
  const first = Object.values(filesByFieldKey)[0];
  return first || null;
}

/** POST /api/public/forms/:slug/check — duplicate detection (legacy URLs) */
router.post('/forms/:slug/check', validateToken, apiLimiter, async (req, res) => {
  try {
    await ensurePublicApplicationSchema();
    const form = req.form;
    const existing = await checkDuplicateSubmission(form.id, req.body?.fields || req.body || {});
    if (!existing.exists) {
      return res.json({ success: true, exists: false });
    }
    return res.json({
      success: true,
      exists: true,
      applicationRef: existing.applicationRef,
      status: existing.status,
      lastUpdated: existing.lastUpdated,
      resumeAvailable: existing.resumeAvailable,
    });
  } catch (error) {
    console.error('[PublicForms] check:', error);
    res.status(500).json({ success: false, message: 'Unable to verify application status.' });
  }
});

router.post('/forms/:slug/submit',
  validateToken,
  formSubmissionLimiter,
  upload.any(),
  async (req, res) => {
    try {
      await ensurePublicApplicationSchema();
      const form = req.form;
      const formData = req.body;
      const action = (req.body?.action || 'new').toLowerCase();
      const filesByFieldKey = collectUploadedFiles(req);

      const fields = await query(
        `SELECT id, label, field_key, field_type, is_required, options
         FROM form_fields WHERE form_id = ? AND is_active = TRUE`,
        [form.id]
      );

      const outcome = await processPublicSubmission({
        formId: form.id,
        formData,
        fields,
        filesByFieldKey,
        resolveResumeUpload,
        action,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      if (!outcome.ok) {
        return res.status(outcome.status).json(outcome.body);
      }

      if (outcome.candidateId && outcome.sanitizedData) {
        await query(
          `INSERT INTO form_analytics (form_id, event_type, ip_address, metadata)
           VALUES (?, 'submission', ?, ?)`,
          [form.id, req.ip, JSON.stringify({ application_ref: outcome.body.data?.applicationRef })]
        ).catch(() => {});

        setImmediate(() =>
          triggerAssessmentPortalWebhook({
            id: outcome.candidateId,
            name: outcome.sanitizedData.name,
            email: outcome.sanitizedData.email,
            phone: outcome.sanitizedData.phone,
            position: outcome.sanitizedData.position || outcome.sanitizedData.job_profile || '',
            stage: 'Applied',
            experience: outcome.sanitizedData.experience || '',
            source: 'Public Form',
          })
        );
      }

      return res.status(outcome.status).json(outcome.body);
    } catch (error) {
      console.error('[PublicForms] Error submitting form:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit application. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
