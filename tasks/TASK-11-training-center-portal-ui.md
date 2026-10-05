# TASK-11: Training Center Portal UI

## Why
Giao diện riêng cho trung tâm đào tạo — quản lý khóa học và học viên của trung tâm mình.

## Trạng thái: DONE ✅ (TCDashboardPage, TCCoursesPage, TCCourseStudentsPage, TCStudentsPage — thiếu TCImportPage)

## Thư mục làm việc
`D:/code/app hàng hải/frontend/src/pages/training-center/`

## Pages cần tạo

### 1. `/tc/dashboard` — Tổng quan trung tâm

**File**: `pages/training-center/TCDashboardPage.jsx`

Components:
- Stats cards: tổng khóa học, học viên đang học, khóa học sắp khai giảng
- Danh sách khóa học gần đây

### 2. `/tc/courses` — Danh sách khóa học

**File**: `pages/training-center/TCCourseListPage.jsx`

- Chỉ hiển thị khóa học của trung tâm mình
- Filter: status, course_type
- Button tạo khóa học mới

### 3. `/tc/courses/:id/students` — Học viên theo khóa + nhập điểm

**File**: `pages/training-center/TCCourseStudentsPage.jsx`

Components:
- Thông tin khóa học (header)
- Table học viên đã đăng ký
- Inline edit điểm (attendance, process, interview)
- Button "Lưu điểm" + "Cấp chứng chỉ"

### 4. `/tc/students` — Tất cả học viên của trung tâm

**File**: `pages/training-center/TCStudentListPage.jsx`

- Aggregate từ tất cả khóa học của trung tâm
- Search theo tên, seafarer_code

### 5. `/tc/import` — Import danh sách học viên

**File**: `pages/training-center/TCImportPage.jsx`

- Tương tự SeafarerImportPage nhưng tự động gán vào trung tâm

## How — Layout

Training Center Portal dùng cùng `AdminLayout.jsx` nhưng menu items khác:
- Tổng quan
- Khóa học
- Học viên
- Import

## Files cần sửa
- `App.jsx` — thêm routes `/tc/*` với ProtectedRoute role=['training_center']
- `layouts/AdminLayout.jsx` — render menu khác nhau theo role

## Phương án render menu theo role

```jsx
// AdminLayout.jsx
const menuItems = user.role === 'training_center'
  ? tcMenuItems
  : adminMenuItems
```

## Design Spec
Dùng cùng design spec với Admin Portal (TASKS.md).

## Acceptance Criteria
- [ ] Route `/tc/*` chỉ accessible với role=training_center
- [ ] Dashboard hiển thị stats của trung tâm mình
- [ ] Course list chỉ hiển thị khóa học của trung tâm mình
- [ ] Nhập điểm và lưu được
- [ ] Import hoạt động
