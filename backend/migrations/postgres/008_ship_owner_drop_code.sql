-- Đối tác không còn mã riêng: bỏ cột code và chỉ mục duy nhất của nó.
DROP INDEX IF EXISTS "ship_owner_code";
ALTER TABLE "ship_owner" DROP COLUMN "code";
