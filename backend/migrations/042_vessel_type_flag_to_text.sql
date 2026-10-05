-- Migration 042: vessel_type_id / flag_country_id -> vessel_type / flag_country (VARCHAR, free text từ JSON)
-- 1) Thêm cột text
ALTER TABLE `vessel` ADD COLUMN IF NOT EXISTS `vessel_type` VARCHAR(255) NULL AFTER `vessel_name_prev`;
ALTER TABLE `vessel` ADD COLUMN IF NOT EXISTS `flag_country` VARCHAR(255) NULL AFTER `vessel_type`;

-- 2) Backfill từ master cũ (ghi đè chỉ khi cột text đang trống và còn FK int)
UPDATE `vessel` v
LEFT JOIN `vessel_type` vt ON vt.id = v.`vessel_type_id`
SET v.`vessel_type` = COALESCE(
  NULLIF(TRIM(v.`vessel_type`), ''),
  NULLIF(TRIM(COALESCE(vt.name_en, vt.name_vi, vt.code)), '')
)
WHERE v.`vessel_type_id` IS NOT NULL;

UPDATE `vessel` v
LEFT JOIN `country` c ON c.id = v.`flag_country_id`
SET v.`flag_country` = COALESCE(
  NULLIF(TRIM(v.`flag_country`), ''),
  NULLIF(TRIM(COALESCE(c.name_en, c.name_vi, c.code)), '')
)
WHERE v.`flag_country_id` IS NOT NULL;

-- 3) Gỡ FK trên 2 cột int (tên constraint có thể khác giữa DB - dùng biến)
SET @fk_vt = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vessel'
    AND COLUMN_NAME = 'vessel_type_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @sql_vt = IF(@fk_vt IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `vessel` DROP FOREIGN KEY `', @fk_vt, '`'));
PREPARE _stmt_vt FROM @sql_vt;
EXECUTE _stmt_vt;
DEALLOCATE PREPARE _stmt_vt;

SET @fk_fc = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vessel'
    AND COLUMN_NAME = 'flag_country_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @sql_fc = IF(@fk_fc IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `vessel` DROP FOREIGN KEY `', @fk_fc, '`'));
PREPARE _stmt_fc FROM @sql_fc;
EXECUTE _stmt_fc;
DEALLOCATE PREPARE _stmt_fc;

-- 4) Xóa cột int cũ
ALTER TABLE `vessel` DROP COLUMN `vessel_type_id`, DROP COLUMN `flag_country_id`;
