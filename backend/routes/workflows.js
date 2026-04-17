/**
 * Workflow Engine API Routes - Phase 3
 * CRUD for workflows, triggers, conditions, actions + execution logs
 */

import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';

const router = express.Router();

// ─── List all workflows ───────────────────────────────────────────────────────
router.get('/', authenticateToken, checkPermission('settings', 'view'), asyncHandler(async (req, res) => {
  const workflows = await query(
    `SELECT w.*, u.name as created_by_name,
       (SELECT COUNT(*) FROM workflow_actions WHERE workflow_id = w.id) as action_count,
       (SELECT COUNT(*) FROM workflow_conditions WHERE workflow_id = w.id) as condition_count,
       (SELECT COUNT(*) FROM workflow_logs WHERE workflow_id = w.id) as execution_count,
       (SELECT MAX(created_at) FROM workflow_logs WHERE workflow_id = w.id) as last_executed
     FROM workflows w
     LEFT JOIN users u ON u.id = w.created_by
     ORDER BY w.created_at DESC`
  );
  res.json({ success: true, data: { workflows } });
}));

// ─── Get single workflow with full detail ─────────────────────────────────────
router.get('/:id', authenticateToken, checkPermission('settings', 'view'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [workflow] = await query(
    `SELECT w.*, u.name as created_by_name FROM workflows w
     LEFT JOIN users u ON u.id = w.created_by WHERE w.id = ?`, [id]
  );
  if (!workflow) throw new NotFoundError('Workflow not found');

  const [triggers, conditions, actions] = await Promise.all([
    query('SELECT * FROM workflow_triggers WHERE workflow_id = ?', [id]),
    query('SELECT * FROM workflow_conditions WHERE workflow_id = ? ORDER BY condition_order ASC', [id]),
    query('SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY execution_order ASC', [id]),
  ]);

  // Parse JSON fields
  triggers.forEach(t => { try { t.config = JSON.parse(t.config || '{}'); } catch { t.config = {}; } });
  actions.forEach(a => { try { a.config = JSON.parse(a.config || '{}'); } catch { a.config = {}; } });

  res.json({ success: true, data: { workflow: { ...workflow, triggers, conditions, actions } } });
}));

// ─── Create workflow ──────────────────────────────────────────────────────────
router.post('/', authenticateToken, checkPermission('settings', 'edit'), asyncHandler(async (req, res) => {
  const { name, description, is_active = true, trigger, conditions = [], actions = [] } = req.body;
  const userId = req.user.id;

  if (!name || !trigger) {
    return res.status(400).json({ success: false, message: 'name and trigger are required' });
  }

  const workflowId = await transaction(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO workflows (name, description, is_active, created_by, created_at) VALUES (?, ?, ?, ?, NOW())`,
      [name, description || null, is_active, userId]
    );
    const wid = r.insertId;

    // Insert trigger
    await conn.execute(
      `INSERT INTO workflow_triggers (workflow_id, entity_type, event_type, config) VALUES (?, ?, ?, ?)`,
      [wid, trigger.entity_type, trigger.event_type, JSON.stringify(trigger.config || {})]
    );

    // Insert conditions
    for (let i = 0; i < conditions.length; i++) {
      const c = conditions[i];
      await conn.execute(
        `INSERT INTO workflow_conditions (workflow_id, field, operator, value, logic_group, condition_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [wid, c.field, c.operator, c.value, c.logic_group || 'AND', i]
      );
    }

    // Insert actions
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      await conn.execute(
        `INSERT INTO workflow_actions (workflow_id, action_type, config, execution_order, is_active) VALUES (?, ?, ?, ?, ?)`,
        [wid, a.action_type, JSON.stringify(a.config || {}), a.execution_order ?? i, a.is_active !== false]
      );
    }

    return wid;
  });

  res.status(201).json({ success: true, message: 'Workflow created', data: { workflowId } });
}));

