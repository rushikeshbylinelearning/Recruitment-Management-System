import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateCandidate, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import fileStorageService from '../services/fileStorage.js';
import fs from 'fs';
import { asyncHandler, NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all candidates
router.get('/', authenticateToken, checkPermission('candidates', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const stage = req.query.stage || '';
  const source = req.query.source || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.position LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (stage) {
    whereClause += ' AND c.stage = ?';
    params.push(stage);
  }

  if (source) {
    whereClause += ' AND c.source = ?';
    params.push(source);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM candidates c ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get candidates
  const candidates = await query(
    `SELECT c.*, u.name as assigned_to_name 
     FROM candidates c
     LEFT JOIN users u ON c.assigned_to = u.id
     ${whereClause}
     ORDER BY c.applied_date DESC 
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  // Parse JSON fields and add additional data
  for (let candidate of candidates) {
    try {
      candidate.skills = JSON.parse(candidate.skills || '[]');
    } catch (e) {
      candidate.skills = [];
    }

    // Convert snake_case to camelCase for frontend compatibility
    candidate.resumeFileId = candidate.resume_file_id;
    candidate.appliedDate = candidate.applied_date;
    candidate.assignedTo = candidate.assigned_to_name || 'Unassigned';
    
    // Structure salary object
    candidate.salary = {
      expected: candidate.salary_expected || '',
      offered: candidate.salary_offered || '',
      negotiable: Boolean(candidate.salary_negotiable)
    };

    // Structure availability object
    candidate.availability = {
      joiningTime: candidate.joining_time || '',
      noticePeriod: candidate.notice_period || '',
      immediateJoiner: Boolean(candidate.immediate_joiner)
    };

    // Initialize empty arrays for frontend compatibility
    candidate.communications = [];
    candidate.interviews = [];
    
    // Remove snake_case fields
    delete candidate.resume_file_id;
    delete candidate.applied_date;
    delete candidate.assigned_to_name;
    delete candidate.salary_expected;
    delete candidate.salary_offered;
    delete candidate.salary_negotiable;
    delete candidate.joining_time;
    delete candidate.notice_period;
    delete candidate.immediate_joiner;

    // Get communications count
    const commCount = await query(
      'SELECT COUNT(*) as count FROM communications WHERE candidate_id = ?',
      [candidate.id]
    );
    candidate.communicationsCount = commCount[0].count;

    // Get interviews count
    const interviewCount = await query(
      'SELECT COUNT(*) as count FROM interviews WHERE candidate_id = ?',
      [candidate.id]
    );
    candidate.interviewsCount = interviewCount[0].count;
  }

  res.json({
    success: true,
    data: {
      candidates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get candidate by ID
router.get('/:id', authenticateToken, checkPermission('candidates', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  const candidates = await query(
    `SELECT c.*, u.name as assigned_to_name 
     FROM candidates c
     LEFT JOIN users u ON c.assigned_to = u.id
     WHERE c.id = ?`,
    [candidateId]
  );

  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  // Parse JSON fields and structure data
  try {
    candidate.skills = JSON.parse(candidate.skills || '[]');
  } catch (e) {
    candidate.skills = [];
  }

  // Convert snake_case to camelCase for frontend compatibility
  candidate.resumeFileId = candidate.resume_file_id;
  candidate.appliedDate = candidate.applied_date;
  candidate.assignedTo = candidate.assigned_to_name || 'Unassigned';
  
  // Structure salary object
  candidate.salary = {
    expected: candidate.salary_expected || '',
    offered: candidate.salary_offered || '',
    negotiable: Boolean(candidate.salary_negotiable)
  };

  // Structure availability object
  candidate.availability = {
    joiningTime: candidate.joining_time || '',
    noticePeriod: candidate.notice_period || '',
    immediateJoiner: Boolean(candidate.immediate_joiner)
  };
  
  // Remove snake_case fields
  delete candidate.resume_file_id;
  delete candidate.applied_date;
  delete candidate.assigned_to_name;
  delete candidate.salary_expected;
  delete candidate.salary_offered;
  delete candidate.salary_negotiable;
  delete candidate.joining_time;
  delete candidate.notice_period;
  delete candidate.immediate_joiner;

  // Get communications
  const communications = await query(
    `SELECT c.*, u.name as created_by_name 
     FROM communications c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.candidate_id = ?
     ORDER BY c.date DESC`,
    [candidateId]
  );
  candidate.communications = communications;

  // Get interviews
  const interviews = await query(
    `SELECT i.*, u.name as interviewer_name 
     FROM interviews i
     LEFT JOIN users u ON i.interviewer_id = u.id
     WHERE i.candidate_id = ?
     ORDER BY i.scheduled_date DESC`,
    [candidateId]
  );

  // Get interview feedback for each interview
  for (let interview of interviews) {
    const feedback = await query(
      'SELECT * FROM interview_feedback WHERE interview_id = ?',
      [interview.id]
    );
    interview.feedback = feedback.length > 0 ? feedback[0] : null;
  }

  candidate.interviews = interviews;

  // Get pre-interview feedback
  const preFeedback = await query(
    `SELECT pif.*, u.name as submitted_by_name 
     FROM pre_interview_feedback pif
     LEFT JOIN users u ON pif.submitted_by = u.id
     WHERE pif.candidate_id = ?`,
    [candidateId]
  );
  candidate.preInterviewFeedback = preFeedback.length > 0 ? preFeedback[0] : null;

  // Get post-interview feedback
  const postFeedback = await query(
    `SELECT pif.*, u.name as submitted_by_name 
     FROM post_interview_feedback pif
     LEFT JOIN users u ON pif.submitted_by = u.id
     WHERE pif.candidate_id = ?
     ORDER BY pif.submitted_at DESC`,
    [candidateId]
  );

  // Parse JSON fields in post-interview feedback
  for (let feedback of postFeedback) {
    try {
      feedback.technical_skills = JSON.parse(feedback.technical_skills || '[]');
      feedback.soft_skills = JSON.parse(feedback.soft_skills || '[]');
    } catch (e) {
      feedback.technical_skills = [];
      feedback.soft_skills = [];
    }
  }

  candidate.postInterviewFeedback = postFeedback;

  res.json({
    success: true,
    data: { candidate }
  });
}));

// Create new candidate
router.post('/', authenticateToken, checkPermission('candidates', 'create'), validateCandidate, handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    position,
    stage,
    source,
    appliedDate,
    resumePath,
    resumeFileId,
    notes,
    score,
    assignedTo,
    skills = [],
    experience,
    salaryExpected,
    salaryOffered,
    salaryNegotiable,
    joiningTime,
    noticePeriod,
    immediateJoiner,
    jobId
  } = req.body;

  // Validate assigned user exists (only if assignedTo is a valid user ID)
  let assignedUserId = null;
  if (assignedTo && assignedTo !== 'Unassigned') {
    const users = await query('SELECT id FROM users WHERE id = ?', [assignedTo]);
    if (users.length === 0) {
      throw new ValidationError('Assigned user not found');
    }
    assignedUserId = assignedTo;
  }

  // Check if candidate already exists with same email and position
  const existingCandidates = await query(
    'SELECT id FROM candidates WHERE email = ? AND position = ?',
    [email, position]
  );

  if (existingCandidates.length > 0) {
    throw new ConflictError('Candidate already exists for this position');
  }

  // Create candidate
  const result = await query(
    `INSERT INTO candidates (job_id, name, email, phone, position, stage, source, applied_date, resume_path, resume_file_id, notes, score, 
     assigned_to, skills, experience, salary_expected, salary_offered, salary_negotiable, joining_time, notice_period, immediate_joiner) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId || null,
      name, 
      email, 
      phone, 
      position, 
      stage, 
      source, 
      appliedDate, 
      resumePath || null, 
      resumeFileId || null, 
      notes || null, 
      score || 0, 
      assignedUserId,
      JSON.stringify(skills), 
      experience || null, 
      salaryExpected || null, 
      salaryOffered || null, 
      salaryNegotiable || false, 
      joiningTime || null, 
      noticePeriod || null, 
      immediateJoiner || false
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Candidate created successfully',
    data: {
      candidateId: result.insertId
    }
  });
}));

