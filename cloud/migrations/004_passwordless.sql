-- Tài khoản từ trên xuống, đăng nhập không mật khẩu (docs/mcah-ke-hoach-tai-khoan-tu-tren-xuong.md 3.1–3.3).
-- Axalize tạo văn phòng + quản trị; quản trị văn phòng tạo nhân viên; đăng nhập bằng Google hoặc mã 6 số gửi qua email.

-- Mã đăng nhập 6 số gửi qua email: chỉ lưu băm, hạn 10 phút, tối đa 5 lần nhập sai. account_id null = email chưa có
-- tài khoản (không gửi thư, chỉ ghi để đếm giới hạn gửi).
CREATE TABLE login_code (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL,
  account_id UUID REFERENCES account(id),
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX login_code_email ON login_code (email, created_at);
CREATE INDEX login_code_ip ON login_code (ip, created_at);

-- Ai tạo tài khoản (Axalize hoặc quản trị văn phòng), lần đăng nhập gần nhất và cách (google / email_code).
ALTER TABLE account ADD COLUMN created_by UUID REFERENCES account(id);
ALTER TABLE account ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE account ADD COLUMN last_login_method TEXT;
-- Không còn mật khẩu (chỉ tài khoản thử nội bộ từng có). Cột giữ lại, dọn ở migration sau.
UPDATE account SET password_hash = NULL;

-- Ghi chú khách hàng (tên công ty, số hợp đồng…) do Axalize nhập khi tạo văn phòng.
ALTER TABLE office ADD COLUMN note TEXT;

-- Lý do khoá, tên văn phòng · email… cho tab Nhật ký của trang quản trị.
ALTER TABLE audit ADD COLUMN detail TEXT;
CREATE INDEX audit_account_action ON audit (account_id, action, created_at);
