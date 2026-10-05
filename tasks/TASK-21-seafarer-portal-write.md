# TASK-21: Seafarer Portal — Cancel Enrollment + Certificate Write

## Why
Seafarer portal hiện read-only cho cả chứng chỉ lẫn đăng ký khóa học. Cần thêm khả năng hủy đăng ký và upload chứng chỉ từ phía seafarer.

## Scope

### 1. Hủy đăng ký khóa học (CoursesPage)

**Backend** — thêm endpoint:
```
DELETE /seafarer-portal/enrollments/:id
```
- Chỉ cho phép hủy nếu `status = 'pending'` (chưa được duyệt)
- Kiểm tra `enrollment.seafarer_id = request.user.linked_entity_id` → 403 nếu không khớp
- Trả về 409 nếu đã `approved`/`completed`

**Frontend** — `CoursesPage.jsx`:
- Thêm nút "Hủy đăng ký" trên mỗi enrollment có `status = 'pending'`
- Confirm dialog: "Bạn có chắc muốn hủy đăng ký khóa [tên]?"
- Sau hủy: refresh list

### 2. Upload chứng chỉ (CertificatesPage)

**Backend** — thêm endpoints vào seafarer portal:
```
POST   /seafarer-portal/certificates        — upload chứng chỉ mới
DELETE /seafarer-portal/certificates/:id   — xóa chứng chỉ của mình
```
- `POST`: multipart/form-data, tương tự TASK-04 nhưng tự lấy `seafarer_id` từ token
- `DELETE`: kiểm tra ownership trước khi xóa

**Frontend** — `CertificatesPage.jsx`:
- Thêm nút "Thêm chứng chỉ" → modal upload (loại chứng chỉ, số hiệu, ngày cấp, ngày hết hạn, file)
- Thêm nút xóa trên mỗi row (chỉ chứng chỉ do seafarer tự upload, không xóa được chứng chỉ do admin cấp)
- Phân biệt nguồn gốc: thêm field `created_by_role` hoặc `source` vào response

---

## Notes
- Hủy enrollment: chỉ `pending` mới hủy được — `approved`/`completed` không cho hủy, hiển thị tooltip giải thích
- Certificate ownership: cần thêm `uploaded_by` (user_id) vào bảng `seafarer_certificate` nếu chưa có, để phân biệt admin-uploaded vs self-uploaded
- Nếu thêm `uploaded_by` cần migration mới (014)

---

## Acceptance Criteria
1. CoursesPage: enrollment `pending` có nút "Hủy đăng ký"
2. Enrollment `approved`/`completed` không có nút hủy (hoặc disabled với tooltip)
3. Hủy thành công → enrollment biến mất khỏi list
4. `DELETE /seafarer-portal/enrollments/:id` của người khác → 403
5. CertificatesPage: thêm chứng chỉ mới → xuất hiện trong list
6. Xóa chứng chỉ tự upload được; chứng chỉ do admin cấp không có nút xóa
7. `DELETE /seafarer-portal/certificates/:id` của người khác → 403
