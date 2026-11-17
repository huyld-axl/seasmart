-- Khoá bằng mã PIN là tuỳ chọn của cả văn phòng, quản trị bật / tắt; thời gian tự khoá cũng đặt cho cả văn phòng
-- (docs/mcah-ke-hoach-tai-khoan-tu-tren-xuong.md 3.7). Mặc định bật, 15 phút (Q-T5). Chỉ app máy tính (máy chính).
ALTER TABLE office_info ADD COLUMN IF NOT EXISTS pin_required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE office_info ADD COLUMN IF NOT EXISTS lock_minutes SMALLINT NOT NULL DEFAULT 15 CHECK (lock_minutes BETWEEN 5 AND 60);
