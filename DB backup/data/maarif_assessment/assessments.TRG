TYPE=TRIGGERS
triggers='CREATE DEFINER=`root`@`localhost` TRIGGER `after_assessment_completion` AFTER UPDATE ON `assessments` FOR EACH ROW BEGIN\n  -- Only trigger when rit_score is updated from NULL to NOT NULL (assessment completed)\n  IF OLD.rit_score IS NULL AND NEW.rit_score IS NOT NULL THEN\n    CALL CalculateCompetencyScores(NEW.id);\n  END IF;\nEND'
sql_modes=524288
definers='root@localhost'
client_cs_names='utf8mb4'
connection_cl_names='utf8mb4_general_ci'
db_cl_names='utf8mb4_general_ci'
created=1776752251163532
