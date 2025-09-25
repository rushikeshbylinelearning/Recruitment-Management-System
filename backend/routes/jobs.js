import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateJobPosting, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all job postings
router.get('/', authenticateToken, checkPermission('jobs', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  // Ensure limit and offset are numbers
  const limitNum = Number(limit);
  const offsetNum = Number(offset);
  const search = req.query.search || '';
  const status = req.query.status || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    whereClause += ' AND j.status = ?';
    params.push(status);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM job_postings j ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get jobs with creator info - build query dynamically
  let jobsQuery = `SELECT j.*, u.name as created_by_name 
     FROM job_postings j
     LEFT JOIN users u ON j.created_by = u.id
     ${whereClause}
     ORDER BY j.created_at DESC 
     LIMIT ${limitNum} OFFSET ${offsetNum}`;
  
  const jobs = await query(jobsQuery, params);

  // Get portals and assignments for each job
  for (let job of jobs) {
    // Get job portals
    const portals = await query(
      'SELECT * FROM job_portals WHERE job_id = ?',
      [job.id]
    );
    job.portals = portals;

    // Get assigned users
    const assignments = await query(
      `SELECT u.id, u.name, u.role 
       FROM job_assignments ja
       JOIN users u ON ja.user_id = u.id
       WHERE ja.job_id = ?`,
      [job.id]
    );
    job.assignedTo = assignments.map(a => a.name);

    // Parse requirements JSON (handle both string and array cases)
    try {
      if (typeof job.requirements === 'string') {
        job.requirements = JSON.parse(job.requirements);
      } else if (Array.isArray(job.requirements)) {
        // Already an array, no need to parse
        job.requirements = job.requirements;
      } else {
        job.requirements = [];
      }
    } catch (e) {
      job.requirements = [];
    }

    // Get applicant count for this job
    const applicantCountResult = await query(
      'SELECT COUNT(*) as count FROM candidates WHERE job_id = ?',
      [job.id]
    );
    job.applicantCount = applicantCountResult[0].count;

    // Convert snake_case to camelCase for frontend compatibility
    job.jobType = job.job_type;
    job.postedDate = job.posted_date;
    
    // Remove snake_case fields
    delete job.job_type;
    delete job.posted_date;
    delete job.applicant_count;
  }

  res.json({
    success: true,
    data: {
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get job by ID
router.get('/:id', authenticateToken, checkPermission('jobs', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  const jobs = await query(
    `SELECT j.*, u.name as created_by_name 
     FROM job_postings j
     LEFT JOIN users u ON j.created_by = u.id
     WHERE j.id = ?`,
    [jobId]
  );

  if (jobs.length === 0) {
    throw new NotFoundError('Job posting not found');
  }

  const job = jobs[0];

  // Get job portals
  const portals = await query(
    'SELECT * FROM job_portals WHERE job_id = ?',
    [jobId]
  );
  job.portals = portals;

  // Get assigned users
  const assignments = await query(
    `SELECT u.id, u.name, u.role 
     FROM job_assignments ja
     JOIN users u ON ja.user_id = u.id
     WHERE ja.job_id = ?`,
    [jobId]
  );
  job.assignedTo = assignments.map(a => a.name);

  // Parse requirements JSON (handle both string and array cases)
  try {
    if (typeof job.requirements === 'string') {
      job.requirements = JSON.parse(job.requirements);
    } else if (Array.isArray(job.requirements)) {
      // Already an array, no need to parse
      job.requirements = job.requirements;
    } else {
      job.requirements = [];
    }
  } catch (e) {
    job.requirements = [];
  }

  // Convert snake_case to camelCase for frontend compatibility
  job.jobType = job.job_type;
  job.postedDate = job.posted_date;
  job.applicantCount = job.applicant_count;
  
  // Remove snake_case fields
  delete job.job_type;
  delete job.posted_date;
  delete job.applicant_count;

  res.json({
    success: true,
    data: { job }
  });
}));

// Create new job posting
router.post('/', authenticateToken, checkPermission('jobs', 'create'), validateJobPosting, handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    title,
    department,
    location,
    jobType,
    status,
    postedDate,
    deadline,
    description,
    requirements,
    portals = [],
    assignedTo = []
  } = req.body;

  // Validate assigned users exist (only if provided and not empty)
  // Skip validation if assignedTo contains role names instead of user IDs
  if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
    // Check if all items are numbers (user IDs) or strings (role names)
    const hasUserIds = assignedTo.every(item => typeof item === 'number' || !isNaN(Number(item)));
    
    if (hasUserIds) {
      // Only validate if we have actual user IDs
      const userIds = assignedTo.map(id => Number(id));
      const users = await query(
        `SELECT id FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      );
      if (users.length !== userIds.length) {
        throw new ValidationError('One or more assigned users not found');
      }
    }
    // If assignedTo contains role names (strings), skip validation
  }

  // Create job in transaction
  const result = await transaction(async (connection) => {
    // Insert job posting
    const [jobResult] = await connection.execute(
      `INSERT INTO job_postings (title, department, location, job_type, status, posted_date, deadline, description, requirements, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, department, location, jobType, status, postedDate, deadline, description, JSON.stringify(requirements), req.user.id]
    );

    const jobId = jobResult.insertId;

    // Insert job portals
    for (const portal of portals) {
      await connection.execute(
        'INSERT INTO job_portals (job_id, name, url, status, applicants) VALUES (?, ?, ?, ?, ?)',
        [jobId, portal.name, portal.url, portal.status || 'Draft', portal.applicants || 0]
      );
    }

    // Insert job assignments (only if we have actual user IDs)
    if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
      const hasUserIds = assignedTo.every(item => typeof item === 'number' || !isNaN(Number(item)));
      
      if (hasUserIds) {
        // Only insert assignments if we have actual user IDs
        for (const userId of assignedTo) {
          await connection.execute(
            'INSERT INTO job_assignments (job_id, user_id) VALUES (?, ?)',
            [jobId, userId]
          );
        }
      }
      // If assignedTo contains role names (strings), skip assignment insertion
    }

    return jobId;
  });

  res.status(201).json({
    success: true,
    message: 'Job posting created successfully',
    data: {
      jobId: result
    }
  });
}));

