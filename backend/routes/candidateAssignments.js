import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { generateToken, buildSubmissionLink, computeExpiryAt } from '../services/tokenService.js';
import emailService from '../services/emailService.js';
import { body, param } from 'express-validator';
import { handleValidationErrors, validateId } from '../middleware/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads/resumes');

const router = express.Router();

// Validation rules for POST
const validateDispatch = [
  body('candidateId').isString().notEmpty().withMessage('candidateId is required'),
  body('assignmentIds')
    .isArray({ min: 1 })
    .withMessage('assignmentIds must be a non-empty array'),
  body('assignmentIds.*').isInt({ min: 1 }).withMessage('Each assignmentId must be a valid integer'),
  body('deadline').isISO8601().withMessage('deadline must be a valid ISO 8601 date'),
  body('expiryDuration').isInt({ min: 1 }).withMessage('expiryDuration must be a positive integer (hours)'),
  body('emailBody').isString().notEmpty().withMessage('emailBody is required'),
  body('singleUse').isBoolean().withMessage('singleUse must be a boolean'),
  body('autoAdvance').isBoolean().withMessage('autoAdvance must be a boolean'),
  body('notifications').isObject().withMessage('notifications must be an object'),
  body('notifications.deadlineReminder').isBoolean().withMessage('notifications.deadlineReminder must be a boolean'),
  body('notifications.expiryWarning').isBoolean().withMessage('notifications.expiryWarning must be a boolean'),
  body('notifications.submissionAlert').isBoolean().withMessage('notifications.submissionAlert must be a boolean'),
];

const validateStatusUpdate = [
  body('status')
    .isIn(['Assigned', 'Submitted', 'Overdue', 'Reviewed'])
    .withMessage('status must be one of: Assigned, Submitted, Overdue, Reviewed'),
];

