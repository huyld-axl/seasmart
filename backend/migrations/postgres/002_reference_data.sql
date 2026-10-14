-- Reference catalogs only; no accounts or personal records.
INSERT INTO "rank" (code, name_vi, name_en, department, rank_level) VALUES

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

('COOK',         'Bếp trưởng',          'Cook',                       'CATERING', 2),
('MESS',         'Phục vụ',             'Messman',                    'CATERING', 2)
ON CONFLICT DO NOTHING;

INSERT INTO certificate_type (code, name_vi, name_en, category) VALUES

('BASIC_TRAINING',    'Huấn luyện nghiệp vụ cơ bản',                          'Proficiency in Basic Training',                              'STCW'),
('PSCRB',            'Bè cứu sinh, xuồng cứu nạn',                            'Proficiency in Survival Craft & Rescue Boats',               'STCW'),
('AFF',              'Chữa cháy nâng cao',                                     'Advance Fire Fighting',                                      'STCW'),
('MFA',              'Chăm sóc y tế',                                          'Medical First Aid & Medical Care',                           'STCW'),
('SECURITY_AWARENESS','Nhận thức an ninh tàu biển',                            'Ship Security Awareness',                                    'STCW'),
('SECURITY_DUTIES',  'Thuyền viên có nhiệm vụ an ninh tàu biển cụ thể',       'Seafarer with Designated Security Duties',                   'STCW'),
('SSO',              'Sỹ quan an ninh tàu biển',                               'Ship Security Officer (SSO)',                                'STCW'),
('RADAR_OBSERVATION','Quan sát và đồ giải Radar',                              'Radar Navigation & Plotting',                                'STCW'),
('ARPA',             'Thiết bị đồ giải radar tự động (ARPA)',                  'Automatic Radar Plotting Aids (ARPA)',                       'STCW'),
('GOC',              'Chứng chỉ vô tuyến điện tổng quát (GOC)',               'General Operator Certificate (GOC)',                         'STCW'),
('BRM_ERM',          'Quản lý nguồn lực buồng lái/máy',                       'Bridge/Engine Room Resource Management',                     'STCW'),
('ECDIS',            'Hải đồ điện tử',                                         'Electronic Chart Display and Information System (ECDIS)',    'STCW'),

('COMPETENCY_DECK',  'Bằng khả năng chuyên môn boong',                        'Certificate of Competency (Deck)',                           'VN'),
('COMPETENCY_ENGINE','Bằng khả năng chuyên môn máy',                          'Certificate of Competency (Engine)',                         'VN'),
('COMPETENCY_RADIO', 'Bằng vô tuyến điện viên',                               'Certificate of Competency (Radio)',                          'VN'),
('SHIP_HANDLING',    'Quản lý an toàn tàu biển',                              'Ship''s Handling & Manoeuvring',                             'VN'),
('TANKER_OIL',       'Chứng chỉ tàu dầu',                                     'Tanker Familiarization (Oil)',                               'VN'),
('TANKER_CHEMICAL',  'Chứng chỉ tàu hóa chất',                               'Tanker Familiarization (Chemical)',                          'VN'),
('TANKER_GAS',       'Chứng chỉ tàu khí hóa lỏng',                           'Tanker Familiarization (Gas)',                               'VN'),
('PASSENGER_SHIP',   'Chứng chỉ tàu khách',                                   'Passenger Ship Familiarization',                             'VN'),
('MARITIME_ENGLISH', 'Tiếng Anh hàng hải',                                    'Maritime English',                                           'VN'),
('WATCHKEEPING',     'Chứng chỉ trực ca',                                     'Certificate of Watchkeeping',                                'VN')
ON CONFLICT DO NOTHING;

INSERT INTO "certificate_type"
  ("code", "name_vi", "name_en", "issuing_authority", "validity_years", "is_stcw")
