-- Migration 027: Bộ giấy tờ xuất bỏ ký online. Tạo xong là tải về được (PDF, Excel), giấy in ra ký tay.
-- Chạy: mysql -u root marineport < migrations/027_export_pack_no_signing.sql
-- Không bắt buộc để chạy app: chỉ dọn trạng thái cũ và vô hiệu các link ký đã phát.
-- Bảng export_signature và các cột sign_token, status giữ lại, không còn dùng.

ALTER TABLE `export_pack`
  MODIFY COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'DONE' COMMENT 'Không còn dùng (trước đây: trạng thái duyệt và ký)';

UPDATE `export_pack` SET `status` = 'DONE', `sign_token` = NULL, `sign_token_expires_at` = NULL;
