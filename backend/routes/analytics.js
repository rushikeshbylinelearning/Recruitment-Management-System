import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  // Get overall statistics
  const stats = await query(
    `SELECT 
       (SELECT COUNT(*) FROM job_postings) as total_jobs,
       (SELECT COUNT(*) FROM job_postings WHERE status = 'Active') as active_jobs,
       (SELECT COUNT(*) FROM candidates) as total_candidates,
       (SELECT COUNT(*) FROM candidates WHERE stage = 'Hired') as hired,
       (SELECT COUNT(*) FROM interviews WHERE status = 'Completed') as interviews_completed,
       (SELECT AVG(DATEDIFF(updated_at, applied_date)) FROM candidates WHERE stage = 'Hired') as avg_time_to_hire`,
    []
  );

  // Get source effectiveness
  const sourceStats = await query(
    `SELECT source, COUNT(*) as count 
     FROM candidates 
     GROUP BY source 
     ORDER BY count DESC 
     LIMIT 10`,
    []
  );

  // Get monthly hires (last 6 months)
  const monthlyHires = await query(
    `SELECT 
       DATE_FORMAT(updated_at, '%Y-%m') as month,
       COUNT(*) as hires,
       (SELECT COUNT(*) FROM candidates WHERE DATE_FORMAT(applied_date, '%Y-%m') = DATE_FORMAT(c.updated_at, '%Y-%m')) as applications
     FROM candidates c
     WHERE stage = 'Hired' AND updated_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(updated_at, '%Y-%m')
     ORDER BY month DESC`,
    []
  );

  // Get stage distribution
  const stageDistribution = await query(
    `SELECT stage, COUNT(*) as count 
     FROM candidates 
     GROUP BY stage 
     ORDER BY count DESC`,
    []
  );

  // Get department distribution
  const departmentStats = await query(
    `SELECT department, COUNT(*) as job_count, 
       (SELECT COUNT(*) FROM candidates WHERE position IN (SELECT title FROM job_postings WHERE department = jp.department)) as candidate_count
     FROM job_postings jp
     GROUP BY department
     ORDER BY job_count DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      overview: stats[0],
      sourceEffectiveness: sourceStats,
      monthlyHires,
      stageDistribution,
      departmentStats
    }
  });
}));

// Get hiring funnel analytics
router.get('/hiring-funnel', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const funnelData = await query(
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

  // Calculate conversion rates
  const conversionRates = await query(
    `SELECT 
       'Applied to Screening' as stage, 
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage IN ('Screening', 'Interview', 'Offer', 'Hired')) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage != 'Rejected'), 2) as rate
     UNION ALL
     SELECT 
       'Screening to Interview' as stage, 
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage IN ('Interview', 'Offer', 'Hired')) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage IN ('Screening', 'Interview', 'Offer', 'Hired')), 2) as rate
     UNION ALL
     SELECT 
       'Interview to Offer' as stage, 
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage IN ('Offer', 'Hired')) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage IN ('Interview', 'Offer', 'Hired')), 2) as rate
     UNION ALL
     SELECT 
       'Offer to Hired' as stage, 
       ROUND((SELECT COUNT(*) FROM candidates WHERE stage = 'Hired') * 100.0 / (SELECT COUNT(*) FROM candidates WHERE stage IN ('Offer', 'Hired')), 2) as rate`,
    []
  );

  res.json({
    success: true,
    data: {
      funnelData,
      conversionRates
    }
  });
}));

// Get time-to-hire analytics
router.get('/time-to-hire', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const timeToHireStats = await query(
    `SELECT 
       AVG(DATEDIFF(updated_at, applied_date)) as avg_time_to_hire,
       MIN(DATEDIFF(updated_at, applied_date)) as min_time_to_hire,
       MAX(DATEDIFF(updated_at, applied_date)) as max_time_to_hire,
       STDDEV(DATEDIFF(updated_at, applied_date)) as std_dev_time_to_hire
     FROM candidates 
     WHERE stage = 'Hired'`,
    []
  );

  // Get time-to-hire by department
  const timeByDepartment = await query(
    `SELECT 
       jp.department,
       AVG(DATEDIFF(c.updated_at, c.applied_date)) as avg_time_to_hire,
       COUNT(*) as hires_count
     FROM candidates c
     JOIN job_postings jp ON c.position = jp.title
     WHERE c.stage = 'Hired'
     GROUP BY jp.department
     ORDER BY avg_time_to_hire ASC`,
    []
  );

  // Get time-to-hire by source
  const timeBySource = await query(
    `SELECT 
       source,
       AVG(DATEDIFF(updated_at, applied_date)) as avg_time_to_hire,
       COUNT(*) as hires_count
     FROM candidates 
     WHERE stage = 'Hired'
     GROUP BY source
     ORDER BY avg_time_to_hire ASC`,
    []
  );

  res.json({
    success: true,
    data: {
      overallStats: timeToHireStats[0],
      byDepartment: timeByDepartment,
      bySource: timeBySource
    }
  });
}));

// Get interviewer performance analytics
router.get('/interviewer-performance', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const interviewerStats = await query(
    `SELECT 
       u.id,
       u.name,
       u.role,
       COUNT(i.id) as total_interviews,
       COUNT(CASE WHEN i.status = 'Completed' THEN 1 END) as completed_interviews,
       AVG(if.overall_rating) as avg_rating,
       COUNT(CASE WHEN if.recommendation = 'Selected' THEN 1 END) as selections,
       COUNT(CASE WHEN if.recommendation = 'Rejected' THEN 1 END) as rejections,
       ROUND(COUNT(CASE WHEN if.recommendation = 'Selected' THEN 1 END) * 100.0 / COUNT(if.id), 2) as selection_rate
     FROM users u
     LEFT JOIN interviews i ON u.id = i.interviewer_id
     LEFT JOIN interview_feedback if ON i.id = if.interview_id
     WHERE u.role = 'Interviewer'
     GROUP BY u.id, u.name, u.role
     ORDER BY total_interviews DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      interviewerStats
    }
  });
}));

