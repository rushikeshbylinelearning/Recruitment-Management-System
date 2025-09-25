-- Add assignment and resume location fields to candidates table
-- This migration adds fields to store file paths/URLs for assignments and resumes

ALTER TABLE `candidates` 
ADD COLUMN `assignment_location` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'File path or URL to the assignment file',
ADD COLUMN `resume_location` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'File path or URL to the resume file';

-- Add indexes for the new fields
ALTER TABLE `candidates`
ADD KEY `idx_assignment_location` (`assignment_location`),
ADD KEY `idx_resume_location` (`resume_location`);

-- Add comments to clarify the purpose
ALTER TABLE `candidates` 
MODIFY COLUMN `in_office_assignment` text COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Details/description about in-office assignment',
MODIFY COLUMN `assignment_location` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'File path or URL to the assignment file',
MODIFY COLUMN `resume_location` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'File path or URL to the resume file';
