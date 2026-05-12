-- Migration: Create form_share_tokens table
-- Each "Copy Link" action generates a unique one-time shareable token
-- so every distributed link is distinct even though the form is created once.

CREATE TABLE IF NOT EXISTS form_share_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  INDEX idx_token (token),
  INDEX idx_form_id (form_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
