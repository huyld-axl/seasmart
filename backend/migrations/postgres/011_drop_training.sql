-- Bỏ phân hệ đào tạo (trung tâm, khóa học, đăng ký học, danh sách chờ, link QR) và vai trò trung tâm đào tạo.
-- Người dùng chỉ là môi giới; phần này chưa làm tới nên gỡ hẳn khỏi schema.
DROP TABLE IF EXISTS "enrollment_score";
DROP TABLE IF EXISTS "enrollment_waitlist";
DROP TABLE IF EXISTS "qr_enrollment_link";
DROP TABLE IF EXISTS "training_enrollment";
DROP TABLE IF EXISTS "training_course";
DROP TABLE IF EXISTS "course_type";
DROP TABLE IF EXISTS "training_center";
