-- Mã thuyền viên là số sổ thuyền viên: điền cho hồ sơ chưa có mã. Mã đã có (từ import) giữ nguyên.
UPDATE "seafarer"
SET "seafarer_code" = TRIM("seaman_book_number")
WHERE COALESCE(TRIM("seafarer_code"), '') = ''
  AND COALESCE(TRIM("seaman_book_number"), '') <> '';
