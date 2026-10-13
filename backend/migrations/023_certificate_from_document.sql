-- Migration 023: Chứng chỉ đến từ giấy tờ AI đọc: yêu cầu chỉ bắt buộc loại và hạn.
--  - issued_date và certificate_type_id cho phép NULL; tên như trên giấy lưu ở certificate_name_raw.
--  - Thêm no_expiry (không thời hạn), holder_name_raw, source_document_id.
--  - Khoá UNIQUE (seafarer_id, certificate_type_id, issued_date) giữ lại nhưng không còn chặn khi ngày cấp NULL;
--    việc kiểm trùng chuyển sang code (document.service).
-- Chạy: mysql -u root marineport < migrations/023_certificate_from_document.sql
-- Chạy lại nhiều lần không lỗi.
SET NAMES utf8mb4;

ALTER TABLE `seafarer_certificate`
  MODIFY COLUMN `certificate_type_id` INT NULL,
  MODIFY COLUMN `issued_date` DATE NULL,
  ADD COLUMN IF NOT EXISTS `certificate_name_raw` VARCHAR(200) NULL AFTER `certificate_type_id`,
  ADD COLUMN IF NOT EXISTS `no_expiry`            TINYINT(1)   NOT NULL DEFAULT 0 AFTER `expiry_date`,
  ADD COLUMN IF NOT EXISTS `holder_name_raw`      VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `source_document_id`   INT          NULL,
  ADD INDEX IF NOT EXISTS `idx_cert_source_document` (`source_document_id`),
  ADD CONSTRAINT `fk_cert_source_document` FOREIGN KEY IF NOT EXISTS (`source_document_id`) REFERENCES `seafarer_document`(`id`);
