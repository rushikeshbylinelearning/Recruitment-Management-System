-- Add candidate_notes_ratings table for multi-user notes and ratings
-- This allows multiple users to add notes and ratings for the same candidate

CREATE TABLE `candidate_notes_ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `candidate_id` int NOT NULL,
  `user_id` int NOT NULL,
  `notes` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `rating` decimal(3,2) DEFAULT NULL,
  `rating_comments` text COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_candidate_id` (`candidate_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_candidate_user` (`candidate_id`, `user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Multi-user notes and ratings for candidates';

