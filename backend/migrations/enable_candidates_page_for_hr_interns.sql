-- Enable Candidates page access for HR Interns with restrictions on download options
-- HR Interns can view, create, and edit candidates but cannot export/download

-- Update existing HR Intern permissions to include candidates:view
UPDATE permissions p
INNER JOIN users u ON u.id = p.user_id AND u.role = 'HR Intern'
SET p.actions = '["view","create","edit"]'
WHERE p.module = 'candidates'
  AND p.actions NOT LIKE '%"view"%';

-- Insert candidates:view permission for any HR Interns without it
INSERT INTO permissions (user_id, module, actions)
SELECT u.id, 'candidates', '["view","create","edit"]'
FROM users u
WHERE u.role = 'HR Intern'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p 
    WHERE p.user_id = u.id AND p.module = 'candidates'
  );

-- Add candidates-export module with empty actions (no export permissions for HR Interns)
INSERT INTO permissions (user_id, module, actions)
SELECT u.id, 'candidates-export', '[]'
FROM users u
WHERE u.role = 'HR Intern'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p 
    WHERE p.user_id = u.id AND p.module = 'candidates-export'
  );
