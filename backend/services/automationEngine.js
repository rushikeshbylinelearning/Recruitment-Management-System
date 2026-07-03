/**
 * Pipeline Automation Engine
 * Handles automated actions triggered by stage changes
 */

import { query, transaction } from '../config/database.js';
import emailService from './emailService.js';

class AutomationEngine {
  /**
   * Execute automations for a stage change
   * @param {Object} params - Automation parameters
   * @param {number} params.candidateId - Candidate ID
   * @param {string} params.newStage - New stage
   * @param {string} params.previousStage - Previous stage
   * @param {number} params.userId - User who triggered the change
   */
  async executeStageChangeAutomations({ candidateId, newStage, previousStage, userId }) {
    try {
      console.log(`[Automation] Executing automations for candidate ${candidateId}: ${previousStage} → ${newStage}`);

      // Fetch active automations for this stage
      const automations = await query(
        `SELECT pa.*, 
          (SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', aa.id,
              'action_type', aa.action_type,
              'action_order', aa.action_order,
              'config', aa.config,
              'is_active', aa.is_active
            )
          )
          FROM automation_actions aa
          WHERE aa.automation_id = pa.id AND aa.is_active = TRUE
          ORDER BY aa.action_order ASC
          ) as actions
        FROM pipeline_automations pa
        WHERE pa.trigger_stage = ? 
          AND pa.trigger_event = 'on_enter'
          AND pa.is_active = TRUE
        ORDER BY pa.priority DESC`,
        [newStage]
      );

      if (!automations || automations.length === 0) {
        console.log(`[Automation] No automations found for stage: ${newStage}`);
        return { success: true, executed: 0 };
      }

      // Get candidate details for variable replacement
      const [candidate] = await query(
        `SELECT c.*, j.title as job_title, u.name as assigned_to_name
         FROM candidates c
         LEFT JOIN job_postings j ON c.job_id = j.id
         LEFT JOIN users u ON c.assigned_to = u.id
         WHERE c.id = ?`,
        [candidateId]
      );

      if (!candidate) {
        throw new Error(`Candidate ${candidateId} not found`);
      }

      let executedCount = 0;

      // Execute each automation asynchronously (non-blocking)
      for (const automation of automations) {
        setImmediate(async () => {
          try {
            await this.executeAutomation(automation, candidate, userId);
          } catch (error) {
            console.error(`[Automation] Error executing automation ${automation.id}:`, error);
          }
        });
        executedCount++;
      }

      return { success: true, executed: executedCount };
    } catch (error) {
      console.error('[Automation] Error in executeStageChangeAutomations:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a single automation with all its actions
   */
  async executeAutomation(automation, candidate, userId) {
    const startTime = Date.now();
    
    try {
      console.log(`[Automation] Executing: ${automation.name} (ID: ${automation.id})`);

      const actions = JSON.parse(automation.actions || '[]');
      
      if (!actions || actions.length === 0) {
        console.log(`[Automation] No actions defined for automation ${automation.id}`);
        return;
      }

      // Execute actions in sequence
      for (const action of actions) {
        try {
          await this.executeAction(action, candidate, userId, automation.id);
        } catch (actionError) {
          console.error(`[Automation] Action ${action.id} failed:`, actionError);
          
          // Log failed action
          await this.logExecution({
            automationId: automation.id,
            actionId: action.id,
            entityType: 'candidate',
            entityId: candidate.id,
            status: 'failed',
            errorMessage: actionError.message,
            executionTimeMs: Date.now() - startTime
          });
        }
      }

      // Log successful automation
      await this.logExecution({
        automationId: automation.id,
        entityType: 'candidate',
        entityId: candidate.id,
        status: 'success',
        executionTimeMs: Date.now() - startTime,
        metadata: { actionsExecuted: actions.length }
      });

    } catch (error) {
      console.error(`[Automation] Failed to execute automation ${automation.id}:`, error);
      
      await this.logExecution({
        automationId: automation.id,
        entityType: 'candidate',
        entityId: candidate.id,
        status: 'failed',
        errorMessage: error.message,
        executionTimeMs: Date.now() - startTime
      });
    }
  }

  /**
   * Execute a single action
   */
  async executeAction(action, candidate, userId, automationId) {
    const config = typeof action.config === 'string' ? JSON.parse(action.config) : action.config;
    
    console.log(`[Automation] Executing action: ${action.action_type}`);

    switch (action.action_type) {
      case 'email':
        await this.executeEmailAction(config, candidate, userId);
        break;
      
      case 'task':
        await this.executeTaskAction(config, candidate, userId);
        break;
      
      case 'interview':
        await this.executeInterviewAction(config, candidate, userId);
        break;
      
      case 'notification':
        await this.executeNotificationAction(config, candidate, userId);
        break;
      
      default:
        console.warn(`[Automation] Unknown action type: ${action.action_type}`);
    }
  }

  /**
   * Execute email action
   */
  async executeEmailAction(config, candidate, userId) {
    try {
      // Replace variables in email content
      const variables = this.buildVariables(candidate);
      
      let subject = config.subject || 'Notification from HR Team';
      let body = config.body || '';

      // Replace all variables
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, variables[key]);
        body = body.replace(regex, variables[key]);
      });

      // Determine recipient
      let recipientEmail = candidate.email;
      if (config.send_to === 'assigned_recruiter' && candidate.assigned_to_name) {
        // Get recruiter email
        const [recruiter] = await query('SELECT email FROM users WHERE id = ?', [candidate.assigned_to]);
        if (recruiter) recipientEmail = recruiter.email;
      }

      // Send email
      const result = await emailService.sendEmail(
        recipientEmail,
        subject,
        body,
        body
      );

      // Log activity
      await this.logActivity({
        entityType: 'candidate',
        entityId: candidate.id,
        actionType: 'email_sent',
        description: `Email sent: ${subject}`,
        metadata: { to: recipientEmail, subject, success: result.success },
        createdBy: userId
      });

      console.log(`[Automation] Email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('[Automation] Email action failed:', error);
      throw error;
    }
  }

  /**
   * Execute task creation action
   */
  async executeTaskAction(config, candidate, userId) {
    try {
      const variables = this.buildVariables(candidate);
      
      let title = config.title || 'New Task';
      let description = config.description || '';

      // Replace variables
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(regex, variables[key]);
        description = description.replace(regex, variables[key]);
      });

      // Determine assignee
      let assignedTo = candidate.assigned_to || userId;
      if (config.assigned_to === 'recruiter' && candidate.assigned_to) {
        assignedTo = candidate.assigned_to;
      } else if (config.assigned_to === 'hr_manager' || config.assigned_to === 'admin') {
        const [adminUser] = await query(
          "SELECT id FROM users WHERE role = 'Admin' AND status = 'Active' LIMIT 1"
        );
        if (adminUser) assignedTo = adminUser.id;
      }

      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (config.due_in_days || 3));

      // Create task
      const result = await query(
        `INSERT INTO tasks (title, description, assigned_to, related_entity_type, related_entity_id, 
          due_date, priority, status, created_by, created_at)
         VALUES (?, ?, ?, 'candidate', ?, ?, ?, 'Pending', ?, NOW())`,
        [title, description, assignedTo, candidate.id, dueDate, config.priority || 'medium', userId]
      );

      // Log activity
      await this.logActivity({
        entityType: 'candidate',
        entityId: candidate.id,
        actionType: 'task_created',
        description: `Task created: ${title}`,
        metadata: { taskId: result.insertId, assignedTo, dueDate },
        createdBy: userId
      });

      console.log(`[Automation] Task created: ${title}`);
    } catch (error) {
      console.error('[Automation] Task action failed:', error);
      throw error;
    }
  }

  /**
   * Execute interview scheduling action
   */
  async executeInterviewAction(config, candidate, userId) {
    try {
      // This creates a placeholder interview that needs to be scheduled
      const scheduledDate = new Date();
      scheduledDate.setHours(scheduledDate.getHours() + (config.delay_hours || 24));

      const result = await query(
        `INSERT INTO interviews (candidate_id, interviewer_id, scheduled_date, duration, 
          type, status, round, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'Scheduled', ?, ?, NOW())`,
        [
          candidate.id,
          config.interviewer_id || userId,
          scheduledDate,
          config.duration || 60,
          config.type || 'Technical',
          config.round || 1,
          userId
        ]
      );

      // Log activity
      await this.logActivity({
        entityType: 'candidate',
        entityId: candidate.id,
        actionType: 'interview_scheduled',
        description: `${config.type || 'Technical'} interview scheduled`,
        metadata: { interviewId: result.insertId, scheduledDate, type: config.type },
        createdBy: userId
      });

      console.log(`[Automation] Interview scheduled for candidate ${candidate.id}`);
    } catch (error) {
      console.error('[Automation] Interview action failed:', error);
      throw error;
    }
  }

  /**
   * Execute notification action
   */
  async executeNotificationAction(config, candidate, userId) {
    // Placeholder for future notification system
    console.log(`[Automation] Notification action: ${config.message}`);
    
    await this.logActivity({
      entityType: 'candidate',
      entityId: candidate.id,
      actionType: 'notification_sent',
      description: config.message || 'Notification sent',
      metadata: config,
      createdBy: userId
    });
  }

  /**
   * Build variable replacement map
   */
  buildVariables(candidate) {
    return {
      candidate_name: candidate.name || '',
      candidate_email: candidate.email || '',
      candidate_phone: candidate.phone || '',
      position: candidate.position || '',
      job_title: candidate.job_title || candidate.position || '',
      stage: candidate.stage || '',
      company_name: 'Byline HR',
      assigned_to: candidate.assigned_to_name || 'HR Team'
    };
  }

  /**
   * Log activity to activity_logs table
   */
  async logActivity({ entityType, entityId, actionType, description, metadata, createdBy }) {
    try {
      await query(
        `INSERT INTO activity_logs (entity_type, entity_id, action_type, description, metadata, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [entityType, entityId, actionType, description, JSON.stringify(metadata || {}), createdBy]
      );
    } catch (error) {
      console.error('[Automation] Failed to log activity:', error);
    }
  }

  /**
   * Log automation execution
   */
  async logExecution({ automationId, actionId, entityType, entityId, status, errorMessage, executionTimeMs, metadata }) {
    try {
      await query(
        `INSERT INTO automation_execution_log 
         (automation_id, action_id, entity_type, entity_id, status, error_message, execution_time_ms, metadata, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          automationId,
          actionId || null,
          entityType,
          entityId,
          status,
          errorMessage || null,
          executionTimeMs || 0,
          JSON.stringify(metadata || {})
        ]
      );
    } catch (error) {
      console.error('[Automation] Failed to log execution:', error);
    }
  }
}

export default new AutomationEngine();
