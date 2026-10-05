ALTER TABLE `seafarer_salary`
  ADD COLUMN `working_days` TINYINT UNSIGNED NULL COMMENT 'Số ngày làm việc trong tháng' AFTER `salary_gross`;
