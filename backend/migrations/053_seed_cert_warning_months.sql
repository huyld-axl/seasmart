-- ============================================================
-- Migration 053: Seed warning_before_months cho certificate_type
-- Nguồn: 0505 - DANH SÁCH THEO DÕI THỜI HẠN CỦA GIẤY TỜ TV.xlsx
--
-- Quy tắc (ghi chú cuối file Excel):
--   MỤC I: hiệu lực 5 năm kể từ ngày cấp.
--   Chứng chỉ tính đủ hạn = còn ÍT NHẤT 12 THÁNG trước ngày hết hạn.
--   BẰNG CẤP PANAMA: tính theo quy tắc MỤC I (cũng 12 tháng).
--
-- warning_before_months:
--   12  → STCW + chứng chỉ chuyên môn VN/Panama + Y tế có hạn
--    6  → Giấy tờ hành chính (hộ chiếu, sổ thuyền viên, ID card)
--   NULL → Không theo dõi (vĩnh viễn / hết hạn không xác định)
-- ============================================================

-- 1. Thêm cột nếu chưa có
ALTER TABLE `certificate_type`
  ADD COLUMN IF NOT EXISTS `warning_before_months` TINYINT UNSIGNED NULL
    COMMENT 'Số tháng cảnh báo trước khi hết hạn (NULL = không theo dõi)';

-- ── 12 tháng: STCW ───────────────────────────────────────────
UPDATE `certificate_type`
SET `warning_before_months` = 12
WHERE `code` IN (
  'STCW-BASIC',
  'BASIC_TRAINING',
  'PSCRB',
  'AFF',
  'MEFA',
  'MC',
  'MFA',
  'GMDSS-GOC',
  'GMDSS-ROC',
  'GOC',
  'GOC_ENDO',
  'BRM',
  'ERM',
  'BRM_ERM',
  'BTM',
  'RADAR-ARPA',
  'RADAR_OBSERVATION',
  'ARPA',
  'ECDIS',
  'ECDIS_TYPE',
  'SECURITY-AWARE',
  'SECURITY_AWARENESS',
  'DESIGNATED-SEC',
  'SECURITY_DUTIES',
  'SSO',
  'CROWD-CRISIS',
  'OOW-DECK',
  'OOW-ENGINE',
  'CHIEF-MATE',
  'MASTER',
  'CHIEF-ENGINEER',
  'SECOND-ENGINEER',
  'WATCHKEEPING-DECK',
  'WATCHKEEPING',
  'CERT_PROF_SEAFARERS',
  'ELECTRONIC_NAV_AIDS'
);

-- ── 12 tháng: Chứng chỉ chuyên môn Việt Nam ─────────────────
UPDATE `certificate_type`
SET `warning_before_months` = 12
WHERE `code` IN (
  'COMPETENCY_DECK',
  'COMPETENCY_ENGINE',
  'COMPETENCY_RADIO',
  'SHIP_HANDLING',
  'SHIP-HANDLING',
  'TANKER_OIL',
  'TANKER-OIL-BASIC',
  'TANKER-OIL-ADV',
  'TANKER_CHEMICAL',
  'TANKER-CHEM-BASIC',
  'TANKER-CHEM-ADV',
  'TANKER_GAS',
  'TANKER-GAS-BASIC',
  'TANKER-GAS-ADV',
  'PASSENGER_SHIP',
  'MARITIME_ENGLISH',
  'INERT_GAS_CRUDE_OIL_WASHING',
  'SHIPBOARD_MANAGEMENT'
);

-- ── 12 tháng: Bằng cấp Panama (theo MỤC I) ───────────────────
UPDATE `certificate_type`
SET `warning_before_months` = 12
WHERE `code` IN (
  'PANAMA_COC',
  'PANAMA_SDSD',
  'PANAMA_GOC',
  'PANAMA_SSO'
);

-- ── 12 tháng: Y tế có hạn ────────────────────────────────────
-- Giấy sức khỏe thuyền viên: ít nhất 12 tháng (Excel hàng 3)
-- Sổ tiêm chủng tả: hiệu lực 1 năm → cảnh báo 3 tháng trước
UPDATE `certificate_type`
SET `warning_before_months` = 12
WHERE `code` IN (
  'MEDICAL-FITNESS',
  'MEDICAL_FITNESS',
  'PANAMA_MEDICAL',
  'CHOLERA'
);

-- ── 6 tháng: Giấy tờ hành chính ─────────────────────────────
-- Hộ chiếu: hiệu lực 5-10 năm, IMO yêu cầu còn ≥6 tháng khi lên tàu
-- Sổ thuyền viên: hiệu lực 10 năm, cần gia hạn kịp thời
UPDATE `certificate_type`
SET `warning_before_months` = 6
WHERE `code` IN (
  'PASSPORT',
  'SEAMAN-BOOK',
  'SEAMAN_BOOK',
  'SEAFARER_ID_CARD'
);

-- ── NULL: Vaccine vĩnh viễn / không xác định hạn ─────────────
-- Yellow fever: từ 2016 WHO công nhận chứng nhận có giá trị trọn đời
-- COVID-19: không theo dõi định kỳ
UPDATE `certificate_type`
SET `warning_before_months` = NULL
WHERE `code` IN (
  'YELLOW_FEVER',
  'COVID19_VACCINATION'
);
