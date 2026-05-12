/**
 * rmsExport.js  ─  ADD THIS FILE to hr-workflow-management/backend/routes/
 *
 * Exposes a read-only API endpoint secured by a shared API key (x-rms-api-key).
 * The Assessment Portal backend calls this to pull candidate data.
 *
 * Mount in server.js:
 *   import rmsExportRoutes from './routes/rmsExport.js';
 *   app.use('/api/rms-export', rmsExportRoutes);
 *
 * Add to hr-workflow-management/backend/.env:
 *   RMS_API_KEY=rms_secret_key_change_in_production
 *   ASSESSMENT_PORTAL_ORIGIN=https://assessment-portal.legatolxp.online
 */

import express from 'express';
import { query } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────
const validateRmsApiKey = (req, res, next) => {
  const key = req.headers['x-rms-api-key'];
  if (!key) {
    return res.status(401).json({ success: false, message: 'x-rms-api-key header missing' });
  }
  if (!process.env.RMS_API_KEY) {
    return res.status(500).json({ success: false, message: 'RMS_API_KEY not configured on server' });
  }
  if (key !== process.env.RMS_API_KEY) {
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }
  next();
};

// Apply to all routes in this file
router.use(validateRmsApiKey);

// ─── GET /api/rms-export/candidates ──────────────────────────────────────────
/**
 * Query params:
 *   stage   - filter by pipeline stage (e.g. "Applied", "Screening")
 *   search  - filter by name / email / phone / position
 *   limit   - max rows (default 500, max 1000)
 *   offset  - for pagination (default 0)
 */
router.get('/candidates', asyncHandler(async (req, res) => {
  const { stage, search } = req.query;
  const limit  = Math.min(parseInt(req.query.limit  || '500'),  1000);
  const offset = Math.max(parseInt(req.query.offset || '0'),    0);

  let where  = 'WHERE 1=1';
  const params = [];

  if (stage) {
    where += ' AND stage = ?';
    params.push(stage);
  }

  if (search) {
    where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR position LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  // Count first
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM candidates ${where}`,
    params
  );

  // Fetch rows — only the fields Assessment Portal needs
  const candidates = await query(
    `SELECT
       id,
       name,
       email,
       phone,
       position,
       stage,
       experience,
       location,
       source,
       applied_date AS appliedDate,
       salary_expected AS salaryExpected,
       resume_path AS resumePath
     FROM candidates
     ${where}
     ORDER BY applied_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: {
      total: Number(total),
      limit,
      offset,
      candidates,
    },
  });
}));

// ─── GET /api/rms-export/candidates/:id ──────────────────────────────────────
router.get('/candidates/:id', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT id, name, email, phone, position, stage, experience,
            location, source, applied_date AS appliedDate,
            salary_expected AS salaryExpected, resume_path AS resumePath
     FROM candidates WHERE id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Candidate not found' });
  }
  res.json({ success: true, data: rows[0] });
}));

export default router;
