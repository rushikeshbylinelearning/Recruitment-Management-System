-- Migration: Add 'Last Minute Back Out' stage to candidates table
-- Description: Adds a new stage for candidates who accepted offers but backed out at the last minute
-- Date: 2026-04-15

-- Add 'Last Minute Back Out' to the stage enum
ALTER TABLE candidates 
MODIFY COLUMN stage ENUM(
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'On Hold',
  'Rejected',
  'No Show - Interview',
  'No Show - Onboarding',
  'Last Minute Back Out'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Applied';
