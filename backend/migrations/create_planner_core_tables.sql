-- HR Planner Workspace: Core Tables Migration
-- Creates plans, plan_members, and buckets tables
-- Depends on: users table (existing)

-- ============================================================
-- Table: plans
-- ============================================================
CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `colour` VARCHAR(7) DEFAULT '#3B82F6',
  `icon` VARCHAR(50),
  `owner_id` INT UNSIGNED NOT NULL,
  `visibility` ENUM('private','shared','department','admin_only') DEFAULT 'private',
  `is_archived` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `status` ENUM('active','archived') DEFAULT 'active',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_plans_owner_id` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_plans_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  INDEX `idx_owner_id` (`owner_id`),
  INDEX `idx_is_deleted` (`is_deleted`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: plan_members
-- ============================================================
CREATE TABLE IF NOT EXISTS `plan_members` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plan_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `role` ENUM('viewer','editor','admin') DEFAULT 'editor',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_plan_members_plan_id` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`),
  CONSTRAINT `fk_plan_members_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  UNIQUE KEY `uq_plan_user` (`plan_id`, `user_id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- Table: buckets
-- ============================================================
CREATE TABLE IF NOT EXISTS `buckets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plan_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `colour` VARCHAR(7) DEFAULT '#6B7280',
  `icon` VARCHAR(50),
  `position` INT UNSIGNED DEFAULT 0,
  `collapsed` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `status` ENUM('active','archived') DEFAULT 'active',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_buckets_plan_id` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`),
  INDEX `idx_plan_id` (`plan_id`),
  INDEX `idx_position` (`plan_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
