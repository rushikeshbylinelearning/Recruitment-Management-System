-- Migration: Add token expiry settings for public form links
-- Description: Adds configurable token validity (in hours) with 24-hour default

ALTER TABLE forms
  ADD COLUMN token_validity_hours INT NOT NULL DEFAULT 24 COMMENT 'Public form link validity duration in hours',
  ADD COLUMN token_expires_at DATETIME NULL COMMENT 'Current access token expiry timestamp';

UPDATE forms
SET token_expires_at = DATE_ADD(COALESCE(created_at, NOW()), INTERVAL token_validity_hours HOUR)
WHERE token_expires_at IS NULL;

ALTER TABLE forms
  MODIFY COLUMN token_expires_at DATETIME NOT NULL;

CREATE INDEX idx_token_expires_at ON forms(token_expires_at);
