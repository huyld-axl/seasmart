SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer_contact'
    AND column_name = 'phone'
);
SET @sql_text = IF(
  @has_col > 0,
  'SELECT 1',
  'ALTER TABLE seafarer_contact ADD COLUMN phone VARCHAR(20) NULL AFTER address'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
