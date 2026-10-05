# TASK-A1: Migration - Thêm cột status vào training_enrollment

## Why
Hiện tại bảng `training_enrollment` không có trạng thái, mọi enrollment đều được coi là ACTIVE ngay khi tạo.
Để hỗ trợ luồng duyệt (approve/reject) và self-registration của thuyền viên, cần thêm cột `status` với đầy đủ các trạng thái.

## Trạng thái: PENDING

## Files cần sửa
- `D:/code/app hàng hải/migration.sql` - thêm ALTER TABLE và migration mới

## Schema thay đổi

### Thêm vào bảng `training_enrollment`
```sql
ALTER TABLE training_enrollment
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    COMMENT 'PENDING|APPROVED|ACTIVE|COMPLETED|FAILED|WITHDRAWN|REJECTED',
  ADD COLUMN approved_by INT NULL,
  ADD COLUMN approved_at DATETIME NULL,
  ADD COLUMN reject_reason VARCHAR(500) NULL,
  ADD CONSTRAINT fk_enrollment_approved_by
    FOREIGN KEY (approved_by) REFERENCES user(id) ON DELETE SET NULL;
```

### Thêm cột `referred_by_center_id` (dùng cho TASK-B6)
```sql
ALTER TABLE training_enrollment
  ADD COLUMN referred_by_center_id INT NULL,
  ADD CONSTRAINT fk_enrollment_referred_center
    FOREIGN KEY (referred_by_center_id) REFERENCES training_center(id) ON DELETE SET NULL;
```

## How - Các bước thực hiện

### Bước 1: Thêm migration vào migration.sql
Append đoạn SQL ALTER TABLE ở cuối file migration.sql, có comment rõ version/date.

### Bước 2: Cập nhật dữ liệu hiện có
```sql
-- Các enrollment hiện có giữ nguyên status = 'ACTIVE'
UPDATE training_enrollment SET status = 'ACTIVE' WHERE status IS NULL;
```

### Bước 3: Cập nhật enrollment.service.js
- Hàm `create()`: set `status = 'PENDING'` khi tạo từ portal, `status = 'ACTIVE'` khi admin/operator tạo trực tiếp
- Hàm `list()`: thêm filter theo `status`

## Luồng trạng thái
```
PENDING → APPROVED → ACTIVE → COMPLETED
                            → FAILED
                            → WITHDRAWN
        → REJECTED
```

## Acceptance Criteria
- [ ] Migration chạy không lỗi trên DB hiện có
- [ ] Dữ liệu cũ không bị ảnh hưởng (status = ACTIVE)
- [ ] Cột approved_by FK hợp lệ
- [ ] Cột referred_by_center_id FK hợp lệ
