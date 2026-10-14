-- Migration 025: Bộ giấy tờ xuất có thêm "Nộp cho" (chủ tàu nhận bộ giấy)
-- Chạy: mysql -u root marineport < migrations/025_export_pack_ship_owner.sql

ALTER TABLE `export_pack`
  ADD COLUMN `ship_owner_id` INT NULL COMMENT 'Nộp cho: chủ tàu nhận bộ giấy' AFTER `seafarer_id`,
  ADD KEY `idx_pack_ship_owner` (`ship_owner_id`),
  ADD CONSTRAINT `fk_pack_ship_owner` FOREIGN KEY (`ship_owner_id`) REFERENCES `ship_owner`(`id`);
