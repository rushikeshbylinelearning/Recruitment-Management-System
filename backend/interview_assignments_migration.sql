-- Create interview_assignments table
CREATE TABLE IF NOT EXISTS `interview_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidate_id` int NOT NULL,
  `assigned_to` int NOT NULL,
  `interview_type` enum('Technical','HR','Managerial','Final','Screening') NOT NULL,
  `scheduled_date` datetime DEFAULT NULL,
  `duration` int DEFAULT 60 COMMENT 'Duration in minutes',
  `location` varchar(255) DEFAULT NULL,
  `meeting_link` varchar(500) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `priority` enum('Low','Medium','High','Urgent') DEFAULT 'Medium',
  `status` enum('Scheduled','In Progress','Completed','Cancelled','Rescheduled') DEFAULT 'Scheduled',
  `created_by` int NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_scheduled_date` (`scheduled_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_interview_assignments_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_interview_assignments_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_interview_assignments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Interview assignments for candidates';

-- Add indexes for better performance
CREATE INDEX `idx_interview_assignments_composite` ON `interview_assignments` (`candidate_id`, `assigned_to`, `status`);
CREATE INDEX `idx_interview_assignments_date_status` ON `interview_assignments` (`scheduled_date`, `status`);

-- Insert some sample data (optional)
INSERT INTO `interview_assignments` (`candidate_id`, `assigned_to`, `interview_type`, `scheduled_date`, `duration`, `location`, `notes`, `priority`, `status`, `created_by`) VALUES
(1, 6, 'Technical', '2024-02-01 10:00:00', 60, 'Conference Room A', 'Technical interview for React skills', 'High', 'Scheduled', 1),
(2, 7, 'HR', '2024-02-02 14:00:00', 45, 'HR Office', 'HR interview for cultural fit', 'Medium', 'Scheduled', 2),
(3, 8, 'Managerial', '2024-02-03 11:00:00', 90, 'Manager Office', 'Managerial interview for leadership skills', 'High', 'Scheduled', 1);
