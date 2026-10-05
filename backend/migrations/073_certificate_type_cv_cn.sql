-- 073_certificate_type_cv_cn.sql
-- Chuẩn hóa certificate_type cho export CV tiếng Trung (CERT_ROWS trong cv_export.service.js)
--
-- 1. Đổi name_vi các loại CoC sang format "Bằng chuyên môn - {chức danh}"
--    → backend tìm đúng record khi AI scan CoC (exact match trên name_vi)
-- 2. Đảm bảo category và warning_before_months cho tất cả cert trong CERT_ROWS

SET NAMES utf8mb4;

-- ============================================================
-- 1. CoC (row 20): name_vi khớp với tên AI sinh ra từ coc_rank
-- ============================================================
UPDATE certificate_type SET name_vi = 'Bằng chuyên môn - Thuyền trưởng'          WHERE code = 'MASTER';
UPDATE certificate_type SET name_vi = 'Bằng chuyên môn - Đại phó'                WHERE code = 'CHIEF-MATE';
UPDATE certificate_type SET name_vi = 'Bằng chuyên môn - Máy trưởng'             WHERE code = 'CHIEF-ENGINEER';
UPDATE certificate_type SET name_vi = 'Bằng chuyên môn - Máy hai'                WHERE code = 'SECOND-ENGINEER';
UPDATE certificate_type SET name_vi = 'Bằng chuyên môn - Sỹ quan boong'          WHERE code = 'OOW-DECK';
UPDATE certificate_type SET name_vi = 'Bằng chuyên môn - Sỹ quan máy'           WHERE code = 'OOW-ENGINE';
UPDATE certificate_type SET name_vi = 'Bằng chuyên môn - Thủy thủ'               WHERE code = 'WATCHKEEPING-DECK';

-- ============================================================
-- 2. DOCUMENT (rows 17, 18, 19)
-- ============================================================
UPDATE certificate_type
SET category = 'DOCUMENT', warning_before_months = 6
WHERE code IN ('PASSPORT', 'SEAMAN-BOOK', 'SEAMAN_BOOK', 'SEAFARER_ID_CARD');

-- ============================================================
-- 3. CoC VN (row 20)
-- ============================================================
UPDATE certificate_type
SET category = 'VN', warning_before_months = 6
WHERE code IN (
  'COMPETENCY_DECK', 'COMPETENCY_ENGINE', 'COMPETENCY_RADIO',
  'CHIEF-MATE', 'MASTER', 'CHIEF-ENGINEER', 'SECOND-ENGINEER',
  'OOW-DECK', 'OOW-ENGINE', 'WATCHKEEPING-DECK'
);

-- ============================================================
-- 4. GMDSS (row 21)
-- ============================================================
UPDATE certificate_type
SET category = 'STCW', warning_before_months = 6
WHERE code IN ('GMDSS-GOC', 'GMDSS-ROC', 'GOC');

-- ============================================================
-- 5. STCW core (rows 23-30): BASIC, PSCRB, AFF, First Aid, Medical Care, Security, SSO
-- ============================================================
UPDATE certificate_type
SET category = 'STCW', warning_before_months = 6
WHERE code IN (
  'STCW-BASIC', 'BASIC_TRAINING',
  'PSCRB',
  'AFF',
  'MEFA', 'MFA',
  'MC',
  'DESIGNATED-SEC', 'SECURITY_DUTIES',
  'SSO'
);

-- Security Awareness không hết hạn → warning_before_months = NULL
UPDATE certificate_type
SET category = 'STCW', warning_before_months = NULL
WHERE code IN ('SECURITY-AWARE', 'SECURITY_AWARENESS');

-- ============================================================
-- 6. MEDICAL (row 31)
-- ============================================================
UPDATE certificate_type
SET category = 'MEDICAL', warning_before_months = 6
WHERE code IN ('MEDICAL-FITNESS', 'MEDICAL_FITNESS');

-- ============================================================
-- 7. Tanker (rows 32-36)
-- ============================================================
UPDATE certificate_type
SET category = 'VN', warning_before_months = 6
WHERE code IN (
  'TANKER-CHEM-BASIC', 'TANKER_CHEMICAL', 'TANKER-CHEM-ADV',
  'TANKER-OIL-BASIC', 'TANKER_OIL', 'TANKER-OIL-ADV',
  'INERT_GAS_CRUDE_OIL_WASHING'
);

-- ============================================================
-- 8. Navigation / Radar / ECDIS (rows 37-39)
-- ============================================================
UPDATE certificate_type
SET category = 'STCW', warning_before_months = 6
WHERE code IN ('RADAR-ARPA', 'RADAR_OBSERVATION', 'ELECTRONIC_NAV_AIDS', 'ECDIS', 'ARPA');

-- ============================================================
-- 9. Management (row 40)
-- ============================================================
UPDATE certificate_type
SET category = 'VN', warning_before_months = 6
WHERE code IN ('SHIPBOARD_MANAGEMENT', 'BRM_ERM', 'BRM');

-- ============================================================
-- 10. COVID (row 41): không hết hạn cố định
-- ============================================================
UPDATE certificate_type
SET category = 'MEDICAL', warning_before_months = NULL
WHERE code = 'COVID19_VACCINATION';
