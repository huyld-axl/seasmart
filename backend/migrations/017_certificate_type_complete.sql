-- ============================================================
-- Migration 017: Hoàn thiện master data certificate_type
-- Nguồn: BẢNG KÝ HIỆU TÊN CHỨNG CHỈ.CHI.xlsx + STR-05-06
-- ============================================================
SET NAMES utf8mb4;

-- 1. Thêm cột category và abbreviation nếu chưa có
ALTER TABLE `certificate_type`
  ADD COLUMN IF NOT EXISTS `category`     ENUM('STCW','VN','DOCUMENT','MEDICAL','PANAMA','OTHER')
                                          NOT NULL DEFAULT 'OTHER'
                                          COMMENT 'Nhóm chứng chỉ',
  ADD COLUMN IF NOT EXISTS `abbreviation` VARCHAR(30) NULL
                                          COMMENT 'Ký hiệu viết tắt nghiệp vụ (PP, SMB, IMO, AFF...)';

-- 2. Cập nhật category cho các bản ghi đã có
UPDATE `certificate_type` SET category = 'STCW' WHERE code IN (
  'STCW-BASIC','BASIC_TRAINING','PSCRB','AFF','MEFA','MC','MFA',
  'GMDSS-GOC','GMDSS-ROC','GOC','BRM','ERM','BRM_ERM',
  'RADAR-ARPA','RADAR_OBSERVATION','ARPA','ECDIS',
  'SECURITY-AWARE','SECURITY_AWARENESS','DESIGNATED-SEC','SECURITY_DUTIES','SSO',
  'CROWD-CRISIS','OOW-DECK','OOW-ENGINE','CHIEF-MATE','MASTER',
  'CHIEF-ENGINEER','SECOND-ENGINEER','WATCHKEEPING-DECK','WATCHKEEPING'
);
UPDATE `certificate_type` SET category = 'VN' WHERE code IN (
  'COMPETENCY_DECK','COMPETENCY_ENGINE','COMPETENCY_RADIO',
  'TANKER-OIL-BASIC','TANKER-OIL-ADV','TANKER_OIL',
  'TANKER-CHEM-BASIC','TANKER-CHEM-ADV','TANKER_CHEMICAL',
  'TANKER-GAS-BASIC','TANKER-GAS-ADV','TANKER_GAS',
  'PASSENGER_SHIP','MARITIME_ENGLISH','SHIP_HANDLING','SHIP-HANDLING'
);
UPDATE `certificate_type` SET category = 'DOCUMENT' WHERE code IN (
  'SEAMAN-BOOK','SEAMAN_BOOK'
);
UPDATE `certificate_type` SET category = 'MEDICAL' WHERE code IN (
  'MEDICAL-FITNESS','MEDICAL_FITNESS'
);

-- 3. Cập nhật abbreviation cho các bản ghi đã có
UPDATE `certificate_type` SET abbreviation = 'IMO'   WHERE code IN ('STCW-BASIC','BASIC_TRAINING');
UPDATE `certificate_type` SET abbreviation = 'BOAT'  WHERE code IN ('PSCRB');
UPDATE `certificate_type` SET abbreviation = 'AFF'   WHERE code IN ('AFF');
UPDATE `certificate_type` SET abbreviation = 'MFA'   WHERE code IN ('MEFA','MFA','MC');
UPDATE `certificate_type` SET abbreviation = 'GOC'   WHERE code IN ('GMDSS-GOC','GOC');
UPDATE `certificate_type` SET abbreviation = 'BTM'   WHERE code IN ('BRM');
UPDATE `certificate_type` SET abbreviation = 'ERM'   WHERE code IN ('ERM');
UPDATE `certificate_type` SET abbreviation = 'ECDIS' WHERE code IN ('ECDIS');
UPDATE `certificate_type` SET abbreviation = 'RADAR' WHERE code IN ('RADAR-ARPA','RADAR_OBSERVATION');
UPDATE `certificate_type` SET abbreviation = 'ARPA'  WHERE code IN ('ARPA');
UPDATE `certificate_type` SET abbreviation = 'SA'    WHERE code IN ('SECURITY-AWARE','SECURITY_AWARENESS');
UPDATE `certificate_type` SET abbreviation = 'SDSD'  WHERE code IN ('DESIGNATED-SEC','SECURITY_DUTIES');
UPDATE `certificate_type` SET abbreviation = 'SSO'   WHERE code IN ('SSO');
UPDATE `certificate_type` SET abbreviation = 'COC'   WHERE code IN ('COMPETENCY_DECK','COMPETENCY_ENGINE','COMPETENCY_RADIO','MASTER','CHIEF-MATE','CHIEF-ENGINEER','SECOND-ENGINEER','OOW-DECK','OOW-ENGINE');
UPDATE `certificate_type` SET abbreviation = 'SMB'   WHERE code IN ('SEAMAN-BOOK','SEAMAN_BOOK');

