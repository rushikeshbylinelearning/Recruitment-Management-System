CREATE TABLE candidate_assignment_files (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  candidate_assignment_id INT NOT NULL,
  stored_filename         VARCHAR(255) NOT NULL,
  original_filename       VARCHAR(255) NOT NULL,
  mime_type               VARCHAR(100) NOT NULL,
  file_size               INT NOT NULL,
  storage_path            VARCHAR(512) NOT NULL,
  uploaded_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_candidate_assignment_id (candidate_assignment_id),
  CONSTRAINT fk_caf_candidate_assignment
    FOREIGN KEY (candidate_assignment_id)
    REFERENCES candidate_assignments (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
