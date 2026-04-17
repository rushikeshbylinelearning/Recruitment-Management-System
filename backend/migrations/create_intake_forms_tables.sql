-- Migration: Create intake forms tables
-- Description: Creates the forms table for the Custom Candidate Intake Form System
-- Requirements: 9.1, 21
-- Note: Foreign key constraints are commented out because referenced tables use MyISAM engine
-- To enable foreign keys, convert job_postings, users, and candidates tables to InnoDB

-- Table: forms
-- Stores form configurations and metadata
CREATE TABLE IF NOT EXISTS forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Human-readable form name',
  slug VARCHAR(255) NOT NULL UNIQUE COMMENT 'URL-friendly identifier',
  description TEXT COMMENT 'Optional form description',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether form accepts submissions',
  access_token VARCHAR(255) NOT NULL UNIQUE COMMENT 'Cryptographic token for URL authentication',
  job_id INT NULL COMMENT 'Optional link to specific job posting',
  created_by INT NOT NULL COMMENT 'User ID of form creator',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraints (disabled - referenced tables use MyISAM)
  -- FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE SET NULL,
  -- FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_slug (slug),
  INDEX idx_access_token (access_token),
  INDEX idx_is_active (is_active),
  INDEX idx_job_id (job_id),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_fields
-- Stores individual field configurations for each form
CREATE TABLE IF NOT EXISTS form_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL COMMENT 'Foreign key to forms table',
  label VARCHAR(255) NOT NULL COMMENT 'Display label for field',
  field_key VARCHAR(100) NOT NULL COMMENT 'Unique identifier for field within form',
  field_type ENUM('text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'file') NOT NULL COMMENT 'Input type',
  is_required BOOLEAN DEFAULT FALSE COMMENT 'Whether field must be filled',
  options JSON NULL COMMENT 'JSON array of options for select fields',
  placeholder VARCHAR(255) NULL COMMENT 'Placeholder text for input',
  validation_rules JSON NULL COMMENT 'JSON object with additional validation rules',
  order_index INT NOT NULL DEFAULT 0 COMMENT 'Display order (ascending)',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether field is currently displayed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint with CASCADE delete
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_form_id (form_id),
  INDEX idx_order_index (order_index),
  
  -- Unique constraint on form_id and field_key
  UNIQUE KEY unique_form_field (form_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Table: form_submissions
-- Stores all form submission data and links to candidate records
CREATE TABLE IF NOT EXISTS form_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL COMMENT 'Foreign key to forms table',
  candidate_id INT NULL COMMENT 'Foreign key to candidates table (set after processing)',
  submission_data JSON NOT NULL COMMENT 'Complete form data as JSON',
  ip_address VARCHAR(45) NULL COMMENT 'Submitter IP address for rate limiting and analytics',
  user_agent TEXT NULL COMMENT 'Browser user agent string',
  status ENUM('pending', 'processed', 'failed') DEFAULT 'pending' COMMENT 'Processing status',
  error_message TEXT NULL COMMENT 'Error details if processing failed',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Submission timestamp',
  processed_at TIMESTAMP NULL COMMENT 'Processing completion timestamp',
  
  -- Foreign key constraints with CASCADE delete
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  -- FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,  -- Disabled - candidates table uses MyISAM
  
  -- Indexes for performance
  INDEX idx_form_id (form_id),
  INDEX idx_candidate_id (candidate_id),
  INDEX idx_status (status),
  INDEX idx_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_field_mappings
-- Stores mappings between form fields, database columns, and Excel columns
CREATE TABLE IF NOT EXISTS form_field_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL COMMENT 'Foreign key to forms table',
  field_key VARCHAR(100) NOT NULL COMMENT 'Form field identifier (matches form_fields.field_key)',
  db_column VARCHAR(100) NOT NULL COMMENT 'Corresponding column in candidates table',
  excel_column VARCHAR(100) NOT NULL COMMENT 'Column name for Excel export',
  transform_function VARCHAR(50) NULL COMMENT 'Optional transformation function name',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint with CASCADE delete
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  
  -- Index on form_id for performance
  INDEX idx_form_id (form_id),
  
  -- Unique constraint on form_id and field_key
  UNIQUE KEY unique_form_mapping (form_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_analytics
-- Tracks form views, submissions, and errors for analytics purposes
CREATE TABLE IF NOT EXISTS form_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL COMMENT 'Foreign key to forms table',
  event_type ENUM('view', 'submission', 'error') NOT NULL COMMENT 'Type of event',
  ip_address VARCHAR(45) NULL COMMENT 'User IP address',
  user_agent TEXT NULL COMMENT 'Browser user agent',
  metadata JSON NULL COMMENT 'Additional event data as JSON',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Event timestamp',
  
  -- Foreign key constraint with CASCADE delete
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_form_id (form_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
