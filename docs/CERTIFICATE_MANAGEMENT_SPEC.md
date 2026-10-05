# Certificate Expiry Notification Spec (Notification only)

## 1) Mục tiêu

Xây dựng module tạo notification in-app cho chứng chỉ thuyền viên sắp hết hạn, đảm bảo:

- Tự động tạo notification khi chứng chỉ đạt các mốc 30/15/14/7 ngày trước hết hạn.
- Chống trùng (idempotent) trong 24 giờ.

## 2) Phạm vi
- Chỉ tập trung vào phần tạo notification sắp hết hạn cho chứng chỉ (dựa trên `seafarer_certificate.expiry_date`).
- Lấy đúng milestones 30/15/14/7 theo logic cron của backend.
- UI hiển thị in-app notification và cho phép đánh dấu đã đọc (dựa trên endpoints `/notifications` hiện tại).

Out of scope (không thuộc spec này):
- CRUD chứng chỉ, upload file, và các rule cập nhật `status/VALID/EXPIRED/REVOKED`.
- Badge hiển thị “Sắp hết hạn/Hết hạn” trên `SeafarerDetailPage` (đang có sẵn).

## 3) Vai trò và quyền

- Nhận notification:
  - Backend tạo notification cho `user_id` được link với `seafarer` (job query theo `seafarer.user_id`).
- Quyền xem:
  - Endpoint notification hiện lọc theo `user_id` của người đang auth, không cần rule role cụ thể trong phần spec này.

## 4) Định nghĩa dữ liệu

### 4.1 Thực thể chính: `seafarer_certificate`

Trường tối thiểu:

- `id` (PK)
- `seafarer_id` (FK, required)
- `certificate_type_id` (FK, required)
- `certificate_no` (optional, unique mềm theo loại + seafarer)
- `issued_date` (required)
- `expiry_date` (nullable; null nghĩa là không hết hạn)
- `status` (`PENDING|VALID|EXPIRED|REVOKED`)
- `issuing_authority` (optional)
- `document_url` (optional nhưng khuyến nghị)
- `created_by`, `updated_by`
- `created_at`, `updated_at`, `deleted_at` (soft delete)

### 4.2 Danh mục loại chứng chỉ: `certificate_type`

- `name`, `code`
- `validity_years` (nullable)
- `is_mandatory` (bool, optional theo nghiệp vụ)
- `is_active`

## 5) Quy tắc trigger notification CERT_EXPIRY

Spec này chỉ mô tả phần “sinh notification” dựa trên chứng chỉ sắp hết hạn.

### 5.1 Cron chạy (backend)

- Job chạy mỗi ngày lúc 07:00 (cron `0 7 * * *`).

### 5.2 Điều kiện chọn chứng chỉ đủ điều kiện

Job query theo ngày hiện tại:

- `seafarer_certificate.deleted_at IS NULL`
- `seafarer.deleted_at IS NULL`
- `seafarer.user_id IS NOT NULL`
- `seafarer_certificate.expiry_date = DATE_ADD(CURDATE(), INTERVAL N DAY)`

Với `N` thuộc các mốc:

- `30`, `15`, `14`, `7`

### 5.3 Idempotency (chống trùng)

Job dùng:

- `notificationService.hasRecentDuplicate(user_id, 'CERT_EXPIRY', seafarer_id, 24)`

=> Dedupe theo `user_id + type(CERT_EXPIRY) + ref_id(seafarer_id)` trong 24 giờ gần nhất.

Lưu ý: job hiện tại KHÔNG kiểm tra `seafarer_certificate.status` (ví dụ `REVOKED/EXPIRED`), chỉ dựa vào `expiry_date` và `deleted_at`.

### 5.4 Nội dung notification tạo

Khi đủ điều kiện và chưa trùng, job tạo notification với:

- `type`: `CERT_EXPIRY`
- `ref_table`: `seafarer_certificate`
- `ref_id`: `seafarer_id` (theo code hiện tại)
- `title`: `Chứng chỉ sắp hết hạn`
- `body`: `${cert_name || 'Chứng chỉ'} hết hạn sau ${label}.`

## 6) Rule thông báo sắp hết hạn

## 6.1 Đối tượng nhận thông báo

- `notification.user_id` được tạo cho user auth được link với `seafarer` (tức `seafarer.user_id`).

## 6.2 Mốc nhắc hạn mặc định

- `30`, `15`, `14`, `7` ngày trước hạn.

