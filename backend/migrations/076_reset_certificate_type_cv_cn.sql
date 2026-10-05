-- 076_reset_certificate_type_cv_cn.sql
-- Full reset: xóa toàn bộ certificate_type và seafarer_certificate,
-- tạo lại đúng các loại chứng chỉ có trong CV tiếng Trung (CERT_ROWS).
-- Một code canonical duy nhất cho mỗi loại, không còn alias.

SET NAMES utf8mb4;

-- Nullify FK references trước để tránh lỗi constraint
UPDATE course_type SET certificate_type_id = NULL WHERE certificate_type_id IS NOT NULL;
DELETE FROM seafarer_certificate;
DELETE FROM certificate_type;

INSERT INTO certificate_type
  (code, name_vi, name_en, abbreviation, category, issuing_authority, validity_years, is_stcw, warning_before_months)
VALUES
  -- ── DOCUMENT (rows 17-19) ────────────────────────────────────
  ('PASSPORT',
   'Hộ chiếu phổ thông',
   'International Passport',
   'PP', 'DOCUMENT', 'Cục Quản lý xuất nhập cảnh', 10, 0, 6),

  ('SEAMAN_BOOK',
   'Sổ thuyền viên',
   'Seaman Book',
   'SMB', 'DOCUMENT', 'Cục Hàng hải Việt Nam', 10, 0, 6),

  ('SEAFARER_ID_CARD',
   'Giấy chứng nhận thuyền viên (S.P.)',
   'Seafarer Identity Document (S.P.)',
   'SP', 'DOCUMENT', 'Cục Hàng hải Việt Nam', 10, 0, 6),

  -- ── COC / Bằng chuyên môn (row 20) ───────────────────────────
  ('MASTER',
   'Bằng chuyên môn - Thuyền trưởng',
   'Certificate of Competency - Master',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('CHIEF-MATE',
   'Bằng chuyên môn - Đại phó',
   'Certificate of Competency - Chief Mate',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('CHIEF-ENGINEER',
   'Bằng chuyên môn - Máy trưởng',
   'Certificate of Competency - Chief Engineer',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('SECOND-ENGINEER',
   'Bằng chuyên môn - Máy hai',
   'Certificate of Competency - Second Engineer',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('OOW-DECK',
   'Bằng chuyên môn - Sỹ quan boong',
   'Certificate of Competency - Officer in Charge of a Navigational Watch',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('OOW-ENGINE',
   'Bằng chuyên môn - Sỹ quan máy',
   'Certificate of Competency - Officer in Charge of an Engineering Watch',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('WATCHKEEPING-DECK',
   'Bằng chuyên môn - Thủy thủ',
   'Certificate of Competency - Rating Forming Part of a Navigational Watch',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('COMPETENCY_DECK',
   'Chứng chỉ chuyên môn boong',
   'Certificate of Competency - Deck',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('COMPETENCY_ENGINE',
   'Chứng chỉ chuyên môn máy',
   'Certificate of Competency - Engine',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  ('COMPETENCY_RADIO',
   'Chứng chỉ chuyên môn vô tuyến',
   'Certificate of Competency - Radio',
   'COC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  -- ── GMDSS (row 21) ───────────────────────────────────────────
  ('GMDSS-GOC',
   'Chứng chỉ GMDSS - GOC',
   'Global Maritime Distress and Safety System - General Operator Certificate',
   'GOC', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  -- ── Certificate of Proficiency (row 22) ─────────────────────
  ('CERT_PROF_SEAFARERS',
   'Chứng chỉ năng lực thuyền viên hàng hải',
   'CERTIFICATE OF PROFICIENCY FOR SEAFARERS',
   'COP', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  -- ── STCW cơ bản (rows 23-30) ─────────────────────────────────
  ('BASIC_TRAINING',
   'Chứng chỉ huấn luyện cơ bản (STCW)',
   'Basic Training Certificate (STCW)',
   'IMO', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('PSCRB',
   'Chứng chỉ phòng chống cướp biển và an ninh tàu',
   'Proficiency in Survival Craft and Rescue Boats',
   'BOAT', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('AFF',
   'Chứng chỉ phòng cháy chữa cháy nâng cao',
   'Advanced Fire Fighting',
   'AFF', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('MEFA',
   'Chứng chỉ sơ cứu y tế',
   'Medical First Aid',
   'MFA', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('MC',
   'Chứng chỉ chăm sóc y tế',
   'Medical Care',
   'MC', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('SECURITY_AWARENESS',
   'Chứng chỉ nhận thức an ninh',
   'Security Awareness Training',
   'SA', 'STCW', 'Cục Hàng hải Việt Nam', NULL, 1, NULL),

  ('SECURITY_DUTIES',
   'Chứng chỉ nhiệm vụ an ninh',
   'Designated Security Duties',
   'SDSD', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('SSO',
   'Chứng chỉ sỹ quan an ninh tàu',
   'Ship Security Officer',
   'SSO', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  -- ── Y tế (row 31) ─────────────────────────────────────────────
  ('MEDICAL_FITNESS',
   'Giấy chứng nhận sức khỏe thuyền viên',
   'Seafarer Medical Fitness Certificate',
   'MEDICAL', 'MEDICAL', 'Bộ Y tế', 2, 0, 12),

  -- ── Tanker (rows 32-36) ───────────────────────────────────────
  ('TANKER_CHEMICAL',
   'Chứng chỉ tàu chở hóa chất cơ bản',
   'Basic Training for Chemical Tanker Cargo Operations',
   'CHEM-B', 'VN', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('TANKER-CHEM-ADV',
   'Chứng chỉ tàu chở hóa chất nâng cao',
   'Advanced Training for Chemical Tanker Cargo Operations',
   'CHEM-A', 'VN', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('TANKER_OIL',
   'Chứng chỉ tàu chở dầu cơ bản',
   'Basic Training for Oil Tanker Cargo Operations',
   'OIL-B', 'VN', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('TANKER-OIL-ADV',
   'Chứng chỉ tàu chở dầu nâng cao',
   'Advanced Training for Oil Tanker Cargo Operations',
   'OIL-A', 'VN', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('INERT_GAS_CRUDE_OIL_WASHING',
   'Chứng chỉ khí trơ và rửa dầu thô',
   'Inert Gas and Crude Oil Washing',
   'IGCOW', 'VN', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  -- ── Navigation / Radar (rows 37-39) ─────────────────────────
  ('RADAR_OBSERVATION',
   'Chứng chỉ quan sát radar',
   'Radar Navigation and Observation',
   'RADAR', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('ELECTRONIC_NAV_AIDS',
   'Chứng chỉ thiết bị dẫn đường điện tử (ECDIS)',
   'Electronic Navigational Aids (ECDIS)',
   'ECDIS', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  ('ARPA',
   'Chứng chỉ ARPA',
   'Automatic Radar Plotting Aids',
   'ARPA', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12),

  -- ── Management (row 40) ───────────────────────────────────────
  ('SHIPBOARD_MANAGEMENT',
   'Chứng chỉ quản lý trên tàu',
   'Shipboard Management Course',
   'SMC', 'VN', 'Cục Hàng hải Việt Nam', 5, 0, 12),

  -- ── COVID (row 41) ────────────────────────────────────────────
  ('COVID19_VACCINATION',
   'Chứng nhận tiêm vắc xin COVID-19',
   'COVID-19 Vaccination Certificate',
   'COVID', 'MEDICAL', 'Bộ Y tế', NULL, 0, NULL)
ON DUPLICATE KEY UPDATE
  name_vi             = VALUES(name_vi),
  name_en             = VALUES(name_en),
  abbreviation        = VALUES(abbreviation),
  category            = VALUES(category),
  issuing_authority   = VALUES(issuing_authority),
  validity_years      = VALUES(validity_years),
  is_stcw             = VALUES(is_stcw),
  warning_before_months = VALUES(warning_before_months);
