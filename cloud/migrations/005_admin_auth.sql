-- Đăng nhập khu nội bộ /internal (docs/mcah-ke-hoach-khu-noi-bo.md 5.4): một admin, email + mật khẩu (scrypt) + TOTP.
-- Bí mật TOTP mã hoá AES-256-GCM bằng CLOUD_ADMIN_TOTP_KEY; totp_confirmed_at NULL = đang cài dở (chưa có hiệu lực).
-- auth_version tăng khi đặt mật khẩu / reset 2FA: cookie phiên mang số này, khác là mất hiệu lực.
CREATE TABLE admin_auth (
  account_id UUID PRIMARY KEY REFERENCES account(id),
  password_hash TEXT NOT NULL,
  totp_secret_enc BYTEA,
  totp_iv BYTEA,
  totp_tag BYTEA,
  totp_confirmed_at TIMESTAMPTZ,
  totp_last_step BIGINT NOT NULL DEFAULT -1,
  auth_version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mã khôi phục (8 mã, chỉ lưu SHA-256, mỗi mã dùng một lần).
CREATE TABLE admin_recovery_code (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account(id),
  code_hash TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ
);
CREATE INDEX admin_recovery_code_account ON admin_recovery_code (account_id);
