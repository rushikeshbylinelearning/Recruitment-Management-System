/**
 * Public Application API — short links, duplicate workflow, versioning, resume sessions.
 */

import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { query } from '../config/database.js';
import { resolvePublicForm } from '../middleware/resolvePublicForm.js';
import { formSubmissionLimiter, apiLimiter } from '../middleware/rateLimiter.js';
import validationService from '../services/validationService.js';
import { normalizeFormData, extractContactFields } from '../utils/formDataNormalizer.js';
import { findExistingForSubmission } from '../services/candidateMatchService.js';
import {
  checkDuplicateSubmission,
  processPublicSubmission,
} from '../services/publicSubmissionService.js';
import {
  createResumeSession,
  validateSession,
  saveDraft,
} from '../services/candidateSessionService.js';
import { ensurePublicApplicationSchema } from '../services/ensurePublicApplicationSchema.js';
import { resolveLegacyShareToShortLink } from '../services/publicFormLinkService.js';
import { triggerAssessmentPortalWebhook } from './rmsWebhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

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
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only PDF and DOC files are allowed'));
  },
});

function collectUploadedFiles(req) {
  const map = {};
  const list = req.files?.length ? req.files : req.file ? [req.file] : [];
  for (const file of list) {
    if (file?.fieldname) map[file.fieldname] = file;
  }
  return map;
}

function resolveResumeUpload(filesByFieldKey, fields) {
  if (filesByFieldKey.resume) return filesByFieldKey.resume;
  for (const f of fields.filter((x) => x.field_type === 'file')) {
    if (filesByFieldKey[f.field_key]) return filesByFieldKey[f.field_key];
  }
  return Object.values(filesByFieldKey)[0] || null;
}

async function loadFormFields(formId) {
  const fields = await query(
    `SELECT id, label, field_key, field_type, is_required, options, placeholder, order_index
     FROM form_fields WHERE form_id = ? AND is_active = TRUE ORDER BY order_index ASC`,
    [formId]
  );
  return fields.map((f) => ({
    ...f,
    options: f.options ? JSON.parse(f.options) : null,
  }));
}

function publicFormPayload(form, fields, jobs) {
  return {
    success: true,
    data: {
      title: form.name,
      description: form.description || null,
      fields: fields.map(({ id, label, field_key, field_type, is_required, options, placeholder, order_index }) => ({
        id,
        label,
        field_key,
        field_type,
        is_required,
        options,
        placeholder,
        order_index,
      })),
      job_options: jobs,
    },
  };
}

/** GET /api/public/legacy-resolve?slug=&share= — redirect legacy URLs to short links */
router.get('/legacy-resolve', apiLimiter, async (req, res) => {
  try {
    await ensurePublicApplicationSchema();
    const { slug, share } = req.query;
    if (!slug || !share) {
      return res.status(400).json({ success: false, message: 'Missing slug or share token.' });
    }
    const resolved = await resolveLegacyShareToShortLink(String(slug), String(share), req);
    if (!resolved) {
      return res.status(404).json({ success: false, message: 'Invalid or expired application link.' });
    }
    return res.json({
      success: true,
      redirectPath: resolved.path,
      url: resolved.url,
      shortCode: resolved.shortCode,
      routePrefix: resolved.routePrefix,
    });
  } catch (error) {
    console.error('[PublicApplication] legacy-resolve:', error);
    res.status(500).json({ success: false, message: 'Unable to resolve application link.' });
  }
});

/** GET /api/public/form/:shortCode */
router.get('/form/:shortCode', apiLimiter, resolvePublicForm, async (req, res) => {
  try {
    const form = req.form;
    const fields = await loadFormFields(form.id);
    const jobs = await query(
      `SELECT id, title, department FROM job_postings WHERE status = 'Active' ORDER BY title ASC`
    );

    await query(
      `INSERT INTO form_analytics (form_id, event_type, ip_address, user_agent) VALUES (?, 'view', ?, ?)`,
      [form.id, req.ip, req.get('user-agent')]
    ).catch(() => {});

    res.json(publicFormPayload(form, fields, jobs));
  } catch (error) {
    console.error('[PublicApplication] GET form:', error);
    res.status(500).json({ success: false, message: 'Failed to load application form.' });
  }
});

