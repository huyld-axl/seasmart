-- Migration 020: Thêm các cột kỹ thuật vào bảng vessel
-- Chạy 1 lần trước khi chạy import_vessels.js

ALTER TABLE `vessel`
  ADD COLUMN IF NOT EXISTS `breadth`         DECIMAL(8,2)  NULL AFTER `length_overall`,
  ADD COLUMN IF NOT EXISTS `depth`           DECIMAL(8,2)  NULL AFTER `breadth`,
  ADD COLUMN IF NOT EXISTS `draft_design`    DECIMAL(8,2)  NULL AFTER `depth`,
  ADD COLUMN IF NOT EXISTS `engine_maker`    VARCHAR(200)  NULL AFTER `engine_type`,
  ADD COLUMN IF NOT EXISTS `engine_model`    VARCHAR(200)  NULL AFTER `engine_maker`,
  ADD COLUMN IF NOT EXISTS `engine_rpm`      SMALLINT      NULL AFTER `engine_model`,
  ADD COLUMN IF NOT EXISTS `photo_url`       VARCHAR(500)  NULL AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `inmarsat_number` VARCHAR(50)   NULL AFTER `photo_url`;
