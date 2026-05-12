-- Migration: Add missing columns required by bulk import (bulkInsertService)
-- Run this on the production database to fix the "Database query error" on import/confirm
-- All statements use IF NOT EXISTS / IGNORE to be safe to re-run

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS salary_offered       VARCHAR(100)                              NULL AFTER salary_expected,
  ADD COLUMN IF NOT EXISTS expertise            VARCHAR(255)                              NULL AFTER skills,
  ADD COLUMN IF NOT EXISTS work_preference      ENUM('Onsite','WFH','Hybrid')             NULL AFTER willing_alternate_saturday,
  ADD COLUMN IF NOT EXISTS current_ctc          VARCHAR(100)                              NULL AFTER work_preference,
  ADD COLUMN IF NOT EXISTS ctc_frequency        ENUM('Monthly','Annual')                  NULL AFTER current_ctc,
  ADD COLUMN IF NOT EXISTS in_house_assignment_status ENUM('Pending','Shortlisted','Rejected') NULL AFTER ctc_frequency,
  ADD COLUMN IF NOT EXISTS assignment_location  VARCHAR(255)                              NULL AFTER in_house_assignment_status,
  ADD COLUMN IF NOT EXISTS resume_location      VARCHAR(500)                              NULL AFTER assignment_location,
  ADD COLUMN IF NOT EXISTS willing_alternate_saturday TINYINT(1) DEFAULT 0               NULL AFTER immediate_joiner;
