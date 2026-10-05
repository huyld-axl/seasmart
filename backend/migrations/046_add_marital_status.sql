ALTER TABLE seafarer
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30) NULL AFTER phone_primary;
