# TASK-10: Admin Portal UI

## Why
Giao diện quản trị chính — admin và operator quản lý thuyền viên, khóa học, trung tâm đào tạo.

## Trạng thái: DONE ✅

### Đã hoàn thành
- **LoginPage** ✅
- **SeafarerListPage** ✅ — search/filter/paging
- **SeafarerFormPage** ✅ — tạo mới + sửa, 7 section
- **SeafarerDetailPage** ✅ — 4 tab: hồ sơ, chứng chỉ, hợp đồng, đào tạo
- **SeafarerImportPage** ✅
- **TrainingCenterListPage** ✅
- **TrainingCenterDetailPage** ✅ — tab thông tin + khóa học
- **CourseListPage** ✅
- **CourseDetailPage** ✅ — tab thông tin + học viên + nhập điểm
- **MasterSubPage** ✅ — CRUD 6 tab danh mục (cert, vessel, country, contract, course, port)
- **MessagingPage** ✅ — inbox + gửi tin nhắn
- **UserListPage** ✅ — `/admin/users`
- **UserDetailPage** ✅ — `/admin/users/:id`
- **DashboardPage** ✅ — tổng quan (có nhưng route `/` redirect sang `/seafarers`)

## Thư mục làm việc
`D:/code/app hàng hải/frontend/src/`

## Pages cần tạo

### 1. `/seafarers` — Danh sách thuyền viên

**File**: `pages/admin/SeafarerListPage.jsx`

Components:
- Filter bar: search input + select rank + select status + button "Thêm mới" + button "Import Excel"
- Table: seafarer_code, full_name, rank, national_id, phone, status, actions (xem/sửa/xóa)
- Pagination

API: `GET /api/v1/seafarers?search=&rank_id=&page=&limit=`

### 2. `/seafarers/import` — Import Excel

**File**: `pages/admin/SeafarerImportPage.jsx`

Components:
- Upload dragger (Ant Design `Upload.Dragger`)
- Preview kết quả: success count, error list (row, message)
- Button download file mẫu

API: `POST /api/v1/import/excel` (multipart)

### 3. `/seafarers/:id` — Chi tiết thuyền viên

**File**: `pages/admin/SeafarerDetailPage.jsx`

Components:
- Tabs: Hồ sơ | Chứng chỉ | Hợp đồng | Đào tạo
- Tab Hồ sơ: form 2 cột hiển thị thông tin
- Tab Chứng chỉ: table + button thêm + upload file
- Tab Hợp đồng: table lịch sử
- Tab Đào tạo: table enrollment

### 4. `/training-centers` — Danh sách trung tâm

**File**: `pages/admin/TrainingCenterListPage.jsx`

### 5. `/training-centers/:id` — Chi tiết trung tâm

**File**: `pages/admin/TrainingCenterDetailPage.jsx`

Components:
- Thông tin trung tâm
- Danh sách khóa học của trung tâm

### 6. `/courses` — Danh sách khóa học

**File**: `pages/admin/CourseListPage.jsx`

### 7. `/courses/:id` — Chi tiết khóa học

**File**: `pages/admin/CourseDetailPage.jsx`

Components:
- Thông tin khóa học
- Danh sách học viên đã đăng ký
- Form nhập điểm

## How — Thứ tự implement

1. `SeafarerListPage.jsx` — quan trọng nhất, làm trước
2. `SeafarerImportPage.jsx`
3. `SeafarerDetailPage.jsx` (4 tabs)
4. `TrainingCenterListPage.jsx`
5. `TrainingCenterDetailPage.jsx`
6. `CourseListPage.jsx`
7. `CourseDetailPage.jsx`

## Shared Components cần tạo

**File**: `components/common/PageHeader.jsx`
```jsx
// Title + breadcrumb + action buttons
```

**File**: `components/common/SearchFilterBar.jsx`
```jsx
// Wrapper cho filter bar với consistent styling
```

**File**: `components/seafarer/SeafarerForm.jsx`
```jsx
// Form 2 cột dùng chung cho create/edit
```

## Design Spec áp dụng (từ TASKS.md)
- Table: header bg `#fafafa`, row height `52px`, hover `#e6f4ff`
- Filter bar: input height `32px`, gap `8px`
- Buttons: border-radius `6px`, height `32px`
- Page title: `20px weight 600`

## Files cần sửa
- `App.jsx` — thêm routes mới
- `layouts/AdminLayout.jsx` — thêm menu items

## Acceptance Criteria
- [ ] SeafarerListPage: search, filter rank, pagination hoạt động
- [ ] SeafarerListPage: click row → navigate đến detail
- [ ] SeafarerImportPage: upload file, hiển thị kết quả
- [ ] SeafarerDetailPage: 4 tabs load đúng data
- [ ] Tất cả pages responsive (không vỡ layout ở 1280px)
- [ ] Loading state khi fetch data
- [ ] Error state khi API fail
