-- Migration: Create import_failed_rows table
-- Requirements: 9.2
-- Description: Creates table to store details of failed import rows with error messages

CREATE TABLE IF NOT EXISTS import_failed_rows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  import_log_id INT NOT NULL,
  row_number INT NOT NULL,
  candidate_name VARCHAR(255) NULL,
  error_message TEXT NOT NULL,
  row_data JSON NOT NULL COMMENT 'Original row data as JSON',
  
  FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE,
  INDEX idx_import_log_id (import_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci 
COMMENT='Stores failed candidate import rows with error details';
