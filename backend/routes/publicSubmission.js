/**
 * Public Submission API Routes
 * Handles public-facing assignment submission endpoints (no auth required).
 * Requirements: 4.2, 4.3, 4.4, 6.1, 6.7, 6.8, 6.9, 11.1, 11.2, 11.3
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { query, transaction } from '../config/database.js';
import emailService from '../services/emailService.js';
import { createNotification } from '../services/inAppNotifications.js';
import { validateSubmissionFiles } from '../middleware/submissionFileValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// ─── Multer storage ──────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '../uploads/assignment-submissions');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'submission-' + uniqueSuffix + ext);
  },
});

const ACCEPTED_MIME_TYPES = ['video/mp4', 'image/png', 'image/jpeg', 'application/pdf'];

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    // Accept all files here; MIME validation is done after upload via validateSubmissionFiles
    cb(null, true);
  },
});

// ─── Token validation helper ─────────────────────────────────────────────────

/**
 * Validates the token + candidateId combination.
 * Returns the candidate_assignment row on success.
 * Sends the appropriate HTTP error response and returns null on failure.
 */
async function validateToken(req, res, candidateId, token) {
  // Look up the token — do NOT filter by candidateId yet (prevents candidate enumeration)
  const rows = await query(
    `SELECT ca.*, a.title AS assignment_title,
            c.name AS candidate_name, c.email AS candidate_email,
            u.email AS assigned_by_email, u.id AS assigned_by_user_id
     FROM candidate_assignments ca
     LEFT JOIN assignments a ON ca.assignment_id = a.id
     LEFT JOIN candidates  c ON ca.candidate_id  = c.id
     LEFT JOIN users       u ON ca.assigned_by   = u.id
     WHERE ca.token = ?
     LIMIT 1`,
    [token]
  );

  // Token not found → 403 (no info leakage about candidate existence)
  if (rows.length === 0) {
    res.status(403).json({ success: false, message: 'Invalid or unauthorized access.' });
    return null;
  }

  const record = rows[0];

  // Candidate ID mismatch → 403 (same generic message)
  if (String(record.candidate_id) !== String(candidateId)) {
    res.status(403).json({ success: false, message: 'Invalid or unauthorized access.' });
    return null;
  }

  // Expired → 410
  if (new Date() > new Date(record.expiry_at)) {
    res.status(410).json({ success: false, message: 'Link expired. Contact HR.' });
    return null;
  }

  return record;
}

// ─── GET /api/public/submit-assignment/:candidateId/:token ───────────────────

/**
 * Returns assignment metadata for rendering the submission page.
 * Requirements: 4.2, 4.3, 11.1, 11.2, 11.3
 */
router.get('/:candidateId/:token', async (req, res) => {
  try {
    const { candidateId, token } = req.params;

    const record = await validateToken(req, res, candidateId, token);
    if (!record) return; // response already sent

    res.json({
      success: true,
      data: {
        assignment_title: record.assignment_title,
        deadline: record.deadline,
        expiry_at: record.expiry_at,
        single_use: !!record.single_use,
        status: record.status,
      },
    });
  } catch (err) {
    console.error('[PublicSubmission] GET error:', err);
    res.status(500).json({ success: false, message: 'Failed to load submission page. Please try again later.' });
  }
});

// ─── POST /api/public/submit-assignment/:candidateId/:token ──────────────────

/**
 * Accepts multipart file upload, validates token, persists files, updates status,
 * and triggers HR notification email + in-app notification.
 * Requirements: 4.2, 4.3, 4.4, 6.1, 6.7, 6.8, 6.9, 11.1, 11.2, 11.3
 */
router.post(
  '/:candidateId/:token',
  upload.array('files'),
  validateSubmissionFiles,
  async (req, res) => {
    try {
      const { candidateId, token } = req.params;
      const notes = req.body.notes || null;

      const record = await validateToken(req, res, candidateId, token);
      if (!record) {
        // Clean up any uploaded files since we're rejecting the request
        await cleanupFiles(req.files || []);
        return;
      }

      // Single-use check: if single_use=1 and already Submitted → 403
      if (record.single_use && record.status === 'Submitted') {
        await cleanupFiles(req.files || []);
        return res.status(403).json({ success: false, message: 'This submission link has already been used.' });
      }

      const files = req.files || [];

      // Persist files and update DB inside a transaction
      await transaction(async (conn) => {
        // Insert file records
        for (const file of files) {
          await conn.execute(
            `INSERT INTO candidate_assignment_files
               (candidate_assignment_id, stored_filename, original_filename, mime_type, file_size, storage_path)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              record.id,
              file.filename,
              file.originalname,
              file.mimetype,
              file.size,
              file.path,
            ]
          );
        }

        // Update candidate_assignment status
        await conn.execute(
          `UPDATE candidate_assignments
           SET status = 'Submitted', submitted_at = NOW(), submission_notes = ?, updated_at = NOW()
           WHERE id = ?`,
          [notes, record.id]
        );
      });

      // Fire-and-forget: HR notification email
      emailService
        .sendSubmissionNotificationEmail({
          candidate_name: record.candidate_name,
          assignment_title: record.assignment_title,
          assigned_by_email: record.assigned_by_email,
        })
        .catch((err) => console.error('[PublicSubmission] HR email error:', err));

      // Fire-and-forget: in-app notification for the HR user
      if (record.assigned_by_user_id) {
        createNotification(record.assigned_by_user_id, {
          type: 'submission',
          title: 'Assignment Submitted',
          message: `${record.candidate_name} has submitted their assignment: "${record.assignment_title}".`,
          link: '/assignments',
        }).catch((err) => console.error('[PublicSubmission] In-app notification error:', err));
      }

      res.status(200).json({
        success: true,
        message: 'Your assignment has been submitted successfully.',
      });
    } catch (err) {
      console.error('[PublicSubmission] POST error:', err);
      // Attempt cleanup of any uploaded files on unexpected error
      await cleanupFiles(req.files || []).catch(() => {});
      res.status(500).json({ success: false, message: 'Failed to submit assignment. Please try again later.' });
    }
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cleanupFiles(files) {
  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch {
      // best-effort cleanup
    }
  }
}

export default router;
