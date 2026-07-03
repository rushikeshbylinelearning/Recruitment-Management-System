/**
 * One-time migration: creates task_updates table.
 * Run with: node run-migration-task-updates.js
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS.
 */
import { query } from './config/database.js';

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS task_updates (
  id                INT           NOT NULL AUTO_INCREMENT,
  task_id           INT           NOT NULL,
  submitted_by      INT           NOT NULL,
  submitted_by_role VARCHAR(50)   NOT NULL,
  assigned_to       INT           NULL,
  task_title        VARCHAR(200)  NOT NULL,
  work_summary      TEXT          NOT NULL,
  today_progress    TEXT          NULL,
  blockers          TEXT          NULL,
  next_plan         TEXT          NULL,
  attachments       JSON          NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_task_id        (task_id),
  INDEX idx_submitted_by   (submitted_by),
  INDEX idx_assigned_to    (assigned_to),
  INDEX idx_created_at     (created_at),
  INDEX idx_task_submitted (task_id, submitted_by, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

try {
  await query(CREATE_SQL);
  console.log('✅  task_updates table created (or already exists).');
  process.exit(0);
} catch (err) {
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
}
