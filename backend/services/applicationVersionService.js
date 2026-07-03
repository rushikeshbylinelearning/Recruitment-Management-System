import { randomUUID } from 'crypto';
import { query, transaction } from '../config/database.js';
import { recordDuplicateMatch } from './publicDuplicateService.js';

/**
 * Archive prior active applications for a candidate+form pair.
 */
export async function archiveActiveApplications(connection, candidateId, formId, exceptId = null) {
  const params = [candidateId, formId];
  let sql = `UPDATE candidate_applications
             SET is_active = FALSE, status = 'archived', updated_at = NOW()
             WHERE candidate_id = ? AND form_id = ? AND is_active = TRUE`;
  if (exceptId) {
    sql += ' AND id != ?';
    params.push(exceptId);
  }
  await connection.execute(sql, params);
}

/**
 * Register application version after successful candidate creation.
 */
export async function createApplicationVersion({
  candidateId,
  formId,
  formSubmissionId,
  email,
  phone,
  linkedinUrl,
  resumeHash,
  submissionData,
  action = 'new',
  parentApplicationId = null,
  matchedCandidateId = null,
  matchType = 'email',
  connection: externalConnection = null,
}) {
  const run = async (connection) => {
    const [versionRows] = await connection.execute(
      `SELECT COALESCE(MAX(version), 0) AS maxVer
       FROM candidate_applications
       WHERE candidate_id = ? AND form_id = ?`,
      [candidateId, formId]
    );
    const nextVersion = Number(versionRows[0]?.maxVer || 0) + 1;

    if (action === 'update' || action === 'fresh') {
      await archiveActiveApplications(connection, candidateId, formId);
    }

    const publicRef = randomUUID();
    const [insertResult] = await connection.execute(
      `INSERT INTO candidate_applications
       (public_ref, candidate_id, form_id, form_submission_id, email, phone, linkedin_url,
        resume_hash, status, version, parent_application_id, is_active, submission_data, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, TRUE, ?, NOW())`,
      [
        publicRef,
        candidateId,
        formId,
        formSubmissionId,
        email,
        phone || null,
        linkedinUrl || null,
        resumeHash || null,
        nextVersion,
        parentApplicationId,
        JSON.stringify(submissionData || {}),
      ]
    );

    const applicationId = insertResult.insertId;

    if (matchedCandidateId && matchedCandidateId !== candidateId) {
      await connection.execute(
        `INSERT INTO duplicate_matches
         (application_id, matched_candidate_id, match_type, confidence_score)
         VALUES (?, ?, ?, 1.0)`,
        [applicationId, matchedCandidateId, matchType]
      );
    }

    return {
      applicationId,
      publicRef,
      version: nextVersion,
    };
  };

  if (externalConnection) return run(externalConnection);
  return transaction(run);
}

/**
 * List versions for HR (by candidate or public ref).
 */
export async function getApplicationVersions({ candidateId, publicRef }) {
  let sql = `
    SELECT ca.public_ref, ca.version, ca.status, ca.is_active, ca.submitted_at, ca.updated_at,
           ca.email, ca.form_id, f.name AS form_name
    FROM candidate_applications ca
    LEFT JOIN forms f ON f.id = ca.form_id
    WHERE 1=1`;
  const params = [];

  if (publicRef) {
    const [base] = await query(
      'SELECT candidate_id, form_id FROM candidate_applications WHERE public_ref = ?',
      [publicRef]
    );
    if (!base.length) return [];
    sql += ' AND ca.candidate_id = ? AND ca.form_id = ?';
    params.push(base[0].candidate_id, base[0].form_id);
  } else if (candidateId) {
    sql += ' AND ca.candidate_id = ?';
    params.push(candidateId);
  } else {
    return [];
  }

  sql += ' ORDER BY ca.version DESC';
  return query(sql, params);
}

/**
 * Mark duplicate as intentional (HR).
 */
export async function markDuplicateIntentional(matchId) {
  await query(
    'UPDATE duplicate_matches SET is_intentional = TRUE, resolved_at = NOW() WHERE id = ?',
    [matchId]
  );
}
