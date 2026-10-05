-- Thêm ngày hợp đồng và thông tin lương vào bảng seafarer_deployment
ALTER TABLE `seafarer_deployment`
  ADD COLUMN IF NOT EXISTS `contract_start_date` DATE           NULL COMMENT 'Ngày bắt đầu hợp đồng',
  ADD COLUMN IF NOT EXISTS `contract_end_date`   DATE           NULL COMMENT 'Ngày kết thúc hợp đồng',
  ADD COLUMN IF NOT EXISTS `salary`              DECIMAL(15,2)  NULL COMMENT 'Lương thỏa thuận',
  ADD COLUMN IF NOT EXISTS `salary_actual`       DECIMAL(15,2)  NULL COMMENT 'Thực nhận',
  ADD COLUMN IF NOT EXISTS `salary_currency`     VARCHAR(10)    NULL DEFAULT 'USD';
