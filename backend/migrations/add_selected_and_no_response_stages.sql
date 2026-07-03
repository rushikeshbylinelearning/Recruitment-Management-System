-- =====================================================
-- Migration: Add Selected stage and no-response sub-stage
-- =====================================================
-- Date: 2026-05-14
-- Purpose: Support the NEW REQUIRED COLOR SYSTEM (v2)
--
--   Selected        → #92D050  → main_stage = 'selected'
--   didn't respond  → #7F7F7F  → main_stage = 'follow-up', sub_stage = 'no-response'
--   Not Relevant    → #FFC000  → already exists as profile-not-matched
--
-- HOW TO RUN IN phpMyAdmin:
--   Run PART A first (plain SQL — no delimiter change needed).
--   Then run PART B (stored routines) with Delimiter set to // in phpMyAdmin.
--
-- HOW TO RUN IN MySQL CLI:
--   source add_selected_and_no_response_stages.sql
-- =====================================================


-- =====================================================
-- PART A — Plain SQL (run this block first)
-- =====================================================

-- Step 1: Ensure main_stage and sub_stage columns exist.
-- Safe to run even if add_umbrella_stage_columns.sql was already applied.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS main_stage VARCHAR(50) AFTER stage,
  ADD COLUMN IF NOT EXISTS sub_stage  VARCHAR(50) AFTER main_stage;

-- Step 2: Add 'Selected' to the stage ENUM.
-- Lists ALL existing values so no data is lost.
ALTER TABLE candidates
  MODIFY COLUMN stage ENUM(
    'Applied',
    'Follow Up',
    'Screening',
    'Interview',
    'Offer',
    'Hired',
    'On Hold',
    'Rejected',
    'No Show - Interview',
    'No Show - Onboarding',
    'Last Minute Back Out',
    'Profile Not Matched',
    'Selected'
  ) NOT NULL DEFAULT 'Applied';

-- Step 3: Drop old triggers and function so we can recreate them.
DROP TRIGGER IF EXISTS candidates_stage_sync_insert;
DROP TRIGGER IF EXISTS candidates_stage_sync_update;
DROP FUNCTION IF EXISTS get_legacy_stage_name;

-- Step 4: Update the legacy view to include new stages.
CREATE OR REPLACE VIEW candidates_legacy_stage AS
SELECT
  c.*,
  CASE
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'rejected'             THEN 'Rejected'
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'on-hold'              THEN 'On Hold'
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'profile-not-matched'  THEN 'Profile Not Matched'
    WHEN c.main_stage = 'rejected' AND c.sub_stage = 'last-minute-back-out' THEN 'Last Minute Back Out'
    WHEN c.main_stage = 'interview'                                          THEN 'Interview'
    WHEN c.main_stage = 'follow-up'                                          THEN 'Follow Up'
    WHEN c.main_stage = 'selected'                                           THEN 'Selected'
    WHEN c.main_stage = 'applied'                                            THEN 'Applied'
    WHEN c.main_stage = 'screening'                                          THEN 'Screening'
    WHEN c.main_stage = 'offer'                                              THEN 'Offer'
    WHEN c.main_stage = 'hired'                                              THEN 'Hired'
    ELSE c.stage
  END AS computed_stage
FROM candidates c;


-- =====================================================
-- PART B — Stored routines (requires DELIMITER change)
-- In phpMyAdmin: set the Delimiter field to //  before running this block.
-- In MySQL CLI:  this runs automatically via DELIMITER //.
-- =====================================================

DELIMITER //

-- Updated function: maps main_stage + sub_stage → legacy stage name
CREATE FUNCTION get_legacy_stage_name(
  p_main_stage VARCHAR(50),
  p_sub_stage  VARCHAR(50)
)
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
  DECLARE legacy_name VARCHAR(50);

  IF p_main_stage = 'rejected' THEN
    CASE p_sub_stage
      WHEN 'rejected'             THEN SET legacy_name = 'Rejected';
      WHEN 'on-hold'              THEN SET legacy_name = 'On Hold';
      WHEN 'profile-not-matched'  THEN SET legacy_name = 'Profile Not Matched';
      WHEN 'last-minute-back-out' THEN SET legacy_name = 'Last Minute Back Out';
      ELSE                             SET legacy_name = 'Rejected';
    END CASE;

  ELSEIF p_main_stage = 'interview' THEN
    SET legacy_name = 'Interview';

  ELSEIF p_main_stage = 'follow-up' THEN
    SET legacy_name = 'Follow Up';

  ELSEIF p_main_stage = 'selected' THEN
    SET legacy_name = 'Selected';

  ELSE
    CASE p_main_stage
      WHEN 'applied'   THEN SET legacy_name = 'Applied';
      WHEN 'screening' THEN SET legacy_name = 'Screening';
      WHEN 'offer'     THEN SET legacy_name = 'Offer';
      WHEN 'hired'     THEN SET legacy_name = 'Hired';
      ELSE                  SET legacy_name = 'Applied';
    END CASE;
  END IF;

  RETURN legacy_name;
END//

-- Insert trigger: auto-set stage from main_stage/sub_stage on INSERT
CREATE TRIGGER candidates_stage_sync_insert
BEFORE INSERT ON candidates
FOR EACH ROW
BEGIN
  IF NEW.main_stage IS NOT NULL THEN
    SET NEW.stage = get_legacy_stage_name(NEW.main_stage, NEW.sub_stage);
  END IF;
END//

-- Update trigger: auto-set stage from main_stage/sub_stage on UPDATE
CREATE TRIGGER candidates_stage_sync_update
BEFORE UPDATE ON candidates
FOR EACH ROW
BEGIN
  IF NEW.main_stage IS NOT NULL AND (
    NEW.main_stage != OLD.main_stage OR
    COALESCE(NEW.sub_stage, '') != COALESCE(OLD.sub_stage, '') OR
    OLD.main_stage IS NULL
  ) THEN
    SET NEW.stage = get_legacy_stage_name(NEW.main_stage, NEW.sub_stage);
  END IF;
END//

DELIMITER ;

-- =====================================================
-- Migration Complete
-- =====================================================
