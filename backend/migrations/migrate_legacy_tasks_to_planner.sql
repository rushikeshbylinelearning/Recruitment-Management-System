-- HR Planner Workspace: Legacy Task Data Migration
-- ============================================================
-- Purpose:
--   Migrates existing rows from the legacy `tasks` table into the
--   new planner workspace schema (plans → buckets → planner_tasks).
--
-- Strategy:
--   1. For each distinct user who *created* a task, create one default
--      plan named "General Work" (skipped if already present).
--   2. Create three default buckets per plan — "To Do", "In Progress",
--      "Completed" — matching the hardcoded column names used by the
--      old Tasks page.
--   3. Copy every legacy task row into `planner_tasks`, mapping:
--        tasks.title          → planner_tasks.title
--        tasks.description    → planner_tasks.description
--        tasks.assigned_to    → planner_tasks.assigned_to / assigned_by
--        tasks.job_id         → NOT migrated (legacy column is VARCHAR(36)
--                               UUID; planner_tasks.job_id is INT UNSIGNED
--                               — see note below)
--        tasks.candidate_id   → planner_tasks.candidate_id
--        tasks.priority       → planner_tasks.priority  (case-normalised)
--        tasks.status         → planner_tasks.status    (mapped to bucket)
--        tasks.due_date       → planner_tasks.due_date
--        tasks.created_by     → planner_tasks.created_by
--        tasks.created_at     → planner_tasks.created_at (preserved via UPDATE)
--        tasks.updated_at     → planner_tasks.updated_at (preserved via UPDATE)
--
-- Note on job_id:
--   The legacy `tasks.job_id` is VARCHAR(36) (a UUID string from the
--   jobs table), whereas `planner_tasks.job_id` is INT UNSIGNED.
--   A safe cast is attempted (CAST(job_id AS UNSIGNED)) which returns 0
--   for non-numeric UUIDs, so those rows will have job_id = NULL.
--   If your jobs table stores both id (INT) and uuid (VARCHAR) columns
--   you can replace the CAST with a JOIN:
--     LEFT JOIN jobs j ON j.uuid = t.job_id
--   and use j.id as the integer value.
--
-- Idempotency:
--   The plan INSERT uses ON DUPLICATE KEY UPDATE with a no-op, so the
--   migration is safe to re-run.  Bucket and task inserts are also
--   guarded against duplicates.
--
-- Depends on:
--   create_planner_core_tables.sql  (plans, plan_members, buckets)
--   create_planner_task_tables.sql  (planner_tasks)
-- ============================================================

-- ============================================================
-- Step 1: Create one "General Work" plan for each user who has
--         at least one task in the legacy table.
-- ============================================================
INSERT INTO `plans`
  (`name`, `owner_id`, `visibility`, `created_by`, `status`, `is_deleted`)
SELECT DISTINCT
  'General Work'   AS name,
  t.created_by     AS owner_id,
  'private'        AS visibility,
  t.created_by     AS created_by,
  'active'         AS status,
  0                AS is_deleted
FROM `tasks` t
WHERE NOT EXISTS (
  SELECT 1
  FROM   `plans` p
  WHERE  p.owner_id  = t.created_by
    AND  p.name      = 'General Work'
    AND  p.is_deleted = 0
);

-- ============================================================
-- Step 2: Create the three default buckets for every newly created
--         (or already existing) "General Work" plan that doesn't
--         yet have those buckets.
-- ============================================================

-- Bucket: "To Do"  (position 0)
INSERT INTO `buckets`
  (`plan_id`, `name`, `position`, `created_by`, `status`, `is_deleted`)
SELECT
  p.id         AS plan_id,
  'To Do'      AS name,
  0            AS position,
  p.owner_id   AS created_by,
  'active'     AS status,
  0            AS is_deleted
FROM `plans` p
WHERE p.name      = 'General Work'
  AND p.is_deleted = 0
  AND NOT EXISTS (
    SELECT 1
    FROM   `buckets` b
    WHERE  b.plan_id   = p.id
      AND  b.name      = 'To Do'
      AND  b.is_deleted = 0
  );

-- Bucket: "In Progress"  (position 1)
INSERT INTO `buckets`
  (`plan_id`, `name`, `position`, `created_by`, `status`, `is_deleted`)
SELECT
  p.id            AS plan_id,
  'In Progress'   AS name,
  1               AS position,
  p.owner_id      AS created_by,
  'active'        AS status,
  0               AS is_deleted
FROM `plans` p
WHERE p.name      = 'General Work'
  AND p.is_deleted = 0
  AND NOT EXISTS (
    SELECT 1
    FROM   `buckets` b
    WHERE  b.plan_id   = p.id
      AND  b.name      = 'In Progress'
      AND  b.is_deleted = 0
  );

-- Bucket: "Completed"  (position 2)
INSERT INTO `buckets`
  (`plan_id`, `name`, `position`, `created_by`, `status`, `is_deleted`)
SELECT
  p.id          AS plan_id,
  'Completed'   AS name,
  2             AS position,
  p.owner_id    AS created_by,
  'active'      AS status,
  0             AS is_deleted
