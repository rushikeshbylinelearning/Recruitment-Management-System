-- Migration: Move notes from candidate_notes_ratings to hr_notes
-- Purpose: Consolidate notes into single source of truth (hr_notes table)
-- Date: 2025-01-24

-- Step 1: Migrate existing notes from candidate_notes_ratings to hr_notes
-- Only migrate notes that don't already exist in hr_notes
INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at, updated_at)
SELECT 
    cnr.candidate_id,
    COALESCE(c.stage, 'Applied') as stage,
    cnr.notes as note_text,
    'General Note' as interaction_type,
    cnr.user_id as author_id,
    cnr.created_at,
    cnr.updated_at
FROM candidate_notes_ratings cnr
LEFT JOIN candidates c ON cnr.candidate_id = c.id
WHERE cnr.notes IS NOT NULL 
  AND cnr.notes != ''
  AND NOT EXISTS (
    SELECT 1 FROM hr_notes hn 
    WHERE hn.candidate_id = cnr.candidate_id 
      AND hn.note_text = cnr.notes 
      AND hn.author_id = cnr.user_id
      AND hn.created_at = cnr.created_at
  );

-- Step 2: Verify migration
SELECT 
    'candidate_notes_ratings' as source_table,
    COUNT(*) as total_notes
FROM candidate_notes_ratings
WHERE notes IS NOT NULL AND notes != ''
UNION ALL
SELECT 
    'hr_notes' as source_table,
    COUNT(*) as total_notes
FROM hr_notes;

-- Note: We're keeping candidate_notes_ratings table for backward compatibility
-- and for ratings/recommendations which are not part of hr_notes
-- Only the notes field is being migrated to hr_notes
