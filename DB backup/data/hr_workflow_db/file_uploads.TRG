TYPE=TRIGGERS
triggers='CREATE DEFINER=`root`@`localhost` TRIGGER `after_file_upload` AFTER INSERT ON `file_uploads` FOR EACH ROW BEGIN\n    -- If this file is associated with a candidate, update the candidate\'s resume_file_id\n    IF NEW.candidate_id IS NOT NULL THEN\n        UPDATE candidates \n        SET resume_file_id = NEW.id, updated_at = NOW()\n        WHERE id = NEW.candidate_id;\n    END IF;\nEND'
sql_modes=524288
definers='root@localhost'
client_cs_names='utf8mb4'
connection_cl_names='utf8mb4_general_ci'
db_cl_names='utf8mb4_general_ci'
created=1776775088276434
