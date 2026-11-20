-- Trả lương và tổng bill phải chứa được các khoản đã gộp bởi 050.
ALTER TABLE seafarer_payout ALTER COLUMN bill_total_usd TYPE numeric(15,2);
ALTER TABLE seafarer_payout_item
  ALTER COLUMN default_usd TYPE numeric(15,2),
  ALTER COLUMN amount_usd TYPE numeric(15,2);
