-- Migration 021: Tệp tải lên và ảnh từng trang cho AI tách giấy tờ; mở rộng seafarer_document thành "một giấy sau khi tách".
-- Chạy: mysql -u root marineport < migrations/021_document_upload.sql
-- Chạy lại nhiều lần không lỗi, không tạo trùng.
SET NAMES utf8mb4;

-- Một tệp người dùng thả vào hồ sơ thuyền viên.
CREATE TABLE IF NOT EXISTS `document_upload` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`  INT          NOT NULL,
  `file_name`    VARCHAR(255) NOT NULL,
  `mime_type`    VARCHAR(50)  NOT NULL,
  `file_size`    INT          NOT NULL,
  `storage_path` VARCHAR(500) NOT NULL,
  `sha256`       CHAR(64)     NULL COMMENT 'NULL với tệp cũ chưa tính băm',
  `page_count`   SMALLINT     NULL,
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'RECEIVED' COMMENT 'RECEIVED | SPLITTING | READING | DONE | FAILED',
  `error`        VARCHAR(500) NULL,
  `created_by`   INT          NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`   DATETIME     NULL,
  -- 1 khi chưa xoá, NULL khi đã xoá: khoá UNIQUE dưới chỉ chặn trùng tệp chưa xoá (NULL không bị coi là trùng).
  `is_active`    TINYINT AS (NULLIF(`deleted_at` IS NULL, 0)) STORED,
  UNIQUE KEY `uq_upload_sha` (`seafarer_id`, `sha256`, `is_active`),
  INDEX `idx_upload_status` (`status`, `updated_at`),
  CONSTRAINT `fk_upload_seafarer` FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ảnh từng trang (JPEG đã xoay đúng chiều) và loại AI gán cho trang.
CREATE TABLE IF NOT EXISTS `document_upload_page` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `upload_id`  INT          NOT NULL,
  `page_no`    SMALLINT     NOT NULL,
  `image_path` VARCHAR(500) NOT NULL,
  `thumb_path` VARCHAR(500) NOT NULL,
  `width`      SMALLINT     NOT NULL,
  `height`     SMALLINT     NOT NULL,
  `split_type` VARCHAR(30)  NULL COMMENT 'seaman_book_info | seaman_book_duty | certificate | other',
  `split_note` VARCHAR(255) NULL,
  UNIQUE KEY `uq_upload_page` (`upload_id`, `page_no`),
  CONSTRAINT `fk_page_upload` FOREIGN KEY (`upload_id`) REFERENCES `document_upload`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seafarer_document: một giấy = một khoảng trang của một tệp. Giấy mới đọc tệp qua upload_id.
ALTER TABLE `seafarer_document`
  MODIFY COLUMN `file_name`    VARCHAR(255) NULL,
  MODIFY COLUMN `mime_type`    VARCHAR(50)  NULL,
  MODIFY COLUMN `file_size`    INT          NULL,
  MODIFY COLUMN `storage_path` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `upload_id`                   INT         NULL AFTER `seafarer_id`,
  ADD COLUMN IF NOT EXISTS `page_from`                   SMALLINT    NULL AFTER `upload_id`,
  ADD COLUMN IF NOT EXISTS `page_to`                     SMALLINT    NULL AFTER `page_from`,
  ADD COLUMN IF NOT EXISTS `type_source`                 VARCHAR(10) NULL COMMENT 'AI | USER',
  ADD COLUMN IF NOT EXISTS `owner_mismatch`              TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `owner_mismatch_confirmed_by` INT         NULL,
  ADD COLUMN IF NOT EXISTS `vessel_id`                   INT         NULL,
  ADD COLUMN IF NOT EXISTS `vessel_match_status`         VARCHAR(20) NULL COMMENT 'NOT_CHECKED | MATCHED | NOT_FOUND',
  ADD INDEX IF NOT EXISTS `idx_doc_upload` (`upload_id`),
  ADD CONSTRAINT `fk_doc_upload` FOREIGN KEY IF NOT EXISTS (`upload_id`) REFERENCES `document_upload`(`id`),
  ADD CONSTRAINT `fk_doc_vessel` FOREIGN KEY IF NOT EXISTS (`vessel_id`) REFERENCES `vessel`(`id`);

-- Giấy cũ chưa có tệp cha: mỗi dòng cũ thành một document_upload (chưa có ảnh trang, chưa có băm).
INSERT INTO `document_upload` (`seafarer_id`, `file_name`, `mime_type`, `file_size`, `storage_path`, `status`, `error`, `created_by`, `created_at`, `deleted_at`)
SELECT d.`seafarer_id`, d.`file_name`, d.`mime_type`, d.`file_size`, d.`storage_path`,
       IF(d.`status` = 'FAILED', 'FAILED', 'DONE'), d.`error`, d.`created_by`, d.`created_at`, d.`deleted_at`
FROM `seafarer_document` d
WHERE d.`upload_id` IS NULL AND d.`storage_path` IS NOT NULL;

UPDATE `seafarer_document` d
JOIN `document_upload` u
  ON u.`seafarer_id` = d.`seafarer_id` AND u.`storage_path` = d.`storage_path` AND u.`created_at` = d.`created_at`
SET d.`upload_id` = u.`id`, d.`type_source` = IF(d.`doc_type` IS NULL, NULL, 'AI')
WHERE d.`upload_id` IS NULL;
