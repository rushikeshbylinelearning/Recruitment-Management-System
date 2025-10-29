import { body, param, query, validationResult } from 'express-validator';

// Handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('🔍 DEBUG: Validation errors found:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// User validation rules - minimal validation only
export const validateUser = [
  body('username')
    .notEmpty()
    .withMessage('Username is required'),
  
  body('email')
    .notEmpty()
    .withMessage('Email is required'),
  
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  
  body('password')
    .optional(),
  
  body('role')
    .optional()
];

// Job posting validation rules - minimal validation only
export const validateJobPosting = [
  body('title')
    .notEmpty()
    .withMessage('Job title is required')
    .trim(),
  
  body('department')
    .notEmpty()
    .withMessage('Department is required')
    .trim(),
  
  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .trim(),
  
  body('jobType')
    .optional()
    .isIn(['Full-time', 'Part-time', 'Contract', 'Internship'])
    .withMessage('Invalid job type'),
  
  body('status')
    .optional()
    .isIn(['Active', 'Paused', 'Closed'])
    .withMessage('Invalid status'),
  
  body('postedDate')
    .optional()
    .isISO8601()
    .withMessage('Posted date must be a valid date'),
  
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid date'),
  
  body('description')
    .optional()
    .trim(),
  
  body('requirements')
    .optional()
];

// Candidate validation rules - minimal validation only
export const validateCandidate = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('phone')
    .optional(),
  
  body('position')
    .optional()
    .trim(),
  
  body('stage')
    .optional()
    .isIn(['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'])
    .withMessage('Invalid stage'),
  
  body('source')
    .optional()
    .trim(),
  
  body('appliedDate')
    .optional()
    .isISO8601()
    .withMessage('Applied date must be a valid date'),
  
  body('assignedTo')
    .optional()
    .custom((value) => {
      if (value === 'Unassigned' || value === null || value === undefined) {
        return true; // Allow "Unassigned" or null/undefined
      }
      if (Number.isInteger(Number(value)) && Number(value) >= 1) {
        return true; // Allow valid integer IDs
      }
      throw new Error('Assigned user ID must be a valid integer or "Unassigned"');
    }),
  
  body('score')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Score must be between 0 and 5')
];

// Partial candidate validation rules (for assignment updates)
export const validateCandidatePartial = [
  body('name')
    .optional()
    .trim(),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('phone')
    .optional(),
  
  body('position')
    .optional()
    .trim(),
  
  body('stage')
    .optional()
    .isIn(['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'])
    .withMessage('Invalid stage'),
  
  body('source')
    .optional()
    .trim(),
  
  body('appliedDate')
    .optional()
    .isISO8601()
    .withMessage('Applied date must be a valid date'),
  
  body('resumePath')
    .optional()
    .trim(),
  
  body('notes')
    .optional()
    .trim(),
  
  body('assignedTo')
    .optional()
    .custom((value) => {
      if (value === 'Unassigned') return true;
      if (Number.isInteger(Number(value)) && Number(value) > 0) return true;
      throw new Error('Assigned user ID must be a valid integer or "Unassigned"');
    }),
  
  body('score')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Score must be between 0 and 5'),
  
  // Assignment-specific fields
  body('assignmentLocation')
    .optional()
    .trim(),
  
  body('inOfficeAssignment')
    .optional()
    .trim(),
  
  body('inHouseAssignmentStatus')
    .optional()
    .isIn(['Draft', 'Assigned', 'In Progress', 'Submitted', 'Approved', 'Rejected', 'Cancelled'])
    .withMessage('Invalid assignment status')
];

// Interview validation rules
export const validateInterview = [
  body('candidate_id')
    .isInt({ min: 1 })
    .withMessage('Candidate ID must be a valid integer'),
  
  body('interviewer_id')
    .isInt({ min: 1 })
    .withMessage('Interviewer ID must be a valid integer'),
  
  body('scheduled_date')
    .notEmpty()
    .withMessage('Scheduled date is required')
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }
      return true;
    }),
  
  body('type')
    .isIn(['Video', 'Phone', 'In-Person', 'Technical', 'HR', 'Managerial', 'Final'])
    .withMessage('Invalid interview type'),
  
  body('status')
    .optional()
    .isIn(['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'In Progress'])
    .withMessage('Invalid status'),
  
  body('location')
    .optional()
    .isString()
    .withMessage('Location must be a string'),
  
  body('meeting_link')
    .optional()
    .custom((value) => {
      if (value && value.trim() !== '') {
        try {
          new URL(value);
        } catch {
          throw new Error('Meeting link must be a valid URL');
        }
      }
      return true;
    }),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

// Task validation rules
export const validateTask = [
  body('title')
    .trim(),
  
  body('description')
    .trim(),
  
  body('assignedTo')
    .isInt({ min: 1 })
    .withMessage('Assigned user ID must be a valid integer'),
  
  body('priority')
    .isIn(['High', 'Medium', 'Low'])
    .withMessage('Invalid priority level'),
  
  body('status')
    .isIn(['Pending', 'In Progress', 'Completed'])
    .withMessage('Invalid status'),
  
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be a valid date')
];

// Communication validation rules
export const validateCommunication = [
  body('candidateId')
    .isInt({ min: 1 })
    .withMessage('Candidate ID must be a valid integer'),
  
  body('type')
    .isIn(['Email', 'Phone', 'WhatsApp', 'LinkedIn'])
    .withMessage('Invalid communication type'),
  
  body('content')
    .isLength({ min: 1 })
    .withMessage('Content cannot be empty')
    .trim(),
  
  body('status')
    .isIn(['Sent', 'Received', 'Pending', 'Delivered', 'Read', 'Replied', 'Failed'])
    .withMessage('Invalid status')
];


// Email template validation rules
export const validateEmailTemplate = [
  body('name')
    .isLength({ min: 5, max: 200 })
    .withMessage('Template name must be between 5 and 200 characters')
    .trim(),
  
  body('subject')
    .isLength({ min: 5, max: 500 })
    .withMessage('Subject must be between 5 and 500 characters')
    .trim(),
  
  body('content')
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters long')
    .trim(),
  
  body('category')
    .isIn(['Interview Invite', 'Rejection', 'Offer', 'Follow-up', 'Custom'])
    .withMessage('Invalid template category'),
  
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array')
];

// ID parameter validation
export const validateId = (paramName) => [
  param(paramName)
    .isInt({ min: 1 })
    .withMessage(`${paramName} must be a valid integer`)
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Search validation
export const validateSearch = [
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be between 2 and 100 characters')
    .trim()
];

