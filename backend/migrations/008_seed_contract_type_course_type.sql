-- ============================================================
-- Seed contract_type & course_type
-- ============================================================
SET NAMES utf8mb4;

-- contract_type
INSERT INTO `contract_type` (`code`, `name_vi`, `name_en`)
VALUES
  ('SEAFARER',   'Hợp đồng thuyền viên',             'Seafarer Employment Agreement'),
  ('PROBATION',  'Hợp đồng thử việc',                'Probationary Contract'),
  ('SHORT_TERM', 'Hợp đồng ngắn hạn (< 12 tháng)',   'Short-term Contract'),
  ('LONG_TERM',  'Hợp đồng dài hạn (>= 12 tháng)',   'Long-term Contract'),
  ('INDEFINITE', 'Hợp đồng không xác định thời hạn', 'Indefinite Contract'),
  ('VOYAGE',     'Hợp đồng theo chuyến',             'Voyage Contract')
ON DUPLICATE KEY UPDATE
  name_vi = VALUES(name_vi),
  name_en = VALUES(name_en);

-- course_type (certificate_type_id resolved via subquery)
INSERT INTO `course_type` (`code`, `name_vi`, `name_en`, `certificate_type_id`, `duration_days`)
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
ON DUPLICATE KEY UPDATE
  name_vi             = VALUES(name_vi),
  name_en             = VALUES(name_en),
  certificate_type_id = VALUES(certificate_type_id),
  duration_days       = VALUES(duration_days);
