-- ============================================================
-- DELETE RECENT IMPORT - PREPARE FOR RE-IMPORT
-- ============================================================
-- 
-- Purpose: Delete the recently imported candidates (12 candidates)
--          so you can re-import all 263 with color detection working
-- 
-- Use Case: You imported 12 candidates without color detection working.
--           Now you want to delete those 12 and re-import all 263
--           with the fixed color detection system.
-- 
-- ⚠️ WARNING: This will delete data! Backup first!
-- 
-- ============================================================

-- ============================================================
-- STEP 1: IDENTIFY RECENT IMPORTS
-- ============================================================

-- Find your Sales job ID
SELECT id, title, created_at
FROM jobs
WHERE title LIKE '%Sales%'
ORDER BY created_at DESC;

-- Preview candidates imported today
SELECT 
    id,
    name,
    email,
    phone,
    stage,
    main_stage,
    sub_stage,
    created_at,
    'Will be DELETED' as action
FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND DATE(created_at) = CURDATE()
ORDER BY created_at DESC;

-- Count candidates imported today
SELECT 
    COUNT(*) as candidates_imported_today
FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND DATE(created_at) = CURDATE();

-- Preview candidates imported in last 2 hours
SELECT 
    id,
    name,
    email,
    phone,
    stage,
    main_stage,
    sub_stage,
    created_at,
    'Will be DELETED' as action
FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND created_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)
ORDER BY created_at DESC;

-- Count candidates imported in last 2 hours
SELECT 
    COUNT(*) as candidates_imported_last_2_hours
FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND created_at > DATE_SUB(NOW(), INTERVAL 2 HOUR);


-- ============================================================
-- STEP 2: CREATE BACKUP
-- ============================================================

CREATE TABLE IF NOT EXISTS candidates_backup_before_recent_delete AS
SELECT * FROM candidates;

-- Verify backup
SELECT 
    COUNT(*) as total_backed_up,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM candidates_backup_before_recent_delete;


-- ============================================================
-- STEP 3: DELETE RECENT IMPORTS
-- ============================================================

-- Option A: Delete candidates imported TODAY
DELETE FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND DATE(created_at) = CURDATE();

-- Check how many were deleted
SELECT ROW_COUNT() as deleted_count;


-- Option B: Delete candidates imported in LAST 2 HOURS
-- (Use this if you imported earlier today)
/*
DELETE FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND created_at > DATE_SUB(NOW(), INTERVAL 2 HOUR);
*/


-- Option C: Delete candidates imported AFTER a specific time
-- (Replace the timestamp with when you started the import)
/*
DELETE FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND created_at > '2026-05-14 10:00:00';  -- Replace with your import time
*/


-- ============================================================
-- STEP 4: VERIFY DELETION
-- ============================================================

-- Check remaining candidates for Sales job
SELECT 
    COUNT(*) as remaining_candidates
FROM candidates
WHERE job_id = 3;  -- Replace with your Sales job_id

-- Show before/after counts
SELECT 
    'BEFORE' as status,
    COUNT(*) as total
FROM candidates_backup_before_recent_delete
WHERE job_id = 3  -- Replace with your Sales job_id
UNION ALL
SELECT 
    'AFTER' as status,
    COUNT(*) as total
FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
UNION ALL
SELECT 
    'DELETED' as status,
    (SELECT COUNT(*) FROM candidates_backup_before_recent_delete WHERE job_id = 3) - 
    (SELECT COUNT(*) FROM candidates WHERE job_id = 3) as total;

-- Verify no candidates imported today remain
SELECT 
    COUNT(*) as should_be_zero
FROM candidates
WHERE job_id = 3  -- Replace with your Sales job_id
  AND DATE(created_at) = CURDATE();


-- ============================================================
-- STEP 5: READY FOR RE-IMPORT
-- ============================================================

-- Your system is now ready for re-import!
-- 
-- Next steps:
-- 1. Go to the application
-- 2. Navigate to Sales job card
-- 3. Click "Bulk Import"
-- 4. Upload your Excel file with 263 candidates
-- 5. Verify "Import all candidates (recommended)" is selected
-- 6. Confirm import
-- 7. Verify color detection is working
-- 
-- Expected result:
-- - All 263 candidates imported
-- - Candidates placed in correct stages based on NAME cell colors
-- - No candidates stuck in "Applied" stage


-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- If you need to restore the deleted candidates:
-- 
-- INSERT INTO candidates 
-- SELECT * FROM candidates_backup_before_recent_delete
-- WHERE job_id = 3  -- Replace with your Sales job_id
--   AND DATE(created_at) = CURDATE()
--   AND id NOT IN (SELECT id FROM candidates);
-- 
-- ============================================================


-- ============================================================
-- CLEANUP (after successful re-import)
-- ============================================================
-- Once you've successfully re-imported and verified:
-- 
-- DROP TABLE IF EXISTS candidates_backup_before_recent_delete;
-- 
-- ============================================================


-- ============================================================
-- ALTERNATIVE: DELETE ALL SALES CANDIDATES (FRESH START)
-- ============================================================
-- If you want to completely start fresh with Sales candidates:

/*
-- Backup first
CREATE TABLE IF NOT EXISTS candidates_backup_sales_fresh_start AS
SELECT * FROM candidates WHERE job_id = 3;

-- Delete ALL Sales candidates
DELETE FROM candidates WHERE job_id = 3;

-- Verify
SELECT COUNT(*) as should_be_zero FROM candidates WHERE job_id = 3;

-- Now you can import all 263 candidates fresh
*/


-- ============================================================
-- EXECUTION SUMMARY
-- ============================================================
-- 
-- RECOMMENDED STEPS:
-- 
-- 1. Run STEP 1 queries to identify recent imports
-- 2. Verify the count matches your expectation (12 candidates)
-- 3. Run STEP 2 to create backup
-- 4. Run STEP 3 to delete recent imports (choose Option A, B, or C)
-- 5. Run STEP 4 to verify deletion
-- 6. Go to application and re-import Excel file
-- 7. After successful re-import, run cleanup in STEP 5
-- 
-- ============================================================
