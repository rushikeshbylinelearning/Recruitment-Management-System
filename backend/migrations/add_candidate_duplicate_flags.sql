-- HR-side duplicate tracking (public applicants are not blocked)

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS is_flagged_duplicate TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_of_candidate_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS duplicate_detected_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS has_merged_applications TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_candidates_duplicate ON candidates (is_flagged_duplicate, duplicate_of_candidate_id);
