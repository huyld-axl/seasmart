ALTER TABLE seafarer_education
  ADD COLUMN IF NOT EXISTS major VARCHAR(200) NULL AFTER graduation_level,
  ADD COLUMN IF NOT EXISTS enrollment_year SMALLINT NULL AFTER graduation_year;
