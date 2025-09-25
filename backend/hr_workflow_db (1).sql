-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Sep 25, 2025 at 11:18 AM
-- Server version: 9.1.0
-- PHP Version: 8.1.31

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hr_workflow_db`
--

DELIMITER $$
--
-- Procedures
--
DROP PROCEDURE IF EXISTS `CleanupOrphanedFiles`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `CleanupOrphanedFiles` ()   BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE file_id INT;
    DECLARE file_path VARCHAR(500);
    
    DECLARE orphan_cursor CURSOR FOR
        SELECT id, file_path 
        FROM file_uploads 
        WHERE candidate_id IS NULL 
        AND uploaded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN orphan_cursor;
    
    read_loop: LOOP
        FETCH orphan_cursor INTO file_id, file_path;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Delete file from disk (this would need to be handled by application)
        -- DELETE FROM file_uploads WHERE id = file_id;
        
    END LOOP;
    
    CLOSE orphan_cursor;
END$$

--
-- Functions
--
DROP FUNCTION IF EXISTS `FormatFileSize`$$
CREATE DEFINER=`root`@`localhost` FUNCTION `FormatFileSize` (`bytes` INT) RETURNS VARCHAR(20) CHARSET utf8mb4 COLLATE utf8mb4_general_ci DETERMINISTIC READS SQL DATA BEGIN
    DECLARE size VARCHAR(20);
    
    IF bytes < 1024 THEN
        SET size = CONCAT(bytes, ' B');
    ELSEIF bytes < 1024 * 1024 THEN
        SET size = CONCAT(ROUND(bytes / 1024, 1), ' KB');
    ELSEIF bytes < 1024 * 1024 * 1024 THEN
        SET size = CONCAT(ROUND(bytes / (1024 * 1024), 1), ' MB');
    ELSE
        SET size = CONCAT(ROUND(bytes / (1024 * 1024 * 1024), 1), ' GB');
    END IF;
    
    RETURN size;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `analytics_cache`
--

DROP TABLE IF EXISTS `analytics_cache`;
CREATE TABLE IF NOT EXISTS `analytics_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `metric_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `metric_data` json NOT NULL,
  `calculated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_metric` (`metric_name`),
  KEY `idx_metric_name` (`metric_name`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `candidates`
--

DROP TABLE IF EXISTS `candidates`;
CREATE TABLE IF NOT EXISTS `candidates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `position` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `stage` enum('Applied','Screening','Interview','Offer','Hired','Rejected') COLLATE utf8mb4_general_ci DEFAULT 'Applied',
  `source` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `applied_date` date NOT NULL,
  `resume_path` text COLLATE utf8mb4_general_ci,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'HR remarks and notes about the candidate',
  `score` decimal(3,2) DEFAULT '0.00',
  `assigned_to` int DEFAULT NULL,
  `skills` json DEFAULT NULL,
  `experience` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Years of experience',
  `salary_expected` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Expected CTC/package',
  `salary_offered` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `salary_negotiable` tinyint(1) DEFAULT '1',
  `joining_time` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notice_period` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Notice period duration',
  `immediate_joiner` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resume_file_id` int DEFAULT NULL,
  `location` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Candidate current location',
  `expertise` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Primary expertise/domain knowledge',
  `willing_alternate_saturday` tinyint(1) DEFAULT NULL COMMENT 'Willing to work on alternate Saturdays',
  `work_preference` enum('Onsite','WFH','Hybrid') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Work preference: Onsite, WFH, or Hybrid',
  `current_ctc` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Current CTC (monthly or annual)',
  `ctc_frequency` enum('Monthly','Annual') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Annual' COMMENT 'Whether CTC is monthly or annual',
  `in_house_assignment_status` enum('Pending','Shortlisted','Rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Pending' COMMENT 'In-house assignment evaluation status',
  `interview_date` date DEFAULT NULL COMMENT 'Scheduled interview date',
  `interviewer_id` int DEFAULT NULL COMMENT 'Assigned interviewer user ID',
  `in_office_assignment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Details/description about in-office assignment',
  `assignment_location` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'File path or URL to the assignment file',
  `resume_location` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'File path or URL to the resume file',
  PRIMARY KEY (`id`),
  KEY `idx_stage` (`stage`),
  KEY `idx_source` (`source`),
  KEY `idx_applied_date` (`applied_date`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_email` (`email`),
  KEY `idx_score` (`score`),
  KEY `idx_candidates_stage_assigned` (`stage`,`assigned_to`),
  KEY `idx_resume_file_id` (`resume_file_id`),
  KEY `idx_job_id` (`job_id`),
  KEY `idx_location` (`location`),
  KEY `idx_work_preference` (`work_preference`),
  KEY `idx_in_house_assignment_status` (`in_house_assignment_status`),
  KEY `idx_interview_date` (`interview_date`),
  KEY `idx_interviewer_id` (`interviewer_id`),
  KEY `idx_assignment_location` (`assignment_location`(250)),
  KEY `idx_resume_location` (`resume_location`(250))
) ENGINE=MyISAM AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Candidate information with optional resume file reference';

