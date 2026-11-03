# MCAH — Đối chiếu yêu cầu ban đầu với hệ thống hiện tại

- **Ngày rà:** 2026-10-22, nhánh `feature/yeu-cau-thanh-toan` (commit `e416bac`).
- **Nguồn yêu cầu:** ba tài liệu MCAH ở thư mục gốc: *Đặc tả yêu cầu sản phẩm và triển khai MVP* (SRS, nguồn chuẩn), *Ý tưởng sản phẩm cho đội triển khai*, *Nền tảng sản phẩm dành cho Sales và Marketing*.
- **Cách rà:** đọc code backend (route, service, migration) và frontend (trang, route). Không chạy app.
- Ký hiệu: ✅ có, 🟡 có một phần, ❌ chưa có.

## 1. Tóm tắt

- **Phase 1 (đọc giấy tờ bằng AI, duyệt, đưa vào hồ sơ): gần đủ.** Thiếu tô vùng ô trên bản gốc, khoá sửa đồng thời, hàng đợi việc duyệt.
- **Phase 2 (hồ sơ dùng lại, mẫu chủ tàu, chính sách xuất, kiểm tra quy tắc): còn thiếu nhiều nhất.** Chưa có chính sách ẩn liên lạc khi xuất, chưa có bước duyệt phát hành, chưa tính tổng ngày đi tàu, chưa có rule engine và mức sẵn sàng, mới có một mẫu chủ tàu (SRS cần hai), tra cứu IMO từ internet còn chờ khoá.
- **Phần làm thêm ngoài yêu cầu khá lớn:** chuyến tàu, hợp đồng phải thu/phải chi, yêu cầu thanh toán, 11 mẫu giấy hành chính, quản lý chứng chỉ (vốn thuộc Phase 3 trở đi, hoặc ngoài phạm vi như payroll).
- **Khác kiến trúc so với SRS:** Fastify thay FastAPI, đĩa cục bộ thay S3, id số nguyên thay UUID, **một khách hàng (không có tenant)**. Cần chốt lại là chấp nhận hay phải làm.

## 2. Đối chiếu theo yêu cầu MVP (Phase 1 + 2)

### 2.1 Tiếp nhận tài liệu (FR ING)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| PDF, JPEG, PNG; tối đa 25 MB, 50 trang | ✅ | `MAX_FILE_BYTES`, `MAX_PDF_PAGES = 50`, dò MIME theo nội dung |
| PDF có mật khẩu, tệp hỏng báo lỗi cụ thể | ✅ | `document_pages.service.js` |
| Quét malware trước khi xử lý | ❌ | Chưa có |
| Lưu bản gốc, chống trùng bằng hash | ✅ | `sha256`, trùng thì trả bản đã có |
| Link tải ngắn hạn (signed URL) | 🟡 | Tải qua API có kiểm quyền; không có URL hết hạn |
| Hàng đợi tiếp nhận khi chưa biết tệp của thuyền viên nào | ❌ | Tệp luôn gắn vào một hồ sơ có sẵn |
| Nhập Excel theo mẫu, xem trước, báo lỗi từng dòng | 🟡 | Có nhập Excel và tải mẫu; chưa thấy bước xem trước, đối chiếu cột trước khi ghi |

### 2.2 Trích xuất bằng AI (FR EXT)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Tách loại giấy, đọc theo khuôn | ✅ | Hai tầng, đã đo 21/21 tách đúng, 98% ô đúng |
| Không bịa ô trống | ✅ | Đã đo: 0 ô bịa |
| Thử lại tối đa 3 lần, báo lỗi rõ, nút đọc lại | ✅ | Có `retry`, quét giấy kẹt mỗi 5 phút |
| Lưu model, phiên bản lời nhắc, token mỗi lần gọi | ✅ | Bảng `ai_call` |
| Quy ra tiền, hạn mức chi phí | ❌ | Chưa có bảng giá; không có hạn mức |
| Ngày mơ hồ, ngày thiếu ngày/tháng (độ chính xác ngày) | 🟡 | Ô ngày "chưa chắc" phải bấm xác nhận; chưa lưu độ chính xác ngày (partial date) |

### 2.3 Duyệt và hồ sơ (FR REV)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Bản gốc cạnh ô dữ liệu, phóng to | ✅ | `ReviewPage` |
| Bấm ô mở đúng trang | ✅ | |
| Tô vùng ô trên bản gốc (bbox) | ❌ | Đã đo thử, hoãn (xem kế hoạch AI mục B1) |
| Bắt buộc duyệt trường trọng yếu; không chấp nhận hàng loạt ô rủi ro | ✅ | `accept-clear` bỏ qua ô ngày chưa chắc và số GCNKNCM |
| Sửa có ghi người, trước/sau, lý do | ✅ | `seafarer_revision`, sửa/xoá chuyến đi tàu bắt buộc lý do |
| Hai người sửa cùng lúc: người sau nhận 409 | ❌ | Không có kiểm phiên bản; người sau ghi đè |
| Revision đánh số, ảnh chụp bất biến, so sánh hai revision | 🟡 | Có lịch sử thay đổi; không có số revision hay ảnh chụp hồ sơ |
| Hàng đợi việc duyệt có người phụ trách, lý do | 🟡 | Có tab "Cần duyệt" ở danh sách thuyền viên; không giao việc cho người |
| Phát hiện hồ sơ trùng người, gộp hồ sơ | ❌ | Chưa thấy |

