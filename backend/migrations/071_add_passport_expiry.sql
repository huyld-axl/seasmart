-- Migration 071: Thêm passport_expiry vào bảng seafarer (bị thiếu trong 069)
ALTER TABLE seafarer
  ADD COLUMN IF NOT EXISTS passport_expiry DATE NULL AFTER passport_issued_date;
