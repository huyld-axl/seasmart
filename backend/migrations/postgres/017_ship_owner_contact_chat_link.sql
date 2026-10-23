-- Mã QR của WhatsApp, LINE, WeChat thường chỉ chứa đường dẫn kết bạn (không có số / ID), nên ba ô chat nhận cả đường dẫn.
ALTER TABLE "ship_owner_contact"
  ALTER COLUMN "whatsapp" TYPE varchar(300),
  ALTER COLUMN "line_id" TYPE varchar(300),
  ALTER COLUMN "wechat_id" TYPE varchar(300);
