-- Migration: Add uploaded_by column to candidates table
-- Tracks which user (recruiter/intern) uploaded/added the candidate to the portal
-- Note: No FK constraint because the `users` table uses MyISAM engine which
-- does not support foreign keys. An index is added for query performance instead.

-- Add column only if it doesn't already exist
ALTER TABLE `candidates`
  ADD COLUMN IF NOT EXISTS `uploaded_by` INT(11) NULL DEFAULT NULL AFTER `assigned_to`;

-- Add index only if it doesn't already exist
ALTER TABLE `candidates`
  ADD INDEX IF NOT EXISTS `idx_candidates_uploaded_by` (`uploaded_by`);

-- Backfill: best-effort attribution via import_logs
-- import_logs only stores (user_id, filename, uploaded_at) — no job_id or per-row linkage.
-- We find the most recent importer on or before each candidate's applied_date and
-- attribute bulk-sourced candidates to that user.
-- Older rows that cannot be matched will remain NULL.
UPDATE `candidates` c
SET c.uploaded_by = (
  SELECT il.user_id
  FROM `import_logs` il
  WHERE DATE(il.uploaded_at) <= c.applied_date
  ORDER BY il.uploaded_at DESC
  LIMIT 1
)
WHERE c.uploaded_by IS NULL
  AND c.source IN ('BulkUpload', 'Bulk Upload', 'bulk_upload');