/** POST /api/public/application/check */
router.post(
  '/application/check',
  apiLimiter,
  resolvePublicForm,
  async (req, res) => {
    try {
      const result = await checkDuplicateSubmission(
        req.form.id,
        req.body?.fields || req.body || {}
      );

      if (!result.exists) {
        return res.json({ success: true, exists: false });
      }

      return res.json({
        success: true,
        exists: true,
        applicationRef: result.applicationRef,
        status: result.status,
        lastUpdated: result.lastUpdated,
        resumeAvailable: result.resumeAvailable,
        matches: result.matches?.map((m) => ({
          name: m.name,
          stage: m.stage,
          matchTypes: m.matchTypes,
          application: m.application,
        })),
      });
    } catch (error) {
      console.error('[PublicApplication] check:', error);
      res.status(500).json({ success: false, message: 'Unable to verify application status.' });
    }
  }
);

/** POST /api/public/application/save-draft */
router.post(
  '/application/save-draft',
  apiLimiter,
  resolvePublicForm,
  async (req, res) => {
    try {
      const sessionToken = req.headers['x-session-token'] || req.body?.sessionToken;
      if (!sessionToken) {
        return res.status(401).json({ success: false, message: 'Session required to save draft.' });
      }
      const ok = await saveDraft(sessionToken, req.body?.fields || {});
      if (!ok) {
        return res.status(401).json({ success: false, message: 'Session expired. Please resume again.' });
      }
      res.json({ success: true, message: 'Draft saved.' });
    } catch (error) {
      console.error('[PublicApplication] save-draft:', error);
      res.status(500).json({ success: false, message: 'Failed to save draft.' });
    }
  }
);

/** POST /api/public/application/resume */
router.post(
  '/application/resume',
  apiLimiter,
  resolvePublicForm,
  async (req, res) => {
    try {
      const sessionToken = req.headers['x-session-token'] || req.body?.sessionToken;
      if (sessionToken) {
        const session = await validateSession(sessionToken);
        if (!session) {
          return res.status(401).json({ success: false, message: 'Session expired.' });
        }
        return res.json({
          success: true,
          sessionToken,
          publicRef: session.publicRef,
          draft: session.draftData,
          application: session.application,
          candidate: { name: session.candidateName, email: session.email, stage: session.stage },
        });
      }

      const normalized = normalizeFormData(req.body?.fields || {});
      const contact = extractContactFields(normalized);
      const existing = await findExistingForSubmission({
        email: contact.email,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        formId: req.form.id,
      });

      if (!existing.exists || !existing.candidateId) {
        return res.status(404).json({ success: false, message: 'No application found for this contact.' });
      }

      const apps = await query(
        `SELECT id, public_ref FROM candidate_applications
         WHERE candidate_id = ? AND form_id = ? AND is_active = TRUE LIMIT 1`,
        [existing.candidateId, req.form.id]
      );

      const { sessionToken: newToken, publicRef } = await createResumeSession({
        candidateId: existing.candidateId,
        applicationId: apps[0]?.id || null,
        formId: req.form.id,
        publicFormId: req.publicForm.id,
        publicRef: apps[0]?.public_ref,
        draftData: normalized,
      });

      const session = await validateSession(newToken);
      res.json({
        success: true,
        sessionToken: newToken,
        publicRef,
        draft: session?.draftData || normalized,
        application: session?.application,
        status: existing.status,
        lastUpdated: existing.lastUpdated,
      });
    } catch (error) {
      console.error('[PublicApplication] resume:', error);
      res.status(500).json({ success: false, message: 'Unable to resume application.' });
    }
  }
);

/** POST /api/public/application/submit */
router.post(
  '/application/submit',
  resolvePublicForm,
  formSubmissionLimiter,
  upload.any(),
  async (req, res) => {
    try {
      await ensurePublicApplicationSchema();
      const form = req.form;
      const action = (req.body?.action || 'new').toLowerCase();
      const filesByFieldKey = collectUploadedFiles(req);

      const fields = await query(
        `SELECT id, label, field_key, field_type, is_required, options
         FROM form_fields WHERE form_id = ? AND is_active = TRUE`,
        [form.id]
      );

      const outcome = await processPublicSubmission({
        formId: form.id,
        formData: req.body,
        fields,
        filesByFieldKey,
        resolveResumeUpload,
        action,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        publicFormId: req.publicForm?.id,
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
            source: 'Public Application',
          })
        );
      }

      return res.status(outcome.status).json(outcome.body);
    } catch (error) {
      console.error('[PublicApplication] submit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit application. Please try again later.',
      });
    }
  }
);

export default router;
