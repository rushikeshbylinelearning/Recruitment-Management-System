/**
 * htmlSanitizer.js
 *
 * Utility functions for sanitizing HTML content and filenames.
 * Uses DOMPurify with a JSDOM window for Node.js server-side sanitization.
 *
 * Requirements: R7 (Task Notes with Rich Text), R15 (Security)
 */

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import path from 'path';

// Create a DOMPurify instance bound to a JSDOM window object.
// JSDOM provides the DOM environment that DOMPurify requires to run in Node.js.
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Allowed HTML tags for rich text notes.
 * Scripts, event handlers, and unsafe attributes are stripped automatically.
 */
const ALLOWED_TAGS = [
  'strong', 'em', 'u', 'ul', 'ol', 'li',
  'a', 'p', 'br',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre', 'span', 'div',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

/**
 * Sanitize an HTML string for safe storage and rendering.
 *
 * - Strips <script> tags and all inline event handlers (onerror, onload, etc.)
 * - Strips javascript: URLs
 * - Allows safe formatting tags (strong, em, ul, ol, li, a, p, br, h1–h6, etc.)
 * - Never throws; returns empty string for null/undefined input
 *
 * @param {string|null|undefined} input - Raw HTML string from a rich text editor
 * @returns {string} Sanitized HTML string, safe for storage and rendering
 */
export function sanitizeHtml(input) {
  if (input === null || input === undefined) {
    return '';
  }

  try {
    const result = purify.sanitize(String(input), {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
    });

    return result;
  } catch {
    // If sanitization fails for any reason, return empty string to be safe
    return '';
  }
}

/**
 * Sanitize a filename to prevent directory traversal and path injection attacks.
 *
 * - Uses path.basename() to strip any directory components
 * - Removes all occurrences of '..' sequences
 * - Removes leading and trailing slashes
 * - Replaces multiple consecutive spaces with a single space
 * - Trims whitespace
 * - Returns empty string if the result is empty after sanitization
 * - Never throws; returns empty string for null/undefined input
 *
 * @param {string|null|undefined} filename - Original filename from user input
 * @returns {string} Sanitized filename safe for filesystem use
 */
export function sanitizeFilename(filename) {
  if (filename === null || filename === undefined) {
    return '';
  }

  try {
    let name = String(filename);

    // Use path.basename() to strip directory components (handles both / and \ separators)
    name = path.basename(name);

    // Remove all '..' sequences (path traversal attack prevention)
    name = name.replace(/\.\./g, '');

    // Remove leading and trailing slashes (both forward and backward)
    name = name.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');

    // Remove any remaining slash characters embedded in the name
    name = name.replace(/[/\\]/g, '');

    // Replace multiple consecutive spaces with a single space
    name = name.replace(/ {2,}/g, ' ');

    // Trim any leading/trailing whitespace
    name = name.trim();

    return name;
  } catch {
    // If sanitization fails for any reason, return empty string
    return '';
  }
}
