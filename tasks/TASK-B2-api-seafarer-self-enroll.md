# TASK-B2: API - Seafarer Self-Enroll (Portal)

## Why
Hiện tại thuyền viên không thể tự đăng ký khóa học - phải nhờ admin/operator tạo enrollment thủ công.
Tính năng này cho phép thuyền viên đăng nhập portal, xem danh sách khóa học đang mở, và tự đăng ký.

## Trạng thái: PENDING (blocked by TASK-A1, TASK-A3)

## Files cần sửa
- `D:/code/app hàng hải/backend/src/services/seafarer_portal.service.js`
- `D:/code/app hàng hải/backend/src/routes/v1/seafarer_portal.routes.js`

## API Endpoints

```
GET  /api/v1/portal/seafarer/courses          - xem danh sách khóa học đang mở
POST /api/v1/portal/seafarer/enrollments      - tự đăng ký khóa học
GET  /api/v1/portal/seafarer/enrollments      - xem lịch sử đăng ký của mình
DELETE /api/v1/portal/seafarer/enrollments/:id - hủy đăng ký (chỉ khi PENDING)
```

### POST /api/v1/portal/seafarer/enrollments
- **Role**: seafarer (portal JWT)
- **Body**: `{ course_id: number }`
- **Logic**:
  1. Lấy `seafarer_id` từ JWT token
  2. Kiểm tra course tồn tại và `status = 'OPEN'`
  3. Kiểm tra thuyền viên chưa enroll course này (status != REJECTED/WITHDRAWN)
  4. Kiểm tra trùng lịch: có enrollment ACTIVE/APPROVED cùng thời gian không
  5. Đếm enrollment hiện tại của course
     - Nếu < `max_students` (hoặc max_students = NULL): tạo enrollment với `status = 'PENDING'`
     - Nếu đầy: tạo record trong `enrollment_waitlist`
  6. Trả về enrollment hoặc waitlist record

## How - Các bước thực hiện

### Bước 1: Thêm hàm selfEnroll vào seafarer_portal.service.js

```js
async selfEnroll(seafarerId, courseId) {
  // 1. Kiểm tra course
  const course = await db.queryOne('SELECT * FROM training_course WHERE id=? AND status="OPEN"', [courseId]);
  if (!course) throw new NotFoundError('Khóa học không tồn tại hoặc chưa mở đăng ký');

  // 2. Kiểm tra đã enroll chưa
  const existing = await db.queryOne(
    'SELECT id, status FROM training_enrollment WHERE course_id=? AND seafarer_id=? AND status NOT IN ("REJECTED","WITHDRAWN")',
    [courseId, seafarerId]
  );
  if (existing) throw new ConflictError('Bạn đã đăng ký khóa học này rồi');

  // 3. Kiểm tra trùng lịch
  const conflict = await checkScheduleConflict(seafarerId, course.start_date, course.end_date);
  if (conflict) throw new ConflictError(`Trùng lịch với khóa học: ${conflict.course_name}`);

  // 4. Kiểm tra chỗ trống
  const count = await db.queryOne(
    'SELECT COUNT(*) as cnt FROM training_enrollment WHERE course_id=? AND status IN ("PENDING","APPROVED","ACTIVE")',
    [courseId]
  );
  if (course.max_students && count.cnt >= course.max_students) {
    // Vào waitlist
    return await addToWaitlist(seafarerId, courseId);
  }

  // 5. Tạo enrollment PENDING
  const result = await db.query(
    'INSERT INTO training_enrollment (course_id, seafarer_id, status, enrollment_date) VALUES (?,?,?,NOW())',
    [courseId, seafarerId, 'PENDING']
  );
  return { type: 'enrollment', id: result.insertId, status: 'PENDING' };
}
```

### Bước 2: Hàm checkScheduleConflict
```js
async function checkScheduleConflict(seafarerId, startDate, endDate) {
  return db.queryOne(`
    SELECT e.id, tc.name as course_name
    FROM training_enrollment e
    JOIN training_course tc ON e.course_id = tc.id
    WHERE e.seafarer_id = ?
      AND e.status IN ('APPROVED','ACTIVE')
      AND tc.start_date < ? AND tc.end_date > ?
  `, [seafarerId, endDate, startDate]);
}
```

### Bước 3: Thêm routes vào seafarer_portal.routes.js
```js
fastify.get('/courses', { preHandler: [authenticateSeafarer] }, listOpenCoursesHandler);
fastify.post('/enrollments', { preHandler: [authenticateSeafarer] }, selfEnrollHandler);
fastify.get('/enrollments', { preHandler: [authenticateSeafarer] }, myEnrollmentsHandler);
fastify.delete('/enrollments/:id', { preHandler: [authenticateSeafarer] }, cancelEnrollmentHandler);
```

## Acceptance Criteria
- [ ] POST tạo enrollment với status = PENDING khi còn chỗ
- [ ] POST tạo waitlist record khi course đầy
- [ ] POST trả 409 nếu đã enroll rồi
- [ ] POST trả 409 kèm tên khóa học nếu trùng lịch
- [ ] DELETE chỉ hủy được enrollment ở trạng thái PENDING
- [ ] GET /enrollments chỉ trả về enrollment của seafarer đang đăng nhập
