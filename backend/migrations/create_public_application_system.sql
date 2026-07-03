-- Public application system: short links, versioning, duplicate tracking, resume sessions

CREATE TABLE IF NOT EXISTS public_forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  short_code VARCHAR(12) NOT NULL,
  route_prefix CHAR(1) NOT NULL DEFAULT 'a' COMMENT 'a=application, j=job, c=candidate',
  form_id INT NOT NULL,
  share_token_id INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at DATETIME NULL,
  created_by INT NULL,
  access_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_short_code (short_code),
  INDEX idx_form_id (form_id),
  INDEX idx_active (is_active),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_ref CHAR(36) NOT NULL COMMENT 'External UUID — never expose numeric id',
  candidate_id INT NOT NULL,
  form_id INT NOT NULL,
  form_submission_id INT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  linkedin_url VARCHAR(500) NULL,
  resume_hash VARCHAR(64) NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'submitted',
  version INT NOT NULL DEFAULT 1,
  parent_application_id INT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  submission_data JSON NULL,
  submitted_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_public_ref (public_ref),
  INDEX idx_candidate_active (candidate_id, is_active),
  INDEX idx_email_form (email, form_id),
  INDEX idx_phone (phone),
  INDEX idx_form_id (form_id),
  INDEX idx_parent (parent_application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS duplicate_matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  matched_application_id INT NULL,
  matched_candidate_id INT NOT NULL,
  match_type ENUM('email', 'phone', 'linkedin', 'resume_hash', 'name') NOT NULL,
  confidence_score DECIMAL(4,3) NOT NULL DEFAULT 1.000,
  is_intentional BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_application (application_id),
  INDEX idx_matched_candidate (matched_candidate_id),
  INDEX idx_unresolved (is_intentional, resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_token_hash CHAR(64) NOT NULL,
  public_ref CHAR(36) NOT NULL,
  candidate_id INT NOT NULL,
  application_id INT NULL,
  form_id INT NOT NULL,
  public_form_id INT NULL,
  draft_data JSON NULL,
  expires_at DATETIME NOT NULL,
  last_accessed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_session_hash (session_token_hash),
  INDEX idx_public_ref (public_ref),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
