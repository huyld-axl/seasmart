-- Migration 004: Thêm cột deleted_at, created_by, updated_by còn thiếu
-- Chạy: mysql -u root marineport < migrations/004_add_deleted_at_cols.sql

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_center` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_center' AND COLUMN_NAME = 'deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_center` ADD COLUMN `created_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_center' AND COLUMN_NAME = 'created_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_center` ADD COLUMN `updated_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_center' AND COLUMN_NAME = 'updated_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_course` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_course' AND COLUMN_NAME = 'deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_course` ADD COLUMN `created_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_course' AND COLUMN_NAME = 'created_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_course` ADD COLUMN `updated_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_course' AND COLUMN_NAME = 'updated_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_enrollment` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_enrollment' AND COLUMN_NAME = 'deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_enrollment` ADD COLUMN `created_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_enrollment' AND COLUMN_NAME = 'created_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_enrollment` ADD COLUMN `updated_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_enrollment' AND COLUMN_NAME = 'updated_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `seafarer_certificate` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seafarer_certificate' AND COLUMN_NAME = 'deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `seafarer_certificate` ADD COLUMN `created_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seafarer_certificate' AND COLUMN_NAME = 'created_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `seafarer_certificate` ADD COLUMN `updated_by` INT NULL DEFAULT NULL', 'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seafarer_certificate' AND COLUMN_NAME = 'updated_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index để tăng tốc soft delete queries
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_center` ADD INDEX `idx_deleted_at` (deleted_at)', 'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_center' AND INDEX_NAME = 'idx_deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_course` ADD INDEX `idx_deleted_at` (deleted_at)', 'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_course' AND INDEX_NAME = 'idx_deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `training_enrollment` ADD INDEX `idx_deleted_at` (deleted_at)', 'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_enrollment' AND INDEX_NAME = 'idx_deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `seafarer_certificate` ADD INDEX `idx_deleted_at` (deleted_at)', 'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seafarer_certificate' AND INDEX_NAME = 'idx_deleted_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
