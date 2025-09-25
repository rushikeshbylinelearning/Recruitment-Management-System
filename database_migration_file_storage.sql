-- File Storage Migration - HR Workflow Management System
-- This migration adds file storage functionality for resume uploads
-- Created: 2024

-- Create file uploads table
CREATE TABLE file_uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    candidate_id INT,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_filename (filename(191)),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_uploaded_at (uploaded_at),
    INDEX idx_filename (filename(191)),
    INDEX idx_mime_type (mime_type)
);


-- Add resume_file_id column to candidates table to link with uploaded files
ALTER TABLE candidates 
ADD COLUMN resume_file_id INT,
ADD FOREIGN KEY (resume_file_id) REFERENCES file_uploads(id) ON DELETE SET NULL,
ADD INDEX idx_resume_file_id (resume_file_id);

-- Update existing resume_path column to be nullable since we're moving to file_uploads table
ALTER TABLE candidates 
MODIFY COLUMN resume_path TEXT NULL;

-- Add file storage settings to system_settings table
INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES 
('file_storage', '{"maxFileSize": 10485760, "allowedTypes": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"], "allowedExtensions": [".pdf", ".doc", ".docx", ".txt"], "storagePath": "uploads/resumes"}', 'File storage configuration', 1),
('file_retention', '{"retentionDays": 2555, "autoCleanup": true, "archiveDeleted": true}', 'File retention policy (7 years default)', 1);

-- Create indexes for better performance on file operations
CREATE INDEX idx_file_uploads_candidate_uploaded ON file_uploads(candidate_id, uploaded_at);
CREATE INDEX idx_file_uploads_type_size ON file_uploads(mime_type, file_size);

-- Add comments to the table for documentation
ALTER TABLE file_uploads COMMENT = 'Stores metadata for uploaded files, primarily resumes';
ALTER TABLE candidates COMMENT = 'Candidate information with optional resume file reference';

-- Create a view for easy file access with candidate information
CREATE VIEW candidate_files AS
SELECT 
    c.id as candidate_id,
    c.name as candidate_name,
    c.email as candidate_email,
    f.id as file_id,
    f.filename,
    f.original_name,
    f.file_size,
    f.mime_type,
    f.uploaded_at,
    u.name as uploaded_by_name
FROM candidates c
LEFT JOIN file_uploads f ON c.resume_file_id = f.id
LEFT JOIN users u ON f.uploaded_by = u.id;

-- Create a stored procedure for cleaning up orphaned files
DELIMITER //
CREATE PROCEDURE CleanupOrphanedFiles()
BEGIN
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
END //
DELIMITER ;

-- Create a function to get file size in human readable format
DELIMITER //
CREATE FUNCTION FormatFileSize(bytes INT) 
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
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
END //
DELIMITER ;

-- Create a trigger to update candidate's resume_file_id when a file is uploaded
DELIMITER //
CREATE TRIGGER after_file_upload 
AFTER INSERT ON file_uploads
FOR EACH ROW
BEGIN
    -- If this file is associated with a candidate, update the candidate's resume_file_id
    IF NEW.candidate_id IS NOT NULL THEN
        UPDATE candidates 
        SET resume_file_id = NEW.id, updated_at = NOW()
        WHERE id = NEW.candidate_id;
    END IF;
END //
DELIMITER ;

-- Insert some sample file types for reference
INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES 
('file_validation', '{"enableVirusScan": false, "maxFileNameLength": 255, "disallowedCharacters": ["<", ">", ":", "\"", "|", "?", "*"]}', 'File validation rules', 1);

-- Grant necessary permissions (adjust as needed for your MySQL setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON file_uploads TO 'hr_app_user'@'localhost';
-- GRANT SELECT ON candidate_files TO 'hr_app_user'@'localhost';
-- GRANT EXECUTE ON PROCEDURE CleanupOrphanedFiles TO 'hr_app_user'@'localhost';
-- GRANT EXECUTE ON FUNCTION FormatFileSize TO 'hr_app_user'@'localhost';

-- Create backup of existing data before migration (optional)
-- CREATE TABLE candidates_backup AS SELECT * FROM candidates;

COMMIT;


