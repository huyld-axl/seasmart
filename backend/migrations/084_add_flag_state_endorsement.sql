-- Migration 084: Add Flag State Endorsement certificate type
-- Covers endorsements issued by foreign flag state maritime registries
-- (Belize/IMMARBE, Panama, Marshall Islands, Liberia, Bahamas, Vanuatu, Cyprus, etc.)
-- The specific flag state is stored in certificate_name by the AI extraction flow.

SET NAMES utf8mb4;

INSERT INTO `certificate_type`
  (`code`, `name_vi`, `name_en`, `abbreviation`, `category`, `issuing_authority`, `validity_years`, `is_stcw`)
VALUES
  ('FLAG_STATE_ENDORSEMENT',
   'Chứng chỉ công nhận quốc gia cờ tàu',
   'Flag State Endorsement',
   'FSE',
   'OTHER',
   NULL,
   5,
   0)
ON DUPLICATE KEY UPDATE
  name_vi            = VALUES(name_vi),
  name_en            = VALUES(name_en),
  abbreviation       = VALUES(abbreviation),
  validity_years     = VALUES(validity_years);
