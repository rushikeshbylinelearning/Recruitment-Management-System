/**
 * Notification Service
 * 
 * Handles task assignment notifications for the HR Planner Workspace.
 * Creates notification records and sends HTML email alerts to assignees.
 * 
 * Implements requirements:
 * - R4 (Task Assignment and Notification System): Email and in-app notifications
 */

import { query } from '../config/database.js';
import emailService from './emailService.js';

/**
 * Send task assignment notification to an assignee.
 * 
 * This function:
 * 1. Inserts a notification row into the notifications table
 * 2. Sends an HTML email via the existing emailService
 * 3. Updates the notification row with email_sent status
 * 
 * @param {Object} task - The task object with id, title, description, priority, status, due_date
 * @param {Object} assignee - The assignee user object with id, email, name
 * @param {Object} assigner - The assigning user object with id, name, role
 * @param {Object} db - Database connection (optional, uses default query if not provided)
 * @returns {Promise<Object>} { success: boolean, notificationId?: number, emailResult?: Object, error?: string }
 * 
 * @example
 * const result = await sendTaskAssignmentNotification(
 *   { id: 123, title: 'Review candidate', priority: 'high', status: 'pending', due_date: '2026-12-31' },
 *   { id: 42, email: 'john@example.com', name: 'John Doe' },
 *   { id: 1, name: 'Admin User', role: 'Admin' },
 *   db
 * );
 */
export async function sendTaskAssignmentNotification(task, assignee, assigner, db = null) {
  const queryFn = db ? db.query.bind(db) : query;

  try {
    // 1. Insert notification row into the database
    const notificationTitle = `New Task Assigned: ${task.title}`;
    const notificationMessage = `You have been assigned a new task by ${assigner.name}`;

    const insertResult = await queryFn(
      `INSERT INTO notifications (user_id, type, title, message, task_id, email_sent, email_sent_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [assignee.id, 'task_assigned', notificationTitle, notificationMessage, task.id, 0, null]
    );

    const notificationId = insertResult.insertId;

    // 2. Build and send email
    let emailResult = { success: false };
    
    try {
      const htmlTemplate = buildTaskAssignmentEmailTemplate(task, assigner);
      const plainTextFallback = buildPlainTextFallback(task, assigner);

      emailResult = await emailService.sendEmail(
        assignee.email,
        notificationTitle,
        plainTextFallback,
        htmlTemplate
      );

      // 3. Update notification row with email_sent status
      if (emailResult.success) {
        await queryFn(
          `UPDATE notifications SET email_sent = 1, email_sent_at = NOW() WHERE id = ?`,
          [notificationId]
        );
        
        console.log(`[NotificationService] Task assignment notification sent successfully to ${assignee.email} for task #${task.id}`);
      } else {
        console.error(`[NotificationService] Failed to send email to ${assignee.email} for task #${task.id}:`, emailResult.error);
      }
    } catch (emailError) {
      // Log email error but don't throw - notification row still exists for in-app viewing
      console.error(`[NotificationService] Email send error for task #${task.id}:`, emailError);
      emailResult = { success: false, error: emailError.message };
    }

    return {
      success: true,
      notificationId,
      emailResult
    };

  } catch (error) {
    console.error('[NotificationService] sendTaskAssignmentNotification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Build HTML email template for task assignment notification.
 * 
 * Uses inline CSS for email client compatibility.
 * Includes task title, description, priority, status, due date, and assigner name.
 * 
 * @param {Object} task - The task object
 * @param {Object} assigner - The assigning user object
 * @returns {string} HTML string
 */
export function buildTaskAssignmentEmailTemplate(task, assigner) {
  const priorityColor = {
    low: '#10B981',    // green
    medium: '#F59E0B', // amber
    high: '#EF4444'    // red
  }[task.priority] || '#6B7280';

  const statusLabel = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed'
  }[task.status] || task.status;

  const dueDateFormatted = task.due_date 
    ? new Date(task.due_date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'No due date';

  const priorityLabel = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Not set';
  const description = task.description || 'No description provided';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Assignment Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F3F4F6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 32px 40px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 600;">New Task Assigned</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 40px 24px 40px;">
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 24px;">
                Hello,
              </p>
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 24px;">
                <strong>${assigner.name}</strong> has assigned you a new task in the HR Planner Workspace.
              </p>
              
              <!-- Task Card -->
              <table role="presentation" style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                      ${task.title}
                    </h2>
                    <p style="margin: 0 0 20px 0; color: #6B7280; font-size: 14px; line-height: 20px;">
                      ${description}
                    </p>
                    
                    <!-- Task Details Grid -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; width: 50%; vertical-align: top;">
                          <span style="color: #6B7280; font-size: 12px; display: block; margin-bottom: 4px;">Priority</span>
                          <span style="display: inline-block; padding: 4px 12px; background-color: ${priorityColor}; color: #FFFFFF; font-size: 12px; font-weight: 600; border-radius: 12px;">
                            ${priorityLabel}
                          </span>
                        </td>
                        <td style="padding: 8px 0; width: 50%; vertical-align: top;">
                          <span style="color: #6B7280; font-size: 12px; display: block; margin-bottom: 4px;">Status</span>
                          <span style="color: #374151; font-size: 14px; font-weight: 500;">
                            ${statusLabel}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top;" colspan="2">
                          <span style="color: #6B7280; font-size: 12px; display: block; margin-bottom: 4px;">Due Date</span>
                          <span style="color: #374151; font-size: 14px; font-weight: 500;">
                            ${dueDateFormatted}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top;" colspan="2">
                          <span style="color: #6B7280; font-size: 12px; display: block; margin-bottom: 4px;">Assigned By</span>
                          <span style="color: #374151; font-size: 14px; font-weight: 500;">
                            ${assigner.name}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 0 0 24px 0;">
                    <a href="${process.env.APP_URL || 'https://your-app-url.com'}/planner" 
                       style="display: inline-block; padding: 12px 32px; background-color: #3B82F6; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px;">
                      View Task
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 20px;">
                Please review the task details and update its status as you progress.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 12px; line-height: 16px;">
                Best regards,<br>
                HR Workflow Management Team
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 11px; line-height: 16px;">
                This is an automated notification from the HR Planner Workspace.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Build plain text fallback for task assignment email.
 * 
 * Provides a simple text-only version for email clients that don't support HTML.
 * 
 * @param {Object} task - The task object
 * @param {Object} assigner - The assigning user object
 * @returns {string} Plain text string
 */
export function buildPlainTextFallback(task, assigner) {
  const dueDateFormatted = task.due_date 
    ? new Date(task.due_date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'No due date';

  const priorityLabel = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Not set';
  const statusLabel = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed'
  }[task.status] || task.status;
  const description = task.description || 'No description provided';

  return `
NEW TASK ASSIGNED

Hello,

${assigner.name} has assigned you a new task in the HR Planner Workspace.

TASK DETAILS
============

Title: ${task.title}

Description: ${description}

Priority: ${priorityLabel}

Status: ${statusLabel}

Due Date: ${dueDateFormatted}

Assigned By: ${assigner.name}


Please log in to the HR Planner Workspace to view the full task details and update its status as you progress.

View Task: ${process.env.APP_URL || 'https://your-app-url.com'}/planner


Best regards,
HR Workflow Management Team

---
This is an automated notification from the HR Planner Workspace.
  `.trim();
}

// Default export with all functions
export default {
  sendTaskAssignmentNotification,
  buildTaskAssignmentEmailTemplate,
  buildPlainTextFallback
};
