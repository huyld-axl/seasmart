SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer_certificate'
    AND column_name = 'place_of_issue'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer_certificate ADD COLUMN place_of_issue VARCHAR(255) NULL AFTER issued_by'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
