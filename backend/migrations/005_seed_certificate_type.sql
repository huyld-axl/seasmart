-- ============================================================
-- Seed certificate_type - STCW & Vietnamese maritime certs
-- ============================================================
SET NAMES utf8mb4;

INSERT INTO `certificate_type`
  (`code`, `name_vi`, `name_en`, `issuing_authority`, `validity_years`, `is_stcw`)
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
ON DUPLICATE KEY UPDATE
  name_vi           = VALUES(name_vi),
  name_en           = VALUES(name_en),
  issuing_authority = VALUES(issuing_authority),
  validity_years    = VALUES(validity_years),
  is_stcw           = VALUES(is_stcw);
