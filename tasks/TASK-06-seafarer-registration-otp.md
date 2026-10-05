# TASK-06: Seafarer Self-Registration + OTP

## Why
Cho phép thuyền viên tự đăng ký tài khoản và xác minh danh tính với hồ sơ đã có trong hệ thống.
Flow: đăng ký → nhập CCCD → nhận OTP → xác nhận → admin duyệt.

## Trạng thái: PENDING

## Files cần sửa
- `backend/src/services/auth.service.js` — thêm 3 function mới
- `backend/src/routes/v1/auth.routes.js` — thêm 3 endpoint mới

## Schema bảng `otp_verification`
```
id, user_id, national_id, otp_hash, expires_at, attempt_count,
is_used, created_at
```

## How — Các bước thực hiện

### Bước 1: Thêm vào `auth.service.js`

**registerSeafarer({ email, password, phone })**
```js
// 1. Kiểm tra email chưa tồn tại
// 2. Hash password
// 3. INSERT user: role='seafarer', verification_status='unverified'
// 4. Trả về JWT token (dùng được ngay)
```

**requestOtp({ userId, nationalId })**
```js
// 1. Tìm seafarer theo national_id
// 2. Kiểm tra seafarer.user_id IS NULL (chưa có tài khoản liên kết)
// 3. Generate OTP 6 chữ số
// 4. Hash OTP bằng bcrypt
// 5. INSERT otp_verification (expires_at = NOW() + 5 phút)
// 6. Log OTP ra console (thay cho SMS thực tế)
// 7. Trả về { phone_masked: "090****584" }
```

**confirmOtp({ userId, nationalId, otp })**
```js
// 1. Tìm otp_verification mới nhất chưa dùng, chưa hết hạn
// 2. Kiểm tra attempt_count < 5
// 3. bcrypt.compare(otp, otp_hash)
// 4. Nếu sai: tăng attempt_count, trả về lỗi
// 5. Nếu đúng:
//    - UPDATE otp_verification SET is_used = 1
//    - UPDATE seafarer SET user_id = userId
//    - UPDATE user SET verification_status = 'pending', linked_entity_type='seafarer', linked_entity_id=seafarerId
// 6. Trả về { message: "Xác minh thành công, chờ admin duyệt" }
```

### Bước 2: Thêm vào `auth.routes.js`

```
POST /register/seafarer   → registerSeafarer (public)
POST /verify/request      → requestOtp (cần auth: role=seafarer, status=unverified)
POST /verify/confirm      → confirmOtp (cần auth: role=seafarer)
```

### Bước 3: Mask phone number

```js
function maskPhone(phone) {
  // "0901234584" → "090****584"
  if (!phone || phone.length < 7) return '***'
  return phone.slice(0, 3) + '****' + phone.slice(-3)
}
```

## Các kịch bản

### Phương án A: OTP lưu DB (CHỌN)
- Bảng `otp_verification` trong MySQL
- Ưu: không cần Redis, đơn giản
- Nhược: cần cleanup job (xóa OTP hết hạn)

### Phương án B: Redis TTL
- Lưu OTP trong Redis với TTL tự động
- Ưu: tự cleanup, nhanh
- Nhược: cần cài Redis, thêm dependency

**Chọn Phương án A** — đã quyết định từ đầu dự án, không cần Redis.

## Điểm quan trọng
- OTP hash bằng bcrypt (không lưu plaintext)
- Giới hạn 5 lần nhập sai → block (attempt_count >= 5)
- Mỗi request OTP mới → tạo record mới (không update cũ)
- Cleanup: có thể thêm cron job xóa OTP hết hạn sau (không cần ngay)
- SMS thực tế: tích hợp sau (Twilio, VNPT SMS...), hiện tại console.log
- `verification_status` flow: `unverified` → `pending` (sau OTP) → `verified` (sau admin duyệt)

## Acceptance Criteria
- [ ] POST /register/seafarer tạo user role=seafarer, trả về JWT
- [ ] POST /verify/request tìm seafarer theo national_id, trả về phone_masked
- [ ] POST /verify/request báo lỗi nếu seafarer đã có user_id
- [ ] POST /verify/confirm: sai OTP tăng attempt_count
- [ ] POST /verify/confirm: đúng OTP → link seafarer.user_id, status='pending'
- [ ] Sau 5 lần sai → báo lỗi "Đã vượt quá số lần thử"
- [ ] OTP hết hạn sau 5 phút → báo lỗi
