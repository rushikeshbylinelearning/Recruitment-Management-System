import { body, param, query, validationResult } from 'express-validator';

// Handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
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

// Interview validation rules
export const validateInterview = [
  body('candidateId')
    .isInt({ min: 1 })
    .withMessage('Candidate ID must be a valid integer'),
  
  body('interviewerId')
    .isInt({ min: 1 })
    .withMessage('Interviewer ID must be a valid integer'),
  
  body('scheduledDate')
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  
  body('duration')
    .isInt({ min: 15, max: 480 })
    .withMessage('Duration must be between 15 and 480 minutes'),
  
  body('type')
    .isIn(['Technical', 'HR', 'Managerial', 'Final'])
    .withMessage('Invalid interview type'),
  
  body('status')
    .isIn(['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'])
    .withMessage('Invalid status'),
  
  body('round')
    .isInt({ min: 1, max: 10 })
    .withMessage('Round must be between 1 and 10')
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
  
  body('body')
    .isLength({ min: 10 })
    .withMessage('Body must be at least 10 characters long')
    .trim(),
  
  body('type')
    .isIn(['Interview Invite', 'Rejection', 'Offer', 'Follow-up', 'Custom'])
    .withMessage('Invalid template type')
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

