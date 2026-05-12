-- ============================================================
-- Run this entire file in phpMyAdmin on legatolx_hr_workflow_db
-- Creates all missing tables needed for the HR app to work
-- Safe to re-run (uses CREATE TABLE IF NOT EXISTS)
-- ============================================================

-- 1. import_logs
CREATE TABLE IF NOT EXISTS import_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  total_rows INT NOT NULL,
  success_count INT NOT NULL,
  failure_count INT NOT NULL,
  processing_time INT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_uploaded_at (uploaded_at),
  INDEX idx_user_uploaded (user_id, uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. import_failed_rows (row_number backtick-quoted for MariaDB compatibility)
CREATE TABLE IF NOT EXISTS import_failed_rows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  import_log_id INT NOT NULL,
  `row_number` INT NOT NULL,
  candidate_name VARCHAR(255) NULL,
  error_message TEXT NOT NULL,
  row_data JSON NOT NULL,
  FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE,
  INDEX idx_import_log_id (import_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. field_mappings
CREATE TABLE IF NOT EXISTS field_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mapping_name VARCHAR(255) NULL,
  source_column VARCHAR(255) NOT NULL,
  target_field VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  UNIQUE KEY unique_user_mapping (user_id, source_column, target_field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT NULL,
  metadata JSON NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
