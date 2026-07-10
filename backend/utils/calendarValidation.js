/**
 * Calendar Validation Utilities
 */

const VALID_EVENT_TYPES = [
  'meeting', 'deadline', 'reminder', 'follow_up', 'interview',
  'holiday', 'leave', 'birthday', 'custom',
];

const VALID_REMINDER_TYPES = [
  '5min', '10min', '15min', '30min', '1hour', '2hours', 'tomorrow', 'next_week', 'custom',
];

const VALID_RECURRENCE = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];

export function validateEventTitle(title) {
  if (!title || typeof title !== 'string') return { valid: false, error: 'Title is required' };
  const trimmed = title.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Title cannot be empty' };
  if (trimmed.length > 255) return { valid: false, error: 'Title must be 255 characters or less' };
  return { valid: true, value: trimmed };
}

export function validateDate(dateStr, fieldName = 'Date') {
  if (!dateStr) return { valid: false, error: `${fieldName} is required` };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { valid: false, error: `Invalid ${fieldName.toLowerCase()}` };
  return { valid: true, value: dateStr.split('T')[0] };
}

export function validateTime(timeStr) {
  if (!timeStr) return { valid: true, value: null };
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return { valid: false, error: 'Invalid time format (HH:MM)' };
  }
  return { valid: true, value: timeStr.length === 5 ? `${timeStr}:00` : timeStr };
}

export function validateColour(colour) {
  if (!colour) return { valid: true, value: null };
  if (!/^#[0-9A-Fa-f]{6}$/.test(colour)) {
    return { valid: false, error: 'Colour must be a valid hex code (#RRGGBB)' };
  }
  return { valid: true, value: colour };
}

export function validateCategorySlug(slug) {
  if (!slug || !VALID_EVENT_TYPES.includes(slug)) {
    return { valid: false, error: `Invalid category. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` };
  }
  return { valid: true, value: slug };
}

export function validateReminderType(type) {
  if (!type) return { valid: true, value: null };
  if (!VALID_REMINDER_TYPES.includes(type)) {
    return { valid: false, error: 'Invalid reminder type' };
  }
  return { valid: true, value: type };
}

export function validateRecurrenceFrequency(freq) {
  if (!freq) return { valid: true, value: null };
  if (!VALID_RECURRENCE.includes(freq)) {
    return { valid: false, error: 'Invalid recurrence frequency' };
  }
  return { valid: true, value: freq };
}

export function parseDateRange(start, end) {
  const startResult = validateDate(start, 'Start date');
  if (!startResult.valid) return startResult;
  const endResult = validateDate(end, 'End date');
  if (!endResult.valid) return endResult;
  if (startResult.value > endResult.value) {
    return { valid: false, error: 'Start date must be before end date' };
  }
  return { valid: true, start: startResult.value, end: endResult.value };
}

export { VALID_EVENT_TYPES, VALID_REMINDER_TYPES, VALID_RECURRENCE };
