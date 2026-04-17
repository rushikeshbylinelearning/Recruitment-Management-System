/**
 * Workflow Engine - Phase 3
 * Rule-based automation: IF (Trigger + Conditions) THEN (Actions)
 */

import { query } from '../config/database.js';
import emailService from './emailService.js';

class WorkflowEngine {
  /**
   * Main entry point — called when any system event occurs
   * @param {string} entityType - 'candidate', 'job', 'interview'
   * @param {string} eventType  - 'stage_change', 'created', 'updated', etc.
   * @param {Object} entityData - Full entity data for condition evaluation
   * @param {number} userId     - User who triggered the event
   */
  async run(entityType, eventType, entityData, userId) {
    try {
      // Fetch active workflows whose trigger matches this event
      const workflows = await query(
        `SELECT w.*, wt.config as trigger_config
         FROM workflows w
         JOIN workflow_triggers wt ON wt.workflow_id = w.id
         WHERE w.is_active = TRUE
           AND wt.entity_type = ?
           AND wt.event_type = ?`,
        [entityType, eventType]
      );

      if (!workflows.length) return { executed: 0 };

      let executed = 0;
      for (const workflow of workflows) {
        // Filter by trigger config (e.g. specific stage transition)
        if (!this._matchesTriggerConfig(workflow.trigger_config, entityData)) continue;

        // Evaluate conditions asynchronously (non-blocking)
        setImmediate(async () => {
          try {
            await this._executeWorkflow(workflow, entityData, userId);
          } catch (err) {
            console.error(`[WorkflowEngine] Error in workflow ${workflow.id}:`, err);
          }
        });
        executed++;
      }

      return { executed };
    } catch (err) {
      console.error('[WorkflowEngine] run() error:', err);
      return { executed: 0, error: err.message };
    }
  }

  // ─── Trigger Config Matching ────────────────────────────────────────────────

  _matchesTriggerConfig(triggerConfigRaw, entityData) {
    try {
      const config = typeof triggerConfigRaw === 'string'
        ? JSON.parse(triggerConfigRaw || '{}')
        : (triggerConfigRaw || {});

      // stage_change: optionally filter by from/to stage
      if (config.to_stage && config.to_stage !== entityData.stage) return false;
      if (config.from_stage && config.from_stage !== entityData.previous_stage) return false;

      return true;
    } catch {
      return true; // no config = always match
    }
  }

  // ─── Workflow Execution ──────────────────────────────────────────────────────

  async _executeWorkflow(workflow, entityData, userId) {
    const startTime = Date.now();

    // Load conditions and actions
    const [conditions, actions] = await Promise.all([
      query('SELECT * FROM workflow_conditions WHERE workflow_id = ? ORDER BY condition_order ASC', [workflow.id]),
      query('SELECT * FROM workflow_actions WHERE workflow_id = ? AND is_active = TRUE ORDER BY execution_order ASC', [workflow.id]),
    ]);

    // Evaluate conditions
    const conditionsMet = this._evaluateConditions(conditions, entityData);
    if (!conditionsMet) {
      await this._log(workflow.id, entityData, 'skipped', 'Conditions not met', 0, Date.now() - startTime);
      return;
    }

    // Execute actions in order
    let actionsExecuted = 0;
    for (const action of actions) {
      try {
        await this._executeAction(action, entityData, userId);
        actionsExecuted++;
      } catch (err) {
        console.error(`[WorkflowEngine] Action ${action.id} failed:`, err);
      }
    }

    await this._log(workflow.id, entityData, 'success', `Executed ${actionsExecuted} actions`, actionsExecuted, Date.now() - startTime);
  }

  // ─── Condition Engine ────────────────────────────────────────────────────────

