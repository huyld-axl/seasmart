-- ============================================================
-- Migration 057: Cho phép NULL trên hầu hết cột certificate_type
-- Chỉ giữ NOT NULL: id (PK), name_vi
-- ============================================================

ALTER TABLE `certificate_type`
  MODIFY COLUMN `code`              VARCHAR(50)   NULL,
  MODIFY COLUMN `name_en`           VARCHAR(200)  NULL,
  MODIFY COLUMN `issuing_authority` VARCHAR(200)  NULL,
  MODIFY COLUMN `validity_years`    SMALLINT      NULL,
  MODIFY COLUMN `is_stcw`           TINYINT(1)    NULL,
  MODIFY COLUMN `category`          ENUM('STCW','VN','DOCUMENT','MEDICAL','PANAMA','OTHER') NULL,
  MODIFY COLUMN `abbreviation`      VARCHAR(30)   NULL,
  MODIFY COLUMN `required_for_ranks` JSON         NULL;
