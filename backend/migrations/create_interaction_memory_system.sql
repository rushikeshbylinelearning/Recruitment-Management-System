-- ============================================================
-- Candidate Interaction Memory + Snapshot + Kanban System
-- ============================================================

-- 1. interaction_candidates: phone-unique candidate contact book
CREATE TABLE IF NOT EXISTS interaction_candidates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(30)  NOT NULL UNIQUE,
  email         VARCHAR(255) NULL,
  source        ENUM('Indeed','Naukri','Monster','Manual','Referral') DEFAULT 'Manual',
  created_by    INT          NOT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. interaction_notes: per-candidate interaction log
CREATE TABLE IF NOT EXISTS interaction_notes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id    INT          NOT NULL,
  note            TEXT         NOT NULL,
  status          ENUM('Not Interested','Interested','Follow-up','No Response','Wrong Number') DEFAULT 'No Response',
  priority        TINYINT      DEFAULT 3 COMMENT '1-5 stars',
  follow_up_date  DATE         NULL,
  created_by      INT          NOT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_candidate (candidate_id),
  INDEX idx_created_by (created_by),
  INDEX idx_follow_up (follow_up_date),
  FOREIGN KEY (candidate_id) REFERENCES interaction_candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. interaction_pipeline: maps interaction_candidates to Kanban stages
CREATE TABLE IF NOT EXISTS interaction_pipeline (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT         NOT NULL UNIQUE,
  stage        ENUM('Contacted','Interested','Applied','Interview','Selected','Rejected') DEFAULT 'Contacted',
  updated_by   INT         NOT NULL,
  updated_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stage (stage),
  FOREIGN KEY (candidate_id) REFERENCES interaction_candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. daily_snapshots: per-user daily activity counters
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT  NOT NULL,
  snap_date     DATE NOT NULL,
  total_calls   INT  DEFAULT 0,
  interested    INT  DEFAULT 0,
  no_response   INT  DEFAULT 0,
  follow_ups    INT  DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_date (user_id, snap_date),
  INDEX idx_user (user_id),
  INDEX idx_date (snap_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