VALUES
  ('STCW-BASIC',        'Huấn luyện cơ bản STCW',                        'STCW Basic Safety Training',                     'Cục Hàng hải Việt Nam', 5,    1),
  ('PSCRB',             'Thành thạo xuồng cứu sinh và bè cứu sinh',       'Proficiency in Survival Craft and Rescue Boats',  'Cục Hàng hải Việt Nam', 5,    1),
  ('AFF',               'Chữa cháy nâng cao',                             'Advanced Fire Fighting',                         'Cục Hàng hải Việt Nam', 5,    1),
  ('MEFA',              'Sơ cứu y tế',                                    'Medical First Aid',                              'Cục Hàng hải Việt Nam', 5,    1),
  ('MC',                'Chăm sóc y tế',                                  'Medical Care',                                   'Cục Hàng hải Việt Nam', 5,    1),
  ('GMDSS-GOC',         'Chứng chỉ vận hành GMDSS tổng quát',             'GMDSS General Operator Certificate',             'Cục Hàng hải Việt Nam', 5,    1),
  ('GMDSS-ROC',         'Chứng chỉ vận hành GMDSS hạn chế',               'GMDSS Restricted Operator Certificate',          'Cục Hàng hải Việt Nam', 5,    1),
  ('OOW-DECK',          'Sĩ quan trực ca boong',                          'Officer in Charge of Navigational Watch',        'Cục Hàng hải Việt Nam', 5,    1),
  ('OOW-ENGINE',        'Sĩ quan trực ca máy',                            'Officer in Charge of Engineering Watch',         'Cục Hàng hải Việt Nam', 5,    1),
  ('CHIEF-MATE',        'Đại phó',                                        'Chief Mate Certificate',                         'Cục Hàng hải Việt Nam', 5,    1),
  ('MASTER',            'Thuyền trưởng',                                  'Master Certificate',                             'Cục Hàng hải Việt Nam', 5,    1),
  ('CHIEF-ENGINEER',    'Máy trưởng',                                     'Chief Engineer Certificate',                     'Cục Hàng hải Việt Nam', 5,    1),
  ('SECOND-ENGINEER',   'Máy hai',                                        'Second Engineer Certificate',                    'Cục Hàng hải Việt Nam', 5,    1),
  ('TANKER-OIL-BASIC',  'Tàu dầu - Huấn luyện cơ bản',                   'Oil Tanker - Basic Training',                    'Cục Hàng hải Việt Nam', 5,    1),
  ('TANKER-OIL-ADV',    'Tàu dầu - Huấn luyện nâng cao',                  'Oil Tanker - Advanced Training',                 'Cục Hàng hải Việt Nam', 5,    1),
  ('TANKER-CHEM-BASIC', 'Tàu hóa chất - Huấn luyện cơ bản',              'Chemical Tanker - Basic Training',               'Cục Hàng hải Việt Nam', 5,    1),
  ('TANKER-CHEM-ADV',   'Tàu hóa chất - Huấn luyện nâng cao',             'Chemical Tanker - Advanced Training',            'Cục Hàng hải Việt Nam', 5,    1),
  ('TANKER-GAS-BASIC',  'Tàu khí - Huấn luyện cơ bản',                   'Gas Tanker - Basic Training',                    'Cục Hàng hải Việt Nam', 5,    1),
  ('TANKER-GAS-ADV',    'Tàu khí - Huấn luyện nâng cao',                  'Gas Tanker - Advanced Training',                 'Cục Hàng hải Việt Nam', 5,    1),
  ('RADAR-ARPA',        'Radar/ARPA',                                     'Radar/ARPA Navigation',                          'Cục Hàng hải Việt Nam', 5,    1),
  ('ECDIS',             'Hải đồ điện tử (ECDIS)',                         'Electronic Chart Display and Information System', 'Cục Hàng hải Việt Nam', 5,    1),
  ('BRM',               'Quản lý nguồn lực buồng lái',                    'Bridge Resource Management',                     'Cục Hàng hải Việt Nam', 5,    1),
  ('ERM',               'Quản lý nguồn lực buồng máy',                    'Engine Room Resource Management',                'Cục Hàng hải Việt Nam', 5,    1),
  ('CROWD-CRISIS',      'Quản lý đám đông và khủng hoảng',                'Crowd Management and Crisis Management',         'Cục Hàng hải Việt Nam', 5,    1),
  ('SECURITY-AWARE',    'Nhận thức an ninh tàu biển',                     'Security Awareness Training',                    'Cục Hàng hải Việt Nam', NULL, 1),
  ('DESIGNATED-SEC',    'Nhân viên an ninh được chỉ định',                 'Designated Security Duties',                     'Cục Hàng hải Việt Nam', 5,    1),
  ('SSO',               'Sĩ quan an ninh tàu',                            'Ship Security Officer',                          'Cục Hàng hải Việt Nam', 5,    1),
  ('MEDICAL-FITNESS',   'Giấy chứng nhận sức khỏe thuyền viên',           'Seafarer Medical Fitness Certificate',           'Bộ Y tế',               2,    0),
  ('SEAMAN-BOOK',       'Sổ thuyền viên',                                 'Seaman Book',                                    'Cục Hàng hải Việt Nam', 10,   0),
  ('WATCHKEEPING-DECK', 'Chứng chỉ trực ca boong (thủy thủ)',             'Watchkeeping Rating (Deck)',                     'Cục Hàng hải Việt Nam', 5,    1)