--
-- Dumping data for table `candidates`
--

INSERT INTO `candidates` (`id`, `job_id`, `name`, `email`, `phone`, `position`, `stage`, `source`, `applied_date`, `resume_path`, `notes`, `score`, `assigned_to`, `skills`, `experience`, `salary_expected`, `salary_offered`, `salary_negotiable`, `joining_time`, `notice_period`, `immediate_joiner`, `created_at`, `updated_at`, `resume_file_id`, `location`, `expertise`, `willing_alternate_saturday`, `work_preference`, `current_ctc`, `ctc_frequency`, `in_house_assignment_status`, `interview_date`, `interviewer_id`, `in_office_assignment`, `assignment_location`, `resume_location`) VALUES
(4, 1, 'New Candidate', 'new@candidate.com', '678789543', 'Senior Full Stack Developer', 'Offer', 'AngelList', '2025-09-24', NULL, 'New Notes', 0.00, NULL, '[\"React\", \"Tailwind CSS\", \"JS\"]', '5', '12LPA', '9LPA', 1, '3 Weeks', '1 Month', 1, '2025-09-24 14:35:13', '2025-09-24 14:35:13', 7, NULL, NULL, NULL, NULL, NULL, 'Annual', 'Pending', NULL, NULL, NULL, NULL, NULL),
(2, 1, 'Basic Candidate', 'candidate@gmail.com', '97676897762', 'Senior Full Stack Developer', 'Screening', 'Indeed', '2025-09-18', NULL, 'Good in Frontend Lacks the Backend', 0.00, NULL, '[]', '3', '5LPA', '4LPA', 1, '2 Weeks', '1 Week', 1, '2025-09-24 13:08:31', '2025-09-25 09:23:28', 3164, 'Pune', 'JavaScript', 1, 'Onsite', '3.50LPA', 'Annual', 'Shortlisted', '2025-09-21', NULL, 'Some Details About the in Office assignment', NULL, NULL),
(5, 1, 'Test Candidate', 'test@candidate.com', '896703281', 'Senior Full Stack Developer', 'Interview', 'Company Website', '2025-09-25', NULL, 'Notes about the assignment did this well and that welll', 0.00, NULL, '[\"React\", \"Tailwind\"]', '3 Years', '6LPA', NULL, 0, '1 Week', '1 Month', 1, '2025-09-25 09:30:52', '2025-09-25 09:30:52', NULL, 'Baner, Pune', 'Full Stack Developer', NULL, 'Onsite', '4.8LPA', 'Annual', 'Shortlisted', '2025-09-27', NULL, 'Details about the interview the interview;s details', 'C:\\wamp64\\www\\Kodeit-Iomad-local\\iomad-test\\', 'C:\\wamp64\\www\\Kodeit-Iomad-local\\resume.pdf');

-- --------------------------------------------------------

--
-- Stand-in structure for view `candidate_files`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `candidate_files`;
CREATE TABLE IF NOT EXISTS `candidate_files` (
`candidate_email` varchar(100)
,`candidate_id` int
,`candidate_name` varchar(100)
,`file_id` int
,`file_size` int
,`filename` varchar(255)
,`mime_type` varchar(100)
,`original_name` varchar(255)
,`uploaded_at` timestamp
,`uploaded_by_name` varchar(100)
);

-- --------------------------------------------------------

--
-- Table structure for table `communications`
--

