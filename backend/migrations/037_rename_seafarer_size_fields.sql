-- TASK E1 follow-up: đổi tên kỹ thuật cho đúng nghiệp vụ
-- document_number -> shoe_size
-- protective_number -> protective_size

SET @has_old = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'document_number'
);
SET @has_new = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'shoe_size'
);
SET @sql_text = IF(
  @has_old > 0 AND @has_new = 0,
  'ALTER TABLE seafarer CHANGE COLUMN document_number shoe_size VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_old = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'protective_number'
);
SET @has_new = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'protective_size'
);
SET @sql_text = IF(
  @has_old > 0 AND @has_new = 0,
  'ALTER TABLE seafarer CHANGE COLUMN protective_number protective_size VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
