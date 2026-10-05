# TASK-16: Admin Dashboard Page

**Status:** TODO
**Priority:** Low
**Access:** Admin, Operator

---

## Mô tả

`DashboardPage.jsx` đã tồn tại trong `frontend/src/pages/admin/` nhưng route `/` hiện redirect thẳng sang `/seafarers`. Cần quyết định có dùng dashboard hay không, và nếu có thì bổ sung vào sidebar + route.

---

## Hiện trạng

- File `pages/admin/DashboardPage.jsx` tồn tại
- Route `/` → `<Navigate to="/seafarers" replace />` (bỏ qua dashboard)
- Sidebar không có link đến dashboard

---

## Việc cần làm

**Option A — Bật dashboard:**
1. Sửa `App.jsx`: thêm `<Route path="/dashboard" element={<DashboardPage />} />`
2. Sửa `App.jsx`: đổi redirect `/` → `/dashboard`
3. Sửa `AdminLayout.jsx`: thêm menu item "Tổng quan" → `/dashboard`
4. Kiểm tra nội dung `DashboardPage.jsx` — bổ sung stats cards nếu cần

**Option B — Bỏ hẳn:**
1. Xóa `DashboardPage.jsx`
2. Giữ nguyên redirect `/` → `/seafarers`

---

## Acceptance Criteria
- [ ] Quyết định Option A hoặc B
- [ ] Nếu A: dashboard hiển thị stats (tổng thuyền viên, khóa học đang mở, chứng chỉ sắp hết hạn)
