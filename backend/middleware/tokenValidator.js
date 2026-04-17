import crypto from 'crypto';
import { query } from '../config/database.js';

/**
 * Token Validator Middleware
 * Validates form access tokens for public form submissions
 * Requirements: 1.2, 1.3, 5.1, 11.4
 */

/**
 * Generate a secure access token
 * Generates a 32-character alphanumeric token using crypto.randomBytes
 * 
 * @returns {string} 32-character alphanumeric token
 */
export const generateToken = () => {
  // Generate enough random bytes to ensure we get 32 alphanumeric characters
  // Base64 encoding can produce non-alphanumeric chars, so we generate extra
  let token = '';
  while (token.length < 32) {
    const buffer = crypto.randomBytes(24);
    const base64 = buffer.toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    token += base64;
  }
  return token.substring(0, 32);
};

/**
 * Validate token format
 * Checks if token is alphanumeric and at least 16 characters
 * 
 * @param {string} token - Token to validate
 * @returns {boolean} True if token format is valid
 */
const isValidTokenFormat = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Check minimum length (16 characters)
  if (token.length < 16) {
    return false;
  }
  
  // Check alphanumeric only
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(token);
};

/**
 * Middleware: Validate form access token
 * Verifies token format and matches against form's stored access_token
 * 
 * Usage: Apply to public form routes
 * Example: router.get('/api/public/forms/:slug', validateToken, handler)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const validateToken = async (req, res, next) => {
  try {
    // Extract token from query parameters
    const token = req.query.token;
    const formSlug = req.params.slug;

    // Check if token is provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Query database to verify token matches form's access_token
    const forms = await query(
      'SELECT id, name, slug, is_active, access_token, token_validity_hours, token_expires_at FROM forms WHERE slug = ? AND access_token = ?',
      [formSlug, token]
    );

    // Check if form exists with matching token
    if (forms.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const form = forms[0];

    // Check if form is active
    if (!form.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This form is no longer accepting submissions'
      });
    }

    // If token has expired, renew it to keep public links usable.
    // This effectively makes expiry a rolling window based on last valid access.
    if (form.token_expires_at && new Date(form.token_expires_at) < new Date()) {
      const tokenValidityHours = Number(form.token_validity_hours) > 0 ? Number(form.token_validity_hours) : 24;
      await query(
        'UPDATE forms SET token_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id = ?',
        [tokenValidityHours, form.id]
      );
      form.token_expires_at = null;
    }

    // Attach form data to request for downstream handlers
    req.form = form;
    
    next();
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Token validation failed'
    });
  }
};

/**
 * Verify token for a specific form (utility function)
 * Can be used outside of middleware context
 * 
 * @param {string} formSlug - Form slug identifier
 * @param {string} token - Access token to verify
 * @returns {Promise<Object|null>} Form object if valid, null otherwise
 */
export const verifyFormToken = async (formSlug, token) => {
  try {
    // Validate token format first
    if (!isValidTokenFormat(token)) {
      return null;
    }

    // Query database
    const forms = await query(
      'SELECT id, name, slug, is_active, access_token, token_validity_hours, token_expires_at FROM forms WHERE slug = ? AND access_token = ?',
      [formSlug, token]
    );

    if (forms.length === 0) {
      return null;
    }

    const form = forms[0];

    // Check if form is active
    if (!form.is_active) {
      return null;
    }

    if (form.token_expires_at && new Date(form.token_expires_at) < new Date()) {
      const tokenValidityHours = Number(form.token_validity_hours) > 0 ? Number(form.token_validity_hours) : 24;
      await query(
        'UPDATE forms SET token_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id = ?',
        [tokenValidityHours, form.id]
      );
    }

    return form;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};
