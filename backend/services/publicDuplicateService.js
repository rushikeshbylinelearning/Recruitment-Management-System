import crypto from 'crypto';
import { findExistingForSubmission } from './candidateMatchService.js';

/** @deprecated Use findExistingForSubmission from candidateMatchService */
export async function findExistingApplication(params) {
  return findExistingForSubmission(params);
}

export function formatPublicStatus(appStatus, candidateStage) {
  if (candidateStage) return candidateStage;
  if (appStatus === 'active') return 'Applied';
  return appStatus || 'Applied';
}

export function hashResumeBuffer(buffer) {
  if (!buffer) return null;
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Record duplicate match for HR review.
 */
export async function recordDuplicateMatch({
  applicationId,
  matchedCandidateId,
  matchedApplicationId = null,
  matchType,
  confidenceScore = 1,
}) {
  await query(
    `INSERT INTO duplicate_matches
     (application_id, matched_application_id, matched_candidate_id, match_type, confidence_score)
     VALUES (?, ?, ?, ?, ?)`,
    [
      applicationId,
      matchedApplicationId,
      matchedCandidateId,
      matchType,
      confidenceScore,
    ]
  );
}
