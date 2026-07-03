-- ============================================================
-- DELETE DUPLICATE CANDIDATES SCRIPT
-- ============================================================
-- 
-- Purpose: Identify and delete duplicate candidate records
-- Duplicate Criteria: Same email OR same phone number
-- Strategy: Keep the OLDEST record (earliest created_at), delete newer duplicates
--
-- IMPORTANT: This script will permanently delete data!
-- RECOMMENDATION: Backup your database before running this script
--
-- Usage:
--   1. Review the duplicate candidates first (Section 1)
--   2. Backup your database
--   3. Run the DELETE statements (Section 2)
--   4. Verify the results (Section 3)
-- ============================================================

-- ============================================================
-- SECTION 1: IDENTIFY DUPLICATES (READ-ONLY QUERIES)
-- ============================================================

-- 1.1 Find duplicate candidates by EMAIL
-- Shows all candidates with duplicate emails
SELECT 
    email,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(id ORDER BY created_at SEPARATOR ', ') as candidate_ids,
    GROUP_CONCAT(name ORDER BY created_at SEPARATOR ' | ') as names,
    GROUP_CONCAT(created_at ORDER BY created_at SEPARATOR ' | ') as created_dates
FROM candidates
WHERE email IS NOT NULL 
  AND email != ''
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, email;

-- 1.2 Find duplicate candidates by PHONE
-- Shows all candidates with duplicate phone numbers
SELECT 
    phone,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(id ORDER BY created_at SEPARATOR ', ') as candidate_ids,
    GROUP_CONCAT(name ORDER BY created_at SEPARATOR ' | ') as names,
    GROUP_CONCAT(created_at ORDER BY created_at SEPARATOR ' | ') as created_dates
FROM candidates
WHERE phone IS NOT NULL 
  AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, phone;

-- 1.3 Find duplicate candidates by BOTH email AND phone
-- Shows candidates that have both same email and same phone
SELECT 
    email,
    phone,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(id ORDER BY created_at SEPARATOR ', ') as candidate_ids,
    GROUP_CONCAT(name ORDER BY created_at SEPARATOR ' | ') as names,
    GROUP_CONCAT(created_at ORDER BY created_at SEPARATOR ' | ') as created_dates
FROM candidates
WHERE (email IS NOT NULL AND email != '')
   OR (phone IS NOT NULL AND phone != '')
GROUP BY email, phone
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 1.4 Count total duplicates to be deleted
-- Shows how many records will be deleted
SELECT 
    'Duplicates by Email' as category,
    COUNT(*) as records_to_delete
FROM candidates c1
WHERE email IS NOT NULL 
  AND email != ''
  AND EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.email = c1.email 
        AND c2.created_at < c1.created_at
  )
UNION ALL
SELECT 
    'Duplicates by Phone' as category,
    COUNT(*) as records_to_delete
FROM candidates c1
WHERE phone IS NOT NULL 
  AND phone != ''
  AND NOT EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.email = c1.email 
        AND c2.created_at < c1.created_at
  )
  AND EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.phone = c1.phone 
        AND c2.created_at < c1.created_at
  );

-- 1.5 Preview candidates that will be KEPT (oldest records)
-- These are the records that will remain after deletion
SELECT 
    c1.id,
    c1.name,
    c1.email,
    c1.phone,
    c1.job_id,
    c1.stage,
    c1.created_at,
    'KEPT - Oldest by Email' as reason
FROM candidates c1
WHERE c1.email IS NOT NULL 
  AND c1.email != ''
  AND c1.created_at = (
      SELECT MIN(c2.created_at)
      FROM candidates c2
      WHERE c2.email = c1.email
  )
UNION
SELECT 
    c1.id,
    c1.name,
    c1.email,
    c1.phone,
    c1.job_id,
    c1.stage,
    c1.created_at,
    'KEPT - Oldest by Phone' as reason
FROM candidates c1
WHERE c1.phone IS NOT NULL 
  AND c1.phone != ''
  AND c1.email IS NULL
  AND c1.created_at = (
      SELECT MIN(c2.created_at)
      FROM candidates c2
      WHERE c2.phone = c1.phone
  )
