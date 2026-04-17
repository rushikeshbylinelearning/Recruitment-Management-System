/**
 * Creates missing tables that cause 500 errors:
 *  - push_subscriptions  (needed by /api/notifications/subscribe)
 *  - candidate_notes     (needed by /api/candidate-notes)
 *  - in_app_notifications (needed by /api/notifications)
 *  - candidate_assignments + candidate_assignment_files (needed by /api/candidate-assignments)
 *
 * Safe to run multiple times — uses IF NOT EXISTS guards.
 */
import { query, testConnection, closePool } from '../config/database.js';

const migrations = [
  {
    name: 'in_app_notifications',
    sql: `CREATE TABLE IF NOT EXISTS in_app_notifications (
      id          INT           NOT NULL AUTO_INCREMENT,
      user_id     INT           NOT NULL,
      type        VARCHAR(50)   NOT NULL DEFAULT 'info',
      title       VARCHAR(255)  NOT NULL,
      message     TEXT          NOT NULL,
      link        VARCHAR(500)  NULL,
      is_read     TINYINT(1)    NOT NULL DEFAULT 0,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_user_id (user_id),
      INDEX idx_is_read (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: 'push_subscriptions',
    sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         INT           NOT NULL AUTO_INCREMENT,
      user_id    INT           NOT NULL,
      endpoint   VARCHAR(512)  NOT NULL UNIQUE,
      p256dh     VARCHAR(256)  NOT NULL,
      auth       VARCHAR(128)  NOT NULL,
      created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: 'candidate_notes',
    sql: `CREATE TABLE IF NOT EXISTS candidate_notes (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      candidate_id VARCHAR(36) NOT NULL,
      author_id    INT         NOT NULL,
      note_text    TEXT        NOT NULL,
      created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
      KEY idx_candidate_id (candidate_id),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: 'candidate_assignments',
    sql: `CREATE TABLE IF NOT EXISTS candidate_assignments (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      candidate_id        VARCHAR(36) NOT NULL,
      assignment_id       INT NOT NULL,
      assigned_by         INT NOT NULL,
      token               VARCHAR(64) NOT NULL UNIQUE,
      submission_link     VARCHAR(512) NOT NULL,
      status              ENUM('Assigned','Submitted','Overdue','Reviewed') DEFAULT 'Assigned',
      deadline            DATETIME NOT NULL,
      expiry_at           DATETIME NOT NULL,
      single_use          TINYINT(1) DEFAULT 1,
      auto_advance        TINYINT(1) DEFAULT 0,
      email_body          TEXT,
      custom_slug         VARCHAR(200),
      notify_deadline     TINYINT(1) DEFAULT 1,
      notify_expiry       TINYINT(1) DEFAULT 1,
      notify_submission   TINYINT(1) DEFAULT 1,
      deadline_notified   TINYINT(1) DEFAULT 0,
      expiry_notified     TINYINT(1) DEFAULT 0,
      submitted_at        DATETIME,
      submission_notes    TEXT,
      email_status        ENUM('Pending','Sent','Failed') DEFAULT 'Pending',
      email_attempts      INT DEFAULT 0,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_candidate_id (candidate_id),
      KEY idx_assignment_id (assignment_id),
      KEY idx_token (token),
      KEY idx_status (status),
      KEY idx_deadline (deadline),
      KEY idx_expiry_at (expiry_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: 'candidate_assignment_files',
    sql: `CREATE TABLE IF NOT EXISTS candidate_assignment_files (
      id                          INT AUTO_INCREMENT PRIMARY KEY,
      candidate_assignment_id     INT NOT NULL,
      stored_filename             VARCHAR(255) NOT NULL,
      original_filename           VARCHAR(255) NOT NULL,
      mime_type                   VARCHAR(100),
      file_size                   INT,
      storage_path                VARCHAR(512),
      uploaded_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_assignment_id (candidate_assignment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
];

async function run() {
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database.');
    process.exit(1);
  }

  for (const { name, sql } of migrations) {
    try {
      await query(sql);
      console.log(`✅ ${name} — OK`);
    } catch (err) {
      console.error(`❌ ${name} — ${err.message}`);
    }
  }

  console.log('\n🎉 Done.');
  await closePool();
  process.exit(0);
}

run();
