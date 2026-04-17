/**
 * Data Normalizer Service
 * 
 * Cleans and standardizes candidate data before insertion.
 * Handles text normalization, email/phone formatting, experience parsing, and skills parsing.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 12.3, 12.4
 */

/**
 * Normalize a candidate row
 * @param {Object} row - Raw candidate data
 * @returns {Object} NormalizedRow with normalized, original, and warnings
 */
function normalize(row) {
  const normalized = {};
  const original = { ...row };
  const warnings = [];

  // Normalize each field
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || value === '') {
      normalized[key] = null;
      continue;
    }

    switch (key) {
      case 'name':
      case 'position':
      case 'location':
      case 'notes':
      case 'source':
      case 'resume':
        normalized[key] = normalizeText(value);
        break;

      case 'email':
        const emailResult = normalizeEmail(value);
        normalized[key] = emailResult.normalized;
        if (emailResult.warning) {
          warnings.push(`Row email: ${emailResult.warning}`);
        }
        break;

      case 'phone':
        const phoneResult = normalizePhone(value);
        normalized[key] = phoneResult.normalized;
        if (phoneResult.warning) {
          warnings.push(`Row phone: ${phoneResult.warning}`);
        }
        break;

      case 'experience':
        const expResult = parseExperience(value);
        normalized[key] = expResult.value;
        if (expResult.warning) {
          warnings.push(`Row experience: ${expResult.warning}`);
        }
        break;

      case 'skills':
        normalized[key] = parseSkills(value);
        break;

      default:
        // For other fields, just normalize text if it's a string
        normalized[key] = typeof value === 'string' ? normalizeText(value) : value;
    }
  }

  return {
    normalized,
    original,
    warnings
  };
}

/**
 * Normalize text fields (trim and collapse spaces)
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (typeof text !== 'string') return text;
  
  // Trim leading/trailing whitespace and collapse multiple spaces to single space
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Normalize email address
 * @param {string} email - Email to normalize
 * @returns {Object} { normalized, warning }
 */
function normalizeEmail(email) {
  if (typeof email !== 'string') {
    return { normalized: null, warning: 'Email is not a string' };
  }

  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return {
      normalized,
      warning: `Invalid email format: ${email}`
    };
  }

  return { normalized, warning: null };
}

/**
 * Normalize phone number
 * @param {string} phone - Phone to normalize
 * @returns {Object} { normalized, warning }
 */
function normalizePhone(phone) {
  if (typeof phone !== 'string') {
    return { normalized: null, warning: 'Phone is not a string' };
  }

  const trimmed = phone.trim();
  
  // Remove all non-digit characters except leading +
  let normalized = trimmed.replace(/[^\d+]/g, '');
  
  // Ensure + only appears at the start
  if (normalized.includes('+')) {
    const parts = normalized.split('+');
    normalized = '+' + parts.filter(p => p).join('');
  }

  // Validate that we have at least some digits
  const digitCount = (normalized.match(/\d/g) || []).length;
  if (digitCount === 0) {
    return {
      normalized: null,
      warning: `Invalid phone number (no digits): ${phone}`
    };
  }

  if (digitCount < 10) {
    return {
      normalized,
      warning: `Phone number may be incomplete (${digitCount} digits): ${phone}`
    };
  }

  return { normalized, warning: null };
}

/**
 * Parse experience text to numeric value
 * @param {string|number} experienceText - Experience text or number
 * @returns {Object} { value, warning }
 */
function parseExperience(experienceText) {
  // If already a number, return it
  if (typeof experienceText === 'number') {
    return { value: Math.floor(experienceText), warning: null };
  }

  if (typeof experienceText !== 'string') {
    return { value: null, warning: 'Experience is not a string or number' };
  }

  const trimmed = experienceText.trim();

  // Try to parse patterns like "3 yrs", "2+ years", "5 years", "3-5 years"
  const regex = /(\d+)[\s\-+]*(?:yrs?|years?)?/i;
  const match = trimmed.match(regex);

  if (match) {
    const value = parseInt(match[1], 10);
    return { value, warning: null };
  }

  // Could not parse
  return {
    value: null,
    warning: `Could not parse experience value: ${experienceText}`
  };
}

/**
 * Parse skills from comma or semicolon separated string
 * @param {string|Array} skillsText - Skills text or array
 * @returns {Array|null} Array of skills or null
 */
function parseSkills(skillsText) {
  if (Array.isArray(skillsText)) {
    return skillsText.map(s => normalizeText(String(s))).filter(s => s);
  }

  if (typeof skillsText !== 'string') {
    return null;
  }

  const trimmed = skillsText.trim();
  if (!trimmed) return null;

  // Split by comma or semicolon
  const delimiter = trimmed.includes(';') ? ';' : ',';
  const skills = trimmed
    .split(delimiter)
    .map(s => normalizeText(s))
    .filter(s => s);

  return skills.length > 0 ? skills : null;
}

export {
  normalize,
  normalizeText,
  normalizeEmail,
  normalizePhone,
  parseExperience,
  parseSkills
};
