ALTER TABLE seafarer
  ADD COLUMN IF NOT EXISTS full_name_cn VARCHAR(150) NULL AFTER full_name,
  ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(200) NULL AFTER permanent_province,
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10) NULL AFTER weight_kg,
  ADD COLUMN IF NOT EXISTS education_graduation_date DATE NULL AFTER education_major;
