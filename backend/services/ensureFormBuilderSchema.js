import { query } from '../config/database.js';

let schemaReady = false;
let schemaSetupPromise = null;

async function tableExists(tableName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function runAlter(sql) {
  try {
    await query(sql);
  } catch (error) {
    if (
      error.code === 'ER_DUP_FIELDNAME' ||
      error.code === 'ER_DUP_KEYNAME' ||
      (error.sqlMessage && /Duplicate column|Duplicate key/i.test(error.sqlMessage))
    ) {
      return;
    }
    throw error;
  }
}

const TABLE_DEFINITIONS = [
  {
    name: 'forms',
    sql: `CREATE TABLE IF NOT EXISTS forms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      access_token VARCHAR(255) NOT NULL UNIQUE,
      job_id INT NULL,
      created_by INT NOT NULL,
      token_validity_hours INT NOT NULL DEFAULT 24,
      token_expires_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_slug (slug),
      INDEX idx_access_token (access_token),
      INDEX idx_is_active (is_active),
      INDEX idx_job_id (job_id),
      INDEX idx_created_by (created_by),
      INDEX idx_token_expires_at (token_expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'form_fields',
    sql: `CREATE TABLE IF NOT EXISTS form_fields (
      id INT AUTO_INCREMENT PRIMARY KEY,
      form_id INT NOT NULL,
      label VARCHAR(255) NOT NULL,
      field_key VARCHAR(100) NOT NULL,
      field_type ENUM('text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'file') NOT NULL,
      is_required BOOLEAN DEFAULT FALSE,
      options JSON NULL,
      placeholder VARCHAR(255) NULL,
      validation_rules JSON NULL,
      order_index INT NOT NULL DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_form_id (form_id),
      INDEX idx_order_index (order_index),
      UNIQUE KEY unique_form_field (form_id, field_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'form_submissions',
    sql: `CREATE TABLE IF NOT EXISTS form_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      form_id INT NOT NULL,
      candidate_id INT NULL,
      submission_data JSON NOT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      status ENUM('pending', 'processed', 'failed') DEFAULT 'pending',
      error_message TEXT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP NULL,
      INDEX idx_form_id (form_id),
      INDEX idx_candidate_id (candidate_id),
      INDEX idx_status (status),
      INDEX idx_submitted_at (submitted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'form_field_mappings',
    sql: `CREATE TABLE IF NOT EXISTS form_field_mappings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      form_id INT NOT NULL,
      field_key VARCHAR(100) NOT NULL,
      db_column VARCHAR(100) NOT NULL,
      excel_column VARCHAR(100) NOT NULL,
      transform_function VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_form_id (form_id),
      UNIQUE KEY unique_form_mapping (form_id, field_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'form_analytics',
    sql: `CREATE TABLE IF NOT EXISTS form_analytics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      form_id INT NOT NULL,
      event_type ENUM('view', 'submission', 'error') NOT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_form_id (form_id),
      INDEX idx_event_type (event_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'form_share_tokens',
    sql: `CREATE TABLE IF NOT EXISTS form_share_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      form_id INT NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL,
      used_count INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      INDEX idx_token (token),
      INDEX idx_form_id (form_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
];

async function ensureFormsTokenColumns() {
  if (!(await tableExists('forms'))) return;

  if (!(await columnExists('forms', 'token_validity_hours'))) {
    await runAlter(
      `ALTER TABLE forms
       ADD COLUMN token_validity_hours INT NOT NULL DEFAULT 24
       COMMENT 'Public form link validity duration in hours'`
    );
  }

  if (!(await columnExists('forms', 'token_expires_at'))) {
    await runAlter(
      `ALTER TABLE forms
       ADD COLUMN token_expires_at DATETIME NULL
       COMMENT 'Current access token expiry timestamp'`
    );
  }

  await query(
    `UPDATE forms
     SET token_expires_at = DATE_ADD(COALESCE(created_at, NOW()), INTERVAL COALESCE(token_validity_hours, 24) HOUR)
     WHERE token_expires_at IS NULL`
  ).catch(() => {});
}

async function runSchemaSetup() {
  for (const { name, sql } of TABLE_DEFINITIONS) {
    try {
      await query(sql);
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') continue;
      console.error(`Form builder: failed to ensure table "${name}":`, error.message);
      throw error;
    }
  }

  await ensureFormsTokenColumns();
}

/**
 * Ensures form-builder tables/columns exist (safe on empty DB, idempotent).
 * Cached per process so only the first request pays setup cost.
 */
export async function ensureFormBuilderSchema() {
  if (schemaReady) return;
  if (!schemaSetupPromise) {
    schemaSetupPromise = runSchemaSetup()
      .then(() => {
        schemaReady = true;
      })
      .catch((error) => {
        schemaSetupPromise = null;
        throw error;
      });
  }
  await schemaSetupPromise;
}
