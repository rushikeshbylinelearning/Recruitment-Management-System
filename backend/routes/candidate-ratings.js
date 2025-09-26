import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateId, handleValidationErrors } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all ratings for a candidate
router.get('/candidate/:candidateId', authenticateToken, checkPermission('candidates', 'view'), validateId('candidateId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.candidateId;
  const { ratingType, userRole } = req.query;

  let whereClause = 'WHERE cr.candidate_id = ?';
  let params = [candidateId];

  if (ratingType) {
    whereClause += ' AND cr.rating_type = ?';
    params.push(ratingType);
  }

  if (userRole) {
    whereClause += ' AND cr.user_role = ?';
    params.push(userRole);
  }

  const ratings = await query(
    `SELECT cr.*, u.name as user_name, u.role as user_role_name
     FROM candidate_ratings cr
     LEFT JOIN users u ON cr.user_id = u.id
     ${whereClause}
     ORDER BY cr.created_at DESC`,
    params
  );

  res.json({
    success: true,
    data: { ratings }
  });
}));

// Add a new rating for a candidate
router.post('/candidate/:candidateId', authenticateToken, checkPermission('candidates', 'edit'), validateId('candidateId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.candidateId;
  const { ratingType, score, comments } = req.body;

  if (!ratingType || !score) {
    throw new ValidationError('Rating type and score are required');
  }

  // Validate rating type
  const validRatingTypes = ['Technical', 'Communication', 'Cultural Fit', 'Overall'];
  if (!validRatingTypes.includes(ratingType)) {
    throw new ValidationError('Invalid rating type');
  }

  // Validate score
  if (score < 1.0 || score > 5.0) {
    throw new ValidationError('Score must be between 1.0 and 5.0');
  }

  // Check if candidate exists
  const candidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Determine user role for the rating
  const userRole = req.user.role === 'HR Manager' ? 'HR Manager' : 
                  req.user.role === 'Interviewer' ? 'Interviewer' :
                  req.user.role === 'Admin' ? 'Admin' : 'Recruiter';

  // Check if user already rated this candidate for this rating type
  const existingRatings = await query(
    'SELECT id FROM candidate_ratings WHERE candidate_id = ? AND user_id = ? AND rating_type = ?',
    [candidateId, req.user.id, ratingType]
  );

  if (existingRatings.length > 0) {
    throw new ValidationError('You have already rated this candidate for this rating type');
  }

  // Create rating
  const result = await query(
    `INSERT INTO candidate_ratings (candidate_id, user_id, user_role, rating_type, score, comments) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [candidateId, req.user.id, userRole, ratingType, score, comments || null]
  );

  res.status(201).json({
    success: true,
    message: 'Rating added successfully',
    data: {
      ratingId: result.insertId
    }
  });
}));

// Update a rating
router.put('/:ratingId', authenticateToken, checkPermission('candidates', 'edit'), validateId('ratingId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const ratingId = req.params.ratingId;
  const { score, comments } = req.body;

  if (!score) {
    throw new ValidationError('Score is required');
  }

  // Validate score
  if (score < 1.0 || score > 5.0) {
    throw new ValidationError('Score must be between 1.0 and 5.0');
  }

  // Check if rating exists and user can edit it
  const ratings = await query(
    'SELECT * FROM candidate_ratings WHERE id = ?',
    [ratingId]
  );

  if (ratings.length === 0) {
    throw new NotFoundError('Rating not found');
  }

  const rating = ratings[0];

  // Check if user can edit this rating (only the author or admin/hr manager)
  if (rating.user_id !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only edit your own ratings');
  }

  // Update rating
  await query(
    'UPDATE candidate_ratings SET score = ?, comments = ?, updated_at = NOW() WHERE id = ?',
    [score, comments || null, ratingId]
  );

  res.json({
    success: true,
    message: 'Rating updated successfully'
  });
}));

// Delete a rating
router.delete('/:ratingId', authenticateToken, checkPermission('candidates', 'edit'), validateId('ratingId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const ratingId = req.params.ratingId;

  // Check if rating exists and user can delete it
  const ratings = await query(
    'SELECT * FROM candidate_ratings WHERE id = ?',
    [ratingId]
  );

  if (ratings.length === 0) {
    throw new NotFoundError('Rating not found');
  }

  const rating = ratings[0];

  // Check if user can delete this rating (only the author or admin/hr manager)
  if (rating.user_id !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only delete your own ratings');
  }

  // Delete rating
  await query('DELETE FROM candidate_ratings WHERE id = ?', [ratingId]);

  res.json({
    success: true,
    message: 'Rating deleted successfully'
  });
}));

// Get rating by ID
router.get('/:ratingId', authenticateToken, checkPermission('candidates', 'view'), validateId('ratingId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const ratingId = req.params.ratingId;

  const ratings = await query(
    `SELECT cr.*, u.name as user_name, u.role as user_role_name
     FROM candidate_ratings cr
     LEFT JOIN users u ON cr.user_id = u.id
     WHERE cr.id = ?`,
    [ratingId]
  );

  if (ratings.length === 0) {
    throw new NotFoundError('Rating not found');
  }

  res.json({
    success: true,
    data: { rating: ratings[0] }
  });
}));

// Get aggregated scores for a candidate
router.get('/candidate/:candidateId/aggregated', authenticateToken, checkPermission('candidates', 'view'), validateId('candidateId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.candidateId;

  // Get average scores by rating type
  const aggregatedScores = await query(
    `SELECT 
       rating_type,
       AVG(score) as average_score,
       COUNT(*) as total_ratings,
       MIN(score) as min_score,
       MAX(score) as max_score
     FROM candidate_ratings 
     WHERE candidate_id = ?
     GROUP BY rating_type`,
    [candidateId]
  );

  // Get overall average
  const overallAverage = await query(
    `SELECT AVG(score) as overall_average, COUNT(*) as total_ratings
     FROM candidate_ratings 
     WHERE candidate_id = ?`,
    [candidateId]
  );

  res.json({
    success: true,
    data: {
      aggregatedScores,
      overallAverage: overallAverage[0]
    }
  });
}));

export default router;