// Update candidate
router.put('/:id', authenticateToken, checkPermission('candidates', 'edit'), validateId('id'), validateCandidate, handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const {
    name,
    email,
    phone,
    position,
    stage,
    source,
    appliedDate,
    resumePath,
    notes,
    score,
    assignedTo,
    skills = [],
    experience,
    salaryExpected,
    salaryOffered,
    salaryNegotiable,
    joiningTime,
    noticePeriod,
    immediateJoiner
  } = req.body;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Validate assigned user exists (only if assignedTo is a valid user ID)
  let assignedUserId = null;
  if (assignedTo && assignedTo !== 'Unassigned') {
    const users = await query('SELECT id FROM users WHERE id = ?', [assignedTo]);
    if (users.length === 0) {
      throw new ValidationError('Assigned user not found');
    }
    assignedUserId = assignedTo;
  }

  // Convert undefined values to null to avoid SQL binding errors
  const safeResumePath = resumePath === undefined ? null : resumePath;
  const safeNotes = notes === undefined ? null : notes;
  const safeScore = score === undefined ? null : score;
  const safeExperience = experience === undefined ? null : experience;
  const safeSalaryExpected = salaryExpected === undefined ? null : salaryExpected;
  const safeSalaryOffered = salaryOffered === undefined ? null : salaryOffered;
  const safeSalaryNegotiable = salaryNegotiable === undefined ? false : salaryNegotiable;
  const safeJoiningTime = joiningTime === undefined ? null : joiningTime;
  const safeNoticePeriod = noticePeriod === undefined ? null : noticePeriod;
  const safeImmediateJoiner = immediateJoiner === undefined ? false : immediateJoiner;

  // Update candidate
  await query(
    `UPDATE candidates SET name = ?, email = ?, phone = ?, position = ?, stage = ?, source = ?, applied_date = ?, 
     resume_path = ?, notes = ?, score = ?, assigned_to = ?, skills = ?, experience = ?, salary_expected = ?, 
     salary_offered = ?, salary_negotiable = ?, joining_time = ?, notice_period = ?, immediate_joiner = ?, updated_at = NOW() 
     WHERE id = ?`,
    [name, email, phone, position, stage, source, appliedDate, safeResumePath, safeNotes, safeScore, assignedUserId,
     JSON.stringify(skills), safeExperience, safeSalaryExpected, safeSalaryOffered, safeSalaryNegotiable, safeJoiningTime, safeNoticePeriod, safeImmediateJoiner, candidateId]
  );

  res.json({
    success: true,
    message: 'Candidate updated successfully'
  });
}));