## 6.3 Điều kiện gửi
Chỉ gửi khi thỏa các điều kiện job đang query (mục 5.2):

- `seafarer_certificate.deleted_at IS NULL`
- `seafarer.deleted_at IS NULL`
- `seafarer.user_id IS NOT NULL`
- `seafarer_certificate.expiry_date = CURDATE() + N` với `N` thuộc {30, 15, 14, 7}

Idempotency (mục 5.3):
- dedupe theo `user_id + type(CERT_EXPIRY) + ref_id(seafarer_id)` trong 24 giờ gần nhất.

Lưu ý:
- job hiện tại KHÔNG kiểm tra `seafarer_certificate.status`.

## 6.4 Kênh thông báo

- In-app notification (bắt buộc) = tạo bản ghi trong bảng `notification`.
- Email: out-of-scope cho spec này (backend job hiện tại chỉ tạo notification records cho `CERT_EXPIRY`).

Template theo code job:
- `type`: `CERT_EXPIRY`
- `title`: `Chứng chỉ sắp hết hạn`
- `body`: `${cert_name || 'Chứng chỉ'} hết hạn sau ${label}.`

## 7) API đề xuất

### 7.1 Notification (in-app)

- `GET /api/v1/notifications/unread-count`
- `GET /api/v1/notifications?is_read=false&limit=10`
- `PATCH /api/v1/notifications/read-all`
- `PATCH /api/v1/notifications/:id/read`

Lưu ý:
- Backend hiện chưa hỗ trợ filter `type`, nên UI nên lọc theo `notification.type === 'CERT_EXPIRY'`.

## 8) UI/UX yêu cầu tối thiểu
- In-app notification (CERT_EXPIRY) hiển thị thông qua `NotificationBell` hoặc trang/drawer danh sách notification.
- Danh sách notification:
  - lọc theo `notification.type === 'CERT_EXPIRY'`
  - hiển thị tiêu đề/thân bài theo template job (title/body)
  - (khuyến nghị) nhóm theo milestone 30/15/14/7 nếu UI có thể suy ra từ nội dung/fields liên quan.
- Cho phép mark read:
  - action mark single (`PATCH /notifications/:id/read`)
  - action mark all (`PATCH /notifications/read-all`)
- Mỗi item nên có CTA để người dùng quay lại đúng ngữ cảnh hồ sơ, tối thiểu cần điều hướng dựa trên `notification.ref_id` (hiện job set `ref_id = seafarer_id`).

## 9) Logging, audit, và observability
- Log job CERT_EXPIRY:
  - số bản ghi đủ điều kiện (sau query select)
  - số notification được tạo thành công
  - số notification bị bỏ qua do idempotency (hasRecentDuplicate)
- Log lỗi job CERT_EXPIRY để có thể retry an toàn.

## 10) Phi chức năng
- Hiệu năng:
  - `GET /notifications` và `GET /notifications/unread-count` phản hồi < 500ms trong điều kiện dữ liệu thường (có index theo `user_id` + `is_read`).
- Bảo mật:
  - endpoint notification yêu cầu auth, và thao tác mark read chỉ update theo `user_id` của người đang auth.
- Tin cậy:
  - job CERT_EXPIRY phải idempotent, retry an toàn (theo phần 5.3).

## 11) Tiêu chí nghiệm thu (Acceptance Criteria)
- Khi chứng chỉ thỏa điều kiện job:
  - `seafarer_certificate.deleted_at IS NULL`
  - `seafarer.deleted_at IS NULL`
  - `seafarer.user_id IS NOT NULL`
  - `seafarer_certificate.expiry_date = CURDATE() + N` (N thuộc 30/15/14/7)
  - và không bị trùng trong 24h qua dedupe (`hasRecentDuplicate`)
  => hệ thống tạo notification:
    - `type = CERT_EXPIRY`
    - title/body theo template job
- Nếu job chạy lại trong 24h:
  - không tạo thêm notification trùng (dedupe theo `user_id + type + ref_id`).
- UI hiển thị notifications:
  - chỉ render items `type === 'CERT_EXPIRY'`
  - unread count đúng
  - mark read chuyển trạng thái `is_read`.

## 12) Kế hoạch rollout gợi ý

- Phase 1: Xác nhận cron + điều kiện select + content notification (dev/staging).
- Phase 2: Tích hợp UI in-app (NotificationBell/list) để hiển thị CERT_EXPIRY và mark read.
- Phase 3: (Tuỳ chọn) nâng cấp backend filter theo `type` và/hoặc bổ sung kênh email.
