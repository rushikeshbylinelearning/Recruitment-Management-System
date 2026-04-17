/**
 * Activity Logs API Routes
 * Access activity history for entities
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import activityLogger from '../services/activityLogger.js';

const router = express.Router();

// Get activities for a specific entity
router.get('/:entityType/:entityId', authenticateToken, asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const result = await activityLogger.getActivities({
    entityType,
    entityId: parseInt(entityId),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
      error: result.error
    });
  }

  res.json({
    success: true,
    data: { activities: result.data }
  });
}));

// Get recent activities across all entities
router.get('/recent', authenticateToken, asyncHandler(async (req, res) => {
  const { limit = 20, actionTypes } = req.query;

  const actionTypesArray = actionTypes ? actionTypes.split(',') : null;

  const result = await activityLogger.getRecentActivities({
    limit: parseInt(limit),
    actionTypes: actionTypesArray
  });

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: result.error
    });
  }

  res.json({
    success: true,
    data: { activities: result.data }
  });
}));

// Get activity statistics
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const { entityType, entityId, startDate, endDate } = req.query;

  const result = await activityLogger.getStatistics({
    entityType,
    entityId: entityId ? parseInt(entityId) : null,
    startDate,
    endDate
  });

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: result.error
    });
  }

  res.json({
    success: true,
    data: { statistics: result.data }
  });
}));

export default router;
