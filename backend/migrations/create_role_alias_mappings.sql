-- Migration: Create role_alias_mappings table
-- Allows admins to define custom role aliases for intelligent job segregation
-- during bulk candidate imports.

CREATE TABLE IF NOT EXISTS role_alias_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alias VARCHAR(255) NOT NULL COMMENT 'Lowercase alias from Excel (e.g. "fsd", "hr exec")',
  canonical_title VARCHAR(255) NOT NULL COMMENT 'Canonical job title substring to match against job_postings.title',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = active, 0 = disabled',
  created_by INT NULL COMMENT 'User ID who created this mapping',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alias (alias),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed with common default mappings
INSERT IGNORE INTO role_alias_mappings (alias, canonical_title) VALUES
  ('hr', 'HR Executive'),
  ('hr exec', 'HR Executive'),
  ('hr executive', 'HR Executive'),
  ('fsd', 'Full Stack Developer'),
  ('full stack dev', 'Full Stack Developer'),
  ('full stack developer', 'Full Stack Developer'),
  ('it support', 'Senior IT'),
  ('senior it', 'Senior IT'),
  ('digital marketing', 'Digital Marketing Executive'),
  ('dm exec', 'Digital Marketing Executive'),
  ('graphic design', 'Graphic Designer'),
  ('animator', 'Animator'),
  ('project manager', 'Project Manager/Coordinator'),
  ('pm', 'Project Manager/Coordinator'),
  ('coordinator', 'Project Manager/Coordinator'),
  ('linkedin sales', 'LinkedIn Profile Sales'),
  ('linkedin profile sales', 'LinkedIn Profile Sales'),
  ('linkedin it', 'Linkedin Profiles IT'),
  ('linkedin id', 'LinkedIn Profiles ID');
