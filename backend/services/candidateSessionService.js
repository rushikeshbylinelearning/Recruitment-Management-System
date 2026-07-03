import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { query } from '../config/database.js';

const SESSION_TTL_HOURS = 72;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a resume session for continuing/updating an application.
 * Returns opaque session token (store client-side in sessionStorage).
 */
export async function createResumeSession({
  candidateId,
  applicationId,
  formId,
  publicFormId,
  publicRef,
  draftData = null,
}) {
  const sessionToken = crypto.randomBytes(32).toString('base64url');
  const sessionTokenHash = hashToken(sessionToken);
  const ref = publicRef || randomUUID();

  await query(
    `INSERT INTO candidate_sessions
     (session_token_hash, public_ref, candidate_id, application_id, form_id, public_form_id, draft_data, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [
      sessionTokenHash,
      ref,
      candidateId,
      applicationId || null,
      formId,
      publicFormId || null,
      draftData ? JSON.stringify(draftData) : null,
      SESSION_TTL_HOURS,
    ]
  );

  return { sessionToken, publicRef: ref, expiresInHours: SESSION_TTL_HOURS };
}

export async function validateSession(sessionToken) {
  if (!sessionToken) return null;
  const hash = hashToken(sessionToken);
  const rows = await query(
    `SELECT cs.*, c.name AS candidate_name, c.email, c.stage
     FROM candidate_sessions cs
     INNER JOIN candidates c ON c.id = cs.candidate_id
     WHERE cs.session_token_hash = ? AND cs.expires_at > NOW()
     LIMIT 1`,
    [hash]
  );
  if (!rows.length) return null;

  const row = rows[0];
  query('UPDATE candidate_sessions SET last_accessed_at = NOW() WHERE id = ?', [
    row.id,
  ]).catch(() => {});

  let draftData = null;
  if (row.draft_data) {
    try {
      draftData = typeof row.draft_data === 'string' ? JSON.parse(row.draft_data) : row.draft_data;
    } catch {
      draftData = null;
    }
  }

  let application = null;
  if (row.application_id) {
    const apps = await query(
      `SELECT public_ref, status, version, submission_data, updated_at
       FROM candidate_applications WHERE id = ?`,
      [row.application_id]
    );
    if (apps.length) {
      const a = apps[0];
      application = {
        publicRef: a.public_ref,
        status: a.status,
        version: a.version,
        lastUpdated: a.updated_at,
        submissionData:
          typeof a.submission_data === 'string'
            ? JSON.parse(a.submission_data)
            : a.submission_data,
      };
    }
  }

  return {
    candidateId: row.candidate_id,
    formId: row.form_id,
    publicRef: row.public_ref,
    draftData,
    application,
    candidateName: row.candidate_name,
    email: row.email,
    stage: row.stage,
  };
}

export async function saveDraft(sessionToken, draftData) {
  const hash = hashToken(sessionToken);
  const result = await query(
    `UPDATE candidate_sessions
     SET draft_data = ?, last_accessed_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
     WHERE session_token_hash = ? AND expires_at > NOW()`,
    [JSON.stringify(draftData || {}), SESSION_TTL_HOURS, hash]
  );
  return result.affectedRows > 0;
}
