-- Máy chủ dịch vụ MCAH (docs/mcah-ke-hoach-desktop-gd2.md mục 3.2). Mã bí mật chỉ lưu bản băm SHA-256.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  full_name TEXT,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  email_verified_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_token (
  token_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account(id),
  kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE office (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  locked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES account(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE office_machine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES office(id),
  public_key TEXT NOT NULL,
  cert_fingerprint TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX office_machine_active ON office_machine (office_id) WHERE revoked_at IS NULL;

CREATE TABLE office_member (
  office_id UUID NOT NULL REFERENCES office(id),
  account_id UUID NOT NULL REFERENCES account(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  PRIMARY KEY (office_id, account_id)
);
-- Mỗi tài khoản thuộc tối đa một văn phòng đang hoạt động.
CREATE UNIQUE INDEX office_member_one_office ON office_member (account_id) WHERE removed_at IS NULL;

CREATE TABLE invite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  office_id UUID NOT NULL REFERENCES office(id),
  email CITEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES account(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_code (
  code_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account(id),
  challenge TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  auth_time TIMESTAMPTZ NOT NULL,
  -- Mã dự phòng 8 ký tự hiện trên trang "Đã đăng nhập" (dán vào app khi không chuyển về được).
  short_code_hash TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE refresh_token (
  token_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES account(id),
  family_id UUID NOT NULL,
  auth_time TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX refresh_token_family ON refresh_token (family_id);

CREATE TABLE usage (
  id BIGSERIAL PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES office(id),
  kind TEXT NOT NULL CHECK (kind IN ('ai_page', 'vessel_lookup', 'catalog_search')),
  units INTEGER NOT NULL DEFAULT 1,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX usage_office_month ON usage (office_id, created_at);

CREATE TABLE audit (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID,
  office_id UUID,
  action TEXT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chống dò mật khẩu: lần đăng nhập sai theo email và theo IP.
CREATE TABLE login_failure (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX login_failure_recent ON login_failure (created_at);
