-- 031_partner_payment_method_account_fields.sql
-- Add payment method and payment account information for partner

ALTER TABLE `partner`
  ADD COLUMN IF NOT EXISTS `payment_method` VARCHAR(100) NULL AFTER `tax_id`,
  ADD COLUMN IF NOT EXISTS `payment_account_name` VARCHAR(255) NULL AFTER `payment_method`,
  ADD COLUMN IF NOT EXISTS `payment_account_number` VARCHAR(100) NULL AFTER `payment_account_name`,
  ADD COLUMN IF NOT EXISTS `payment_bank_name` VARCHAR(255) NULL AFTER `payment_account_number`,
  ADD COLUMN IF NOT EXISTS `payment_bank_branch` VARCHAR(255) NULL AFTER `payment_bank_name`;
