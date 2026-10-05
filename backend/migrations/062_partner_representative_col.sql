ALTER TABLE `partner`
  ADD COLUMN IF NOT EXISTS `representative` VARCHAR(200) NULL COMMENT 'Người đại diện' AFTER `company_name_en`;
