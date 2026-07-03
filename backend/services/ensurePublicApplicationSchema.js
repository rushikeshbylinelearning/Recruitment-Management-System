import { query } from '../config/database.js';
import { ensureCandidateDuplicateColumns } from './duplicateCandidateService.js';

let schemaReady = false;
let schemaSetupPromise = null;

async function tableExists(tableName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

const TABLE_SQL = [
  {
    name: 'public_forms',
    sql: `CREATE TABLE IF NOT EXISTS public_forms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      short_code VARCHAR(12) NOT NULL,
      route_prefix CHAR(1) NOT NULL DEFAULT 'a',
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
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'candidate_applications',
    sql: `CREATE TABLE IF NOT EXISTS candidate_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      public_ref CHAR(36) NOT NULL,
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
      INDEX idx_form_id (form_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'duplicate_matches',
    sql: `CREATE TABLE IF NOT EXISTS duplicate_matches (
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
      INDEX idx_matched_candidate (matched_candidate_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'candidate_sessions',
    sql: `CREATE TABLE IF NOT EXISTS candidate_sessions (
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
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
];

async function runSchemaSetup() {
  for (const { name, sql } of TABLE_SQL) {
    try {
      await query(sql);
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') continue;
      console.error(`[PublicApplication] Failed to ensure table "${name}":`, error.message);
      throw error;
    }
  }
  await ensureCandidateDuplicateColumns();
}

export async function ensurePublicApplicationSchema() {
  if (schemaReady) return;
  if (!schemaSetupPromise) {
    schemaSetupPromise = runSchemaSetup()
      .then(() => {
        schemaReady = true;
      })
      .catch((err) => {
        schemaSetupPromise = null;
        throw err;
      });
  }
  await schemaSetupPromise;
}

export async function publicApplicationTablesReady() {
  return (
    (await tableExists('public_forms')) &&
    (await tableExists('candidate_applications'))
  );
}
