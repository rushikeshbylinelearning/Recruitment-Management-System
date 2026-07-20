-- Daily recurrence, due time of day, and stopwatch timer fields for planner_tasks

ALTER TABLE `planner_tasks`
  ADD COLUMN `recurrence_type` ENUM('none','daily') NOT NULL DEFAULT 'none' AFTER `estimated_time`,
  ADD COLUMN `last_completed_at` DATETIME NULL AFTER `recurrence_type`,
  ADD COLUMN `due_time` TIME NULL AFTER `last_completed_at`,
  ADD COLUMN `timer_elapsed_seconds` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `due_time`,
  ADD COLUMN `timer_started_at` DATETIME NULL AFTER `timer_elapsed_seconds`,
  ADD INDEX `idx_daily_reset` (`recurrence_type`, `status`, `last_completed_at`);
