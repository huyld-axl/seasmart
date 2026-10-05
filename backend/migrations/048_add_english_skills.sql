ALTER TABLE seafarer
  ADD COLUMN IF NOT EXISTS english_listening VARCHAR(20) NULL AFTER english_score,
  ADD COLUMN IF NOT EXISTS english_spoken VARCHAR(20) NULL AFTER english_listening,
  ADD COLUMN IF NOT EXISTS english_reading VARCHAR(20) NULL AFTER english_spoken,
  ADD COLUMN IF NOT EXISTS english_writing VARCHAR(20) NULL AFTER english_reading;