// POST /api/candidate-assignments
// Create one record per selected assignment, generate tokens, dispatch emails
router.post(
  '/',
  authenticateToken,
  validateDispatch,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const {
      candidateId,
      assignmentIds,
      deadline,
      expiryDuration,
      emailBody,
      customSlug,
      singleUse,
      autoAdvance,
      notifications,
    } = req.body;

    const assignedBy = req.user.id;

    // Verify candidate exists and has an email
    const candidates = await query(
      'SELECT id, name, email FROM candidates WHERE id = ?',
      [candidateId]
    );
    if (candidates.length === 0) {
      throw new ValidationError('Candidate not found');
    }
    const candidate = candidates[0];
    if (!candidate.email) {
      throw new ValidationError('Candidate does not have an email address');
    }

    // Verify all assignments exist
    const placeholders = assignmentIds.map(() => '?').join(', ');
    const existingAssignments = await query(
      `SELECT id, title FROM assignments WHERE id IN (${placeholders})`,
      assignmentIds
    );
    if (existingAssignments.length !== assignmentIds.length) {
      throw new ValidationError('One or more assignment IDs are invalid');
    }

    const assignmentMap = Object.fromEntries(existingAssignments.map(a => [a.id, a]));
    const now = new Date();
    const expiryAt = computeExpiryAt(now, expiryDuration);
    const createdRecords = [];

    for (const assignmentId of assignmentIds) {
      const token = await generateToken();
      const submissionLink = buildSubmissionLink(candidateId, token);

      const result = await query(
        `INSERT INTO candidate_assignments
          (candidate_id, assignment_id, assigned_by, token, submission_link, status,
           deadline, expiry_at, single_use, auto_advance, email_body, custom_slug,
           notify_deadline, notify_expiry, notify_submission, email_status)
         VALUES (?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
        [
          candidateId,
          assignmentId,
          assignedBy,
          token,
          submissionLink,
          deadline,
          expiryAt,
          singleUse ? 1 : 0,
          autoAdvance ? 1 : 0,
          emailBody,
          customSlug || null,
          notifications.deadlineReminder ? 1 : 0,
          notifications.expiryWarning ? 1 : 0,
          notifications.submissionAlert ? 1 : 0,
        ]
      );

      createdRecords.push({
        id: result.insertId,
        assignmentId,
        assignmentTitle: assignmentMap[assignmentId]?.title,
        token,
        submissionLink,
      });
    }

    // Dispatch email — substitute template variables in emailBody
    const submissionLinks = createdRecords.map(r => r.submissionLink).join('\n');

    // Build expiry warning string
    const expiryDate = new Date(expiryAt);
    const expiryWarning = `Your submission link will expire on ${expiryDate.toLocaleString()}.`;

    const variables = {
      candidate_name: candidate.name,
      submission_link: submissionLinks,
      deadline: new Date(deadline).toLocaleString(),
      expiry_warning: expiryWarning,
    };

    // Substitute all template variables
    let processedBody = emailBody;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedBody = processedBody.replace(regex, variables[key]);
    });

    // Fetch assignment file attachments from file_uploads
    const allAttachmentIds = existingAssignments.map(a => a.id);
    const attachPlaceholders = allAttachmentIds.map(() => '?').join(', ');
    const attachmentRows = await query(
      `SELECT filename, original_name, file_path FROM file_uploads WHERE assignment_id IN (${attachPlaceholders})`,
      allAttachmentIds
    );

    // Resolve file paths — use stored path, fall back to resolved path
    const emailAttachments = attachmentRows
      .map(file => {
        const resolvedPath = path.join(uploadsDir, file.filename);
        const finalPath = fs.existsSync(resolvedPath) ? resolvedPath : file.file_path;
        if (!fs.existsSync(finalPath)) {
          console.warn(`[candidateAssignments] Attachment not found: ${file.original_name}`);
          return null;
        }
        return { filename: file.original_name, path: finalPath };
      })
      .filter(Boolean);

    console.log(`[candidateAssignments] Sending email with ${emailAttachments.length} attachment(s)`);

    const htmlBody = processedBody.replace(/\n/g, '<br>');
    const emailResult = await emailService.sendEmail({
      to: candidate.email,
      subject: 'Your Assignment(s) Are Ready',
      text: processedBody,
      html: htmlBody,
      attachments: emailAttachments,
    });

    // Update email_status on all created records
    if (createdRecords.length > 0) {
      const ids = createdRecords.map(r => r.id);
      const idPlaceholders = ids.map(() => '?').join(', ');
      const newEmailStatus = emailResult.success ? 'Sent' : 'Failed';
      await query(
        `UPDATE candidate_assignments SET email_status = ? WHERE id IN (${idPlaceholders})`,
        [newEmailStatus, ...ids]
      );
    }

    res.status(201).json({
      success: true,
      data: createdRecords,
    });
  })
);

// GET /api/candidate-assignments
// List with optional filters: status, candidateId, overdue
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { status, candidateId, overdue } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (candidateId) {
      whereClause += ' AND ca.candidate_id = ?';
      params.push(candidateId);
    }

    if (status) {
      whereClause += ' AND ca.status = ?';
      params.push(status);
    }

    // Overdue: deadline has passed and status is not Submitted
    if (overdue === 'true') {
      whereClause += " AND NOW() > ca.deadline AND ca.status != 'Submitted'";
    }

    const records = await query(
      `SELECT
         ca.*,
         c.name  AS candidate_name,
         c.email AS candidate_email,
         a.title AS assignment_title,
         CASE
           WHEN NOW() > ca.deadline AND ca.status != 'Submitted' THEN 1
           ELSE 0
         END AS is_overdue
       FROM candidate_assignments ca
       LEFT JOIN candidates  c ON ca.candidate_id  = c.id
       LEFT JOIN assignments a ON ca.assignment_id = a.id
       ${whereClause}
       ORDER BY ca.created_at DESC`,
      params
    );

    res.json({ success: true, data: records });
  })
);

// GET /api/candidate-assignments/:id
// Single record with file references
router.get(
  '/:id',
  authenticateToken,
  validateId('id'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const records = await query(
      `SELECT
         ca.*,
         c.name  AS candidate_name,
         c.email AS candidate_email,
         a.title AS assignment_title,
         CASE
           WHEN NOW() > ca.deadline AND ca.status != 'Submitted' THEN 1
           ELSE 0
         END AS is_overdue
       FROM candidate_assignments ca
       LEFT JOIN candidates  c ON ca.candidate_id  = c.id
       LEFT JOIN assignments a ON ca.assignment_id = a.id
       WHERE ca.id = ?`,
      [id]
    );

    if (records.length === 0) {
      throw new NotFoundError('Candidate assignment not found');
    }

    // Fetch associated submitted files
    const files = await query(
      `SELECT id, stored_filename, original_filename, mime_type, file_size, storage_path, uploaded_at
       FROM candidate_assignment_files
       WHERE candidate_assignment_id = ?
       ORDER BY uploaded_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: { ...records[0], files },
    });
  })
);

// PATCH /api/candidate-assignments/:id/status
// HR status update (e.g., Reviewed)
router.patch(
  '/:id/status',
  authenticateToken,
  validateId('id'),
  validateStatusUpdate,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const records = await query(
      'SELECT id FROM candidate_assignments WHERE id = ?',
      [id]
    );
    if (records.length === 0) {
      throw new NotFoundError('Candidate assignment not found');
    }

    await query(
      'UPDATE candidate_assignments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: 'Status updated successfully',
    });
  })
);

// DELETE /api/candidate-assignments/:id
// Delete a candidate assignment submission
router.delete(
  '/:id',
  authenticateToken,
  validateId('id'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if the assignment exists
    const records = await query(
      'SELECT id FROM candidate_assignments WHERE id = ?',
      [id]
    );
    if (records.length === 0) {
      throw new NotFoundError('Candidate assignment not found');
    }

    // Get associated files to delete from filesystem
    const files = await query(
      'SELECT stored_filename, storage_path FROM candidate_assignment_files WHERE candidate_assignment_id = ?',
      [id]
    );

    // Delete file records from database
    await query(
      'DELETE FROM candidate_assignment_files WHERE candidate_assignment_id = ?',
      [id]
    );

    // Delete the candidate assignment record
    await query(
      'DELETE FROM candidate_assignments WHERE id = ?',
      [id]
    );

    // Delete physical files from filesystem
    const uploadsDir = path.resolve(__dirname, '../uploads/assignment-submissions');
    for (const file of files) {
      try {
        const filePath = path.join(uploadsDir, file.stored_filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Error deleting file ${file.stored_filename}:`, err);
      }
    }

    res.json({
      success: true,
      message: 'Candidate assignment deleted successfully',
    });
  })
);

export default router;
