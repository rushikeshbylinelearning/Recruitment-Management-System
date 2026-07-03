-- HR Intern: allow Jobs page bulk import and import wizard (matches /api/candidates/import/* and GET /candidates/by-job-card).
-- Run once on production so existing intern accounts pick up permissions (JWT only carries role; login reads permissions table).

INSERT INTO permissions (user_id, module, actions)
SELECT u.id, 'candidates', '["view","create","edit"]'
FROM users u
WHERE u.role = 'HR Intern'
  AND NOT EXISTS (
    SELECT 1 FROM permissions p WHERE p.user_id = u.id AND p.module = 'candidates'
  );

UPDATE permissions p
INNER JOIN users u ON u.id = p.user_id AND u.role = 'HR Intern'
SET p.actions = '["view","create","edit"]'
WHERE p.module = 'candidates';
