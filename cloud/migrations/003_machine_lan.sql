-- Máy chính mở cổng HTTPS trong mạng văn phòng (docs/mcah-ke-hoach-desktop-gd3.md 3.1): dấu vân tay chứng chỉ (đã có cột
-- cert_fingerprint), tên máy và cổng để máy nhân viên tìm và kiểm đúng máy chính.
ALTER TABLE office_machine ADD COLUMN IF NOT EXISTS lan_name TEXT;
ALTER TABLE office_machine ADD COLUMN IF NOT EXISTS lan_port INTEGER;
ALTER TABLE office_machine ADD COLUMN IF NOT EXISTS lan_updated_at TIMESTAMPTZ;
