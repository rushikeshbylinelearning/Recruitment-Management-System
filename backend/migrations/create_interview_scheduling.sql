-- Interview Scheduling Migration
-- Creates interviews and push_subscriptions tables

CREATE TABLE IF NOT EXISTS interviews (
  id              INT           NOT NULL AUTO_INCREMENT,
  candidate_id    INT           NOT NULL,
  job_role        VARCHAR(255)  NOT NULL,
  interviewer_id  INT           NOT NULL,
  date            DATE          NOT NULL,
  time            TIME          NOT NULL,
  duration        INT           NOT NULL COMMENT 'minutes',
  type            ENUM('HR Round','Technical','Final') NOT NULL,
  mode            ENUM('Virtual','In-Person')          NOT NULL,
  meeting_link    TEXT          NULL,
  location        VARCHAR(255)  NULL,
  status          ENUM('Scheduled','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
  notes           TEXT          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_candidate_id  (candidate_id),
  INDEX idx_interviewer_id (interviewer_id),
  INDEX idx_date          (date),
  INDEX idx_status        (status),
  CONSTRAINT fk_interview_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  CONSTRAINT fk_interview_interviewer FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INT           NOT NULL AUTO_INCREMENT,
  user_id     INT           NOT NULL,
  endpoint    TEXT          NOT NULL,
  p256dh      TEXT          NOT NULL,
  auth        TEXT          NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
