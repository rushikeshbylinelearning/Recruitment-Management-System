ALTER TABLE assignments
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER status,
  ADD KEY idx_is_active (is_active);
