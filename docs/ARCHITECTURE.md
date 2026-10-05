# Architecture Overview

## Tổng thể

Hệ thống gồm 2 phần chính:

- `backend/`: Fastify API + business logic + MySQL
- `frontend/`: React SPA cho khối vận hành

Luồng cơ bản:

```text
Browser
  -> React pages / hooks / stores
  -> frontend/src/api/client.js
  -> Fastify routes (/api/v1/*)
  -> services / models / SQL
  -> MySQL
```

## Backend

## Entry points

- `backend/server.js`: khởi động app, register plugin, mount `/api/v1`, expose `/health`, start jobs
- `backend/src/config/index.js`: đọc env và fail fast nếu config bảo mật không hợp lệ
- `backend/src/plugins/index.js`: CORS, JWT, rate limit, multipart, static files, auth decorator

## Backend module map

### Nhóm auth và user

- `auth.routes.js`
- `users.js`
- `services/auth.service.*`

Chịu trách nhiệm login, `auth/me`, verify flow, user management.

### Nhóm seafarer core

- `seafarer.routes.js`
- `certificate.routes.js`
- `employment_contract.routes.js`
- `import.routes.js`

Đây là lõi hồ sơ thuyền viên.

### Nhóm vận hành tuyển người / điều động

- `partner.routes.js`
- `vessel.routes.js`
- `job.routes.js`
- `deployment.routes.js`

Đây là lõi business hiện tại.

### Nhóm master data và biểu mẫu

- `master_data.routes.js`
- `form_template.routes.js`
- `lookup.routes.js`

### Nhóm legacy hoặc phụ trợ

- `messaging.routes.js`
- `notification.routes.js`
- `qr_enrollment.routes.js`
- `seafarer_portal.routes.js`
- `waitlist.routes.js`

Các file này tồn tại trong codebase, nhưng không phải toàn bộ đều là luồng sản phẩm trung tâm hiện tại.

## Quy ước xử lý request

Theo pattern đang dùng:

1. Route nhận request và validate schema.
2. Middleware auth/rbac chặn quyền.
3. Service xử lý nghiệp vụ.
4. Service gọi DB pool hoặc model.
5. Route/service throw `{ statusCode, message }` cho lỗi user-facing.

## Frontend

## Entry points

- `frontend/src/main.jsx`: mount React app
- `frontend/src/App.jsx`: router tree, role guard, theme, React Query provider

## Frontend module map

### Router

`App.jsx` là nguồn sự thật cho:

- route nào đang còn sống,
- màn nào cần auth,
- role nào vào được admin layout,
- public route nào đang mở.

Các route chính hiện tại:

- `/login`
- `/dashboard`
- `/seafarers/*`
- `/partners/*`
- `/jobs/*`
- `/deployments/*`
- `/master-data/*`
- `/messages`
- `/admin/users/*`
- `/enroll/:token` (public)

### API layer

- `frontend/src/api/client.js`: axios instance, bearer token, global 401 handling
- `frontend/src/api/index.js`: tập hợp API theo module

### State

- `frontend/src/stores/authStore.js`: auth state bằng Zustand
- React Query dùng cho server state / data fetching

### Layout và pages

- `layouts/AdminLayout`
- `pages/admin/*`
- `pages/admin/partners/*`

## Role model

Trong code frontend, `ProtectedRoute` cho phép:

- `admin`
- `operator`
- `accountant`

Trong backend/docs cũ, role chuẩn hơn là:

- `admin`
- `operator`
- `accountant`
- `seafarer`

Điểm này nên hiểu là hệ thống đang có cả naming cũ và naming theo label nghiệp vụ mới. Khi sửa auth/rbac, phải kiểm tra cả backend lẫn frontend.

## Data boundaries cần chú ý

- Frontend mặc định gọi `VITE_API_URL` hoặc fallback `http://localhost:3000/api/v1`
- Backend mount API dưới `/api/v1`
- Static uploaded files đi qua `/uploads/*`
- Health check nằm ngoài `/api/v1`, ở `/health`

## Các điểm dễ gây hiểu nhầm cho người mới

- Domain cũ `ship_owner` đã được thay bằng `partner`, nhưng vẫn còn compatibility route `/ship-owners`
- Training/enrollment vẫn còn dấu vết trong DB/code/tasks cũ
- Messaging tồn tại trong code nhưng không nên mặc định xem là trung tâm của sản phẩm
- Có một số module legacy chưa được dọn hoàn toàn, nên route file tồn tại không đồng nghĩa với luồng sản phẩm chính

## Thứ tự đọc code khuyến nghị

1. `frontend/src/App.jsx`
2. `backend/src/routes/v1/index.js`
3. `backend/server.js`
4. `frontend/src/api/client.js`
5. `migration.sql`
6. route/service của module bạn sắp sửa
