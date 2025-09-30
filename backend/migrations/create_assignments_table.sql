-- Create assignments table and add assignment_id columns
-- Run this migration to add the assignments feature

-- 1. New assignments table
CREATE TABLE IF NOT EXISTS `assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidate_id` int NOT NULL,
  `job_id` int DEFAULT NULL,
  `assigned_by` int NOT NULL,
  `title` varchar(200) NOT NULL,
  `description_html` mediumtext,
  `status` enum('Draft','Assigned','In Progress','Submitted','Approved','Rejected','Cancelled') DEFAULT 'Draft',
  `due_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_job_id` (`job_id`),
  KEY `idx_assigned_by` (`assigned_by`),
  KEY `idx_status` (`status`),
  KEY `idx_due_date` (`due_date`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Link emails to assignments
ALTER TABLE `communications`
  ADD COLUMN `assignment_id` int DEFAULT NULL AFTER `candidate_id`,
  ADD KEY `idx_assignment_id` (`assignment_id`);

-- 3. Reuse file_uploads to store assignment attachments
ALTER TABLE `file_uploads`
  ADD COLUMN `assignment_id` int DEFAULT NULL AFTER `candidate_id`,
  ADD KEY `idx_assignment_id` (`assignment_id`);
