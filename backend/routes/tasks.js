import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateTask, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all tasks
router.get('/', authenticateToken, checkPermission('tasks', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const priority = req.query.priority || '';
  const assignedTo = req.query.assignedTo || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (status) {
    whereClause += ' AND t.status = ?';
    params.push(status);
  }

  if (priority) {
    whereClause += ' AND t.priority = ?';
    params.push(priority);
  }

  if (assignedTo) {
    whereClause += ' AND t.assigned_to = ?';
    params.push(assignedTo);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM tasks t ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get tasks
  const tasks = await query(
    `SELECT t.*, u.name as assigned_to_name, c.name as candidate_name, j.title as job_title 
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     ${whereClause}
     ORDER BY t.due_date ASC 
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  res.json({
    success: true,
    data: {
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get task by ID
router.get('/:id', authenticateToken, checkPermission('tasks', 'view'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const taskId = req.params.id;

  const tasks = await query(
    `SELECT t.*, u.name as assigned_to_name, c.name as candidate_name, j.title as job_title, creator.name as created_by_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     LEFT JOIN users creator ON t.created_by = creator.id
     WHERE t.id = ?`,
    [taskId]
  );

  if (tasks.length === 0) {
    throw new NotFoundError('Task not found');
  }

  res.json({
    success: true,
    data: { task: tasks[0] }
  });
}));

// Create new task
router.post('/', authenticateToken, checkPermission('tasks', 'create'), validateTask, handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    title,
    description,
    assignedTo,
    jobId,
    candidateId,
    priority,
    status,
    dueDate
  } = req.body;

  // Validate assigned user exists
  const users = await query('SELECT id FROM users WHERE id = ?', [assignedTo]);
  if (users.length === 0) {
    throw new ValidationError('Assigned user not found');
  }

  // Validate job exists (if provided)
  if (jobId) {
    const jobs = await query('SELECT id FROM job_postings WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
      throw new ValidationError('Job not found');
    }
  }

  // Validate candidate exists (if provided)
  if (candidateId) {
    const candidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
    if (candidates.length === 0) {
      throw new ValidationError('Candidate not found');
    }
  }

  // Create task
  const result = await query(
    `INSERT INTO tasks (title, description, assigned_to, job_id, candidate_id, priority, status, due_date, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, assignedTo, jobId || null, candidateId || null, priority, status, dueDate, req.user.id]
  );

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: {
      taskId: result.insertId
    }
  });
}));

// Update task
router.put('/:id', authenticateToken, checkPermission('tasks', 'edit'), validateId('id'), validateTask, handleValidationErrors, asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const {
    title,
    description,
    assignedTo,
    jobId,
    candidateId,
    priority,
    status,
    dueDate
  } = req.body;

  // Check if task exists
  const existingTasks = await query('SELECT id FROM tasks WHERE id = ?', [taskId]);
  if (existingTasks.length === 0) {
    throw new NotFoundError('Task not found');
  }

  // Validate assigned user exists
  const users = await query('SELECT id FROM users WHERE id = ?', [assignedTo]);
  if (users.length === 0) {
    throw new ValidationError('Assigned user not found');
  }

  // Validate job exists (if provided)
  if (jobId) {
    const jobs = await query('SELECT id FROM job_postings WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
      throw new ValidationError('Job not found');
    }
  }

  // Validate candidate exists (if provided)
  if (candidateId) {
    const candidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
    if (candidates.length === 0) {
      throw new ValidationError('Candidate not found');
    }
  }

  // Update task
  await query(
    `UPDATE tasks SET title = ?, description = ?, assigned_to = ?, job_id = ?, candidate_id = ?, priority = ?, 
     status = ?, due_date = ?, updated_at = NOW() 
     WHERE id = ?`,
    [title, description, assignedTo, jobId || null, candidateId || null, priority, status, dueDate, taskId]
  );

  res.json({
    success: true,
    message: 'Task updated successfully'
  });
}));

// Delete task
router.delete('/:id', authenticateToken, checkPermission('tasks', 'delete'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const taskId = req.params.id;

  // Check if task exists
  const existingTasks = await query('SELECT id FROM tasks WHERE id = ?', [taskId]);
  if (existingTasks.length === 0) {
    throw new NotFoundError('Task not found');
  }

  // Delete task
  await query('DELETE FROM tasks WHERE id = ?', [taskId]);

  res.json({
    success: true,
    message: 'Task deleted successfully'
  });
}));

// Update task status
router.patch('/:id/status', authenticateToken, checkPermission('tasks', 'edit'), validateId('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const validStatuses = ['Pending', 'In Progress', 'Completed'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError('Invalid status');
  }

  // Check if task exists
  const existingTasks = await query('SELECT id, assigned_to FROM tasks WHERE id = ?', [taskId]);
  if (existingTasks.length === 0) {
    throw new NotFoundError('Task not found');
  }

  const task = existingTasks[0];

  // Check if user can update this task
  if (task.assigned_to !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only update your own tasks');
  }

  // Update status
  await query(
    'UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, taskId]
  );

  res.json({
    success: true,
    message: 'Task status updated successfully'
  });
}));

// Get user's tasks
router.get('/user/:userId', authenticateToken, validateId('userId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const userId = req.params.userId;

  // Check if user can access this data
  if (req.user.id !== userId && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('Access denied');
  }

  const tasks = await query(
    `SELECT t.*, c.name as candidate_name, j.title as job_title 
     FROM tasks t
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     WHERE t.assigned_to = ?
     ORDER BY t.due_date ASC`,
    [userId]
  );

  res.json({
    success: true,
    data: { tasks }
  });
}));

// Get overdue tasks
router.get('/overdue/list', authenticateToken, checkPermission('tasks', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const tasks = await query(
    `SELECT t.*, u.name as assigned_to_name, c.name as candidate_name, j.title as job_title 
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     WHERE t.due_date < CURDATE() AND t.status != 'Completed'
     ORDER BY t.due_date ASC`,
    []
  );

  res.json({
    success: true,
    data: { tasks }
  });
}));

// Get tasks due today
router.get('/due-today/list', authenticateToken, checkPermission('tasks', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const tasks = await query(
    `SELECT t.*, u.name as assigned_to_name, c.name as candidate_name, j.title as job_title 
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     WHERE t.due_date = CURDATE() AND t.status != 'Completed'
     ORDER BY t.due_date ASC`,
    []
  );

  res.json({
    success: true,
    data: { tasks }
  });
}));

// Get task statistics
router.get('/stats/overview', authenticateToken, checkPermission('tasks', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const stats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM tasks) as total_tasks,
       (SELECT COUNT(*) FROM tasks WHERE status = 'Pending') as pending_tasks,
       (SELECT COUNT(*) FROM tasks WHERE status = 'In Progress') as in_progress_tasks,
       (SELECT COUNT(*) FROM tasks WHERE status = 'Completed') as completed_tasks,
       (SELECT COUNT(*) FROM tasks WHERE due_date < CURDATE() AND status != 'Completed') as overdue_tasks,
       (SELECT COUNT(*) FROM tasks WHERE due_date = CURDATE() AND status != 'Completed') as due_today_tasks`,
    []
  );

  res.json({
    success: true,
    data: { statistics: stats[0] }
  });
}));

export default router;

