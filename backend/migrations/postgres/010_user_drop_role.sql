-- Bỏ cột vai trò cũ: từ nay vai trò nằm ở user.role_id (bảng role, role_permission).
-- linked_entity_* chỉ phục vụ tài khoản thuyền viên / trung tâm đào tạo (đã bỏ), không còn code nào đọc.
ALTER TABLE "user" DROP COLUMN IF EXISTS "role";
ALTER TABLE "user" DROP COLUMN IF EXISTS "linked_entity_type";
ALTER TABLE "user" DROP COLUMN IF EXISTS "linked_entity_id";
