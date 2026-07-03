/**
 * Central candidate matching for duplicate detection (email, phone, LinkedIn, resume hash).
 */

import { query } from '../config/database.js';
import {
  normalizeEmail,
  normalizePhone,
  normalizeLinkedIn,
  emailsMatch,
  phonesMatch,
  linkedInUrlsMatch,
} from '../utils/contactNormalizer.js';
import { formatPublicStatus } from './publicDuplicateService.js';

/**
 * Find candidates matching contact info (case-insensitive email, phone last 10 digits).
 * @param {object} contact - { email, phone, linkedinUrl }
 * @param {import('mysql2/promise').PoolConnection} [connection] - optional FOR UPDATE lock
 */
export async function findMatchingCandidates(contact, connection = null) {
  const normalizedEmail = normalizeEmail(contact.email);
  const normalizedPhone = normalizePhone(contact.phone);
  const normalizedLinkedIn = normalizeLinkedIn(contact.linkedinUrl);

  if (!normalizedEmail && !normalizedPhone && !normalizedLinkedIn) {
    return [];
  }

  const conditions = [];
  const params = [];

  if (normalizedEmail) {
    conditions.push(`(
      LOWER(TRIM(c.email)) = ?
      OR LOWER(TRIM(SUBSTRING_INDEX(c.email, ',', 1))) = ?
      OR LOWER(TRIM(c.email)) LIKE ?
    )`);
    params.push(normalizedEmail, normalizedEmail, `%${normalizedEmail}%`);
  }

  if (normalizedPhone) {
    conditions.push(
      `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10) = ?`
    );
    params.push(normalizedPhone);
  }

  if (normalizedLinkedIn) {
    conditions.push(`EXISTS (
      SELECT 1 FROM candidate_applications ca
      WHERE ca.candidate_id = c.id
        AND ca.linkedin_url IS NOT NULL
        AND TRIM(ca.linkedin_url) != ''
        AND (
          LOWER(TRIM(TRAILING '/' FROM ca.linkedin_url)) = ?
          OR LOWER(TRIM(TRAILING '/' FROM ca.linkedin_url)) LIKE ?
        )
    )`);
    params.push(normalizedLinkedIn, `%${normalizedLinkedIn.replace(/^https?:\/\//, '')}%`);
  }

  const sql = `
    SELECT c.id, c.name, c.email, c.phone, c.stage, c.updated_at, c.created_at,
           c.is_flagged_duplicate,
           (SELECT ca.linkedin_url FROM candidate_applications ca
            WHERE ca.candidate_id = c.id
              AND ca.linkedin_url IS NOT NULL AND TRIM(ca.linkedin_url) != ''
            ORDER BY ca.submitted_at DESC LIMIT 1) AS linkedin_url
    FROM candidates c
    WHERE c.id IS NOT NULL AND TRIM(c.id) != ''
      AND (${conditions.join(' OR ')})
    ORDER BY c.created_at ASC
    LIMIT 10`;

  if (connection) {
    const [rows] = await connection.execute(sql, params);
    return rows;
  }
  return query(sql, params);
}

/**
 * Pick best match with match types (filters false positives from broad email LIKE).
 */
export function scoreMatches(candidates, contact) {
  const normalizedEmail = normalizeEmail(contact.email);
  const normalizedPhone = normalizePhone(contact.phone);
  const normalizedLinkedIn = normalizeLinkedIn(contact.linkedinUrl);

  return candidates
    .map((c) => {
      const matchTypes = [];
      if (normalizedEmail && emailsMatch(c.email, normalizedEmail)) {
        matchTypes.push('email');
      }
      if (normalizedPhone && phonesMatch(c.phone, normalizedPhone)) {
        matchTypes.push('phone');
      }
      if (normalizedLinkedIn && linkedInUrlsMatch(c.linkedin_url, normalizedLinkedIn)) {
        matchTypes.push('linkedin');
      }
      if (!matchTypes.length) return null;
      return { ...c, matchTypes };
    })
    .filter(Boolean);
}

/**
 * Choose the canonical (original) profile to merge duplicates into.
 */
export function pickPrimaryForDuplicate(scored, excludeId = null) {
  const valid = scored.filter(
    (c) => c.id && String(c.id).trim() !== '' && String(c.id) !== String(excludeId ?? '')
  );
  if (!valid.length) return null;

  return [...valid].sort((a, b) => {
    const aFlag = Number(a.is_flagged_duplicate) || 0;
    const bFlag = Number(b.is_flagged_duplicate) || 0;
    if (aFlag !== bFlag) return aFlag - bFlag;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  })[0];
}

/**
 * Full duplicate lookup for a form submission.
 */
export async function findExistingForSubmission({ email, phone, linkedinUrl, formId }, connection = null) {
  const candidates = await findMatchingCandidates({ email, phone, linkedinUrl }, connection);
  const scored = scoreMatches(candidates, { email, phone, linkedinUrl });

  if (!scored.length) {
    return { exists: false, matches: [] };
  }

  const candidateIds = scored.map((c) => c.id);
  const placeholders = candidateIds.map(() => '?').join(',');

  let apps = [];
  if (formId) {
    const appSql = `
      SELECT ca.id, ca.public_ref, ca.candidate_id, ca.status, ca.version, ca.is_active,
             ca.updated_at, ca.submitted_at, ca.form_id, ca.linkedin_url, ca.resume_hash
      FROM candidate_applications ca
      WHERE ca.candidate_id IN (${placeholders}) AND ca.form_id = ?
      ORDER BY ca.is_active DESC, ca.version DESC`;

    if (connection) {
      const [rows] = await connection.execute(appSql, [...candidateIds, formId]);
      apps = rows;
    } else {
      apps = await query(appSql, [...candidateIds, formId]);
    }
  }

  const appByCandidate = new Map();
  for (const app of apps) {
    if (!appByCandidate.has(app.candidate_id) || app.is_active) {
      appByCandidate.set(app.candidate_id, app);
    }
  }

  const matches = scored.map((c) => {
    const app = appByCandidate.get(c.id);
    return {
      candidateId: c.id,
      name: c.name,
      email: c.email,
      stage: c.stage || 'Applied',
      matchTypes: c.matchTypes,
      application: app
        ? {
            publicRef: app.public_ref,
            status: formatPublicStatus(app.status, c.stage),
            version: app.version,
            lastUpdated: app.updated_at || app.submitted_at,
            isActive: !!app.is_active,
          }
        : null,
    };
  });

  const primaryRow = pickPrimaryForDuplicate(scored);
  if (!primaryRow) {
    return { exists: false, matches: [] };
  }

  const primary = matches.find((m) => m.candidateId === primaryRow.id) || matches[0];
  return {
    exists: true,
    matches,
    candidateId: primary.candidateId,
    applicationRef: primary.application?.publicRef || null,
    status: primary.application?.status || formatPublicStatus(null, primary.stage),
    lastUpdated: primary.application?.lastUpdated || primaryRow.updated_at,
    resumeAvailable: true,
    matchType: primary.matchTypes[0] || 'email',
  };
}

/**
 * Lock and re-check inside transaction to prevent race duplicates.
 */
export async function findExistingWithLock(connection, contact, formId) {
  const normalizedEmail = normalizeEmail(contact.email);
  if (normalizedEmail) {
    await connection.execute(
      `SELECT id FROM candidates WHERE LOWER(TRIM(email)) = ? LIMIT 1 FOR UPDATE`,
      [normalizedEmail]
    );
  }
  return findExistingForSubmission(
    {
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedinUrl,
      formId,
    },
    connection
  );
}
