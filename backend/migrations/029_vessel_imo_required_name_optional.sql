-- 029_vessel_imo_required_name_optional.sql
-- IMO is mandatory, vessel_name is optional

ALTER TABLE vessel
  MODIFY COLUMN imo_number VARCHAR(10) NOT NULL,
  MODIFY COLUMN vessel_name VARCHAR(150) NULL;
