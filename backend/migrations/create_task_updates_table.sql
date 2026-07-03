-- ============================================================
-- EOD Task Update (Daily Work Update) System
-- Migration: create_task_updates_table.sql
-- Safe to re-run (uses CREATE TABLE IF NOT EXISTS)
-- Rollback: DROP TABLE IF EXISTS task_updates;
-- ============================================================

CREATE TABLE IF NOT EXISTS task_updates (
  id                INT           NOT NULL AUTO_INCREMENT,
  task_id           INT           NULL,                   -- references tasks.id (optional — general updates allowed)
  submitted_by      INT           NOT NULL,               -- FK → users.id
  submitted_by_role VARCHAR(50)   NOT NULL,               -- snapshot of role at submission time
  assigned_to       INT           NULL,                   -- FK → users.id (task owner / recruiter who assigned)
  task_title        VARCHAR(200)  NULL,                   -- snapshot of task title at submission time (NULL for general updates)
  work_summary      TEXT          NOT NULL,               -- required: overall summary
  today_progress    TEXT          NULL,                   -- what was done today
  blockers          TEXT          NULL,                   -- any blockers
  next_plan         TEXT          NULL,                   -- plan for tomorrow
  attachments       JSON          NULL,                   -- future-ready: [{name, url, type}]
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_task_id      (task_id),
  INDEX idx_submitted_by (submitted_by),
  INDEX idx_assigned_to  (assigned_to),
  INDEX idx_created_at   (created_at),
  INDEX idx_task_submitted (task_id, submitted_by, created_at),

  CONSTRAINT fk_tu_submitted_by FOREIGN KEY (submitted_by)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tu_assigned_to  FOREIGN KEY (assigned_to)
    REFERENCES users(id) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
