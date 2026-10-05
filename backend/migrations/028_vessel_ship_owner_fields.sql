-- 028_vessel_ship_owner_fields.sql
-- Move ship owner info to vessel table (no longer resolved via partner table in vessel APIs)

ALTER TABLE vessel
  ADD COLUMN IF NOT EXISTS ship_owner_name VARCHAR(255) NULL AFTER partner_id,
  ADD COLUMN IF NOT EXISTS ship_owner_code VARCHAR(50) NULL AFTER ship_owner_name;

UPDATE vessel v
LEFT JOIN partner p ON p.id = v.partner_id
SET
  v.ship_owner_name = COALESCE(NULLIF(v.ship_owner_name, ''), p.company_name),
  v.ship_owner_code = COALESCE(NULLIF(v.ship_owner_code, ''), p.code)
WHERE v.partner_id IS NOT NULL;