### 2.4 Tàu và IMO (FR VES)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Kiểm số kiểm tra IMO | ✅ | `utils/imo.js` |
| Danh sách ứng viên, không tự chọn tàu đầu tiên | ✅ | `VesselMatchPanel` |
| Bằng chứng thủ công khi không có nguồn | ✅ | |
| Tra cứu tàu từ nguồn ngoài | 🟡 | Đã chốt phương án A (server trung gian legacy), **đang chờ URL và `ENC_KEY`** |
| Bản ghi xác minh: nguồn, thời điểm, hạn, trạng thái STALE / UNAVAILABLE | ❌ | Chỉ có `vessel_match_status` trên chuyến đi tàu |
| Thông tin tàu theo thời kỳ (loại, cờ, GT đổi theo năm) | ❌ | Chỉ lưu giá trị hiện tại |

### 2.5 Thời gian đi tàu (FR SEA)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Chuyến đang đi (chưa có ngày rời) | ✅ | |
| Phát hiện chồng ngày | 🟡 | Có ghi chú "Trùng với chuyến…" trên giao diện; chưa tạo việc duyệt |
| Tính số ngày (đóng hai đầu, +1), tổng theo hợp (union) để không đếm trùng | ❌ | Chưa có |
| Kinh nghiệm theo chức danh, loại tàu, thời kỳ của chủ tàu | ❌ | Chưa có |
| Không quy tháng tuỳ tiện | ❌ | CV TQ tính "số tháng" theo tháng lịch, tối thiểu 1 (`monthsOnBoard`), chưa có quy ước chủ tàu duyệt |

### 2.6 Mẫu chủ tàu và chính sách xuất (FR EXP)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Hai mẫu chủ tàu đã cấu hình | 🟡 | Mới có **một** mẫu chủ tàu: CV Trung Quốc. 11 mẫu còn lại là giấy hành chính nội bộ |
| Mapping cấu hình theo phiên bản, có hash, vòng đời DRAFT → ACTIVE → RETIRED | ❌ | Địa chỉ ô viết cứng trong code (`cv_tq_form.service.js`) |
| Không cắt bớt chuyến đi tàu; vượt sức chứa thì chặn | ❌ | CV TQ chỉ lấy **5 chuyến gần nhất**, chuyến cũ hơn bị bỏ âm thầm |
| Chính sách ẩn / hiện / thay thông tin liên lạc theo chủ tàu | ❌ | Chưa có. Đây là điểm bán hàng ("khách lo mất crew") |
| Chặn formula injection (`=`, `+`, `-`, `@`) | ❓ | Chưa kiểm |
| Xem trước đúng file sẽ phát hành, duyệt hash rồi mới phát hành; bản nháp ghi DRAFT | ❌ | Bộ giấy tạo xong là tải được ngay (cố ý: "in ra rồi ký tay") |
| Hồ sơ đổi sau khi xuất thì bản cũ "Cần làm lại" | ❌ | Có chú thích trong `seafarer.service.js` và nhãn `STALE` ở frontend, nhưng code **không** chuyển bộ giấy sang STALE |
| Log tải, tên file theo mã thuyền viên để giảm lộ tên | ❌ | Tên thư mục zip dùng tên người |
| PDF và Excel, sửa ô tay | ✅ | Vượt yêu cầu |

### 2.7 Rule engine và mức sẵn sàng (mục 11, 12)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Rule engine thuần, có phiên bản: required, date_order, overlap, verification_status, experience_days_at_least | ❌ | Chưa có |
| Kết quả PASS / FAIL / UNKNOWN, mức BLOCKER / WARNING | ❌ | |
| Tổng hợp BLOCKED / NEEDS_REVIEW / READY_IN_SCOPE, hiện vùng chưa đánh giá | ❌ | Chỉ có % đầy đủ hồ sơ (8 trường cố định) |
| Assignment draft (crew, owner, rank, vessel, ngày dự kiến) | ✅ | Thay bằng **Chuyến tàu + Vị trí dự kiến + Hợp đồng**, đủ hơn yêu cầu |
| Đánh giá theo assignment | ❌ | Chuyến/vị trí chưa chạy kiểm tra hồ sơ nào |
| Ngoại lệ (người đề nghị ≠ người duyệt, có hạn) | ❌ | |

