ALTER TABLE `seafarer_salary`
  ADD COLUMN IF NOT EXISTS `bonus_rejoin`      DECIMAL(15,2) NULL COMMENT 'Thưởng Rejoin'           AFTER `advance_payment`,
  ADD COLUMN IF NOT EXISTS `bonus_other`       DECIMAL(15,2) NULL COMMENT 'Thưởng khác'              AFTER `bonus_rejoin`,
  ADD COLUMN IF NOT EXISTS `flag_cert_fee`     DECIMAL(15,2) NULL COMMENT 'Phí làm bằng cờ tàu'     AFTER `doc_fee`,
  ADD COLUMN IF NOT EXISTS `penalty_amount`    DECIMAL(15,2) NULL COMMENT 'Phạt hợp đồng'            AFTER `flag_cert_fee`,
  ADD COLUMN IF NOT EXISTS `visa_fee`          DECIMAL(15,2) NULL COMMENT 'Phí làm visa'             AFTER `penalty_amount`,
  ADD COLUMN IF NOT EXISTS `owner_bonus`       DECIMAL(15,2) NULL COMMENT 'Thưởng từ chủ tàu'        AFTER `visa_fee`,
  ADD COLUMN IF NOT EXISTS `export_labor_fee`  DECIMAL(15,2) NULL COMMENT 'Phí xuất khẩu lao động'   AFTER `owner_bonus`,
  ADD COLUMN IF NOT EXISTS `immigration_fee`   DECIMAL(15,2) NULL COMMENT 'Phí cục XNC'              AFTER `export_labor_fee`,
  ADD COLUMN IF NOT EXISTS `transport_fee`     DECIMAL(15,2) NULL COMMENT 'Phí xe đưa đón TV'        AFTER `immigration_fee`;
