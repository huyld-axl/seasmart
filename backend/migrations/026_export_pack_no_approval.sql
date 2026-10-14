-- Migration 026: Bộ giấy tờ xuất bỏ bước duyệt, thêm ô sửa tay trên giấy
-- Chạy: mysql -u root marineport < migrations/026_export_pack_no_approval.sql

ALTER TABLE `export_pack`
  ADD COLUMN `edits` JSON NULL COMMENT 'Ô sửa tay trên từng giấy: { mẫu: { ô: nội dung } }' AFTER `inputs`,
  MODIFY COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'SIGNING' COMMENT 'SIGNING|DONE|STALE',
  MODIFY COLUMN `inputs` JSON NULL COMMENT 'Thông tin điền thêm của các giấy trong bộ';

-- Bộ bị trả lại: chuyển sang cần làm lại, giữ lý do.
UPDATE `export_pack`
   SET `status` = 'STALE', `stale_reason` = LEFT(CONCAT('Bị trả lại: ', COALESCE(`reject_reason`, '')), 500)
 WHERE `status` = 'REJECTED';

-- Bộ đang chờ duyệt mà không có giấy nào cần ký (chỉ có CV chủ tàu): xong luôn.
UPDATE `export_pack` p
   SET p.`status` = 'DONE'
 WHERE p.`status` = 'PENDING_APPROVAL'
   AND NOT EXISTS (SELECT 1 FROM `export_pack_doc` d WHERE d.`pack_id` = p.`id` AND d.`template_key` <> 'cv');

-- Bộ đang chờ duyệt còn lại: sang ký, cấp link ký 72 giờ.
UPDATE `export_pack`
   SET `status` = 'SIGNING',
       `sign_token` = SHA2(CONCAT(UUID(), RAND(), `id`), 256),
       `sign_token_expires_at` = DATE_ADD(NOW(), INTERVAL 72 HOUR)
 WHERE `status` = 'PENDING_APPROVAL';
