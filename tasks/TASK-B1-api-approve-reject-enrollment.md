# TASK-B1: API - Approve/Reject Enrollment

## Why
Sau khi thuyền viên tự đăng ký (TASK-B2) hoặc được import (TASK-B4), enrollment ở trạng thái `PENDING`.
Trung tâm đào tạo hoặc admin cần duyệt hoặc từ chối để chuyển sang `APPROVED`/`REJECTED`.

## Trạng thái: PENDING (blocked by TASK-A1)

## Files cần sửa
- `D:/code/app hàng hải/backend/src/services/enrollment.service.js`
- `D:/code/app hàng hải/backend/src/routes/v1/enrollment.routes.js`

## API Endpoints

```
PUT /api/v1/enrollments/:id/approve
PUT /api/v1/enrollments/:id/reject
```

### PUT /:id/approve
- **Role**: admin, operator, accountant
- **Body**: `{ notes?: string }`
- **Logic**:
  1. Lấy enrollment, kiểm tra tồn tại
  2. Kiểm tra status = 'PENDING' (chỉ duyệt được PENDING)
  3. Kiểm tra role accountant: chỉ duyệt enrollment thuộc course của mình (`linked_entity_id`)
  4. Kiểm tra lại `max_students` - nếu đầy thì trả 409
  5. UPDATE: `status = 'APPROVED'`, `approved_by = req.user.id`, `approved_at = NOW()`
  6. Trigger notification (TASK-C1): gửi email cho seafarer

### PUT /:id/reject
- **Role**: admin, operator, accountant
- **Body**: `{ reason: string }` - bắt buộc có lý do
- **Logic**:
  1. Lấy enrollment, kiểm tra tồn tại
  2. Kiểm tra status = 'PENDING'
  3. Kiểm tra quyền accountant (chỉ reject course của mình)
  4. UPDATE: `status = 'REJECTED'`, `reject_reason = body.reason`, `approved_by = req.user.id`, `approved_at = NOW()`
  5. Trigger notification (TASK-C1): gửi email cho seafarer kèm lý do

## How - Các bước thực hiện

### Bước 1: Thêm hàm vào enrollment.service.js

```js
async approve(id, userId, notes) {
  const enrollment = await getById(id);
  if (!enrollment) throw new NotFoundError('Enrollment không tồn tại');
  if (enrollment.status !== 'PENDING') throw new BadRequestError('Chỉ duyệt được enrollment ở trạng thái PENDING');
  // kiểm tra max_students
  const count = await countActiveEnrollments(enrollment.course_id);
  const course = await getCourse(enrollment.course_id);
  if (course.max_students && count >= course.max_students) throw new ConflictError('Khóa học đã đầy');
  await db.query(
    'UPDATE training_enrollment SET status=?, approved_by=?, approved_at=NOW(), notes=? WHERE id=?',
    ['APPROVED', userId, notes, id]
  );
}

async reject(id, userId, reason) {
  if (!reason) throw new BadRequestError('Cần có lý do từ chối');
  const enrollment = await getById(id);
  if (!enrollment) throw new NotFoundError();
  if (enrollment.status !== 'PENDING') throw new BadRequestError('Chỉ từ chối được enrollment ở trạng thái PENDING');
  await db.query(
    'UPDATE training_enrollment SET status=?, approved_by=?, approved_at=NOW(), reject_reason=? WHERE id=?',
    ['REJECTED', userId, reason, id]
  );
}
```

### Bước 2: Thêm routes vào enrollment.routes.js

```js
fastify.put('/:id/approve', { preHandler: [authenticate, authorize(['admin','operator','accountant'])] }, approveHandler);
fastify.put('/:id/reject',  { preHandler: [authenticate, authorize(['admin','operator','accountant'])] }, rejectHandler);
```

### Bước 3: Kiểm tra quyền accountant
```js
if (req.user.role === 'accountant') {
  const course = await getCourse(enrollment.course_id);
  if (course.training_center_id !== req.user.linked_entity_id) {
    throw new ForbiddenError();
  }
}
```

## Acceptance Criteria
- [ ] Approve enrollment PENDING → status = APPROVED
- [ ] Reject enrollment PENDING → status = REJECTED, reject_reason được lưu
- [ ] Không approve/reject enrollment không ở trạng thái PENDING → 400
- [ ] accountant chỉ approve/reject course của mình → 403 nếu sai
- [ ] Approve khi course đầy → 409
- [ ] reject thiếu reason → 400
