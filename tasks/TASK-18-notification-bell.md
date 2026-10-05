# TASK-18: Notification Bell

## Why
Cần thông báo chủ động khi chứng chỉ/hợp đồng/giấy tờ sắp hết hạn thay vì chỉ âm thầm đổi status trong DB. User cần biết ngay trên UI mà không phải vào từng trang kiểm tra.

---

## DB Migration

**File: `backend/migrations/013_notifications.sql`**

```sql
CREATE TABLE notification (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,  -- recipient (FK user.id)
  type       VARCHAR(50)  NOT NULL,  -- xem Notification Types bên dưới
  ref_table  VARCHAR(50)  NULL,      -- seafarer_certificate | employment_contract | training_enrollment
  ref_id     INT          NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT         NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  read_at    DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES user(id)
);
CREATE INDEX idx_notif_user_read ON notification (user_id, is_read);
```

### Notification Types
| Type | Trigger |
|------|---------|
| `CERT_EXPIRY` | Chứng chỉ sắp hết hạn |
| `CONTRACT_END` | Hợp đồng sắp kết thúc |
| `PASSPORT_EXPIRY` | Passport sắp hết hạn |
| `SEAMAN_BOOK_EXPIRY` | Sổ thuyền viên sắp hết hạn |
| `MEDICAL_EXPIRY` | Giấy khám sức khỏe sắp hết hạn |
| `ENROLLMENT_RESULT` | Kết quả đăng ký khóa học |

---

## Backend Changes

### `backend/src/routes/v1/notification.routes.js` (file mới)

```
GET  /notifications              — danh sách notification của user đang login, hỗ trợ ?is_read=false&limit=N
GET  /notifications/unread-count — trả về { count } để hiển thị badge
PATCH /notifications/:id/read   — đánh dấu 1 notification đã đọc
PATCH /notifications/read-all   — đánh dấu tất cả đã đọc
```

Tất cả routes đều filter `user_id = request.user.id` — user chỉ thấy notification của mình.

### `backend/src/routes/v1/index.js`
Đăng ký route mới:
```js
const notificationRoutes = require('./notification.routes');
router.use('/', notificationRoutes);
```

### `backend/src/jobs.js` — Job 7:00 AM daily

Thêm job chạy mỗi ngày lúc 7:00 AM, gửi notification cho:

**Chứng chỉ sắp hết hạn** (30/15/7 ngày):
- Query `seafarer_certificate` JOIN `seafarer` → lấy `user_id` qua `seafarer.user_id`
- `WHERE expiry_date = DATE_ADD(CURDATE(), INTERVAL N DAY)`
- Type: `CERT_EXPIRY`, ref_table: `seafarer_certificate`

**Hợp đồng sắp kết thúc** (30/14/7 ngày):
- Query `employment_contract` JOIN `seafarer` → lấy `user_id`
- `WHERE end_date = DATE_ADD(CURDATE(), INTERVAL N DAY)`
- Type: `CONTRACT_END`, ref_table: `employment_contract`

**Giấy tờ cá nhân sắp hết hạn** (30/15/7 ngày):
- Query `seafarer` trực tiếp: `passport_expiry`, `seaman_book_expiry`, `medical_cert_expiry`
- Types: `PASSPORT_EXPIRY`, `SEAMAN_BOOK_EXPIRY`, `MEDICAL_EXPIRY`

**Dedup** — không insert nếu đã có notification cùng `user_id + type + ref_id` trong 24h:
```sql
WHERE user_id=? AND type=? AND ref_id=? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
```

---

## Frontend Changes

### `frontend/src/api/notificationApi.js` (file mới)

```js
getUnreadCount()              // GET /notifications/unread-count
getNotifications(params)      // GET /notifications?limit=10&is_read=false
markRead(id)                  // PATCH /notifications/:id/read
markAllRead()                 // PATCH /notifications/read-all
```

### `frontend/src/layouts/AdminLayout.jsx`

Thêm `<NotificationBell />` component vào Header (cạnh avatar):

**Poll**: `GET /notifications/unread-count` mỗi 60 giây → hiển thị `<Badge count={n}>`

**Click bell** → `<Dropdown>` hiển thị 10 notification gần nhất:
- Gọi `GET /notifications?limit=10`
- Mỗi item: icon theo type, title, thời gian relative (e.g. "2 giờ trước"), nền xám nhạt nếu chưa đọc
- Click item → `markRead(id)` + navigate đến trang liên quan:
  - `CERT_EXPIRY` / `PASSPORT_EXPIRY` / `SEAMAN_BOOK_EXPIRY` / `MEDICAL_EXPIRY` → `/seafarers/:ref_id` (hoặc seafarer detail)
  - `CONTRACT_END` → `/seafarers/:ref_id`
  - `ENROLLMENT_RESULT` → `/courses/:ref_id`
- Nút "Đánh dấu tất cả đã đọc" ở cuối dropdown → `markAllRead()`

---

## Acceptance Criteria

1. Badge số đỏ xuất hiện trên bell icon khi có thông báo chưa đọc
2. Badge cập nhật mỗi 60 giây (không cần reload trang)
3. Click bell → dropdown hiển thị tối đa 10 thông báo gần nhất
4. Item chưa đọc có nền xám nhạt, item đã đọc nền trắng
5. Click item → navigate đúng trang + đánh dấu đã đọc
6. Nút "Đánh dấu tất cả đã đọc" hoạt động, badge về 0
7. Job 7:00 AM không tạo duplicate notification trong cùng ngày (dedup theo user_id + type + ref_id)
8. Notification chỉ hiển thị của user đang login, không lộ của user khác
