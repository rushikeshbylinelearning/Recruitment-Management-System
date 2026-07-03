-- Intelligent candidate merge & reconciliation system

CREATE TABLE IF NOT EXISTS candidate_merge_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  primary_candidate_id VARCHAR(36) NOT NULL,
  merged_candidate_id VARCHAR(36) NOT NULL,
  merge_strategy VARCHAR(32) NOT NULL DEFAULT 'HR_REVIEW_REQUIRED',
  merged_by INT NULL,
  merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rollback_snapshot JSON NOT NULL,
  conflict_snapshot JSON NULL,
  field_decisions JSON NULL,
  is_rolled_back TINYINT(1) NOT NULL DEFAULT 0,
  rolled_back_at TIMESTAMP NULL,
  rolled_back_by INT NULL,
  INDEX idx_primary_candidate (primary_candidate_id),
  INDEX idx_merged_candidate (merged_candidate_id),
  INDEX idx_merged_at (merged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_field_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(64) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'merge',
  changed_by INT NULL,
  merge_history_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_candidate_field (candidate_id, field_name),
  INDEX idx_merge_history (merge_history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_resumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id VARCHAR(36) NOT NULL,
  file_upload_id INT NULL,
  file_url VARCHAR(500) NULL,
  original_filename VARCHAR(255) NULL,
  uploaded_at TIMESTAMP NULL,
  source_application_id INT NULL,
  source_submission_id INT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_candidate_resumes (candidate_id),
  INDEX idx_candidate_primary (candidate_id, is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id VARCHAR(36) NOT NULL,
  position_name VARCHAR(200) NOT NULL,
  source_application_id INT NULL,
  source_submission_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_candidate_position (candidate_id, position_name(100)),
  INDEX idx_candidate_positions (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_email_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'merge',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_candidate_email (candidate_id, email),
  INDEX idx_candidate_aliases (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
