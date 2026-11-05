-- Email chỉ cần duy nhất trong các tài khoản chưa xoá: xoá mềm rồi tạo lại cùng email không còn lỗi trùng khoá.
DROP INDEX "user_email";
CREATE UNIQUE INDEX "user_email" ON "user" ("email") WHERE "deleted_at" IS NULL;
