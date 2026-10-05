ALTER TABLE `seafarer`
  ADD COLUMN IF NOT EXISTS `gender` CHAR(1) NOT NULL DEFAULT 'M' COMMENT 'Giới tính: M / F' AFTER `date_of_birth`;
