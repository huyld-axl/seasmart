# TASK-12: Seafarer Portal UI

## Why
Giao diện cho thuyền viên — đăng ký tài khoản, xác minh danh tính, xem hồ sơ và đăng ký khóa học.

## Trạng thái: DONE ✅ (RegisterPage, VerifyPage, ProfilePage, CertificatesPage, CoursesPage, HistoryPage)

## Thư mục làm việc
`D:/code/app hàng hải/frontend/src/pages/seafarer/`

## Pages cần tạo

### 1. `/seafarer/register` — Đăng ký tài khoản

**File**: `pages/seafarer/RegisterPage.jsx`

Form:
- Email
- Password + Confirm password
- Số điện thoại
- Button "Đăng ký"

API: `POST /api/v1/auth/register/seafarer`

Sau đăng ký → redirect đến `/seafarer/verify`

### 2. `/seafarer/verify` — Xác minh danh tính

**File**: `pages/seafarer/VerifyPage.jsx`

Step 1: Nhập CCCD → gọi `POST /api/v1/auth/verify/request`
- Hiển thị phone_masked sau khi gửi OTP

Step 2: Nhập OTP 6 chữ số → gọi `POST /api/v1/auth/verify/confirm`
- Dùng Ant Design `Input.OTP` hoặc 6 input riêng
- Countdown 5 phút
- Button "Gửi lại OTP"

### 3. `/seafarer/profile` — Hồ sơ cá nhân

**File**: `pages/seafarer/ProfilePage.jsx`

Components:
- Hiển thị thông tin (read-only): họ tên, CCCD, chức danh, quốc tịch
- Form sửa được: địa chỉ, điện thoại, email, liên hệ khẩn cấp
- Button "Lưu thay đổi"

API: `GET /api/v1/portal/seafarer/profile`, `PUT /api/v1/portal/seafarer/profile`

### 4. `/seafarer/certificates` — Chứng chỉ

**File**: `pages/seafarer/CertificatesPage.jsx`

Components:
- Table chứng chỉ: loại, số, ngày cấp, ngày hết hạn, trạng thái
- Badge màu: còn hạn (xanh), sắp hết hạn < 3 tháng (vàng), hết hạn (đỏ)
- Button upload file scan cho từng chứng chỉ

### 5. `/seafarer/courses` — Đăng ký khóa học

**File**: `pages/seafarer/CoursesPage.jsx`

Components:
- Danh sách khóa học đang mở (status=PLANNED/ONGOING)
- Filter: course_type, training_center
- Card view hoặc table
- Button "Đăng ký" → confirm modal

### 6. `/seafarer/history` — Lịch sử

**File**: `pages/seafarer/HistoryPage.jsx`

Tabs:
- Đào tạo: table enrollments + kết quả
- Hợp đồng: table contracts

## How — Layout

Seafarer Portal dùng layout khác Admin:
- Không có sidebar phức tạp
- Top navigation bar đơn giản
- Mobile-friendly hơn

**File**: `layouts/SeafarerLayout.jsx`

```jsx
// Top nav: logo + menu items + user avatar
// Content: full width, max-width 1200px, centered
```

## Files cần sửa
- `App.jsx` — thêm routes `/seafarer/*`
  - `/seafarer/register` và `/seafarer/verify` — public (không cần auth)
  - Các routes còn lại — cần auth role=seafarer

## Điểm quan trọng
- OTP countdown: dùng `useEffect` + `setInterval`, clear khi unmount
- Certificate expiry badge: tính từ `expiry_date - today`
- Seafarer chưa verify → redirect về `/seafarer/verify`
- Mobile responsive quan trọng hơn Admin Portal

## Acceptance Criteria
- [ ] Register → nhận JWT → redirect verify
- [ ] Verify: nhập CCCD → nhận OTP → nhập OTP → success
- [ ] OTP countdown 5 phút hiển thị đúng
- [ ] Profile: xem được, sửa được các field cho phép
- [ ] Certificates: badge màu đúng theo expiry
- [ ] Courses: đăng ký được, hiển thị confirm
- [ ] History: xem được lịch sử đào tạo và hợp đồng
