/**
 * Conflict Detector Service
 * Checks for scheduling conflicts for a given interviewer time window.
 */

import { query } from '../config/database.js';

/**
 * Check if a proposed interview slot conflicts with existing interviews.
 *
 * @param {number} interviewerId - The user ID of the interviewer
 * @param {string} date - Interview date in 'YYYY-MM-DD' format
 * @param {string} time - Interview start time in 'HH:MM' or 'HH:MM:SS' format
 * @param {number} durationMinutes - Duration of the proposed interview in minutes
 * @param {number} [excludeId] - Interview ID to exclude (for reschedule use case)
 * @returns {Promise<{ hasConflict: false } | { hasConflict: true, conflictingDate: string, conflictingTime: string }>}
 */
export async function checkConflict(interviewerId, date, time, durationMinutes, excludeId) {
  // Build the SQL to find overlapping interviews.
  // Overlap condition: existing_start < requested_end AND existing_end > requested_start
  // We compute end times using ADDTIME with a formatted interval string.
  let sql = `
    SELECT date, time
    FROM interviews
    WHERE interviewer_id = ?
      AND date = ?
      AND status IN ('Scheduled', 'In Progress')
      AND ADDTIME(time, SEC_TO_TIME(duration * 60)) > ?
      AND time < ADDTIME(?, SEC_TO_TIME(? * 60))
  `;

  const params = [interviewerId, date, time, time, durationMinutes];

  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  sql += ' LIMIT 1';

  const rows = await query(sql, params);

  if (rows.length === 0) {
    return { hasConflict: false };
  }

  const conflict = rows[0];
  // Normalise time to HH:MM (strip seconds if present)
  const conflictingTime = String(conflict.time).substring(0, 5);
  const conflictingDate = conflict.date instanceof Date
    ? conflict.date.toISOString().substring(0, 10)
    : String(conflict.date);

  return {
    hasConflict: true,
    conflictingDate,
    conflictingTime,
  };
}
