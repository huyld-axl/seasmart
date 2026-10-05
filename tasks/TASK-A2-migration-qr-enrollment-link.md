# TASK-A2: Migration — Tạo bảng qr_enrollment_link

## Why
Trung tâm đào tạo cần tạo QR code cho từng khóa học để thuyền viên quét và tự đăng ký mà không cần tài khoản.
Bảng này lưu token, giới hạn sử dụng, và thời hạn của từng QR link.

## Trạng thái: PENDING

## Files cần sửa
- `D:/code/app hàng hải/migration.sql` — thêm CREATE TABLE

## Schema bảng `qr_enrollment_link`
```sql
CREATE TABLE qr_enrollment_link (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  course_id     INT NOT NULL,
  token         VARCHAR(64) NOT NULL UNIQUE,
  label         VARCHAR(200) NULL COMMENT 'Tên mô tả QR link, VD: QR dán cửa lớp',
  max_uses      INT NULL COMMENT 'NULL = không giới hạn',
  used_count    INT NOT NULL DEFAULT 0,
  expires_at    DATETIME NULL COMMENT 'NULL = không hết hạn',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_by    INT NOT NULL COMMENT 'FK → user.id',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qr_course
    FOREIGN KEY (course_id) REFERENCES training_course(id) ON DELETE CASCADE,
  CONSTRAINT fk_qr_created_by
    FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE RESTRICT
);
```

## How — Các bước thực hiện

### Bước 1: Append vào migration.sql
Thêm CREATE TABLE sau phần migration TASK-A1.

### Bước 2: Tạo index
```sql
CREATE INDEX idx_qr_token ON qr_enrollment_link(token);
CREATE INDEX idx_qr_course ON qr_enrollment_link(course_id);
```

### Bước 3: Logic token generation (trong TASK-B3)
- Token = `crypto.randomBytes(32).toString('hex')` — 64 ký tự hex
- Unique constraint đảm bảo không trùng

## Điểm quan trọng
- `max_uses = NULL` nghĩa là không giới hạn số lần quét
- `expires_at = NULL` nghĩa là không hết hạn
- `is_active = 0` để vô hiệu hóa QR mà không xóa lịch sử
- Khi thuyền viên quét: tăng `used_count`, kiểm tra `max_uses` và `expires_at`

## Acceptance Criteria
- [ ] Migration tạo bảng thành công
- [ ] FK đến training_course và user hợp lệ
- [ ] Token có UNIQUE constraint
- [ ] Index trên token và course_id