// ─── Update workflow ──────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, checkPermission('settings', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, is_active, trigger, conditions, actions } = req.body;

  const [existing] = await query('SELECT id FROM workflows WHERE id = ?', [id]);
  if (!existing) throw new NotFoundError('Workflow not found');

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE workflows SET name = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?`,
      [name, description || null, is_active !== false, id]
    );

    if (trigger) {
      await conn.execute('DELETE FROM workflow_triggers WHERE workflow_id = ?', [id]);
      await conn.execute(
        `INSERT INTO workflow_triggers (workflow_id, entity_type, event_type, config) VALUES (?, ?, ?, ?)`,
        [id, trigger.entity_type, trigger.event_type, JSON.stringify(trigger.config || {})]
      );
    }

    if (conditions !== undefined) {
      await conn.execute('DELETE FROM workflow_conditions WHERE workflow_id = ?', [id]);
      for (let i = 0; i < conditions.length; i++) {
        const c = conditions[i];
        await conn.execute(
          `INSERT INTO workflow_conditions (workflow_id, field, operator, value, logic_group, condition_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, c.field, c.operator, c.value, c.logic_group || 'AND', i]
        );
      }
    }

    if (actions !== undefined) {
      await conn.execute('DELETE FROM workflow_actions WHERE workflow_id = ?', [id]);
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        await conn.execute(
          `INSERT INTO workflow_actions (workflow_id, action_type, config, execution_order, is_active) VALUES (?, ?, ?, ?, ?)`,
          [id, a.action_type, JSON.stringify(a.config || {}), a.execution_order ?? i, a.is_active !== false]
        );
      }
    }
  });

  res.json({ success: true, message: 'Workflow updated' });
}));

// ─── Toggle active ────────────────────────────────────────────────────────────
router.patch('/:id/toggle', authenticateToken, checkPermission('settings', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [w] = await query('SELECT is_active FROM workflows WHERE id = ?', [id]);
  if (!w) throw new NotFoundError('Workflow not found');

  const newStatus = !w.is_active;
  await query('UPDATE workflows SET is_active = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
  res.json({ success: true, data: { is_active: newStatus } });
}));

// ─── Delete workflow ──────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, checkPermission('settings', 'delete'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [w] = await query('SELECT id FROM workflows WHERE id = ?', [id]);
  if (!w) throw new NotFoundError('Workflow not found');

  await query('DELETE FROM workflows WHERE id = ?', [id]);
  res.json({ success: true, message: 'Workflow deleted' });
}));

// ─── Execution logs ───────────────────────────────────────────────────────────
router.get('/:id/logs', authenticateToken, checkPermission('settings', 'view'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const logs = await query(
    `SELECT wl.*, c.name as candidate_name
     FROM workflow_logs wl
     LEFT JOIN candidates c ON wl.entity_type = 'candidate' AND wl.entity_id = c.id
     WHERE wl.workflow_id = ?
     ORDER BY wl.created_at DESC
     LIMIT ? OFFSET ?`,
    [id, parseInt(limit), parseInt(offset)]
  );

  res.json({ success: true, data: { logs } });
}));

// ─── Test / manual trigger ────────────────────────────────────────────────────
router.post('/:id/test', authenticateToken, checkPermission('settings', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { candidate_id } = req.body;

  if (!candidate_id) {
    return res.status(400).json({ success: false, message: 'candidate_id is required for test' });
  }

  const [workflow] = await query('SELECT * FROM workflows WHERE id = ?', [id]);
  if (!workflow) throw new NotFoundError('Workflow not found');

  const [candidate] = await query(
    `SELECT c.*, j.title as job_title, u.name as assigned_to_name
     FROM candidates c
     LEFT JOIN job_postings j ON j.id = c.job_id
     LEFT JOIN users u ON u.id = c.assigned_to
     WHERE c.id = ?`,
    [candidate_id]
  );
  if (!candidate) throw new NotFoundError('Candidate not found');

  const workflowEngine = (await import('../services/workflowEngine.js')).default;

  // Force-run this specific workflow (bypass trigger matching)
  setImmediate(async () => {
    try {
      await workflowEngine._executeWorkflow(workflow, candidate, req.user.id);
    } catch (err) {
      console.error('[Workflow Test] Error:', err);
    }
  });

  res.json({ success: true, message: 'Workflow test triggered asynchronously' });
}));

export default router;
