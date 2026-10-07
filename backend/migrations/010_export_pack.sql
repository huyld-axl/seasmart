-- Migration 010: Bộ giấy tờ xuất cho thuyền viên (B3, B4, C1, C2) và chữ ký
-- Chạy: mysql -u root marineport < migrations/010_export_pack.sql

CREATE TABLE IF NOT EXISTS `export_pack` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`            INT           NOT NULL,
  `title`                  VARCHAR(100)  NOT NULL,
  `status`                 VARCHAR(30)   NOT NULL DEFAULT 'PENDING_APPROVAL' COMMENT 'PENDING_APPROVAL|SIGNING|DONE|REJECTED|STALE',
  `inputs`                 JSON          NULL COMMENT 'Ô điền lúc xuất, dùng chung cho cả bộ',
  `snapshot`               JSON          NULL COMMENT 'Họ tên, ngày sinh, chức danh lúc tạo bộ',
  `reject_reason`          VARCHAR(500)  NULL,
  `stale_reason`           VARCHAR(500)  NULL,
  `sign_token`             CHAR(64)      NULL UNIQUE COMMENT 'Link ký online của thuyền viên',
  `sign_token_expires_at`  DATETIME      NULL,
  `created_by`             INT           NOT NULL,
  `approved_by`            INT           NULL,
  `approved_at`            DATETIME      NULL,
  `created_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`             DATETIME      NULL,
  KEY `idx_pack_seafarer` (`seafarer_id`),
  KEY `idx_pack_status` (`status`),
  FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`),
  FOREIGN KEY (`created_by`)  REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `export_pack_doc` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `pack_id`       INT          NOT NULL,
  `template_key`  VARCHAR(20)  NOT NULL,
  `sort_order`    SMALLINT     NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_pack_doc` (`pack_id`, `template_key`),
  FOREIGN KEY (`pack_id`) REFERENCES `export_pack`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `export_signature` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `pack_id`            INT           NOT NULL,
  `template_key`       VARCHAR(20)   NOT NULL,
  `signer`             VARCHAR(50)   NOT NULL COMMENT 'Vai ký trên giấy: Giám đốc, Thuyền viên...',
  `signed_by_user_id`  INT           NULL COMMENT 'Người ký trong app; NULL khi thuyền viên ký qua link',
  `signature_image`    MEDIUMTEXT    NULL COMMENT 'Ảnh chữ ký PNG (data URL) khi ký qua link',
  `signed_ip`          VARCHAR(45)   NULL,
  `signed_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_signature` (`pack_id`, `template_key`, `signer`),
  FOREIGN KEY (`pack_id`) REFERENCES `export_pack`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
