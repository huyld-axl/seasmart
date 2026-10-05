-- Cột Degree (xếp loại đào tạo) kiểu GOOD/FAIR theo mẫu biểu mẫu
ALTER TABLE seafarer_education
  ADD COLUMN IF NOT EXISTS degree_rating VARCHAR(20) NULL AFTER graduation_level;
