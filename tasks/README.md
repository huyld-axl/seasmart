# Crew Manning - Task Files

Mỗi file là 1 task độc lập với đầy đủ context để implement.

> Dự án đã được đổi tên từ **MarinePort** → **Crew Manning** (2026-04-10).

## Trạng thái tổng quan (cập nhật 2026-04-28)

Các file task đã **DONE** và **REMOVED** đã được dọn khỏi thư mục `tasks/` để backlog gọn hơn.

### Task còn trong thư mục (backlog thực thi)

| Task | Trạng thái hiện tại |
|------|----------------------|
| **TASK-DOMAIN-SPEC-CREW-2026** | ⏳ BACKLOG (menu, 20 rank, trạng thái 3 màu, hồ sơ, CV, **+ task tài liệu D**) - xem `tasks/TASK-DOMAIN-SPEC-CREW-2026.md` |
| TASK-13 | ⏳ TODO |
| TASK-16 | ⏸ SKIPPED |
| TASK-D1 | ⏳ PENDING |
| TASK-A1/A2/A3 | ⏳ PENDING |
| TASK-B1/B2/B3/B4/B5/B6 | ⏳ PENDING |
| TASK-C1/C2 | ⏳ PENDING |

---

## Đã hoàn thành trong đợt Crew Manning Redesign (2026-04-10)

### Thay đổi lớn
- **Đổi tên**: MarinePort → Crew Manning (brand, logo, tất cả UI)
- **Xóa Training Center**: routes backend, pages frontend, API layer, EnrollmentsSection
- **Thêm module Đối tác**: PartnerListPage (danh sách tàu + chủ tàu) + JobOpeningsPage
- **Xóa tab Điều Động** khỏi SeafarerDetailPage
- **Đổi tên**: "Công tác" → "Lịch sử công tác"
- **Đổi nhãn**: "Chức danh" → "Vị trí" (toàn bộ frontend, không đổi DB)
- **Thêm thống kê**: SeafarerListPage hiển thị số sẵn sàng / trên tàu
- **Thêm RankTab** vào Danh mục (CRUD vị trí), xóa CourseTypeTab
- **Role labels**: admin → Chủ doanh nghiệp, operator → Chuyên viên, accountant → Kế toán
- **Phân quyền Kế toán**: view-only Danh mục, ẩn nút Thêm/Import/Xóa thuyền viên

### Files thêm mới
- `migration_partners.sql` - tạo bảng `job_posting`
- `backend/src/routes/v1/ship_owner.routes.js`
- `backend/src/routes/v1/job_posting.routes.js`
- `frontend/src/pages/admin/partners/PartnerListPage.jsx`
- `frontend/src/pages/admin/partners/JobOpeningsPage.jsx`

### Files bị xóa
- `backend/src/routes/v1/training_center.routes.js`
- `backend/src/routes/v1/training_course.routes.js`
- `backend/src/routes/v1/enrollment.routes.js`
- `frontend/src/pages/admin/TrainingCenterListPage.jsx`
- `frontend/src/pages/admin/TrainingCenterDetailPage.jsx`
- `frontend/src/pages/admin/CourseListPage.jsx`
- `frontend/src/pages/admin/CourseDetailPage.jsx`

---

## Pending tasks

### TASK-13: Deploy VPS
Chưa deploy lên server sau đợt redesign lớn.
Cần chạy `migration_partners.sql` trên DB production trước khi deploy.

### Nhóm migration/enrollment đang pending
- `TASK-A1`, `TASK-A2`, `TASK-A3`
- `TASK-B1` → `TASK-B6`
- `TASK-C1`, `TASK-C2`

### Task pending độc lập
- `TASK-D1`: Export HĐ Hồng XLSX

---

## Features để sau (chưa có task file)

- **Báo cáo / Dashboard** - thống kê thuyền viên theo trạng thái, vị trí, tàu
- **Import hợp đồng từ Excel** - TÊN TÀU, NGÀY NHẬP TÀU, NGÀY RỜI TÀU, Lương → tạo contract row
- **Seafarer Portal** - cập nhật sau khi training/enrollment bị xóa
- **Job Matching** - ghép thuyền viên sẵn sàng với job openings
- **Thông báo gia hạn chứng chỉ** - cảnh báo khi chứng chỉ sắp hết hạn

---

## Quy ước
Mỗi file task gồm: Why, Schema, How (từng bước), Các kịch bản + trade-off, Điểm quan trọng, Acceptance Criteria.
Đọc `CLAUDE.md` trước khi bắt đầu bất kỳ task nào.

## Stack hiện tại
- **Backend**: Fastify + MySQL, `backend/src/routes/v1/`
- **Frontend**: React + Ant Design + React Query + Vite, `frontend/src/`
- **Roles**: admin (Chủ doanh nghiệp) / operator (Chuyên viên) / accountant (Kế toán) / seafarer
- **training_center**: role legacy còn trong dữ liệu cũ (không dùng cho RBAC hiện tại)