ON CONFLICT DO NOTHING;

INSERT INTO "vessel_type" ("code", "name_vi", "name_en")
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
ON CONFLICT DO NOTHING;

INSERT INTO "country" ("code", "name_en", "name_vi")
VALUES
  ('VN', 'Vietnam',              'Việt Nam'),
  ('CN', 'China',                'Trung Quốc'),
  ('JP', 'Japan',                'Nhật Bản'),
  ('KR', 'South Korea',          'Hàn Quốc'),
  ('SG', 'Singapore',            'Singapore'),
  ('PH', 'Philippines',          'Philippines'),
  ('MY', 'Malaysia',             'Malaysia'),
  ('ID', 'Indonesia',            'Indonesia'),
  ('TH', 'Thailand',             'Thái Lan'),
  ('TW', 'Taiwan',               'Đài Loan'),
  ('HK', 'Hong Kong',            'Hồng Kông'),
  ('IN', 'India',                'Ấn Độ'),
  ('MM', 'Myanmar',              'Myanmar'),
  ('KH', 'Cambodia',             'Campuchia'),
  ('LA', 'Laos',                 'Lào'),
  ('PA', 'Panama',               'Panama'),
  ('LR', 'Liberia',              'Liberia'),
  ('MH', 'Marshall Islands',     'Quần đảo Marshall'),
  ('BS', 'Bahamas',              'Bahamas'),
  ('CY', 'Cyprus',               'Síp'),
  ('MT', 'Malta',                'Malta'),
  ('AG', 'Antigua and Barbuda',  'Antigua và Barbuda'),
  ('KN', 'Saint Kitts and Nevis','Saint Kitts và Nevis'),
  ('VC', 'Saint Vincent and the Grenadines','Saint Vincent và Grenadines'),
  ('GR', 'Greece',               'Hy Lạp'),
  ('NO', 'Norway',               'Na Uy'),
  ('GB', 'United Kingdom',       'Vương quốc Anh'),
  ('DE', 'Germany',              'Đức'),
  ('NL', 'Netherlands',          'Hà Lan'),
  ('FR', 'France',               'Pháp'),
  ('IT', 'Italy',                'Ý'),
  ('DK', 'Denmark',              'Đan Mạch'),
  ('SE', 'Sweden',               'Thụy Điển'),
  ('FI', 'Finland',              'Phần Lan'),
  ('RU', 'Russia',               'Nga'),
  ('US', 'United States',        'Hoa Kỳ'),
  ('AU', 'Australia',            'Úc'),
  ('NZ', 'New Zealand',          'New Zealand'),
  ('AE', 'United Arab Emirates', 'Các Tiểu vương quốc Ả Rập Thống nhất'),
  ('SA', 'Saudi Arabia',         'Ả Rập Xê Út'),
  ('QA', 'Qatar',                'Qatar'),
  ('KW', 'Kuwait',               'Kuwait'),
  ('BH', 'Bahrain',              'Bahrain'),
  ('OM', 'Oman',                 'Oman'),
  ('EG', 'Egypt',                'Ai Cập'),
  ('ZA', 'South Africa',         'Nam Phi'),
  ('BR', 'Brazil',               'Brazil'),
  ('MX', 'Mexico',               'Mexico'),
  ('CA', 'Canada',               'Canada'),
  ('ES', 'Spain',                'Tây Ban Nha'),
  ('PT', 'Portugal',             'Bồ Đào Nha'),
  ('PL', 'Poland',               'Ba Lan'),
  ('HR', 'Croatia',              'Croatia'),
  ('TR', 'Turkey',               'Thổ Nhĩ Kỳ'),
  ('UA', 'Ukraine',              'Ukraine'),
  ('PK', 'Pakistan',             'Pakistan'),
  ('BD', 'Bangladesh',           'Bangladesh'),
  ('LK', 'Sri Lanka',            'Sri Lanka')
