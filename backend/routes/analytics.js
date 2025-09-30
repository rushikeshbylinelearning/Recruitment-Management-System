import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get overall statistics with real-time calculations
  const stats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM job_postings) as total_jobs,
       (SELECT COUNT(*) FROM job_postings WHERE status = 'Active') as active_jobs,
       (SELECT COUNT(*) FROM candidates) as total_candidates,
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Hired') as hired,
       (SELECT COUNT(*) FROM interviews WHERE status = 'Completed') as interviews_completed,
       (SELECT AVG(DATEDIFF(updated_at, applied_date)) FROM candidates WHERE stage = 'Hired') as avg_time_to_hire,
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Rejected') as rejected,
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Interview') as in_interview,
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Offer') as with_offer,
       (SELECT COUNT(*) FROM candidates WHERE applied_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as applications_last_30_days,
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Hired' AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as hires_last_30_days`,
    []
  );

  // Get source effectiveness with percentages
  const sourceStats = await query(
    `SELECT 
       source, 
       COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM candidates), 2) as percentage
     FROM candidates 
     GROUP BY source 
     ORDER BY count DESC 
     LIMIT 10`,
    []
  );

  // Get monthly hires (last 12 months) with applications
  const monthlyHires = await query(
    `SELECT 
       DATE_FORMAT(updated_at, '%Y-%m') as month,
       COUNT(*) as hires,
       (SELECT COUNT(*) FROM candidates WHERE DATE_FORMAT(applied_date, '%Y-%m') = DATE_FORMAT(c.updated_at, '%Y-%m')) as applications,
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Rejected' AND DATE_FORMAT(updated_at, '%Y-%m') = DATE_FORMAT(c.updated_at, '%Y-%m')) as rejections
     FROM candidates c
     WHERE stage = 'Hired' AND updated_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(updated_at, '%Y-%m')
     ORDER BY month DESC`,
    []
  );

  // Get stage distribution with percentages
  const stageDistribution = await query(
    `SELECT 
       stage, 
       COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM candidates), 2) as percentage
     FROM candidates 
     GROUP BY stage 
     ORDER BY 
       CASE stage
         WHEN 'Applied' THEN 1
         WHEN 'Screening' THEN 2
         WHEN 'Interview' THEN 3
         WHEN 'Offer' THEN 4
         WHEN 'Hired' THEN 5
         WHEN 'Rejected' THEN 6
       END`,
    []
  );

  // Get department distribution with live data
  const departmentStats = await query(
    `SELECT 
       jp.department, 
       COUNT(DISTINCT jp.id) as job_count,
       COUNT(DISTINCT c.id) as candidate_count,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hired_count,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / COUNT(c.id), 2) as hire_rate
     FROM job_postings jp
     LEFT JOIN candidates c ON jp.title = c.position
     GROUP BY jp.department
     ORDER BY job_count DESC`,
    []
  );

  // Get recent activity trends (last 7 days)
  const recentTrends = await query(
    `SELECT 
       DATE(updated_at) as date,
       COUNT(*) as daily_updates
     FROM candidates 
     WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(updated_at)
     ORDER BY date DESC`,
    []
  );

  // Get conversion rates by source
  const sourceConversion = await query(
    `SELECT 
       source,
       COUNT(*) as total_applications,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       ROUND(COUNT(CASE WHEN stage = 'Hired' THEN 1 END) * 100.0 / COUNT(*), 2) as conversion_rate
     FROM candidates 
     GROUP BY source
     HAVING total_applications >= 5
     ORDER BY conversion_rate DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      overview: stats[0],
      sourceEffectiveness: sourceStats,
      monthlyHires,
      stageDistribution,
      departmentStats,
      recentTrends,
      sourceConversion
    }
  });
}));

// Get hiring funnel analytics
router.get('/hiring-funnel', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get detailed funnel data with time spent in each stage
  const funnelData = await query(
    `SELECT 
       stage,
       COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM candidates), 2) as percentage,
       AVG(CASE 
         WHEN stage = 'Applied' THEN DATEDIFF(COALESCE(updated_at, NOW()), applied_date)
         WHEN stage = 'Screening' THEN DATEDIFF(COALESCE(updated_at, NOW()), applied_date)
         WHEN stage = 'Interview' THEN DATEDIFF(COALESCE(updated_at, NOW()), applied_date)
         WHEN stage = 'Offer' THEN DATEDIFF(COALESCE(updated_at, NOW()), applied_date)
         WHEN stage = 'Hired' THEN DATEDIFF(updated_at, applied_date)
         WHEN stage = 'Rejected' THEN DATEDIFF(updated_at, applied_date)
       END) as avg_days_in_stage
     FROM candidates 
     GROUP BY stage 
     ORDER BY 
       CASE stage
         WHEN 'Applied' THEN 1
         WHEN 'Screening' THEN 2
         WHEN 'Interview' THEN 3
         WHEN 'Offer' THEN 4
         WHEN 'Hired' THEN 5
         WHEN 'Rejected' THEN 6
       END`,
    []
  );

  // Calculate detailed conversion rates with actual numbers
  const conversionRates = await query(
    `SELECT 
       'Applied to Screening' as stage, 
       (SELECT COUNT(*) FROM candidates WHERE stage IN ('Screening', 'Interview', 'Offer', 'Hired')) as converted,
       (SELECT COUNT(*) FROM candidates WHERE stage != 'Rejected') as total,
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage IN ('Screening', 'Interview', 'Offer', 'Hired')) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage != 'Rejected'), 2) as rate
     UNION ALL
     SELECT 
       'Screening to Interview' as stage, 
       (SELECT COUNT(*) FROM candidates WHERE stage IN ('Interview', 'Offer', 'Hired')) as converted,
       (SELECT COUNT(*) FROM candidates WHERE stage IN ('Screening', 'Interview', 'Offer', 'Hired')) as total,
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage IN ('Interview', 'Offer', 'Hired')) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage IN ('Screening', 'Interview', 'Offer', 'Hired')), 2) as rate
     UNION ALL
     SELECT 
       'Interview to Offer' as stage, 
       (SELECT COUNT(*) FROM candidates WHERE stage IN ('Offer', 'Hired')) as converted,
       (SELECT COUNT(*) FROM candidates WHERE stage IN ('Interview', 'Offer', 'Hired')) as total,
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage IN ('Offer', 'Hired')) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage IN ('Interview', 'Offer', 'Hired')), 2) as rate
     UNION ALL
     SELECT 
       'Offer to Hired' as stage, 
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Hired') as converted,
       (SELECT COUNT(*) FROM candidates WHERE stage IN ('Offer', 'Hired')) as total,
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage = 'Hired') * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage IN ('Offer', 'Hired')), 2) as rate`,
    []
  );

  // Get funnel performance by time period
  const funnelTrends = await query(
    `SELECT 
       DATE_FORMAT(applied_date, '%Y-%m') as month,
       COUNT(*) as applications,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       COUNT(CASE WHEN stage = 'Rejected' THEN 1 END) as rejections,
       ROUND(COUNT(CASE WHEN stage = 'Hired' THEN 1 END) * 100.0 / COUNT(*), 2) as hire_rate
     FROM candidates 
     WHERE applied_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(applied_date, '%Y-%m')
     ORDER BY month DESC`,
    []
  );

  // Get stage transition times
  const stageTransitions = await query(
    `SELECT 
       'Applied to Screening' as transition,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_days
     FROM candidates 
     WHERE stage IN ('Screening', 'Interview', 'Offer', 'Hired')
     UNION ALL
     SELECT 
       'Screening to Interview' as transition,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_days
     FROM candidates 
     WHERE stage IN ('Interview', 'Offer', 'Hired')
     UNION ALL
     SELECT 
       'Interview to Offer' as transition,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_days
     FROM candidates 
     WHERE stage IN ('Offer', 'Hired')
     UNION ALL
     SELECT 
       'Offer to Hired' as transition,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_days
     FROM candidates 
     WHERE stage = 'Hired'`,
    []
  );

  res.json({
    success: true,
    data: {
      funnelData,
      conversionRates,
      funnelTrends,
      stageTransitions
    }
  });
}));

// Get time-to-hire analytics
router.get('/time-to-hire', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get comprehensive time-to-hire statistics
  const timeToHireStats = await query(
    `SELECT 
       AVG(DATEDIFF(updated_at, applied_date)) as avg_time_to_hire,
       MIN(DATEDIFF(updated_at, applied_date)) as min_time_to_hire,
       MAX(DATEDIFF(updated_at, applied_date)) as max_time_to_hire,
       STDDEV(DATEDIFF(updated_at, applied_date)) as std_dev_time_to_hire,
       COUNT(*) as total_hires
     FROM candidates 
     WHERE stage = 'Hired'`,
    []
  );

  // Get time-to-hire by department with additional metrics
  const timeByDepartment = await query(
    `SELECT 
       jp.department,
       AVG(DATEDIFF(c.updated_at, c.applied_date)) as avg_time_to_hire,
       MIN(DATEDIFF(c.updated_at, c.applied_date)) as min_time_to_hire,
       MAX(DATEDIFF(c.updated_at, c.applied_date)) as max_time_to_hire,
       COUNT(*) as hires_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage = 'Hired'), 2) as percentage_of_hires
     FROM candidates c
     JOIN job_postings jp ON c.position = jp.title
     WHERE c.stage = 'Hired'
     GROUP BY jp.department
     ORDER BY avg_time_to_hire ASC`,
    []
  );

  // Get time-to-hire by source with additional metrics
  const timeBySource = await query(
    `SELECT 
       source,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_time_to_hire,
       MIN(DATEDIFF(updated_at, applied_date)) as min_time_to_hire,
       MAX(DATEDIFF(updated_at, applied_date)) as max_time_to_hire,
       COUNT(*) as hires_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage = 'Hired'), 2) as percentage_of_hires
     FROM candidates 
     WHERE stage = 'Hired'
     GROUP BY source
     ORDER BY avg_time_to_hire ASC`,
    []
  );

  // Get time-to-hire trends over time
  const timeTrends = await query(
    `SELECT 
       DATE_FORMAT(updated_at, '%Y-%m') as month,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_time_to_hire,
       COUNT(*) as hires_count
     FROM candidates 
     WHERE stage = 'Hired' AND updated_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(updated_at, '%Y-%m')
     ORDER BY month DESC`,
    []
  );

  // Get time-to-hire by position level
  const timeByPosition = await query(
    `SELECT 
       c.position,
       AVG(DATEDIFF(c.updated_at, c.applied_date)) as avg_time_to_hire,
       COUNT(*) as hires_count
     FROM candidates c
     WHERE c.stage = 'Hired'
     GROUP BY c.position
     HAVING hires_count >= 2
     ORDER BY avg_time_to_hire ASC
     LIMIT 10`,
    []
  );

  // Get hiring velocity (hires per month)
  const hiringVelocity = await query(
    `SELECT 
       DATE_FORMAT(updated_at, '%Y-%m') as month,
       COUNT(*) as hires,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_time_to_hire
     FROM candidates 
     WHERE stage = 'Hired' AND updated_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(updated_at, '%Y-%m')
     ORDER BY month DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      overallStats: timeToHireStats[0],
      byDepartment: timeByDepartment,
      bySource: timeBySource,
      timeTrends: timeTrends,
      byPosition: timeByPosition,
      hiringVelocity: hiringVelocity
    }
  });
}));

