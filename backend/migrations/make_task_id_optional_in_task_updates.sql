-- ============================================================
-- Migration: make_task_id_optional_in_task_updates.sql
-- Purpose:   Allow EOD work updates to be submitted without
--            selecting a task (task_id and task_title become
--            optional / nullable).
-- Safe to re-run (ALTER COLUMN is idempotent when already NULL).
-- Rollback:
--   ALTER TABLE task_updates MODIFY task_id   INT NOT NULL;
--   ALTER TABLE task_updates MODIFY task_title VARCHAR(200) NOT NULL;
-- ============================================================

ALTER TABLE task_updates
  MODIFY COLUMN task_id    INT          NULL,
  MODIFY COLUMN task_title VARCHAR(200) NULL;
