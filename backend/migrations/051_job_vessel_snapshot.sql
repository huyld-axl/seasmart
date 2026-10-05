-- Migration 051: Add vessel snapshot columns to job table
ALTER TABLE `job`
  ADD COLUMN IF NOT EXISTS snap_vessel_type   VARCHAR(255)  NULL AFTER vessel_id,
  ADD COLUMN IF NOT EXISTS snap_vessel_flag   VARCHAR(255)  NULL AFTER snap_vessel_type,
  ADD COLUMN IF NOT EXISTS snap_engine_type   VARCHAR(255)  NULL AFTER snap_vessel_flag,
  ADD COLUMN IF NOT EXISTS snap_engine_maker  VARCHAR(200)  NULL AFTER snap_engine_type,
  ADD COLUMN IF NOT EXISTS snap_engine_model  VARCHAR(200)  NULL AFTER snap_engine_maker,
  ADD COLUMN IF NOT EXISTS snap_engine_kw     DECIMAL(12,2) NULL AFTER snap_engine_model,
  ADD COLUMN IF NOT EXISTS snap_gross_tonnage DECIMAL(12,2) NULL AFTER snap_engine_kw,
  ADD COLUMN IF NOT EXISTS snap_deadweight    DECIMAL(12,2) NULL AFTER snap_gross_tonnage,
  ADD COLUMN IF NOT EXISTS snap_trade_area    VARCHAR(150)  NULL AFTER snap_deadweight;
