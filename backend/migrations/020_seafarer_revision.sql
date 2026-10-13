-- Migration 020: Lịch sử sửa hồ sơ thuyền viên (bắt buộc lý do) và cỡ giày cho mẫu CV chủ tàu
-- Chạy: mysql -u root marineport < migrations/020_seafarer_revision.sql

-- MySQL 8 không có "ADD COLUMN IF NOT EXISTS" (chỉ MariaDB), nên kiểm tra thủ công để chạy được cả hai.
SET @has_shoe_size = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seafarer' AND COLUMN_NAME = 'shoe_size'
);
SET @ddl = IF(@has_shoe_size = 0,
  'ALTER TABLE seafarer ADD COLUMN shoe_size VARCHAR(10) NULL AFTER pants_size',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `seafarer_revision` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`  INT           NOT NULL,
  `changed_by`   INT           NULL,
  `reason`       VARCHAR(500)  NOT NULL,
  `changes`      JSON          NOT NULL COMMENT '{ "field": [cũ, mới] }',
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_revision_seafarer` (`seafarer_id`, `created_at`),
  FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
