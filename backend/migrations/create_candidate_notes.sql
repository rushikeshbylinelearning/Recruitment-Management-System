CREATE TABLE IF NOT EXISTS candidate_notes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id VARCHAR(36) NOT NULL,
  author_id    INT NOT NULL,
  note_text    TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_candidate_id (candidate_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
