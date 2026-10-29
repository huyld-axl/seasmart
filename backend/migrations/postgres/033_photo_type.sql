-- Ảnh thẻ 4x6 là một loại giấy tuỳ thân: mỗi lần đổi ảnh (nếu người dùng đồng ý lưu vào Giấy tờ) là một dòng mới,
-- ảnh trước thành Bản cũ. Ảnh đại diện của hồ sơ vẫn ở seafarer.photo_path.
INSERT INTO "certificate_type"
  ("code", "name_vi", "name_en", "abbreviation", "category", "issuing_authority", "validity_years", "is_stcw")
VALUES
  ('PHOTO', 'Ảnh thẻ 4x6', 'Passport photo 4x6', 'PHOTO', 'DOCUMENT', NULL, NULL, 0)
ON CONFLICT DO NOTHING;