DROP TABLE IF EXISTS `communications`;
CREATE TABLE IF NOT EXISTS `communications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidate_id` int NOT NULL,
  `type` enum('Email','Phone','WhatsApp','LinkedIn') COLLATE utf8mb4_general_ci NOT NULL,
  `date` timestamp NOT NULL,
  `content` text COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('Sent','Received','Pending') COLLATE utf8mb4_general_ci DEFAULT 'Pending',
  `follow_up` text COLLATE utf8mb4_general_ci,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_type` (`type`),
  KEY `idx_date` (`date`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_communications_candidate_date` (`candidate_id`,`date`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `email_templates`
--

DROP TABLE IF EXISTS `email_templates`;
CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `body` text COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('Interview Invite','Rejection','Offer','Follow-up','Custom') COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `email_templates`
--

INSERT INTO `email_templates` (`id`, `name`, `subject`, `body`, `type`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Interview Invitation', 'Interview Invitation - {{position}}', 'Dear {{candidate_name}},\n\nThank you for your interest in the {{position}} position. We would like to invite you for an interview.\n\nDate: {{interview_date}}\nTime: {{interview_time}}\nLocation: {{location}}\n\nBest regards,\n{{company_name}}', 'Interview Invite', 1, 0, '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(2, 'Job Offer', 'Job Offer - {{position}}', 'Dear {{candidate_name}},\n\nCongratulations! We are pleased to offer you the position of {{position}}.\n\nPlease review the attached offer letter and let us know your decision.\n\nBest regards,\n{{company_name}}', 'Offer', 1, 0, '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(3, 'Rejection Notice', 'Application Update - {{position}}', 'Dear {{candidate_name}},\n\nThank you for your interest in the {{position}} position. After careful consideration, we have decided to move forward with other candidates.\n\nWe wish you the best in your job search.\n\nBest regards,\n{{company_name}}', 'Rejection', 1, 0, '2025-09-24 09:36:38', '2025-09-24 09:36:38');

-- --------------------------------------------------------

--
-- Table structure for table `file_uploads`
--

DROP TABLE IF EXISTS `file_uploads`;
CREATE TABLE IF NOT EXISTS `file_uploads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `file_path` text COLLATE utf8mb4_general_ci NOT NULL,
  `file_size` int NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `candidate_id` int DEFAULT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_filename` (`filename`(191)),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_uploaded_by` (`uploaded_by`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  KEY `idx_filename` (`filename`(191)),
  KEY `idx_mime_type` (`mime_type`),
  KEY `idx_file_uploads_candidate_uploaded` (`candidate_id`,`uploaded_at`),
  KEY `idx_file_uploads_type_size` (`mime_type`,`file_size`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Stores metadata for uploaded files, primarily resumes';

--
-- Dumping data for table `file_uploads`
--

INSERT INTO `file_uploads` (`id`, `filename`, `original_name`, `file_path`, `file_size`, `mime_type`, `candidate_id`, `uploaded_by`, `uploaded_at`) VALUES
(1, '089891c0-ebf0-4d5a-b5e5-1634bdf7bc50.pdf', 'Sample_Cover.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\089891c0-ebf0-4d5a-b5e5-1634bdf7bc50.pdf', 65979, 'application/pdf', NULL, 1, '2025-09-24 11:55:46'),
(2, '65a42c66-c7a4-4954-b6d2-5d4f0c2cc0a8.pdf', 'Outlook QS.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\65a42c66-c7a4-4954-b6d2-5d4f0c2cc0a8.pdf', 681808, 'application/pdf', NULL, 1, '2025-09-24 12:29:40'),
(3, 'a4e46eba-025b-4823-8550-9f504d2fa5a2.pdf', 'Outlook QS.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\a4e46eba-025b-4823-8550-9f504d2fa5a2.pdf', 681808, 'application/pdf', NULL, 1, '2025-09-24 12:36:33'),
(4, '0c96756e-60f2-45e9-8f5b-c739e291919a.pdf', 'Outlook QS.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\0c96756e-60f2-45e9-8f5b-c739e291919a.pdf', 681808, 'application/pdf', NULL, 1, '2025-09-24 12:39:23'),
(5, '3164ebba-d4eb-4173-b28b-6d251a53eb51.pdf', 'generate now.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\3164ebba-d4eb-4173-b28b-6d251a53eb51.pdf', 191712, 'application/pdf', NULL, 1, '2025-09-24 13:08:11'),
(6, '6f5d60cd-c7a4-4e52-9730-5059bea44d5d.pdf', '1749548393473-1749473685201-XYZ.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\6f5d60cd-c7a4-4e52-9730-5059bea44d5d.pdf', 68, 'application/pdf', NULL, 1, '2025-09-24 14:24:26'),
(7, '3ca5c681-dc17-4fa8-a400-04303db40e33.pdf', 'Outlook QS.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\3ca5c681-dc17-4fa8-a400-04303db40e33.pdf', 681808, 'application/pdf', NULL, 1, '2025-09-24 14:32:01'),
(8, 'ab76848c-8be9-4d23-8b17-663a6bff581d.pdf', 'order_548957011389.pdf', 'C:\\Users\\ADMIN\\test\\hr-workflow-management\\uploads\\resumes\\ab76848c-8be9-4d23-8b17-663a6bff581d.pdf', 230305, 'application/pdf', NULL, 1, '2025-09-25 08:56:40');

--
-- Triggers `file_uploads`
--
DROP TRIGGER IF EXISTS `after_file_upload`;
DELIMITER $$
CREATE TRIGGER `after_file_upload` AFTER INSERT ON `file_uploads` FOR EACH ROW BEGIN
    -- If this file is associated with a candidate, update the candidate's resume_file_id
    IF NEW.candidate_id IS NOT NULL THEN
        UPDATE candidates 
        SET resume_file_id = NEW.id, updated_at = NOW()
        WHERE id = NEW.candidate_id;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `interviewer_profiles`
--

DROP TABLE IF EXISTS `interviewer_profiles`;
CREATE TABLE IF NOT EXISTS `interviewer_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `department` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `expertise` json DEFAULT NULL,
  `interview_types` json DEFAULT NULL,
  `total_interviews` int DEFAULT '0',
  `average_rating` decimal(3,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_department` (`department`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `interviews`
--

DROP TABLE IF EXISTS `interviews`;
CREATE TABLE IF NOT EXISTS `interviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidate_id` int NOT NULL,
  `interviewer_id` int NOT NULL,
  `scheduled_date` timestamp NOT NULL,
  `duration` int NOT NULL,
  `type` enum('Technical','HR','Managerial','Final') COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('Scheduled','Completed','Cancelled','Rescheduled') COLLATE utf8mb4_general_ci DEFAULT 'Scheduled',
  `meeting_link` text COLLATE utf8mb4_general_ci,
  `location` text COLLATE utf8mb4_general_ci,
  `round` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_interviewer_id` (`interviewer_id`),
  KEY `idx_scheduled_date` (`scheduled_date`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`),
  KEY `idx_round` (`round`),
  KEY `idx_interviews_date_status` (`scheduled_date`,`status`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `interview_feedback`
--

DROP TABLE IF EXISTS `interview_feedback`;
CREATE TABLE IF NOT EXISTS `interview_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `interview_id` int NOT NULL,
  `interviewer_id` int NOT NULL,
  `ratings` json NOT NULL,
  `overall_rating` decimal(3,2) NOT NULL,
  `comments` text COLLATE utf8mb4_general_ci,
  `recommendation` enum('Selected','On Hold','Rejected') COLLATE utf8mb4_general_ci NOT NULL,
  `strengths` json DEFAULT NULL,
  `weaknesses` json DEFAULT NULL,
  `additional_notes` text COLLATE utf8mb4_general_ci,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_interview_feedback` (`interview_id`),
  KEY `idx_interview_id` (`interview_id`),
  KEY `idx_interviewer_id` (`interviewer_id`),
  KEY `idx_recommendation` (`recommendation`),
  KEY `idx_submitted_at` (`submitted_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_assignments`
--

DROP TABLE IF EXISTS `job_assignments`;
CREATE TABLE IF NOT EXISTS `job_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `user_id` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_job_user` (`job_id`,`user_id`),
  KEY `idx_job_id` (`job_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_portals`
--

DROP TABLE IF EXISTS `job_portals`;
CREATE TABLE IF NOT EXISTS `job_portals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `url` text COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('Posted','Draft','Expired') COLLATE utf8mb4_general_ci DEFAULT 'Draft',
  `applicants` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_job_id` (`job_id`),
  KEY `idx_status` (`status`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `job_portals`
--

INSERT INTO `job_portals` (`id`, `job_id`, `name`, `url`, `status`, `applicants`, `created_at`, `updated_at`) VALUES
(3, 1, 'Naukri.com', '', 'Draft', 0, '2025-09-24 11:20:48', '2025-09-24 11:20:48'),
(4, 1, 'LinkedIn', '', 'Draft', 0, '2025-09-24 11:20:48', '2025-09-24 11:20:48'),
(5, 1, 'Indeed', '', 'Draft', 0, '2025-09-24 11:20:48', '2025-09-24 11:20:48');

-- --------------------------------------------------------

--
-- Table structure for table `job_postings`
--

DROP TABLE IF EXISTS `job_postings`;
CREATE TABLE IF NOT EXISTS `job_postings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `department` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `location` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `job_type` enum('Full-time','Part-time','Contract','Internship') COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('Active','Paused','Closed') COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `posted_date` date NOT NULL,
  `deadline` date NOT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `requirements` json NOT NULL,
  `applicant_count` int DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_department` (`department`),
  KEY `idx_job_type` (`job_type`),
  KEY `idx_posted_date` (`posted_date`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `job_postings`
--

INSERT INTO `job_postings` (`id`, `title`, `department`, `location`, `job_type`, `status`, `posted_date`, `deadline`, `description`, `requirements`, `applicant_count`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Senior Full Stack Developer', 'Engineering', 'Baner, Pune', 'Full-time', 'Active', '2025-09-22', '2025-09-27', 'Some Description and Changed the Deadline', '[\"React\", \"PHP\", \"Node js\", \"and so on....\"]', 0, 1, '2025-09-24 11:08:16', '2025-09-24 11:20:48');

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `actions` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_module` (`user_id`,`module`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_module` (`module`)
) ENGINE=MyISAM AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `user_id`, `module`, `actions`, `created_at`, `updated_at`) VALUES
(1, 0, 'dashboard', '[\"view\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(2, 0, 'jobs', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(3, 0, 'candidates', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(4, 0, 'communications', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(5, 0, 'tasks', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(6, 0, 'team', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(7, 0, 'analytics', '[\"view\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(8, 0, 'settings', '[\"view\", \"edit\"]', '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(9, 2, 'dashboard', '[\"view\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(10, 2, 'jobs', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(11, 2, 'candidates', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(12, 2, 'communications', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(13, 2, 'tasks', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(14, 2, 'team', '[\"view\", \"create\", \"edit\", \"delete\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(15, 2, 'analytics', '[\"view\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(16, 2, 'settings', '[\"view\", \"edit\"]', '2025-09-24 09:38:14', '2025-09-24 09:38:14'),
(17, 3, 'dashboard', '[\"view\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29'),
(18, 3, 'jobs', '[\"view\", \"create\", \"edit\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29'),
(19, 3, 'candidates', '[\"view\", \"create\", \"edit\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29'),
(20, 3, 'communications', '[\"view\", \"create\", \"edit\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29'),
(21, 3, 'tasks', '[\"view\", \"create\", \"edit\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29'),
(22, 3, 'team', '[\"view\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29'),
(23, 3, 'analytics', '[\"view\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29');

-- --------------------------------------------------------

--
-- Table structure for table `post_interview_feedback`
--

DROP TABLE IF EXISTS `post_interview_feedback`;
CREATE TABLE IF NOT EXISTS `post_interview_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidate_id` int NOT NULL,
  `interview_id` int NOT NULL,
  `submitted_by` int NOT NULL,
  `technical_skills` json DEFAULT NULL,
  `soft_skills` json DEFAULT NULL,
  `overall_performance` decimal(3,2) NOT NULL,
  `recommendation` enum('Hire','Maybe','No Hire') COLLATE utf8mb4_general_ci NOT NULL,
  `salary_recommendation` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `start_date_flexibility` int NOT NULL,
  `additional_comments` text COLLATE utf8mb4_general_ci,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_interview_id` (`interview_id`),
  KEY `idx_submitted_by` (`submitted_by`),
  KEY `idx_recommendation` (`recommendation`),
  KEY `idx_submitted_at` (`submitted_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pre_interview_feedback`
--

DROP TABLE IF EXISTS `pre_interview_feedback`;
CREATE TABLE IF NOT EXISTS `pre_interview_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidate_id` int NOT NULL,
  `submitted_by` int NOT NULL,
  `resume_review_rating` decimal(3,2) NOT NULL,
  `resume_review_comments` text COLLATE utf8mb4_general_ci,
  `skills_assessment_rating` decimal(3,2) NOT NULL,
  `skills_assessment_comments` text COLLATE utf8mb4_general_ci,
  `cultural_fit_rating` decimal(3,2) NOT NULL,
  `cultural_fit_comments` text COLLATE utf8mb4_general_ci,
  `overall_recommendation` enum('Proceed','Hold','Reject') COLLATE utf8mb4_general_ci NOT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_candidate_pre_feedback` (`candidate_id`),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_submitted_by` (`submitted_by`),
  KEY `idx_overall_recommendation` (`overall_recommendation`),
  KEY `idx_submitted_at` (`submitted_at`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `setting_value` json NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `updated_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `idx_setting_key` (`setting_key`),
  KEY `idx_updated_by` (`updated_by`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `description`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 'notifications', '{\"teamUpdates\": true, \"systemAlerts\": true, \"taskDeadlines\": true, \"newApplications\": true, \"interviewReminders\": true}', 'Notification preferences', 0, '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(2, 'security', '{\"twoFactorAuth\": false, \"sessionTimeout\": 30}', 'Security settings', 0, '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(3, 'database', '{\"dataRetention\": 24, \"backupFrequency\": \"Daily\"}', 'Database settings', 0, '2025-09-24 09:36:38', '2025-09-24 09:36:38'),
(4, 'file_storage', '{\"maxFileSize\": 10485760, \"storagePath\": \"uploads/resumes\", \"allowedTypes\": [\"application/pdf\", \"application/msword\", \"application/vnd.openxmlformats-officedocument.wordprocessingml.document\", \"text/plain\"], \"allowedExtensions\": [\".pdf\", \".doc\", \".docx\", \".txt\"]}', 'File storage configuration', 1, '2025-09-24 11:45:05', '2025-09-24 11:45:05'),
(5, 'file_retention', '{\"autoCleanup\": true, \"retentionDays\": 2555, \"archiveDeleted\": true}', 'File retention policy (7 years default)', 1, '2025-09-24 11:45:05', '2025-09-24 11:45:05');

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_to` int DEFAULT NULL,
  `job_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `candidate_id` int DEFAULT NULL,
  `priority` enum('High','Medium','Low') COLLATE utf8mb4_general_ci DEFAULT 'Medium',
  `status` enum('Pending','In Progress','Completed') COLLATE utf8mb4_general_ci DEFAULT 'Pending',
  `due_date` date NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_job_id` (`job_id`),
  KEY `idx_priority` (`priority`),
  KEY `idx_status` (`status`),
  KEY `idx_due_date` (`due_date`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_tasks_assigned_status` (`assigned_to`,`status`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tasks`
--

INSERT INTO `tasks` (`id`, `title`, `description`, `assigned_to`, `job_id`, `candidate_id`, `priority`, `status`, `due_date`, `created_by`, `created_at`, `updated_at`) VALUES
(6, 'New Task Check', 'Description', 3, '1', 2, 'High', 'In Progress', '2025-09-26', 1, '2025-09-25 09:14:04', '2025-09-25 09:14:04');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `role` enum('Admin','HR Manager','Team Lead','Recruiter','Interviewer') COLLATE utf8mb4_general_ci NOT NULL,
  `avatar` text COLLATE utf8mb4_general_ci,
  `status` enum('Active','Away','Busy') COLLATE utf8mb4_general_ci DEFAULT 'Active',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `name`, `password_hash`, `role`, `avatar`, `status`, `last_login`, `created_at`, `updated_at`) VALUES
(3, 'sarah.johnson1', 'sarah.johnson@abc.com', 'Sarah Johnson', '$2a$12$tYPNyK3XOeM7Ths0qhSAo.dnukrSVTcLeaKF7EwkHh6dryZfDrQE6', 'Team Lead', NULL, 'Active', '2025-09-25 07:57:41', '2025-09-24 10:04:29', '2025-09-25 07:57:41'),
(1, 'admin', 'info@bylinelearning.com', 'Byline Admin', '$2a$12$rRcjHI1rA/rj0eaK0Y/4XOG07Nz66/UUqrDZL0WUF67AqoOOHP8K.', 'Admin', NULL, 'Active', '2025-09-25 07:50:39', '2025-09-24 09:38:14', '2025-09-25 07:50:39');

-- --------------------------------------------------------

--
-- Structure for view `candidate_files`
--
DROP TABLE IF EXISTS `candidate_files`;

DROP VIEW IF EXISTS `candidate_files`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `candidate_files`  AS SELECT `c`.`id` AS `candidate_id`, `c`.`name` AS `candidate_name`, `c`.`email` AS `candidate_email`, `f`.`id` AS `file_id`, `f`.`filename` AS `filename`, `f`.`original_name` AS `original_name`, `f`.`file_size` AS `file_size`, `f`.`mime_type` AS `mime_type`, `f`.`uploaded_at` AS `uploaded_at`, `u`.`name` AS `uploaded_by_name` FROM ((`candidates` `c` left join `file_uploads` `f` on((`c`.`resume_file_id` = `f`.`id`))) left join `users` `u` on((`f`.`uploaded_by` = `u`.`id`))) ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
