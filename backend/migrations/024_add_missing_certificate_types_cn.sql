-- 024_add_missing_certificate_types_cn.sql
-- Add missing certificate types from CN checklist mapping

SET NAMES utf8mb4;

INSERT INTO certificate_type
  (code, name_vi, name_en, abbreviation, category, issuing_authority, validity_years, is_stcw)
VALUES
  ('SEAFARER_ID_CARD', 'Giay chung nhan thuyen vien (S.P.)', 'Seafarer Identity Document (S.P.)', 'SP', 'DOCUMENT', 'Cuc Hang hai', 10, 0),
  ('CERT_PROF_SEAFARERS', 'Chung chi nang luc thuyen vien', 'Certificate of Proficiency for Seafarers', 'COP', 'STCW', 'Cuc Hang hai', 5, 1),
  ('INERT_GAS_CRUDE_OIL_WASHING', 'Khi tro va rua dau tho', 'Inert Gas and Crude Oil Washing', 'IGCOW', 'VN', 'Cuc Hang hai', 5, 1),
  ('ELECTRONIC_NAV_AIDS', 'Thiet bi dan duong dien tu', 'Electronic Navigational Aids', 'ENA', 'STCW', 'Cuc Hang hai', 5, 1),
  ('SHIPBOARD_MANAGEMENT', 'Khoa quan ly tren tau', 'Shipboard Management Course', 'SMC', 'VN', 'Cuc Hang hai', 5, 0),
  ('COVID19_VACCINATION', 'Chung nhan tiem vac xin COVID-19', 'COVID-19 Vaccination Certificate', 'COVID', 'MEDICAL', 'Bo Y te', NULL, 0)
ON DUPLICATE KEY UPDATE
  name_vi = VALUES(name_vi),
  name_en = VALUES(name_en),
  abbreviation = VALUES(abbreviation),
  category = VALUES(category),
  issuing_authority = VALUES(issuing_authority),
  validity_years = VALUES(validity_years),
  is_stcw = VALUES(is_stcw);
