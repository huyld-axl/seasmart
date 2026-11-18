-- Báo lỗi từ app máy tính (màn lỗi khởi động): gói log đã ẩn thông tin cá nhân, gửi không cần đăng nhập vì lỗi xảy ra trước đó.
-- bundle = JSON nén gzip {meta, files}; meta tách ra cột để lọc. Chỉ admin khu nội bộ xem được.
CREATE TABLE bug_report (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_code TEXT NOT NULL,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  note TEXT,
  ip TEXT,
  meta JSONB NOT NULL,
  bundle BYTEA NOT NULL
);
CREATE INDEX bug_report_received_idx ON bug_report (received_at DESC);
