import { query, testConnection, closePool } from '../config/database.js';

const TABLES = [
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: 'candidate_notes',
    sql: `CREATE TABLE IF NOT EXISTS candidate_notes (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      candidate_id VARCHAR(36) NOT NULL,
      author_id    INT NOT NULL,
      note_text    TEXT NOT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_candidate_id (candidate_id),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
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
      INDEX idx_user_id  (user_id),
      INDEX idx_is_read  (is_read),
      CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: 'push_subscriptions',
    sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_user_id (user_id),
      CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  }
];

async function recreateTables() {
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database.');
    process.exit(1);
  }

  console.log('🔧 Recreating tables...\n');

  for (const table of TABLES) {
    console.log(`Creating ${table.name}...`);
    try {
      await query(table.sql);
      console.log(`✅ ${table.name} created successfully`);
    } catch (err) {
      console.error(`❌ ${table.name} failed: ${err.message}`);
    }
  }

  console.log('\n✅ Verifying tables...\n');

  for (const table of TABLES) {
    try {
      const result = await query(`SELECT COUNT(*) as count FROM ${table.name}`);
      console.log(`✅ ${table.name}: Working (${result[0].count} rows)`);
    } catch (err) {
      console.error(`❌ ${table.name}: ${err.message}`);
    }
  }

  await closePool();
  process.exit(0);
}

recreateTables();
