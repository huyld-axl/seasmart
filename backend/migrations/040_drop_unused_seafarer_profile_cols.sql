-- TASK: Chuẩn hóa hồ sơ thuyền viên theo bộ field mới
-- Giữ lại các nhóm thông tin:
-- - Ngày sinh, SĐT, ảnh
-- - Quốc tịch, quê quán, địa chỉ thường trú
-- - Chiều cao, cân nặng, shoe_size, protective_size
-- - Học vấn nhiều trường qua bảng seafarer_education
-- - Số TK cá nhân, Số TK nhận lương
-- - Người thân: họ tên, quan hệ, năm sinh, địa chỉ

ALTER TABLE seafarer
  DROP COLUMN IF EXISTS full_name_en,
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS temporary_address,
  DROP COLUMN IF EXISTS marital_status,
  DROP COLUMN IF EXISTS children_count,
  DROP COLUMN IF EXISTS children_info,
  DROP COLUMN IF EXISTS children_ages,
  DROP COLUMN IF EXISTS shirt_size,
  DROP COLUMN IF EXISTS pants_size,
  DROP COLUMN IF EXISTS graduation_level,
  DROP COLUMN IF EXISTS graduation_school,
  DROP COLUMN IF EXISTS graduation_year;

ALTER TABLE seafarer_contact
  DROP COLUMN IF EXISTS national_id,
  DROP COLUMN IF EXISTS phone_primary,
  DROP COLUMN IF EXISTS phone_secondary,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS occupation,
  DROP COLUMN IF EXISTS workplace,
  DROP COLUMN IF EXISTS guarantor_id_number,
  DROP COLUMN IF EXISTS guarantor_id_issued_date,
  DROP COLUMN IF EXISTS guarantor_id_issued_place;
