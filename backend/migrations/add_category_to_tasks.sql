-- Add category column to tasks table
-- This allows users to explicitly assign tasks to specific columns

ALTER TABLE tasks 
ADD COLUMN category ENUM('hr-operations', 'admin-operations', 'misc') 
DEFAULT 'hr-operations' 
AFTER status;

-- Update existing tasks to have a category based on keywords
UPDATE tasks 
SET category = 'hr-operations'
WHERE LOWER(CONCAT(title, ' ', description)) REGEXP 'hr|recruit|recruiter|onboard|offer|hire|hiring|payroll|leave|policy|policies|employee|staff|interview|candidate|application|resume|cv|job posting|talent|workforce|performance review|appraisal|training|induction';

UPDATE tasks 
SET category = 'admin-operations'
WHERE category = 'hr-operations' 
AND LOWER(CONCAT(title, ' ', description)) REGEXP 'admin|report|reporting|document|documentation|compliance|legal|finance|financial|budget|accounting|invoice|expense|procurement|purchase|vendor|contract|audit|regulatory|tax|insurance';

-- All remaining tasks will stay as 'hr-operations' (default) or can be manually updated
