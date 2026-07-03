-- =====================================================
-- PART B — Run this AFTER Part A in phpMyAdmin
-- IMPORTANT: Change the Delimiter field to //
--            (bottom of the SQL tab in phpMyAdmin)
-- =====================================================

CREATE FUNCTION get_legacy_stage_name(
  p_main_stage VARCHAR(50),
  p_sub_stage  VARCHAR(50)
)
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
  DECLARE legacy_name VARCHAR(50);

  IF p_main_stage = 'rejected' THEN
    CASE p_sub_stage
      WHEN 'rejected'             THEN SET legacy_name = 'Rejected';
      WHEN 'on-hold'              THEN SET legacy_name = 'On Hold';
      WHEN 'profile-not-matched'  THEN SET legacy_name = 'Profile Not Matched';
      WHEN 'last-minute-back-out' THEN SET legacy_name = 'Last Minute Back Out';
      ELSE                             SET legacy_name = 'Rejected';
    END CASE;

  ELSEIF p_main_stage = 'interview' THEN
    SET legacy_name = 'Interview';

  ELSEIF p_main_stage = 'follow-up' THEN
    SET legacy_name = 'Follow Up';

  ELSEIF p_main_stage = 'selected' THEN
    SET legacy_name = 'Selected';

  ELSE
    CASE p_main_stage
      WHEN 'applied'   THEN SET legacy_name = 'Applied';
      WHEN 'screening' THEN SET legacy_name = 'Screening';
      WHEN 'offer'     THEN SET legacy_name = 'Offer';
      WHEN 'hired'     THEN SET legacy_name = 'Hired';
      ELSE                  SET legacy_name = 'Applied';
    END CASE;
  END IF;

  RETURN legacy_name;
END//

CREATE TRIGGER candidates_stage_sync_insert
BEFORE INSERT ON candidates
FOR EACH ROW
BEGIN
  IF NEW.main_stage IS NOT NULL THEN
    SET NEW.stage = get_legacy_stage_name(NEW.main_stage, NEW.sub_stage);
  END IF;
END//

CREATE TRIGGER candidates_stage_sync_update
BEFORE UPDATE ON candidates
FOR EACH ROW
BEGIN
  IF NEW.main_stage IS NOT NULL AND (
    NEW.main_stage != OLD.main_stage OR
    COALESCE(NEW.sub_stage, '') != COALESCE(OLD.sub_stage, '') OR
    OLD.main_stage IS NULL
  ) THEN
    SET NEW.stage = get_legacy_stage_name(NEW.main_stage, NEW.sub_stage);
  END IF;
END//
