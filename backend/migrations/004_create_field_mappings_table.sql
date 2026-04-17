-- Migration: Create field_mappings table
-- Requirements: 10.1, 10.2
-- Description: Creates table to store user field mapping preferences for reuse
-- Note: Foreign key constraint commented out due to users table using MyISAM engine

CREATE TABLE IF NOT EXISTS field_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mapping_name VARCHAR(255) NULL COMMENT 'Optional name for the mapping set',
  source_column VARCHAR(255) NOT NULL COMMENT 'Column name from uploaded file',
  target_field VARCHAR(255) NOT NULL COMMENT 'System field name',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  UNIQUE KEY unique_user_mapping (user_id, source_column, target_field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci 
COMMENT='Stores user field mapping preferences for candidate imports';
