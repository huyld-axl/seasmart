# TASK-19: Admin CRUD Fixes

## Why
QA audit phát hiện nhiều nút/action bị thiếu hoặc dead trong Admin portal. Backend đã sẵn sàng, chỉ cần wire frontend.

## Scope

### 1. TrainingCenterListPage
- Nút "Thêm mới" có render nhưng không có `onClick` → thêm handler mở modal/form tạo mới
- Thêm nút Edit + Delete trên mỗi row của table

### 2. TrainingCenterDetailPage
- Thêm nút "Chỉnh sửa" → mở form edit (inline hoặc modal)
- Thêm nút "Xóa" → confirm dialog → DELETE `/training-centers/:id` → redirect về list

### 3. SeafarerListPage
- Thêm nút Delete trên mỗi row → confirm dialog → DELETE `/seafarers/:id`

### 4. SeafarerFormPage (edit mode)
- Thêm nút "Xóa thuyền viên" → confirm dialog → DELETE `/seafarers/:id` → redirect về list

### 5. UserDetailPage
- Thêm nút "Xóa user" → confirm dialog → DELETE `/users/:id` → redirect về list

---

## Backend check
- `DELETE /training-centers/:id` — kiểm tra đã có chưa (TASK-01)
- `DELETE /seafarers/:id` — kiểm tra đã có chưa (TASK-00)
- `DELETE /users/:id` — kiểm tra đã có chưa (TASK-14)
- `PUT /training-centers/:id` — kiểm tra đã có chưa (TASK-01)

Nếu thiếu endpoint nào thì thêm vào backend trước.

---

## Notes
- Confirm dialog trước khi xóa: "Bạn có chắc muốn xóa [tên]? Hành động này không thể hoàn tác."
- Sau xóa thành công: toast success + redirect/refresh list
- TrainingCenter có thể có khóa học liên quan — backend cần xử lý cascade hoặc trả lỗi rõ ràng (409 Conflict)

---

## Acceptance Criteria
1. TrainingCenterListPage: click "Thêm mới" → form tạo mới hoạt động
2. TrainingCenterListPage: Edit/Delete trên row hoạt động
3. TrainingCenterDetailPage: Edit → lưu được thay đổi; Delete → xóa + redirect
4. SeafarerListPage: Delete trên row hoạt động
5. SeafarerFormPage (edit): nút Xóa hoạt động
6. UserDetailPage: nút Xóa hoạt động
7. Tất cả xóa đều có confirm dialog
