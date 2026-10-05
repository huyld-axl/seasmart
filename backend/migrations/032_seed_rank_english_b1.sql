-- 032_seed_rank_english_b1.sql
-- TASK-B1: reset rank data - chỉ 2 nhóm: Boong (DECK) và Máy (ENGINE)
-- Yêu cầu:
-- 1) Xoá toàn bộ dữ liệu rank cũ trước khi seed lại
-- 2) 20 chức danh; c/cook và Mess thuộc boong (DECK), không dùng department CATERING
-- 3) name_vi = tên tiếng Việt tương đương name_en; name_en giữ thuật ngữ Anh chuẩn

SET NAMES utf8mb4;

-- Backup map rank_id -> code để remap FK sau khi reset
DROP TEMPORARY TABLE IF EXISTS tmp_rank_map;
CREATE TEMPORARY TABLE tmp_rank_map AS
SELECT id, code FROM `rank`;

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM `rank`;
ALTER TABLE `rank` AUTO_INCREMENT = 1;

INSERT INTO `rank` (code, name_vi, name_en, department, rank_level) VALUES
-- Boong (DECK)
('CAPT',         'Thuyền trưởng',              'Captain',                    'DECK',     1),
('CO',           'Đại phó',                     'Chief Officer',              'DECK',     1),
('2O',           'Phó hai',                     '2nd Officer',                'DECK',     1),
('3O',           'Phó ba',                      '3rd Officer',                'DECK',     1),
('BSN',          'Thủy thủ trưởng',             'Bosun',                      'DECK',     2),
('CARP',         'Thợ mộc',                     'Carpenter',                  'DECK',     2),
('AB',           'Thủy thủ lành nghề boong',    'Able Seaman Deck',           'DECK',     2),
('OSD',          'Thủy thủ phổ thông boong',    'Ordinary Seaman Deck',       'DECK',     2),
('COOK',         'Bếp trưởng',                  'Chief Cook',                 'DECK',     2),
('MESS',         'Nhân viên phục vụ',           'Messman',                    'DECK',     2),
('DCADET',       'Thực tập sỹ quan boong',      'Deck Cadet',                 'DECK',     3),

-- Máy (ENGINE)
('CE',           'Máy trưởng',                  'Chief Engineer',             'ENGINE',   1),
('2E',           'Máy hai',                     '2nd Engineer',               'ENGINE',   1),
('3E',           'Máy ba',                      '3rd Engineer',               'ENGINE',   1),
('4E',           'Máy tư',                      '4th Engineer',               'ENGINE',   1),
('FTR',          'Thợ cả',                      'Fitter',                     'ENGINE',   2),
('ETO',          'Sĩ quan kỹ thuật điện',       'Electro-Technical Officer',  'ENGINE',   1),
('ELECT',        'Thợ điện',                   'Electrician / Electrical Engineer', 'ENGINE',   2),
('ABE',          'Thủy thủ lành nghề máy',      'Able Seaman Engine',         'ENGINE',   2),
('OSE',          'Thợ dầu / thủy thủ máy phổ thông', 'Oiler / Ordinary Seaman Engine', 'ENGINE',   2),
('ENGINE CADET', 'Thực tập sỹ quan máy',        'Engine Cadet',               'ENGINE',   3);

-- Remap FK rank_id theo code cũ -> id mới
SET @has_table = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'seafarer'
);
SET @sql_text = IF(
  @has_table > 0,
  'UPDATE seafarer s LEFT JOIN tmp_rank_map m ON m.id = s.current_rank_id LEFT JOIN `rank` r ON r.code = m.code SET s.current_rank_id = r.id WHERE s.current_rank_id IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_table = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'seafarer_rank_history'
);
SET @sql_text = IF(
  @has_table > 0,
  'UPDATE seafarer_rank_history h LEFT JOIN tmp_rank_map m ON m.id = h.rank_id LEFT JOIN `rank` r ON r.code = m.code SET h.rank_id = r.id WHERE h.rank_id IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_table = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'seafarer_deployment'
);
SET @sql_text = IF(
  @has_table > 0,
  'UPDATE seafarer_deployment d LEFT JOIN tmp_rank_map m ON m.id = d.rank_id LEFT JOIN `rank` r ON r.code = m.code SET d.rank_id = r.id WHERE d.rank_id IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_table = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'vessel_cert_requirement'
);
SET @sql_text = IF(
  @has_table > 0,
  'UPDATE vessel_cert_requirement vcr LEFT JOIN tmp_rank_map m ON m.id = vcr.rank_id LEFT JOIN `rank` r ON r.code = m.code SET vcr.rank_id = r.id WHERE vcr.rank_id IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_table = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'deployment_template'
);
SET @sql_text = IF(
  @has_table > 0,
  'UPDATE deployment_template dt LEFT JOIN tmp_rank_map m ON m.id = dt.rank_id LEFT JOIN `rank` r ON r.code = m.code SET dt.rank_id = r.id WHERE dt.rank_id IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_table = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'job'
);
SET @sql_text = IF(
  @has_table > 0,
  'UPDATE job j LEFT JOIN tmp_rank_map m ON m.id = j.rank_id LEFT JOIN `rank` r ON r.code = m.code SET j.rank_id = r.id WHERE j.rank_id IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
