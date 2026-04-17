-- Migration: Convert candidates table to use UUID primary key
-- Requirements: 4.1, 5.1, 5.2, 5.3
-- Description: Modifies candidates table to use VARCHAR(36) for UUID primary key,
--              removes unique constraint on name field, and adds indexes for performance

-- Step 1: Create a new temporary column for UUID
ALTER TABLE candidates 
ADD COLUMN new_id VARCHAR(36) NULL AFTER id;

-- Step 2: Generate UUIDs for existing records
UPDATE candidates 
SET new_id = UUID();

-- Step 3: Make new_id NOT NULL
ALTER TABLE candidates 
MODIFY COLUMN new_id VARCHAR(36) NOT NULL;

-- Step 4: Remove AUTO_INCREMENT from old id column
ALTER TABLE candidates 
MODIFY COLUMN id INT NOT NULL;

-- Step 5: Drop the old primary key
ALTER TABLE candidates 
DROP PRIMARY KEY;

-- Step 6: Drop the old id column
ALTER TABLE candidates 
DROP COLUMN id;

-- Step 7: Rename new_id to id
ALTER TABLE candidates 
CHANGE COLUMN new_id id VARCHAR(36) NOT NULL;

-- Step 8: Add new primary key on UUID column
ALTER TABLE candidates 
ADD PRIMARY KEY (id);

-- Step 9: Remove unique constraint on name if it exists
-- (Note: Based on the schema, there's no unique constraint on name, but we'll check)
-- ALTER TABLE candidates DROP INDEX name; -- Only if unique constraint exists

-- Step 10: Add indexes for performance optimization
ALTER TABLE candidates 
ADD INDEX idx_email (email);

ALTER TABLE candidates 
ADD INDEX idx_phone (phone);

ALTER TABLE candidates 
ADD INDEX idx_name (name);

ALTER TABLE candidates 
ADD INDEX idx_applied_date (applied_date);

-- Step 11: Modify email and phone to allow NULL (for flexible import)
ALTER TABLE candidates 
MODIFY COLUMN email VARCHAR(100) NULL;

ALTER TABLE candidates 
MODIFY COLUMN phone VARCHAR(20) NULL;

-- Step 11: Modify other NOT NULL fields to allow NULL (for flexible import)
ALTER TABLE candidates 
MODIFY COLUMN position VARCHAR(200) NULL;

ALTER TABLE candidates 
MODIFY COLUMN source VARCHAR(100) NULL;

ALTER TABLE candidates 
MODIFY COLUMN applied_date DATE NULL DEFAULT (CURRENT_DATE);
