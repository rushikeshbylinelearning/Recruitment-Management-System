/**
 * Pipeline Automations API Routes
 * Manage automation rules and actions
 */

import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all automations
router.get('/', authenticateToken, checkPermission('settings', 'view'), asyncHandler(async (req, res) => {
  const automations = await query(
    `SELECT pa.*, 
      u.name as created_by_name,
      (SELECT COUNT(*) FROM automation_actions WHERE automation_id = pa.id) as action_count
     FROM pipeline_automations pa
     LEFT JOIN users u ON pa.created_by = u.id
     ORDER BY pa.priority DESC, pa.created_at DESC`
  );

  res.json({
    success: true,
    data: { automations }
  });
}));

// Get automation by ID with actions
router.get('/:id', authenticateToken, checkPermission('settings', 'view'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [automation] = await query(
    `SELECT pa.*, u.name as created_by_name
     FROM pipeline_automations pa
     LEFT JOIN users u ON pa.created_by = u.id
     WHERE pa.id = ?`,
    [id]
  );

  if (!automation) {
    return res.status(404).json({
      success: false,
      message: 'Automation not found'
    });
  }

  // Get actions
  const actions = await query(
    `SELECT * FROM automation_actions
     WHERE automation_id = ?
     ORDER BY action_order ASC`,
    [id]
  );

  // Parse config JSON
  actions.forEach(action => {
    try {
      action.config = JSON.parse(action.config || '{}');
    } catch (e) {
      action.config = {};
    }
  });

  automation.actions = actions;

  res.json({
    success: true,
    data: { automation }
  });
}));

// Create new automation
router.post('/', authenticateToken, checkPermission('settings', 'edit'), asyncHandler(async (req, res) => {
  const { name, description, trigger_stage, trigger_event, is_active, priority, actions } = req.body;
  const userId = req.user.id;

  // Validate required fields
  if (!name || !trigger_stage || !trigger_event) {
    return res.status(400).json({
      success: false,
      message: 'Name, trigger_stage, and trigger_event are required'
    });
  }

  // Create automation and actions in transaction
  const result = await transaction(async (connection) => {
    // Insert automation
    const [automationResult] = await connection.execute(
      `INSERT INTO pipeline_automations (name, description, trigger_stage, trigger_event, is_active, priority, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [name, description || null, trigger_stage, trigger_event, is_active !== false, priority || 0, userId]
    );

    const automationId = automationResult.insertId;

    // Insert actions if provided
    if (actions && actions.length > 0) {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        await connection.execute(
          `INSERT INTO automation_actions (automation_id, action_type, action_order, config, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            automationId,
            action.action_type,
            action.action_order || i,
            JSON.stringify(action.config || {}),
            action.is_active !== false
          ]
        );
      }
    }

    return automationId;
  });

  res.status(201).json({
    success: true,
    message: 'Automation created successfully',
    data: { automationId: result }
  });
}));

// Update automation
router.put('/:id', authenticateToken, checkPermission('settings', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, trigger_stage, trigger_event, is_active, priority, actions } = req.body;

  // Check if automation exists
  const [existing] = await query('SELECT id FROM pipeline_automations WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({
      success: false,
      message: 'Automation not found'
    });
  }

  // Update automation and actions in transaction
  await transaction(async (connection) => {
    // Update automation
    await connection.execute(
      `UPDATE pipeline_automations 
       SET name = ?, description = ?, trigger_stage = ?, trigger_event = ?, is_active = ?, priority = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, description || null, trigger_stage, trigger_event, is_active !== false, priority || 0, id]
    );

    // If actions provided, replace them
    if (actions) {
      // Delete existing actions
      await connection.execute('DELETE FROM automation_actions WHERE automation_id = ?', [id]);

      // Insert new actions
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        await connection.execute(
          `INSERT INTO automation_actions (automation_id, action_type, action_order, config, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            id,
            action.action_type,
            action.action_order || i,
            JSON.stringify(action.config || {}),
            action.is_active !== false
          ]
        );
      }
    }
  });

  res.json({
    success: true,
    message: 'Automation updated successfully'
  });
}));

// Toggle automation active status
router.patch('/:id/toggle', authenticateToken, checkPermission('settings', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [automation] = await query('SELECT is_active FROM pipeline_automations WHERE id = ?', [id]);
  
  if (!automation) {
    return res.status(404).json({
      success: false,
      message: 'Automation not found'
    });
  }

  const newStatus = !automation.is_active;

  await query(
    'UPDATE pipeline_automations SET is_active = ?, updated_at = NOW() WHERE id = ?',
    [newStatus, id]
  );

  res.json({
    success: true,
    message: `Automation ${newStatus ? 'enabled' : 'disabled'} successfully`,
    data: { is_active: newStatus }
  });
}));

// Delete automation
router.delete('/:id', authenticateToken, checkPermission('settings', 'delete'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [automation] = await query('SELECT id FROM pipeline_automations WHERE id = ?', [id]);
  
  if (!automation) {
    return res.status(404).json({
      success: false,
      message: 'Automation not found'
    });
  }

  // Delete automation (actions will be deleted by CASCADE)
  await query('DELETE FROM pipeline_automations WHERE id = ?', [id]);

  res.json({
    success: true,
    message: 'Automation deleted successfully'
  });
}));

// Get automation execution logs
router.get('/:id/logs', authenticateToken, checkPermission('settings', 'view'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const logs = await query(
    `SELECT ael.*, c.name as candidate_name
     FROM automation_execution_log ael
     LEFT JOIN candidates c ON ael.entity_type = 'candidate' AND ael.entity_id = c.id
     WHERE ael.automation_id = ?
     ORDER BY ael.executed_at DESC
     LIMIT ? OFFSET ?`,
    [id, parseInt(limit), parseInt(offset)]
  );

  // Parse metadata
  logs.forEach(log => {
    try {
      log.metadata = JSON.parse(log.metadata || '{}');
    } catch (e) {
      log.metadata = {};
    }
  });

  res.json({
    success: true,
    data: { logs }
  });
}));

// Get automation statistics
router.get('/:id/stats', authenticateToken, checkPermission('settings', 'view'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [stats] = await query(
    `SELECT 
      COUNT(*) as total_executions,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(execution_time_ms) as avg_execution_time,
      MAX(executed_at) as last_executed
     FROM automation_execution_log
     WHERE automation_id = ?`,
    [id]
  );

  res.json({
    success: true,
    data: { stats }
  });
}));

export default router;