-- 4. Thêm các chứng chỉ còn thiếu
INSERT INTO `certificate_type`
  (`code`, `name_vi`, `name_en`, `abbreviation`, `category`, `issuing_authority`, `validity_years`, `is_stcw`)
VALUES
  -- Giấy tờ cơ bản (DOCUMENT)
  ('PASSPORT',        'Hộ chiếu phổ thông',                         'International Passport',                         'PP',           'DOCUMENT', 'Cục Quản lý xuất nhập cảnh', 10,   0),
  ('SEAMAN_BOOK',     'Sổ thuyền viên',                             'Seaman Book',                                    'SMB',          'DOCUMENT', 'Cục Hàng hải Việt Nam',      10,   0),

  -- STCW còn thiếu
  ('ECDIS_TYPE',      'Hải đồ điện tử loại riêng biệt',             'ECDIS Type-Specific Training',                   'ECDIS TYPE',   'STCW',     'Cục Hàng hải Việt Nam',      5,    1),
  ('GOC_ENDO',        'Giấy chứng nhận GOC (endorsement)',           'GOC Endorsement',                                'GOC ENDO',     'STCW',     'Cục Hàng hải Việt Nam',      5,    1),
  ('BTM',             'Quản lý buồng lái',                          'Bridge Team Management',                         'BTM',          'STCW',     'Cục Hàng hải Việt Nam',      5,    1),

  -- Sức khỏe (MEDICAL)
  ('MEDICAL_FITNESS', 'Giấy chứng nhận sức khỏe thuyền viên',       'Seafarer Medical Fitness Certificate',           'MEDICAL CERT', 'MEDICAL',  'Bộ Y tế',                    2,    0),
  ('YELLOW_FEVER',    'Sổ tiêm chủng vàng da',                      'Yellow Fever Vaccination Certificate',           'YELLOW',       'MEDICAL',  'Bộ Y tế',                    NULL, 0),
  ('CHOLERA',         'Sổ tiêm chủng dịch tả',                      'Cholera Vaccination Certificate',                'CHOLERA',      'MEDICAL',  'Bộ Y tế',                    1,    0),
  ('PANAMA_MEDICAL',  'Giấy chứng nhận sức khỏe Panama',            'Panama Medical Certificate',                     'PANAMA MEDICAL','PANAMA',  'Panama Maritime Authority',  2,    0),

  -- Panama (PANAMA)
  ('PANAMA_COC',      'Bằng chuyên môn Panama',                     'Panama Certificate of Competency',               'PANAMA COC',   'PANAMA',   'Panama Maritime Authority',  5,    0),
  ('PANAMA_SDSD',     'Chứng chỉ nhiệm vụ an ninh Panama',          'Panama Ship Security Duties Certificate',        'PANAMA SDSD',  'PANAMA',   'Panama Maritime Authority',  5,    0),
  ('PANAMA_GOC',      'Chứng chỉ GOC Panama',                       'Panama General Operator Certificate',            'PANAMA GOC',   'PANAMA',   'Panama Maritime Authority',  5,    0),
  ('PANAMA_SSO',      'Chứng chỉ sỹ quan an ninh Panama',           'Panama Ship Security Officer Certificate',       'PANAMA SSO',   'PANAMA',   'Panama Maritime Authority',  5,    0)

ON DUPLICATE KEY UPDATE
  abbreviation      = VALUES(abbreviation),
  category          = VALUES(category),
  name_vi           = VALUES(name_vi),
  name_en           = VALUES(name_en),
  issuing_authority = VALUES(issuing_authority),
  validity_years    = VALUES(validity_years),
  is_stcw           = VALUES(is_stcw);
