-- Add CASCADE DELETE to interviews table foreign keys
-- This ensures that when a candidate or interviewer is deleted, their interviews are also deleted

-- First, drop the existing foreign key constraints
ALTER TABLE interviews 
  DROP FOREIGN KEY IF EXISTS interviews_ibfk_1,
  DROP FOREIGN KEY IF EXISTS interviews_ibfk_2,
  DROP FOREIGN KEY IF EXISTS fk_interviews_candidate,
  DROP FOREIGN KEY IF EXISTS fk_interviews_interviewer;

-- Add the foreign keys back with CASCADE DELETE
ALTER TABLE interviews
  ADD CONSTRAINT fk_interviews_candidate 
    FOREIGN KEY (candidate_id) 
    REFERENCES candidates(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

ALTER TABLE interviews
  ADD CONSTRAINT fk_interviews_interviewer 
    FOREIGN KEY (interviewer_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
