-- Migration 041: Lưu trực tiếp vùng hoạt động tàu từ dữ liệu ngoài
ALTER TABLE `vessel`
  ADD COLUMN IF NOT EXISTS `trade_area` VARCHAR(255) NULL AFTER `call_sign`;
