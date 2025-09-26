-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Sep 26, 2025 at 06:28 AM
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
) ENGINE=MyISAM AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(23, 3, 'analytics', '[\"view\"]', '2025-09-24 10:04:29', '2025-09-24 10:04:29'),
(34, 4, 'jobs', '[\"view\"]', '2025-09-26 06:20:27', '2025-09-26 06:20:27'),
(35, 4, 'candidates', '[\"view\"]', '2025-09-26 06:20:27', '2025-09-26 06:20:27'),
(33, 4, 'dashboard', '[\"view\"]', '2025-09-26 06:20:27', '2025-09-26 06:20:27'),
(27, 5, 'dashboard', '[\"view\"]', '2025-09-26 06:00:11', '2025-09-26 06:00:11'),
(28, 5, 'jobs', '[\"view\"]', '2025-09-26 06:00:11', '2025-09-26 06:00:11'),
(29, 5, 'candidates', '[\"view\", \"edit\"]', '2025-09-26 06:00:11', '2025-09-26 06:00:11'),
(30, 5, 'communications', '[\"view\", \"create\"]', '2025-09-26 06:00:11', '2025-09-26 06:00:11'),
(31, 5, 'tasks', '[\"view\", \"create\", \"edit\"]', '2025-09-26 06:00:11', '2025-09-26 06:00:11'),
(32, 5, 'analytics', '[\"view\"]', '2025-09-26 06:00:11', '2025-09-26 06:00:11'),
(36, 4, 'tasks', '[\"view\"]', '2025-09-26 06:20:27', '2025-09-26 06:20:27'),
(37, 4, 'team', '[\"view\"]', '2025-09-26 06:20:27', '2025-09-26 06:20:27'),
(38, 4, 'interviews', '[\"view\", \"edit\"]', '2025-09-26 06:20:27', '2025-09-26 06:20:27');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
