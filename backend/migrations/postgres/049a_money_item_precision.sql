-- 050 gộp nhiều khoản cũ vào một khoản Khác. Tổng có thể vượt decimal(12,2)
-- dù từng dòng cũ hợp lệ; mở rộng trước khi gộp để giữ nguyên số tiền.
-- Giữ nguyên checksum của 050 cho các máy đã chạy migration đó.
ALTER TABLE contract_item
  ALTER COLUMN receivable_usd TYPE numeric(15,2),
  ALTER COLUMN payable_usd TYPE numeric(15,2);
ALTER TABLE contract_bill_item
  ALTER COLUMN default_usd TYPE numeric(15,2),
  ALTER COLUMN amount_usd TYPE numeric(15,2);