// Delete candidate
router.delete('/:id', authenticateToken, checkPermission('candidates', 'delete'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Delete candidate (cascading will handle related records)
  await query('DELETE FROM candidates WHERE id = ?', [candidateId]);

  res.json({
    success: true,
    message: 'Candidate deleted successfully'
  });
}));

// Update candidate stage
router.patch('/:id/stage', authenticateToken, checkPermission('candidates', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const { stage, notes } = req.body;

  if (!stage) {
    throw new ValidationError('Stage is required');
  }

  const validStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
  if (!validStages.includes(stage)) {
    throw new ValidationError('Invalid stage');
  }

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Update stage and notes
  await query(
    'UPDATE candidates SET stage = ?, notes = ?, updated_at = NOW() WHERE id = ?',
    [stage, notes || null, candidateId]
  );

  res.json({
    success: true,
    message: 'Candidate stage updated successfully'
  });
}));

// Get candidate analytics
router.get('/:id/analytics', authenticateToken, checkPermission('candidates', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Check if candidate exists
  const candidates = await query('SELECT id, name, position FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  // Get analytics data
  const analytics = await query(
    `SELECT 
       (SELECT COUNT(*) FROM communications WHERE candidate_id = ?) as total_communications,
       (SELECT COUNT(*) FROM interviews WHERE candidate_id = ?) as total_interviews,
       (SELECT COUNT(*) FROM interviews WHERE candidate_id = ? AND status = 'Completed') as completed_interviews,
       (SELECT AVG(overall_rating) FROM interview_feedback WHERE interview_id IN (SELECT id FROM interviews WHERE candidate_id = ?)) as avg_interview_rating,
       (SELECT DATEDIFF(NOW(), applied_date) FROM candidates WHERE id = ?) as days_in_pipeline`,
    [candidateId, candidateId, candidateId, candidateId, candidateId]
  );

  // Get stage timeline
  const timeline = await query(
    `SELECT 'applied' as event, applied_date as date, stage as status FROM candidates WHERE id = ?
     UNION ALL
     SELECT 'communication' as event, date, type as status FROM communications WHERE candidate_id = ?
     UNION ALL
     SELECT 'interview' as event, scheduled_date as date, status FROM interviews WHERE candidate_id = ?
     ORDER BY date DESC`,
    [candidateId, candidateId, candidateId]
  );

  res.json({
    success: true,
    data: {
      candidate,
      analytics: analytics[0],
      timeline
    }
  });
}));

