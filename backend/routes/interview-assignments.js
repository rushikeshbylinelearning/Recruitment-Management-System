import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all interview assignments
router.get('/', authenticateToken, checkPermission('interviews', 'view'), asyncHandler(async (req, res) => {
  const assignments = await query(`
    SELECT 
      ia.*,
      c.name as candidate_name,
      c.position,
      c.stage,
      c.email as candidate_email,
      c.phone as candidate_phone,
      u.name as interviewer_name,
      u.email as interviewer_email,
      u.role as interviewer_role,
      j.title as job_title
    FROM interview_assignments ia
    LEFT JOIN candidates c ON ia.candidate_id = c.id
    LEFT JOIN users u ON ia.assigned_to = u.id
    LEFT JOIN jobs j ON c.job_id = j.id
    ORDER BY ia.created_at DESC
  `);

  res.json({
    success: true,
    data: { assignments }
  });
});

// Get interview assignments for a specific user
router.get('/user/:userId', authenticateToken, checkPermission('interviews', 'view'), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  const assignments = await query(`
    SELECT 
      ia.*,
      c.name as candidate_name,
      c.position,
      c.stage,
      c.email as candidate_email,
      c.phone as candidate_phone,
      u.name as interviewer_name,
      u.email as interviewer_email,
      u.role as interviewer_role,
      j.title as job_title
    FROM interview_assignments ia
    LEFT JOIN candidates c ON ia.candidate_id = c.id
    LEFT JOIN users u ON ia.assigned_to = u.id
    LEFT JOIN jobs j ON c.job_id = j.id
    WHERE ia.assigned_to = ?
    ORDER BY ia.created_at DESC
  `, [userId]);

  res.json({
    success: true,
    data: { assignments }
  });
});

// Create new interview assignment
router.post('/', authenticateToken, checkPermission('interviews', 'create'), asyncHandler(async (req, res) => {
  const {
    candidateId,
    assignedTo,
    interviewType,
    scheduledDate,
    duration,
    location,
    meetingLink,
    notes,
    priority = 'Medium'
  } = req.body;

  // Validate required fields
  if (!candidateId || !assignedTo || !interviewType) {
    throw new ValidationError('Candidate ID, assigned user, and interview type are required');
  }

  // Validate candidate exists
  const candidate = await query('SELECT id, name FROM candidates WHERE id = ?', [candidateId]);
  if (candidate.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Validate assigned user exists
  const user = await query('SELECT id, name, role FROM users WHERE id = ?', [assignedTo]);
  if (user.length === 0) {
    throw new NotFoundError('Assigned user not found');
  }

  // Check if user can be assigned interviews based on their role
  const assignedUser = user[0];
  if (!['Admin', 'HR Manager', 'Recruiter', 'Interviewer'].includes(assignedUser.role)) {
    throw new ValidationError('User role is not eligible for interview assignments');
  }

  // Create interview assignment
  const result = await query(`
    INSERT INTO interview_assignments 
    (candidate_id, assigned_to, interview_type, scheduled_date, duration, location, meeting_link, notes, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)
  `, [
    candidateId,
    assignedTo,
    interviewType,
    scheduledDate || null,
    duration || 60,
    location || null,
    meetingLink || null,
    notes || null,
    priority,
    req.user.id
  ]);

  // Update candidate's interviewer_id if this is the first assignment
  await query(`
    UPDATE candidates 
    SET interviewer_id = ?, interview_date = ?
    WHERE id = ? AND interviewer_id IS NULL
  `, [assignedTo, scheduledDate, candidateId]);

  res.json({
    success: true,
    data: { 
      assignmentId: result.insertId,
      message: 'Interview assignment created successfully'
    }
  });
}));

// Update interview assignment
router.put('/:id', authenticateToken, checkPermission('interviews', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    assignedTo,
    interviewType,
    scheduledDate,
    duration,
    location,
    meetingLink,
    notes,
    priority,
    status
  } = req.body;

  // Check if assignment exists
  const assignment = await query('SELECT * FROM interview_assignments WHERE id = ?', [id]);
  if (assignment.length === 0) {
    throw new NotFoundError('Interview assignment not found');
  }

  // Validate assigned user if provided
  if (assignedTo) {
    const user = await query('SELECT id, name, role FROM users WHERE id = ?', [assignedTo]);
    if (user.length === 0) {
      throw new NotFoundError('Assigned user not found');
    }
    
    const assignedUser = user[0];
    if (!['Admin', 'HR Manager', 'Recruiter', 'Interviewer'].includes(assignedUser.role)) {
      throw new ValidationError('User role is not eligible for interview assignments');
    }
  }

  // Update assignment
  const updateFields = [];
  const updateValues = [];

  if (assignedTo !== undefined) {
    updateFields.push('assigned_to = ?');
    updateValues.push(assignedTo);
  }
  if (interviewType !== undefined) {
    updateFields.push('interview_type = ?');
    updateValues.push(interviewType);
  }
  if (scheduledDate !== undefined) {
    updateFields.push('scheduled_date = ?');
    updateValues.push(scheduledDate);
  }
  if (duration !== undefined) {
    updateFields.push('duration = ?');
    updateValues.push(duration);
  }
  if (location !== undefined) {
    updateFields.push('location = ?');
    updateValues.push(location);
  }
  if (meetingLink !== undefined) {
    updateFields.push('meeting_link = ?');
    updateValues.push(meetingLink);
  }
  if (notes !== undefined) {
    updateFields.push('notes = ?');
    updateValues.push(notes);
  }
  if (priority !== undefined) {
    updateFields.push('priority = ?');
    updateValues.push(priority);
  }
  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (updateFields.length === 0) {
    throw new ValidationError('No fields to update');
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(id);

  await query(`
    UPDATE interview_assignments 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  res.json({
    success: true,
    data: { message: 'Interview assignment updated successfully' }
  });
}));

// Delete interview assignment
router.delete('/:id', authenticateToken, checkPermission('interviews', 'delete'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if assignment exists
  const assignment = await query('SELECT * FROM interview_assignments WHERE id = ?', [id]);
  if (assignment.length === 0) {
    throw new NotFoundError('Interview assignment not found');
  }

  // Delete assignment
  await query('DELETE FROM interview_assignments WHERE id = ?', [id]);

  res.json({
    success: true,
    data: { message: 'Interview assignment deleted successfully' }
  });
}));

// Get available interviewers for assignment
router.get('/available-interviewers', authenticateToken, checkPermission('interviews', 'view'), asyncHandler(async (req, res) => {
  const { candidateId, interviewType } = req.query;

  // Get users who can conduct interviews
  const interviewers = await query(`
    SELECT u.id, u.name, u.email, u.role, u.status,
           COUNT(ia.id) as current_assignments
    FROM users u
    LEFT JOIN interview_assignments ia ON u.id = ia.assigned_to AND ia.status = 'Scheduled'
    WHERE u.role IN ('Admin', 'HR Manager', 'Recruiter', 'Interviewer')
    AND u.status = 'Active'
    GROUP BY u.id, u.name, u.email, u.role, u.status
    ORDER BY u.role, u.name
  `);

  res.json({
    success: true,
    data: { interviewers }
  });
}));

export default router;