ORDER BY created_at DESC;

-- 1.6 Preview candidates that will be DELETED
-- These are the duplicate records that will be removed
SELECT 
    c1.id,
    c1.name,
    c1.email,
    c1.phone,
    c1.job_id,
    c1.stage,
    c1.created_at,
    'DELETED - Duplicate Email' as reason
FROM candidates c1
WHERE c1.email IS NOT NULL 
  AND c1.email != ''
  AND EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.email = c1.email 
        AND c2.created_at < c1.created_at
  )
UNION
SELECT 
    c1.id,
    c1.name,
    c1.email,
    c1.phone,
    c1.job_id,
    c1.stage,
    c1.created_at,
    'DELETED - Duplicate Phone' as reason
FROM candidates c1
WHERE c1.phone IS NOT NULL 
  AND c1.phone != ''
  AND NOT EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.email = c1.email 
        AND c2.created_at < c1.created_at
  )
  AND EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.phone = c1.phone 
        AND c2.created_at < c1.created_at
  )
ORDER BY created_at DESC;


-- ============================================================
-- SECTION 2: DELETE DUPLICATES (DESTRUCTIVE OPERATIONS)
-- ============================================================
-- 
-- WARNING: These queries will permanently delete data!
-- Make sure you have reviewed Section 1 and backed up your database
-- ============================================================

-- 2.1 Create a backup table (RECOMMENDED)
-- This creates a backup of all candidates before deletion
CREATE TABLE IF NOT EXISTS candidates_backup_before_dedup AS
SELECT * FROM candidates;

-- Verify backup was created
SELECT 
    COUNT(*) as total_candidates_backed_up,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM candidates_backup_before_dedup;


-- 2.2 Delete duplicate candidates by EMAIL
-- Keeps the oldest record (earliest created_at), deletes newer ones
-- Using a temporary table to avoid MySQL's "can't specify target table" error
DELETE FROM candidates
WHERE id IN (
    SELECT id FROM (
        SELECT c1.id
        FROM candidates c1
        INNER JOIN candidates c2 ON c2.email = c1.email AND c2.created_at < c1.created_at
        WHERE c1.email IS NOT NULL AND c1.email != ''
    ) AS temp_duplicates
);

-- Check how many were deleted
SELECT ROW_COUNT() as email_duplicates_deleted;


-- 2.3 Delete duplicate candidates by PHONE
-- Only deletes phone duplicates that weren't already handled by email
-- Using a temporary table to avoid MySQL's "can't specify target table" error
DELETE FROM candidates
WHERE id IN (
    SELECT id FROM (
        SELECT c1.id
        FROM candidates c1
        INNER JOIN candidates c2 ON c2.phone = c1.phone AND c2.created_at < c1.created_at
        WHERE c1.phone IS NOT NULL AND c1.phone != ''
    ) AS temp_duplicates
);

-- Check how many were deleted
SELECT ROW_COUNT() as phone_duplicates_deleted;


-- ============================================================
-- SECTION 3: VERIFY RESULTS (POST-DELETION CHECKS)
-- ============================================================

-- 3.1 Verify no email duplicates remain
SELECT 
    email,
    COUNT(*) as count
FROM candidates
WHERE email IS NOT NULL 
  AND email != ''
GROUP BY email
HAVING COUNT(*) > 1;
-- Expected: No rows returned

-- 3.2 Verify no phone duplicates remain
SELECT 
    phone,
    COUNT(*) as count
FROM candidates
WHERE phone IS NOT NULL 
  AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1;
-- Expected: No rows returned

-- 3.3 Compare counts before and after
SELECT 
    'Before Deletion' as status,
    COUNT(*) as total_candidates
FROM candidates_backup_before_dedup
UNION ALL
SELECT 
    'After Deletion' as status,
    COUNT(*) as total_candidates
FROM candidates
UNION ALL
SELECT 
    'Deleted' as status,
    (SELECT COUNT(*) FROM candidates_backup_before_dedup) - 
    (SELECT COUNT(*) FROM candidates) as total_candidates;

