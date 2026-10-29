-- Căn cước công dân là một loại giấy tờ (nhóm DOCUMENT) để nạp ảnh ở tab Giấy tờ, cạnh Hộ chiếu và Sổ thuyền viên.
INSERT INTO "certificate_type"
  ("code", "name_vi", "name_en", "abbreviation", "category", "issuing_authority", "validity_years", "is_stcw")
VALUES
  ('CITIZEN_ID', 'Căn cước công dân', 'Citizen Identity Card', 'CCCD', 'DOCUMENT', 'Bộ Công an', NULL, 0)
ON CONFLICT DO NOTHING;
UPDATE "certificate_type" SET category = 'DOCUMENT' WHERE code IN ('PASSPORT', 'SEAMAN_BOOK', 'SEAMAN-BOOK', 'CITIZEN_ID');
