# TASK-03: Enrollment API (Đăng ký học + Điểm số)

## Why
Quản lý việc đăng ký học viên vào khóa học và nhập điểm kết quả.
Phụ thuộc TASK-01 và TASK-02.
Khi cấp chứng chỉ (certificate_issued=true) → tự động tạo record seafarer_certificate.

## Trạng thái: PENDING (blocked by TASK-02)

## Files cần tạo
- `backend/src/services/enrollment.service.js`
- `backend/src/routes/v1/enrollment.routes.js`

## Files cần sửa
- `backend/src/routes/v1/index.js` — đăng ký enrollmentRoutes

## Schema bảng `training_enrollment`
```
id, course_id, seafarer_id, enrollment_date, rank_at_enrollment,
attendance_score, attendance_max, process_score, interview_score,
total_score, grade, result, certificate_issued, certificate_id,
absence_reason, notes, created_at, updated_at
```

## Schema bảng `enrollment_score`
```
id, enrollment_id, criteria_code, criteria_name, score, max_score, grade, notes, created_at
```

## How — Các bước thực hiện

### Bước 1: `enrollment.service.js`

**list(filters)**
```sql
SELECT e.*, s.full_name, s.seafarer_code, tc.name as course_name
FROM training_enrollment e
JOIN seafarer s ON e.seafarer_id = s.id
JOIN training_course tc ON e.course_id = tc.id
WHERE (e.course_id = ? nếu có)
  AND (e.seafarer_id = ? nếu có)
  AND (e.result = ? nếu có)
ORDER BY e.enrollment_date DESC
LIMIT ? OFFSET ?
```

**getById(id)**
- JOIN seafarer, training_course
- SELECT * FROM enrollment_score WHERE enrollment_id = ?

**create(data)**
- Kiểm tra `max_students`: COUNT enrollments của course < max_students
- Kiểm tra seafarer chưa đăng ký course này (unique course_id + seafarer_id)
- INSERT training_enrollment

**updateResult(id, data)**
- Cập nhật: attendance_score, process_score, interview_score, total_score, grade, result
- Nếu `certificate_issued = true` và chưa có certificate_id:
  → INSERT vào `seafarer_certificate` (certificate_type_id lấy từ course_type)
  → UPDATE enrollment SET certificate_id = newCertId

**addScores(enrollmentId, scores[])**
- DELETE enrollment_score WHERE enrollment_id = ? (replace all)
- INSERT BULK enrollment_score

**cancel(id)**
- Kiểm tra enrollment chưa có certificate_issued
- UPDATE SET deleted_at = NOW() (hoặc thêm cột status nếu cần)

### Bước 2: `enrollment.routes.js`

```
GET    /                    → list
GET    /:id                 → getById (kèm scores)
POST   /                    → create (admin, operator, training_center)
PUT    /:id                 → updateResult (admin, operator, training_center)
POST   /:id/scores          → addScores (admin, operator, training_center)
DELETE /:id                 → cancel (admin, operator)
```

### Bước 3: Đăng ký trong `index.js`
```js
import enrollmentRoutes from './enrollment.routes.js'
fastify.register(enrollmentRoutes, { prefix: '/enrollments' })
```

## Các kịch bản

### Phương án A: Auto-create certificate trong service (CHỌN)
- Khi updateResult với certificate_issued=true → service tự tạo seafarer_certificate
- Ưu: atomic, không cần client gọi thêm API
- Nhược: service enrollment phụ thuộc bảng certificate

### Phương án B: Client tự gọi Certificate API sau
- Ưu: tách biệt
- Nhược: có thể quên, data inconsistent

**Chọn Phương án A** — đảm bảo data consistency

## Điểm quan trọng
- Kiểm tra `max_students` trước khi cho đăng ký — trả về 409 nếu đầy
- Unique constraint: 1 seafarer chỉ đăng ký 1 lần / 1 course
- Khi `certificate_issued = true` → cần biết `certificate_type_id` từ course_type của course
- `addScores` dùng replace pattern (DELETE + INSERT) để đơn giản
- `enrollment_date` default = NOW() nếu không truyền

## Acceptance Criteria
- [ ] POST / kiểm tra max_students, báo lỗi 409 nếu đầy
- [ ] POST / báo lỗi nếu seafarer đã đăng ký course này
- [ ] GET /:id trả về kèm scores array
- [ ] PUT /:id với certificate_issued=true → tự tạo seafarer_certificate
- [ ] POST /:id/scores replace toàn bộ scores
- [ ] DELETE /:id không cho hủy nếu đã cấp chứng chỉ