-- 3.4 Show remaining candidates by job
SELECT 
    job_id,
    COUNT(*) as candidate_count,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(DISTINCT phone) as unique_phones
FROM candidates
GROUP BY job_id
ORDER BY job_id;


-- ============================================================
-- SECTION 4: CLEANUP (OPTIONAL)
-- ============================================================

-- 4.1 Drop backup table (only after verifying everything is correct)
-- UNCOMMENT ONLY AFTER VERIFICATION
-- DROP TABLE IF EXISTS candidates_backup_before_dedup;


-- ============================================================
-- ALTERNATIVE: DELETE DUPLICATES FOR SPECIFIC JOB ONLY
-- ============================================================
-- If you only want to delete duplicates for a specific job (e.g., Sales job)
-- Use these queries instead of Section 2

-- Find job_id for Sales job
SELECT id, title FROM jobs WHERE title LIKE '%Sales%';

-- Delete duplicates for specific job only (replace 3 with your job_id)
/*
DELETE c1 FROM candidates c1
WHERE c1.job_id = 3  -- Replace with your Sales job_id
  AND c1.email IS NOT NULL 
  AND c1.email != ''
  AND EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.job_id = 3  -- Replace with your Sales job_id
        AND c2.email = c1.email 
        AND c2.created_at < c1.created_at
  );

DELETE c1 FROM candidates c1
WHERE c1.job_id = 3  -- Replace with your Sales job_id
  AND c1.phone IS NOT NULL 
  AND c1.phone != ''
  AND EXISTS (
      SELECT 1 
      FROM candidates c2 
      WHERE c2.job_id = 3  -- Replace with your Sales job_id
        AND c2.phone = c1.phone 
        AND c2.created_at < c1.created_at
  );
*/


-- ============================================================
-- SECTION 5: ADVANCED - DELETE DUPLICATES WITH RELATED DATA
-- ============================================================
-- If you have foreign key constraints or related data in other tables,
-- you may need to delete those first

-- 5.1 Delete related candidate_notes for duplicate candidates
/*
DELETE cn FROM candidate_notes cn
WHERE cn.candidate_id IN (
    SELECT c1.id
    FROM candidates c1
    WHERE c1.email IS NOT NULL 
      AND c1.email != ''
      AND EXISTS (
          SELECT 1 
          FROM candidates c2 
          WHERE c2.email = c1.email 
            AND c2.created_at < c1.created_at
      )
);
*/

-- 5.2 Delete related candidate_assignments for duplicate candidates
/*
DELETE ca FROM candidate_assignments ca
WHERE ca.candidate_id IN (
    SELECT c1.id
    FROM candidates c1
    WHERE c1.email IS NOT NULL 
      AND c1.email != ''
      AND EXISTS (
          SELECT 1 
          FROM candidates c2 
          WHERE c2.email = c1.email 
            AND c2.created_at < c1.created_at
      )
);
*/

-- 5.3 Delete related interviews for duplicate candidates
/*
DELETE i FROM interviews i
WHERE i.candidate_id IN (
    SELECT c1.id
    FROM candidates c1
    WHERE c1.email IS NOT NULL 
      AND c1.email != ''
      AND EXISTS (
          SELECT 1 
          FROM candidates c2 
          WHERE c2.email = c1.email 
            AND c2.created_at < c1.created_at
      )
);
*/


-- ============================================================
-- EXECUTION SUMMARY
-- ============================================================
-- 
-- RECOMMENDED EXECUTION ORDER:
-- 
-- 1. Run all queries in SECTION 1 to identify duplicates
-- 2. Review the results carefully
-- 3. Backup your database (mysqldump or export)
-- 4. Run query 2.1 to create backup table
-- 5. Run queries 2.2 and 2.3 to delete duplicates
-- 6. Run all queries in SECTION 3 to verify results
-- 7. If everything looks good, optionally run 4.1 to drop backup
-- 
-- ROLLBACK PLAN (if something goes wrong):
-- 
-- If you need to restore the data:
-- 
-- DELETE FROM candidates;
-- INSERT INTO candidates SELECT * FROM candidates_backup_before_dedup;
-- 
-- ============================================================