// Bulk import candidates
router.post('/bulk-import', authenticateToken, checkPermission('candidates', 'create'), asyncHandler(async (req, res) => {
  const { candidates } = req.body;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new ValidationError('Candidates array is required');
  }

  if (candidates.length > 100) {
    throw new ValidationError('Cannot import more than 100 candidates at once');
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < candidates.length; i++) {
    try {
      const candidate = candidates[i];
      
      // Validate required fields
      if (!candidate.name || !candidate.email || !candidate.position || !candidate.assignedTo) {
        errors.push({ row: i + 1, error: 'Missing required fields' });
        continue;
      }

      // Validate assigned user exists
      const users = await query('SELECT id FROM users WHERE id = ?', [candidate.assignedTo]);
      if (users.length === 0) {
        errors.push({ row: i + 1, error: 'Assigned user not found' });
        continue;
      }

      // Create candidate
      const result = await query(
        `INSERT INTO candidates (name, email, phone, position, stage, source, applied_date, resume_path, notes, score, 
         assigned_to, skills, experience, salary_expected, salary_negotiable, joining_time, notice_period, immediate_joiner) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [candidate.name, candidate.email, candidate.phone || '', candidate.position, candidate.stage || 'Applied',
         candidate.source || 'Bulk Import', candidate.appliedDate || new Date().toISOString().split('T')[0],
         candidate.resumePath || null, candidate.notes || '', candidate.score || 0, candidate.assignedTo,
         JSON.stringify(candidate.skills || []), candidate.experience || '', candidate.salaryExpected || '',
         candidate.salaryNegotiable !== undefined ? candidate.salaryNegotiable : true,
         candidate.joiningTime || '', candidate.noticePeriod || '', candidate.immediateJoiner || false]
      );

      results.push({ row: i + 1, candidateId: result.insertId });
    } catch (error) {
      errors.push({ row: i + 1, error: error.message });
    }
  }

  res.status(201).json({
    success: true,
    message: `Bulk import completed. ${results.length} candidates imported successfully.`,
    data: {
      imported: results,
      errors
    }
  });
}));

// Download candidate resume
router.get('/:id/resume', authenticateToken, checkPermission('candidates', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Get candidate with file information
  const candidates = await query(
    `SELECT c.*, fu.filename, fu.original_name, fu.mime_type, fu.file_path
     FROM candidates c
     LEFT JOIN file_uploads fu ON c.resume_file_id = fu.id
     WHERE c.id = ?`,
    [candidateId]
  );

  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  if (!candidate.filename) {
    throw new NotFoundError('No resume file found for this candidate');
  }

  const filePath = fileStorageService.getFilePath(candidate.filename);

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('Resume file not found on disk');
  }

  res.setHeader('Content-Disposition', `attachment; filename="${candidate.original_name}"`);
  res.setHeader('Content-Type', candidate.mime_type);
  res.sendFile(filePath);
}));

// Get candidate resume metadata
router.get('/:id/resume/metadata', authenticateToken, checkPermission('candidates', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  const candidates = await query(
    `SELECT c.name as candidate_name, fu.filename, fu.original_name, fu.file_size, fu.mime_type, fu.uploaded_at, u.name as uploaded_by_name
     FROM candidates c
     LEFT JOIN file_uploads fu ON c.resume_file_id = fu.id
     LEFT JOIN users u ON fu.uploaded_by = u.id
     WHERE c.id = ?`,
    [candidateId]
  );

  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  if (!candidate.filename) {
    res.json({
      success: true,
      data: {
        hasResume: false,
        message: 'No resume file found for this candidate'
      }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      hasResume: true,
      candidateName: candidate.candidate_name,
      filename: candidate.filename,
      originalName: candidate.original_name,
      fileSize: candidate.file_size,
      mimeType: candidate.mime_type,
      uploadedAt: candidate.uploaded_at,
      uploadedBy: candidate.uploaded_by_name
    }
  });
}));

export default router;

