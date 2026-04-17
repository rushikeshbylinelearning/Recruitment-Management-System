-- ============================================================
-- Migration: Interaction-Candidate Pipeline Integration
-- ============================================================
-- Description: Integrates the Interaction Memory system with the main Candidates pipeline
-- Creates hr_notes table, adds candidate_id FK to interaction_candidates, and adds indexes
-- Requirements: Database Design, Stage Mapping Logic

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

-- 1. Create hr_notes table for stage-wise interaction history
CREATE TABLE IF NOT EXISTS hr_notes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id    VARCHAR(36)  NOT NULL COMMENT 'FK to candidates table (UUID)',
  stage           ENUM('Applied','Screening','Interview','Offer','Hired','On Hold','Rejected','No Show - Interview','No Show - Onboarding') NOT NULL COMMENT 'Stage when note was created',
  note_text       TEXT         NOT NULL COMMENT 'Note content',
  interaction_type ENUM('Phone Call','Email','Interview','Stage Change','General Note','System Event') DEFAULT 'General Note' COMMENT 'Type of interaction',
  author_id       INT          NOT NULL COMMENT 'User who created the note',
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_candidate_id (candidate_id),
  INDEX idx_stage (stage),
  INDEX idx_created_at (created_at),
  INDEX idx_author_id (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stage-wise interaction history for candidates in main pipeline';

-- Note: Foreign key constraints are not added because:
-- 1. candidates table may be using MyISAM engine (check and convert if needed)
-- 2. users table is using MyISAM engine (doesn't support FK)
-- The application layer will enforce referential integrity

-- 2. Add candidate_id foreign key to interaction_candidates table
ALTER TABLE interaction_candidates 
ADD COLUMN candidate_id VARCHAR(36) NULL COMMENT 'FK to candidates table when added to pipeline' AFTER id;

ALTER TABLE interaction_candidates 
ADD INDEX idx_candidate_id (candidate_id);

-- Note: Foreign key constraint not added because candidates table may be using MyISAM engine
-- The application layer will enforce referential integrity

-- 3. Add indexes for phone/email lookups in candidates table (if not already exist)
-- Note: These indexes may already exist from UUID migration (001_convert_candidates_to_uuid.sql)
-- Using IF NOT EXISTS equivalent by checking if index exists before creating

-- Check and create phone index
SET @index_exists = (
  SELECT COUNT(1) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE table_schema = DATABASE() 
  AND table_name = 'candidates' 
  AND index_name = 'idx_phone'
);

SET @sql = IF(@index_exists = 0, 
  'ALTER TABLE candidates ADD INDEX idx_phone (phone)', 
  'SELECT "Index idx_phone already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and create email index
SET @index_exists = (
  SELECT COUNT(1) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE table_schema = DATABASE() 
  AND table_name = 'candidates' 
  AND index_name = 'idx_email'
);

SET @sql = IF(@index_exists = 0, 
  'ALTER TABLE candidates ADD INDEX idx_email (email)', 
  'SELECT "Index idx_email already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add current_stage column to candidates table if it doesn't exist
-- (Design mentions current_stage but schema shows 'stage' column)
-- We'll use the existing 'stage' column as current_stage

-- ============================================================
-- ROLLBACK MIGRATION
-- ============================================================
-- To rollback this migration, run the following SQL commands:
-- 
-- -- Remove candidate_id column and index from interaction_candidates
-- ALTER TABLE interaction_candidates DROP INDEX idx_candidate_id;
-- ALTER TABLE interaction_candidates DROP COLUMN candidate_id;
-- 
-- -- Drop hr_notes table
-- DROP TABLE IF EXISTS hr_notes;
-- 
-- -- Note: We don't remove indexes from candidates table as they may have been
-- -- created by previous migrations and are useful for performance
-- ============================================================
