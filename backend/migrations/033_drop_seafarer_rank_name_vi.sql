-- 033_drop_seafarer_rank_name_vi.sql
-- Loai bo cot legacy rank_name_vi khoi bang seafarer

SET @has_column = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'seafarer'
    AND column_name = 'rank_name_vi'
);

SET @sql_text = IF(
  @has_column > 0,
  'ALTER TABLE seafarer DROP COLUMN rank_name_vi',
  'SELECT 1'
);

PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
