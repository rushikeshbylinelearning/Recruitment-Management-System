-- Fix "Instructional Content Writter" typo so job cards and reports use canonical spelling.
-- Affects candidates imported with the common Excel misspelling.

UPDATE candidates
SET position = 'Instructional Content Writer'
WHERE LOWER(TRIM(position)) = 'instructional content writter'
  AND position != 'Instructional Content Writer';

UPDATE candidates
SET position = 'Content Writer'
WHERE LOWER(TRIM(position)) = 'content writter'
  AND position != 'Content Writer';
