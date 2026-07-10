-- HR Planner Workspace: Task & Related Tables Migration
-- Creates planner_tasks, labels, task_labels, task_checklists, task_notes,
-- task_attachments, task_comments, task_activity_logs, notifications tables
-- Depends on: users table (existing), buckets table (create_planner_core_tables.sql)

-- ============================================================
-- Table: planner_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS `planner_tasks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bucket_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `priority` ENUM('low','medium','high') DEFAULT 'medium',
  `assigned_to` INT UNSIGNED,
  `assigned_by` INT UNSIGNED,
  `due_date` DATE,
  `reminder_date` DATETIME,
  `status` ENUM('pending','in_progress','completed') DEFAULT 'pending',
  `estimated_time` VARCHAR(50),
  `completion_percentage` TINYINT UNSIGNED DEFAULT 0,
  `position` INT UNSIGNED DEFAULT 0,
  -- job_id references the job postings table; FK constraint omitted as the table
  -- name may differ across environments — column is kept for relational tracking
  `job_id` INT UNSIGNED,
  `candidate_id` INT UNSIGNED,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED,
  `is_deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_planner_tasks_bucket_id` FOREIGN KEY (`bucket_id`) REFERENCES `buckets` (`id`),
  CONSTRAINT `fk_planner_tasks_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_planner_tasks_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_planner_tasks_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  INDEX `idx_bucket_id` (`bucket_id`),
  INDEX `idx_assigned_to` (`assigned_to`),
  INDEX `idx_status` (`status`),
  INDEX `idx_priority` (`priority`),
  INDEX `idx_due_date` (`due_date`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_is_deleted` (`is_deleted`),
  FULLTEXT INDEX `idx_ft_title_desc` (`title`, `description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: labels
-- ============================================================
CREATE TABLE IF NOT EXISTS `labels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `colour` VARCHAR(7) NOT NULL,
  `icon` VARCHAR(50),
  `category` ENUM('urgent','recruitment','interview','documentation','training','payroll','personal','reports','admin','custom') DEFAULT 'custom',
  `is_system` TINYINT(1) DEFAULT 0,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_labels_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: task_labels
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_labels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` INT UNSIGNED NOT NULL,
  `label_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_task_labels_task_id` FOREIGN KEY (`task_id`) REFERENCES `planner_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_labels_label_id` FOREIGN KEY (`label_id`) REFERENCES `labels` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uq_task_label` (`task_id`, `label_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: task_checklists
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_checklists` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` INT UNSIGNED NOT NULL,
  `item_text` VARCHAR(500) NOT NULL,
  `is_checked` TINYINT(1) DEFAULT 0,
  `position` INT UNSIGNED DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_task_checklists_task_id` FOREIGN KEY (`task_id`) REFERENCES `planner_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_checklists_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  INDEX `idx_task_id` (`task_id`),
  INDEX `idx_position` (`task_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: task_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_notes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` INT UNSIGNED NOT NULL,
  `note_content` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_notes_task_id` (`task_id`),
  CONSTRAINT `fk_task_notes_task_id` FOREIGN KEY (`task_id`) REFERENCES `planner_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_notes_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: task_attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_attachments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` INT UNSIGNED NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `file_size` BIGINT UNSIGNED NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `uploaded_by` INT UNSIGNED NOT NULL,
  `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_task_attachments_task_id` FOREIGN KEY (`task_id`) REFERENCES `planner_tasks` (`id`),
  CONSTRAINT `fk_task_attachments_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  INDEX `idx_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: task_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_comments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `comment_text` TEXT NOT NULL,
  `parent_comment_id` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_task_comments_task_id` FOREIGN KEY (`task_id`) REFERENCES `planner_tasks` (`id`),
  CONSTRAINT `fk_task_comments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_task_comments_parent_id` FOREIGN KEY (`parent_comment_id`) REFERENCES `task_comments` (`id`),
  INDEX `idx_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: task_activity_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_activity_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `action_type` ENUM(
    'task_created',
    'task_edited',
    'task_moved',
    'priority_changed',
    'task_assigned',
    'task_completed',
    'checklist_updated',
    'file_uploaded',
    'file_deleted',
    'comment_added',
    'label_changed',
    'status_changed',
    'bucket_moved',
    'task_deleted',
    'task_restored'
  ) NOT NULL,
  `action_details` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_task_activity_logs_task_id` FOREIGN KEY (`task_id`) REFERENCES `planner_tasks` (`id`),
  CONSTRAINT `fk_task_activity_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  INDEX `idx_task_id` (`task_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `type` ENUM('task_assigned','task_completed','comment_added','task_overdue','mentioned','reminder') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT,
  `task_id` INT UNSIGNED,
  `is_read` TINYINT(1) DEFAULT 0,
  `email_sent` TINYINT(1) DEFAULT 0,
  `email_sent_at` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_notifications_task_id` FOREIGN KEY (`task_id`) REFERENCES `planner_tasks` (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_is_read` (`user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Seed: 10 predefined system labels
-- created_by uses the first user as a placeholder; update if needed
-- ============================================================
INSERT IGNORE INTO `labels` (`name`, `colour`, `category`, `is_system`, `created_by`) VALUES
  ('Urgent',        '#EF4444', 'urgent',        1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Recruitment',   '#3B82F6', 'recruitment',   1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Interview',     '#8B5CF6', 'interview',     1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Documentation', '#F59E0B', 'documentation', 1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Training',      '#10B981', 'training',      1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Payroll',       '#EC4899', 'payroll',       1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Personal',      '#6B7280', 'personal',      1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Reports',       '#0EA5E9', 'reports',       1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Admin',         '#F97316', 'admin',         1, (SELECT `id` FROM `users` LIMIT 1)),
  ('Custom',        '#64748B', 'custom',        1, (SELECT `id` FROM `users` LIMIT 1));
