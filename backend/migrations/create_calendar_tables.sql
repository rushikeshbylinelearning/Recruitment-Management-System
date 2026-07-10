-- Calendar 2.0 Migration
-- Visualization layer for Planner tasks, notes, meetings, and events.
-- Planner tasks are NEVER duplicated here — only referenced via planner_task_id = NULL
-- and aggregated virtually at query time from planner_tasks.due_date.
--
-- NOTE ON TYPES:
--   - Calendar table own PKs use INT UNSIGNED AUTO_INCREMENT.
--   - FK columns referencing users.id use INT (signed) to match users.id int(11).
--   - FK columns referencing other calendar tables use INT UNSIGNED to match those PKs.

-- ============================================================
-- Table: calendar_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS `calendar_categories` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`           VARCHAR(50)  NOT NULL,
  `name`           VARCHAR(100) NOT NULL,
  `bg_colour`      VARCHAR(7)   NOT NULL DEFAULT '#3B82F6',
  `border_colour`  VARCHAR(7)   NOT NULL DEFAULT '#2563EB',
  `dot_colour`     VARCHAR(7)   NOT NULL DEFAULT '#3B82F6',
  `hover_colour`   VARCHAR(7)   NOT NULL DEFAULT '#60A5FA',
  `is_system`      TINYINT(1)   DEFAULT 1,
  `user_id`        INT          DEFAULT NULL,          -- FK → users.id (signed INT)
  `created_at`     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_category_slug_user` (`slug`, `user_id`),
  CONSTRAINT `fk_calendar_categories_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_cat_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: calendar_recurrence
-- (No FK to users — no type issue here)
-- ============================================================
CREATE TABLE IF NOT EXISTS `calendar_recurrence` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `frequency`        ENUM('daily','weekly','monthly','yearly','custom') NOT NULL,
  `interval_value`   INT UNSIGNED DEFAULT 1,
  `days_of_week`     VARCHAR(20)  DEFAULT NULL,
  `day_of_month`     TINYINT UNSIGNED DEFAULT NULL,
  `month_of_year`    TINYINT UNSIGNED DEFAULT NULL,
  `end_date`         DATE         DEFAULT NULL,
  `occurrence_count` INT UNSIGNED DEFAULT NULL,
  `custom_rule`      JSON         DEFAULT NULL,
  `created_at`       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: calendar_reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS `calendar_reminders` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT          NOT NULL,               -- FK → users.id (signed INT)
  `reminder_type` ENUM('5min','10min','15min','30min','1hour','2hours','tomorrow','next_week','custom')
                  NOT NULL DEFAULT '15min',
  `remind_at`     DATETIME     NOT NULL,
  `is_sent`       TINYINT(1)   DEFAULT 0,
  `sent_at`       DATETIME     DEFAULT NULL,
  `created_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_calendar_reminders_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  INDEX `idx_rem_remind_at` (`remind_at`),
  INDEX `idx_rem_user_id`   (`user_id`),
  INDEX `idx_rem_is_sent`   (`is_sent`, `remind_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: calendar_events
-- Meetings, custom events, deadlines, reminders, follow-ups, etc.
-- Does NOT store planner tasks — those are virtual from planner_tasks.
-- ============================================================
CREATE TABLE IF NOT EXISTS `calendar_events` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT          NOT NULL,               -- FK → users.id (signed INT)
  `category_id`   INT UNSIGNED NOT NULL,               -- FK → calendar_categories.id (UNSIGNED)
  `title`         VARCHAR(255) NOT NULL,
  `description`   TEXT,
  `event_date`    DATE         NOT NULL,
  `start_time`    TIME         DEFAULT NULL,
  `end_time`      TIME         DEFAULT NULL,
  `all_day`       TINYINT(1)   DEFAULT 0,
  `location`      VARCHAR(500) DEFAULT NULL,
  `colour`        VARCHAR(7)   DEFAULT NULL,
  `status`        ENUM('pending','completed','cancelled') DEFAULT 'pending',
  `priority`      ENUM('low','medium','high')           DEFAULT 'medium',
  `recurrence_id` INT UNSIGNED DEFAULT NULL,           -- FK → calendar_recurrence.id (UNSIGNED)
  `reminder_id`   INT UNSIGNED DEFAULT NULL,           -- FK → calendar_reminders.id (UNSIGNED)
  `created_by`    INT          NOT NULL,               -- FK → users.id (signed INT)
  `updated_by`    INT          DEFAULT NULL,           -- FK → users.id (signed INT)
  `created_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted`    TINYINT(1)   DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_calendar_events_user`
    FOREIGN KEY (`user_id`)       REFERENCES `users` (`id`),
  CONSTRAINT `fk_calendar_events_category`
    FOREIGN KEY (`category_id`)   REFERENCES `calendar_categories` (`id`),
  CONSTRAINT `fk_calendar_events_recurrence`
    FOREIGN KEY (`recurrence_id`) REFERENCES `calendar_recurrence` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_events_reminder`
    FOREIGN KEY (`reminder_id`)   REFERENCES `calendar_reminders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_events_created_by`
    FOREIGN KEY (`created_by`)    REFERENCES `users` (`id`),
  INDEX `idx_evt_event_date`  (`event_date`),
  INDEX `idx_evt_start_time`  (`start_time`),
  INDEX `idx_evt_user_id`     (`user_id`),
  INDEX `idx_evt_category_id` (`category_id`),
  INDEX `idx_evt_status`      (`status`),
  INDEX `idx_evt_is_deleted`  (`is_deleted`),
  INDEX `idx_evt_user_date`   (`user_id`, `event_date`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: calendar_notes
-- Lightweight calendar notes (Microsoft Calendar inspired)
-- ============================================================
CREATE TABLE IF NOT EXISTS `calendar_notes` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      INT          NOT NULL,                -- FK → users.id (signed INT)
  `title`        VARCHAR(255) NOT NULL,
  `note_content` LONGTEXT,
  `note_date`    DATE         NOT NULL,
  `start_time`   TIME         DEFAULT NULL,
  `colour`       VARCHAR(7)   DEFAULT '#8B5CF6',
  `is_pinned`    TINYINT(1)   DEFAULT 0,
  `reminder_id`  INT UNSIGNED DEFAULT NULL,            -- FK → calendar_reminders.id (UNSIGNED)
  `created_by`   INT          NOT NULL,                -- FK → users.id (signed INT)
  `updated_by`   INT          DEFAULT NULL,            -- FK → users.id (signed INT)
  `created_at`   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted`   TINYINT(1)   DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_calendar_notes_user`
    FOREIGN KEY (`user_id`)      REFERENCES `users` (`id`),
  CONSTRAINT `fk_calendar_notes_reminder`
    FOREIGN KEY (`reminder_id`)  REFERENCES `calendar_reminders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_notes_created_by`
    FOREIGN KEY (`created_by`)   REFERENCES `users` (`id`),
  INDEX `idx_note_note_date`  (`note_date`),
  INDEX `idx_note_user_id`    (`user_id`),
  INDEX `idx_note_is_pinned`  (`is_pinned`),
  INDEX `idx_note_is_deleted` (`is_deleted`),
  INDEX `idx_note_user_date`  (`user_id`, `note_date`, `is_deleted`),
  FULLTEXT INDEX `idx_ft_note_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: calendar_attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS `calendar_attachments` (
  `id`                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `entity_type`       ENUM('event','note') NOT NULL,
  `entity_id`         INT UNSIGNED  NOT NULL,
  `original_filename` VARCHAR(255)  NOT NULL,
  `stored_filename`   VARCHAR(255)  NOT NULL,
  `file_size`         BIGINT UNSIGNED NOT NULL,
  `mime_type`         VARCHAR(100)  NOT NULL,
  `file_path`         VARCHAR(500)  NOT NULL,
  `uploaded_by`       INT           NOT NULL,           -- FK → users.id (signed INT)
  `uploaded_at`       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  `is_deleted`        TINYINT(1)    DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_calendar_attachments_uploaded_by`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  INDEX `idx_att_entity`     (`entity_type`, `entity_id`),
  INDEX `idx_att_is_deleted` (`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: calendar_audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `calendar_audit_logs` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`        INT          NOT NULL,               -- FK → users.id (signed INT)
  `entity_type`    ENUM('event','note','task_move') NOT NULL,
  `entity_id`      INT UNSIGNED DEFAULT NULL,
  `action_type`    VARCHAR(50)  NOT NULL,
  `action_details` JSON         DEFAULT NULL,
  `created_at`     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_calendar_audit_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  INDEX `idx_aud_user_id`   (`user_id`),
  INDEX `idx_aud_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Seed: System calendar categories with default colours
-- ============================================================
INSERT IGNORE INTO `calendar_categories`
  (`slug`, `name`, `bg_colour`, `border_colour`, `dot_colour`, `hover_colour`, `is_system`, `user_id`)
VALUES
  ('planner_task', 'Planner Task',  '#3B82F6', '#2563EB', '#3B82F6', '#60A5FA', 1, NULL),
  ('note',         'Note',          '#8B5CF6', '#7C3AED', '#8B5CF6', '#A78BFA', 1, NULL),
  ('meeting',      'Meeting',       '#10B981', '#059669', '#10B981', '#34D399', 1, NULL),
  ('deadline',     'Deadline',      '#EF4444', '#DC2626', '#EF4444', '#F87171', 1, NULL),
  ('reminder',     'Reminder',      '#F97316', '#EA580C', '#F97316', '#FB923C', 1, NULL),
  ('follow_up',    'Follow-up',     '#EAB308', '#CA8A04', '#EAB308', '#FACC15', 1, NULL),
  ('interview',    'Interview',     '#06B6D4', '#0891B2', '#06B6D4', '#22D3EE', 1, NULL),
  ('holiday',      'Holiday',       '#6366F1', '#4F46E5', '#6366F1', '#818CF8', 1, NULL),
  ('leave',        'Leave',         '#EC4899', '#DB2777', '#EC4899', '#F472B6', 1, NULL),
  ('birthday',     'Birthday',      '#F472B6', '#EC4899', '#F472B6', '#F9A8D4', 1, NULL),
  ('custom',       'Custom Event',  '#64748B', '#475569', '#64748B', '#94A3B8', 1, NULL);
