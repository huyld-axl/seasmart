-- Chống ghi đè khi hai người cùng sửa (docs/mcah-ke-hoach-desktop-gd3.md 3.4): mỗi bảng sửa qua form có số phiên bản,
-- tự tăng mỗi lần UPDATE. Form gửi lại số đã đọc; khác số hiện tại thì máy chủ trả 409 (utils/row_version.js).
CREATE OR REPLACE FUNCTION bump_row_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['seafarer', 'vessel', 'ship_owner', 'opportunity', 'seafarer_contract', 'contract_bill',
    'export_pack', 'seafarer_certificate', 'voyage', 'seafarer_voyage', 'document_upload', 'user', 'rank', 'port',
    'vessel_type', 'certificate_type', 'contract_type', 'manning_agent', 'training_center', 'office_info']
  LOOP
    IF to_regclass(format('%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1', t);
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_version', t);
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION bump_row_version()', t || '_version', t);
    END IF;
  END LOOP;
END $$;

-- Mã yêu cầu chống tạo trùng: form thêm mới gửi Idempotency-Key; gửi lại cùng mã thì trả đúng kết quả lần trước.
-- Giữ 24 giờ (job dọn hằng ngày).
CREATE TABLE IF NOT EXISTS idempotency_key (
  key TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS idempotency_key_created_at ON idempotency_key (created_at);
