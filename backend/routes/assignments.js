import express from 'express';
import multer from 'multer';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateId, validateUUID, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { body, param } from 'express-validator';
import fileStorageService from '../services/fileStorage.js';
import emailService from '../services/emailService.js';
import { asyncHandler, NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';
import fs from 'fs';
import path from 'path';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const router = express.Router();

// Assignment validation rules
const validateAssignment = [
  body('candidateId')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('Candidate ID must be a valid UUID'),
  
  body('jobId')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Job ID must be a valid integer'),
  
  body('title')
    .optional()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .trim(),
  
  body('descriptionHtml')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  
  body('status')
    .optional()
    .isIn(['Draft', 'Assigned', 'In Progress', 'Submitted', 'Approved', 'Rejected', 'Cancelled'])
    .withMessage('Invalid status'),
  
  body('dueDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Due date must be a valid date')
];

const validateAssignmentStatus = [
  body('status')
    .isIn(['Draft', 'Assigned', 'In Progress', 'Submitted', 'Approved', 'Rejected', 'Cancelled'])
    .withMessage('Invalid status')
];

// Stricter validation for create — title is required
const validateCreateAssignment = [
  ...validateAssignment.filter(v => true), // reuse all rules
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .trim(),
];

// Get all assignments
router.get('/', authenticateToken, checkPermission('assignments', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const candidateId = req.query.candidateId || '';
  const jobId = req.query.jobId || '';
  const dueBefore = req.query.dueBefore || '';
  const dueAfter = req.query.dueAfter || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (a.title LIKE ? OR c.name LIKE ? OR c.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    whereClause += ' AND a.status = ?';
    params.push(status);
  }

  if (candidateId) {
    whereClause += ' AND a.candidate_id = ?';
    params.push(candidateId);
  }

  if (jobId) {
    whereClause += ' AND a.job_id = ?';
    params.push(jobId);
  }

  if (dueBefore) {
    whereClause += ' AND a.due_date <= ?';
    params.push(dueBefore);
  }

  if (dueAfter) {
    whereClause += ' AND a.due_date >= ?';
    params.push(dueAfter);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM assignments a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN job_postings j ON a.job_id = j.id
     ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get assignments
  const assignments = await query(
    `SELECT a.*, 
            c.name as candidate_name, c.email as candidate_email,
            j.title as job_title,
            u.name as assigned_by_name,
            (SELECT COUNT(*) FROM file_uploads f WHERE f.assignment_id = a.id) as attachment_count,
            (SELECT MAX(created_at) FROM communications comm WHERE comm.assignment_id = a.id) as last_sent
     FROM assignments a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN job_postings j ON a.job_id = j.id
     LEFT JOIN users u ON a.assigned_by = u.id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: assignments,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}));

// Create new assignment
router.post('/', authenticateToken, checkPermission('assignments', 'create'), validateCreateAssignment, handleValidationErrors, asyncHandler(async (req, res) => {
  const { candidateId, jobId, title, descriptionHtml, dueDate } = req.body;
  const assignedBy = req.user.id;

  // Verify candidate exists if provided
  if (candidateId) {
    const candidates = await query('SELECT id, name, email FROM candidates WHERE id = ?', [candidateId]);
    if (candidates.length === 0) {
      throw new ValidationError('Candidate not found');
    }
  }

  // Verify job exists if provided
  if (jobId) {
    const jobs = await query('SELECT id, title FROM job_postings WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
      throw new ValidationError('Job not found');
    }
  }

  const result = await query(
    `INSERT INTO assignments (candidate_id, job_id, assigned_by, title, description_html, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Draft')`,
    [candidateId || null, jobId || null, assignedBy, title, descriptionHtml || null, dueDate || null]
  );

  const assignmentId = result.insertId;

  // Sync candidate's inHouseAssignmentStatus only if a candidate is linked
  if (candidateId) {
    await query(
      `UPDATE candidates SET in_house_assignment_status = 'Assigned', updated_at = NOW() WHERE id = ?`,
      [candidateId]
    );
  }

  // Get the created assignment
  const assignments = await query(
    `SELECT a.*, 
            c.name as candidate_name, c.email as candidate_email,
            j.title as job_title,
            u.name as assigned_by_name
     FROM assignments a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN job_postings j ON a.job_id = j.id
     LEFT JOIN users u ON a.assigned_by = u.id
     WHERE a.id = ?`,
    [assignmentId]
  );

  res.status(201).json({
    success: true,
    message: 'Assignment created successfully',
    data: assignments[0]
  });
}));

// Get single assignment
router.get('/:id', authenticateToken, checkPermission('assignments', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;

  const assignments = await query(
    `SELECT a.*, 
            c.name as candidate_name, c.email as candidate_email,
            j.title as job_title,
            u.name as assigned_by_name
     FROM assignments a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN job_postings j ON a.job_id = j.id
     LEFT JOIN users u ON a.assigned_by = u.id
     WHERE a.id = ?`,
    [assignmentId]
  );

  if (assignments.length === 0) {
    throw new NotFoundError('Assignment not found');
  }

  // Get admin-uploaded attachments (file_uploads table) — only those that exist on disk
  const adminFilesRaw = await query(
    `SELECT id, filename, original_name, file_size, mime_type, uploaded_at, file_path, 'admin' as source
     FROM file_uploads 
     WHERE assignment_id = ?`,
    [assignmentId]
  );

  // Filter to files that actually exist on disk; delete stale records silently
  const adminFiles = [];
  for (const f of adminFilesRaw) {
    const p1 = f.file_path;
    const p2 = fileStorageService.getFilePath(f.filename);
    const exists = (p1 && fs.existsSync(p1)) || fs.existsSync(p2);
    if (exists) {
      adminFiles.push(f);
    } else {
      // Stale record — remove it so it doesn't show up again
      await query('DELETE FROM file_uploads WHERE id = ?', [f.id]).catch(() => {});
    }
  }

  // Get candidate submission files (candidate_assignment_files table) — only those on disk
  const submissionFilesRaw = await query(
    `SELECT caf.id, caf.stored_filename as filename, caf.original_filename as original_name,
            caf.file_size, caf.mime_type, caf.uploaded_at, caf.storage_path as file_path,
            'submission' as source
     FROM candidate_assignment_files caf
     INNER JOIN candidate_assignments ca ON caf.candidate_assignment_id = ca.id
     WHERE ca.assignment_id = ?
     ORDER BY caf.uploaded_at DESC`,
    [assignmentId]
  );

  const submissionFiles = [];
  for (const f of submissionFilesRaw) {
    const exists = f.file_path && fs.existsSync(f.file_path);
    if (exists) {
      submissionFiles.push(f);
    } else {
      await query('DELETE FROM candidate_assignment_files WHERE id = ?', [f.id]).catch(() => {});
    }
  }

  // Merge both sets — submission files first (most relevant), then admin files
  const attachments = [...submissionFiles, ...adminFiles];

  // Get communications history
  const communications = await query(
    `SELECT id, type, date, content, status, created_at
     FROM communications 
     WHERE assignment_id = ?
     ORDER BY created_at DESC`,
    [assignmentId]
  );

  res.json({
    success: true,
    data: {
      ...assignments[0],
      attachments,
      communications
    }
  });
}));

// Update assignment
router.put('/:id', authenticateToken, checkPermission('assignments', 'edit'), validateId('id'), validateAssignment, handleValidationErrors, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;
  const { candidateId, jobId, title, descriptionHtml, dueDate, status } = req.body;

  // Check if assignment exists
  const existingAssignments = await query('SELECT id, status FROM assignments WHERE id = ?', [assignmentId]);
  if (existingAssignments.length === 0) {
    throw new NotFoundError('Assignment not found');
  }

  const existingAssignment = existingAssignments[0];

  // Prevent editing if already sent (status is not Draft)
  if (existingAssignment.status !== 'Draft' && status === 'Draft') {
    throw new ConflictError('Cannot revert assignment to Draft status once it has been sent');
  }

  // Verify candidate exists if provided
  if (candidateId) {
    const candidates = await query('SELECT id, name, email FROM candidates WHERE id = ?', [candidateId]);
    if (candidates.length === 0) {
      throw new ValidationError('Candidate not found');
    }
  }

  // Verify job exists if provided
  if (jobId) {
    const jobs = await query('SELECT id, title FROM job_postings WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
      throw new ValidationError('Job not found');
    }
  }

  const newStatus = status || existingAssignment.status;
  
  await query(
    `UPDATE assignments 
     SET candidate_id = ?, job_id = ?, title = ?, description_html = ?, due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [candidateId || null, jobId || null, title, descriptionHtml || null, dueDate || null, newStatus, assignmentId]
  );

  // Sync candidate's inHouseAssignmentStatus with assignment status
  if (candidateId && newStatus && newStatus !== 'Draft') {
    // Map assignment status to candidate status
    const statusMapping = {
      'Assigned': 'Assigned',
      'In Progress': 'In Progress', 
      'Submitted': 'Submitted',
      'Approved': 'Approved',
      'Rejected': 'Rejected',
      'Cancelled': 'Cancelled'
    };
    
    const candidateStatus = statusMapping[newStatus];
    if (candidateStatus) {
      await query(
        `UPDATE candidates SET in_house_assignment_status = ?, updated_at = NOW() WHERE id = ?`,
        [candidateStatus, candidateId]
      );
    }
  }

  // Get updated assignment
  const assignments = await query(
    `SELECT a.*, 
            c.name as candidate_name, c.email as candidate_email,
            j.title as job_title,
            u.name as assigned_by_name
     FROM assignments a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN job_postings j ON a.job_id = j.id
     LEFT JOIN users u ON a.assigned_by = u.id
     WHERE a.id = ?`,
    [assignmentId]
  );

  res.json({
    success: true,
    message: 'Assignment updated successfully',
    data: assignments[0]
  });
}));

// Delete assignment (only if Draft)
router.delete('/:id', authenticateToken, checkPermission('assignments', 'delete'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;

  // Check if assignment exists and is in Draft status
  const assignments = await query('SELECT id, status FROM assignments WHERE id = ?', [assignmentId]);
  if (assignments.length === 0) {
    throw new NotFoundError('Assignment not found');
  }

  if (assignments[0].status !== 'Draft') {
    throw new ConflictError('Cannot delete assignment that has been sent');
  }

  await query('DELETE FROM assignments WHERE id = ?', [assignmentId]);

  res.json({
    success: true,
    message: 'Assignment deleted successfully'
  });
}));

// Upload files for assignment
router.post('/:id/files', authenticateToken, checkPermission('assignments', 'edit'), validateId('id'), upload.array('files', 10), handleValidationErrors, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;

  // Check if assignment exists
  const assignments = await query('SELECT id FROM assignments WHERE id = ?', [assignmentId]);
  if (assignments.length === 0) {
    throw new NotFoundError('Assignment not found');
  }

  // Use existing file upload service
  await fileStorageService.uploadFiles(req, res, {
    assignmentId: assignmentId
  });
}));

// Remove file from assignment
router.delete('/:id/files/:fileId', authenticateToken, checkPermission('assignments', 'edit'), validateId('id'), validateId('fileId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;
  const fileId = req.params.fileId;

  // Check if file belongs to this assignment
  const files = await query(
    'SELECT id, file_path FROM file_uploads WHERE id = ? AND assignment_id = ?',
    [fileId, assignmentId]
  );

  if (files.length === 0) {
    throw new NotFoundError('File not found for this assignment');
  }

  const file = files[0];

  // Delete file from filesystem
  try {
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }

  // Delete file record
  await query('DELETE FROM file_uploads WHERE id = ?', [fileId]);

  res.json({
    success: true,
    message: 'File removed successfully'
  });
}));

// Send assignment via email
router.post('/:id/send', authenticateToken, checkPermission('assignments', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;
  console.log('Send assignment API called for ID:', assignmentId);

  // Get assignment details
  const assignments = await query(
    `SELECT a.*, c.name as candidate_name, c.email as candidate_email, j.title as job_title
     FROM assignments a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN job_postings j ON a.job_id = j.id
     WHERE a.id = ?`,
    [assignmentId]
  );

  if (assignments.length === 0) {
    throw new NotFoundError('Assignment not found');
  }

  const assignment = assignments[0];

  // Validate candidate has email
  if (!assignment.candidate_email) {
    throw new ValidationError('Candidate email is required to send assignment');
  }

  // Check if assignment has content or attachments
  const attachments = await query(
    'SELECT id, filename, file_path, original_name FROM file_uploads WHERE assignment_id = ?',
    [assignmentId]
  );

  if (!assignment.description_html && attachments.length === 0) {
    throw new ValidationError('Assignment must have description or attachments to send');
  }

  // Resolve file paths dynamically — DB paths may be stale (different machine/location)
  const emailAttachments = attachments
    .map(file => {
      // Try the current resolved path first, fall back to stored path
      const resolvedPath = fileStorageService.getFilePath(file.filename);
      const finalPath = fs.existsSync(resolvedPath) ? resolvedPath : file.file_path;
      if (!fs.existsSync(finalPath)) {
        console.warn(`[assignments/send] Attachment not found on disk: ${file.original_name} (tried: ${resolvedPath})`);
        return null;
      }
      return { filename: file.original_name, path: finalPath };
    })
    .filter(Boolean);

  console.log(`[assignments/send] ${attachments.length} attachment(s) in DB, ${emailAttachments.length} found on disk`);

  // Build email content
  const subject = `Assignment: ${assignment.title}`;
  const htmlBody = `
    <h2>Assignment: ${assignment.title}</h2>
    ${assignment.job_title ? `<p><strong>Job:</strong> ${assignment.job_title}</p>` : ''}
    ${assignment.due_date ? `<p><strong>Due Date:</strong> ${new Date(assignment.due_date).toLocaleDateString()}</p>` : ''}
    <div>${assignment.description_html || ''}</div>
    <p>Please complete this assignment and submit your response.</p>
  `;

  try {
    console.log('Sending assignment email:', {
      to: assignment.candidate_email,
      subject: subject,
      attachments: emailAttachments.length
    });
    
    // Send email
    await emailService.sendEmail({
      to: assignment.candidate_email,
      subject: subject,
      html: htmlBody,
      attachments: emailAttachments
    });

    // Update assignment status to 'Assigned' if it's currently 'Draft'
    if (assignment.status === 'Draft') {
      await query(
        'UPDATE assignments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['Assigned', assignmentId]
      );
      
      // Sync candidate's inHouseAssignmentStatus to 'Assigned'
      await query(
        `UPDATE candidates SET in_house_assignment_status = 'Assigned', updated_at = NOW() WHERE id = ?`,
        [assignment.candidate_id]
      );
    }

    // Log communication
    await query(
      `INSERT INTO communications (candidate_id, assignment_id, type, date, content, status, created_by)
       VALUES (?, ?, 'Email', NOW(), 'Assignment sent', 'Sent', ?)`,
      [assignment.candidate_id, assignmentId, req.user.id]
    );

    res.json({
      success: true,
      message: 'Assignment sent successfully'
    });

  } catch (error) {
    console.error('Error sending assignment email:', error);
    throw new Error('Failed to send assignment email');
  }
}));

// Update assignment status
router.patch('/:id/status', authenticateToken, checkPermission('assignments', 'edit'), validateId('id'), validateAssignmentStatus, handleValidationErrors, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;
  const { status } = req.body;

  // Check if assignment exists and get candidate_id
  const assignments = await query('SELECT id, status, candidate_id FROM assignments WHERE id = ?', [assignmentId]);
  if (assignments.length === 0) {
    throw new NotFoundError('Assignment not found');
  }

  const assignment = assignments[0];

  await query(
    'UPDATE assignments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, assignmentId]
  );

  // Sync candidate's inHouseAssignmentStatus with assignment status
  if (status && status !== 'Draft') {
    // Map assignment status to candidate status
    const statusMapping = {
      'Assigned': 'Assigned',
      'In Progress': 'In Progress', 
      'Submitted': 'Submitted',
      'Approved': 'Approved',
      'Rejected': 'Rejected',
      'Cancelled': 'Cancelled'
    };
    
    const candidateStatus = statusMapping[status];
    if (candidateStatus) {
      await query(
        `UPDATE candidates SET in_house_assignment_status = ?, updated_at = NOW() WHERE id = ?`,
        [candidateStatus, assignment.candidate_id]
      );
    }
  }

  res.json({
    success: true,
    message: 'Assignment status updated successfully'
  });
}));

// Get assignments for specific candidate
router.get('/candidates/:candidateId', authenticateToken, checkPermission('assignments', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.candidateId;
  console.log('Fetching assignments for candidate ID:', candidateId);

  // Validate UUID format (8-4-4-4-12 hex characters)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!candidateId || typeof candidateId !== 'string' || !uuidRegex.test(candidateId)) {
    return res.status(400).json({
      success: false,
      message: 'candidateId must be a valid UUID'
    });
  }

  const assignments = await query(
    `SELECT a.*, 
            c.name as candidate_name, c.email as candidate_email,
            j.title as job_title,
            u.name as assigned_by_name,
            (SELECT COUNT(*) FROM file_uploads f WHERE f.assignment_id = a.id) as attachment_count
     FROM assignments a
     LEFT JOIN candidates c ON a.candidate_id = c.id
     LEFT JOIN job_postings j ON a.job_id = j.id
     LEFT JOIN users u ON a.assigned_by = u.id
     WHERE a.candidate_id = ?
     ORDER BY a.created_at DESC`,
    [candidateId]
  );

  console.log('Found assignments:', assignments.length);
  res.json({
    success: true,
    data: assignments
  });
}));

export default router;
