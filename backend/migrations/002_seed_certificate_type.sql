-- Migration 002: Seed certificate_type
-- Source: STR-05-06 Danh muc bang cap chung chi cua thuyen vien.pdf

ALTER TABLE certificate_type
  ADD COLUMN IF NOT EXISTS category ENUM('STCW','VN','OTHER') NOT NULL DEFAULT 'OTHER';

INSERT INTO certificate_type (code, name_vi, name_en, category) VALUES
-- STCW International (12)
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
-- Vietnam - Cục Hàng hải (10)
('COMPETENCY_DECK',  'Bằng khả năng chuyên môn boong',                        'Certificate of Competency (Deck)',                           'VN'),
('COMPETENCY_ENGINE','Bằng khả năng chuyên môn máy',                          'Certificate of Competency (Engine)',                         'VN'),
('COMPETENCY_RADIO', 'Bằng vô tuyến điện viên',                               'Certificate of Competency (Radio)',                          'VN'),
('SHIP_HANDLING',    'Quản lý an toàn tàu biển',                              'Ship\'s Handling & Manoeuvring',                             'VN'),
('TANKER_OIL',       'Chứng chỉ tàu dầu',                                     'Tanker Familiarization (Oil)',                               'VN'),
('TANKER_CHEMICAL',  'Chứng chỉ tàu hóa chất',                               'Tanker Familiarization (Chemical)',                          'VN'),
('TANKER_GAS',       'Chứng chỉ tàu khí hóa lỏng',                           'Tanker Familiarization (Gas)',                               'VN'),
('PASSENGER_SHIP',   'Chứng chỉ tàu khách',                                   'Passenger Ship Familiarization',                             'VN'),
('MARITIME_ENGLISH', 'Tiếng Anh hàng hải',                                    'Maritime English',                                           'VN'),
('WATCHKEEPING',     'Chứng chỉ trực ca',                                     'Certificate of Watchkeeping',                                'VN')
ON DUPLICATE KEY UPDATE
  name_vi  = VALUES(name_vi),
  name_en  = VALUES(name_en),
  category = VALUES(category);
