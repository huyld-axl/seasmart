-- Migration 011: Lịch sử sửa hồ sơ thuyền viên (bắt buộc lý do) và cỡ giày cho mẫu CV chủ tàu
-- Chạy: mysql -u root marineport < migrations/011_seafarer_revision.sql

ALTER TABLE seafarer
  ADD COLUMN IF NOT EXISTS shoe_size VARCHAR(10) NULL AFTER pants_size;

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
