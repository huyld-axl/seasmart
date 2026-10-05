-- Migration 083: Re-add vessel snapshot columns to seafarer_deployment
-- Migration 052 dropped these columns; the deployment form now captures them
-- from vessel name-search results for manual/free-text deployments.

ALTER TABLE seafarer_deployment
  ADD COLUMN IF NOT EXISTS vessel_type    VARCHAR(100)   NULL AFTER vessel_name,
  ADD COLUMN IF NOT EXISTS vessel_flag    VARCHAR(100)   NULL AFTER vessel_type,
  ADD COLUMN IF NOT EXISTS vessel_grt     DECIMAL(12,2)  NULL AFTER vessel_flag,
  ADD COLUMN IF NOT EXISTS vessel_dwt     DECIMAL(12,2)  NULL AFTER vessel_grt,
  ADD COLUMN IF NOT EXISTS main_engine_kw DECIMAL(12,2)  NULL AFTER vessel_dwt;
