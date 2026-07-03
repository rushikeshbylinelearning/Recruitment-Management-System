/**
 * Intelligent merge API routes
 */

import express from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateUUID, handleValidationErrors } from '../middleware/validation.js';
import { body, param } from 'express-validator';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';
import {
  previewMerge,
  executeMerge,
  executeBatchMerge,
  findDuplicateClusterForCandidate,
  rollbackMerge,
  getMergeHistory,
  getResumeHistory,
  getCandidateTimeline,
  getCandidatePositions,
} from '../services/candidateMergeService.js';
import { MERGE_STRATEGIES } from '../services/candidateReconciliationEngine.js';
import { ensureMergeSchema } from '../services/ensureMergeSchema.js';

const router = express.Router();

router.use(asyncHandler(async (req, res, next) => {
  await ensureMergeSchema();
  next();
}));

router.post(
  '/preview',
  authenticateToken,
  checkPermission('candidates', 'edit'),
  body('primaryCandidateId').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  body('duplicateCandidateId').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  body('strategy')
    .optional()
    .isIn(Object.values(MERGE_STRATEGIES)),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { primaryCandidateId, duplicateCandidateId, strategy } = req.body;
    const data = await previewMerge(
      primaryCandidateId,
      duplicateCandidateId,
      strategy || MERGE_STRATEGIES.HR_REVIEW_REQUIRED
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/execute',
  authenticateToken,
  checkPermission('candidates', 'edit'),
  body('primaryCandidateId').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  body('duplicateCandidateId').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  body('strategy').optional().isIn(Object.values(MERGE_STRATEGIES)),
  body('decisions').optional().isObject(),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { primaryCandidateId, duplicateCandidateId, strategy, decisions } = req.body;
    const result = await executeMerge({
      primaryId: primaryCandidateId,
      duplicateId: duplicateCandidateId,
      strategy: strategy || MERGE_STRATEGIES.HR_REVIEW_REQUIRED,
      decisions: decisions || {},
      mergedBy: req.user?.id || null,
    });
    res.json({
      success: true,
      message: result.alreadyMerged
        ? 'These profiles were already merged.'
        : 'Candidates merged successfully with intelligent reconciliation.',
      data: result,
    });
  })
);

router.post(
  '/execute-batch',
  authenticateToken,
  checkPermission('candidates', 'edit'),
  body('primaryCandidateId').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  body('duplicateCandidateIds').isArray({ min: 1, max: 10 }),
  body('duplicateCandidateIds.*').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  body('strategy').optional().isIn(Object.values(MERGE_STRATEGIES)),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { primaryCandidateId, duplicateCandidateIds, strategy } = req.body;
    const result = await executeBatchMerge({
      primaryId: primaryCandidateId,
      duplicateIds: duplicateCandidateIds,
      strategy: strategy || MERGE_STRATEGIES.AUTO_SAFE,
      mergedBy: req.user?.id || null,
    });
    res.json({
      success: true,
      message: `Merged ${result.mergedCount} duplicate profile(s) into the primary record.`,
      data: result,
    });
  })
);

router.post(
  '/rollback',
  authenticateToken,
  checkPermission('candidates', 'edit'),
  body('mergeHistoryId').isInt({ min: 1 }),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const result = await rollbackMerge(req.body.mergeHistoryId, req.user?.id || null);
    res.json({ success: true, message: 'Merge rolled back successfully.', data: result });
  })
);

router.get(
  '/cluster/:candidateId',
  authenticateToken,
  checkPermission('candidates', 'view'),
  validateUUID('candidateId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const cluster = await findDuplicateClusterForCandidate(req.params.candidateId);
    res.json({ success: true, data: cluster });
  })
);

router.get(
  '/history/:candidateId',
  authenticateToken,
  checkPermission('candidates', 'view'),
  validateUUID('candidateId'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const history = await getMergeHistory(req.params.candidateId);
    res.json({ success: true, data: { history } });
  })
);

export default router;
