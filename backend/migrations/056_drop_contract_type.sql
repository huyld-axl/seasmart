-- Migration 056: Drop contract_type table và cột contract_type_id
-- Lý do: feature chưa dùng, không có UI nào chọn loại hợp đồng

-- Tìm và drop FK constraint trước (tên auto-generated bởi MySQL)
SET @fk = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employment_contract'
    AND COLUMN_NAME = 'contract_type_id'
    AND REFERENCED_TABLE_NAME = 'contract_type'
  LIMIT 1
);
SET @sql = IF(@fk IS NOT NULL,
  CONCAT('ALTER TABLE `employment_contract` DROP FOREIGN KEY `', @fk, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `employment_contract` DROP COLUMN IF EXISTS `contract_type_id`;
DROP TABLE IF EXISTS `contract_type`;