  /**
   * Evaluate all conditions against entity data.
   * Supports AND / OR logic groups.
   * Mixed groups: AND conditions must all pass; OR conditions need at least one.
   */
  _evaluateConditions(conditions, data) {
    if (!conditions || conditions.length === 0) return true;

    const andConditions = conditions.filter(c => c.logic_group === 'AND');
    const orConditions  = conditions.filter(c => c.logic_group === 'OR');

    const andPassed = andConditions.every(c => this._compare(data[c.field], c.operator, c.value));
    const orPassed  = orConditions.length === 0 || orConditions.some(c => this._compare(data[c.field], c.operator, c.value));

    return andPassed && orPassed;
  }

  _compare(fieldValue, operator, conditionValue) {
    const a = String(fieldValue ?? '').toLowerCase().trim();
    const b = String(conditionValue ?? '').toLowerCase().trim();
    const aNum = parseFloat(a);
    const bNum = parseFloat(b);

    switch (operator) {
      case '=':           return a === b;
      case '!=':          return a !== b;
      case '>':           return !isNaN(aNum) && !isNaN(bNum) && aNum > bNum;
      case '<':           return !isNaN(aNum) && !isNaN(bNum) && aNum < bNum;
      case '>=':          return !isNaN(aNum) && !isNaN(bNum) && aNum >= bNum;
      case '<=':          return !isNaN(aNum) && !isNaN(bNum) && aNum <= bNum;
      case 'contains':    return a.includes(b);
      case 'not_contains':return !a.includes(b);
      default:            return false;
    }
  }

  // ─── Action Engine ───────────────────────────────────────────────────────────

  async _executeAction(action, entityData, userId) {
    const config = typeof action.config === 'string' ? JSON.parse(action.config) : action.config;

    switch (action.action_type) {
      case 'email':        return this._actionEmail(config, entityData, userId);
      case 'task':         return this._actionTask(config, entityData, userId);
      case 'interview':    return this._actionInterview(config, entityData, userId);
      case 'webhook':      return this._actionWebhook(config, entityData);
      case 'stage_change': return this._actionStageChange(config, entityData, userId);
      default:
        console.warn(`[WorkflowEngine] Unknown action type: ${action.action_type}`);
    }
  }

  // 1. Email action
  async _actionEmail(config, entityData, userId) {
    const vars = this._buildVars(entityData);
    const subject = this._interpolate(config.subject || 'Notification', vars);
    const body    = this._interpolate(config.body || '', vars);

    let to = entityData.email;
    if (config.to === 'recruiter' && entityData.assigned_to) {
      const [recruiter] = await query('SELECT email FROM users WHERE id = ?', [entityData.assigned_to]);
      if (recruiter) to = recruiter.email;
    } else if (config.to === 'custom' && config.custom_email) {
      to = config.custom_email;
    }

    // Use template if template_id provided
    if (config.template_id) {
      const [template] = await query('SELECT subject, content FROM email_templates WHERE id = ?', [config.template_id]);
      if (template) {
        await emailService.sendEmail(to, this._interpolate(template.subject, vars), this._interpolate(template.content, vars), this._interpolate(template.content, vars));
        await this._logActivity(entityData, 'email_sent', `Workflow email sent via template: ${template.subject}`, userId);
        return;
      }
    }

    await emailService.sendEmail(to, subject, body, body);
    await this._logActivity(entityData, 'email_sent', `Workflow email sent: ${subject}`, userId);
  }

  // 2. Task action
  async _actionTask(config, entityData, userId) {
    const vars  = this._buildVars(entityData);
    const title = this._interpolate(config.title || 'Follow up', vars);
    const desc  = this._interpolate(config.description || '', vars);

    let assignedTo = entityData.assigned_to || userId;
    if (config.assigned_to === 'hr_manager') {
      const [hr] = await query("SELECT id FROM users WHERE role = 'HR Manager' AND status = 'Active' LIMIT 1");
      if (hr) assignedTo = hr.id;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (parseInt(config.due_in_days) || 3));

    const result = await query(
      `INSERT INTO tasks (title, description, assigned_to, related_entity_type, related_entity_id,
        due_date, priority, status, created_by, created_at)
       VALUES (?, ?, ?, 'candidate', ?, ?, ?, 'Pending', ?, NOW())`,
      [title, desc, assignedTo, entityData.id, dueDate, config.priority || 'medium', userId]
    );

    await this._logActivity(entityData, 'task_created', `Workflow task created: ${title}`, userId);
    return result;
  }

