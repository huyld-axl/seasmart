-- Đồng ý lần đầu quét AI (docs/mcah-ke-hoach-desktop-gd4.md 3.8): ảnh giấy tờ chỉ được gửi lên máy chủ MCAH cho AI đọc
-- sau khi người dùng đồng ý một lần (lưu theo tài khoản, dùng cho mọi máy).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ai_consent_at TIMESTAMPTZ;
