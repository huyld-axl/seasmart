# TASK-A3: Migration — Tạo bảng enrollment_waitlist

## Why
Khi khóa học đã đầy (`max_students`), thuyền viên cần được xếp vào danh sách chờ thay vì bị từ chối hoàn toàn.
Khi có chỗ trống, hệ thống tự động notify thuyền viên đầu hàng đợi.

## Trạng thái: PENDING

## Files cần sửa
- `D:/code/app hàng hải/migration.sql` — thêm CREATE TABLE

## Schema bảng `enrollment_waitlist`
```sql
CREATE TABLE enrollment_waitlist (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  course_id     INT NOT NULL,
  seafarer_id   INT NOT NULL,
  position      INT NOT NULL COMMENT 'Thứ tự trong hàng đợi, tính từ 1',
  requested_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at   DATETIME NULL COMMENT 'Thời điểm gửi thông báo có chỗ trống',
  confirm_by    DATETIME NULL COMMENT 'Deadline xác nhận sau khi được notify (notified_at + 24h)',
  status        VARCHAR(20) NOT NULL DEFAULT 'WAITING'
                COMMENT 'WAITING|NOTIFIED|ENROLLED|EXPIRED|CANCELLED',
  notes         VARCHAR(500) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_waitlist_course
    FOREIGN KEY (course_id) REFERENCES training_course(id) ON DELETE CASCADE,
  CONSTRAINT fk_waitlist_seafarer
    FOREIGN KEY (seafarer_id) REFERENCES seafarer(id) ON DELETE CASCADE,
  CONSTRAINT uq_waitlist_course_seafarer
    UNIQUE KEY (course_id, seafarer_id)
);
```

## How — Các bước thực hiện

### Bước 1: Append vào migration.sql

### Bước 2: Index
```sql
CREATE INDEX idx_waitlist_course_status ON enrollment_waitlist(course_id, status);
CREATE INDEX idx_waitlist_seafarer ON enrollment_waitlist(seafarer_id);
```

### Bước 3: Logic position (trong waitlist.service.js — TASK-C2)
```sql
-- Lấy position tiếp theo
SELECT COALESCE(MAX(position), 0) + 1 FROM enrollment_waitlist
WHERE course_id = ? AND status = 'WAITING';
```

## Luồng trạng thái
```
WAITING → NOTIFIED → ENROLLED (khi xác nhận trong 24h)
                   → EXPIRED  (khi hết 24h không xác nhận)
        → CANCELLED (thuyền viên tự hủy)
```

## Điểm quan trọng
- UNIQUE (course_id, seafarer_id): 1 thuyền viên chỉ vào waitlist 1 lần / 1 course
- `position` cần recalculate khi có người EXPIRED/CANCELLED
- `confirm_by = notified_at + 24 giờ` — cron job kiểm tra mỗi giờ

## Acceptance Criteria
- [ ] Migration tạo bảng thành công
- [ ] UNIQUE constraint (course_id, seafarer_id)
- [ ] FK đến training_course và seafarer hợp lệ
- [ ] Index trên (course_id, status)
