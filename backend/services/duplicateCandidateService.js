/**
 * Flag duplicate applications for HR review (candidates apply without friction).
 */

import { query } from '../config/database.js';
import { createNotification } from './inAppNotifications.js';
import { recordDuplicateMatch } from './publicDuplicateService.js';

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

export async function ensureCandidateDuplicateColumns() {
  const cols = [
    {
      name: 'is_flagged_duplicate',
      sql: `ALTER TABLE candidates ADD COLUMN is_flagged_duplicate TINYINT(1) NOT NULL DEFAULT 0`,
    },
    {
      name: 'duplicate_of_candidate_id',
      sql: `ALTER TABLE candidates ADD COLUMN duplicate_of_candidate_id VARCHAR(36) NULL`,
    },
    {
      name: 'duplicate_detected_at',
      sql: `ALTER TABLE candidates ADD COLUMN duplicate_detected_at DATETIME NULL`,
    },
    {
      name: 'has_merged_applications',
      sql: `ALTER TABLE candidates ADD COLUMN has_merged_applications TINYINT(1) NOT NULL DEFAULT 0`,
    },
  ];

  for (const { name, sql } of cols) {
    try {
      const rows = await query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'candidates' AND COLUMN_NAME = ?`,
        [name]
      );
      if (Number(rows[0]?.cnt) === 0) {
        await query(sql);
      }
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }

  if (!(await indexExists('candidates', 'idx_candidates_duplicate'))) {
    try {
      await query(
        `CREATE INDEX idx_candidates_duplicate ON candidates (is_flagged_duplicate, duplicate_of_candidate_id)`
      );
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') throw error;
    }
  }

  try {
    await query(
      `UPDATE candidates
       SET has_merged_applications = 1
       WHERE (has_merged_applications IS NULL OR has_merged_applications = 0)
         AND notes LIKE '%[Merged duplicate application:%'`
    );
  } catch {
    /* column may not exist yet on first boot */
  }
}

export async function flagCandidateAsDuplicate({
  newCandidateId,
  primaryCandidateId,
  matchType = 'email',
  applicationId = null,
  connection = null,
}) {
  const exec = connection
    ? (sql, params) => connection.execute(sql, params)
    : (sql, params) => query(sql, params);

  await exec(
    `UPDATE candidates
     SET is_flagged_duplicate = 1,
         duplicate_of_candidate_id = ?,
         duplicate_detected_at = COALESCE(duplicate_detected_at, NOW())
     WHERE id = ?`,
    [primaryCandidateId, newCandidateId]
  );

  if (applicationId) {
    try {
      await recordDuplicateMatch({
        applicationId,
        matchedCandidateId: primaryCandidateId,
        matchType,
      });
    } catch {
      /* ignore */
    }
  }
}

async function getHrNotifierUserIds() {
  const rows = await query(
    `SELECT id FROM users
     WHERE role IN ('Admin', 'HR', 'Recruiter', 'HR Intern')
       AND (status IS NULL OR status = 'Active')`
  );
  return rows.map((r) => r.id);
}

export async function notifyHrDuplicateApplication({
  newCandidateId,
  newCandidateName,
  primaryCandidateId,
  primaryCandidateName,
  email,
}) {
  const userIds = await getHrNotifierUserIds();
  const title = 'Duplicate application detected';
  const message = `${newCandidateName || 'A candidate'} (${email || 'no email'}) applied again. Matches existing profile: ${primaryCandidateName || 'Unknown'}.`;
  const link = `/candidates?search=${encodeURIComponent(email || newCandidateName || '')}`;

  await Promise.all(
    userIds.map((userId) =>
      createNotification(userId, {
        type: 'duplicate_application',
        title,
        message,
        link,
      })
    )
  );
}

export function mapCandidateDuplicateFields(candidate, primaryRow = null) {
  const notesText =
    typeof candidate.notes === 'string'
      ? candidate.notes
      : Array.isArray(candidate.notes)
        ? candidate.notes.map((n) => n?.content || n?.note || '').join('\n')
        : '';

  const hasMergedFromNotes =
    notesText.includes('[Merged duplicate application:') ||
    notesText.includes('[Intelligent merge:');

  return {
    isFlaggedDuplicate: Boolean(candidate.is_flagged_duplicate),
    duplicateOfCandidateId: candidate.duplicate_of_candidate_id || null,
    duplicateDetectedAt: candidate.duplicate_detected_at || null,
    duplicatePrimaryName: primaryRow?.name || candidate.duplicate_primary_name || null,
    duplicatePrimaryEmail: primaryRow?.email || candidate.duplicate_primary_email || null,
    duplicatePrimaryStage: primaryRow?.stage || candidate.duplicate_primary_stage || null,
    hasMergedApplications:
      Boolean(candidate.has_merged_applications) || hasMergedFromNotes,
  };
}
