-- ============================================================
-- Seed contract_type & course_type
-- Updated: 2026-04-01 - full 83 courses
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
  -- ── AN TOÀN CƠ BẢN / BASIC SAFETY ──────────────────────────────
  ('CT-ANTI-HARASSMENT',      'Phòng chống quấy rối và bạo lực trên tàu biển',                   'Anti-Harassment and Violence on Board',                          NULL, 1),
  ('CT-IGF-BASIC',            'Cơ bản cho TV làm việc trên tàu nhiên liệu điểm cháy thấp (IGF)', 'Basic Training for Ships Using Low-Flashpoint Fuels (IGF)',      NULL, 5),
  ('CT-IGF-ADV',              'Nâng cao cho TV làm việc trên tàu nhiên liệu điểm cháy thấp (IGF)','Advanced Training for Ships Using Low-Flashpoint Fuels (IGF)',   NULL, 5),
  ('CT-STCW-BASIC',           'An toàn cơ bản',                                                  'STCW Basic Safety Training',                                     (SELECT id FROM certificate_type WHERE code='STCW-BASIC'        LIMIT 1), 5),
  ('CT-PASSENGER-SAFETY',     'An toàn cho nhân viên phục vụ trực tiếp trên tàu khách/Ro-Ro',   'Safety Training for Personnel Serving on Passenger/Ro-Ro Ships', NULL, 1),
  ('CT-OIL-RECEPTION',        'An toàn tiếp nhận tàu dầu',                                       'Oil Tanker Reception Safety',                                    NULL, 2),

  -- ── AN NINH / SECURITY ──────────────────────────────────────────
  ('CT-CSO',                  'Cán bộ an ninh Công ty (CSO)',                                     'Company Security Officer (CSO)',                                  NULL, 3),
  ('CT-SECURITY-AWARE',       'Nhận thức An ninh tàu biển',                                       'Ship Security Awareness',                                        (SELECT id FROM certificate_type WHERE code='SECURITY-AWARE'    LIMIT 1), 1),
  ('CT-SSO',                  'Sỹ quan an ninh tàu biển',                                         'Ship Security Officer (SSO)',                                     (SELECT id FROM certificate_type WHERE code='SSO'               LIMIT 1), 3),
  ('CT-SECURITY-DUTIES',      'Thuyền viên có nhiệm vụ an ninh tàu biển cụ thể',                  'Seafarer with Designated Security Duties',                        NULL, 2),

  -- ── TANKER ──────────────────────────────────────────────────────
  ('CT-TANKER-OIL-BASIC',     'Cơ bản tàu Dầu - tàu Hoá chất',                                   'Oil/Chemical Tanker Basic Training',                             (SELECT id FROM certificate_type WHERE code='TANKER-OIL-BASIC'  LIMIT 1), 3),
  ('CT-TANKER-GAS-BASIC',     'Cơ bản tàu khí hóa lỏng',                                         'Gas Tanker Basic Training',                                      (SELECT id FROM certificate_type WHERE code='TANKER-GAS-BASIC'  LIMIT 1), 3),
  ('CT-TANKER-OIL-ADV',       'Nâng cao tàu dầu',                                                 'Oil Tanker Advanced Training',                                   (SELECT id FROM certificate_type WHERE code='TANKER-OIL-ADV'    LIMIT 1), 5),
  ('CT-TANKER-CHEM-BASIC',    'Cơ bản tàu Hoá chất',                                              'Chemical Tanker Basic Training',                                 (SELECT id FROM certificate_type WHERE code='TANKER-CHEM-BASIC' LIMIT 1), 3),
  ('CT-TANKER-CHEM-ADV',      'Nâng cao tàu hóa chất',                                            'Chemical Tanker Advanced Training',                              (SELECT id FROM certificate_type WHERE code='TANKER-CHEM-ADV'   LIMIT 1), 5),
  ('CT-TANKER-GAS-ADV',       'Nâng cao tàu khí hóa lỏng',                                       'Gas Tanker Advanced Training',                                   (SELECT id FROM certificate_type WHERE code='TANKER-GAS-ADV'    LIMIT 1), 5),
  ('CT-TANKER-OIL-SIM',       'Mô phỏng khai thác hệ thống làm hàng/nước dằn - Tàu dầu',         'Tanker Cargo/Ballast Handling Simulation - Oil',                  NULL, 3),
  ('CT-TANKER-CHEM-SIM',      'Mô phỏng khai thác hệ thống làm hàng/nước dằn - Tàu Hóa chất',    'Tanker Cargo/Ballast Handling Simulation - Chemical',             NULL, 3),
  ('CT-TANKER-GAS-SIM',       'Mô phỏng khai thác hệ thống làm hàng/nước dằn - Tàu Khí hóa lỏng','Tanker Cargo/Ballast Handling Simulation - Gas',                 NULL, 3),

  -- ── Y TẾ / MEDICAL ──────────────────────────────────────────────
  ('CT-MEFA',                 'Sơ cứu y tế (cấp cứu)',                                            'Medical First Aid',                                              (SELECT id FROM certificate_type WHERE code='MEFA'              LIMIT 1), 3),
  ('CT-MC',                   'Chăm sóc y tế',                                                    'Medical Care',                                                   (SELECT id FROM certificate_type WHERE code='MC'                LIMIT 1), 5),
  ('CT-FIRST-AID-ADV',        'Nâng cao kỹ năng sơ cấp cứu trên biển',                            'Advanced First Aid at Sea',                                      NULL, 2),

  -- ── PHÒNG CHÁY / FIREFIGHTING ───────────────────────────────────
  ('CT-AFF',                  'Phòng cháy chữa cháy nâng cao',                                    'Advanced Fire Fighting',                                         (SELECT id FROM certificate_type WHERE code='AFF'               LIMIT 1), 3),

  -- ── XUỒNG CỨU SINH / SURVIVAL CRAFT ────────────────────────────
  ('CT-PSCRB',                'Nghiệp vụ trên bè cứu sinh và xuồng cứu nạn',                      'Proficiency in Survival Craft and Rescue Boats',                 (SELECT id FROM certificate_type WHERE code='PSCRB'             LIMIT 1), 3),
  ('CT-RESCUE-BOAT',          'Xuồng cứu nạn cao tốc',                                            'Fast Rescue Boat',                                               NULL, 2),
  ('CT-LIFEBOAT-CHEO',        'Chèo xuồng',                                                       'Rowing/Lifeboat Handling',                                       NULL, 1),
  ('CT-FREEFALL-LIFEBOAT',    'Xuồng hạ bằng phương pháp rơi tự do',                              'Free-Fall Lifeboat',                                             NULL, 1),

  -- ── QUẢN LÝ / MANAGEMENT ────────────────────────────────────────
  ('CT-DPA',                  'Cán bộ quản lý an toàn công ty tàu biển (DPA)',                     'Designated Person Ashore (DPA)',                                  NULL, 3),
  ('CT-LEADERSHIP-TEAM',      'Kỹ năng lãnh đạo và làm việc theo nhóm',                           'Leadership and Teamworking Skills',                              NULL, 1),
  ('CT-LEADERSHIP-MGT',       'Kỹ năng lãnh đạo và quản lý',                                      'Leadership and Management Skills',                               NULL, 3),
  ('CT-BRM',                  'Quản lý đội ngũ/nguồn lực buồng lái',                              'Bridge Resource Management (BRM)',                               (SELECT id FROM certificate_type WHERE code='BRM'               LIMIT 1), 3),
  ('CT-ERM',                  'Quản lý đội ngũ/nguồn lực buồng máy',                              'Engine Room Resource Management (ERM)',                          (SELECT id FROM certificate_type WHERE code='ERM'               LIMIT 1), 3),
  ('CT-CROWD-MGT',            'Quản lý đám đông đối với tàu khách và tàu khách Ro-Ro',             'Crowd Management on Passenger/Ro-Ro Ships',                      NULL, 1),
  ('CT-CRISIS-MGT',           'Quản lý khủng hoảng và phản ứng của con người trên tàu khách/Ro-Ro','Crisis Management and Human Behaviour on Passenger/Ro-Ro Ships', NULL, 1),
  ('CT-RISK-MGT',             'Quản lý và đánh giá rủi ro',                                       'Risk Assessment and Management',                                 NULL, 1),

  -- ── ĐIỀU HÀNH / NAVIGATION & OPERATIONS ────────────────────────
  ('CT-GMDSS-GOC',            'Hệ thống GMDSS - hạng tổng quát (GOC)',                             'GMDSS General Operator Certificate (GOC)',                        (SELECT id FROM certificate_type WHERE code='GMDSS-GOC'         LIMIT 1), 30),
  ('CT-GMDSS-ROC',            'Hệ thống GMDSS - hạng hạn chế (ROC)',                               'GMDSS Restricted Operator Certificate (ROC)',                     (SELECT id FROM certificate_type WHERE code='GMDSS-ROC'         LIMIT 1), 10),
  ('CT-RADAR-OPS',            'Quan sát và đồ giải Radar mức vận hành',                            'Radar Navigation & Plotting (Operational Level)',                 NULL, 5),
  ('CT-ARPA',                 'ARPA mức vận hành',                                                 'Automatic Radar Plotting Aids (ARPA) - Operational Level',        NULL, 5),
  ('CT-ECDIS',                'Khai thác hệ thống thông tin và chỉ báo Hải đồ điện tử (ECDIS)',    'ECDIS Operation',                                                (SELECT id FROM certificate_type WHERE code='ECDIS'             LIMIT 1), 5),
  ('CT-SHIPHANDLING',         'SHIPHANDLING',                                                      'Ship Handling and Manoeuvring',                                  NULL, 3),
  ('CT-BRIDGE-WATCH-SIM',     'Mô phỏng an toàn trực ca hàng hải',                                 'Navigation Watchkeeping Safety Simulation',                      NULL, 5),
  ('CT-BRIDGE-COMM-SIM',      'Mô phỏng liên lạc buồng lái',                                      'Bridge Communication Simulation',                                NULL, 5),
  ('CT-BRIDGE-MGT-SIM',       'Mô phỏng và quản lý buồng lái',                                    'Bridge Management Simulation',                                   NULL, 3),
  ('CT-ENGINE-MGT-SIM',       'Mô phỏng quản lý buồng máy',                                       'Engine Room Management Simulation',                              NULL, 3),
  ('CT-ENGINE-OPS',           'Khai thác Buồng máy - Buồng lái',                                  'Engine/Bridge Operations',                                       NULL, 2),
  ('CT-BULK-CARRIER',         'Khai thác tàu hàng rời',                                           'Bulk Carrier Operations',                                        NULL, 1),
  ('CT-HIGH-VOLTAGE',         'Khai thác vận hành hệ thống điện trên 1000V',                       'High Voltage Systems Operation (>1000V)',                         NULL, 3),
  ('CT-ME-ENGINE',            'Máy ME',                                                            'Main Engine (ME) Operation',                                     NULL, 3),
  ('CT-FUEL-MGT',             'Giao nhận và quản lý nhiên liệu trên tàu biển',                     'Bunker Management and Delivery',                                 NULL, 1),
  ('CT-CARGO-HATCH',          'Kiểm tra và bảo dưỡng nắp hầm hàng',                               'Hatch Cover Inspection and Maintenance',                         NULL, 2),
  ('CT-DANGEROUS-CARGO',      'Vận chuyển và bảo quản hàng nguy hiểm',                             'Transport and Storage of Dangerous Goods',                       NULL, 2),
  ('CT-POLLUTION-WASTE',      'Phòng ngừa ô nhiễm do rác thải từ tàu biển',                        'Prevention of Pollution by Garbage from Ships',                   NULL, 1),
  ('CT-PASSENGER-CARGO-HULL', 'An toàn hành khách, hàng hóa và tính nguyên vẹn vỏ tàu (khách/Ro-Ro)','Passenger, Cargo and Hull Integrity Safety on Passenger/Ro-Ro', NULL, 2),
  ('CT-MOORING-SAFETY',       'An toàn neo đậu',                                                  'Mooring Safety',                                                 NULL, 3),
  ('CT-CONFINED-SPACE',       'An toàn làm việc trong không gian kín',                             'Safe Working in Enclosed Spaces',                                NULL, 3),
  ('CT-ENGINE-MAINTENANCE',   'Bảo dưỡng máy tàu biển',                                           'Marine Engine Maintenance',                                      NULL, 5),
  ('CT-ACCIDENT-INVESTIGATION','Điều tra tai nạn, sự cố hàng hải',                                'Marine Accident and Incident Investigation',                      NULL, 5),

  -- ── THI / EXAMINATION PREP ──────────────────────────────────────
  ('CT-EXAM-MASTER-3000',     'Thi Thuyền trưởng hạng tàu từ 3000GT trở lên',                     'Master Certificate Examination (≥3000 GT)',                       NULL, NULL),
  ('CT-EXAM-CHIEF-ENG-3000',  'Thi Máy Trưởng hạng tàu từ 3000KW trở lên',                       'Chief Engineer Examination (≥3000 KW)',                           NULL, NULL),
  ('CT-EXAM-OOW-DECK-500',    'Thi SQQL Boong hạng tàu 500 GT đến dưới 3000 GT',                  'OOW Deck Examination (500–3000 GT)',                              NULL, NULL),
  ('CT-EXAM-OOW-DECK-3000',   'Thi SQQL Boong hạng tàu từ 3000 GT trở lên',                       'OOW Deck Examination (≥3000 GT)',                                 NULL, NULL),
  ('CT-EXAM-OOW-ENG-750',     'Thi SQQL Máy hạng tàu từ 750 KW đến dưới 3000 KW',                 'OOW Engine Examination (750–3000 KW)',                            NULL, NULL),
  ('CT-EXAM-OOW-ENG-3000',    'Thi SQQL Máy hạng tàu từ 3000 KW trở lên',                        'OOW Engine Examination (≥3000 KW)',                               NULL, NULL),
  ('CT-EXAM-RATING-DECK',     'Thi SQVH Boong hạng tàu từ 500 GT trở lên',                        'Rating Deck Examination (≥500 GT)',                               NULL, NULL),
  ('CT-EXAM-RATING-ENG',      'Thi SQVH Máy hạng tàu có tổng công suất từ 750 KW trở lên',        'Rating Engine Examination (≥750 KW)',                             NULL, NULL),
  ('CT-MARLINS',              'Luyện thi chứng chỉ Marlins',                                       'Marlins English Test Preparation',                               NULL, 3),

  -- ── NÂNG CAO CHUYÊN NGÀNH ───────────────────────────────────────
  ('CT-COLLEGE-OOW-DECK',     'Cao đẳng nâng cao SQQL Boong hạng tàu từ 3000 GT trở lên',         'Advanced Diploma – OOW Deck (≥3000 GT)',                          NULL, NULL),
  ('CT-COLLEGE-OOW-ENG',      'Cao đẳng nâng cao SQQL Máy hạng tàu từ 3000 GT trở lên',           'Advanced Diploma – OOW Engine (≥3000 GT)',                        NULL, NULL),
  ('CT-PILOT-BASIC',          'Hoa tiêu hàng hải cơ bản',                                         'Basic Maritime Pilot Training',                                  NULL, NULL),
  ('CT-PILOT-ADV',            'Hoa tiêu hàng hải nâng cao',                                       'Advanced Maritime Pilot Training',                               NULL, NULL),
  ('CT-MARITIME-INSPECTION',  'Thanh tra hàng hải',                                               'Maritime Inspection',                                            NULL, 5),

  -- ── ĐÁNH GIÁ / ASSESSOR ─────────────────────────────────────────
  ('CT-IA',                   'Đánh giá viên nội bộ Công ty (IA)',                                  'Internal Auditor (IA)',                                           NULL, 3),
  ('CT-ONBOARD-ASSESSOR',     'Đánh giá viên trên tàu biển',                                       'On-board Assessor',                                              NULL, 2),
  ('CT-ASSESSOR-BEHAVIOR',    'Đánh giá và xác minh năng lực hành vi thuyền viên',                  'Assessment and Verification of Seafarer Behavioural Competency',  NULL, 5),
  ('CT-MARITIME-ASSESSOR',    'Đánh giá viên hàng hải',                                            'Maritime Assessor',                                              NULL, 5),
  ('CT-LEAD-INSTRUCTOR',      'Huấn luyện viên chính',                                             'Lead Instructor / Principal Trainer',                            NULL, 3),

  -- ── AN TOÀN TÀUN KHÁCH / PASSENGER SHIP ────────────────────────
  ('CT-SAFETY-OFFICER',       'Sĩ quan an toàn',                                                  'Safety Officer',                                                 NULL, 3),

  -- ── TIẾNG ANH HÀNG HẢI / MARITIME ENGLISH ──────────────────────
  ('CT-ENGLISH-DECK-L1',      'Tiếng Anh hàng hải chuyên ngành Boong – Level 1',                   'Maritime English – Deck Level 1',                                NULL, 30),
  ('CT-ENGLISH-DECK-L2',      'Tiếng Anh hàng hải chuyên ngành Boong – Level 2',                   'Maritime English – Deck Level 2',                                NULL, 30),
  ('CT-ENGLISH-DECK-L3',      'Tiếng Anh hàng hải chuyên ngành Boong – Level 3',                   'Maritime English – Deck Level 3',                                NULL, 30),
  ('CT-ENGLISH-ENG-L1',       'Tiếng Anh hàng hải chuyên ngành Máy – Level 1',                     'Maritime English – Engine Level 1',                              NULL, 30),
  ('CT-ENGLISH-ENG-L2',       'Tiếng Anh hàng hải chuyên ngành Máy – Level 2',                     'Maritime English – Engine Level 2',                              NULL, 30),
  ('CT-ENGLISH-ENG-L3',       'Tiếng Anh hàng hải chuyên ngành Máy – Level 3',                     'Maritime English – Engine Level 3',                              NULL, 30),

  -- ── NẤU ĂN / CATERING ──────────────────────────────────────────
  ('CT-CATERING',             'Nấu ăn và vệ sinh an toàn thực phẩm',                               'Catering and Food Safety Hygiene',                               NULL, 3)

ON DUPLICATE KEY UPDATE
  name_vi             = VALUES(name_vi),
  name_en             = VALUES(name_en),
  certificate_type_id = VALUES(certificate_type_id),
  duration_days       = VALUES(duration_days);
