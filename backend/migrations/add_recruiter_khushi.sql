-- ============================================================
-- Add Recruiter: Khushi
-- Password: ByLine@2019 (bcrypt hashed, 10 rounds)
-- ============================================================

-- Step 1: Insert the user
INSERT INTO users (username, email, name, password_hash, role, avatar, status, created_at, updated_at)
VALUES (
  'khushi',
  'khushi@company.com',
  'Khushi',
  '$2a$10$9.G6gg.MqTAATATjN9CcLuC1U8cQfdN5rCCxRjJ.U5UCzwXbOwUze',
  'HR Intern',
  NULL,
  'Active',
  NOW(),
  NOW()
);

-- Step 2: Insert default Recruiter permissions for the new user
INSERT INTO permissions (user_id, module, actions)
SELECT LAST_INSERT_ID(), module, actions
FROM permissions
WHERE user_id = (
  -- Clone permissions from an existing Recruiter if one exists
  SELECT id FROM users
  WHERE role = 'HR INTERN' AND username != 'khushi'
  LIMIT 1
);

-- Fallback: if no existing Recruiter to clone from, insert hardcoded defaults
-- (Run this block only if the INSERT above inserted 0 rows)
INSERT INTO permissions (user_id, module, actions)
SELECT u.id, p.module, p.actions
FROM users u
JOIN (
  SELECT 'dashboard'      AS module, '["view"]'                              AS actions UNION ALL
  SELECT 'jobs',                     '["view"]'                                          UNION ALL
  SELECT 'candidates',               '["view","edit"]'                                   UNION ALL
  SELECT 'interviews',               '["view","create","edit","delete"]'                 UNION ALL
  SELECT 'communications',           '["view","create"]'                                 UNION ALL
  SELECT 'tasks',                    '["view","create","edit"]'                          UNION ALL
  SELECT 'team',                     '["view","create"]'                                 UNION ALL
  SELECT 'analytics',                '["view"]'
) p ON 1=1
WHERE u.username = 'khushi'
  AND NOT EXISTS (
    SELECT 1 FROM permissions WHERE user_id = u.id
  );

-- Verify the result
SELECT u.id, u.username, u.name, u.email, u.role, u.status,
       COUNT(p.id) AS permission_count
FROM users u
LEFT JOIN permissions p ON p.user_id = u.id
WHERE u.username = 'khushi'
GROUP BY u.id, u.username, u.name, u.email, u.role, u.status;
