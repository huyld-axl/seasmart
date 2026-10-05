-- 080_add_cert_prof_seafarers.sql
-- Thêm loại chứng chỉ CERTIFICATE OF PROFICIENCY FOR SEAFARERS (row 22 CV tiếng Trung)

SET NAMES utf8mb4;

INSERT INTO certificate_type
  (code, name_vi, name_en, abbreviation, category, issuing_authority, validity_years, is_stcw, warning_before_months)
VALUES
  ('CERT_PROF_SEAFARERS',
   'Chứng chỉ năng lực thuyền viên hàng hải',
   'CERTIFICATE OF PROFICIENCY FOR SEAFARERS',
   'COP', 'STCW', 'Cục Hàng hải Việt Nam', 5, 1, 12)
ON DUPLICATE KEY UPDATE
  name_vi             = VALUES(name_vi),
  name_en             = VALUES(name_en),
  abbreviation        = VALUES(abbreviation),
  category            = VALUES(category),
  issuing_authority   = VALUES(issuing_authority),
  validity_years      = VALUES(validity_years),
  is_stcw             = VALUES(is_stcw),
  warning_before_months = VALUES(warning_before_months);
