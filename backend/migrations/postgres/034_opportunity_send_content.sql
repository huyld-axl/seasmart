-- Lần gửi chủ tàu giờ do server gửi bằng mail server công ty: lưu đủ nội dung thư (Cc, Bcc, nội dung) để xem lại và kiểm toán.
ALTER TABLE "opportunity_send"
  ADD COLUMN IF NOT EXISTS "cc_emails" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "bcc_emails" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "body" TEXT;
-- Nhiều người nhận: to_email chứa danh sách email cách nhau dấu phẩy.
ALTER TABLE "opportunity_send" ALTER COLUMN "to_email" TYPE TEXT;
COMMENT ON TABLE "opportunity_send" IS 'Lần gửi hồ sơ ứng viên cho chủ tàu (mail server công ty, đính kèm .zip từng người).';
