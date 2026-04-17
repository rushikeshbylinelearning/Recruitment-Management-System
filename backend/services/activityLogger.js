/**
 * Activity Logger Service
 * Centralized logging for all system activities
 */

import { query } from '../config/database.js';

class ActivityLogger {
  /**
   * Log a stage change
   */
  async logStageChange({ candidateId, previousStage, newStage, userId, candidateName }) {
    try {
      const description = `Stage changed from ${previousStage || 'None'} to ${newStage}`;
      
      await this.log({
        entityType: 'candidate',
        entityId: candidateId,
        actionType: 'stage_change',
        description,
        metadata: {
          previousStage,
          newStage,
          candidateName,
          timestamp: new Date().toISOString()
        },
        createdBy: userId
      });

      return { success: true };
    } catch (error) {
      console.error('[ActivityLogger] Failed to log stage change:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log a generic activity
   */
  async log({ entityType, entityId, actionType, description, metadata, createdBy }) {
    try {
      await query(
        `INSERT INTO activity_logs (entity_type, entity_id, action_type, description, metadata, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          entityType,
          entityId,
          actionType,
          description,
          JSON.stringify(metadata || {}),
          createdBy || null
        ]
      );

      return { success: true };
    } catch (error) {
      console.error('[ActivityLogger] Failed to log activity:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get activities for an entity
   */
  async getActivities({ entityType, entityId, limit = 50, offset = 0 }) {
    try {
      const activities = await query(
        `SELECT al.*, u.name as user_name, u.role as user_role
         FROM activity_logs al
         LEFT JOIN users u ON al.created_by = u.id
         WHERE al.entity_type = ? AND al.entity_id = ?
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`,
        [entityType, entityId, limit, offset]
      );

      // Parse metadata JSON
      activities.forEach(activity => {
        try {
          activity.metadata = JSON.parse(activity.metadata || '{}');
        } catch (e) {
          activity.metadata = {};
        }
      });

      return { success: true, data: activities };
    } catch (error) {
      console.error('[ActivityLogger] Failed to get activities:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recent activities across all entities
   */
  async getRecentActivities({ limit = 20, actionTypes = null }) {
    try {
      let sql = `
        SELECT al.*, u.name as user_name, u.role as user_role
        FROM activity_logs al
        LEFT JOIN users u ON al.created_by = u.id
      `;
      
      const params = [];
      
      if (actionTypes && actionTypes.length > 0) {
        sql += ` WHERE al.action_type IN (${actionTypes.map(() => '?').join(',')})`;
        params.push(...actionTypes);
      }
      
      sql += ` ORDER BY al.created_at DESC LIMIT ?`;
      params.push(limit);

      const activities = await query(sql, params);

      // Parse metadata JSON
      activities.forEach(activity => {
        try {
          activity.metadata = JSON.parse(activity.metadata || '{}');
        } catch (e) {
          activity.metadata = {};
        }
      });

      return { success: true, data: activities };
    } catch (error) {
      console.error('[ActivityLogger] Failed to get recent activities:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get activity statistics
   */
  async getStatistics({ entityType, entityId, startDate, endDate }) {
    try {
      let sql = `
        SELECT 
          action_type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM activity_logs
        WHERE 1=1
      `;
      
      const params = [];
      
      if (entityType) {
        sql += ` AND entity_type = ?`;
        params.push(entityType);
      }
      
      if (entityId) {
        sql += ` AND entity_id = ?`;
        params.push(entityId);
      }
      
      if (startDate) {
        sql += ` AND created_at >= ?`;
        params.push(startDate);
      }
      
      if (endDate) {
        sql += ` AND created_at <= ?`;
        params.push(endDate);
      }
      
      sql += ` GROUP BY action_type, DATE(created_at) ORDER BY created_at DESC`;

      const stats = await query(sql, params);

      return { success: true, data: stats };
    } catch (error) {
      console.error('[ActivityLogger] Failed to get statistics:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new ActivityLogger();
