-- TASK E1: Bổ sung field hồ sơ cá nhân theo domain spec 2026

-- seafarer.shoe_size
SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'shoe_size'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer ADD COLUMN shoe_size VARCHAR(100) NULL AFTER seaman_book_number'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- seafarer.protective_size
SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'protective_size'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer ADD COLUMN protective_size VARCHAR(100) NULL AFTER shoe_size'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- graduation_level
SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'graduation_level'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer ADD COLUMN graduation_level VARCHAR(50) NULL AFTER english_score'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- graduation_school
SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'graduation_school'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer ADD COLUMN graduation_school VARCHAR(255) NULL AFTER graduation_level'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- graduation_year
SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'graduation_year'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer ADD COLUMN graduation_year SMALLINT NULL AFTER graduation_school'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- personal_bank_account_number
SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'personal_bank_account_number'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer ADD COLUMN personal_bank_account_number VARCHAR(100) NULL AFTER bank_account_holder'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- salary_bank_account_number
SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'salary_bank_account_number'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer ADD COLUMN salary_bank_account_number VARCHAR(100) NULL AFTER personal_bank_account_number'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
