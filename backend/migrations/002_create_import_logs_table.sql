-- Migration: Create import_logs table
-- Requirements: 9.1, 9.5
-- Description: Creates table to track candidate import history with summary statistics
-- Note: Foreign key constraint commented out due to users table using MyISAM engine

CREATE TABLE IF NOT EXISTS import_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  total_rows INT NOT NULL,
  success_count INT NOT NULL,
  failure_count INT NOT NULL,
  processing_time INT NULL COMMENT 'Processing time in milliseconds',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_uploaded_at (uploaded_at),
  INDEX idx_user_uploaded (user_id, uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci 
COMMENT='Tracks candidate import history and statistics';
