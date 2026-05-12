/**
 * Migration: Create Import System Tables
 *
 * Creates the three tables required by the Intelligent Candidate Import feature:
 *   - import_logs          (tracks import history)
 *   - import_failed_rows   (stores per-row failure details)
 *   - field_mappings       (saves user column-mapping preferences)
 *
 * Safe to run multiple times — all statements use CREATE TABLE IF NOT EXISTS.
 */

import { query, testConnection, closePool } from '../config/database.js';

const migrations = [
  {
    name: 'import_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS import_logs (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        user_id         INT          NOT NULL,
        filename        VARCHAR(255) NOT NULL,
        total_rows      INT          NOT NULL,
        success_count   INT          NOT NULL,
        failure_count   INT          NOT NULL,
        processing_time INT          NULL COMMENT 'Processing time in milliseconds',
        uploaded_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

        INDEX idx_user_id      (user_id),
        INDEX idx_uploaded_at  (uploaded_at),
        INDEX idx_user_uploaded (user_id, uploaded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        COMMENT='Tracks candidate import history and statistics'
    `
  },
  {
    name: 'import_failed_rows',
    sql: `
      CREATE TABLE IF NOT EXISTS import_failed_rows (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        import_log_id INT          NOT NULL,
        row_number    INT          NOT NULL,
        candidate_name VARCHAR(255) NULL,
        error_message TEXT         NOT NULL,
        row_data      JSON         NOT NULL COMMENT 'Original row data as JSON',

        FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE,
        INDEX idx_import_log_id (import_log_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        COMMENT='Stores failed candidate import rows with error details'
    `
  },
  {
    name: 'field_mappings',
    sql: `
      CREATE TABLE IF NOT EXISTS field_mappings (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT          NOT NULL,
        mapping_name VARCHAR(255) NULL    COMMENT 'Optional name for the mapping set',
        source_column VARCHAR(255) NOT NULL COMMENT 'Column name from uploaded file',
        target_field  VARCHAR(255) NOT NULL COMMENT 'System field name',
        created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        last_used    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_user_id (user_id),
        UNIQUE KEY unique_user_mapping (user_id, source_column, target_field)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        COMMENT='Stores user field mapping preferences for candidate imports'
    `
  }
];

async function runMigrations() {
  console.log('🔄 Running import system table migrations...\n');

  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Check your .env settings.');
    process.exit(1);
  }

  let allPassed = true;

  for (const migration of migrations) {
    try {
      await query(migration.sql);
      console.log(`✅ Table ready: ${migration.name}`);
    } catch (err) {
      console.error(`❌ Failed to create table "${migration.name}": ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + (allPassed ? '🎉 All import tables are ready.' : '⚠️  Some migrations failed — check errors above.'));

  await closePool();
  process.exit(allPassed ? 0 : 1);
}

runMigrations();
