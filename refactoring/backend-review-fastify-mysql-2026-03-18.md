# Backend Review (Fastify + MySQL + JWT) - 2026-03-18

Phạm vi: `backend/` (Fastify), MySQL connection pool `src/config/db.js`, JWT `@fastify/jwt`.

## Tổng quan

### Điểm làm tốt
- Config “fail-fast” cho JWT: chặn `JWT_SECRET` rỗng/giá trị mặc định yếu (`backend/src/config/index.js`).
- Global error handler: 5xx không leak lỗi nội bộ/stack ra client (`backend/server.js`).
- SQL đa phần dùng placeholder `?` (giảm rủi ro SQL injection).
- OTP verify: dùng `crypto.randomInt`, lưu hash OTP + `attempt_count` + TTL; tạo OTP trong transaction (`backend/src/services/auth.service.js`).
- Rate limit đã áp ở một số endpoint nhạy cảm (login/register/verify).

## Findings theo mức độ ưu tiên

### 🔴 CRITICAL - cần sửa ngay
1) **Self-register role `admin`**
   - `POST /api/v1/auth/register` cho client gửi `role` và enum có cả `admin`.
   - Hậu quả: bất kỳ ai gọi endpoint public có thể tự tạo tài khoản admin.
   - Khuyến nghị:
     - Tách “public register” chỉ cho `seafarer` (không nhận `role` từ client).
     - Việc tạo user role đặc quyền phải đi qua API admin-only (ví dụ `POST /api/v1/users`).
     - Hoặc giữ `/auth/register` nhưng bắt buộc `adminOnly` (không public).

### 🟠 HIGH
2) **Rủi ro secrets**: tồn tại `backend/.env`
   - Dễ bị chia sẻ/commit/zip nhầm.
   - Khuyến nghị: chỉ giữ `.env.example`, `.env` nằm ngoài VCS; secrets qua env server/CI.

3) **Bug logic phân trang**: `total` ports bỏ qua filter search
   - `GET /api/v1/admin/master/ports` (trong `master_data.routes.js`) list có `search` nhưng `COUNT(*)` đang không áp filter → UI total sai.

4) **Chưa chuẩn hoá cap `limit`**
   - Một số list endpoint nhận `limit` nhưng không giới hạn (hoặc giới hạn không nhất quán).
   - Khuyến nghị: chuẩn hoá \(limit\) với max (100/200) và validate schema querystring.

### 🟡 MEDIUM
5) **SQL dynamic cần giữ “đóng”**
   - `makeCrud(table, orderBy)` có `ORDER BY ${orderBy}`; hiện `orderBy` hardcode từ code nên OK, nhưng tuyệt đối không cho client điều khiển.
   - `table` đang fix trong code; nếu tương lai map theo param phải whitelist table.

6) **Rate limit coverage**
   - `@fastify/rate-limit` đang để `global: false` (per-route).
   - Khuyến nghị: áp rate-limit global “nhẹ”, override cho endpoint nhạy cảm (auth/import/export).

7) **Validate schema chưa đồng đều**
   - Nhiều route write/update chưa có schema đầy đủ → dễ rác dữ liệu + lỗi runtime.
   - Khuyến nghị: thêm schema cho body/query (đặc biệt paging, id, payload update) và cân nhắc `additionalProperties: false` cho payload quan trọng.

8) **Import upload nuốt lỗi pipeline**
   - `pipeline(...).catch(() => {})` làm mất nguyên nhân lỗi; có thể chạy import với file lỗi/không đầy đủ.
   - Khuyến nghị: nếu pipeline lỗi → trả lỗi và không chạy import.

## Đề xuất thứ tự xử lý
1) Chặn self-register `admin` (Critical)
2) Sửa COUNT ports + chuẩn hoá cap limit + schema querystring (High)
3) Tăng coverage validate + rate-limit global “nhẹ” (Medium)
4) Siết luồng import pipeline error (Medium)

