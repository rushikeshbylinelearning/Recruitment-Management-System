import { query } from '../config/database.js';

const sql = `CREATE TABLE IF NOT EXISTS in_app_notifications (
  id          INT(11)       NOT NULL AUTO_INCREMENT,
  user_id     INT(11)       NOT NULL,
  type        VARCHAR(50)   NOT NULL DEFAULT 'info',
  title       VARCHAR(255)  NOT NULL,
  message     TEXT          NOT NULL,
  link        VARCHAR(500)  NULL,
  is_read     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

try {
  await query(sql);
  console.log('✅ in_app_notifications table created (or already exists)');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
}
process.exit(0);
