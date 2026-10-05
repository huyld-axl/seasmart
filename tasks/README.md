# MarinePort — Task Files

Mỗi file là 1 task độc lập với đầy đủ context để implement.

## Trạng thái tổng quan (cập nhật 2026-03-15)

| Task | Tên | Trạng thái |
|------|-----|------------|
| TASK-00 | DB Migration (23 bảng) | ✅ DONE |
| TASK-00b | Nâng cấp Import Excel (44 cột) | ✅ DONE |
| TASK-01 | Training Center API | ✅ DONE |
| TASK-02 | Training Course API | ✅ DONE |
| TASK-03 | Enrollment API | ✅ DONE |
| TASK-04 | Certificate Upload API | ✅ DONE |
| TASK-05 | Lookup API | ✅ DONE |
| TASK-06 | Seafarer Self-Registration + OTP | ✅ DONE |
| TASK-07 | Seafarer Portal API | ✅ DONE |
| TASK-08 | Messaging API (backend) | ✅ DONE |
| TASK-09 | Frontend Setup | ✅ DONE |
| TASK-10 | Admin Portal UI | ✅ DONE |
| TASK-11 | Training Center Portal UI | 🚫 CANCELLED (TC portal bị xóa, merge vào admin) |
| TASK-12 | Seafarer Portal UI | ✅ DONE |
| TASK-13 | Deploy VPS | ⏳ TODO |
| TASK-14 | User Management Module | ✅ DONE |
| TASK-15 | TC Import Page | 🚫 CANCELLED (TCImportPage không còn cần — TC portal bị xóa) |
| TASK-16 | Admin Dashboard Page | ⏸ SKIPPED (dashboard bỏ qua) |
| TASK-17 | Merge TC Portal vào Admin Portal | ⏳ TODO |
| TASK-18 | Notification Bell | ⏳ TODO |
| TASK-19 | Admin CRUD Fixes (TrainingCenter + Seafarer + User delete) | ⏳ TODO |
| TASK-20 | SeafarerDetailPage — Certificate Management + Contract Section | ⏳ TODO |
| TASK-21 | Seafarer Portal — Cancel Enrollment + Certificate Write | ⏳ TODO |

---

## Pending tasks

### TASK-13: Deploy VPS
Xem [TASK-13-deploy-vps.md](./TASK-13-deploy-vps.md)

### TASK-17: Merge TC Portal vào Admin Portal ← tiếp theo
Gộp TC portal vào Admin portal với phân quyền menu. Xóa TC portal cũ.
Xem [TASK-17-merge-tc-portal.md](./TASK-17-merge-tc-portal.md)

### TASK-19: Admin CRUD Fixes
TrainingCenter create/edit/delete + delete buttons cho Seafarer và User.
Xem [TASK-19-admin-crud-fixes.md](./TASK-19-admin-crud-fixes.md)

### TASK-20: SeafarerDetailPage — Certificate + Contract
Thêm UI quản lý chứng chỉ và section hợp đồng vào SeafarerDetailPage.
Xem [TASK-20-seafarer-detail-cert-contract.md](./TASK-20-seafarer-detail-cert-contract.md)

### TASK-21: Seafarer Portal Write Operations
Hủy đăng ký khóa học + upload/xóa chứng chỉ từ seafarer portal.
Xem [TASK-21-seafarer-portal-write.md](./TASK-21-seafarer-portal-write.md)

---

## Features để sau (chưa có task file)

- **Job Board** — thuyền viên đăng CV, manning agent đăng tin tuyển dụng. Cần bảng `job_posting`, `job_application`.
- **Ticket / buổi học lẻ** — 50k/ticket. Cần bảng `class_session`, `session_ticket`.
- **Seaman Club membership** — 600k/tháng.
- **Gia hạn giấy tờ workflow** — tracking trạng thái giấy tờ.
- **Manning Agent portal** — UI/API riêng cho role `manning_agent`.
- **Import hợp đồng từ Excel** — TÊN TÀU, NGÀY NHẬP TÀU, NGÀY RỜI TÀU, Lương → tạo `employment_contract`.

---

## Quy ước
Mỗi file task gồm: Why, Schema, How (từng bước), Các kịch bản + trade-off, Điểm quan trọng, Acceptance Criteria.
Đọc `CLAUDE.md` trước khi bắt đầu bất kỳ task nào.
