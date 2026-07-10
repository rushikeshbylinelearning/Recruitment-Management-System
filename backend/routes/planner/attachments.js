/**
 * Attachments API Routes
 *
 * Endpoints for managing file attachments on planner tasks.
 * Implements Requirement R8 (File Attachment System)
 *
 * Routes:
 * - GET    /api/planner/tasks/:taskId/attachments  - List attachments for a task
 * - POST   /api/planner/tasks/:taskId/attachments  - Upload a file
 * - GET    /api/planner/attachments/:id/download   - Download a file
 * - PUT    /api/planner/attachments/:id/rename     - Rename an attachment
 * - DELETE /api/planner/attachments/:id            - Soft-delete an attachment
 */

import express from 'express';
import multer from 'multer';
import { query } from '../../config/database.js';
import { authenticateToken as authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../middleware/errorHandler.js';
import storageService from '../../services/storageService.js';
import { logActivity } from '../../services/plannerService.js';

const router = express.Router();

// Multer configured with memoryStorage so buffer is available for storageService.saveFile()
const upload = multer({ storage: multer.memoryStorage() });

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/tasks/:taskId/attachments
 *
 * Returns all non-deleted attachments for a task, including uploader name.
 * Fields: id, original_filename, file_size, mime_type, uploaded_by, uploaded_at,
 *         uploader_name
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/tasks/:taskId/attachments',
  authenticate,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    // Verify task exists
    const tasks = await query(
      'SELECT id FROM planner_tasks WHERE id = ? AND is_deleted = 0',
      [taskId]
    );
    if (tasks.length === 0) {
      throw new NotFoundError('Task not found');
    }

    const attachments = await query(
      `SELECT
         a.id,
         a.original_filename,
         a.file_size,
         a.mime_type,
         a.uploaded_by,
         a.uploaded_at,
         u.name AS uploader_name
       FROM task_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.task_id = ? AND a.is_deleted = 0
       ORDER BY a.uploaded_at DESC`,
      [taskId]
    );

    res.json({ success: true, data: { attachments } });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/planner/tasks/:taskId/attachments
 *
 * Upload a file attachment to a task.
 * - multer single('file') middleware parses the multipart upload
 * - Validates file type/size via storageService.validateFileUpload()
 * - Saves file to disk via storageService.saveFile()
 * - Inserts metadata into task_attachments
 * - Logs 'file_uploaded' activity
 * Returns 201 with attachment metadata.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post(
  '/tasks/:taskId/attachments',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) throw new ValidationError('Invalid task ID');

    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const userId = req.user.id;

    // Verify task exists
    const tasks = await query(
      'SELECT id FROM planner_tasks WHERE id = ? AND is_deleted = 0',
      [taskId]
    );
    if (tasks.length === 0) {
      throw new NotFoundError('Task not found');
    }

    // Validate file type and size
    const validation = storageService.validateFileUpload(originalname, mimetype, size);
    if (!validation.valid) {
      throw new ValidationError(validation.error);
    }

    // Save file to disk
    const { storedFilename, filePath } = await storageService.saveFile(
      taskId,
      buffer,
      originalname,
      mimetype
    );

    // Insert attachment metadata into database
    const result = await query(
      `INSERT INTO task_attachments
         (task_id, original_filename, stored_filename, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [taskId, originalname, storedFilename, filePath, size, mimetype, userId]
    );

    const attachmentId = result.insertId;

    // Fetch the inserted row to return full metadata
    const inserted = await query(
      `SELECT
         a.id,
         a.original_filename,
         a.stored_filename,
         a.file_size,
         a.mime_type,
         a.uploaded_by,
         a.uploaded_at,
         u.name AS uploader_name
       FROM task_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.id = ?`,
      [attachmentId]
    );

    // Log activity
    await logActivity(taskId, userId, 'file_uploaded', {
      filename: originalname,
      file_size: size,
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: { attachment: inserted[0] },
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * GET /api/planner/attachments/:id/download
 *
 * Serve a file for download.
 * - Authenticates the request
 * - Fetches the file record (must not be soft-deleted)
 * - Streams the file via storageService.getFileStream()
 * - Sets Content-Disposition and Content-Type headers
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get(
  '/attachments/:id/download',
  authenticate,
  asyncHandler(async (req, res) => {
    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) throw new ValidationError('Invalid attachment ID');

    // Fetch file record
    const rows = await query(
      `SELECT id, original_filename, file_path, mime_type, is_deleted
         FROM task_attachments
        WHERE id = ? AND is_deleted = 0`,
      [attachmentId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Attachment not found');
    }

    const file = rows[0];

    // Get readable stream from storage
    const stream = await storageService.getFileStream(file.file_path);

    // Set response headers
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.original_filename}"`
    );
    res.setHeader('Content-Type', file.mime_type);

    // Pipe stream to response
    stream.pipe(res);

    // Handle stream errors
    stream.on('error', (err) => {
      console.error('[Attachments] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error reading file' });
      }
    });
  })
);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * PUT /api/planner/attachments/:id/rename
 *
 * Rename an attachment (updates original_filename only; physical file is NOT renamed).
 * Body: { newFilename: string }
 * Validates: non-empty, <= 255 characters
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* ---------------------------------------------------------------------------
 * GET /api/planner/attachments/:id/view
 *
 * Serve a file inline for in-browser viewing.
 * Also accepts ?token=<jwt> query param for iframe/img requests that
 * cannot set an Authorization header.
 * Sets Content-Disposition: inline so the browser renders viewable types
 * (PDF, images, text) instead of prompting a download.
 * --------------------------------------------------------------------------- */
