-- Migration 052: Drop vessel snapshot columns from seafarer_deployment
-- These fields are available via the vessel table JOIN (vessel_id FK) and are no longer shown in the UI.

ALTER TABLE seafarer_deployment
  DROP COLUMN IF EXISTS vessel_type,
  DROP COLUMN IF EXISTS vessel_flag,
  DROP COLUMN IF EXISTS vessel_grt,
  DROP COLUMN IF EXISTS vessel_dwt,
  DROP COLUMN IF EXISTS main_engine_kw,
  DROP COLUMN IF EXISTS operating_area,
  DROP COLUMN IF EXISTS cargo_type;