// Get interviewer performance analytics
router.get('/interviewer-performance', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get comprehensive interviewer statistics
  const interviewerStats = await query(
    `SELECT 
       u.id,
       u.name,
       u.role,
       COUNT(i.id) as total_interviews,
       COUNT(CASE WHEN i.status = 'Completed' THEN 1 END) as completed_interviews,
       COUNT(CASE WHEN i.status = 'Scheduled' THEN 1 END) as scheduled_interviews,
       COUNT(CASE WHEN i.status = 'Cancelled' THEN 1 END) as cancelled_interviews,
       COALESCE(AVG(feedback.overall_rating), 0) as avg_rating,
       COUNT(CASE WHEN feedback.recommendation = 'Selected' THEN 1 END) as selections,
       COUNT(CASE WHEN feedback.recommendation = 'Rejected' THEN 1 END) as rejections,
       ROUND(COUNT(CASE WHEN feedback.recommendation = 'Selected' THEN 1 END) * 100.0 / NULLIF(COUNT(feedback.id), 0), 2) as selection_rate,
       ROUND(COUNT(CASE WHEN i.status = 'Completed' THEN 1 END) * 100.0 / NULLIF(COUNT(i.id), 0), 2) as completion_rate,
       COALESCE(AVG(TIMESTAMPDIFF(HOUR, i.scheduled_date, COALESCE(i.updated_at, NOW()))), 0) as avg_interview_duration_hours
     FROM users u
     LEFT JOIN interviews i ON u.id = i.interviewer_id
     LEFT JOIN interview_feedback feedback ON i.id = feedback.interview_id
     WHERE u.role = 'Interviewer'
     GROUP BY u.id, u.name, u.role
     ORDER BY total_interviews DESC`,
    []
  );

  // Get interviewer performance trends over time
  const interviewerTrends = await query(
    `SELECT 
       u.id,
       u.name,
       DATE_FORMAT(i.scheduled_date, '%Y-%m') as month,
       COUNT(i.id) as interviews_conducted,
       COALESCE(AVG(feedback.overall_rating), 0) as avg_rating,
       COUNT(CASE WHEN feedback.recommendation = 'Selected' THEN 1 END) as selections
     FROM users u
     LEFT JOIN interviews i ON u.id = i.interviewer_id
     LEFT JOIN interview_feedback feedback ON i.id = feedback.interview_id
     WHERE u.role = 'Interviewer' AND i.scheduled_date IS NOT NULL AND i.scheduled_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY u.id, u.name, DATE_FORMAT(i.scheduled_date, '%Y-%m')
     ORDER BY u.name, month DESC`,
    []
  );

  // Get interviewer performance by interview type
  const performanceByType = await query(
    `SELECT 
       u.id,
       u.name,
       COALESCE(i.type, 'Unknown') as interview_type,
       COUNT(i.id) as total_interviews,
       COALESCE(AVG(feedback.overall_rating), 0) as avg_rating,
       COUNT(CASE WHEN feedback.recommendation = 'Selected' THEN 1 END) as selections,
       ROUND(COUNT(CASE WHEN feedback.recommendation = 'Selected' THEN 1 END) * 100.0 / NULLIF(COUNT(i.id), 0), 2) as selection_rate
     FROM users u
     LEFT JOIN interviews i ON u.id = i.interviewer_id
     LEFT JOIN interview_feedback feedback ON i.id = feedback.interview_id
     WHERE u.role = 'Interviewer'
     GROUP BY u.id, u.name, i.type
     ORDER BY u.name, total_interviews DESC`,
    []
  );

  // Get interviewer workload distribution
  const workloadDistribution = await query(
    `SELECT 
       u.id,
       u.name,
       COUNT(i.id) as total_interviews,
       COUNT(CASE WHEN i.scheduled_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as interviews_last_30_days,
       COUNT(CASE WHEN i.scheduled_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as interviews_last_7_days,
       COALESCE(AVG(TIMESTAMPDIFF(DAY, COALESCE(i.created_at, i.scheduled_date), i.scheduled_date)), 0) as avg_scheduling_lead_time
     FROM users u
     LEFT JOIN interviews i ON u.id = i.interviewer_id
     WHERE u.role = 'Interviewer'
     GROUP BY u.id, u.name
     ORDER BY total_interviews DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      interviewerStats,
      interviewerTrends,
      performanceByType,
      workloadDistribution
    }
  });
}));

// Get recruiter performance analytics
router.get('/recruiter-performance', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get comprehensive recruiter statistics
  const recruiterStats = await query(
    `SELECT 
       u.id,
       u.name,
       u.role,
       COUNT(c.id) as candidates_assigned,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires,
       COUNT(CASE WHEN c.stage = 'Rejected' THEN 1 END) as rejections,
       COUNT(CASE WHEN c.stage = 'Interview' THEN 1 END) as in_interview,
       COUNT(CASE WHEN c.stage = 'Offer' THEN 1 END) as with_offer,
       COALESCE(AVG(c.score), 0) as avg_candidate_score,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as hire_rate,
       ROUND(COUNT(CASE WHEN c.stage = 'Rejected' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as rejection_rate,
       COALESCE(AVG(DATEDIFF(COALESCE(c.updated_at, NOW()), c.applied_date)), 0) as avg_processing_time,
       COUNT(CASE WHEN c.applied_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_candidates_last_30_days
     FROM users u
     LEFT JOIN candidates c ON u.id = c.assigned_to
     WHERE u.role IN ('Recruiter', 'HR Manager')
     GROUP BY u.id, u.name, u.role
     ORDER BY hires DESC`,
    []
  );

  // Get recruiter performance trends over time
  const recruiterTrends = await query(
    `SELECT 
       u.id,
       u.name,
       DATE_FORMAT(c.applied_date, '%Y-%m') as month,
       COUNT(c.id) as candidates_processed,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires,
       COALESCE(AVG(c.score), 0) as avg_score,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as hire_rate
     FROM users u
     LEFT JOIN candidates c ON u.id = c.assigned_to
     WHERE u.role IN ('Recruiter', 'HR Manager') AND c.applied_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY u.id, u.name, DATE_FORMAT(c.applied_date, '%Y-%m')
     ORDER BY u.name, month DESC`,
    []
  );

  // Get recruiter performance by source
  const performanceBySource = await query(
    `SELECT 
       u.id,
       u.name,
       c.source,
       COUNT(c.id) as candidates_from_source,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires_from_source,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as source_hire_rate,
       COALESCE(AVG(c.score), 0) as avg_score
     FROM users u
     LEFT JOIN candidates c ON u.id = c.assigned_to
     WHERE u.role IN ('Recruiter', 'HR Manager')
     GROUP BY u.id, u.name, c.source
     ORDER BY u.name, candidates_from_source DESC`,
    []
  );

  // Get recruiter workload and efficiency metrics
  const workloadMetrics = await query(
    `SELECT 
       u.id,
       u.name,
       COUNT(c.id) as total_candidates,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as successful_hires,
       COUNT(CASE WHEN c.stage = 'Rejected' THEN 1 END) as rejections,
       COALESCE(AVG(DATEDIFF(COALESCE(c.updated_at, NOW()), c.applied_date)), 0) as avg_processing_time,
       COUNT(CASE WHEN c.applied_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_this_week,
       COUNT(CASE WHEN c.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as updated_this_week
     FROM users u
     LEFT JOIN candidates c ON u.id = c.assigned_to
     WHERE u.role IN ('Recruiter', 'HR Manager')
     GROUP BY u.id, u.name
     ORDER BY total_candidates DESC`,
    []
  );

  // Get recruiter pipeline health
  const pipelineHealth = await query(
    `SELECT 
       u.id,
       u.name,
       c.stage,
       COUNT(c.id) as count,
       COALESCE(AVG(DATEDIFF(COALESCE(c.updated_at, NOW()), c.applied_date)), 0) as avg_days_in_stage
     FROM users u
     LEFT JOIN candidates c ON u.id = c.assigned_to
     WHERE u.role IN ('Recruiter', 'HR Manager')
     GROUP BY u.id, u.name, c.stage
     ORDER BY u.name, 
       CASE c.stage
         WHEN 'Applied' THEN 1
         WHEN 'Screening' THEN 2
         WHEN 'Interview' THEN 3
         WHEN 'Offer' THEN 4
         WHEN 'Hired' THEN 5
         WHEN 'Rejected' THEN 6
       END`,
    []
  );

  res.json({
    success: true,
    data: {
      recruiterStats,
      recruiterTrends,
      performanceBySource,
      workloadMetrics,
      pipelineHealth
    }
  });
}));

// Get job performance analytics
router.get('/job-performance', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get comprehensive job performance statistics
  const jobStats = await query(
    `SELECT 
       jp.id,
       jp.title,
       jp.department,
       jp.status,
       jp.posted_date,
       jp.deadline,
       COUNT(c.id) as total_applications,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires,
       COUNT(CASE WHEN c.stage = 'Rejected' THEN 1 END) as rejections,
       COUNT(CASE WHEN c.stage = 'Interview' THEN 1 END) as in_interview,
       COUNT(CASE WHEN c.stage = 'Offer' THEN 1 END) as with_offer,
       COALESCE(AVG(c.score), 0) as avg_candidate_score,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as hire_rate,
       ROUND(COUNT(CASE WHEN c.stage = 'Rejected' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as rejection_rate,
       DATEDIFF(COALESCE(MAX(CASE WHEN c.stage = 'Hired' THEN c.updated_at END), NOW()), jp.posted_date) as days_to_fill,
       COUNT(CASE WHEN c.applied_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as applications_last_30_days,
       COALESCE(AVG(DATEDIFF(COALESCE(c.updated_at, NOW()), c.applied_date)), 0) as avg_processing_time
     FROM job_postings jp
     LEFT JOIN candidates c ON jp.title = c.position
     GROUP BY jp.id, jp.title, jp.department, jp.status, jp.posted_date, jp.deadline
     ORDER BY total_applications DESC`,
    []
  );

  // Get job performance trends over time
  const jobTrends = await query(
    `SELECT 
       jp.id,
       jp.title,
       jp.department,
       DATE_FORMAT(c.applied_date, '%Y-%m') as month,
       COUNT(c.id) as applications,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires,
       COALESCE(AVG(c.score), 0) as avg_score,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as hire_rate
     FROM job_postings jp
     LEFT JOIN candidates c ON jp.title = c.position
     WHERE c.applied_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY jp.id, jp.title, jp.department, DATE_FORMAT(c.applied_date, '%Y-%m')
     ORDER BY jp.title, month DESC`,
    []
  );

  // Get job performance by source
  const performanceBySource = await query(
    `SELECT 
       jp.id,
       jp.title,
       c.source,
       COUNT(c.id) as applications_from_source,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires_from_source,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as source_hire_rate,
       COALESCE(AVG(c.score), 0) as avg_score
     FROM job_postings jp
     LEFT JOIN candidates c ON jp.title = c.position
     GROUP BY jp.id, jp.title, c.source
     ORDER BY jp.title, applications_from_source DESC`,
    []
  );

  // Get job pipeline health
  const pipelineHealth = await query(
    `SELECT 
       jp.id,
       jp.title,
       c.stage,
       COUNT(c.id) as count,
       COALESCE(AVG(DATEDIFF(COALESCE(c.updated_at, NOW()), c.applied_date)), 0) as avg_days_in_stage
     FROM job_postings jp
     LEFT JOIN candidates c ON jp.title = c.position
     GROUP BY jp.id, jp.title, c.stage
     ORDER BY jp.title, 
       CASE c.stage
         WHEN 'Applied' THEN 1
         WHEN 'Screening' THEN 2
         WHEN 'Interview' THEN 3
         WHEN 'Offer' THEN 4
         WHEN 'Hired' THEN 5
         WHEN 'Rejected' THEN 6
       END`,
    []
  );

  // Get department performance summary
  const departmentPerformance = await query(
    `SELECT 
       jp.department,
       COUNT(DISTINCT jp.id) as total_jobs,
       COUNT(c.id) as total_applications,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as total_hires,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as department_hire_rate,
       COALESCE(AVG(c.score), 0) as avg_candidate_score,
       COALESCE(AVG(DATEDIFF(COALESCE(c.updated_at, NOW()), c.applied_date)), 0) as avg_processing_time
     FROM job_postings jp
     LEFT JOIN candidates c ON jp.title = c.position
     GROUP BY jp.department
     ORDER BY total_hires DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      jobStats,
      jobTrends,
      performanceBySource,
      pipelineHealth,
      departmentPerformance
    }
  });
}));

// Get monthly trends
router.get('/monthly-trends', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 12;

  // Get comprehensive monthly trends
  const trends = await query(
    `SELECT 
       DATE_FORMAT(applied_date, '%Y-%m') as month,
       COUNT(*) as applications,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       COUNT(CASE WHEN stage = 'Rejected' THEN 1 END) as rejections,
       COUNT(CASE WHEN stage = 'Interview' THEN 1 END) as interviews,
       COUNT(CASE WHEN stage = 'Offer' THEN 1 END) as offers,
       COALESCE(AVG(score), 0) as avg_score,
       ROUND(COUNT(CASE WHEN stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as hire_rate,
       ROUND(COUNT(CASE WHEN stage = 'Rejected' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as rejection_rate,
       COALESCE(AVG(DATEDIFF(COALESCE(updated_at, NOW()), applied_date)), 0) as avg_processing_time
     FROM candidates 
     WHERE applied_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(applied_date, '%Y-%m')
     ORDER BY month DESC`,
    [months]
  );

  // Get monthly trends by source
  const trendsBySource = await query(
    `SELECT 
       source,
       DATE_FORMAT(applied_date, '%Y-%m') as month,
       COUNT(*) as applications,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       ROUND(COUNT(CASE WHEN stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as hire_rate
     FROM candidates 
     WHERE applied_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY source, DATE_FORMAT(applied_date, '%Y-%m')
     ORDER BY source, month DESC`,
    [months]
  );

  // Get monthly trends by department
  const trendsByDepartment = await query(
    `SELECT 
       jp.department,
       DATE_FORMAT(c.applied_date, '%Y-%m') as month,
       COUNT(c.id) as applications,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as hire_rate
     FROM candidates c
     LEFT JOIN job_postings jp ON c.position = jp.title
     WHERE c.applied_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY jp.department, DATE_FORMAT(c.applied_date, '%Y-%m')
     ORDER BY jp.department, month DESC`,
    [months]
  );

  // Get application velocity trends
  const velocityTrends = await query(
    `SELECT 
       DATE_FORMAT(applied_date, '%Y-%m') as month,
       COUNT(*) as applications,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       COALESCE(AVG(DATEDIFF(COALESCE(updated_at, NOW()), applied_date)), 0) as avg_time_to_decision,
       COALESCE(AVG(DATEDIFF(COALESCE(updated_at, NOW()), applied_date)), 0) as avg_time_to_hire
     FROM candidates 
     WHERE applied_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(applied_date, '%Y-%m')
     ORDER BY month DESC`,
    [months]
  );

  res.json({
    success: true,
    data: {
      trends,
      trendsBySource,
      trendsByDepartment,
      velocityTrends
    }
  });
}));

// Get candidate quality analytics
router.get('/candidate-quality', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get comprehensive candidate quality statistics
  const qualityStats = await query(
    `SELECT 
       CASE 
         WHEN score >= 4.5 THEN 'Excellent (4.5-5.0)'
         WHEN score >= 4.0 THEN 'Good (4.0-4.4)'
         WHEN score >= 3.5 THEN 'Average (3.5-3.9)'
         WHEN score >= 3.0 THEN 'Below Average (3.0-3.4)'
         ELSE 'Poor (0-2.9)'
       END as quality_range,
       COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM candidates WHERE score > 0), 0), 2) as percentage,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       ROUND(COUNT(CASE WHEN stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as hire_rate
     FROM candidates 
     WHERE score > 0
     GROUP BY 
       CASE 
         WHEN score >= 4.5 THEN 'Excellent (4.5-5.0)'
         WHEN score >= 4.0 THEN 'Good (4.0-4.4)'
         WHEN score >= 3.5 THEN 'Average (3.5-3.9)'
         WHEN score >= 3.0 THEN 'Below Average (3.0-3.4)'
         ELSE 'Poor (0-2.9)'
       END
     ORDER BY 
       CASE 
         WHEN score >= 4.5 THEN 1
         WHEN score >= 4.0 THEN 2
         WHEN score >= 3.5 THEN 3
         WHEN score >= 3.0 THEN 4
         ELSE 5
       END`,
    []
  );

  // Get quality trends over time
  const qualityTrends = await query(
    `SELECT 
       DATE_FORMAT(applied_date, '%Y-%m') as month,
       COALESCE(AVG(score), 0) as avg_score,
       COUNT(*) as total_candidates,
       COUNT(CASE WHEN score >= 4.0 THEN 1 END) as high_quality_candidates,
       ROUND(COUNT(CASE WHEN score >= 4.0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as high_quality_percentage,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       ROUND(COUNT(CASE WHEN stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as hire_rate
     FROM candidates 
     WHERE score > 0 AND applied_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(applied_date, '%Y-%m')
     ORDER BY month DESC`,
    []
  );

  // Get quality by source
  const qualityBySource = await query(
    `SELECT 
       source,
       COALESCE(AVG(score), 0) as avg_score,
       COUNT(*) as total_candidates,
       COUNT(CASE WHEN score >= 4.0 THEN 1 END) as high_quality_candidates,
       ROUND(COUNT(CASE WHEN score >= 4.0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as high_quality_percentage,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       ROUND(COUNT(CASE WHEN stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as hire_rate
     FROM candidates 
     WHERE score > 0
     GROUP BY source
     ORDER BY avg_score DESC`,
    []
  );

  // Get quality by department
  const qualityByDepartment = await query(
    `SELECT 
       jp.department,
       COALESCE(AVG(c.score), 0) as avg_score,
       COUNT(c.id) as total_candidates,
       COUNT(CASE WHEN c.score >= 4.0 THEN 1 END) as high_quality_candidates,
       ROUND(COUNT(CASE WHEN c.score >= 4.0 THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as high_quality_percentage,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as hire_rate
     FROM candidates c
     LEFT JOIN job_postings jp ON c.position = jp.title
     WHERE c.score > 0
     GROUP BY jp.department
     ORDER BY avg_score DESC`,
    []
  );

  // Get quality distribution by stage
  const qualityByStage = await query(
    `SELECT 
       stage,
       COALESCE(AVG(score), 0) as avg_score,
       COUNT(*) as count,
       COALESCE(MIN(score), 0) as min_score,
       COALESCE(MAX(score), 0) as max_score,
       COUNT(CASE WHEN score >= 4.0 THEN 1 END) as high_quality_count
     FROM candidates 
     WHERE score > 0
     GROUP BY stage
     ORDER BY 
       CASE stage
         WHEN 'Applied' THEN 1
         WHEN 'Screening' THEN 2
         WHEN 'Interview' THEN 3
         WHEN 'Offer' THEN 4
         WHEN 'Hired' THEN 5
         WHEN 'Rejected' THEN 6
       END`,
    []
  );

  res.json({
    success: true,
    data: {
      qualityStats,
      qualityTrends,
      qualityBySource,
      qualityByDepartment,
      qualityByStage
    }
  });
}));

export default router;