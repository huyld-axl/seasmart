# TASK-C2: Notification — Waitlist Tự Động

## Why
Khi khóa học đầy, thuyền viên vào waitlist. Khi có người rút khỏi khóa học (WITHDRAWN/REJECTED), cần tự động notify người đầu hàng đợi và cho họ 24h để xác nhận.

## Trạng thái: PENDING (blocked by TASK-A3, TASK-C1)

## Files cần tạo
- `D:/code/app hàng hải/backend/src/services/waitlist.service.js`

## Files cần sửa
- `D:/code/app hàng hải/backend/src/jobs.js` — thêm cron job kiểm tra waitlist
- `D:/code/app hàng hải/backend/src/services/enrollment.service.js` — trigger waitlist khi có chỗ trống

## Luồng tự động

```
Enrollment bị WITHDRAWN/REJECTED
    ↓
checkAndPromoteWaitlist(course_id)
    ↓
Lấy người đầu waitlist (status=WAITING, position nhỏ nhất)
    ↓
Gửi email thông báo có chỗ trống
    ↓
Set status=NOTIFIED, notified_at=NOW(), confirm_by=NOW()+24h
    ↓
[Cron job mỗi giờ] Kiểm tra confirm_by đã qua chưa
    ↓
Nếu quá 24h và chưa xác nhận → EXPIRED → promote người tiếp theo
Nếu xác nhận → tạo enrollment PENDING → EXPIRED các người còn lại
```

## How — Các bước thực hiện

### Bước 1: waitlist.service.js

```js
// Thêm vào waitlist
async function addToWaitlist(seafarerId, courseId) {
  const position = await getNextPosition(courseId);
  await db.query(
    'INSERT INTO enrollment_waitlist (course_id, seafarer_id, position, status) VALUES (?,?,?,?)',
    [courseId, seafarerId, position, 'WAITING']
  );
  return { type: 'waitlist', position, message: `Bạn đang ở vị trí ${position} trong danh sách chờ` };
}

// Promote người đầu hàng đợi khi có chỗ trống
async function promoteNext(courseId) {
  const next = await db.queryOne(
    'SELECT * FROM enrollment_waitlist WHERE course_id=? AND status="WAITING" ORDER BY position ASC LIMIT 1',
    [courseId]
  );
  if (!next) return; // Không còn ai trong waitlist

  const confirmBy = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query(
    'UPDATE enrollment_waitlist SET status="NOTIFIED", notified_at=NOW(), confirm_by=? WHERE id=?',
    [confirmBy, next.id]
  );

  // Gửi email thông báo
  await sendWaitlistNotification(next.seafarer_id, courseId, confirmBy);
}

// Thuyền viên xác nhận từ email link
async function confirmWaitlist(waitlistId, seafarerId) {
  const entry = await db.queryOne(
    'SELECT * FROM enrollment_waitlist WHERE id=? AND seafarer_id=? AND status="NOTIFIED"',
    [waitlistId, seafarerId]
  );
  if (!entry) throw new NotFoundError();
  if (new Date(entry.confirm_by) < new Date()) throw new BadRequestError('Đã hết thời gian xác nhận');

  // Tạo enrollment
  await db.query(
    'INSERT INTO training_enrollment (course_id, seafarer_id, status, enrollment_date) VALUES (?,?,?,NOW())',
    [entry.course_id, entry.seafarer_id, 'PENDING']
  );
  await db.query('UPDATE enrollment_waitlist SET status="ENROLLED" WHERE id=?', [waitlistId]);
}
```

### Bước 2: Trigger trong enrollment.service.js
```js
// Khi enrollment bị WITHDRAWN hoặc REJECTED
async function withdraw(id) {
  await db.query('UPDATE training_enrollment SET status="WITHDRAWN" WHERE id=?', [id]);
  const enrollment = await getById(id);
  // Trigger waitlist
  await waitlistService.promoteNext(enrollment.course_id);
}
```

### Bước 3: Cron job kiểm tra expired trong jobs.js
```js
// Chạy mỗi giờ
cron.schedule('0 * * * *', async () => {
  // Tìm các NOTIFIED đã quá confirm_by
  const expired = await db.query(
    'SELECT * FROM enrollment_waitlist WHERE status="NOTIFIED" AND confirm_by < NOW()'
  );
  for (const entry of expired) {
    await db.query('UPDATE enrollment_waitlist SET status="EXPIRED" WHERE id=?', [entry.id]);
    // Promote người tiếp theo
    await waitlistService.promoteNext(entry.course_id);
  }
});
```

### Bước 4: API xác nhận waitlist
```
POST /api/v1/waitlist/:id/confirm — seafarer xác nhận từ email link
DELETE /api/v1/waitlist/:id       — seafarer tự hủy khỏi waitlist
```

## Acceptance Criteria
- [ ] Khi enrollment bị WITHDRAWN → người đầu waitlist nhận email trong vòng 1 phút
- [ ] Email có link xác nhận với deadline 24h
- [ ] Xác nhận trong 24h → tạo enrollment PENDING
- [ ] Không xác nhận sau 24h → EXPIRED, người tiếp theo được notify
- [ ] Seafarer có thể tự hủy khỏi waitlist
- [ ] Cron job chạy mỗi giờ, xử lý đúng các entry EXPIRED