### 2.8 Quyền, audit, vận hành (mục 3, 16)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Phân quyền theo vai trò | ✅ | Ma trận vai trò tự cấu hình, phạm vi "của mình / tất cả". Vượt yêu cầu về độ linh hoạt |
| Quyền riêng: xem liên lạc, xem y tế, tải bản gốc, phát hành export | ❌ | Quyền chia theo mục (thuyền viên, bản xuất…), chưa tách các quyền nhạy cảm này |
| Người tạo ≠ người duyệt | ❌ | Hợp đồng: cố ý cho tự duyệt tạm thời |
| Nhiều tenant, cách ly dữ liệu | ❌ | Một khách hàng. Cần chốt có làm không |
| Audit chung, chỉ ghi thêm | 🟡 | Có log riêng từng phần (lịch sử hồ sơ, duyệt hợp đồng, bill); không có audit đăng nhập, tải file |
| Sao lưu hằng ngày, diễn tập khôi phục | 🟡 | Có bản sao lưu SQL thủ công; chưa có job hay diễn tập |
| Giám sát hàng đợi, lỗi đọc, tồn duyệt, chi phí | ❌ | |
| Quy định lưu trữ, xoá dữ liệu có duyệt | ❌ | |
| Idempotency-Key, outbox | ❌ | Chống trùng chỉ bằng hash tệp |
| MCP | ❌ | SRS ghi là tuỳ chọn |

### 2.9 Đo lường (mục 17)

| Yêu cầu | TT | Hiện trạng |
|---|---|---|
| Công cụ đo độ đúng | ✅ | `scripts/eval_reader.js` |
| Gold set 200 trang, 50 hồ sơ | 🟡 | 21 tệp mẫu |
| Đo thời gian thao tác trước/sau (mục tiêu giảm 50%) | ❌ | Chưa có baseline |

## 3. Làm thêm ngoài yêu cầu

| Tính năng | Theo tài liệu thuộc |
|---|---|
| Chuyến tàu, vị trí dự kiến, budget; bắt đầu/kết thúc chuyến | Phase 5 (deployment) |
| Hợp đồng thuyền viên: phải thu, phải chi, duyệt, tự hết hạn | Phase 5; phần phải chi gần payroll (SRS ghi ngoài phạm vi) |
| Yêu cầu thanh toán (bill phải thu) theo ngày chốt sổ | Ngoài phạm vi SRS (tài chính) |
| 11 mẫu giấy hành chính: KQ thi tuyển, TB trúng tuyển, phiếu thu, QĐ điều động, BHXH, thư bảo lãnh, uỷ quyền, QĐ rời tàu, thanh lý | Ngoài SRS (SRS chỉ nói mẫu chủ tàu) |
| Sửa ô tay trên giấy xuất có định dạng chữ, xuất PDF qua LibreOffice | Vượt FR EXP |
| Đọc chứng chỉ bằng AI, tab chứng chỉ, trạng thái hạn, job đánh dấu hết hạn, thông báo sắp hết hạn | Phase 3 (làm sớm) |
| Danh mục: chứng chỉ, loại tàu, loại hợp đồng, cảng, quốc gia | Hạ tầng chung |
| CRUD đối tác (chủ tàu) và tàu đầy đủ, logo | Hạ tầng chung |
| Gia quyến, người bảo lãnh, tài khoản ngân hàng, ảnh chân dung | Ngoài SRS |
| Ma trận vai trò và quyền tự cấu hình | Vượt mục 3 |
| Chuông thông báo | Ngoài SRS |
| Trang `/design-system` | Nội bộ |

## 4. Dọn dẹp phát hiện khi rà

- `DashboardPage.jsx` còn ô "Trung tâm đào tạo", "Khóa học" (giá trị 0) dù đào tạo đã bỏ ở migration 011.
- Chú thích ở `seafarer.service.js:344` nói "bộ giấy đang chờ thì chuyển STALE" nhưng code không làm.
- Thư mục `tasks/` còn các TASK của cổng đào tạo, cổng thuyền viên, nhắn tin đã bỏ.

## 5. Đề xuất thứ tự lấp chỗ thiếu

**Nhóm A — cần cho cổng nghiệm thu MVP (AT 01–14):**

1. Chính sách xuất ẩn/thay thông tin liên lạc theo chủ tàu (AT 09).
2. Mẫu chủ tàu thứ hai; bỏ cắt 5 chuyến ở CV TQ, vượt sức chứa thì chặn (AT 08).
3. Tính ngày đi tàu: số ngày từng chuyến, tổng theo hợp, chuyến đang đi tạm tính, chồng ngày thành việc duyệt (AT 06).
4. Rule engine tối thiểu + mức sẵn sàng theo **vị trí dự kiến của chuyến** (dùng lại chuyến tàu làm assignment) (AT 07).
5. Duyệt phát hành bộ giấy: bản nháp ghi DRAFT, chặn phát hành khi hồ sơ đổi, log tải (AT 10).
6. Khoá sửa đồng thời (409) cho duyệt ô và sửa hồ sơ (AT 04).
7. Tra cứu IMO từ nguồn ngoài, kèm bản ghi xác minh có thời điểm và trạng thái UNAVAILABLE (AT 05). Chờ URL và `ENC_KEY`.

**Nhóm B — nên có:** tô vùng ô trên bản gốc (AT 02), tách quyền xem liên lạc / tải bản gốc, audit tải file và đăng nhập, xem trước khi nhập Excel, phát hiện hồ sơ trùng người, job sao lưu.

**Nhóm C — cần chốt có làm không:** nhiều tenant (AT 11), quét malware, ngoại lệ (AT 13), quy định lưu trữ/xoá, giám sát, MCP.
