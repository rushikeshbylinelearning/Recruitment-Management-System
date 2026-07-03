-- Backfill: copy candidates.notes into hr_notes where missing (run via script for author_id resolution)
-- Prefer: node scripts/backfill-candidates-notes-to-hr-notes.js

UPDATE hr_notes
SET interaction_type = 'General Note'
WHERE interaction_type IS NULL
   OR TRIM(interaction_type) = ''
   OR interaction_type = 'Bulk Import';
