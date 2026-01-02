import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateTask, validateId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Get all tasks
router.get('/', authenticateToken, checkPermission('tasks', 'view'), validatePagination, handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const priority = req.query.priority || '';
  const assignedTo = req.query.assignedTo || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  // For non-admin users, only show tasks assigned to them
  if (req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    whereClause += ' AND t.assigned_to = ?';
    params.push(req.user.id);
  }

  if (status) {
    whereClause += ' AND t.status = ?';
    params.push(status);
  }

  if (priority) {
    whereClause += ' AND t.priority = ?';
    params.push(priority);
  }

  if (assignedTo && (req.user.role === 'Admin' || req.user.role === 'HR Manager')) {
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
    `SELECT t.*, u.name as assigned_to_name, c.name as candidate_name, j.title as job_title,
            creator.name as created_by_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     LEFT JOIN users creator ON t.created_by = creator.id
     ${whereClause}
     ORDER BY t.created_at DESC 
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  // Map the data to frontend format
  const mappedTasks = tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    assignedTo: task.assigned_to,
    assignedToName: task.assigned_to_name || 'Unassigned',
    jobId: task.job_id,
    jobTitle: task.job_title || null,
    candidateId: task.candidate_id,
    candidateName: task.candidate_name || null,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    createdBy: task.created_by,
    createdByName: task.created_by_name || 'Unknown',
    createdDate: task.created_at,
    updatedDate: task.updated_at
  }));

  res.json({
    success: true,
    data: {
      tasks: mappedTasks,
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

  const task = tasks[0];
  const mappedTask = {
    id: task.id,
    title: task.title,
    description: task.description,
    assignedTo: task.assigned_to,
    assignedToName: task.assigned_to_name || 'Unassigned',
    jobId: task.job_id,
    jobTitle: task.job_title || null,
    candidateId: task.candidate_id,
    candidateName: task.candidate_name || null,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    createdBy: task.created_by,
    createdByName: task.created_by_name || 'Unknown',
    createdDate: task.created_at,
    updatedDate: task.updated_at
  };

  res.json({
    success: true,
    data: { task: mappedTask }
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

  // Notify assignee by email when created by Admin/HR Manager
  let emailResult = null;
  try {
    if ((req.user.role === 'Admin' || req.user.role === 'HR Manager') && assignedTo) {
      const assigneeRows = await query('SELECT email, name FROM users WHERE id = ?', [assignedTo]);
      if (assigneeRows.length > 0 && assigneeRows[0].email) {
        const assigneeEmail = assigneeRows[0].email;
        const assigneeName = assigneeRows[0].name || 'Recruiter';
        const creatorName = req.user.name || req.user.username || 'HR Team';
        const subject = `New Task Assignment: ${title}`;
        
        // Create detailed HTML email template
        const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Task Assignment Notification</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
                .content { padding: 30px; }
                .task-card { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
                .task-title { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
                .task-description { color: #64748b; line-height: 1.6; margin-bottom: 15px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
                .info-item { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .info-label { font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
                .info-value { font-size: 16px; color: #1e293b; font-weight: 500; }
                .priority-high { border-left-color: #ef4444; }
                .priority-medium { border-left-color: #f59e0b; }
                .priority-low { border-left-color: #10b981; }
                .status-pending { background-color: #fef3c7; color: #92400e; }
                .status-progress { background-color: #dbeafe; color: #1e40af; }
                .status-completed { background-color: #d1fae5; color: #065f46; }
                .due-date { background-color: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; margin: 15px 0; }
                .due-date.urgent { background-color: #fef2f2; border-color: #f87171; }
                .action-button { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; margin: 20px 0; }
                .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
                .highlight { background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
                @media (max-width: 600px) {
                    .info-grid { grid-template-columns: 1fr; }
                    .content { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Task Assignment</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">You have been assigned a new task</p>
                </div>
                
                <div class="content">
                    <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
                        Hello <strong>${assigneeName}</strong>,<br>
                        You have been assigned a new task by <strong>${creatorName}</strong>.
                    </p>
                    
                    <div class="task-card priority-${priority.toLowerCase()}">
                        <div class="task-title">${title}</div>
                        ${description ? `<div class="task-description">${description}</div>` : ''}
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Priority Level</div>
                            <div class="info-value priority-${priority.toLowerCase()}">${priority}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Current Status</div>
                            <div class="info-value status-${status.toLowerCase().replace(' ', '-')}">${status}</div>
                        </div>
                    </div>
                    
                    ${dueDate ? `
                    <div class="due-date ${new Date(dueDate) < new Date(Date.now() + 24*60*60*1000) ? 'urgent' : ''}">
                        <div class="info-label">Due Date</div>
                        <div class="info-value" style="font-size: 18px; font-weight: 700;">
                            ${new Date(dueDate).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </div>
                        <div style="font-size: 14px; margin-top: 5px;">
                            ${Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                        </div>
                    </div>
                    ` : ''}
                    
                    ${jobId ? `
                    <div class="info-item">
                        <div class="info-label">Related Job</div>
                        <div class="info-value">Job ID: ${jobId}</div>
                    </div>
                    ` : ''}
                    
                    ${candidateId ? `
                    <div class="info-item">
                        <div class="info-label">Related Candidate</div>
                        <div class="info-value">Candidate ID: ${candidateId}</div>
                    </div>
                    ` : ''}
                    
                    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <h3 style="margin: 0 0 10px 0; color: #1e40af;">Action Required</h3>
                        <p style="margin: 0; color: #1e40af;">
                            Please log in to the HR Workflow Management system to view full details and take action on this task.
                        </p>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="https://hr.legatolxp.online/" target="_blank" rel="noopener noreferrer" class="action-button">View Task Details</a>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is an automated notification from HR Workflow Management System</p>
                    <p>Please do not reply to this email</p>
                </div>
            </div>
        </body>
        </html>
        `;
        
        // Plain text fallback
        const textTemplate = `
Hello ${assigneeName},

You have been assigned a new task by ${creatorName}.

TASK DETAILS:
==============
Title: ${title}
${description ? `Description: ${description}` : ''}
Priority: ${priority}
Status: ${status}
${dueDate ? `Due Date: ${new Date(dueDate).toLocaleDateString()}` : ''}
${jobId ? `Job ID: ${jobId}` : ''}
${candidateId ? `Candidate ID: ${candidateId}` : ''}

ACTION REQUIRED:
================
Please log in to the HR Workflow Management system to view details and take action.

Best regards,
HR Team
        `;
        
        emailResult = await emailService.sendEmail(assigneeEmail, subject, textTemplate, htmlTemplate);
      }
    }
  } catch (e) {
    emailResult = {
      success: false,
      message: 'Email notification failed',
      error: e?.message || e?.toString() || String(e),
      stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    };
  }

  const responseData = {
    success: true,
    message: 'Task created successfully',
    data: {
      taskId: result.insertId
    }
  };

  // Include email notification result in response
  if (emailResult !== null) {
    responseData.emailNotification = emailResult;
    if (!emailResult.success) {
      responseData.warning = 'Task created but email notification failed';
    }
  }

  res.status(201).json(responseData);
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
  const existingTasks = await query('SELECT id, assigned_to FROM tasks WHERE id = ?', [taskId]);
  if (existingTasks.length === 0) {
    throw new NotFoundError('Task not found');
  }
  const previousAssignee = existingTasks[0].assigned_to;

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

  // If assignee changed and action by Admin/HR Manager, notify new assignee
  let emailResult = null;
  try {
    const assigneeChanged = previousAssignee !== assignedTo;
    if (assigneeChanged && (req.user.role === 'Admin' || req.user.role === 'HR Manager') && assignedTo) {
      const assigneeRows = await query('SELECT email, name FROM users WHERE id = ?', [assignedTo]);
      if (assigneeRows.length > 0 && assigneeRows[0].email) {
        const assigneeEmail = assigneeRows[0].email;
        const assigneeName = assigneeRows[0].name || 'Recruiter';
        const editorName = req.user.name || req.user.username || 'HR Team';
        const subject = `Task Updated: ${title}`;
        
        // Create detailed HTML email template for task update
        const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Task Update Notification</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
                .content { padding: 30px; }
                .task-card { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
                .task-title { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
                .task-description { color: #64748b; line-height: 1.6; margin-bottom: 15px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
                .info-item { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .info-label { font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
                .info-value { font-size: 16px; color: #1e293b; font-weight: 500; }
                .priority-high { border-left-color: #ef4444; }
                .priority-medium { border-left-color: #f59e0b; }
                .priority-low { border-left-color: #10b981; }
                .status-pending { background-color: #fef3c7; color: #92400e; }
                .status-progress { background-color: #dbeafe; color: #1e40af; }
                .status-completed { background-color: #d1fae5; color: #065f46; }
                .due-date { background-color: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; margin: 15px 0; }
                .due-date.urgent { background-color: #fef2f2; border-color: #f87171; }
                .action-button { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; margin: 20px 0; }
                .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
                .update-badge { background-color: #fef3c7; color: #92400e; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                @media (max-width: 600px) {
                    .info-grid { grid-template-columns: 1fr; }
                    .content { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Task Updated</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Task has been updated and assigned to you</p>
                </div>
                
                <div class="content">
                    <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
                        Hello <strong>${assigneeName}</strong>,<br>
                        A task has been updated and assigned to you by <strong>${editorName}</strong>.
                    </p>
                    
                    <div class="task-card priority-${priority.toLowerCase()}">
                        <div class="task-title">${title} <span class="update-badge">UPDATED</span></div>
                        ${description ? `<div class="task-description">${description}</div>` : ''}
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Priority Level</div>
                            <div class="info-value priority-${priority.toLowerCase()}">${priority}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Current Status</div>
                            <div class="info-value status-${status.toLowerCase().replace(' ', '-')}">${status}</div>
                        </div>
                    </div>
                    
                    ${dueDate ? `
                    <div class="due-date ${new Date(dueDate) < new Date(Date.now() + 24*60*60*1000) ? 'urgent' : ''}">
                        <div class="info-label">Due Date</div>
                        <div class="info-value" style="font-size: 18px; font-weight: 700;">
                            ${new Date(dueDate).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </div>
                        <div style="font-size: 14px; margin-top: 5px;">
                            ${Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                        </div>
                    </div>
                    ` : ''}
                    
                    ${jobId ? `
                    <div class="info-item">
                        <div class="info-label">Related Job</div>
                        <div class="info-value">Job ID: ${jobId}</div>
                    </div>
                    ` : ''}
                    
                    ${candidateId ? `
                    <div class="info-item">
                        <div class="info-label">Related Candidate</div>
                        <div class="info-value">Candidate ID: ${candidateId}</div>
                    </div>
                    ` : ''}
                    
                    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <h3 style="margin: 0 0 10px 0; color: #1e40af;">Action Required</h3>
                        <p style="margin: 0; color: #1e40af;">
                            Please log in to the HR Workflow Management system to view the updated details and take action on this task.
                        </p>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="https://hr.legatolxp.online/" target="_blank" rel="noopener noreferrer" class="action-button">View Updated Task</a>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is an automated notification from HR Workflow Management System</p>
                    <p>Please do not reply to this email</p>
                </div>
            </div>
        </body>
        </html>
        `;
        
        // Plain text fallback
        const textTemplate = `
Hello ${assigneeName},

A task has been updated and assigned to you by ${editorName}.

UPDATED TASK DETAILS:
=====================
Title: ${title}
${description ? `Description: ${description}` : ''}
Priority: ${priority}
Status: ${status}
${dueDate ? `Due Date: ${new Date(dueDate).toLocaleDateString()}` : ''}
${jobId ? `Job ID: ${jobId}` : ''}
${candidateId ? `Candidate ID: ${candidateId}` : ''}

ACTION REQUIRED:
================
Please log in to the HR Workflow Management system to view the updated details and take action.

Best regards,
HR Team
        `;
        
        emailResult = await emailService.sendEmail(assigneeEmail, subject, textTemplate, htmlTemplate);
      }
    }
  } catch (e) {
    emailResult = {
      success: false,
      message: 'Email notification failed',
      error: e?.message || e?.toString() || String(e),
      stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    };
  }

  const responseData = {
    success: true,
    message: 'Task updated successfully'
  };

  // Include email notification result in response
  if (emailResult !== null) {
    responseData.emailNotification = emailResult;
    if (!emailResult.success) {
      responseData.warning = 'Task updated but email notification failed';
    }
  }

  res.json(responseData);
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
    `SELECT t.*, c.name as candidate_name, j.title as job_title, creator.name as created_by_name
     FROM tasks t
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     LEFT JOIN users creator ON t.created_by = creator.id
     WHERE t.assigned_to = ?
     ORDER BY t.due_date ASC`,
    [userId]
  );

  // Map the data to frontend format
  const mappedTasks = tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    assignedTo: task.assigned_to,
    assignedToName: 'Current User', // Since this is for a specific user
    jobId: task.job_id,
    jobTitle: task.job_title || null,
    candidateId: task.candidate_id,
    candidateName: task.candidate_name || null,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    createdBy: task.created_by,
    createdByName: task.created_by_name || 'Unknown',
    createdDate: task.created_at,
    updatedDate: task.updated_at
  }));

  res.json({
    success: true,
    data: { tasks: mappedTasks }
  });
}));

// Get overdue tasks
router.get('/overdue/list', authenticateToken, checkPermission('tasks', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const tasks = await query(
    `SELECT t.*, u.name as assigned_to_name, c.name as candidate_name, j.title as job_title, creator.name as created_by_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     LEFT JOIN users creator ON t.created_by = creator.id
     WHERE t.due_date < CURDATE() AND t.status != 'Completed'
     ORDER BY t.due_date ASC`,
    []
  );

  // Map the data to frontend format
  const mappedTasks = tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    assignedTo: task.assigned_to,
    assignedToName: task.assigned_to_name || 'Unassigned',
    jobId: task.job_id,
    jobTitle: task.job_title || null,
    candidateId: task.candidate_id,
    candidateName: task.candidate_name || null,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    createdBy: task.created_by,
    createdByName: task.created_by_name || 'Unknown',
    createdDate: task.created_at,
    updatedDate: task.updated_at
  }));

  res.json({
    success: true,
    data: { tasks: mappedTasks }
  });
}));

// Get tasks due today
router.get('/due-today/list', authenticateToken, checkPermission('tasks', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const tasks = await query(
    `SELECT t.*, u.name as assigned_to_name, c.name as candidate_name, j.title as job_title, creator.name as created_by_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN candidates c ON t.candidate_id = c.id
     LEFT JOIN job_postings j ON t.job_id = j.id
     LEFT JOIN users creator ON t.created_by = creator.id
     WHERE t.due_date = CURDATE() AND t.status != 'Completed'
     ORDER BY t.due_date ASC`,
    []
  );

  // Map the data to frontend format
  const mappedTasks = tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    assignedTo: task.assigned_to,
    assignedToName: task.assigned_to_name || 'Unassigned',
    jobId: task.job_id,
    jobTitle: task.job_title || null,
    candidateId: task.candidate_id,
    candidateName: task.candidate_name || null,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    createdBy: task.created_by,
    createdByName: task.created_by_name || 'Unknown',
    createdDate: task.created_at,
    updatedDate: task.updated_at
  }));

  res.json({
    success: true,
    data: { tasks: mappedTasks }
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

