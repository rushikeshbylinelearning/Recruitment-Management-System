-- Track when Applied-section cards are first viewed and who last opened them.
-- Run once on production; ensureCandidateViewSchema.js applies the same changes on startup.

ALTER TABLE candidates
  ADD COLUMN card_viewed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'First time a user opened the candidate card',
  ADD COLUMN last_viewed_by INT NULL DEFAULT NULL COMMENT 'User who last opened the card',
  ADD COLUMN last_viewed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When the card was last opened';

ALTER TABLE candidates
  ADD INDEX idx_candidates_created_at (created_at),
  ADD INDEX idx_candidates_card_viewed_at (card_viewed_at);

ALTER TABLE candidates
  ADD CONSTRAINT fk_candidates_last_viewed_by
  FOREIGN KEY (last_viewed_by) REFERENCES users(id) ON DELETE SET NULL;

-- Existing records were already on the board — treat as viewed so only new submissions highlight.
UPDATE candidates
SET card_viewed_at = COALESCE(created_at, NOW())
WHERE card_viewed_at IS NULL;

ALTER TABLE candidates
  ADD COLUMN requires_card_view TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = form-link applicant; track New/viewed on Applied card';

UPDATE candidates
SET requires_card_view = 0,
    card_viewed_at = COALESCE(card_viewed_at, created_at, NOW());