router.get(
  '/attachments/:id/fetch',
  authenticate,
  asyncHandler(async (req, res) => {
    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) throw new ValidationError('Invalid attachment ID');

    const rows = await query(
      'SELECT id, original_filename, file_path, mime_type, is_deleted FROM task_attachments WHERE id = ? AND is_deleted = 0',
      [attachmentId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Attachment not found');
    }

    const file = rows[0];
    const stream = await storageService.getFileStream(file.file_path);

    // Return raw binary consumed by the JS DocViewer as an ArrayBuffer.
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('X-Filename', encodeURIComponent(file.original_filename));

    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[Attachments] Fetch stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error reading file' });
      }
    });
  })
);

router.put(
  '/attachments/:id/rename',
  authenticate,
  asyncHandler(async (req, res) => {
    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) throw new ValidationError('Invalid attachment ID');

    const { newFilename } = req.body;

    if (!newFilename || typeof newFilename !== 'string' || newFilename.trim().length === 0) {
      throw new ValidationError('newFilename is required and must be a non-empty string');
    }

    // Strip path separators (both forward and back slash) to prevent path traversal
    const sanitizedFilename = newFilename.trim().replace(/[/\\]/g, '');

    if (sanitizedFilename.length === 0) {
      throw new ValidationError('newFilename must contain valid characters');
    }

    if (sanitizedFilename.length > 255) {
      throw new ValidationError('newFilename must be 255 characters or fewer');
    }

    // Verify attachment exists and is not deleted
    const rows = await query(
      'SELECT id FROM task_attachments WHERE id = ? AND is_deleted = 0',
      [attachmentId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Attachment not found');
    }

    // Update only the original_filename — never rename the physical file
    await query(
      `UPDATE task_attachments
          SET original_filename = ?, updated_at = NOW()
        WHERE id = ?`,
      [sanitizedFilename, attachmentId]
    );

    res.json({ success: true, message: 'Attachment renamed successfully' });
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
 * DELETE /api/planner/attachments/:id
 *
 * Soft-delete an attachment.
 * - Checks is_deleted = 0
 * - Verifies requester is uploader OR has Admin role
 * - Sets is_deleted = 1
 * - Logs 'file_deleted' activity
 * ───────────────────────────────────────────────────────────────────────────── */
router.delete(
  '/attachments/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) throw new ValidationError('Invalid attachment ID');

    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch attachment record
    const rows = await query(
      `SELECT id, task_id, original_filename, uploaded_by, is_deleted
         FROM task_attachments
        WHERE id = ? AND is_deleted = 0`,
      [attachmentId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Attachment not found');
    }

    const attachment = rows[0];

    // Check ownership: must be uploader or Admin
    if (userRole !== 'Admin' && attachment.uploaded_by !== userId) {
      throw new ForbiddenError('You do not have permission to delete this attachment');
    }

    // Soft-delete
    await query(
      `UPDATE task_attachments
          SET is_deleted = 1, updated_at = NOW()
        WHERE id = ?`,
      [attachmentId]
    );

    // Log activity
    await logActivity(attachment.task_id, userId, 'file_deleted', {
      filename: attachment.original_filename,
    });

    res.json({ success: true, message: 'Attachment deleted successfully' });
  })
);

export default router;
