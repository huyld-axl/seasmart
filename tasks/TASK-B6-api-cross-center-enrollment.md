# TASK-B6: API — Cross-Center Enrollment

## Why
Thuyền viên có thể cần học nhiều khóa tại nhiều trung tâm khác nhau cùng lúc.
Trung tâm B cần enroll thuyền viên đang học tại Trung tâm A mà không cần admin can thiệp.
Cần ghi nhận nguồn giới thiệu và cảnh báo trùng lịch.

## Trạng thái: PENDING (blocked by TASK-A1)

## Files cần sửa
- `D:/code/app hàng hải/backend/src/services/enrollment.service.js`
- `D:/code/app hàng hải/backend/src/routes/v1/enrollment.routes.js`

## Thay đổi schema (đã có trong TASK-A1)
Cột `referred_by_center_id INT NULL` trong `training_enrollment`.

## API Endpoints

### POST /api/v1/enrollments (mở rộng endpoint hiện có)
- **Body bổ sung**: `{ referred_by_center_id?: number }`
- training_center B có thể enroll thuyền viên bất kỳ vào course của mình
- Nếu thuyền viên đang có enrollment ACTIVE tại trung tâm khác → trả về warning (không block)

### GET /api/v1/enrollments/:seafarerId/training-history
- **Role**: admin, operator, training_center (read-only)
- Trả về toàn bộ lịch sử đào tạo của thuyền viên (tất cả trung tâm)
- training_center chỉ thấy: tên khóa học, trung tâm, ngày, kết quả — không thấy điểm chi tiết của trung tâm khác

## How — Các bước thực hiện

### Bước 1: Cập nhật hàm create() trong enrollment.service.js

```js
async function create(data, userRole, userLinkedEntityId) {
  // Kiểm tra quyền: training_center chỉ tạo enrollment cho course của mình
  if (userRole === 'training_center') {
    const course = await getCourse(data.course_id);
    if (course.training_center_id !== userLinkedEntityId) {
      throw new ForbiddenError('Chỉ được enroll vào khóa học của trung tâm mình');
    }
  }

  // Kiểm tra trùng lịch — trả về warning thay vì block
  const conflict = await checkScheduleConflict(data.seafarer_id, course.start_date, course.end_date);
  const warnings = [];
  if (conflict) {
    warnings.push(`Thuyền viên đang có lịch học tại: ${conflict.center_name} - ${conflict.course_name}`);
  }

  // Tạo enrollment
  const result = await db.query(
    `INSERT INTO training_enrollment
     (course_id, seafarer_id, status, enrollment_date, referred_by_center_id, notes)
     VALUES (?,?,?,NOW(),?,?)`,
    [data.course_id, data.seafarer_id, 'ACTIVE', data.referred_by_center_id || null, data.notes]
  );

  return { id: result.insertId, warnings };
}
```

### Bước 2: Hàm getTrainingHistory

```js
async function getTrainingHistory(seafarerId, userRole) {
  const sql = `
    SELECT
      e.id, e.enrollment_date, e.status, e.result, e.certificate_issued,
      tc.name as course_name, tc.start_date, tc.end_date,
      ctr.name as center_name,
      ${userRole !== 'training_center' ? 'e.total_score, e.grade,' : ''}
      e.referred_by_center_id
    FROM training_enrollment e
    JOIN training_course tc ON e.course_id = tc.id
    JOIN training_center ctr ON tc.training_center_id = ctr.id
    WHERE e.seafarer_id = ?
    ORDER BY e.enrollment_date DESC
  `;
  return db.query(sql, [seafarerId]);
}
```

### Bước 3: Thêm route
```js
fastify.get('/:seafarerId/training-history',
  { preHandler: [authenticate, authorize(['admin','operator','training_center'])] },
  trainingHistoryHandler
);
```

## Acceptance Criteria
- [ ] training_center B enroll thuyền viên vào course của mình → thành công
- [ ] training_center B enroll vào course của trung tâm khác → 403
- [ ] Enroll thuyền viên đang có lịch trùng → thành công nhưng có warnings array
- [ ] referred_by_center_id được lưu khi truyền vào
- [ ] GET /training-history trả về lịch sử tất cả trung tâm
- [ ] training_center xem training-history → không thấy điểm chi tiết của trung tâm khác
