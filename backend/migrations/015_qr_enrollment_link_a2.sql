-- ============================================================
-- TASK-A2: Bổ sung cột label, max_uses cho qr_enrollment_link (bảng đã có từ 010)
-- Thêm index idx_qr_token, idx_qr_course; cho phép expires_at NULL
-- Chạy: mysql -u root marineport < backend/migrations/015_qr_enrollment_link_a2.sql
-- ============================================================
SET NAMES utf8mb4;

ALTER TABLE qr_enrollment_link
  ADD COLUMN label VARCHAR(200) NULL COMMENT 'Tên mô tả QR link, VD: QR dán cửa lớp',
  ADD COLUMN max_uses INT NULL COMMENT 'NULL = không giới hạn',
  MODIFY COLUMN expires_at DATETIME NULL COMMENT 'NULL = không hết hạn';

CREATE INDEX idx_qr_token ON qr_enrollment_link(token);
CREATE INDEX idx_qr_course ON qr_enrollment_link(course_id);
