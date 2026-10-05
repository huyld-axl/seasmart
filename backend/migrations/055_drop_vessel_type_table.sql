-- Migration 055: Drop bảng vessel_type
-- Lý do: sau migration 042, vessel.vessel_type chuyển sang VARCHAR free text,
-- FK vessel_type_id đã bị drop. Bảng vessel_type không còn được dùng trong app.
DROP TABLE IF EXISTS `vessel_type`;
