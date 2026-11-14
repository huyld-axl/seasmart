-- App máy tính, giai đoạn 2 (docs/mcah-ke-hoach-desktop-gd2.md 4.2): tài khoản nằm ở máy chủ dịch vụ, user cục bộ gắn
-- với tài khoản đó; văn phòng của máy chính lưu một dòng. Bản web không dùng hai thứ này.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS cloud_account_id UUID UNIQUE;

CREATE TABLE IF NOT EXISTS office_info (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  office_id UUID NOT NULL,
  name TEXT NOT NULL,
  machine_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
