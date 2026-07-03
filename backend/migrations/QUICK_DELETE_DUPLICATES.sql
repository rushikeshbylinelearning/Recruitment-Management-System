-- ============================================================
-- QUICK DELETE DUPLICATES - SIMPLE VERSION
-- ============================================================
-- 
-- This is a simplified version for quick execution
-- For detailed analysis, use: delete_duplicate_candidates.sql
-- 
-- ⚠️ WARNING: This will permanently delete data!
-- ⚠️ BACKUP YOUR DATABASE FIRST!
-- 
-- ============================================================

-- STEP 1: Check how many duplicates exist
-- ============================================================

-- Count duplicate emails
SELECT 
    'Duplicate Emails' as type,
    COUNT(DISTINCT email) as duplicate_groups,
    SUM(cnt - 1) as records_to_delete
FROM (
    SELECT email, COUNT(*) as cnt
    FROM candidates
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email
    HAVING COUNT(*) > 1
) as dups;

-- Count duplicate phones
SELECT 
    'Duplicate Phones' as type,
    COUNT(DISTINCT phone) as duplicate_groups,
    SUM(cnt - 1) as records_to_delete
FROM (
    SELECT phone, COUNT(*) as cnt
    FROM candidates
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY phone
    HAVING COUNT(*) > 1
) as dups;


-- STEP 2: Preview what will be deleted
-- ============================================================

-- Show duplicates that will be DELETED (newer records)
SELECT 
    c1.id,
    c1.name,
    c1.email,
    c1.phone,
    c1.job_id,
    c1.stage,
    c1.created_at,
    'Will be DELETED' as action
FROM candidates c1
WHERE (
    -- Duplicate by email (keep oldest)
    (c1.email IS NOT NULL AND c1.email != '' AND EXISTS (
        SELECT 1 FROM candidates c2 
        WHERE c2.email = c1.email AND c2.created_at < c1.created_at
    ))
    OR
    -- Duplicate by phone (keep oldest)
    (c1.phone IS NOT NULL AND c1.phone != '' AND EXISTS (
        SELECT 1 FROM candidates c2 
        WHERE c2.phone = c1.phone AND c2.created_at < c1.created_at
    ))
)
ORDER BY c1.created_at DESC
LIMIT 50;


-- STEP 3: Create backup (REQUIRED!)
-- ============================================================

CREATE TABLE IF NOT EXISTS candidates_backup_before_dedup AS
SELECT * FROM candidates;

-- Verify backup
SELECT COUNT(*) as backed_up_records FROM candidates_backup_before_dedup;


-- STEP 4: DELETE DUPLICATES
-- ============================================================

-- Delete duplicate emails (keep oldest)
-- Using subquery to avoid MySQL's "can't specify target table" error
DELETE FROM candidates
WHERE id IN (
    SELECT id FROM (
        SELECT c1.id
        FROM candidates c1
        INNER JOIN candidates c2 ON c2.email = c1.email AND c2.created_at < c1.created_at
        WHERE c1.email IS NOT NULL AND c1.email != ''
    ) AS temp_email_dups
);

-- Delete duplicate phones (keep oldest)
-- Using subquery to avoid MySQL's "can't specify target table" error
DELETE FROM candidates
WHERE id IN (
    SELECT id FROM (
        SELECT c1.id
        FROM candidates c1
        INNER JOIN candidates c2 ON c2.phone = c1.phone AND c2.created_at < c1.created_at
        WHERE c1.phone IS NOT NULL AND c1.phone != ''
    ) AS temp_phone_dups
);


-- STEP 5: Verify no duplicates remain
-- ============================================================

-- Check for remaining email duplicates (should return 0 rows)
SELECT email, COUNT(*) as count
FROM candidates
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1;

-- Check for remaining phone duplicates (should return 0 rows)
SELECT phone, COUNT(*) as count
FROM candidates
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1;

-- Show before/after counts
SELECT 
    'BEFORE' as status,
    COUNT(*) as total
FROM candidates_backup_before_dedup
UNION ALL
SELECT 
    'AFTER' as status,
    COUNT(*) as total
FROM candidates
UNION ALL
SELECT 
    'DELETED' as status,
    (SELECT COUNT(*) FROM candidates_backup_before_dedup) - COUNT(*) as total
FROM candidates;


-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- If something went wrong, restore from backup:
-- 
-- DELETE FROM candidates;
-- INSERT INTO candidates SELECT * FROM candidates_backup_before_dedup;
-- 
-- ============================================================


-- ============================================================
-- CLEANUP (after verification)
-- ============================================================
-- Once you've verified everything is correct, drop the backup:
-- 
-- DROP TABLE IF EXISTS candidates_backup_before_dedup;
-- 
-- ============================================================
