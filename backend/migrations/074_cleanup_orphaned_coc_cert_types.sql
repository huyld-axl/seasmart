-- 074_cleanup_orphaned_coc_cert_types.sql
-- Dọn dẹp các certificate_type auto-created (code=NULL) từ các lần AI scan CoC trước khi fix
--
-- Bối cảnh: Trước khi có migration 073, mỗi lần AI scan CoC không match master,
-- backend tạo record mới: INSERT INTO certificate_type (name_vi) VALUES ('Bằng chuyên môn - Đại phó')
-- → record này có code=NULL → seafarer_certificate trỏ vào → CV export bỏ trống row 20
--
-- Migration này:
-- 1. Remap seafarer_certificate trỏ tới orphaned type → canonical type (đã có code)
-- 2. Xóa orphaned types không còn được dùng

SET NAMES utf8mb4;

-- Bước 1: Remap seafarer_certificate về canonical record
-- (canonical là record cùng name_vi nhưng có code IS NOT NULL — được tạo bởi migration 073)
UPDATE seafarer_certificate sc
JOIN certificate_type orphan
  ON orphan.id = sc.certificate_type_id
  AND orphan.code IS NULL
  AND orphan.name_vi LIKE 'Bằng chuyên môn - %'
JOIN certificate_type canonical
  ON canonical.name_vi = orphan.name_vi
  AND canonical.code IS NOT NULL
SET sc.certificate_type_id = canonical.id;

-- Bước 2: Xóa orphaned types không còn được dùng bởi bất kỳ seafarer_certificate nào
DELETE FROM certificate_type
WHERE code IS NULL
  AND name_vi LIKE 'Bằng chuyên môn - %'
  AND id NOT IN (
    SELECT DISTINCT certificate_type_id
    FROM seafarer_certificate
    WHERE certificate_type_id IS NOT NULL
  );
