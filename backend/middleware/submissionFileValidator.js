/**
 * Submission file validation middleware (task 4.2)
 *
 * Validates files uploaded via multer for the public submission endpoint:
 *   - Requires at least one file (before any DB writes)
 *   - Rejects unsupported MIME types with HTTP 400 and list of accepted types
 *   - Enforces configurable max file size via MAX_UPLOAD_SIZE_MB env var (default 50 MB)
 *
 * Requirements: 6.2, 6.3, 6.4, 6.6, 11.4, 11.5
 */

import fs from 'fs/promises';

export const ACCEPTED_MIME_TYPES = [
  'video/mp4',
  'image/png',
  'image/jpeg',
  'application/pdf',
];

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Middleware: validates uploaded files after multer has written them to disk.
 * Cleans up rejected files before responding.
 */
export async function validateSubmissionFiles(req, res, next) {
  const files = req.files || [];

  // Requirement 6.6: at least one file required before any DB writes
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one file is required.',
    });
  }

  const invalidMime = [];
  const oversized = [];

  for (const file of files) {
    // Requirement 6.2 / 11.5: backend MIME type check (uses multer-provided mimetype)
    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      invalidMime.push(file.originalname);
    }

    // Requirement 6.4: max file size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      oversized.push(file.originalname);
    }
  }

  if (invalidMime.length > 0 || oversized.length > 0) {
    // Clean up all uploaded files before rejecting
    await cleanupFiles(files);

    if (invalidMime.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type(s): ${invalidMime.join(', ')}. Accepted types: ${ACCEPTED_MIME_TYPES.join(', ')}.`,
        acceptedTypes: ACCEPTED_MIME_TYPES,
      });
    }

    // oversized
    return res.status(400).json({
      success: false,
      message: `File(s) exceed the maximum allowed size of ${MAX_FILE_SIZE_MB} MB: ${oversized.join(', ')}.`,
    });
  }

  next();
}

async function cleanupFiles(files) {
  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch {
      // best-effort
    }
  }
}
