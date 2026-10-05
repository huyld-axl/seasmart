ALTER TABLE `vessel_revenue`
  ADD COLUMN `other_cost` DECIMAL(15,2) NULL COMMENT 'Chi phí khác' AFTER `penalty_amount`;
