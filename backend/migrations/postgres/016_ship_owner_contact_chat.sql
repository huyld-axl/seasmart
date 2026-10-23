-- Kênh chat của người liên hệ đối tác nước ngoài: WhatsApp (số), LINE (ID), WeChat (ID). Zalo dùng số điện thoại sẵn có.
ALTER TABLE "ship_owner_contact"
  ADD COLUMN "whatsapp" varchar(30),
  ADD COLUMN "line_id" varchar(100),
  ADD COLUMN "wechat_id" varchar(100);
