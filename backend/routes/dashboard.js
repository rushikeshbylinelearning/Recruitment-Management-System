import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard metrics
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    // Get total jobs
    const totalJobsResult = await query('SELECT COUNT(*) as count FROM job_postings WHERE status = "Active"');
    const totalJobs = totalJobsResult[0].count;

    // Get active candidates (all candidates regardless of stage)
    const activeCandidatesResult = await query('SELECT COUNT(*) as count FROM candidates');
    const activeCandidates = activeCandidatesResult[0].count;

    // Get interviews scheduled (candidates in Interview stage or with interview_date set)
    const interviewsScheduledResult = await query(`
      SELECT COUNT(*) as count FROM candidates 
      WHERE stage = 'Interview' OR interview_date IS NOT NULL
    `);
    const interviewsScheduled = interviewsScheduledResult[0].count;

    // Get time to hire (average days from applied_date to hired date for hired candidates)
    const timeToHireResult = await query(`
      SELECT AVG(DATEDIFF(updated_at, applied_date)) as avg_days 
      FROM candidates 
      WHERE stage = 'Hired' AND updated_at IS NOT NULL
    `);
    const avgTimeToHire = timeToHireResult[0].avg_days ? Math.round(timeToHireResult[0].avg_days) : 0;

    // Calculate percentage changes (mock for now - in real app, you'd compare with previous period)
    const metrics = {
      totalJobs: {
        value: totalJobs,
        change: 5, // Mock percentage change
        trend: 'up'
      },
      activeCandidates: {
        value: activeCandidates,
        change: 12, // Mock percentage change
        trend: 'up'
      },
      interviewsScheduled: {
        value: interviewsScheduled,
        change: 8, // Mock percentage change
        trend: 'up'
      },
      timeToHire: {
        value: avgTimeToHire,
        change: -3, // Mock percentage change (negative is good for time to hire)
        trend: 'down'
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard metrics'
    });
  }
});

// Get hiring pipeline data
router.get('/pipeline', authenticateToken, async (req, res) => {
  try {
    const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    const pipeline = {};

    for (const stage of stages) {
      const result = await query('SELECT COUNT(*) as count FROM candidates WHERE stage = ?', [stage]);
      pipeline[stage] = result[0].count;
    }

    res.json({
      success: true,
      data: pipeline
    });
  } catch (error) {
    console.error('Error fetching hiring pipeline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hiring pipeline'
    });
  }
});

// Get recent activities
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const activities = [];

    // Get recent candidate updates
    const candidateUpdates = await query(`
      SELECT 
        c.id,
        c.name,
        c.position,
        c.stage,
        c.updated_at,
        'candidate_update' as type,
        CONCAT('Candidate moved to ', c.stage, ' stage') as description
      FROM candidates c
      WHERE c.updated_at IS NOT NULL
      ORDER BY c.updated_at DESC
      LIMIT 10
    `);

    // Get recent task updates
    const taskUpdates = await query(`
      SELECT 
        t.id,
        t.title,
        t.status,
        t.updated_at,
        'task_update' as type,
        CONCAT('Task "', t.title, '" updated to ', t.status) as description,
        u.name as user_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.updated_at IS NOT NULL
      ORDER BY t.updated_at DESC
      LIMIT 10
    `);

    // Get recent job postings
    const jobPostings = await query(`
      SELECT 
        j.id,
        j.title,
        j.department,
        j.created_at as updated_at,
        'job_posted' as type,
        CONCAT('Job "', j.title, '" posted') as description,
        u.name as user_name
      FROM job_postings j
      LEFT JOIN users u ON j.created_by = u.id
      WHERE j.status = 'Active'
      ORDER BY j.created_at DESC
      LIMIT 5
    `);

    // Get recent candidate applications
    const newApplications = await query(`
      SELECT 
        c.id,
        c.name,
        c.position,
        c.applied_date as updated_at,
        'new_application' as type,
        CONCAT('New application from ', c.name, ' for ', c.position) as description
      FROM candidates c
      WHERE c.applied_date IS NOT NULL
      ORDER BY c.applied_date DESC
      LIMIT 10
    `);

    // Combine all activities
    const allActivities = [
      ...candidateUpdates.map(activity => ({ ...activity, user_name: null })),
      ...taskUpdates,
      ...jobPostings,
      ...newApplications
    ];

    // Sort by updated_at and take the most recent 15
    allActivities.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const recentActivities = allActivities.slice(0, 15);

    // Format activities for frontend
    const formattedActivities = recentActivities.map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      timestamp: activity.updated_at,
      user: activity.user_name || null,
      candidate_name: activity.name || null,
      position: activity.position || null
    }));

    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities'
    });
  }
});

