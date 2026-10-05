ALTER TABLE `seafarer_salary`
  ADD COLUMN IF NOT EXISTS `contract_amount` DECIMAL(15,2) NULL COMMENT 'Lương HĐ (override từ job.amount)' AFTER `salary_gross`,
  ADD COLUMN IF NOT EXISTS `advance_payment` DECIMAL(15,2) NULL COMMENT 'Tạm ứng' AFTER `total_deductions`;
