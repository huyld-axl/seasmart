# TASK-C1: Notification — Cảnh Báo Enrollment

## Why
Khi có thay đổi trạng thái enrollment (tạo mới, duyệt, từ chối), các bên liên quan cần được thông báo qua email để không bỏ lỡ.
Cron job đã có sẵn trong `jobs.js` — cần thêm các job mới và email templates.

## Trạng thái: PENDING (blocked by TASK-A1, TASK-B1, TASK-B2)

## Files cần sửa
- `D:/code/app hàng hải/backend/src/jobs.js` — thêm cron job reminder
- `D:/code/app hàng hải/backend/src/services/enrollment.service.js` — trigger email khi approve/reject

## Files cần tạo
- `D:/code/app hàng hải/backend/src/templates/email-enrollment-pending.html`
- `D:/code/app hàng hải/backend/src/templates/email-enrollment-approved.html`
- `D:/code/app hàng hải/backend/src/templates/email-enrollment-rejected.html`
- `D:/code/app hàng hải/backend/src/templates/email-course-reminder.html`

## Các loại notification

### 1. Enrollment PENDING → Email cho training_center
- **Trigger**: Khi tạo enrollment với status = PENDING (self-enroll hoặc QR)
- **Gửi đến**: Email của training_center phụ trách course
- **Nội dung**: Tên thuyền viên, tên khóa học, link duyệt

### 2. Enrollment APPROVED → Email cho seafarer
- **Trigger**: Khi approve enrollment (TASK-B1)
- **Gửi đến**: Email của seafarer
- **Nội dung**: Tên khóa học, ngày bắt đầu, địa điểm, hướng dẫn chuẩn bị

### 3. Enrollment REJECTED → Email cho seafarer
- **Trigger**: Khi reject enrollment (TASK-B1)
- **Gửi đến**: Email của seafarer
- **Nội dung**: Tên khóa học, lý do từ chối, hướng dẫn liên hệ lại

### 4. Course Reminder (3 ngày trước) → Email cho seafarer
- **Trigger**: Cron job chạy hàng ngày lúc 8:00 sáng
- **Logic**: Tìm tất cả enrollment APPROVED/ACTIVE có course.start_date = TODAY + 3 ngày
- **Gửi đến**: Email seafarer
- **Nội dung**: Nhắc nhở ngày giờ, địa điểm, tài liệu cần mang

## How — Các bước thực hiện

### Bước 1: Hàm sendEnrollmentNotification trong notification.service.js (hoặc trực tiếp trong enrollment.service.js)

```js
async function notifyEnrollmentPending(enrollmentId) {
  const data = await getEnrollmentWithDetails(enrollmentId);
  const centerEmail = data.center_email;
  await sendEmail({
    to: centerEmail,
    subject: `[MarinePort] Đăng ký mới: ${data.seafarer_name} - ${data.course_name}`,
    template: 'email-enrollment-pending',
    vars: { seafarer_name: data.seafarer_name, course_name: data.course_name, approve_url: `...` }
  });
}

async function notifyEnrollmentApproved(enrollmentId) { ... }
async function notifyEnrollmentRejected(enrollmentId, reason) { ... }
```

### Bước 2: Gọi notification trong enrollment.service.js
```js
// Sau khi tạo enrollment PENDING
await notifyEnrollmentPending(newEnrollmentId);

// Sau khi approve
await notifyEnrollmentApproved(id);

// Sau khi reject
await notifyEnrollmentRejected(id, reason);
```

### Bước 3: Thêm cron job vào jobs.js
```js
// Chạy mỗi ngày lúc 8:00 sáng
cron.schedule('0 8 * * *', async () => {
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const dateStr = threeDaysLater.toISOString().split('T')[0];

  const enrollments = await db.query(`
    SELECT e.*, s.email as seafarer_email, s.full_name, tc.name as course_name,
           tc.start_date, tc.location
    FROM training_enrollment e
    JOIN seafarer s ON e.seafarer_id = s.id
    JOIN training_course tc ON e.course_id = tc.id
    WHERE e.status IN ('APPROVED','ACTIVE')
      AND DATE(tc.start_date) = ?
      AND s.email IS NOT NULL
  `, [dateStr]);

  for (const e of enrollments) {
    await sendEmail({ to: e.seafarer_email, template: 'email-course-reminder', vars: e });
  }
});
```

## Acceptance Criteria
- [ ] Tạo enrollment PENDING → training_center nhận email trong vòng 1 phút
- [ ] Approve enrollment → seafarer nhận email xác nhận
- [ ] Reject enrollment → seafarer nhận email kèm lý do
- [ ] Cron job 8:00 sáng gửi reminder cho khóa học bắt đầu sau 3 ngày
- [ ] Không gửi email nếu seafarer/center không có email
- [ ] Email có nội dung tiếng Việt, format HTML đẹp
