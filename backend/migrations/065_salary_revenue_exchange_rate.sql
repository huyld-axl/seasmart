ALTER TABLE `seafarer_salary`
  ADD COLUMN IF NOT EXISTS `revenue_exchange_rate` DECIMAL(15,4) NULL COMMENT 'Tỷ giá riêng cho doanh thu chủ tàu'
  AFTER `exchange_rate`;
