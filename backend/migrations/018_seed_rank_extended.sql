-- Bổ sung rank từ file data import (data-1712759651518.xlsx)
-- 38 chức danh chưa có trong 001_seed_rank.sql

INSERT INTO `rank` (code, name_vi, name_en, department, rank_level) VALUES
-- DECK
('2O_DECK',    'Sỹ quan boong',                  'Deck Officer',                   'DECK',     1),
('AB2',        'Thủy thủ trực ca AB',            'Able Seaman AB',                 'DECK',     2),
('OS2',        'Thủy thủ trực ca OS',            'Ordinary Seaman OS',             'DECK',     2),
('THU_THU',    'Thuỷ thủ',                       'Seaman',                         'DECK',     2),
('THU_THU_TR', 'Thuỷ thủ trưởng',               'Bosun',                          'DECK',     2),
('TT_TT',      'Thực tập thủy thủ',              'Trainee Seaman',                 'DECK',     3),
('TT_TT_AB',   'Thực tập thủy thủ trực ca AB',  'Trainee AB',                     'DECK',     3),
('TS_CAPT',    'Tập sự thuyền trưởng',           'Captain Trainee',                'DECK',     3),
('TS_BOONG',   'Tập sự sỹ quan boong',           'Deck Officer Trainee',           'DECK',     3),
('SUPDT',      'Đại diện chủ tàu',               'Superintendent',                 'DECK',     1),
-- ENGINE
('2E_OFF',     'Sỹ quan máy',                    'Marine Engineer Officer',        'ENGINE',   1),
('ETO2',       'Sỹ quan điện',                   'Electro-Technical Officer',      'ENGINE',   1),
('EETO',       'Sỹ quan kỹ thuật điện',          'Electrical Engineer Officer',    'ENGINE',   1),
('REFR_OFF',   'Sỹ quan máy lạnh',               'Refrigeration Officer',          'ENGINE',   1),
('PUMP',       'Thợ bơm',                        'Pumpman',                        'ENGINE',   2),
('E_ELECT',    'Thợ kỹ thuật điện',              'Electrical Technician',          'ENGINE',   2),
('FTR_CHF',    'Thợ máy chính',                  'Chief Fitter',                   'ENGINE',   2),
('REFR',       'Thợ máy lạnh',                   'Refrigeration Mechanic',         'ENGINE',   2),
('OLR_W',      'Thợ máy trực ca',                'Oiler (Watch)',                  'ENGINE',   2),
('OLR_AB',     'Thợ máy trực ca AB',             'Oiler AB',                       'ENGINE',   2),
('OLR_OLR',    'Thợ máy trực ca Oiler',          'Oiler',                          'ENGINE',   2),
('TT_FITTER',  'Thực tập thợ máy',               'Trainee Fitter',                 'ENGINE',   3),
('TS_E_ELECT', 'Tập sự thợ kỹ thuật điện',      'Elec. Tech. Trainee',            'ENGINE',   3),
('TS_ETO',     'Tập sự sỹ quan kỹ thuật điện',  'ETO Trainee',                    'ENGINE',   3),
('TS_OLR_AB',  'Tập sự thợ máy trực ca AB',     'Oiler AB Trainee',               'ENGINE',   3),
('TS_OLR_OLR', 'Tập sự thợ máy trực ca Oiler',  'Oiler Trainee',                  'ENGINE',   3),
('TS_OS_ENG',  'Tập sự thủy thủ trực ca OS',    'OS Engine Trainee',              'ENGINE',   3),
-- RADIO
('RADIO_OFF',  'Sỹ quan vô tuyến điện',          'Radio Officer',                  'DECK',     1),
('GMDSS',      'Vô tuyến GMDSS',                 'GMDSS Operator',                 'DECK',     2),
('RADIO_LTD',  'Vô tuyến điện viên hạn chế',    'Restricted Radiotelephone Op.',  'DECK',     2),
('RADIO_NV',   'Nhân viên thông tin vô tuyến',   'Radio Communication Officer',    'DECK',     1),
-- CATERING
('STEWARD',    'Phục vụ viên',                   'Steward',                        'CATERING', 2),
('COOK_ASST',  'Cấp dưỡng',                      'Cook Assistant',                 'CATERING', 2),
('PAX_SVC',    'Nhân viên phục vụ hành khách',   'Passenger Service Staff',        'CATERING', 2),
('PURSER',     'Quản trị',                       'Purser',                         'CATERING', 1),
-- OTHER
('TECH_OFF',   'Cán bộ kỹ thuật',               'Technical Officer',              'ENGINE',   1),
('TRAINER',    'Huấn luyện viên chính',          'Chief Trainer',                  'OTHER',    1)
ON DUPLICATE KEY UPDATE name_vi = VALUES(name_vi), name_en = VALUES(name_en);