// Get dashboard overview (all data in one call)
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    // Get metrics
    const totalJobsResult = await query('SELECT COUNT(*) as count FROM job_postings WHERE status = "Active"');
    const activeCandidatesResult = await query('SELECT COUNT(*) as count FROM candidates');
    const interviewsScheduledResult = await query(`
      SELECT COUNT(*) as count FROM candidates 
      WHERE stage = 'Interview' OR interview_date IS NOT NULL
    `);
    const timeToHireResult = await query(`
      SELECT AVG(DATEDIFF(updated_at, applied_date)) as avg_days 
      FROM candidates 
      WHERE stage = 'Hired' AND updated_at IS NOT NULL
    `);

    // Get pipeline data
    const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    const pipeline = {};
    for (const stage of stages) {
      const result = await query('SELECT COUNT(*) as count FROM candidates WHERE stage = ?', [stage]);
      pipeline[stage] = result[0].count;
    }

    // Get recent activities (limit to 10 for overview)
    const candidateUpdates = await query(`
      SELECT 
        c.id,
        c.name,
        c.position,
        c.stage,
        c.updated_at,
        'candidate_update' as type,
        CONCAT('Candidate moved to ', c.stage, ' stage') as description
      FROM candidates c
      WHERE c.updated_at IS NOT NULL
      ORDER BY c.updated_at DESC
      LIMIT 5
    `);

    const taskUpdates = await query(`
      SELECT 
        t.id,
        t.title,
        t.status,
        t.updated_at,
        'task_update' as type,
        CONCAT('Task "', t.title, '" updated to ', t.status) as description,
        u.name as user_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.updated_at IS NOT NULL
      ORDER BY t.updated_at DESC
      LIMIT 5
    `);

    const newApplications = await query(`
      SELECT 
        c.id,
        c.name,
        c.position,
        c.applied_date as updated_at,
        'new_application' as type,
        CONCAT('New application from ', c.name, ' for ', c.position) as description
      FROM candidates c
      WHERE c.applied_date IS NOT NULL
      ORDER BY c.applied_date DESC
      LIMIT 5
    `);

    const jobPostings = await query(`
      SELECT 
        j.id,
        j.title,
        j.department,
        j.created_at as updated_at,
        'job_posted' as type,
        CONCAT('Job "', j.title, '" posted') as description,
        u.name as user_name
      FROM job_postings j
      LEFT JOIN users u ON j.created_by = u.id
      WHERE j.status = 'Active'
      ORDER BY j.created_at DESC
      LIMIT 5
    `);

    // Combine and format activities
    const allActivities = [
      ...candidateUpdates.map(activity => ({ ...activity, user_name: null })),
      ...taskUpdates,
      ...jobPostings,
      ...newApplications
    ];

    allActivities.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const recentActivities = allActivities.slice(0, 10).map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      timestamp: activity.updated_at,
      user: activity.user_name || null,
      candidate_name: activity.name || null,
      position: activity.position || null
    }));

    const overview = {
      metrics: {
        totalJobs: {
          value: totalJobsResult[0].count,
          change: 5,
          trend: 'up'
        },
        activeCandidates: {
          value: activeCandidatesResult[0].count,
          change: 12,
          trend: 'up'
        },
        interviewsScheduled: {
          value: interviewsScheduledResult[0].count,
          change: 8,
          trend: 'up'
        },
        timeToHire: {
          value: timeToHireResult[0].avg_days ? Math.round(timeToHireResult[0].avg_days) : 0,
          change: -3,
          trend: 'down'
        }
      },
      pipeline,
      activities: recentActivities
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview'
    });
  }
});

export default router;
