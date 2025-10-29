-- Add assignments permissions for Admin, HR Manager, and Recruiter roles
-- Interviewer role is excluded from assignments

-- Get user IDs for each role
SET @admin_id = (SELECT id FROM users WHERE role = 'Admin' LIMIT 1);
SET @hr_manager_id = (SELECT id FROM users WHERE role = 'HR Manager' LIMIT 1);
SET @recruiter_id = (SELECT id FROM users WHERE role = 'Recruiter' LIMIT 1);

-- Add assignments permissions for Admin (if exists)
INSERT IGNORE INTO permissions (user_id, module, actions, created_at, updated_at)
SELECT @admin_id, 'assignments', '["view","create","edit","delete"]', NOW(), NOW()
WHERE @admin_id IS NOT NULL;

-- Add assignments permissions for HR Manager (if exists)
INSERT IGNORE INTO permissions (user_id, module, actions, created_at, updated_at)
SELECT @hr_manager_id, 'assignments', '["view","create","edit","delete"]', NOW(), NOW()
WHERE @hr_manager_id IS NOT NULL;

-- Add assignments permissions for Recruiter (if exists)
INSERT IGNORE INTO permissions (user_id, module, actions, created_at, updated_at)
SELECT @recruiter_id, 'assignments', '["view","create","edit","delete"]', NOW(), NOW()
WHERE @recruiter_id IS NOT NULL;

-- Add assignments permissions for all Admin users
INSERT IGNORE INTO permissions (user_id, module, actions, created_at, updated_at)
SELECT id, 'assignments', '["view","create","edit","delete"]', NOW(), NOW()
FROM users 
WHERE role = 'Admin' 
AND id NOT IN (SELECT user_id FROM permissions WHERE module = 'assignments');

-- Add assignments permissions for all HR Manager users
INSERT IGNORE INTO permissions (user_id, module, actions, created_at, updated_at)
SELECT id, 'assignments', '["view","create","edit","delete"]', NOW(), NOW()
FROM users 
WHERE role = 'HR Manager' 
AND id NOT IN (SELECT user_id FROM permissions WHERE module = 'assignments');

-- Add assignments permissions for all Recruiter users
INSERT IGNORE INTO permissions (user_id, module, actions, created_at, updated_at)
SELECT id, 'assignments', '["view","create","edit","delete"]', NOW(), NOW()
FROM users 
WHERE role = 'Recruiter' 
AND id NOT IN (SELECT user_id FROM permissions WHERE module = 'assignments');
