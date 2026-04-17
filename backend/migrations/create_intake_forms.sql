-- Custom Candidate Intake Forms System
-- Migration for creating forms, form fields, and form submissions tables

-- Table: forms
-- Stores form configurations
CREATE TABLE IF NOT EXISTS forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  access_token VARCHAR(255) NOT NULL UNIQUE,
  job_id INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_slug (slug),
  INDEX idx_access_token (access_token),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_fields
-- Stores dynamic form field configurations
CREATE TABLE IF NOT EXISTS form_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  field_type ENUM('text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'file') NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  options JSON NULL COMMENT 'For select/dropdown fields',
  placeholder VARCHAR(255) NULL,
  validation_rules JSON NULL COMMENT 'Additional validation rules',
  order_index INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  INDEX idx_form_id (form_id),
  INDEX idx_order_index (order_index),
  UNIQUE KEY unique_form_field (form_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_submissions
-- Stores form submission data
CREATE TABLE IF NOT EXISTS form_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  candidate_id INT NULL COMMENT 'Created candidate ID after processing',
  submission_data JSON NOT NULL COMMENT 'Complete form submission data',
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  status ENUM('pending', 'processed', 'failed') DEFAULT 'pending',
  error_message TEXT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,
  INDEX idx_form_id (form_id),
  INDEX idx_candidate_id (candidate_id),
  INDEX idx_status (status),
  INDEX idx_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_field_mappings
-- Maps form fields to candidate database columns for Excel compatibility
CREATE TABLE IF NOT EXISTS form_field_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  db_column VARCHAR(100) NOT NULL COMMENT 'Candidate table column name',
  excel_column VARCHAR(100) NOT NULL COMMENT 'Excel export column name',
  transform_function VARCHAR(50) NULL COMMENT 'Optional data transformation function',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  INDEX idx_form_id (form_id),
  UNIQUE KEY unique_form_mapping (form_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: form_analytics
-- Track form views and submissions for analytics
CREATE TABLE IF NOT EXISTS form_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  event_type ENUM('view', 'submission', 'error') NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  INDEX idx_form_id (form_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default form template
INSERT INTO forms (name, slug, description, is_active, access_token, created_by)
VALUES (
  'Default Candidate Application Form',
  'default-application',
  'Standard candidate intake form with essential fields',
  TRUE,
  UUID(),
  1
) ON DUPLICATE KEY UPDATE name=name;

-- Get the form ID for default fields
SET @form_id = (SELECT id FROM forms WHERE slug = 'default-application' LIMIT 1);

-- Insert default form fields
INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, placeholder, order_index) VALUES
(@form_id, 'Full Name', 'name', 'text', TRUE, 'Enter your full name', 1),
(@form_id, 'Email Address', 'email', 'email', TRUE, 'your.email@example.com', 2),
(@form_id, 'Phone Number', 'phone', 'tel', TRUE, '+1234567890', 3),
(@form_id, 'Job Profile', 'position', 'select', TRUE, NULL, 4),
(@form_id, 'Years of Experience', 'experience', 'number', TRUE, 'e.g., 5', 5),
(@form_id, 'Notice Period (Days)', 'notice_period', 'number', TRUE, 'e.g., 30', 6),
(@form_id, 'Current CTC', 'current_ctc', 'text', FALSE, 'e.g., $50,000', 7),
(@form_id, 'Expected CTC', 'expected_ctc', 'text', TRUE, 'e.g., $60,000', 8),
(@form_id, 'Resume', 'resume', 'file', FALSE, NULL, 9),
(@form_id, 'Additional Comments', 'notes', 'textarea', FALSE, 'Any additional information...', 10)
ON DUPLICATE KEY UPDATE label=VALUES(label);

-- Insert default field mappings for Excel compatibility
INSERT INTO form_field_mappings (form_id, field_key, db_column, excel_column) VALUES
(@form_id, 'name', 'name', 'Full Name'),
(@form_id, 'email', 'email', 'Email Address'),
(@form_id, 'phone', 'phone', 'Phone Number'),
(@form_id, 'position', 'position', 'Job Profile'),
(@form_id, 'experience', 'experience', 'Experience (Years)'),
(@form_id, 'notice_period', 'notice_period', 'Notice Period (Days)'),
(@form_id, 'current_ctc', 'current_ctc', 'Current CTC'),
(@form_id, 'expected_ctc', 'expected_salary', 'Expected CTC'),
(@form_id, 'notes', 'notes', 'Comments')
ON DUPLICATE KEY UPDATE db_column=VALUES(db_column);
