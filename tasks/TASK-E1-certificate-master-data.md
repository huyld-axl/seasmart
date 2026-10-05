# TASK-E1: Hoàn thiện Master Data Chứng chỉ

## Why
Master data `certificate_type` ban đầu thiếu nhiều loại chứng chỉ thực tế mà nghiệp vụ đang dùng.
Sau khi đối chiếu với tài liệu `BẢNG KÝ HIỆU TÊN CHỨNG CHỈ.CHI.xlsx` và `STR-05-06`, đã xác định
các thiếu sót và bổ sung qua migration 017.

## Trạng thái: DONE ✅

## Thay đổi đã thực hiện

### Migration 017 (`017_certificate_type_complete.sql`)
1. **Thêm 2 cột mới vào `certificate_type`:**
   - `category` ENUM('STCW','VN','DOCUMENT','MEDICAL','PANAMA','OTHER') — nhóm chứng chỉ
   - `abbreviation` VARCHAR(30) — ký hiệu viết tắt nghiệp vụ (PP, SMB, IMO, AFF...)

2. **Cập nhật category + abbreviation** cho tất cả bản ghi cũ

3. **Thêm 13 chứng chỉ còn thiếu:**

| Code | Tên | Ký hiệu | Nhóm | Hạn |
|------|-----|---------|------|-----|
| PASSPORT | Hộ chiếu phổ thông | PP | DOCUMENT | 10 năm |
| SEAMAN_BOOK | Sổ thuyền viên | SMB | DOCUMENT | 10 năm |
| ECDIS_TYPE | Hải đồ điện tử loại riêng biệt | ECDIS TYPE | STCW | 5 năm |
| GOC_ENDO | Giấy chứng nhận GOC (endorsement) | GOC ENDO | STCW | 5 năm |
| BTM | Quản lý buồng lái | BTM | STCW | 5 năm |
| MEDICAL_FITNESS | Giấy chứng nhận sức khỏe | MEDICAL CERT | MEDICAL | 2 năm |
| YELLOW_FEVER | Sổ tiêm chủng vàng da | YELLOW | MEDICAL | vĩnh viễn |
| CHOLERA | Sổ tiêm chủng dịch tả | CHOLERA | MEDICAL | 1 năm |
| PANAMA_MEDICAL | Sức khỏe Panama | PANAMA MEDICAL | PANAMA | 2 năm |
| PANAMA_COC | Bằng chuyên môn Panama | PANAMA COC | PANAMA | 5 năm |
| PANAMA_SDSD | Nhiệm vụ an ninh Panama | PANAMA SDSD | PANAMA | 5 năm |
| PANAMA_GOC | GOC Panama | PANAMA GOC | PANAMA | 5 năm |
| PANAMA_SSO | Sỹ quan an ninh Panama | PANAMA SSO | PANAMA | 5 năm |

### Files đã cập nhật
- `backend/migrations/017_certificate_type_complete.sql` — migration mới
- `migration.sql` — DDL gốc thêm 2 cột `category`, `abbreviation`
- `tasks/TASK-05-lookup-api.md` — lookup API trả về thêm `abbreviation`, `category`, `validity_years`, `is_stcw`

## Việc cần làm tiếp theo

### Backend
- [ ] Chạy migration 017 trên DB
- [ ] Cập nhật `lookup.routes.js`: SELECT thêm `abbreviation, category, validity_years, is_stcw` cho endpoint `/certificate-types`
- [ ] Dọn trùng lặp: xem xét merge `BRM` + `BTM` (hiện có cả 2), `MFA`/`MEFA`/`MC` (3 bản ghi cho cùng 1 chứng chỉ)

### Frontend
- [ ] Dropdown chứng chỉ: group theo `category` (STCW / VN / Giấy tờ / Sức khỏe / Panama)
- [ ] Hiển thị `abbreviation` kèm `name_vi` trong dropdown và bảng danh sách

## Nguồn tài liệu
- `D:/code/app hàng hải/Document/Bieu mau - Quan ly thuyen vien/BẢNG KÝ HIỆU TÊN CHỨNG CHỈ.CHI.xlsx`
- `D:/code/app hàng hải/Document/Bieu mau - Quan ly thuyen vien/STR-05-06 Danh muc bang cap chung chi cua thuyen vien.pdf`