// Get recruiter performance analytics
router.get('/recruiter-performance', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const recruiterStats = await query(
    `SELECT 
       u.id,
       u.name,
       u.role,
       COUNT(c.id) as candidates_assigned,
       COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) as hires,
       COUNT(CASE WHEN c.stage = 'Rejected' THEN 1 END) as rejections,
       AVG(c.score) as avg_candidate_score,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / COUNT(c.id), 2) as hire_rate
     FROM users u
     LEFT JOIN candidates c ON u.id = c.assigned_to
     WHERE u.role IN ('Recruiter', 'HR Manager', 'Team Lead')
     GROUP BY u.id, u.name, u.role
     ORDER BY hires DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      recruiterStats
    }
  });
}));

// Get job performance analytics
router.get('/job-performance', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
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
       AVG(c.score) as avg_candidate_score,
       ROUND(COUNT(CASE WHEN c.stage = 'Hired' THEN 1 END) * 100.0 / COUNT(c.id), 2) as hire_rate,
       DATEDIFF(COALESCE(MAX(CASE WHEN c.stage = 'Hired' THEN c.updated_at END), NOW()), jp.posted_date) as days_to_fill
     FROM job_postings jp
     LEFT JOIN candidates c ON jp.title = c.position
     GROUP BY jp.id, jp.title, jp.department, jp.status, jp.posted_date, jp.deadline
     ORDER BY total_applications DESC`,
    []
  );

  res.json({
    success: true,
    data: {
      jobStats
    }
  });
}));

// Get monthly trends
router.get('/monthly-trends', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 12;

  const trends = await query(
    `SELECT 
       DATE_FORMAT(applied_date, '%Y-%m') as month,
       COUNT(*) as applications,
       COUNT(CASE WHEN stage = 'Hired' THEN 1 END) as hires,
       COUNT(CASE WHEN stage = 'Rejected' THEN 1 END) as rejections,
       AVG(score) as avg_score
     FROM candidates 
     WHERE applied_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(applied_date, '%Y-%m')
     ORDER BY month DESC`,
    [months]
  );

  res.json({
    success: true,
    data: {
      trends
    }
  });
}));

// Get candidate quality analytics
router.get('/candidate-quality', authenticateToken, checkPermission('analytics', 'view'), handleValidationErrors, asyncHandler(async (req, res) => {
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
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM candidates WHERE score > 0), 2) as percentage
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

  res.json({
    success: true,
    data: {
      qualityStats
    }
  });
}));

export default router;