// Update job posting
router.put('/:id', authenticateToken, checkPermission('jobs', 'edit'), validateId('id'), validateJobPosting, handleValidationErrors, asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const {
    title,
    department,
    location,
    jobType,
    status,
    postedDate,
    deadline,
    description,
    requirements,
    portals = [],
    assignedTo = []
  } = req.body;

  // Check if job exists
  const existingJobs = await query('SELECT id FROM job_postings WHERE id = ?', [jobId]);
  if (existingJobs.length === 0) {
    throw new NotFoundError('Job posting not found');
  }

  // Validate assigned users exist (only if provided and not empty)
  // Skip validation if assignedTo contains role names instead of user IDs
  if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
    // Check if all items are numbers (user IDs) or strings (role names)
    const hasUserIds = assignedTo.every(item => typeof item === 'number' || !isNaN(Number(item)));
    
    if (hasUserIds) {
      // Only validate if we have actual user IDs
      const userIds = assignedTo.map(id => Number(id));
      const users = await query(
        `SELECT id FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      );
      if (users.length !== userIds.length) {
        throw new ValidationError('One or more assigned users not found');
      }
    }
    // If assignedTo contains role names (strings), skip validation
  }

  // Update job in transaction
  await transaction(async (connection) => {
    // Update job posting
    await connection.execute(
      `UPDATE job_postings SET title = ?, department = ?, location = ?, job_type = ?, status = ?, 
       posted_date = ?, deadline = ?, description = ?, requirements = ?, updated_at = NOW() 
       WHERE id = ?`,
      [title, department, location, jobType, status, postedDate, deadline, description, JSON.stringify(requirements), jobId]
    );

    // Delete existing portals and assignments
    await connection.execute('DELETE FROM job_portals WHERE job_id = ?', [jobId]);
    await connection.execute('DELETE FROM job_assignments WHERE job_id = ?', [jobId]);

    // Insert new portals
    for (const portal of portals) {
      await connection.execute(
        'INSERT INTO job_portals (job_id, name, url, status, applicants) VALUES (?, ?, ?, ?, ?)',
        [jobId, portal.name, portal.url, portal.status || 'Draft', portal.applicants || 0]
      );
    }

    // Insert new assignments (only if we have actual user IDs)
    if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
      const hasUserIds = assignedTo.every(item => typeof item === 'number' || !isNaN(Number(item)));
      
      if (hasUserIds) {
        // Only insert assignments if we have actual user IDs
        for (const userId of assignedTo) {
          await connection.execute(
            'INSERT INTO job_assignments (job_id, user_id) VALUES (?, ?)',
            [jobId, userId]
          );
        }
      }
      // If assignedTo contains role names (strings), skip assignment insertion
    }
  });

  res.json({
    success: true,
    message: 'Job posting updated successfully'
  });
}));

// Delete job posting
router.delete('/:id', authenticateToken, checkPermission('jobs', 'delete'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Check if job exists
  const existingJobs = await query('SELECT id FROM job_postings WHERE id = ?', [jobId]);
  if (existingJobs.length === 0) {
    throw new NotFoundError('Job posting not found');
  }

  // Delete job (cascading will handle related records)
  await query('DELETE FROM job_postings WHERE id = ?', [jobId]);

  res.json({
    success: true,
    message: 'Job posting deleted successfully'
  });
}));

// Get candidates for a job
router.get('/:id/candidates', authenticateToken, checkPermission('candidates', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Check if job exists
  const existingJobs = await query('SELECT id, title FROM job_postings WHERE id = ?', [jobId]);
  if (existingJobs.length === 0) {
    throw new NotFoundError('Job posting not found');
  }

  const candidates = await query(
    `SELECT c.*, u.name as assigned_to_name 
     FROM candidates c
     LEFT JOIN users u ON c.assigned_to = u.id
     WHERE c.position = ?
     ORDER BY c.applied_date DESC`,
    [existingJobs[0].title]
  );

  // Parse JSON fields and add communications count
  for (let candidate of candidates) {
    try {
      candidate.skills = JSON.parse(candidate.skills || '[]');
    } catch (e) {
      candidate.skills = [];
    }

    // Get communications count
    const commCount = await query(
      'SELECT COUNT(*) as count FROM communications WHERE candidate_id = ?',
      [candidate.id]
    );
    candidate.communicationsCount = commCount[0].count;
  }

  res.json({
    success: true,
    data: {
      job: existingJobs[0],
      candidates
    }
  });
}));

// Get job statistics
router.get('/:id/stats', authenticateToken, checkPermission('jobs', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Check if job exists
  const existingJobs = await query('SELECT id, title FROM job_postings WHERE id = ?', [jobId]);
  if (existingJobs.length === 0) {
    throw new NotFoundError('Job posting not found');
  }

  const jobTitle = existingJobs[0].title;

  // Get statistics
  const stats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM candidates WHERE position = ?) as total_applications,
       (SELECT COUNT(*) FROM candidates WHERE position = ? AND stage = 'Applied') as applied,
       (SELECT COUNT(*) FROM candidates WHERE position = ? AND stage = 'Interview') as interviewing,
       (SELECT COUNT(*) FROM candidates WHERE position = ? AND stage = 'Offer') as offers,
       (SELECT COUNT(*) FROM candidates WHERE position = ? AND stage = 'Hired') as hired,
       (SELECT COUNT(*) FROM candidates WHERE position = ? AND stage = 'Rejected') as rejected,
       (SELECT AVG(score) FROM candidates WHERE position = ? AND score > 0) as avg_score`,
    [jobTitle, jobTitle, jobTitle, jobTitle, jobTitle, jobTitle, jobTitle]
  );

  res.json({
    success: true,
    data: {
      job: existingJobs[0],
      statistics: stats[0]
    }
  });
}));

export default router;