  // 3. Interview action
  async _actionInterview(config, entityData, userId) {
    const scheduledDate = new Date();
    scheduledDate.setHours(scheduledDate.getHours() + (parseInt(config.delay_hours) || 24));

    const result = await query(
      `INSERT INTO interviews (candidate_id, interviewer_id, scheduled_date, duration,
        type, status, round, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'Scheduled', ?, ?, NOW())`,
      [entityData.id, config.interviewer_id || userId, scheduledDate, config.duration || 60,
       config.type || 'Technical', config.round || 1, userId]
    );

    await this._logActivity(entityData, 'interview_scheduled', `Workflow interview scheduled: ${config.type || 'Technical'}`, userId);
    return result;
  }

  // 4. Webhook action (future-ready)
  async _actionWebhook(config, entityData) {
    if (!config.url) return;
    try {
      const { default: https } = await import('https');
      const { default: http }  = await import('http');
      const payload = JSON.stringify({ event: 'workflow_action', data: entityData, timestamp: new Date().toISOString() });
      const url = new URL(config.url);
      const client = url.protocol === 'https:' ? https : http;
      await new Promise((resolve, reject) => {
        const req = client.request({ hostname: url.hostname, path: url.pathname, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, resolve);
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
      console.log(`[WorkflowEngine] Webhook sent to ${config.url}`);
    } catch (err) {
      console.error('[WorkflowEngine] Webhook failed:', err.message);
    }
  }

  // 5. Stage change action
  async _actionStageChange(config, entityData, userId) {
    if (!config.stage) return;
    await query(
      'UPDATE candidates SET stage = ?, previous_stage = ?, stage_updated_at = NOW() WHERE id = ?',
      [config.stage, entityData.stage, entityData.id]
    );
    await this._logActivity(entityData, 'stage_change', `Workflow changed stage to: ${config.stage}`, userId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _buildVars(data) {
    return {
      candidate_name:  data.name || '',
      candidate_email: data.email || '',
      candidate_phone: data.phone || '',
      position:        data.position || '',
      job_title:       data.job_title || data.position || '',
      stage:           data.stage || '',
      previous_stage:  data.previous_stage || '',
      experience:      data.experience || '',
      location:        data.location || '',
      company_name:    'Byline HR',
      assigned_to:     data.assigned_to_name || 'HR Team',
    };
  }

  _interpolate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
  }

  async _logActivity(entityData, actionType, description, userId) {
    try {
      await query(
        `INSERT INTO activity_logs (entity_type, entity_id, action_type, description, metadata, created_by, created_at)
         VALUES ('candidate', ?, ?, ?, ?, ?, NOW())`,
        [entityData.id, actionType, description, JSON.stringify({ workflow: true }), userId]
      );
    } catch (err) {
      console.error('[WorkflowEngine] logActivity failed:', err);
    }
  }

  async _log(workflowId, entityData, status, message, actionsExecuted, executionTimeMs) {
    try {
      await query(
        `INSERT INTO workflow_logs (workflow_id, entity_type, entity_id, status, message, actions_executed, execution_time_ms, created_at)
         VALUES (?, 'candidate', ?, ?, ?, ?, ?, NOW())`,
        [workflowId, entityData.id, status, message, actionsExecuted, executionTimeMs]
      );
    } catch (err) {
      console.error('[WorkflowEngine] _log failed:', err);
    }
  }
}

export default new WorkflowEngine();
