-- Enable bulk upload (candidates:create permission) for Recruiters and HR Interns
-- This allows both roles to use the FAB bulk import button on the Jobs page

-- Update existing Recruiter permissions to include 'create' action
UPDATE permissions p
INNER JOIN users u ON u.id = p.user_id AND u.role = 'Recruiter'
SET p.actions = '["view","create","edit"]'
WHERE p.module = 'candidates'
  AND p.actions NOT LIKE '%"create"%';

-- Update existing HR Intern permissions to include 'create' action
UPDATE permissions p
INNER JOIN users u ON u.id = p.user_id AND u.role = 'HR Intern'
SET p.actions = '["view","create","edit"]'
WHERE p.module = 'candidates'
  AND p.actions NOT LIKE '%"create"%';

-- Insert candidates:create permission for any Recruiters without it
INSERT INTO permissions (user_id, module, actions)
SELECT u.id, 'candidates', '["view","create","edit"]'
FROM users u
WHERE u.role = 'Recruiter'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p 
    WHERE p.user_id = u.id AND p.module = 'candidates'
  );

-- Insert candidates:create permission for any HR Interns without it
INSERT INTO permissions (user_id, module, actions)
SELECT u.id, 'candidates', '["view","create","edit"]'
FROM users u
WHERE u.role = 'HR Intern'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p 
    WHERE p.user_id = u.id AND p.module = 'candidates'
  );
