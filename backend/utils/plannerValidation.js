/**
 * plannerValidation.js
 *
 * Field validation helpers for the HR Planner Workspace.
 * All functions accept a single value and return a boolean.
 * Validation uses trimmed length so whitespace-only strings are rejected.
 */

/**
 * Generic string length validator (used internally and exported for reuse).
 *
 * @param {*} value - The value to validate.
 * @param {number} min - Minimum allowed length (inclusive), after trimming.
 * @param {number} max - Maximum allowed length (inclusive), after trimming.
 * @returns {boolean} true if value is a non-empty string whose trimmed length
 *                    is within [min, max]; false otherwise.
 */
export function validateStringLength(value, min, max) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max;
}

/**
 * Validate a plan name.
 * Must be a non-empty string with a trimmed length of 1–100 characters.
 *
 * @param {*} name
 * @returns {boolean}
 */
export function validatePlanName(name) {
  return validateStringLength(name, 1, 100);
}

/**
 * Validate a bucket name.
 * Must be a non-empty string with a trimmed length of 1–100 characters.
 *
 * @param {*} name
 * @returns {boolean}
 */
export function validateBucketName(name) {
  return validateStringLength(name, 1, 100);
}

/**
 * Validate a task title.
 * Must be a non-empty string with a trimmed length of 1–255 characters.
 *
 * @param {*} title
 * @returns {boolean}
 */
export function validateTaskTitle(title) {
  return validateStringLength(title, 1, 255);
}

/**
 * Validate a label name.
 * Must be a non-empty string with a trimmed length of 1–50 characters.
 *
 * @param {*} name
 * @returns {boolean}
 */
export function validateLabelName(name) {
  return validateStringLength(name, 1, 50);
}

/**
 * Validate a checklist item text.
 * Must be a non-empty string with a trimmed length of 1–500 characters.
 *
 * @param {*} text
 * @returns {boolean}
 */
export function validateChecklistItem(text) {
  return validateStringLength(text, 1, 500);
}

/**
 * Validate recurrence_type: 'none' | 'daily'
 * @param {*} value
 * @returns {boolean}
 */
export function validateRecurrenceType(value) {
  return value === 'none' || value === 'daily';
}

/**
 * Validate due_time as HH:mm or HH:mm:ss (or null/empty to clear).
 * @param {*} value
 * @returns {boolean}
 */
export function validateDueTime(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value.trim());
}
