-- 079_fix_seafarer_certificate_unique.sql
-- Xóa UNIQUE constraint cũ trên (seafarer_id, certificate_type_id) nếu có,
-- vì nó không xét deleted_at, gây block khi re-add sau soft-delete.
-- Không cần thay bằng gì vì application code đã kiểm soát duplicate.

SET NAMES utf8mb4;

-- Tìm và xóa unique key nếu tồn tại
SET @idx = (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'seafarer_certificate'
    AND NON_UNIQUE = 0
    AND INDEX_NAME != 'PRIMARY'
  LIMIT 1
);

SET @sql_drop = IF(
  @idx IS NOT NULL,
  CONCAT('ALTER TABLE seafarer_certificate DROP INDEX `', @idx, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql_drop;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
