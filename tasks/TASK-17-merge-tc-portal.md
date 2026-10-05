# TASK-17: Merge TC Portal vào Admin Portal

## Why
TC portal riêng (`/tc/*`) gây phân tán code, khó maintain, và tạo ra security gap (không có ownership check). Merge vào Admin portal với phân quyền menu — TC chỉ thấy Khóa học + Tin nhắn, dùng chung AdminLayout, xóa hoàn toàn TC portal cũ.

## Scope
1. Backend: fix security gaps (auto-filter + ownership check)
2. Frontend: menu filter theo role, cập nhật routes, user picker Messaging
3. Xóa TC portal cũ

---

## Backend Changes

### `backend/src/routes/v1/enrollment.routes.js`
- `GET /`: nếu `request.user.role === 'training_center'`, tự inject `training_center_id = request.user.linked_entity_id` — không cho client override qua query param
- `GET /:id`: nếu role là `training_center`, check `enrollment.training_center_id === request.user.linked_entity_id` → 403 nếu không khớp

### `backend/src/routes/v1/training_course.routes.js`
- `GET /:id`: nếu role là `training_center`, check `course.training_center_id === request.user.linked_entity_id` → 403 nếu không khớp

### `backend/src/routes/v1/users.js`
- Thêm `GET /users/search?q=...`
  - Yêu cầu authenticate (mọi role)
  - JOIN theo `linked_entity_type`: seafarer → `seafarer.full_name`, training_center → `training_center.name`, các role khác → `user.email`
  - Trả về: `[{ id, email, display_name, role }]`
  - Dùng cho user picker trong MessagingPage

---

## Frontend Changes

### `frontend/src/layouts/AdminLayout.jsx`
Tạo hàm `getMenuItems(role)` lọc menu theo role:
- `training_center`: chỉ thấy **Khóa học** (`/courses`) và **Tin nhắn** (`/messages`)
- Các role khác: giữ nguyên toàn bộ menu hiện tại

Thay `menuItems` tĩnh bằng `getMenuItems(user?.role)`.

### `frontend/src/App.jsx`
- Thêm `'training_center'` vào `roles` của ProtectedRoute cho: `/courses`, `/courses/:id`, `/messages`
- Xóa toàn bộ route group TrainingCenterLayout:
  - `/tc/dashboard`
  - `/tc/courses`
  - `/tc/courses/:id/students`
  - `/tc/students`
- Thêm redirect: `<Route path="/tc/*" element={<Navigate to="/courses" replace />} />`

### `frontend/src/pages/admin/LoginPage.jsx`
- Sửa redirect sau login cho `training_center`: `/tc/dashboard` → `/courses`

### `frontend/src/pages/admin/MessagingPage.jsx`
- Thay input "nhập User ID" bằng `<Select showSearch>` gọi `GET /users/search?q=...`
- Hiển thị: display_name + role + email để chọn
- Sau khi chọn, lấy `id` làm recipient

---

## Files cần xóa

- `frontend/src/layouts/TrainingCenterLayout.jsx`
- `frontend/src/pages/training-center/TCDashboardPage.jsx`
- `frontend/src/pages/training-center/TCCoursesPage.jsx`
- `frontend/src/pages/training-center/TCStudentsPage.jsx`
- `frontend/src/pages/training-center/TCCourseStudentsPage.jsx`

---

## Notes

- `GET /training-courses` (list) đã có filter theo `training_center_id` từ trước — không cần sửa
- `GET /users/search` cần JOIN theo `linked_entity_type` để lấy display name đúng
- Messaging mở hoàn toàn: TC nhắn được với TC khác, admin, seafarer — không cần filter
- Sau khi xóa TC portal, import trong `App.jsx` cần dọn sạch để tránh dead import

---

## Acceptance Criteria

1. Login `training_center` → redirect về `/courses`
2. Menu chỉ hiện "Khóa học" và "Tin nhắn"
3. `GET /enrollments` không có param → chỉ trả về enrollment của TC đó
4. `GET /training-courses/:id` của TC khác → 403
5. `GET /enrollments/:id` của TC khác → 403
6. Truy cập `/tc/dashboard` → redirect về `/courses`
7. Login `admin` → thấy đủ menu như cũ
8. Messaging: search user theo tên/email hoạt động, không cần nhập ID thủ công