ON CONFLICT DO NOTHING;

INSERT INTO "contract_type" ("code", "name_vi", "name_en")
VALUES
  ('SEAFARER',   'Hợp đồng thuyền viên',             'Seafarer Employment Agreement'),
  ('PROBATION',  'Hợp đồng thử việc',                'Probationary Contract'),
  ('SHORT_TERM', 'Hợp đồng ngắn hạn (< 12 tháng)',   'Short-term Contract'),
  ('LONG_TERM',  'Hợp đồng dài hạn (>= 12 tháng)',   'Long-term Contract'),
  ('INDEFINITE', 'Hợp đồng không xác định thời hạn', 'Indefinite Contract'),
  ('VOYAGE',     'Hợp đồng theo chuyến',             'Voyage Contract')
ON CONFLICT DO NOTHING;


INSERT INTO "course_type" ("code", "name_vi", "name_en", "certificate_type_id", "duration_days")
VALUES
  ('CT-STCW-BASIC',        'Huấn luyện cơ bản STCW',                   'STCW Basic Safety Training',           (SELECT id FROM certificate_type WHERE code='STCW-BASIC'        LIMIT 1), 5),
  ('CT-PSCRB',             'Thành thạo xuồng cứu sinh',                 'Proficiency in Survival Craft',        (SELECT id FROM certificate_type WHERE code='PSCRB'             LIMIT 1), 3),
  ('CT-AFF',               'Chữa cháy nâng cao',                        'Advanced Fire Fighting',               (SELECT id FROM certificate_type WHERE code='AFF'               LIMIT 1), 3),
  ('CT-MEFA',              'Sơ cứu y tế',                               'Medical First Aid',                    (SELECT id FROM certificate_type WHERE code='MEFA'              LIMIT 1), 3),
  ('CT-MC',                'Chăm sóc y tế',                             'Medical Care',                         (SELECT id FROM certificate_type WHERE code='MC'                LIMIT 1), 5),
  ('CT-GMDSS-GOC',         'GMDSS - Chứng chỉ vận hành tổng quát',      'GMDSS General Operator Certificate',   (SELECT id FROM certificate_type WHERE code='GMDSS-GOC'        LIMIT 1), 30),
  ('CT-GMDSS-ROC',         'GMDSS - Chứng chỉ vận hành hạn chế',        'GMDSS Restricted Operator Certificate',(SELECT id FROM certificate_type WHERE code='GMDSS-ROC'        LIMIT 1), 10),
  ('CT-TANKER-OIL-BASIC',  'Tàu dầu - Huấn luyện cơ bản',              'Oil Tanker Basic Training',            (SELECT id FROM certificate_type WHERE code='TANKER-OIL-BASIC' LIMIT 1), 3),
  ('CT-TANKER-OIL-ADV',    'Tàu dầu - Huấn luyện nâng cao',             'Oil Tanker Advanced Training',         (SELECT id FROM certificate_type WHERE code='TANKER-OIL-ADV'  LIMIT 1), 5),
  ('CT-TANKER-CHEM-BASIC', 'Tàu hóa chất - Huấn luyện cơ bản',         'Chemical Tanker Basic Training',       (SELECT id FROM certificate_type WHERE code='TANKER-CHEM-BASIC'LIMIT 1), 3),
  ('CT-TANKER-CHEM-ADV',   'Tàu hóa chất - Huấn luyện nâng cao',        'Chemical Tanker Advanced Training',    (SELECT id FROM certificate_type WHERE code='TANKER-CHEM-ADV' LIMIT 1), 5),
  ('CT-TANKER-GAS-BASIC',  'Tàu khí - Huấn luyện cơ bản',              'Gas Tanker Basic Training',            (SELECT id FROM certificate_type WHERE code='TANKER-GAS-BASIC' LIMIT 1), 3),
  ('CT-TANKER-GAS-ADV',    'Tàu khí - Huấn luyện nâng cao',             'Gas Tanker Advanced Training',         (SELECT id FROM certificate_type WHERE code='TANKER-GAS-ADV'  LIMIT 1), 5),
  ('CT-RADAR-ARPA',        'Radar/ARPA',                                'Radar/ARPA Navigation',                (SELECT id FROM certificate_type WHERE code='RADAR-ARPA'       LIMIT 1), 5),
  ('CT-ECDIS',             'Hải đồ điện tử (ECDIS)',                    'ECDIS Training',                       (SELECT id FROM certificate_type WHERE code='ECDIS'             LIMIT 1), 5),
  ('CT-BRM',               'Quản lý nguồn lực buồng lái',               'Bridge Resource Management',           (SELECT id FROM certificate_type WHERE code='BRM'               LIMIT 1), 3),
  ('CT-ERM',               'Quản lý nguồn lực buồng máy',               'Engine Room Resource Management',      (SELECT id FROM certificate_type WHERE code='ERM'               LIMIT 1), 3),
  ('CT-CROWD-CRISIS',      'Quản lý đám đông và khủng hoảng',           'Crowd Management and Crisis Mgmt',     (SELECT id FROM certificate_type WHERE code='CROWD-CRISIS'     LIMIT 1), 2),
  ('CT-SECURITY-AWARE',    'Nhận thức an ninh tàu biển',                'Security Awareness Training',          (SELECT id FROM certificate_type WHERE code='SECURITY-AWARE'   LIMIT 1), 1),
  ('CT-SSO',               'Sĩ quan an ninh tàu',                       'Ship Security Officer',                (SELECT id FROM certificate_type WHERE code='SSO'               LIMIT 1), 3),
  ('CT-ENGLISH',           'Tiếng Anh hàng hải',                        'Maritime English',                     NULL,                                                                      30),
  ('CT-OOW-DECK',          'Sĩ quan trực ca boong - Tái xác nhận',      'OOW Deck Revalidation',                (SELECT id FROM certificate_type WHERE code='OOW-DECK'         LIMIT 1), 5),
  ('CT-OOW-ENGINE',        'Sĩ quan trực ca máy - Tái xác nhận',        'OOW Engine Revalidation',              (SELECT id FROM certificate_type WHERE code='OOW-ENGINE'       LIMIT 1), 5)
