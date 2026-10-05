# TASK-02: Training Course API

## Why
Quản lý các khóa học của từng trung tâm đào tạo.
Phụ thuộc TASK-01 (cần training_center tồn tại).
Cần có trước TASK-03 (Enrollment) vì enrollment có FK đến training_course.

## Trạng thái: PENDING (blocked by TASK-01)

## Files cần tạo
- `backend/src/services/training_course.service.js`
- `backend/src/routes/v1/training_course.routes.js`

## Files cần sửa
- `backend/src/routes/v1/index.js` — đăng ký trainingCourseRoutes

## Schema bảng `training_course`
```
id, course_code, course_type_id, training_center_id, name, start_date, end_date,
location, max_students, fee_vnd, fee_usd, instructor, status, notes,
created_at, updated_at, deleted_at
```

Status enum: `PLANNED | ONGOING | COMPLETED | CANCELLED`

## How — Các bước thực hiện

### Bước 1: `training_course.service.js`

**list(filters)**
```sql
SELECT tc.*, tt.name_vi as course_type_name, ctr.name_vi as center_name,
       COUNT(e.id) as enrolled_count
FROM training_course tc
LEFT JOIN course_type tt ON tc.course_type_id = tt.id
LEFT JOIN training_center ctr ON tc.training_center_id = ctr.id
LEFT JOIN training_enrollment e ON e.course_id = tc.id
WHERE tc.deleted_at IS NULL
  AND (tc.training_center_id = ? nếu role=training_center)
  AND (tc.status = ? nếu có filter)
  AND (tc.course_type_id = ? nếu có filter)
GROUP BY tc.id
ORDER BY tc.start_date DESC
LIMIT ? OFFSET ?
```

**getById(id)**
- JOIN thêm training_center, course_type
- COUNT enrolled students

**create(data)**
- Validate: `course_code` unique, `training_center_id` tồn tại
- `start_date < end_date`
- INSERT

**update(id, data, actor)**
- Kiểm tra quyền: training_center chỉ sửa course của trung tâm mình
- Không cho sửa `training_center_id` (chỉ admin)

**softDelete(id)**
- Kiểm tra không có enrollment active trước khi xóa
- UPDATE SET deleted_at = NOW()

### Bước 2: `training_course.routes.js`

```
GET    /              → list
GET    /:id           → getById (kèm enrolled_count)
POST   /              → create (admin, operator, training_center)
PUT    /:id           → update (admin, operator, training_center của mình)
DELETE /:id           → softDelete (admin, operator)
```

### Bước 3: Đăng ký trong `index.js`
```js
import trainingCourseRoutes from './training_course.routes.js'
fastify.register(trainingCourseRoutes, { prefix: '/training-courses' })
```

## Các kịch bản

### Phương án A: Filter theo role trong service (CHỌN)
- Nếu `actor.role === 'training_center'` → tự động filter `training_center_id = actor.linked_entity_id`
- Ưu: training_center không thể xem course của trung tâm khác
- Nhược: service phụ thuộc auth context

### Phương án B: Route truyền filter xuống
- Route kiểm tra role, truyền `training_center_id` vào filter
- Ưu: service không biết về role
- Nhược: logic phân tán

**Chọn Phương án A** — nhất quán với TASK-01

## Điểm quan trọng
- `enrolled_count` cần GROUP BY — không dùng subquery để tránh N+1
- Khi xóa course đã có enrollment → báo lỗi 409, không cho xóa
- `status` là string enum, validate trước khi INSERT/UPDATE
- `fee_vnd` và `fee_usd` đều nullable (có thể miễn phí)

## Acceptance Criteria
- [ ] GET / filter được theo training_center_id, status, course_type_id
- [ ] Role training_center chỉ thấy course của trung tâm mình
- [ ] GET /:id trả về enrolled_count chính xác
- [ ] POST / validate unique course_code, start_date < end_date
- [ ] DELETE /:id báo lỗi nếu còn enrollment active
- [ ] Soft delete đúng pattern (deleted_at)
