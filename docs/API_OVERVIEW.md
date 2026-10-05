# API Overview

## Base URL

Mặc định local:

```text
http://localhost:3000/api/v1
```

Health check:

```text
GET /health
```

## Auth

### `POST /auth/login`

Dùng để đăng nhập admin/operator/kế toán.

Body:

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response:

- `user`
- `token`

### `GET /auth/me`

Đọc thông tin user hiện tại từ JWT.

### `POST /auth/verify/request`
### `POST /auth/verify/confirm`

Các endpoint verify hiện vẫn còn trong auth flow.

## Nhóm endpoint chính đang dùng

## 1. Seafarer

Các route nguồn:

- `seafarer.routes.js`
- `certificate.routes.js`

Nhóm này phục vụ:

- danh sách thuyền viên,
- chi tiết hồ sơ,
- liên hệ,
- chứng chỉ,
- import dữ liệu.

Ví dụ route đang có trong hệ:

- `GET /seafarers`
- `GET /seafarers/:id`
- `POST /seafarers`
- `PUT /seafarers/:id`
- `DELETE /seafarers/:id`
- `GET /seafarers/:seafarerId/certificates`

## 2. Partner

Route nguồn:

- `partner.routes.js`

Nhóm này quản lý đối tác. Hệ thống vẫn giữ alias cũ:

- `/partners`
- `/ship-owners`

Khi viết mới, ưu tiên hiểu và dùng `partner`.

## 3. Vessel

Route nguồn:

- `vessel.routes.js`

Nhóm này quản lý dữ liệu tàu và đồng bộ tàu từ nguồn ngoài theo IMO.

Một endpoint quan trọng theo backlog gần đây:

- lấy thông tin tàu ngoài hệ thống và upsert nội bộ theo IMO.

## 4. Job

Route nguồn:

- `job.routes.js`

Nhóm này là nơi mô tả nhu cầu tuyển người, link với đối tác/tàu/vị trí.

Đây là domain cực quan trọng cho các flow tuyển người và deployment.

## 5. Deployment

Route nguồn:

- `deployment.routes.js`

Nhóm này xử lý:

- tạo deployment theo thuyền viên,
- CRUD deployment,
- đổi trạng thái deployment,
- kiểm tra warning khi chuyển trạng thái.

Hai prefix đáng nhớ:

- `/seafarers/:seafarerId/deployments`
- `/deployments`

## 6. Master data

Route nguồn:

- `master_data.routes.js`
- `lookup.routes.js`
- `form_template.routes.js`

Nhóm này phục vụ:

- dropdown/lookups,
- danh mục nền,
- form templates.

## 7. User admin

Route nguồn:

- `users.js`

Phục vụ quản trị user trong admin area.

## Auth & quyền

Pattern chung cho route bảo vệ:

```js
onRequest: [fastify.authenticate]
```

Nghĩa là:

- request phải có JWT hợp lệ,
- role check thường xảy ra thêm trong route/service/middleware tùy module.

## Response và error pattern

### Thành công

Không có 1 wrapper response cứng cho toàn hệ thống. Nhiều route trả object trực tiếp hoặc data list trực tiếp.

### Lỗi

Backend dùng error handler toàn cục:

- 4xx: trả message an toàn cho client
- 5xx: log nội bộ, trả message lỗi hệ thống chung

Khi viết service/route mới, pattern đang dùng là throw:

```js
{ statusCode, message }
```

## Những chỗ cần nhớ khi dev API mới

- mount dưới `/api/v1`
- dùng parameterized SQL, không nối chuỗi
- nếu bảng có soft delete thì thêm `deleted_at IS NULL`
- route có schema validate càng sớm càng tốt
- frontend kỳ vọng lỗi có field `error` hoặc `message`

## Frontend đang gọi API thế nào

Frontend dùng:

- `frontend/src/api/client.js`

Quy ước:

- tự gắn `Authorization: Bearer <token>`
- nếu `401` thì clear localStorage và quay về `/login`
- base URL lấy từ `VITE_API_URL`

## Khi người mới cần đọc API để bắt đầu

Đọc theo thứ tự:

1. `backend/src/routes/v1/index.js`
2. route file của module đang làm
3. service tương ứng
4. `frontend/src/api/index.js`
5. page đang gọi API đó trong `frontend/src/pages/*`
