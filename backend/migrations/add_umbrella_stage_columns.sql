-- =====================================================
-- Umbrella Stage Architecture Migration
-- =====================================================
-- Date: 2026-05-11
-- Purpose: Add hierarchical stage structure to support
--          umbrella stages with nested sub-stages
-- =====================================================

-- Step 1: Add new columns for hierarchical stage structure
ALTER TABLE candidates 
ADD COLUMN main_stage VARCHAR(50) AFTER stage,
ADD COLUMN sub_stage VARCHAR(50) AFTER main_stage,
ADD INDEX idx_main_stage (main_stage),
ADD INDEX idx_sub_stage (sub_stage),
ADD INDEX idx_main_sub_stage (main_stage, sub_stage);

-- Step 2: Populate main_stage and sub_stage from existing stage column
-- This maintains backward compatibility while enabling new structure

-- Applied stage
UPDATE candidates 
SET main_stage = 'applied', sub_stage = NULL 
WHERE stage = 'Applied';

-- Follow Up stage
UPDATE candidates 
SET main_stage = 'follow-up', sub_stage = NULL 
WHERE stage = 'Follow Up';

-- Screening stage
UPDATE candidates 
SET main_stage = 'screening', sub_stage = NULL 
WHERE stage = 'Screening';

-- Interview umbrella stages
-- Default all Interview candidates to 'came-down' sub-stage
-- In production, you may want to distribute based on interview status
UPDATE candidates 
SET main_stage = 'interview', sub_stage = 'came-down' 
WHERE stage = 'Interview';

-- Offer stage
UPDATE candidates 
SET main_stage = 'offer', sub_stage = NULL 
WHERE stage = 'Offer';

-- Hired stage
UPDATE candidates 
SET main_stage = 'hired', sub_stage = NULL 
WHERE stage = 'Hired';

-- Rejected umbrella stages
UPDATE candidates 
SET main_stage = 'rejected', sub_stage = 'rejected' 
WHERE stage = 'Rejected';

UPDATE candidates 
SET main_stage = 'rejected', sub_stage = 'on-hold' 
WHERE stage = 'On Hold';

UPDATE candidates 
SET main_stage = 'rejected', sub_stage = 'profile-not-matched' 
WHERE stage = 'Profile Not Matched';

UPDATE candidates 
SET main_stage = 'rejected', sub_stage = 'last-minute-back-out' 
WHERE stage = 'Last Minute Back Out';

-- Handle any other stages that might exist
UPDATE candidates 
SET main_stage = 'applied', sub_stage = NULL 
WHERE main_stage IS NULL;

-- Step 3: Create a view for backward compatibility
-- This allows existing queries to continue working
CREATE OR REPLACE VIEW candidates_legacy_stage AS
SELECT 
  c.*,
  CASE 
    -- Rejected umbrella stages
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'rejected' THEN 'Rejected'
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'on-hold' THEN 'On Hold'
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'profile-not-matched' THEN 'Profile Not Matched'
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'last-minute-back-out' THEN 'Last Minute Back Out'
    -- Interview umbrella stages (all map to 'Interview' for legacy compatibility)
    WHEN c.main_stage = 'interview' AND c.sub_stage = 'follow-up-interview' THEN 'Interview'
    WHEN c.main_stage = 'interview' AND c.sub_stage = 'came-down' THEN 'Interview'
    WHEN c.main_stage = 'interview' AND c.sub_stage = 'no-show' THEN 'Interview'
    WHEN c.main_stage = 'interview' AND c.sub_stage = 'selected-interview' THEN 'Interview'
    WHEN c.main_stage = 'interview' AND c.sub_stage = 'rejected-interview' THEN 'Interview'
    -- Regular stages
    WHEN c.main_stage = 'applied' THEN 'Applied'
    WHEN c.main_stage = 'follow-up' THEN 'Follow Up'
    WHEN c.main_stage = 'screening' THEN 'Screening'
    WHEN c.main_stage = 'interview' THEN 'Interview'
    WHEN c.main_stage = 'offer' THEN 'Offer'
    WHEN c.main_stage = 'hired' THEN 'Hired'
    ELSE c.stage
  END AS computed_stage
FROM candidates c;

-- Step 4: Create helper functions for stage management

DELIMITER //

