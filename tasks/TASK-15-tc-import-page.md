# TASK-15: Training Center Import Page

**Status:** TODO
**Priority:** Medium
**Access:** Training Center role

---

## Mô tả

Trang import danh sách học viên cho Training Center portal. Hiện tại `TCImportPage.jsx` chưa tồn tại trong `frontend/src/pages/training-center/` nhưng đã được đề cập trong spec TASK-11.

---

## File cần tạo

**`frontend/src/pages/training-center/TCImportPage.jsx`**

Tương tự `SeafarerImportPage.jsx` nhưng:
- Upload file Excel danh sách học viên theo khóa học
- Chọn khóa học đích (Select từ `/api/v1/training-courses?training_center_id=...`)
- Preview kết quả: success count, error list (row, message)
- Gọi API: `POST /api/v1/import/excel` hoặc endpoint riêng nếu cần

## Files cần sửa

- **`frontend/src/App.jsx`** — thêm route `/tc/import`
- **`frontend/src/layouts/TrainingCenterLayout.jsx`** — thêm menu item "Import"

---

## Acceptance Criteria
- [ ] Upload file Excel, chọn khóa học, xem kết quả import
- [ ] Hiển thị lỗi từng row rõ ràng
- [ ] Sau import thành công → redirect hoặc thông báo