FROM `plans` p
WHERE p.name      = 'General Work'
  AND p.is_deleted = 0
  AND NOT EXISTS (
    SELECT 1
    FROM   `buckets` b
    WHERE  b.plan_id   = p.id
      AND  b.name      = 'Completed'
      AND  b.is_deleted = 0
  );

-- ============================================================
-- Step 3: Copy legacy tasks into planner_tasks.
--
--   Each task is placed in the bucket that matches its legacy
--   `status` value:
--     'Pending'     → "To Do"
--     'In Progress' → "In Progress"
--     'Completed'   → "Completed"
--
--   Priority values are lowercased to match the new ENUM:
--     'High' → 'high',  'Medium' → 'medium',  'Low' → 'low'
--
--   Status values are mapped to the new ENUM:
--     'Pending'     → 'pending'
--     'In Progress' → 'in_progress'
--     'Completed'   → 'completed'
--
--   job_id: cast to UNSIGNED integer; NULL for non-numeric UUIDs.
--
--   Tasks already migrated (matched by title + created_by + due_date)
--   are skipped to allow safe re-runs.
-- ============================================================
INSERT INTO `planner_tasks`
  (
    `bucket_id`,
    `title`,
    `description`,
    `priority`,
    `assigned_to`,
    `assigned_by`,
    `due_date`,
    `status`,
    `completion_percentage`,
    `position`,
    `job_id`,
    `candidate_id`,
    `created_by`,
    `is_deleted`
  )
SELECT
  b.id                              AS bucket_id,

  t.title                           AS title,
  t.description                     AS description,

  -- Normalise priority to lowercase ENUM value
  CASE t.priority
    WHEN 'High'   THEN 'high'
    WHEN 'Low'    THEN 'low'
    ELSE               'medium'
  END                               AS priority,

  t.assigned_to                     AS assigned_to,
  t.created_by                      AS assigned_by,

  t.due_date                        AS due_date,

  -- Map legacy status to new ENUM value
  CASE t.status
    WHEN 'In Progress' THEN 'in_progress'
    WHEN 'Completed'   THEN 'completed'
    ELSE                    'pending'
  END                               AS status,

  -- Pre-fill completion % for completed tasks
  CASE t.status
    WHEN 'Completed' THEN 100
    ELSE                  0
  END                               AS completion_percentage,

  -- Assign sequential position within each bucket
  ROW_NUMBER() OVER (
    PARTITION BY b.id
    ORDER BY     t.id
  ) - 1                             AS position,

  -- job_id: attempt numeric cast; UUIDs cast to 0 → stored as NULL
  CASE
    WHEN t.job_id REGEXP '^[0-9]+$' THEN CAST(t.job_id AS UNSIGNED)
    ELSE NULL
  END                               AS job_id,

  t.candidate_id                    AS candidate_id,
  t.created_by                      AS created_by,
  0                                 AS is_deleted

FROM `tasks` t

-- Join to the owner's "General Work" plan
INNER JOIN `plans` p
  ON  p.owner_id  = t.created_by
  AND p.name      = 'General Work'
  AND p.is_deleted = 0

-- Join to the bucket that matches the legacy status
INNER JOIN `buckets` b
  ON  b.plan_id   = p.id
  AND b.is_deleted = 0
  AND b.name = CASE t.status
                 WHEN 'In Progress' THEN 'In Progress'
                 WHEN 'Completed'   THEN 'Completed'
                 ELSE                    'To Do'
               END

-- Skip rows already migrated (idempotency guard)
WHERE NOT EXISTS (
  SELECT 1
  FROM   `planner_tasks` pt
  WHERE  pt.bucket_id  = b.id
    AND  pt.title      = t.title
    AND  pt.created_by = t.created_by
    AND  pt.due_date   = t.due_date
    AND  pt.is_deleted  = 0
);

-- ============================================================
-- Step 4: Backfill the original created_at / updated_at timestamps
--         so the migrated tasks retain their historical dates.
--         (The INSERT above lets MySQL auto-assign CURRENT_TIMESTAMP;
--          we correct them here.)
-- ============================================================
UPDATE `planner_tasks` pt
INNER JOIN `tasks` t
  ON  t.title      = pt.title
  AND t.created_by = pt.created_by
  AND t.due_date   = pt.due_date
SET
  pt.created_at = t.created_at,
  pt.updated_at = t.updated_at;

-- ============================================================
-- Step 5: Add the plan owner as an 'admin' member of their own plan
--         (so they can manage it via the planner UI).
-- ============================================================
INSERT IGNORE INTO `plan_members`
  (`plan_id`, `user_id`, `role`)
SELECT
  p.id        AS plan_id,
  p.owner_id  AS user_id,
  'admin'     AS role
FROM `plans` p
WHERE p.name      = 'General Work'
  AND p.is_deleted = 0;

-- ============================================================
-- Migration complete.
-- Verify with:
--   SELECT COUNT(*) FROM tasks;               -- legacy row count
--   SELECT COUNT(*) FROM planner_tasks
--     WHERE is_deleted = 0;                   -- should match (or exceed
--                                             --  if other tasks exist)
--   SELECT pt.id, pt.title, pt.job_id, pt.candidate_id
--     FROM planner_tasks pt
--     WHERE pt.candidate_id IS NOT NULL;      -- verify FK links preserved
-- ============================================================
