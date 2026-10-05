-- ============================================================
-- Seed port - Vietnamese ports + common international ports
-- Requires country table to be seeded first (007)
-- ============================================================
SET NAMES utf8mb4;

INSERT INTO `port` (`un_locode`, `name`, `country_id`)
VALUES
  -- Vietnamese ports
  ('VNHPH', 'Cảng Hải Phòng',                 (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNDAD', 'Cảng Đà Nẵng',                    (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNSGN', 'Cảng Sài Gòn (TP. Hồ Chí Minh)', (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNVUT', 'Cảng Vũng Tàu',                   (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNQNH', 'Cảng Quy Nhơn',                   (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNNHA', 'Cảng Nha Trang',                  (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNHON', 'Cảng Hòn Gai (Quảng Ninh)',       (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNCMT', 'Cảng Cẩm Phả',                    (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNCAT', 'Cảng Cát Lái',                    (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNPHU', 'Cảng Phú Mỹ',                     (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNTHI', 'Cảng Thị Vải',                    (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNVCH', 'Cảng Dung Quất',                  (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNHUI', 'Cảng Chân Mây (Huế)',             (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  ('VNVPH', 'Cảng Vạn Phong',                  (SELECT id FROM country WHERE code='VN' LIMIT 1)),
  -- Singapore
  ('SGSIN', 'Port of Singapore',               (SELECT id FROM country WHERE code='SG' LIMIT 1)),
  -- China
  ('CNSHA', 'Port of Shanghai',                (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNNGB', 'Port of Ningbo-Zhoushan',         (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNTXG', 'Port of Tianjin',                 (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNGZU', 'Port of Guangzhou',               (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNSZX', 'Port of Shenzhen',                (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  -- Japan
  ('JPYOK', 'Port of Yokohama',                (SELECT id FROM country WHERE code='JP' LIMIT 1)),
  ('JPOSA', 'Port of Osaka',                   (SELECT id FROM country WHERE code='JP' LIMIT 1)),
  ('JPNGO', 'Port of Nagoya',                  (SELECT id FROM country WHERE code='JP' LIMIT 1)),
  -- South Korea
  ('KRPUS', 'Port of Busan',                   (SELECT id FROM country WHERE code='KR' LIMIT 1)),
  ('KRINC', 'Port of Incheon',                 (SELECT id FROM country WHERE code='KR' LIMIT 1)),
  -- Malaysia
  ('MYPKG', 'Port Klang',                      (SELECT id FROM country WHERE code='MY' LIMIT 1)),
  ('MYPGU', 'Port of Penang',                  (SELECT id FROM country WHERE code='MY' LIMIT 1)),
  -- Philippines
  ('PHMNL', 'Port of Manila',                  (SELECT id FROM country WHERE code='PH' LIMIT 1)),
  -- Taiwan
  ('TWKHH', 'Port of Kaohsiung',               (SELECT id FROM country WHERE code='TW' LIMIT 1)),
  -- Hong Kong
  ('HKHKG', 'Port of Hong Kong',               (SELECT id FROM country WHERE code='HK' LIMIT 1)),
  -- Indonesia
  ('IDJKT', 'Port of Jakarta (Tanjung Priok)', (SELECT id FROM country WHERE code='ID' LIMIT 1)),
  -- UAE
  ('AEJEA', 'Jebel Ali Port',                  (SELECT id FROM country WHERE code='AE' LIMIT 1)),
  -- Netherlands
  ('NLRTM', 'Port of Rotterdam',               (SELECT id FROM country WHERE code='NL' LIMIT 1)),
  -- Germany
  ('DEHAM', 'Port of Hamburg',                 (SELECT id FROM country WHERE code='DE' LIMIT 1)),
  -- UK
  ('GBFXT', 'Port of Felixstowe',              (SELECT id FROM country WHERE code='GB' LIMIT 1)),
  -- USA
  ('USNYC', 'Port of New York / New Jersey',   (SELECT id FROM country WHERE code='US' LIMIT 1)),
  ('USLAX', 'Port of Los Angeles',             (SELECT id FROM country WHERE code='US' LIMIT 1)),
  -- Australia
  ('AUSYD', 'Port of Sydney',                  (SELECT id FROM country WHERE code='AU' LIMIT 1)),
  ('AUMEL', 'Port of Melbourne',               (SELECT id FROM country WHERE code='AU' LIMIT 1))
ON DUPLICATE KEY UPDATE
  name       = VALUES(name),
  country_id = VALUES(country_id);
