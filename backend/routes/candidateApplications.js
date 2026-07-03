/**
 * HR tools: application versions, duplicate management.
 */

import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getApplicationVersions,
  markDuplicateIntentional,
} from '../services/applicationVersionService.js';
import { ensurePublicApplicationSchema } from '../services/ensurePublicApplicationSchema.js';
import { transaction } from '../config/database.js';
import { normalizeEmail } from '../utils/contactNormalizer.js';

const router = express.Router();

router.use(authenticateToken);

router.use(async (req, res, next) => {
  try {
    await ensurePublicApplicationSchema();
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Application schema not ready.' });
  }
});

/** GET /api/candidate-applications/duplicates — unresolved duplicate matches */
router.get(
  '/duplicates',
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT dm.id, dm.match_type, dm.confidence_score, dm.is_intentional, dm.created_at,
              ca.public_ref AS application_ref, ca.version,
              c.id AS candidate_id, c.name AS candidate_name, c.email,
              mc.id AS matched_candidate_id, mc.name AS matched_name, mc.email AS matched_email,
              mc.stage AS matched_stage
       FROM duplicate_matches dm
       INNER JOIN candidate_applications ca ON ca.id = dm.application_id
       INNER JOIN candidates c ON c.id = ca.candidate_id
       INNER JOIN candidates mc ON mc.id = dm.matched_candidate_id
       WHERE dm.resolved_at IS NULL AND dm.is_intentional = FALSE
       ORDER BY dm.created_at DESC
       LIMIT 200`
    );

    res.json({ success: true, data: { duplicates: rows } });
  })
);

/** GET /api/candidate-applications/versions — by candidateId or publicRef */
router.get(
  '/versions',
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const { candidateId, publicRef } = req.query;
    const versions = await getApplicationVersions({
      candidateId: candidateId || null,
      publicRef: publicRef || null,
    });
    res.json({ success: true, data: { versions } });
  })
);

/** PATCH /api/candidate-applications/duplicates/:id/intentional */
router.patch(
  '/duplicates/:id/intentional',
  checkPermission('candidates', 'edit'),
  asyncHandler(async (req, res) => {
    await markDuplicateIntentional(req.params.id);
    res.json({ success: true, message: 'Marked as intentional duplicate.' });
  })
);

/** POST /api/candidate-applications/duplicates/:id/archive */
router.post(
  '/duplicates/:id/archive',
  checkPermission('candidates', 'edit'),
  asyncHandler(async (req, res) => {
    await query(
      'UPDATE duplicate_matches SET resolved_at = NOW() WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true, message: 'Duplicate flagged as resolved.' });
  })
);

/**
 * POST /api/candidate-applications/merge
 * Merge duplicate candidate into primary (preserves notes via candidate id on child records).
 */
router.post(
  '/merge',
  checkPermission('candidates', 'edit'),
  asyncHandler(async (req, res) => {
    const { primaryCandidateId, duplicateCandidateId } = req.body;
    if (!primaryCandidateId || !duplicateCandidateId) {
      return res.status(400).json({
        success: false,
        message: 'primaryCandidateId and duplicateCandidateId are required.',
      });
    }
    if (String(primaryCandidateId) === String(duplicateCandidateId)) {
      return res.status(400).json({ success: false, message: 'Cannot merge candidate with itself.' });
    }

    await transaction(async (connection) => {
      const tables = [
        ['form_submissions', 'candidate_id'],
        ['candidate_applications', 'candidate_id'],
        ['candidate_notes', 'candidate_id'],
        ['candidate_assignments', 'candidate_id'],
        ['interviews', 'candidate_id'],
      ];

      for (const [table, col] of tables) {
        try {
          await connection.execute(
            `UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`,
            [primaryCandidateId, duplicateCandidateId]
          );
        } catch {
          /* table may not exist in all deployments */
        }
      }

      await connection.execute(
        `UPDATE candidates SET notes = CONCAT(COALESCE(notes, ''), '\n[Merged into primary candidate ', ?, ' on ', NOW(), ']')
         WHERE id = ?`,
        [primaryCandidateId, duplicateCandidateId]
      );
    });

    res.json({ success: true, message: 'Candidates merged successfully.' });
  })
);

export default router;
