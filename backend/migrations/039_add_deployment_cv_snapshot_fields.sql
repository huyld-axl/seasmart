-- TASK F1 (PA1): Snapshot thông tin đi biển trực tiếp trên seafarer_deployment

ALTER TABLE seafarer_deployment
  ADD COLUMN vessel_type VARCHAR(100) NULL AFTER vessel_flag,
  ADD COLUMN cargo_type VARCHAR(100) NULL AFTER vessel_type,
  ADD COLUMN vessel_grt DECIMAL(12,2) NULL AFTER cargo_type,
  ADD COLUMN vessel_dwt DECIMAL(12,2) NULL AFTER vessel_grt,
  ADD COLUMN main_engine_kw DECIMAL(12,2) NULL AFTER vessel_dwt,
  ADD COLUMN operating_area VARCHAR(150) NULL AFTER main_engine_kw;
