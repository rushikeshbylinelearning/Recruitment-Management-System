import crypto from 'crypto';
import { query } from '../config/database.js';
import { getFrontendBaseUrl } from '../utils/frontendUrl.js';

/**
 * Generates a cryptographically secure 64-character hex token.
 * Retries on collision (checks uniqueness against candidate_assignments table).
 * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
 * @returns {Promise<string>} A unique 64-character hex token
 */
export async function generateToken(maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const token = crypto.randomBytes(32).toString('hex');
    const rows = await query(
      'SELECT id FROM candidate_assignments WHERE token = ? LIMIT 1',
      [token]
    );
    if (rows.length === 0) {
      return token;
    }
  }
  throw new Error('Failed to generate a unique token after maximum retries');
}

/**
 * Builds the candidate submission link (full URL for emails, relative path for storage).
 * @param {number|string} candidateId
 * @param {string} token
 * @returns {string} Full submission URL
 */
export function buildSubmissionLink(candidateId, token) {
  return `${getFrontendBaseUrl()}/submit-assignment/${candidateId}/${token}`;
}

/**
 * Computes the expiry timestamp as a UTC Date.
 * @param {Date|number} submissionTime - The time the assignment was sent (Date or ms timestamp)
 * @param {number} durationHours - Duration in hours until expiry
 * @returns {Date} UTC expiry timestamp
 */
export function computeExpiryAt(submissionTime, durationHours) {
  const base = submissionTime instanceof Date ? submissionTime.getTime() : submissionTime;
  return new Date(base + durationHours * 3600000);
}
