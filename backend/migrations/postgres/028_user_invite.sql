-- Tạo tài khoản bằng thư mời: quản trị viên nhập họ tên, email, vai trò; người dùng tự đặt mật khẩu qua liên kết.
-- activated_at rỗng = Chờ kích hoạt (chưa đặt mật khẩu). invite_token_hash là SHA-256 của mã trong liên kết.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "full_name" varchar(150);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "invite_token_hash" varchar(64);
ALTER TABLE "user" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Tài khoản đã có coi như đã kích hoạt.
UPDATE "user" SET "activated_at" = "created_at" WHERE "activated_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_invite_token_hash_key" ON "user" ("invite_token_hash") WHERE "invite_token_hash" IS NOT NULL;
