-- Fix Sales and Marketing position mapping issue
-- This migration standardizes position values to match the jobCardCategoryMapping.json

-- Update candidates with "Sales & Marketing" to "Sales and Marketing"
UPDATE candidates 
SET position = 'Sales and Marketing'
WHERE TRIM(position) = 'Sales & Marketing';

-- Update candidates with other common variations
UPDATE candidates 
SET position = 'Sales and Marketing'
WHERE LOWER(TRIM(position)) IN ('sales and marketing', 'sales & marketing', 'sales', 'business development executive', 'international sales', 'linkedin profile sales', 'intern & fresher sales/marketing', 'sales executive', 'business development', 'marketing executive', 'inside sales', 'b2b sales')
AND position NOT IN ('Sales and Marketing');

-- Ensure job titles match the fixed card titles
UPDATE job_postings
SET title = 'Sales and Marketing'
WHERE LOWER(TRIM(title)) IN ('sales and marketing', 'sales & marketing')
AND title != 'Sales and Marketing';

UPDATE job_postings
SET title = 'Animators'
WHERE LOWER(TRIM(title)) IN ('animator', 'animators')
AND title != 'Animators';

UPDATE job_postings
SET title = 'Graphic Designer'
WHERE LOWER(TRIM(title)) IN ('graphic designer', 'visualizer')
AND title != 'Graphic Designer';

UPDATE job_postings
SET title = 'Full Stack Developer'
WHERE LOWER(TRIM(title)) IN ('full stack developer', 'senior - full stack developer', 'senior full stack developer')
AND title != 'Full Stack Developer';

UPDATE job_postings
SET title = 'Content Writers'
WHERE LOWER(TRIM(title)) IN ('content writer', 'content writers')
AND title != 'Content Writers';

UPDATE job_postings
SET title = 'Instructional Designers'
WHERE LOWER(TRIM(title)) IN ('instructional designer', 'instructional content writer')
AND title != 'Instructional Designers';

UPDATE job_postings
SET title = 'Digital Marketing'
WHERE LOWER(TRIM(title)) IN ('digital marketing executive', 'digital marketing')
AND title != 'Digital Marketing';

UPDATE job_postings
SET title = 'Human Resource'
WHERE LOWER(TRIM(title)) IN ('hr executive', 'hr executive & operations', 'human resource', 'human resources', 'hr', 'recruiter', 'talent acquisition', 'people operations')
AND title != 'Human Resource';

UPDATE job_postings
SET title = 'IT'
WHERE LOWER(TRIM(title)) IN ('senior it', 'it', 'intern/fresher', 'intern & fresher', 'e-learning developer', 'linkedin profiles it', 'linkedin profiles it')
AND title != 'IT';

UPDATE job_postings
SET title = 'Project Coordinators'
WHERE LOWER(TRIM(title)) IN ('project coordinator', 'project manager/coordinator')
AND title != 'Project Coordinators';
