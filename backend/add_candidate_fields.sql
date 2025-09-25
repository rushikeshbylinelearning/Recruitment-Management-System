-- Add missing fields to candidates table
-- This migration adds the remaining fields needed for comprehensive candidate tracking

ALTER TABLE `candidates` 
ADD COLUMN `location` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Candidate current location',
ADD COLUMN `expertise` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Primary expertise/domain knowledge',
ADD COLUMN `willing_alternate_saturday` tinyint(1) DEFAULT NULL COMMENT 'Willing to work on alternate Saturdays',
ADD COLUMN `work_preference` enum('Onsite','WFH','Hybrid') COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Work preference: Onsite, WFH, or Hybrid',
ADD COLUMN `current_ctc` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Current CTC (monthly or annual)',
ADD COLUMN `ctc_frequency` enum('Monthly','Annual') COLLATE utf8mb4_general_ci DEFAULT 'Annual' COMMENT 'Whether CTC is monthly or annual',
ADD COLUMN `in_house_assignment_status` enum('Pending','Shortlisted','Rejected') COLLATE utf8mb4_general_ci DEFAULT 'Pending' COMMENT 'In-house assignment evaluation status',
ADD COLUMN `interview_date` date DEFAULT NULL COMMENT 'Scheduled interview date',
ADD COLUMN `interviewer_id` int DEFAULT NULL COMMENT 'Assigned interviewer user ID',
ADD COLUMN `in_office_assignment` text COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Details about in-office assignment';

-- Add indexes for the new fields
ALTER TABLE `candidates`
ADD KEY `idx_location` (`location`),
ADD KEY `idx_work_preference` (`work_preference`),
ADD KEY `idx_in_house_assignment_status` (`in_house_assignment_status`),
ADD KEY `idx_interview_date` (`interview_date`),
ADD KEY `idx_interviewer_id` (`interviewer_id`);

-- Add foreign key constraint for interviewer (optional, can be removed if not needed)
-- ALTER TABLE `candidates` ADD CONSTRAINT `fk_candidates_interviewer` FOREIGN KEY (`interviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- Add comments to existing fields for clarity
ALTER TABLE `candidates` 
MODIFY COLUMN `notes` text COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'HR remarks and notes about the candidate',
MODIFY COLUMN `experience` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Years of experience',
MODIFY COLUMN `notice_period` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Notice period duration',
MODIFY COLUMN `salary_expected` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Expected CTC/package';
