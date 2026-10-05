# TASK-20: SeafarerDetailPage — Certificate Management + Contract Section

## Why
SeafarerDetailPage hiện chỉ read-only cho chứng chỉ và hoàn toàn thiếu section hợp đồng. `certificateApi` đã có nhưng không được dùng. Backend `employment_contract` API đã có từ TASK-00/TASK-03.

## Scope

### 1. Certificate Management (trong SeafarerDetailPage)
Hiện tại: không có UI quản lý chứng chỉ dù `certificateApi` đã tồn tại.

Cần thêm:
- **List chứng chỉ**: table hiển thị tên chứng chỉ, số hiệu, ngày cấp, ngày hết hạn, trạng thái
- **Thêm chứng chỉ**: nút "Thêm chứng chỉ" → modal với form (loại chứng chỉ từ lookup, số hiệu, ngày cấp, ngày hết hạn, file upload)
- **Xóa chứng chỉ**: nút xóa trên mỗi row → confirm → DELETE

API đã có: `GET /seafarers/:id/certificates`, `POST /seafarers/:id/certificates`, `DELETE /certificates/:id`

### 2. Contract Section (trong SeafarerDetailPage)
Hiện tại: section hợp đồng chưa làm.

Cần thêm:
- **List hợp đồng**: table hiển thị tên tàu, ngày lên tàu, ngày rời tàu, lương, trạng thái
- **Thêm hợp đồng**: nút "Thêm hợp đồng" → modal với form (tên tàu, ngày lên tàu, ngày rời tàu, lương, ghi chú)
- **Sửa hợp đồng**: inline edit hoặc modal
- **Xóa hợp đồng**: confirm → DELETE

API cần kiểm tra: `GET /seafarers/:id/contracts`, `POST /employment-contracts`, `PUT /employment-contracts/:id`, `DELETE /employment-contracts/:id`
Nếu thiếu endpoint nào thì thêm vào backend.

---

## Notes
- Certificate upload: dùng lại pattern từ TASK-04 (multipart/form-data)
- Ngày hết hạn chứng chỉ: highlight đỏ nếu đã hết hạn, vàng nếu còn < 30 ngày
- Hợp đồng: `status` tự tính từ ngày (active nếu trong khoảng, completed nếu đã qua)

---

## Acceptance Criteria
1. SeafarerDetailPage hiển thị danh sách chứng chỉ của seafarer
2. Thêm chứng chỉ mới (có file upload) → xuất hiện trong list
3. Xóa chứng chỉ → biến mất khỏi list
4. SeafarerDetailPage hiển thị danh sách hợp đồng
5. Thêm hợp đồng mới → xuất hiện trong list
6. Sửa/Xóa hợp đồng hoạt động
7. Chứng chỉ hết hạn/sắp hết hạn được highlight
