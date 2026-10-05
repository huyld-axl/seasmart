-- Seed bảng rank từ BẢNG LƯƠNG trong HD-Hong.xlsx
-- Nguồn: sheet "BẢNG LƯƠNG " - V-ISEA Vietnam, 04.04.2023
-- Ghi chú: C.E đổi thành CE cho nhất quán với code ngắn

-- Lưu ý: rank là reserved word trong MySQL/MariaDB, phải dùng backtick
INSERT INTO `rank` (code, name_vi, name_en, department, rank_level) VALUES
-- DECK
('CAPT',         'Thuyền trưởng',       'Captain',                    'DECK',     1),
('CO',           'Đại phó',             'Chief Officer',              'DECK',     1),
('2O',           'Phó hai',             '2nd Officer',                'DECK',     1),
('3O',           'Phó ba',              '3rd Officer',                'DECK',     1),
('BSN',          'Thủy thủ trưởng',     'Bosun',                      'DECK',     2),
('CARP',         'Thủy thủ phó',        'Carpenter',                  'DECK',     2),
('AB',           'Thủy thủ trực ca',    'Able Seaman',                'DECK',     2),
('OSD',          'Thủy thủ thực tập',   'Ordinary Seaman',            'DECK',     2),
('OS',           'Thủy thủ thực tập',   'Ordinary Seaman',            'DECK',     2),
('DCADET',       'Thực tập sỹ quan boong', 'Deck Cadet',              'DECK',     3),
-- ENGINE
('CE',           'Máy trưởng',          'Chief Engineer',             'ENGINE',   1),
('2E',           'Máy hai',             '2nd Engineer',               'ENGINE',   1),
('3E',           'Máy ba',              '3rd Engineer',               'ENGINE',   1),
('4E',           'Máy tư',              '4th Engineer',               'ENGINE',   1),
('ETO',          'Sĩ quan điện',        'Electro-Technical Officer',  'ENGINE',   1),
('ELECT',        'Thợ điện',            'Electrician',                'ENGINE',   2),
('FTR',          'Thợ cả',              'Fitter',                     'ENGINE',   2),
('OLR',          'Thợ máy',             'Oiler',                      'ENGINE',   2),
('WPR',          'Thợ máy thực tập',    'Wiper',                      'ENGINE',   2),
('OSE',          'Thợ máy thực tập',    'Ordinary Seaman Engine',     'ENGINE',   2),
('ENGINE CADET', 'Thực tập sỹ quan máy','Engine Cadet',               'ENGINE',   3),
-- CATERING
('COOK',         'Bếp trưởng',          'Cook',                       'CATERING', 2),
('MESS',         'Phục vụ',             'Messman',                    'CATERING', 2)
ON DUPLICATE KEY UPDATE name_vi = VALUES(name_vi), name_en = VALUES(name_en);
