-- Migration: Add task create permission to HR Interns
-- Purpose: Ensure all HR Intern users can create their own tasks.
--          Previously, HR Interns may have been created without tasks:create permission.
-- Safe to re-run.

-- Remove any incomplete tasks permissions for HR Interns
DELETE FROM permissions 
WHERE module = 'tasks' 
  AND user_id IN (SELECT id FROM users WHERE role = 'HR Intern' AND status = 'Active');

-- Insert correct tasks permissions: view, create, edit for all active HR Interns
INSERT INTO permissions (user_id, module, actions)
SELECT 
    id,
    'tasks',
    '["view", "create", "edit"]'
FROM users 
WHERE role = 'HR Intern' 
  AND status = 'Active';

-- Verify (uncomment to inspect):
-- SELECT u.name, u.role, p.module, p.actions
-- FROM users u
-- JOIN permissions p ON u.id = p.user_id AND p.module = 'tasks'
-- WHERE u.role = 'HR Intern';
