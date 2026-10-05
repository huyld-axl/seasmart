-- Đảm bảo cột vessel_id trên seafarer_deployment (code JOIN COALESCE(sd.vessel_id, j.vessel_id))
-- Môi trường cũ có thể thiếu nếu chưa chạy 026_deployment_vessel_link.sql

ALTER TABLE `seafarer_deployment`
  ADD COLUMN IF NOT EXISTS `vessel_id` INT NULL AFTER `seafarer_id`;
