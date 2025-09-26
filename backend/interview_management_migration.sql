-- Interview Management Migration
-- This migration adds multi-user notes and ratings system for candidates
-- and removes the single score and notes columns from candidates table

-- =====================================================
-- STEP 1: Create new tables for multi-user system
-- =====================================================

-- Table for candidate notes from multiple users
CREATE TABLE candidate_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  user_id INT NOT NULL,
  user_role ENUM('Recruiter', 'Interviewer', 'HR Manager', 'Admin') NOT NULL,
  note_type ENUM('Pre-Interview', 'Interview', 'Post-Interview', 'General') NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraints
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes for better performance
  KEY idx_candidate_id (candidate_id),
  KEY idx_user_id (user_id),
  KEY idx_user_role (user_role),
  KEY idx_note_type (note_type),
  KEY idx_created_at (created_at),
  KEY idx_candidate_notes_composite (candidate_id, user_role, note_type)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Multi-user notes system for candidates';

-- Table for candidate ratings from multiple users
CREATE TABLE candidate_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  user_id INT NOT NULL,
  user_role ENUM('Recruiter', 'Interviewer', 'HR Manager', 'Admin') NOT NULL,
  rating_type ENUM('Technical', 'Communication', 'Cultural Fit', 'Overall') NOT NULL,
  score DECIMAL(3,2) NOT NULL CHECK (score >= 1.0 AND score <= 5.0),
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraints
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes for better performance
  KEY idx_candidate_id (candidate_id),
  KEY idx_user_id (user_id),
  KEY idx_user_role (user_role),
  KEY idx_rating_type (rating_type),
  KEY idx_score (score),
  KEY idx_created_at (created_at),
  KEY idx_candidate_ratings_composite (candidate_id, user_role, rating_type)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Multi-user ratings system for candidates';

-- =====================================================
-- STEP 2: Migrate existing data before dropping columns
-- =====================================================

-- Migrate existing notes to the new candidate_notes table
INSERT INTO candidate_notes (candidate_id, user_id, user_role, note_type, content, is_private, created_at)
SELECT 
  c.id as candidate_id,
  c.assigned_to as user_id,
  CASE 
    WHEN u.role = 'Recruiter' THEN 'Recruiter'
    WHEN u.role = 'Interviewer' THEN 'Interviewer'
    WHEN u.role = 'HR Manager' THEN 'HR Manager'
    WHEN u.role = 'Admin' THEN 'Admin'
    ELSE 'Recruiter'
  END as user_role,
  'General' as note_type,
  c.notes as content,
  FALSE as is_private,
  c.created_at as created_at
FROM candidates c
LEFT JOIN users u ON c.assigned_to = u.id
WHERE c.notes IS NOT NULL AND c.notes != '';

-- Migrate existing scores to the new candidate_ratings table
INSERT INTO candidate_ratings (candidate_id, user_id, user_role, rating_type, score, created_at)
SELECT 
  c.id as candidate_id,
  c.assigned_to as user_id,
  CASE 
    WHEN u.role = 'Recruiter' THEN 'Recruiter'
    WHEN u.role = 'Interviewer' THEN 'Interviewer'
    WHEN u.role = 'HR Manager' THEN 'HR Manager'
    WHEN u.role = 'Admin' THEN 'Admin'
    ELSE 'Recruiter'
  END as user_role,
  'Overall' as rating_type,
  c.score as score,
  c.created_at as created_at
FROM candidates c
LEFT JOIN users u ON c.assigned_to = u.id
WHERE c.score IS NOT NULL AND c.score > 0;

-- =====================================================
-- STEP 3: Remove old columns from candidates table
-- =====================================================

-- Remove the single notes column
ALTER TABLE candidates DROP COLUMN notes;

-- Remove the single score column
ALTER TABLE candidates DROP COLUMN score;

-- =====================================================
-- STEP 4: Add any additional indexes for performance
-- =====================================================

-- Add composite index for faster queries
CREATE INDEX idx_candidate_notes_lookup ON candidate_notes (candidate_id, user_role, note_type, created_at);
CREATE INDEX idx_candidate_ratings_lookup ON candidate_ratings (candidate_id, user_role, rating_type, created_at);

-- =====================================================
-- STEP 5: Update any existing views or procedures if needed
-- =====================================================

-- Note: The existing candidate_files view should still work as it doesn't depend on notes/score columns
-- No changes needed to existing views or procedures

-- =====================================================
-- VERIFICATION QUERIES (Optional - for testing)
-- =====================================================

-- Verify data migration:
-- SELECT COUNT(*) as total_notes FROM candidate_notes;
-- SELECT COUNT(*) as total_ratings FROM candidate_ratings;
-- SELECT COUNT(*) as candidates_with_notes FROM candidates c WHERE EXISTS (SELECT 1 FROM candidate_notes cn WHERE cn.candidate_id = c.id);
-- SELECT COUNT(*) as candidates_with_ratings FROM candidates c WHERE EXISTS (SELECT 1 FROM candidate_ratings cr WHERE cr.candidate_id = c.id);

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================

-- To rollback this migration:
-- 1. Add back the columns:
--    ALTER TABLE candidates ADD COLUMN notes TEXT COMMENT 'HR remarks and notes about the candidate';
--    ALTER TABLE candidates ADD COLUMN score DECIMAL(3,2) DEFAULT '0.00';
-- 
-- 2. Migrate data back (if needed):
--    UPDATE candidates c SET notes = (SELECT content FROM candidate_notes cn WHERE cn.candidate_id = c.id AND cn.user_role = 'Recruiter' LIMIT 1);
--    UPDATE candidates c SET score = (SELECT score FROM candidate_ratings cr WHERE cr.candidate_id = c.id AND cr.rating_type = 'Overall' LIMIT 1);
-- 
-- 3. Drop the new tables:
--    DROP TABLE candidate_ratings;
--    DROP TABLE candidate_notes;
