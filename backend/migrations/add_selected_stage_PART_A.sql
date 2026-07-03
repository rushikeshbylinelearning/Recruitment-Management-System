-- =====================================================
-- PART A — Run this first in phpMyAdmin
-- Delimiter: ; (default — do NOT change it)
-- =====================================================

-- Ensure main_stage and sub_stage columns exist
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS main_stage VARCHAR(50) AFTER stage,
  ADD COLUMN IF NOT EXISTS sub_stage  VARCHAR(50) AFTER main_stage;

-- Add 'Selected' to the stage ENUM
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

-- Drop old triggers and function before recreating
DROP TRIGGER IF EXISTS candidates_stage_sync_insert;
DROP TRIGGER IF EXISTS candidates_stage_sync_update;
DROP FUNCTION IF EXISTS get_legacy_stage_name;

-- Update the legacy view
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
