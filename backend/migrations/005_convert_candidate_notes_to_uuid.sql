-- Migration: Convert all tables to use UUID for candidate_id
-- Description: Updates all tables with candidate_id to VARCHAR(36) to match candidates.id

-- Step 1: Update candidate_notes table
ALTER TABLE candidate_notes 
MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL;

-- Step 2: Update communications table
ALTER TABLE communications 
MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL;

-- Step 3: Update interviews table
ALTER TABLE interviews 
MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL;

-- Step 4: Update candidate_notes_ratings table
ALTER TABLE candidate_notes_ratings 
MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL;

-- Step 5: Update file_uploads table (if exists)
ALTER TABLE file_uploads 
MODIFY COLUMN candidate_id VARCHAR(36) NULL;

-- Step 6: Update form_submissions table (if exists)
ALTER TABLE form_submissions 
MODIFY COLUMN candidate_id VARCHAR(36) NULL;

-- Step 7: Update assignments table (if exists)
ALTER TABLE assignments 
MODIFY COLUMN candidate_id VARCHAR(36) NULL;

-- Step 8: Update candidate_assignments table (if exists)
ALTER TABLE candidate_assignments 
MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL;

-- Step 9: Update pre_interview_feedback table (if exists)
ALTER TABLE pre_interview_feedback 
MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL;

-- Step 10: Update post_interview_feedback table (if exists)
ALTER TABLE post_interview_feedback 
MODIFY COLUMN candidate_id VARCHAR(36) NOT NULL;