ON CONFLICT DO NOTHING;

INSERT INTO "port" ("un_locode", "name", "country_id")
VALUES
  
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
  
  ('SGSIN', 'Port of Singapore',               (SELECT id FROM country WHERE code='SG' LIMIT 1)),
  
  ('CNSHA', 'Port of Shanghai',                (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNNGB', 'Port of Ningbo-Zhoushan',         (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNTXG', 'Port of Tianjin',                 (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNGZU', 'Port of Guangzhou',               (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  ('CNSZX', 'Port of Shenzhen',                (SELECT id FROM country WHERE code='CN' LIMIT 1)),
  
  ('JPYOK', 'Port of Yokohama',                (SELECT id FROM country WHERE code='JP' LIMIT 1)),
  ('JPOSA', 'Port of Osaka',                   (SELECT id FROM country WHERE code='JP' LIMIT 1)),
  ('JPNGO', 'Port of Nagoya',                  (SELECT id FROM country WHERE code='JP' LIMIT 1)),
  
  ('KRPUS', 'Port of Busan',                   (SELECT id FROM country WHERE code='KR' LIMIT 1)),
  ('KRINC', 'Port of Incheon',                 (SELECT id FROM country WHERE code='KR' LIMIT 1)),
  
  ('MYPKG', 'Port Klang',                      (SELECT id FROM country WHERE code='MY' LIMIT 1)),
  ('MYPGU', 'Port of Penang',                  (SELECT id FROM country WHERE code='MY' LIMIT 1)),
  
  ('PHMNL', 'Port of Manila',                  (SELECT id FROM country WHERE code='PH' LIMIT 1)),
  
  ('TWKHH', 'Port of Kaohsiung',               (SELECT id FROM country WHERE code='TW' LIMIT 1)),
  
  ('HKHKG', 'Port of Hong Kong',               (SELECT id FROM country WHERE code='HK' LIMIT 1)),
  
  ('IDJKT', 'Port of Jakarta (Tanjung Priok)', (SELECT id FROM country WHERE code='ID' LIMIT 1)),
  
  ('AEJEA', 'Jebel Ali Port',                  (SELECT id FROM country WHERE code='AE' LIMIT 1)),
  
  ('NLRTM', 'Port of Rotterdam',               (SELECT id FROM country WHERE code='NL' LIMIT 1)),
  
  ('DEHAM', 'Port of Hamburg',                 (SELECT id FROM country WHERE code='DE' LIMIT 1)),
  
  ('GBFXT', 'Port of Felixstowe',              (SELECT id FROM country WHERE code='GB' LIMIT 1)),
  
  ('USNYC', 'Port of New York / New Jersey',   (SELECT id FROM country WHERE code='US' LIMIT 1)),
  ('USLAX', 'Port of Los Angeles',             (SELECT id FROM country WHERE code='US' LIMIT 1)),
  
  ('AUSYD', 'Port of Sydney',                  (SELECT id FROM country WHERE code='AU' LIMIT 1)),
  ('AUMEL', 'Port of Melbourne',               (SELECT id FROM country WHERE code='AU' LIMIT 1))
ON CONFLICT DO NOTHING;

UPDATE "certificate_type" SET category = 'STCW' WHERE code IN (
  'STCW-BASIC','BASIC_TRAINING','PSCRB','AFF','MEFA','MC','MFA',
  'GMDSS-GOC','GMDSS-ROC','GOC','BRM','ERM','BRM_ERM',
  'RADAR-ARPA','RADAR_OBSERVATION','ARPA','ECDIS',
  'SECURITY-AWARE','SECURITY_AWARENESS','DESIGNATED-SEC','SECURITY_DUTIES','SSO',
  'CROWD-CRISIS','OOW-DECK','OOW-ENGINE','CHIEF-MATE','MASTER',
  'CHIEF-ENGINEER','SECOND-ENGINEER','WATCHKEEPING-DECK','WATCHKEEPING'
);
UPDATE "certificate_type" SET category = 'VN' WHERE code IN (
  'COMPETENCY_DECK','COMPETENCY_ENGINE','COMPETENCY_RADIO',
  'TANKER-OIL-BASIC','TANKER-OIL-ADV','TANKER_OIL',
  'TANKER-CHEM-BASIC','TANKER-CHEM-ADV','TANKER_CHEMICAL',
  'TANKER-GAS-BASIC','TANKER-GAS-ADV','TANKER_GAS',
  'PASSENGER_SHIP','MARITIME_ENGLISH','SHIP_HANDLING','SHIP-HANDLING'
);
UPDATE "certificate_type" SET category = 'DOCUMENT' WHERE code IN (
  'SEAMAN-BOOK','SEAMAN_BOOK'
);
UPDATE "certificate_type" SET category = 'MEDICAL' WHERE code IN (
  'MEDICAL-FITNESS','MEDICAL_FITNESS'
);


UPDATE "certificate_type" SET abbreviation = 'IMO'   WHERE code IN ('STCW-BASIC','BASIC_TRAINING');
UPDATE "certificate_type" SET abbreviation = 'BOAT'  WHERE code IN ('PSCRB');
UPDATE "certificate_type" SET abbreviation = 'AFF'   WHERE code IN ('AFF');
UPDATE "certificate_type" SET abbreviation = 'MFA'   WHERE code IN ('MEFA','MFA','MC');
UPDATE "certificate_type" SET abbreviation = 'GOC'   WHERE code IN ('GMDSS-GOC','GOC');
UPDATE "certificate_type" SET abbreviation = 'BTM'   WHERE code IN ('BRM');
UPDATE "certificate_type" SET abbreviation = 'ERM'   WHERE code IN ('ERM');
UPDATE "certificate_type" SET abbreviation = 'ECDIS' WHERE code IN ('ECDIS');
UPDATE "certificate_type" SET abbreviation = 'RADAR' WHERE code IN ('RADAR-ARPA','RADAR_OBSERVATION');
UPDATE "certificate_type" SET abbreviation = 'ARPA'  WHERE code IN ('ARPA');
UPDATE "certificate_type" SET abbreviation = 'SA'    WHERE code IN ('SECURITY-AWARE','SECURITY_AWARENESS');
UPDATE "certificate_type" SET abbreviation = 'SDSD'  WHERE code IN ('DESIGNATED-SEC','SECURITY_DUTIES');
UPDATE "certificate_type" SET abbreviation = 'SSO'   WHERE code IN ('SSO');
UPDATE "certificate_type" SET abbreviation = 'COC'   WHERE code IN ('COMPETENCY_DECK','COMPETENCY_ENGINE','COMPETENCY_RADIO','MASTER','CHIEF-MATE','CHIEF-ENGINEER','SECOND-ENGINEER','OOW-DECK','OOW-ENGINE');
UPDATE "certificate_type" SET abbreviation = 'SMB'   WHERE code IN ('SEAMAN-BOOK','SEAMAN_BOOK');


INSERT INTO "certificate_type"
  ("code", "name_vi", "name_en", "abbreviation", "category", "issuing_authority", "validity_years", "is_stcw")
VALUES
  
  ('PASSPORT',        'Hộ chiếu phổ thông',                         'International Passport',                         'PP',           'DOCUMENT', 'Cục Quản lý xuất nhập cảnh', 10,   0),
  ('SEAMAN_BOOK',     'Sổ thuyền viên',                             'Seaman Book',                                    'SMB',          'DOCUMENT', 'Cục Hàng hải Việt Nam',      10,   0),

  
  ('ECDIS_TYPE',      'Hải đồ điện tử loại riêng biệt',             'ECDIS Type-Specific Training',                   'ECDIS TYPE',   'STCW',     'Cục Hàng hải Việt Nam',      5,    1),
  ('GOC_ENDO',        'Giấy chứng nhận GOC (endorsement)',           'GOC Endorsement',                                'GOC ENDO',     'STCW',     'Cục Hàng hải Việt Nam',      5,    1),
  ('BTM',             'Quản lý buồng lái',                          'Bridge Team Management',                         'BTM',          'STCW',     'Cục Hàng hải Việt Nam',      5,    1),

  
  ('MEDICAL_FITNESS', 'Giấy chứng nhận sức khỏe thuyền viên',       'Seafarer Medical Fitness Certificate',           'MEDICAL CERT', 'MEDICAL',  'Bộ Y tế',                    2,    0),
  ('YELLOW_FEVER',    'Sổ tiêm chủng vàng da',                      'Yellow Fever Vaccination Certificate',           'YELLOW',       'MEDICAL',  'Bộ Y tế',                    NULL, 0),
  ('CHOLERA',         'Sổ tiêm chủng dịch tả',                      'Cholera Vaccination Certificate',                'CHOLERA',      'MEDICAL',  'Bộ Y tế',                    1,    0),
  ('PANAMA_MEDICAL',  'Giấy chứng nhận sức khỏe Panama',            'Panama Medical Certificate',                     'PANAMA MEDICAL','PANAMA',  'Panama Maritime Authority',  2,    0),

  
  ('PANAMA_COC',      'Bằng chuyên môn Panama',                     'Panama Certificate of Competency',               'PANAMA COC',   'PANAMA',   'Panama Maritime Authority',  5,    0),
  ('PANAMA_SDSD',     'Chứng chỉ nhiệm vụ an ninh Panama',          'Panama Ship Security Duties Certificate',        'PANAMA SDSD',  'PANAMA',   'Panama Maritime Authority',  5,    0),
  ('PANAMA_GOC',      'Chứng chỉ GOC Panama',                       'Panama General Operator Certificate',            'PANAMA GOC',   'PANAMA',   'Panama Maritime Authority',  5,    0),
  ('PANAMA_SSO',      'Chứng chỉ sỹ quan an ninh Panama',           'Panama Ship Security Officer Certificate',       'PANAMA SSO',   'PANAMA',   'Panama Maritime Authority',  5,    0)

ON CONFLICT DO NOTHING;