-- Function to get legacy stage name from main_stage and sub_stage
CREATE FUNCTION get_legacy_stage_name(
  p_main_stage VARCHAR(50),
  p_sub_stage VARCHAR(50)
)
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
  DECLARE legacy_name VARCHAR(50);
  
  IF p_main_stage = 'rejected' THEN
    CASE p_sub_stage
      WHEN 'rejected' THEN SET legacy_name = 'Rejected';
      WHEN 'on-hold' THEN SET legacy_name = 'On Hold';
      WHEN 'profile-not-matched' THEN SET legacy_name = 'Profile Not Matched';
      WHEN 'last-minute-back-out' THEN SET legacy_name = 'Last Minute Back Out';
      ELSE SET legacy_name = 'Rejected';
    END CASE;
  ELSIF p_main_stage = 'interview' THEN
    -- All Interview sub-stages map to 'Interview' for legacy compatibility
    -- Escalation to Offer or Rejected happens at application level
    SET legacy_name = 'Interview';
  ELSE
    CASE p_main_stage
      WHEN 'applied' THEN SET legacy_name = 'Applied';
      WHEN 'follow-up' THEN SET legacy_name = 'Follow Up';
      WHEN 'screening' THEN SET legacy_name = 'Screening';
      WHEN 'interview' THEN SET legacy_name = 'Interview';
      WHEN 'offer' THEN SET legacy_name = 'Offer';
      WHEN 'hired' THEN SET legacy_name = 'Hired';
      ELSE SET legacy_name = 'Applied';
    END CASE;
  END IF;
  
  RETURN legacy_name;
END//

-- Function to parse legacy stage into main_stage and sub_stage
CREATE PROCEDURE parse_legacy_stage(
  IN p_legacy_stage VARCHAR(50),
  OUT p_main_stage VARCHAR(50),
  OUT p_sub_stage VARCHAR(50)
)
BEGIN
  CASE p_legacy_stage
    WHEN 'Applied' THEN 
      SET p_main_stage = 'applied', p_sub_stage = NULL;
    WHEN 'Follow Up' THEN 
      SET p_main_stage = 'follow-up', p_sub_stage = NULL;
    WHEN 'Screening' THEN 
      SET p_main_stage = 'screening', p_sub_stage = NULL;
    WHEN 'Interview' THEN 
      -- Default Interview to 'came-down' sub-stage
      SET p_main_stage = 'interview', p_sub_stage = 'came-down';
    WHEN 'Offer' THEN 
      SET p_main_stage = 'offer', p_sub_stage = NULL;
    WHEN 'Hired' THEN 
      SET p_main_stage = 'hired', p_sub_stage = NULL;
    WHEN 'Rejected' THEN 
      SET p_main_stage = 'rejected', p_sub_stage = 'rejected';
    WHEN 'On Hold' THEN 
      SET p_main_stage = 'rejected', p_sub_stage = 'on-hold';
    WHEN 'Profile Not Matched' THEN 
      SET p_main_stage = 'rejected', p_sub_stage = 'profile-not-matched';
    WHEN 'Last Minute Back Out' THEN 
      SET p_main_stage = 'rejected', p_sub_stage = 'last-minute-back-out';
    ELSE 
      SET p_main_stage = 'applied', p_sub_stage = NULL;
  END CASE;
END//

DELIMITER ;

-- Step 5: Create trigger to keep stage column in sync (for backward compatibility)
DELIMITER //

CREATE TRIGGER candidates_stage_sync_insert
BEFORE INSERT ON candidates
FOR EACH ROW
BEGIN
  IF NEW.main_stage IS NOT NULL THEN
    SET NEW.stage = get_legacy_stage_name(NEW.main_stage, NEW.sub_stage);
  END IF;
END//

CREATE TRIGGER candidates_stage_sync_update
BEFORE UPDATE ON candidates
FOR EACH ROW
BEGIN
  IF NEW.main_stage IS NOT NULL AND (
    NEW.main_stage != OLD.main_stage OR 
    NEW.sub_stage != OLD.sub_stage OR
    OLD.main_stage IS NULL
  ) THEN
    SET NEW.stage = get_legacy_stage_name(NEW.main_stage, NEW.sub_stage);
  END IF;
END//

DELIMITER ;

-- Step 6: Add comments for documentation
ALTER TABLE candidates 
MODIFY COLUMN main_stage VARCHAR(50) COMMENT 'High-level umbrella stage (e.g., rejected, interview)',
MODIFY COLUMN sub_stage VARCHAR(50) COMMENT 'Detailed sub-stage within umbrella (e.g., on-hold, profile-not-matched)';

-- =====================================================
-- Migration Complete
-- =====================================================
-- 
-- NOTES:
-- 1. The 'stage' column is kept for backward compatibility
-- 2. Triggers automatically sync stage with main_stage/sub_stage
-- 3. Use main_stage and sub_stage for new queries
-- 4. Legacy queries using 'stage' will continue to work
-- 5. The view 'candidates_legacy_stage' provides computed stage
--
-- ROLLBACK:
-- To rollback this migration:
-- DROP TRIGGER IF EXISTS candidates_stage_sync_insert;
-- DROP TRIGGER IF EXISTS candidates_stage_sync_update;
-- DROP FUNCTION IF EXISTS get_legacy_stage_name;
-- DROP PROCEDURE IF EXISTS parse_legacy_stage;
-- DROP VIEW IF EXISTS candidates_legacy_stage;
-- ALTER TABLE candidates DROP COLUMN main_stage, DROP COLUMN sub_stage;
-- =====================================================
