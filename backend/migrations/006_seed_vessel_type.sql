-- ============================================================
-- Seed vessel_type
-- ============================================================
SET NAMES utf8mb4;

INSERT INTO `vessel_type` (`code`, `name_vi`, `name_en`)
VALUES
  ('BULK',          'Tàu hàng rời',          'Bulk Carrier'),
  ('CONTAINER',     'Tàu container',          'Container Ship'),
  ('TANKER-OIL',    'Tàu chở dầu',            'Oil Tanker'),
  ('TANKER-CHEM',   'Tàu chở hóa chất',       'Chemical Tanker'),
  ('TANKER-GAS',    'Tàu chở khí (LNG/LPG)',  'Gas Tanker (LNG/LPG)'),
  ('GENERAL-CARGO', 'Tàu hàng tổng hợp',      'General Cargo'),
  ('PASSENGER',     'Tàu khách',              'Passenger Ship'),
  ('RORO',          'Tàu Ro-Ro',              'Roll-on/Roll-off'),
  ('TUG',           'Tàu kéo',                'Tug Boat'),
  ('OFFSHORE',      'Tàu dịch vụ ngoài khơi', 'Offshore Support Vessel'),
  ('FISHING',       'Tàu đánh cá',            'Fishing Vessel'),
  ('DREDGER',       'Tàu nạo vét',            'Dredger'),
  ('CRANE',         'Tàu cẩu',                'Crane Vessel'),
  ('BARGE',         'Sà lan',                 'Barge'),
  ('FERRY',         'Phà / Tàu cao tốc',      'Ferry / High-Speed Craft')
ON DUPLICATE KEY UPDATE
  name_vi = VALUES(name_vi),
  name_en = VALUES(name_en);
