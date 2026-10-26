# MCAH — Kế hoạch dựng Cơ hội và Chuyến (giai đoạn 1)

- **Ngày lập:** 2026-10-26
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự. Mọi quyết định cần cho việc dựng đã chép vào mục 1–5; các file trong code thì phải đọc khi bước yêu cầu.
- **Wireframe đã duyệt:** `docs/design/wireframes/co-hoi-chuyen-tau.html` (bản 12, cũng ở https://claude.ai/artifact/6pZ8H7AS8TKf6dmVLNqu9E). Cách mở ở mục 5.1.
- **Thay cho:** phần "Chuyến tàu" của `docs/mcah-ke-hoach-chuyen-tau-hop-dong.md` (chuyến gom nhiều vị trí, Bắt đầu / Kết thúc chuyến). Phần hợp đồng của file đó vẫn đúng cho hợp đồng đã có; **tạo hợp đồng mới bị khoá** tới giai đoạn 2 (mục 2.3, 3.3).

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` ở thư mục gốc repo trước khi viết dòng code nào. Mọi quy ước trong đó vẫn áp dụng (CommonJS không chấm phẩy ở backend, SQL tham số hoá, `pickAllowed`, lỗi dạng `{ statusCode, message }`, form theo mục 3.3, control theo mục 3.4, chữ trên giao diện bằng tiếng Việt).
2. Làm **đúng thứ tự các bước ở mục 8**. Mỗi bước có phần "Xong khi"; chỉ sang bước sau khi mọi ý trong đó đúng.
3. Sau mỗi bước: chạy lint và test của phần vừa sửa, rồi commit **một commit cho một bước**, message tiếng Việt, thể mệnh lệnh, ví dụ `Thêm bảng cơ hội và đổi chuyến thành từng người`. Không push.
4. Gặp dòng **⛔ DỪNG** thì dừng lại, báo người dùng đúng điều được yêu cầu và chờ trả lời. Không tự quyết thay.
5. Không làm những việc ở mục 2.2 "Không làm", kể cả khi thấy tiện tay.
6. Ghi tiến độ vào mục 11 "Nhật ký" cuối file sau mỗi bước (ngày, bước, commit, ghi chú). Mở lại phiên mới thì đọc mục 11 để biết đang ở đâu.
7. Khi một chi tiết trong file này mâu thuẫn với code đang có (tên cột, tên hàm đã đổi…), ưu tiên code đang có, sửa cho khớp, rồi ghi một dòng vào Nhật ký.
8. **Dựng trên màn và component đang có.** Wireframe chỉ chốt luồng, chữ và thứ tự khối. Hình dáng lấy theo màn hiện có trong app (bảng ở mục 5.2). Cần control dùng chung mới thì thêm vào `frontend/src/components/ds/` và minh hoạ ở `/design-system` **trước**, rồi mới dùng ở trang.

---

## 1. Nghiệp vụ cần hiểu

### 1.1 Khái niệm

- **Môi giới** là người dùng hệ thống (không có tài khoản thuyền viên hay trung tâm).
- **Cơ hội (opportunity):** **một vị trí** chủ tàu cần người. Chủ tàu cần 6 người cho một tàu thì có 6 cơ hội. Có chủ tàu, tàu (chưa rõ cũng được), chức danh, budget, bốn mốc dự kiến (ngày xuống, nơi xuống, ngày rời, nơi rời), hạn chốt, người phụ trách, ghi chú. **Không có ô số tháng.**
- **Hồ sơ yêu cầu (opportunity_requirement):** những thứ ứng viên phải có, gắn với từng cơ hội: giấy tờ, chứng chỉ, kinh nghiệm, và mẫu giấy xuất kèm. Mỗi mục có mức **Bắt buộc** hoặc **Nên có**, và mốc **còn hạn tới**.
- **Ứng viên (opportunity_candidate):** thuyền viên được chọn vào danh sách của một cơ hội. Mỗi người được đối chiếu với hồ sơ yêu cầu.
- **Bản xuất:** bộ giấy (`export_pack`) của một ứng viên, tạo bằng màn Bộ giấy **đang có**.
- **Chuyến (bảng mới `seafarer_voyage`):** **một thuyền viên đi một tàu.** Không có bản ghi gom nhiều người. Chuyến sinh ra theo hai đường: **chốt** một ứng viên trên cơ hội, hoặc **Tạo chuyến** trực tiếp (không qua tuyển).
- **Đội ngũ trên tàu:** không lưu. Là các chuyến của một tàu có khoảng lên–rời giao với khoảng thời gian đang xem (thẻ Đội ngũ trên trang tàu).

### 1.2 Trạng thái cơ hội

Lưu (`opportunity.status`): `OPEN`, `WON`, `LOST`, `CANCELLED`. Hiển thị (`display_status`) tính ra, bằng một hàm thuần:

| display_status | Nhãn | Khi nào |
|---|---|---|
| `NEW` | Mới | `OPEN`, chưa có ứng viên (không tính `REMOVED`) |
| `PICKING` | Đang chọn ứng viên | `OPEN`, có ứng viên, chưa gửi ai |
| `WAITING` | Chờ kết quả | `OPEN`, đã gửi ít nhất một người, chưa ai mang nhãn |
| `OWNER_SELECTED` | Chủ tàu đã chọn | `OPEN`, có một ứng viên mang nhãn "Chủ tàu đã chọn" |
| `WON` | Đã chốt | `WON` |
| `LOST` | Không thành | `LOST` (đóng tay, bắt buộc lý do) |
| `CANCELLED` | Huỷ | `CANCELLED` |

- Kết quả chủ tàu nhận **ngoài hệ thống**. Hệ thống không có ô "chủ tàu chọn / loại".
- **Nhãn "Chủ tàu đã chọn":** người làm gắn cho **một** ứng viên để giữ chỗ. Gắn cho người khác thì nhãn chuyển sang. Gắn nhãn không tạo chuyến, không đổi trạng thái thuyền viên.
- **Không chốt trước ngày lên tàu.** Chốt = ghi lên tàu (mục 1.4).
- Cảnh báo hạn chốt: còn 0–7 ngày → nhãn vàng "Còn N ngày"; đã quá → nhãn đỏ "Quá N ngày". Chỉ cảnh báo khi `OPEN`.

### 1.3 Trạng thái ứng viên

`opportunity_candidate.status`: `PICKED` (trong danh sách), `PLACED` (được chốt), `NOT_SELECTED` (cơ hội đã chốt người khác), `REMOVED` (bỏ khỏi danh sách). Thêm hai thông tin không phải trạng thái:
- `owner_selected_at` / `owner_selected_by`: nhãn Chủ tàu đã chọn (tối đa một ứng viên mỗi cơ hội).
- `last_sent_at`: lần ghi nhận gửi chủ tàu gần nhất.

### 1.4 Chuyến

Lưu (`voyage.status`): `ONBOARD` (Đang trên tàu), `LEFT` (Đã rời tàu). **Không có trạng thái chờ lên.**

- **Chốt người** (trên cơ hội): chọn một ứng viên, nhập **ngày xuống tàu** và **nơi xuống tàu** (điền sẵn theo cơ hội). Ngày xuống **không được sau hôm nay**. Hệ thống tự làm, không hỏi: tạo chuyến `ONBOARD`; ngày rời dự kiến, nơi rời dự kiến và budget lấy từ cơ hội; cơ hội → `WON`; ứng viên được chốt → `PLACED`, ứng viên còn lại → `NOT_SELECTED`; thuyền viên → `ON_VESSEL`.
- **Tạo chuyến** (không qua cơ hội): cho chuyển tàu, chủ tàu tự tuyển, nhập chuyến cũ. Bắt buộc **lý do tạo**: `TRANSFER` (Chuyển tàu), `OWNER_HIRED` (Chủ tàu tự tuyển), `LEGACY` (Nhập chuyến cũ), `OTHER` (Khác, bắt ghi chú). **Budget không bắt buộc.** Ngày lên không được sau hôm nay. Bật "Chuyến đã kết thúc" (chỉ để nhập chuyến cũ) thì nhập luôn ngày rời, nơi rời, ghi chú rời và chuyến lưu thẳng `LEFT`.
- **Mỗi thuyền viên tối đa một chuyến `ONBOARD`.** Tạo chuyến cho người đang `ONBOARD`: lý do `TRANSFER` thì trong cùng transaction ghi rời chuyến cũ (ngày rời = ngày lên chuyến mới, nơi rời = nơi lên, ghi chú "Chuyển sang {tên tàu}") và đặt `transferred_from_id`; lý do khác thì 409 "{tên} đang trên {tàu}, ghi rời tàu chuyến đó trước". Chuyến `LEFT` nhập tay không được trùng thời gian với chuyến khác của cùng người (409).
- **Ghi rời tàu:** ngày rời*, nơi rời*, ghi chú. **Không có danh mục lý do, không cần duyệt.** Chuyến → `LEFT`; thuyền viên → `AVAILABLE` (nếu không còn chuyến `ONBOARD` khác). Ngày rời ≥ ngày lên (400 nếu sai). Ngày rời dự kiến giữ nguyên để hiện sớm / muộn. Sau khi lưu, toast có hai lối tắt: "Tạo cơ hội tìm người thay" (form tạo cơ hội điền sẵn chủ tàu, tàu, chức danh) và "Chuyển sang tàu khác" (form Tạo chuyến điền sẵn người, chức danh, budget, ngày lên = ngày rời, lý do `TRANSFER`).
- **Đổi ngày rời dự kiến:** ngày mới*, ghi chú. Lần đầu đổi thì chép ngày cũ vào `original_leave_date`; chênh lệch luôn so với ngày gốc.
- **Sửa ngày đã ghi:** sửa ngày, nơi lên và (nếu `LEFT`) ngày, nơi rời khi nhập sai.
- **Huỷ chốt** (chuyến từ cơ hội) / **Xoá chuyến** (chuyến tạo tay): ghi chú tuỳ chọn. Xoá mềm chuyến; thuyền viên về `AVAILABLE` nếu chuyến đang `ONBOARD`; chuyến từ cơ hội thì cơ hội về `OPEN`, ứng viên `PLACED` về `PICKED`, các ứng viên `NOT_SELECTED` về `PICKED`. **Không cho** với chuyến chuyển từ dữ liệu cũ có hợp đồng (`legacy_contract_id` khác null; 409 "Chuyến này gắn với hợp đồng {số}, không huỷ được").
- Hiện "sớm / muộn": lên tàu so với ngày xuống dự kiến của cơ hội (chuyến tạo tay không có); rời tàu so với `original_leave_date` hoặc `planned_leave_date`. Dùng nhãn kiểu "muộn 13 ngày", "sớm 4,7 tháng" (dưới 60 ngày tính ngày, từ 60 ngày tính tháng theo `monthsBetween`).
- Cảnh báo trên chuyến `ONBOARD`: ngày rời dự kiến còn 0–30 ngày → vàng "Còn N ngày"; đã qua mà chưa ghi rời → đỏ "Quá N ngày chưa ghi rời".

### 1.5 Trạng thái thuyền viên

`seafarer.status` vẫn là `ON_VESSEL` (**Đang trên tàu**) / `AVAILABLE` (**Ở bờ**) / `INACTIVE` (Tạm ngưng). Từ nay **chỉ chuyến** đổi `ON_VESSEL` / `AVAILABLE` (chốt, tạo chuyến, ghi rời, huỷ chốt, xoá chuyến). Hợp đồng **không** đổi trạng thái thuyền viên nữa (bỏ `move_onboard`, mục 3.3). Người `INACTIVE` không chốt, không tạo chuyến được (409 "Thuyền viên đang tạm ngưng").

### 1.6 Đối chiếu hồ sơ yêu cầu

Một hàm thuần `requirementFit(seafarer, requirements, dates)` trả về từng mục: `ok` / `missing` / `expires_early` (hết hạn trước mốc cần), và tổng `{ required: { ok, total }, preferred: { ok, total } }`.

| Loại yêu cầu | Đọc từ đâu |
|---|---|
| `CERTIFICATE` có `certificate_type.code` là `PASSPORT`, `SEAMAN_BOOK`, `MEDICAL_FITNESS` | Cột trên `seafarer`: `passport_expiry`, `seaman_book_expiry`, `medical_cert_expiry` (và số giấy khác rỗng). Kiểm lại tên cột trong `001_schema.sql`, `003_seafarer_form_fields.sql` |
| `CERTIFICATE` loại khác | `seafarer_certificate` cùng `certificate_type_id`, `status <> 'REVOKED'`, `deleted_at IS NULL`; `no_expiry = 1` coi như còn hạn |
| `EXPERIENCE` theo chức danh | Tổng số tháng ở `rank_id` đó, cộng từ `sea_service` (đã khớp danh mục) và `seafarer_voyage` (chuyến `LEFT` hoặc đang `ONBOARD` tới hôm nay), so với `min_months` |
| `EXPERIENCE` theo loại tàu | Số chuyến trên tàu có `vessel_type_id` đó, từ cùng hai nguồn, so với `min_trips` |
| `TEMPLATE` | Không đối chiếu; chỉ dùng để chọn sẵn mẫu giấy khi tạo bản xuất |

Mốc "còn hạn tới" (`valid_until`): `JOIN` = ngày xuống dự kiến · `LEAVE` = ngày rời dự kiến · `LEAVE_PLUS` = ngày rời + `plus_months` tháng · `ANY` = có là được.

Hồ sơ yêu cầu khi tạo cơ hội điền sẵn theo thứ tự: (1) `vessel_certificate_requirement` của tàu + chức danh (bảng có sẵn, đang chưa dùng; `is_mandatory` → mức); (2) không có thì `rank_requirement_preset` của chức danh; (3) không có nữa thì để trống. Bảng hồ sơ yêu cầu có nút "Lưu thành mẫu cho {chức danh}" ghi đè `rank_requirement_preset` của chức danh đó.

### 1.7 Đề xuất ứng viên

`GET /opportunities/:id/suggestions` trả người hợp, xếp theo: đủ hết mục bắt buộc trước → nhiều mục nên có hơn → ngày rảnh gần ngày xuống dự kiến hơn. Bộ lọc (query, mặc định bật ba cái đầu khi bấm "Đề xuất nhanh"; "+ Thêm ứng viên" mở cùng bảng nhưng tắt hết):
- `required_ok=1`: đủ mục bắt buộc.
- `rank_id`: chức danh hiện tại (`seafarer.current_rank_id`).
- `free_before=YYYY-MM-DD`: rảnh trước ngày đó = không có chuyến `ONBOARD`, **hoặc** chuyến `ONBOARD` có ngày rời dự kiến ≤ ngày đó. Loại `INACTIVE`.
- `worked_with_owner=1`, `vessel_type_id`, `nationality_id`, `age_min`, `age_max`, `search` (tên, mã thuyền viên, số hộ chiếu).

Mỗi dòng trả: thuyền viên (tên, mã, chức danh, tuổi, trạng thái, ngày rảnh), `fit` (mục 1.6), `reasons[]` (chuỗi ngắn: "2 chuyến với {chủ tàu}", "Tàu {loại} 4 chuyến", "Thiếu {giấy}", "{giấy} hết hạn {ngày}"), `held_by` (mã cơ hội khác đang giữ chỗ người này bằng nhãn Chủ tàu đã chọn, nếu trùng thời gian), `in_list` (đã là ứng viên của cơ hội này). Tối đa 50 dòng, có phân trang.

### 1.8 Gửi chủ tàu

- **Không gửi email từ server.** Nút "Gửi cho chủ tàu" (trên chi tiết cơ hội khi chọn nhiều ứng viên, và trên màn bộ giấy đã tạo khi bộ thuộc một cơ hội):
  1. Tải về máy bản xuất của từng người đã chọn (gọi tải bộ giấy đang có, `GET /exports/:id/download`).
  2. Mở app mail mặc định bằng link `mailto:` có `to` = email liên hệ chính của chủ tàu (`ship_owner_contact.is_primary = 1`, không có thì liên hệ đầu tiên có email), `cc` = email người đang đăng nhập, `subject`, `body` soạn sẵn.
  3. Hiện `modal.confirm` "Đã gửi email cho {chủ tàu}?" kèm danh sách tên file vừa tải; nút "Mở lại app mail", "Chưa gửi", "Đã gửi".
  4. "Đã gửi" → `POST /opportunities/:id/sends` ghi nhận; cột "Gửi chủ tàu" của ứng viên đổi ngày. "Chưa gửi" không ghi gì.
- Chủ tàu chưa có email liên hệ: nút báo "Thêm email liên hệ cho {chủ tàu}" kèm link sang trang đối tác, không mở mail.
- `mailto:` không mang file: người làm tự kéo file vừa tải vào thư.
- Mẫu tiêu đề: `MCAH · {chức danh tiếng Anh} candidates for {tàu} · join {ngày xuống} {nơi xuống}`. Nội dung tiếng Anh: lời chào, một dòng mỗi người (`{n}. {HỌ TÊN IN HOA}`), ký tên người gửi. URL mã hoá bằng `encodeURIComponent`. Toàn bộ URL dài quá 1.800 ký tự thì bỏ bớt dòng và thêm "and {n} more, see attachments".
- Tên chức danh tiếng Anh lấy từ `rank.name_en` nếu có (kiểm cột trong `002_reference_data.sql`), không có thì `name_vi`.

### 1.9 Mã số

- Cơ hội: `CH{2 số cuối năm tạo}{3 chữ số}`, ví dụ `CH26044` (quá 999 thì đếm tiếp `CH261000`). `nextCode(conn, 'OPPORTUNITY', năm, 'CH', 3, true)`.
- Chuyến (mới): `CT-{năm tạo}-{4 chữ số}`, ví dụ `CT-2026-0104`. `nextCode(conn, 'VOYAGE1', năm, 'CT', 4)` (kind mới để không đụng bộ đếm 3 chữ số cũ). Mã chuyến cũ (3 chữ số) chỉ còn trong bảng lưu trữ (mục 3.1).

---

## 2. Phạm vi

### 2.1 Làm trong giai đoạn 1

Danh sách, tạo, sửa, chi tiết cơ hội; hồ sơ yêu cầu và mẫu theo chức danh; ứng viên, đề xuất nhanh, tìm kiếm; nhãn Chủ tàu đã chọn; bản xuất từ cơ hội trên màn bộ giấy đang có; gửi chủ tàu qua app mail mặc định và ghi nhận; chốt người; đóng / huỷ / nhân bản cơ hội. Danh sách chuyến (mỗi dòng một người), tạo chuyến tay (cả chuyển tàu và nhập chuyến cũ), chi tiết chuyến, ghi rời tàu, đổi ngày rời dự kiến, sửa ngày đã ghi, huỷ chốt / xoá chuyến. Thẻ Đội ngũ trên trang tàu. Chuyến trên hồ sơ thuyền viên. Chuyển dữ liệu chuyến cũ sang cơ hội và chuyến mới. Khoá tạo hợp đồng mới; hợp đồng và yêu cầu thanh toán đang có vẫn xem, sửa nháp, xin duyệt, duyệt được như hiện nay (mục 3.3).

### 2.2 Không làm (ghi lại để khỏi làm nhầm)

- **Nối hợp đồng vào chuyến mới:** không thêm cột vào `seafarer_contract`, không sửa câu JOIN của hợp đồng và yêu cầu thanh toán; chúng tiếp tục đọc bảng `voyage`, `voyage_position` cũ.
- **Mọi tính năng hợp đồng mới** (giai đoạn 2): tự tạo hợp đồng Nháp khi chốt hoặc tạo chuyến, phụ lục (gia hạn, điều chỉnh tiền, đổi chức danh, dời ngày), kết thúc sớm hợp đồng khi rời sớm, thay hợp đồng, trạng thái Huỷ / Đã thay, đổi job hết hạn hợp đồng, các màn Đ, Đ1–Đ3 của wireframe (có nhãn "Giai đoạn 2"), thẻ hợp đồng đầy đủ trên chi tiết chuyến (giai đoạn 1 chỉ hiện link hợp đồng cũ của chuyến đã chuyển), cột hợp đồng / chênh lệch trên danh sách chuyến.
- **Thanh toán:** không sửa luồng yêu cầu thanh toán.
- Chốt cả nhóm; gửi email từ server, SMTP, hộp thư gửi đi; danh mục lý do rời tàu; ghi kết quả chủ tàu chọn / loại; thẻ Đội ngũ trên trang chủ tàu; lối tắt Chuyển tàu tự tạo cơ hội.
- Gộp file giấy tờ vào một PDF. Giai đoạn 1 cho file giấy tờ vào **ZIP** tải về của bộ giấy (cách tải hiện nay là ZIP, `buildZip`).
- Bảng `sea_service` và màn khai lịch sử đi tàu: giữ nguyên; chuyến chỉ được **hiện thêm** trên timeline hồ sơ.

### 2.3 Đã chốt: khoá tạo hợp đồng mới, không nối lại

Người dùng chọn ngày 26/10/2026: giai đoạn 1 **không** nối hợp đồng vào chuyến mới; **khoá tạo hợp đồng mới** tới giai đoạn 2.

Hệ quả cho cách dựng:
- Bảng `voyage` và `voyage_position` cũ **giữ nguyên tên, cột và dữ liệu**, thôi ghi mới. Hợp đồng, yêu cầu thanh toán và job hết hạn hợp đồng vẫn đọc chúng như hiện nay, không sửa SQL.
- Chuyến mới nằm ở bảng mới **`seafarer_voyage`**. API vẫn ở `/voyages`, giao diện vẫn gọi là "Chuyến tàu".
- Chuyến chuyển từ dữ liệu cũ giữ `legacy_contract_id` để màn hợp đồng hiện link sang chuyến mới, và để giai đoạn 2 nối lại.
- Chuyến tạo mới ở giai đoạn 1 không có hợp đồng. Yêu cầu thanh toán chỉ sinh từ hợp đồng đã có.

## 3. Dữ liệu

### 3.1 Migration `backend/migrations/postgres/023_opportunity_voyage.sql`

Chạy bằng `cd backend && npm run migrate`. Viết theo kiểu `005_voyage_contract.sql` (tên bảng, cột trong ngoặc kép, `touch_updated_at()`). Một file, một transaction. Thứ tự:

1. **Không đụng bảng cũ:** `voyage`, `voyage_position`, `seafarer_contract`, `contract_*` giữ nguyên. Thêm `COMMENT ON TABLE "voyage" IS 'Chuyến cũ (gom vị trí). Chỉ còn hợp đồng đọc; chuyến mới ở seafarer_voyage.'` (tương tự cho `voyage_position`).
2. **Bảng mới:**

```sql
CREATE TABLE "opportunity" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "code" varchar(20) NOT NULL UNIQUE,
  "ship_owner_id" INTEGER NOT NULL REFERENCES "ship_owner" ("id"),
  "vessel_id" INTEGER REFERENCES "vessel" ("id"),
  "rank_id" INTEGER NOT NULL REFERENCES "rank" ("id"),
  "budget_monthly_usd" decimal(12,2) NOT NULL CHECK ("budget_monthly_usd" >= 0),
  "budget_total_usd" decimal(12,2) NOT NULL CHECK ("budget_total_usd" >= 0),
  "planned_join_date" DATE NOT NULL,
  "planned_join_port_id" INTEGER REFERENCES "port" ("id"),
  "planned_leave_date" DATE NOT NULL,
  "planned_leave_port_id" INTEGER REFERENCES "port" ("id"),
  "deadline" DATE NOT NULL,
  "owner_user_id" INTEGER NOT NULL REFERENCES "user" ("id"),
  "status" varchar(20) NOT NULL DEFAULT 'OPEN',
  "close_reason" TEXT,
  "notes" TEXT,
  "legacy_voyage_id" INTEGER REFERENCES "voyage" ("id"),
  "created_by" INTEGER, "updated_by" INTEGER,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "deleted_at" TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT "opportunity_status_check" CHECK ("status" IN ('OPEN', 'WON', 'LOST', 'CANCELLED')),
  CONSTRAINT "opportunity_dates_check" CHECK ("planned_leave_date" >= "planned_join_date"),
  CONSTRAINT "opportunity_lost_check" CHECK ("status" <> 'LOST' OR "close_reason" IS NOT NULL)
);

CREATE TABLE "opportunity_requirement" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "opportunity_id" INTEGER NOT NULL REFERENCES "opportunity" ("id") ON DELETE CASCADE,
  "kind" varchar(12) NOT NULL,            -- CERTIFICATE / EXPERIENCE / TEMPLATE
  "certificate_type_id" INTEGER REFERENCES "certificate_type" ("id"),
  "rank_id" INTEGER REFERENCES "rank" ("id"),          -- EXPERIENCE theo chức danh
  "vessel_type_id" INTEGER REFERENCES "vessel_type" ("id"), -- EXPERIENCE theo loại tàu
  "min_months" SMALLINT, "min_trips" SMALLINT,
  "template_key" varchar(20),            -- TEMPLATE, khoá trong PACK_TEMPLATES
  "level" varchar(10) NOT NULL DEFAULT 'REQUIRED',  -- REQUIRED / PREFERRED
  "valid_until" varchar(12) NOT NULL DEFAULT 'LEAVE', -- JOIN / LEAVE / LEAVE_PLUS / ANY
  "plus_months" SMALLINT,
  "sort_order" SMALLINT NOT NULL DEFAULT 0
  -- CHECK: kind đúng tập; đúng một nhóm cột theo kind; level, valid_until đúng tập; plus_months có khi LEAVE_PLUS
);

CREATE TABLE "rank_requirement_preset" ( ...cùng các cột yêu cầu như trên, thay "opportunity_id" bằng "rank_id" NOT NULL... );

CREATE TABLE "opportunity_candidate" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "opportunity_id" INTEGER NOT NULL REFERENCES "opportunity" ("id"),
  "seafarer_id" INTEGER NOT NULL REFERENCES "seafarer" ("id"),
  "status" varchar(15) NOT NULL DEFAULT 'PICKED',   -- PICKED / PLACED / NOT_SELECTED / REMOVED
  "source" varchar(10) NOT NULL DEFAULT 'SEARCH',   -- SUGGEST / SEARCH
  "owner_selected_at" TIMESTAMP WITHOUT TIME ZONE, "owner_selected_by" INTEGER REFERENCES "user" ("id"),
  "export_pack_id" INTEGER REFERENCES "export_pack" ("id"),
  "last_sent_at" TIMESTAMP WITHOUT TIME ZONE,
  "added_by" INTEGER, "created_at" ..., "updated_at" ...,
  UNIQUE ("opportunity_id", "seafarer_id")
);
-- Một người mang nhãn mỗi cơ hội; một người được chốt mỗi cơ hội.
CREATE UNIQUE INDEX "opportunity_candidate_selected_uniq" ON "opportunity_candidate" ("opportunity_id") WHERE "owner_selected_at" IS NOT NULL;
CREATE UNIQUE INDEX "opportunity_candidate_placed_uniq" ON "opportunity_candidate" ("opportunity_id") WHERE "status" = 'PLACED';

CREATE TABLE "opportunity_send" (
  "id" ... PRIMARY KEY,
  "opportunity_id" INTEGER NOT NULL REFERENCES "opportunity" ("id"),
  "ship_owner_contact_id" INTEGER REFERENCES "ship_owner_contact" ("id") ON DELETE SET NULL,
  "to_email" varchar(150) NOT NULL,
  "subject" varchar(300) NOT NULL,
  "candidate_ids" INTEGER[] NOT NULL,
  "export_pack_ids" INTEGER[] NOT NULL,
  "sent_by" INTEGER NOT NULL REFERENCES "user" ("id"),
  "sent_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "seafarer_voyage" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "code" varchar(20) NOT NULL UNIQUE,
  "seafarer_id" INTEGER NOT NULL REFERENCES "seafarer" ("id"),
  "rank_id" INTEGER NOT NULL REFERENCES "rank" ("id"),
  "vessel_id" INTEGER NOT NULL REFERENCES "vessel" ("id"),
  "ship_owner_id" INTEGER NOT NULL REFERENCES "ship_owner" ("id"),
  "opportunity_id" INTEGER REFERENCES "opportunity" ("id"),
  "source" varchar(12) NOT NULL,                    -- OPPORTUNITY / MANUAL
  "manual_reason" varchar(12),                      -- TRANSFER / OWNER_HIRED / LEGACY / OTHER
  "transferred_from_id" INTEGER REFERENCES "seafarer_voyage" ("id"),
  "budget_monthly_usd" decimal(12,2) CHECK ("budget_monthly_usd" >= 0),
  "join_date" DATE NOT NULL,
  "join_port_id" INTEGER NOT NULL REFERENCES "port" ("id"),
  "planned_leave_date" DATE NOT NULL,
  "planned_leave_port_id" INTEGER REFERENCES "port" ("id"),
  "original_leave_date" DATE,
  "leave_date" DATE,
  "leave_port_id" INTEGER REFERENCES "port" ("id"),
  "leave_note" TEXT,
  "status" varchar(10) NOT NULL DEFAULT 'ONBOARD',
  "notes" TEXT,
  "legacy_voyage_id" INTEGER REFERENCES "voyage" ("id"),
  "legacy_contract_id" INTEGER UNIQUE REFERENCES "seafarer_contract" ("id"),
  "created_by" INTEGER, "updated_by" INTEGER, "created_at" ..., "updated_at" ..., "deleted_at" ...,
  CONSTRAINT "seafarer_voyage_status_check" CHECK ("status" IN ('ONBOARD', 'LEFT')),
  CONSTRAINT "seafarer_voyage_source_check" CHECK (("source" = 'OPPORTUNITY') = ("opportunity_id" IS NOT NULL)),
  CONSTRAINT "seafarer_voyage_manual_check" CHECK (("source" = 'MANUAL') = ("manual_reason" IS NOT NULL)),
  CONSTRAINT "seafarer_voyage_left_check" CHECK (("status" = 'LEFT') = ("leave_date" IS NOT NULL AND "leave_port_id" IS NOT NULL)),
  CONSTRAINT "seafarer_voyage_dates_check" CHECK ("planned_leave_date" >= "join_date" AND ("leave_date" IS NULL OR "leave_date" >= "join_date"))
);
CREATE UNIQUE INDEX "seafarer_voyage_opportunity_uniq" ON "seafarer_voyage" ("opportunity_id") WHERE "opportunity_id" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "seafarer_voyage_onboard_uniq" ON "seafarer_voyage" ("seafarer_id") WHERE "status" = 'ONBOARD' AND "deleted_at" IS NULL;
CREATE INDEX "seafarer_voyage_vessel_time_idx" ON "seafarer_voyage" ("vessel_id", "join_date", "leave_date") WHERE "deleted_at" IS NULL;
CREATE INDEX "seafarer_voyage_seafarer_idx" ON "seafarer_voyage" ("seafarer_id") WHERE "deleted_at" IS NULL;
```

   Cột `...` viết đủ như `005` (timestamp mặc định, trigger `touch_updated_at`). Các CHECK của `opportunity_requirement` / `rank_requirement_preset` viết đủ thành từng `CONSTRAINT` có tên.
3. `seafarer_voyage_log` (mục 4.7), `export_pack.opportunity_id` (mục 4.9), quyền (mục 4.1).
4. **Chuyển dữ liệu cũ** (mục 3.4). Cuối file đặt lại `seafarer.status`: `ON_VESSEL` cho người có chuyến `ONBOARD`, `AVAILABLE` cho người đang `ON_VESSEL` mà không có (không đụng `INACTIVE`); trước đó `RAISE NOTICE` số người bị đổi để Bước 1 báo lại.

### 3.2 Hằng số

`backend/src/constants/opportunity_voyage.js` (và bản frontend `frontend/src/constants/opportunityVoyage.js` cùng giá trị):

```js
const OPPORTUNITY_STATUSES = ['OPEN', 'WON', 'LOST', 'CANCELLED']
const OPPORTUNITY_DISPLAY_STATUSES = ['NEW', 'PICKING', 'WAITING', 'OWNER_SELECTED', 'WON', 'LOST', 'CANCELLED']
const CANDIDATE_STATUSES = ['PICKED', 'PLACED', 'NOT_SELECTED', 'REMOVED']
const REQUIREMENT_KINDS = ['CERTIFICATE', 'EXPERIENCE', 'TEMPLATE']
const REQUIREMENT_LEVELS = ['REQUIRED', 'PREFERRED']
const VALID_UNTIL = ['JOIN', 'LEAVE', 'LEAVE_PLUS', 'ANY']
const VOYAGE_STATUSES = ['ONBOARD', 'LEFT']
const VOYAGE_SOURCES = ['OPPORTUNITY', 'MANUAL']
const MANUAL_REASONS = ['TRANSFER', 'OWNER_HIRED', 'LEGACY', 'OTHER']
const DEADLINE_WARN_DAYS = 7
const LEAVE_WARN_DAYS = 30
const MAILTO_MAX = 1800
```

Nhãn tiếng Việt của các mã ở frontend (`statusMap.js` cho trạng thái, `opportunityVoyage.js` cho lý do tạo và mốc còn hạn). `backend/src/constants/voyage_contract.js`: giữ nguyên (hợp đồng còn dùng); `VOYAGE_DISPLAY_STATUSES` cũ chỉ bỏ khi không còn chỗ nào import.

### 3.3 Hợp đồng ở giai đoạn 1 và các chỗ đang đọc chuyến cũ

**Khoá tạo hợp đồng mới:**
- `seafarer_contract.routes.js` `POST /contracts`: trả 409 "Tạm khoá tạo hợp đồng mới. Hợp đồng sẽ gắn với chuyến ở giai đoạn 2." trước khi gọi service. Giữ nguyên code `create` trong service để giai đoạn 2 sửa tiếp. Sửa test của route cho đúng.
- Frontend: ẩn mọi nút / link "Tạo hợp đồng". `/contracts/new` hiện `EmptyState` "Tạm khoá tạo hợp đồng mới" với mô tả "Hợp đồng sẽ gắn với chuyến ở giai đoạn sau." và nút "Về danh sách hợp đồng". Sửa các `EmptyState` đang ghi "Mở một chuyến tàu, bấm Tạo hợp đồng ở dòng vị trí còn trống." (`ContractListPage`, `ContractFormPage`) thành "Chưa có hợp đồng nào." không kèm hướng dẫn tạo.
- Sửa nháp, xin duyệt, thôi xin duyệt, từ chối, duyệt, xoá nháp, job hết hạn: **giữ nguyên**, trừ: bỏ nhánh `move_onboard` khi duyệt (trạng thái thuyền viên giờ chỉ do chuyến đổi, mục 1.5), bỏ trường `move_onboard` khỏi schema, bỏ câu hỏi đó trong `ApproveModal`.

**Liên kết từ hợp đồng, yêu cầu thanh toán sang chuyến:**
- Trang chuyến cũ (`/voyages/:id` theo id bảng `voyage`) không còn. Mọi chỗ đang link `/voyages/{id chuyến cũ}` phải đổi, nếu không sẽ mở nhầm một chuyến mới trùng id: `ContractDetailPage` (~100, ~162, ~194), `ContractFormPage` (~74, ~77, ~192, ~203, ~272), `BillDetailPage` (~165), `BillFormPage` (~65), `SeafarerDetailPage` (~284).
- `seafarer_contract.service.js` (`list`, `get`) và `contract_bill.service.js` (`BILL_SELECT`, chi tiết): thêm `trip` `{ id, code, status }` bằng `LEFT JOIN seafarer_voyage sv ON sv.legacy_contract_id = c.id AND sv.deleted_at IS NULL`. Không đổi câu JOIN cũ.
- Frontend: có `trip` thì link "{mã chuyến mới}" tới `/voyages/{trip.id}` kèm badge `voyage` mới; không có thì hiện mã chuyến cũ dạng chữ thường (không link), chú thích "chuyến cũ". Bỏ badge `voyage` đang hiện `display_status` cũ (nhóm `voyage` trong `statusMap` đổi giá trị, mục 5.4).

**Chỗ đọc "ai đang trên tàu nào" đổi sang chuyến mới** (không phải hợp đồng):
- `utils/crew_overview.js` `activeContract`: `vessel_name`, `vessel_id` lấy từ `seafarer_voyage` `ONBOARD` của thuyền viên; `contract_end` giữ biểu thức cũ (hợp đồng `ACTIVE` ở chuyến cũ `ONBOARD`), không có thì `planned_leave_date` của chuyến mới.
- `seafarer.service.js` ~224, ~231 (lọc theo chức danh / tàu đã đi): đọc `seafarer_voyage` (đã gồm dữ liệu chuyển từ chuyến cũ). ~404 (chặn tạm ngưng): giữ điều kiện hợp đồng cũ **và** thêm chặn khi có chuyến `ONBOARD`.
- `fleet.service.js` `listOwnerVesselCrew` (~373): người đang trên tàu lấy từ `seafarer_voyage` `ONBOARD` của tàu, cộng `sea_service` như hiện nay. `vesselUsage`: đếm thêm `seafarer_voyage` và `opportunity` của tàu (giữ đếm `voyage` cũ).
- `profileView.js` `voyageNow`, đầu hồ sơ "Đang trên {tàu}": đọc chuyến `ONBOARD`.
- `voyage.service.js`, `voyage.routes.js`: viết lại cho bảng mới (mục 4.5). Mọi code vị trí, `start`, `end`, `transition`, `VoyageTransitionModal` bỏ.

### 3.4 Chuyển dữ liệu cũ (trong migration 023)

Chỉ **đọc** bảng cũ, ghi vào bảng mới. Với mỗi `voyage_position` chưa xoá (thuộc `voyage` chưa xoá):
- Tạo một `opportunity`: chủ tàu, tàu, chức danh, budget từ vị trí; ngày và nơi dự kiến từ chuyến cũ (`planned_embark_date` → `planned_join_date`, `embark_port_id` → `planned_join_port_id`, …); `deadline` = `planned_embark_date`; `owner_user_id` = `created_by` của chuyến cũ (null thì người dùng có id nhỏ nhất có vai trò quản trị); `legacy_voyage_id`; `created_by` = `created_by` của chuyến cũ; mã `CH-…` theo năm tạo chuyến cũ. Trạng thái: vị trí có hợp đồng chưa xoá và chuyến cũ đã `ONBOARD`/`ENDED` → `WON`; chuyến cũ `ENDED` mà vị trí trống → `CANCELLED` (`close_reason` "Chuyển từ chuyến cũ, không có người"); còn lại `OPEN`.
- Vị trí có hợp đồng chưa xoá **và** chuyến cũ `ONBOARD` hoặc `ENDED`: tạo một `seafarer_voyage` `source = 'OPPORTUNITY'`: người, chức danh, tàu, chủ tàu từ hợp đồng / chuyến cũ; `join_date` = `GREATEST(actual_embark_date, contract.start_date)`; `join_port_id` = `embark_port_id`; `planned_leave_date` = `contract.end_date`; chuyến cũ `ENDED` → `LEFT` với `leave_date` = `LEAST(actual_disembark_date, contract.end_date)`, `leave_port_id` = `disembark_port_id`; `budget_monthly_usd` từ vị trí; `legacy_voyage_id`, **`legacy_contract_id`**; `notes` "Chuyển từ {mã chuyến cũ}"; mã `CT-…` theo năm của `join_date`; `created_by` = `created_by` của hợp đồng (để phạm vi "của mình" vẫn thấy đúng người). Tạo `opportunity_candidate` `PLACED` cho người đó.
- Vị trí có hợp đồng nhưng chuyến cũ còn `PLANNING` (người chưa lên tàu): **không** tạo chuyến. Cơ hội `OPEN`, người đó thành ứng viên `PICKED` mang nhãn Chủ tàu đã chọn. Hợp đồng của họ giữ nguyên ở chuyến cũ (vẫn xem, duyệt được); chốt người đó sau này tạo chuyến mới, chưa nối với hợp đồng.
- Thiếu `embark_port_id` (bắt buộc ở chuyến mới) hoặc một người có hai hợp đồng ở hai chuyến cũ cùng `ONBOARD`: `RAISE EXCEPTION` nêu mã chuyến / tên. Bước 0 đếm trước để không vấp lúc chạy.

## 4. API

Tất cả dưới `/api/v1`, `onRequest: [fastify.authenticate, fastify.can('…')]`, phạm vi dữ liệu qua `utils/scope.js`: thêm `opportunity: 'opportunity'` và đổi `voyage: 'voyage'` thành `voyage: 'seafarer_voyage'` trong `SCOPED_TABLES` (mục `voyage` giờ là chuyến mới; hợp đồng có phạm vi riêng). Danh sách trả `{ data, total, counts }` như các danh sách hiện có.

### 4.1 Quyền (`backend/src/constants/permissions.js`)

- Mục mới `opportunity` (nhóm "Vận hành", `scoped: true`, đứng trước `voyage`): `view` Xem danh sách và chi tiết · `create` Tạo và nhân bản cơ hội · `update` Sửa cơ hội, hồ sơ yêu cầu, ứng viên, nhãn chủ tàu đã chọn · `send` Ghi nhận gửi chủ tàu · `close` Chốt người, đóng và huỷ cơ hội.
- Mục `voyage` đổi chữ: `create` "Tạo chuyến không qua cơ hội" · `update` "Sửa chuyến, đổi ngày rời, sửa ngày đã ghi" · `delete` "Xoá chuyến tạo tay, huỷ chốt" · `run` "Ghi rời tàu, chuyển tàu".
- Migration 023 cấp `opportunity.*` cho mọi vai trò đang có `voyage.create` (đọc cách lưu quyền ở `009_roles_permissions.sql` trước).

### 4.2 Cơ hội — `routes/v1/opportunity.routes.js`, `services/opportunity.service.js`

| Method + path | Quyền | Body / query | Quy tắc |
|---|---|---|---|
| `GET /opportunities` | view | `tab` = `open` (mặc định: `OPEN` + `WON` trong 7 ngày gần nhất) / `won` / `lost` / `cancelled` / `all`; `search` (mã, chức danh, tàu, chủ tàu); `vessel_id`, `ship_owner_id`, `rank_id`, `owner_user_id`, `deadline_before`; `page`, `limit` | Mỗi dòng: `id, code, rank_name, vessel_id, vessel_name, ship_owner_name, planned_join_date, planned_join_port_name, planned_leave_date, planned_leave_port_name, deadline, deadline_flag, status, display_status, budget_monthly_usd, candidates_count, sent_count, last_sent_at, selected_name, placed_name, voyage_id, voyage_code` |
| `GET /opportunities/:id` | view | | Cơ hội đầy đủ + `requirements[]` + `candidates[]` (mỗi người: thuyền viên, `fit`, `status`, `owner_selected_at`, `export_pack` `{ id, created_at }`, `last_sent_at`) + `sends[]` (mới nhất trước) + `voyage` (nếu đã chốt) |
| `GET /opportunities/requirement-presets?vessel_id&rank_id` | create | | Hồ sơ yêu cầu điền sẵn theo mục 1.6 |
| `PUT /rank-requirement-presets/:rankId` | update | `requirements[]` | Ghi đè mẫu của chức danh |
| `POST /opportunities` | create | mọi cột ở 3.1 trừ `code, status, close_reason`; `requirements[]` | Cấp mã; transaction |
| `PUT /opportunities/:id` | update | như POST | Chỉ khi `OPEN` (409 khác). Thay toàn bộ `requirements` |
| `POST /opportunities/:id/duplicate` | create | `rank_id` (tuỳ chọn) | Chép mọi thứ trừ ứng viên, gửi; trạng thái `OPEN`; trả cơ hội mới |
| `POST /opportunities/:id/close` | close | `outcome` = `LOST` / `CANCELLED`, `reason` (bắt buộc khi `LOST`) | Chỉ khi `OPEN` |
| `POST /opportunities/:id/reopen` | close | | `LOST`/`CANCELLED` → `OPEN` |
| `DELETE /opportunities/:id` | close | | Chỉ khi `OPEN` và chưa từng gửi; xoá mềm |

`display_status` và `deadline_flag` tính bằng hàm thuần trong `utils/opportunity_rules.js` (truyền "hôm nay" vào để test).

### 4.3 Ứng viên

| Method + path | Quyền | Body | Quy tắc |
|---|---|---|---|
| `GET /opportunities/:id/suggestions` | view | query mục 1.7 | Mục 1.7 |
| `POST /opportunities/:id/candidates` | update | `seafarer_ids[]` (1–50), `source` | Chỉ khi `OPEN`. Người đã `REMOVED` thì về `PICKED`; người đã có thì bỏ qua. `INACTIVE` → 409 |
| `DELETE /opportunities/:id/candidates/:seafarerId` | update | | `REMOVED`; bỏ nhãn nếu đang mang |
| `POST /opportunities/:id/candidates/:seafarerId/owner-selected` | update | | Gắn nhãn; bỏ nhãn của người khác trong cùng transaction |
| `DELETE /opportunities/:id/candidates/:seafarerId/owner-selected` | update | | Bỏ nhãn |
| `POST /opportunities/:id/sends` | send | `candidate_ids[]`, `ship_owner_contact_id`, `to_email`, `subject` | Mỗi ứng viên phải có `export_pack_id` (409 nêu tên người thiếu). Ghi `opportunity_send`, đặt `last_sent_at` |

### 4.4 Chốt — `POST /opportunities/:id/place`

Quyền `opportunity.close` **và** `voyage.view`. Body: `seafarer_id`*, `join_date`*, `join_port_id`*, `vessel_id` (bắt buộc nếu cơ hội chưa có tàu). Quy tắc theo mục 1.4: cơ hội `OPEN` (409); người là ứng viên `PICKED` (409 "Người này không có trong danh sách ứng viên"); `join_date` ≤ hôm nay (400 "Ngày xuống tàu không được sau hôm nay"); người không có chuyến `ONBOARD` khác (409 "{tên} đang trên {tàu}, ghi rời tàu chuyến đó trước"); không `INACTIVE`. Transaction: tạo chuyến, cập nhật cơ hội, ứng viên, thuyền viên. Trả `{ opportunity, voyage }`.

### 4.5 Chuyến — `routes/v1/voyage.routes.js`, `services/voyage.service.js` (viết lại cho bảng `seafarer_voyage`)

| Method + path | Quyền | Body / query | Quy tắc |
|---|---|---|---|
| `GET /voyages` | view | `tab` = `onboard` / `left` / `all`; `search` (tên thuyền viên, mã chuyến); `from`, `to` (lọc giao khoảng, mục 4.6); `vessel_id`, `ship_owner_id`, `rank_id`, `seafarer_id`, `source`, `leaving_within` (ngày); `page`, `limit` | Mỗi dòng: `id, code, seafarer_id, seafarer_name, rank_name, vessel_id, vessel_name, ship_owner_name, join_date, join_port_name, join_delta_days, planned_leave_date, original_leave_date, leave_date, leave_port_name, status, leave_flag, source, manual_reason, opportunity_id, opportunity_code, legacy_contract_id, legacy_contract_number, legacy_contract_status` |
| `GET /voyages/:id` | view | | Chuyến đầy đủ + `opportunity` (mã, ngày xuống dự kiến) + `transferred_from` / `transferred_to` + `legacy_contract` tóm tắt (nếu có) + `history[]` (từ `seafarer_voyage_log`, mục 4.7) |
| `POST /voyages` | create | `seafarer_id`*, `rank_id`*, `vessel_id`*, `ship_owner_id`*, `manual_reason`*, `budget_monthly_usd`, `join_date`*, `join_port_id`*, `planned_leave_date`*, `planned_leave_port_id`, `notes`; khi `ended = true`: `leave_date`*, `leave_port_id`*, `leave_note` | Mục 1.4 (Tạo chuyến, chuyển tàu, trùng thời gian). `OTHER` bắt `notes`. Trả chuyến (và `closed_voyage` nếu vừa đóng chuyến cũ) |
| `PATCH /voyages/:id/dates` | update | `join_date`, `join_port_id`, `leave_date`, `leave_port_id` | Sửa ngày đã ghi; giữ mọi CHECK; không được đổi `join_date` sau hôm nay |
| `POST /voyages/:id/leave-plan` | update | `planned_leave_date`*, `note` | Đổi ngày rời dự kiến; lần đầu chép `original_leave_date`. Chỉ khi `ONBOARD` |
| `POST /voyages/:id/leave` | run | `leave_date`*, `leave_port_id`*, `leave_note` | Ghi rời tàu (mục 1.4) |
| `POST /voyages/leave` | run | `voyage_ids[]` (1–50), `leave_date`*, `leave_port_id`*, `leave_note` | Ghi rời cho nhiều chuyến; mọi chuyến phải `ONBOARD`, sai một cái thì không lưu cái nào (409 nêu tên) |
| `DELETE /voyages/:id` | delete | `note` | Huỷ chốt / xoá chuyến (mục 1.4) |

Bỏ `POST /voyages/:id/start`, `/end` và mọi code vị trí. Không còn API nào ghi vào bảng `voyage`, `voyage_position` cũ.

### 4.6 Lọc theo thời gian

Chuyến giao với `[from, to]` khi `join_date <= to` **và** `COALESCE(leave_date, planned_leave_date) >= from`. Dùng chung cho danh sách chuyến và thẻ Đội ngũ. Hàm SQL nhỏ trong service, có test.

### 4.7 Lịch sử chuyến

Bảng `seafarer_voyage_log` (thêm vào migration 023): `voyage_id` (→ `seafarer_voyage`), `action`, `actor_id`, `payload JSONB`, `created_at`. `action`: `PLACE` (chốt), `CREATE` (tạo tay), `LEAVE`, `LEAVE_PLAN`, `EDIT_DATES`, `TRANSFER_OUT`, `DELETE`. `payload` giữ giá trị cũ và mới để hiện "đổi ngày rời dự kiến 05/03/2027 → 05/04/2027 · ghi chú". Màn hiện bằng `AuditTimeline` nếu props hợp (đọc trước).

### 4.8 Đội ngũ trên tàu — `GET /vessels/:id/crew-timeline?from&to&rank_id`

Quyền `vessel.view` và `voyage.view`. Trả `voyages[]` (như dòng danh sách chuyến, lọc mục 4.6), `open_opportunities[]` (cơ hội `OPEN` của tàu có khoảng dự kiến giao `[from, to]`: mã, chức danh, ngày xuống / rời dự kiến, tên người mang nhãn), và `summary` `{ onboard_today, voyages_in_range, left_in_range, leaving_without_cover, by_source }`. `leaving_without_cover` = chuyến `ONBOARD` có ngày rời dự kiến trong 6 tháng tới mà tàu không có cơ hội `OPEN` cùng chức danh.

### 4.9 Bản xuất từ cơ hội

- `export_pack` thêm cột `opportunity_id` (migration 023). `POST /exports` nhận thêm `opportunity_id`; khi có thì ghi `export_pack_id` vào `opportunity_candidate` của người đó (thay bộ cũ nếu có).
- `buildZip`: khi bộ thuộc một cơ hội, thêm vào ZIP file giấy tờ của thuyền viên khớp các yêu cầu `CERTIFICATE` của cơ hội (đọc cách nối `seafarer_document` ↔ chứng chỉ / loại giấy trong `document.service.js` trước; mục nào không tìm được file thì bỏ qua và ghi vào file `THIEU-GIAY.txt` trong ZIP). Tên file trong ZIP: `{thứ tự}-{tên giấy}.{đuôi}`.
- Tên ZIP khi bộ thuộc cơ hội: `{HO-TEN}_{chuc-danh-en}_{tau}.zip` (không dấu, gạch nối).

---

## 5. Giao diện

### 5.1 Xem wireframe

Mở `docs/design/wireframes/co-hoi-chuyen-tau.html` trong trình duyệt (skill `/browse` của gstack, theo `CLAUDE.md`). Trang xếp dọc mọi màn, mục lục bên trái; mở thẳng một màn bằng hash. Chụp không cần giao diện:

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars --window-size=1440,1600 --virtual-time-budget=3000 \
  --screenshot=/tmp/wf.png "file://$PWD/docs/design/wireframes/co-hoi-chuyen-tau.html#ct-co-hoi"
```

| Hash | Màn |
|---|---|
| `#he-thong` | Bảng dựng theo hệ thống (mục 5.2 chép lại) |
| `#mo-hinh` | Mô hình và luồng |
| `#ds-co-hoi`, `#tao-co-hoi`, `#ct-co-hoi`, `#tim-ung-vien` | Màn 1–4 |
| `#ban-xuat`, `#gui-chu-tau`, `#chot` | Màn 5–7 |
| `#ds-chuyen`, `#tao-chuyen`, `#doi-ngu`, `#ct-chuyen` | Màn 8–11 |
| `#roi-tau`, `#doi-ngay`, `#huy-chot`, `#ho-so` | Màn 12–14, Đ4 |
| `#dac-biet`, `#phu-luc`, `#tao-phu-luc`, `#roi-muon` | **Giai đoạn 2, không dựng** |
| `#du-lieu`, `#cau-hoi` | Dữ liệu, câu hỏi (file này thay thế) |

Phần nào trong wireframe có nhãn vàng **"Giai đoạn 2"** thì không dựng. Wireframe vẽ sidebar, thẻ, bảng bằng CSS riêng; **dựng bằng AntD + `components/ds` + CSS có sẵn**. Chỗ wireframe khác file này thì làm theo file này (ví dụ ZIP thay cho PDF gộp, mục 2.2).

### 5.2 Dựng theo màn đang có

| Màn | Dựng theo | Thêm vào design system trước |
|---|---|---|
| 1 Danh sách cơ hội | Khuôn `VoyageListPage` / `ContractListPage`: `StatusTabs`, ô tìm, `Select` lọc, bảng `ds-table`, `RowActions`, `ListFooter`, nhãn `StatusBadge` | Nhóm `opportunity` trong `statusMap` |
| 2 Tạo / sửa cơ hội | `FormFrame` + `FormSection` (`pages/admin/fleet/FleetParts.jsx`), CSS `sf-*`; tiền bằng `MoneyInput`; mức Bắt buộc / Nên có bằng `SegmentedPick` (`pages/admin/fleet/FleetParts.jsx`) | — |
| 3 Chi tiết cơ hội | Khuôn `VoyageDetailPage` hiện tại: `crew-head`, `crew-panel`, `DescriptionList`, `Banner` | `RequirementFit` (chip "8/8 bắt buộc", màu theo đủ / thiếu / sắp hết hạn, bấm mở bảng đối chiếu); nhóm `candidate` trong `statusMap` |
| 4 Đề xuất ứng viên | `SlidePanel`, `FilterChips`, `ListRow` | `SlidePanel` thêm prop `size="wide"` (720px; dưới sm vẫn phủ hết) |
| 5 Bản xuất | Nguyên `/exports/new` (`PackCreatePage`) và `/exports/:packId` (`PackDetailPage`) | — |
| 6 Gửi chủ tàu | Không có màn; `modal.confirm` | — |
| 7 Chốt, 12 Ghi rời tàu, 13 Đổi ngày rời, Đ4 Huỷ chốt | `Modal` như `VoyageTransitionModal` / `ApproveModal` | — |
| 8 Danh sách chuyến | Sửa `VoyageListPage` | Nhóm `voyage` trong `statusMap` đổi giá trị |
| 9 Tạo chuyến | Sửa `VoyageFormPage` theo `FormFrame`; "Chuyến đã kết thúc" bằng `ToggleRow` | — |
| 10 Đội ngũ | Thêm tab vào `StatusTabs` của `VesselDetailPage` | **`CrewTimeline`**: biểu đồ thời gian theo hàng (mỗi hàng một chuyến), mục 5.6 |
| 11 Chi tiết chuyến | Sửa `VoyageDetailPage` (bỏ bảng vị trí) | — |
| 14 Chuyến trên hồ sơ | Tab Đi tàu của hồ sơ dùng `SeaServiceTimeline` | `SeaServiceTimeline` nhận `source.type = 'voyage'` |

### 5.3 Điều hướng

- `frontend/src/layouts/navConfig.js`: thêm `{ key: 'opportunities', group: 2, label: 'Cơ hội', icon: 'target', to: '/opportunities', match: ['/opportunities'], perm: 'opportunity.view' }` ngay trước "Chuyến tàu". Thêm icon `target` vào `ICONS` của `AdminLayout.jsx` (SVG 24×24 kiểu các icon đang có: hai vòng tròn đồng tâm và chấm giữa). Sửa `layouts/__tests__/navConfig.test.js`.
- `frontend/src/App.jsx`:

| Đường dẫn | Trang | Quyền |
|---|---|---|
| `/opportunities` | `OpportunityListPage` | `opportunity.view` |
| `/opportunities/new` | `OpportunityFormPage` | `opportunity.create` |
| `/opportunities/:id` | `OpportunityDetailPage` | `opportunity.view` |
| `/opportunities/:id/edit` | `OpportunityFormPage` | `opportunity.update` |
| `/voyages` | `VoyageListPage` | `voyage.view` |
| `/voyages/new` | `VoyageFormPage` (chỉ tạo; không còn `/voyages/:id/edit`) | `voyage.create` |
| `/voyages/:id` | `VoyageDetailPage` | `voyage.view` |

- Tham số điền sẵn: `/opportunities/new?vessel=&owner=&rank=&join=` (từ "Tạo cơ hội tìm người thay", "Tạo cơ hội thay" ở Đội ngũ); `/voyages/new?seafarer=&rank=&vessel=&owner=&join=&reason=TRANSFER&budget=` (từ Chuyển tàu, Thêm chuyến, Đội ngũ); `/exports/new?opportunity=&seafarer=1,2` (mục 5.5 Màn 5); `/contracts/new` hiện màn khoá (mục 3.3).

### 5.4 Trạng thái (`frontend/src/components/ds/statusMap.js`)

```js
opportunity: {
  NEW: { label: 'Mới', tone: 'neutral', mark: 'ring' },
  PICKING: { label: 'Đang chọn ứng viên', tone: 'warning', mark: 'ellipsis' },
  WAITING: { label: 'Chờ kết quả', tone: 'warning', mark: 'clock' },
  OWNER_SELECTED: { label: 'Chủ tàu đã chọn', tone: 'success', mark: 'ring-dot' },
  WON: { label: 'Đã chốt', tone: 'success', mark: 'check' },
  LOST: { label: 'Không thành', tone: 'error', mark: 'cross' },
  CANCELLED: { label: 'Huỷ', tone: 'neutral', mark: 'ring' },
},
candidate: {
  PICKED: { label: 'Trong danh sách', tone: 'neutral', mark: 'ring' },
  PLACED: { label: 'Được chốt', tone: 'success', mark: 'check' },
  NOT_SELECTED: { label: 'Không được chọn', tone: 'neutral', mark: 'ring' },
  REMOVED: { label: 'Đã bỏ', tone: 'neutral', mark: 'ring' },
},
voyage: {
  ONBOARD: { label: 'Đang trên tàu', tone: 'success', mark: 'ring-dot' },
  LEFT: { label: 'Đã rời tàu', tone: 'neutral', mark: 'ring' },
},
```

Dấu `mark` phải là dấu đã có trong `StatusBadge.jsx`; kiểm trước, thiếu thì chọn dấu gần nhất đang có. Thêm nhóm mới vào `STATUS_GROUP_LABELS` và trang `/design-system`.

### 5.5 Từng màn

**Màn 1 · Danh sách cơ hội** (`pages/admin/opportunities/OpportunityListPage.jsx`): tiêu đề "Cơ hội", mô tả "Mỗi cơ hội là một vị trí chủ tàu cần người.", nút chính "Tạo cơ hội". Tab: Đang mở, Đã chốt, Không thành, Huỷ, Tất cả. Lọc: tìm "Tìm mã, chức danh, tàu…", Tàu, Chủ tàu, Chức danh, Người phụ trách, Hạn chốt. Cột: Cơ hội · chức danh (chức danh đậm, mã dòng phụ) · Chủ tàu · tàu (tàu trên, chủ tàu dưới; chưa rõ tàu thì "Chưa rõ tàu" màu phụ) · Xuống tàu dự kiến (ngày, nơi) · Rời tàu dự kiến (ngày, nơi) · Ứng viên ("4 ứng viên · 2 đã gửi 14/10"; có nhãn thì "{tên} · chủ tàu đã chọn {ngày}"; đã chốt thì tên + link chuyến) · Hạn chốt (ngày + nhãn cảnh báo) · Trạng thái · Budget/tháng (phải). Rỗng, đang tải, lỗi, không thấy, mobile như các danh sách khác.

**Màn 2 · Tạo / sửa cơ hội** (`OpportunityFormPage.jsx`):
- Khối "Vị trí": Chủ tàu*, Tàu (gợi ý "Để trống nếu chủ tàu chưa báo tàu. Phải có khi chốt."; chọn tàu thì điền chủ tàu theo tàu như form chuyến cũ), Chức danh*, Budget/tháng (USD)*, Budget cả chuyến (USD) (tự tính theo `monthsBetween(ngày xuống, ngày rời)`, sửa ô nào ô kia tự tính, gợi ý "Tính theo ngày xuống → rời: {n} tháng"), Người phụ trách* (mặc định người đang đăng nhập).
- Khối "Thời gian dự kiến": Ngày xuống tàu*, Nơi xuống tàu, Ngày rời tàu*, Nơi rời tàu, Hạn chốt* (gợi ý "Ngày chủ tàu cần danh sách"), Ghi chú.
- Khối "Hồ sơ yêu cầu": bảng nhóm theo Giấy tờ (loại chứng chỉ có `category` = `DOCUMENT`, `MEDICAL`), Chứng chỉ (còn lại), Kinh nghiệm, Mẫu giấy xuất kèm. Mỗi dòng: tên · mức (`SegmentedPick` Bắt buộc / Nên có; mẫu giấy không có mức) · điều kiện (`Select` còn hạn tới; kinh nghiệm: số tháng / số chuyến) · Xoá. Dưới bảng: "+ Giấy tờ", "+ Chứng chỉ", "+ Kinh nghiệm", "+ Mẫu giấy", và "Lưu thành mẫu cho {chức danh}". Mô tả khối ghi nguồn điền sẵn ("Điền sẵn từ yêu cầu chứng chỉ của {tàu} cho {chức danh}" / "… mẫu của {chức danh}" / "Chưa có mẫu cho {chức danh}"). Đổi tàu hoặc chức danh khi bảng đã có dòng thì hỏi "Thay hồ sơ yêu cầu theo {chức danh} mới?".
- Thanh lưu theo `CLAUDE.md` 3.3: tạo = "Huỷ", "Lưu & thêm vị trí khác", "Tạo cơ hội"; sửa = "Huỷ", "Lưu thay đổi". "Lưu & thêm vị trí khác" giữ chủ tàu, tàu, bốn mốc, hạn chốt, người phụ trách; xoá chức danh, budget, hồ sơ yêu cầu; toast "Đã tạo {mã} · {chức danh}".

**Màn 3 · Chi tiết cơ hội** (`OpportunityDetailPage.jsx`):
- Đầu trang: "Cơ hội > {mã}"; tiêu đề "{chức danh} · {tàu} · {mã}"; dòng phụ "{chủ tàu} · phụ trách {tên}"; badge `opportunity` + nhãn hạn chốt. Nút: "…" (Nhân bản cho vị trí khác · Đóng cơ hội · Huỷ · Mở lại · Xoá, theo trạng thái và quyền), "Sửa cơ hội", nút chính "Chốt người" (khi `OPEN` và có ứng viên). Đã chốt: nút chính đổi thành "Mở chuyến {mã}".
- `DescriptionList` 4 ô: Xuống tàu dự kiến, Rời tàu dự kiến, Budget, Hồ sơ yêu cầu ("8 bắt buộc · 3 nên có", link "Xem" mở bảng chỉ đọc).
- Khối "Ứng viên {n}": nút "Đề xuất nhanh", "+ Thêm ứng viên" (cùng mở Màn 4). Bảng có cột chọn: Ứng viên (tên + chip "Chủ tàu đã chọn" nếu có; dòng phụ trạng thái thuyền viên, ngày rảnh) · Hồ sơ yêu cầu (`RequirementFit`) · Thiếu hoặc sắp hết hạn (tối đa 2 dòng, còn lại "+n") · Bản xuất ("Chưa tạo" / link "Đã tạo {ngày}") · Gửi chủ tàu (ngày, người nhận / "Chưa gửi") · thao tác ("Tạo bản xuất" hoặc "Tải xuống", và "…": Đánh dấu chủ tàu đã chọn / Bỏ nhãn · Mở hồ sơ thuyền viên · Tạo lại bản xuất · Bỏ khỏi danh sách). Chọn nhiều thì hiện thanh "Đã chọn {n}": "Tạo bản xuất cho {n} người", "Gửi cho chủ tàu" (chỉ bật khi mọi người đã chọn có bản xuất), "Bỏ khỏi danh sách".
- Khối "Lịch sử gửi" (khi có): thời gian, người gửi, gửi tới, những người nào.

**Màn 4 · Đề xuất ứng viên** (`CandidatePanel.jsx`, `SlidePanel size="wide"`): tiêu đề "Đề xuất ứng viên · {chức danh} · {tàu}", mô tả "Rảnh trước {ngày xuống}, đối chiếu {n} yêu cầu." (bấm "+ Thêm ứng viên" thì tiêu đề "Thêm ứng viên", bộ lọc tắt). Ô tìm, hàng `FilterChips` (mục 1.7), dòng đếm "{n} người khớp · xếp theo mức hợp…", danh sách `ListRow`: chọn · tên (chức danh, tuổi, trạng thái) · `RequirementFit` · lý do (chip). Người đã trong danh sách hoặc đang được giữ cho cơ hội khác: mờ, chú thích "Đã trong danh sách" / "Đang giữ cho {mã}", vẫn chọn được người đang giữ. Chân: "Đã tích {n} người", "Huỷ", "Thêm {n} ứng viên".

**Màn 5 · Bản xuất** (sửa `PackCreatePage`, `PackDetailPage`, không màn mới): `PackCreatePage` đọc `?opportunity=&seafarer=1,2`: chọn sẵn các người đó và chủ tàu của cơ hội; chọn sẵn mẫu giấy theo yêu cầu `TEMPLATE`; thêm một khối chỉ đọc "Giấy tờ theo hồ sơ yêu cầu" liệt kê file sẽ vào ZIP và mục thiếu file (kiểu banner "Hồ sơ còn thiếu" đang có). Tạo xong (nhiều người) quay về chi tiết cơ hội; một người thì sang `PackDetailPage` như hiện nay. `PackDetailPage`: khi bộ có `opportunity_id`, đường dẫn đầu trang thêm "Cơ hội > {mã}", thêm nút "Gửi cho chủ tàu" cạnh nút tải.

**Màn 6 · Gửi chủ tàu** (`opportunities/sendToOwner.js` + `modal.confirm`): mục 1.8. Hàm thuần `buildMailto({ contact, cc, opportunity, people })` trả URL, có test cho giới hạn độ dài.

**Màn 7 · Chốt người** (`PlaceModal.jsx`, rộng 480): tiêu đề "Chốt người · {chức danh} · {tàu}", mô tả "{mã} · {chủ tàu}". Ô: Người* (`Select` ứng viên `PICKED`, nhãn "{tên} · chủ tàu đã chọn" cho người mang nhãn, chọn sẵn người đó), Ngày xuống tàu* (mặc định = ngày xuống dự kiến nếu ≤ hôm nay, không thì hôm nay; gợi ý "Không được sau hôm nay"; `disabledDate` sau hôm nay), Nơi xuống tàu* (mặc định nơi dự kiến); thêm ô Tàu* nếu cơ hội chưa có tàu. Nút "Huỷ", "Chốt". Lưu xong: toast "Đã chốt {tên} · {mã chuyến}" có nút "Mở chuyến".

**Màn 8 · Danh sách chuyến** (sửa `VoyageListPage`): mô tả "Mỗi chuyến là một thuyền viên đi một tàu.", nút chính "Tạo chuyến". Tab: Đang trên tàu, Đã rời tàu, Tất cả. Lọc: tìm "Tìm thuyền viên, mã chuyến…", khoảng "Trên tàu trong" (`DatePicker.RangePicker`, mặc định tháng này), Tàu, Chủ tàu, Chức danh, Nguồn, "Sắp rời trong 30 ngày". Cột: chọn · Thuyền viên · chuyến (tên, mã) · Vị trí · Tàu · chủ tàu · Lên tàu (ngày + nhãn lệch; nơi) · Rời tàu (ngày; "dự kiến" / "đã dời từ {ngày}" / nơi thực tế; nhãn cảnh báo) · Nguồn (link mã cơ hội, hoặc "Tạo tay · {lý do}"). Chọn nhiều dòng `ONBOARD` thì thanh "Đã chọn {n} chuyến": "Ghi rời tàu" (Màn 12 nhiều dòng), "Bỏ chọn".

**Màn 9 · Tạo chuyến** (sửa `VoyageFormPage`): khối "Người và tàu": Thuyền viên* (`Select` tìm), Chức danh* (mặc định chức danh hiện tại), Lý do tạo không qua cơ hội* (`Select` 4 lý do), Tàu*, Chủ tàu* (theo tàu, sửa được), Budget/tháng (USD) (gợi ý "Không bắt buộc"). Chọn người đang `ONBOARD` thì `Banner` info ngay dưới: lý do Chuyển tàu → "{tên} đang trên {tàu} ({mã}). Lưu chuyến này sẽ ghi rời tàu chuyến đó ngày {ngày lên} tại {nơi lên} và nối hai chuyến."; lý do khác → banner cảnh báo "{tên} đang trên {tàu}. Ghi rời tàu chuyến đó trước, hoặc chọn lý do Chuyển tàu." và nút lưu báo lỗi. Khối "Thời gian": Ngày lên tàu* (không sau hôm nay), Nơi lên tàu*, Ngày rời dự kiến*, Nơi rời dự kiến, `ToggleRow` "Chuyến đã kết thúc" (bật thì thêm Ngày rời tàu*, Nơi rời tàu*, Ghi chú rời), Ghi chú (bắt buộc khi lý do Khác). Thanh lưu: "Huỷ", "Lưu & tạo chuyến khác" (giữ tàu, chủ tàu, ngày, nơi, lý do), "Tạo chuyến". Tạo xong sang chi tiết chuyến.

**Màn 10 · Đội ngũ** (`VesselDetailPage` + `fleet/VesselCrewTab.jsx`): tab "Thuyền viên" đổi thành "Đội ngũ" (số = đang trên tàu hôm nay), tab "Đi tàu" giữ nguyên. Nút "+ Tạo chuyến" trên đầu trang tàu (điền sẵn tàu, chủ tàu). Trong tab: `SegmentedPick` khoảng (Hôm nay · 6 tháng tới · Cả năm · Tuỳ chọn → `RangePicker`), `Select` Chức danh, `SegmentedPick` Biểu đồ / Bảng. Bốn ô tóm tắt (kiểu `vd-sum` đang có): Trên tàu hôm nay · Chuyến trong khoảng · Sắp rời, chưa có người thay (link "Tạo cơ hội thay") · Nguồn. Biểu đồ: `CrewTimeline` với hàng chuyến và hàng cơ hội đang mở (nhạt). Bảng: cùng cột Màn 8, có chọn nhiều để ghi rời. Khung "Đang trên tàu" ở tab Tổng quan đọc từ chuyến; "Xem tất cả" mở tab Đội ngũ với khoảng Hôm nay.

**Màn 11 · Chi tiết chuyến** (sửa `VoyageDetailPage`): đầu trang "Chuyến tàu > {mã}"; tiêu đề "{tên thuyền viên} · {mã}"; dòng phụ "{chức danh} trên {tàu} · {chủ tàu} · từ cơ hội {mã}" (hoặc "· tạo tay: {lý do}"); badge `voyage` + nhãn lệch / cảnh báo. Nút: "…" (Chuyển tàu · Sửa ngày đã ghi · Tạo cơ hội tìm người thay · Huỷ chốt / Xoá chuyến), "Đổi ngày rời dự kiến" (khi `ONBOARD`), nút chính "Ghi rời tàu" (khi `ONBOARD`). `DescriptionList` 4 ô: Lên tàu (dòng phụ "cơ hội dự kiến {ngày}"), Nơi lên tàu, Rời tàu (dự kiến / thực tế, "còn {n} tháng"), Nơi rời tàu. Ba ô: Nguồn, Budget, Hợp đồng (chuyến chuyển từ dữ liệu cũ có `legacy_contract`: số + badge `contract` + link; không có: chữ phụ "Hợp đồng gắn với chuyến ở giai đoạn sau", không có nút tạo). Khối "Lịch sử" (mục 4.7). Chuyển tàu: nối "Chuyển từ {mã}" / "Chuyển sang {mã}" dưới tiêu đề.

**Màn 12 · Ghi rời tàu** (`LeaveModal.jsx`, rộng 480): tiêu đề "Ghi rời tàu · {tên}" (nhiều chuyến: "Ghi rời tàu {n} chuyến" kèm danh sách tên), mô tả "{chức danh} · {tàu} · lên {ngày} · rời dự kiến {ngày}". Ô: Ngày rời tàu* (gợi ý nhãn sớm / muộn), Nơi rời tàu*, Ghi chú (`TextArea`). Nút "Huỷ", "Ghi rời tàu". Lưu xong toast "Đã ghi rời tàu {tên}" với hai nút "Tạo cơ hội tìm người thay", "Chuyển sang tàu khác".

**Màn 13 · Đổi ngày rời dự kiến** (`LeavePlanModal.jsx`): "Ngày rời hiện tại" (chỉ đọc), "Ngày rời mới"* (gợi ý chênh lệch), Ghi chú. Nút "Huỷ", "Lưu ngày rời mới". **Sửa ngày đã ghi** dùng cùng khung với các ô ngày, nơi lên / rời.

**Đ4 · Huỷ chốt / Xoá chuyến** (`modal.confirm` có ô ghi chú): tiêu đề "Huỷ chốt {tên} · {mã}?" / "Xoá chuyến {mã}?"; nội dung liệt kê việc sẽ xảy ra (mục 1.4); nút đỏ "Huỷ chốt" / "Xoá chuyến".

**Màn 14 · Chuyến trên hồ sơ** (`SeafarerDetailPage`): tab Đi tàu thêm chuyến vào `SeaServiceTimeline` (`source.type = 'voyage'`, nhãn "Chuyến {mã}", bấm mở chuyến), xếp chung với lịch sử khai. Nút "+ Thêm chuyến" (quyền `voyage.create`) mở Màn 9 điền sẵn người. Đầu hồ sơ ("Đang trên {tàu}") đọc chuyến `ONBOARD`.

### 5.6 `CrewTimeline` (component mới, `components/ds/CrewTimeline.jsx`)

Props: `from`, `to`, `today`, `rows[]` với `{ id, title, subtitle, bars: [{ kind, start, end, label }], onClick }`; `kind`: `onboard` (nền màu nhấn), `left` (nền xám), `planned` (viền nét đứt), `moved` (sọc, ngày rời đã dời), `opening` (nhạt, cơ hội đang mở). Cột tháng theo khoảng, vạch đỏ "Hôm nay {dd/mm}". Cột tên dính trái, phần biểu đồ cuộn ngang trong khung riêng. Bàn phím: mỗi hàng là một nút (Enter mở). Có trạng thái rỗng ("Chưa có chuyến nào trong khoảng này"). Minh hoạ trên `/design-system` với dữ liệu mẫu MV Ocean Pride của wireframe. Hàm thuần tính vị trí (`timelineLayout`) có test.

### 5.7 Cấu trúc file frontend

```
frontend/src/
  api/opportunityApi.js               list, get, create, update, duplicate, close, reopen, remove, presets, savePreset,
                                       suggestions, addCandidates, removeCandidate, selectOwner, unselectOwner, recordSend, place
  api/voyageApi.js                    viết lại phần chuyến: list, get, create, editDates, leavePlan, leave, leaveMany, remove, crewTimeline
  hooks/useOpportunities.js           query + mutation; mutation làm mới ['opportunities'], ['voyages'], ['seafarers']
  hooks/useVoyages.js                 viết lại phần chuyến; phần hợp đồng giữ, chỉ sửa theo mục 3.3 (khoá tạo, link chuyến)
  constants/opportunityVoyage.js
  components/ds/CrewTimeline.jsx, RequirementFit.jsx   (+ SlidePanel size, SeaServiceTimeline nguồn voyage)
  pages/admin/opportunities/
    opportunityView.js                hàm thuần: displayStatus, deadlineFlag, budgetSplit, requirementRows, fitSummary, toFormValues, toPayload
    sendToOwner.js                    buildMailto, mailSubject, mailBody
    OpportunityListPage.jsx, OpportunityFormPage.jsx, OpportunityDetailPage.jsx
    RequirementTable.jsx, CandidateTable.jsx, CandidatePanel.jsx, PlaceModal.jsx
    opportunities.css
    __tests__/opportunityView.test.js, sendToOwner.test.js
  pages/admin/voyages/
    voyageView.js                     viết lại: deltaLabel, leaveFlag, sourceLabel, toFormValues, toPayload
    VoyageListPage.jsx, VoyageFormPage.jsx, VoyageDetailPage.jsx (sửa)
    LeaveModal.jsx, LeavePlanModal.jsx, EditDatesModal.jsx (mới); bỏ VoyageTransitionModal.jsx, VoyageParts.jsx nếu không còn dùng
    __tests__/voyageView.test.js (viết lại)
  pages/admin/fleet/VesselCrewTab.jsx
```

Backend:

```
backend/src/
  constants/opportunity_voyage.js
  utils/opportunity_rules.js          displayStatus, deadlineFlag, requirementFit, suggestionScore, overlapsRange
  services/opportunity.service.js, services/voyage.service.js (viết lại)
  routes/v1/opportunity.routes.js, routes/v1/voyage.routes.js (viết lại)
  services/__tests__/opportunity_rules.test.js, opportunity.service.test.js, voyage.service.test.js
```

Đăng ký route mới ở `routes/v1/index.js` như các route khác.

---

## 6. Định dạng và quy ước

- Ngày hiện `DD/MM/YYYY`, gửi API `YYYY-MM-DD`; tiền như hiện nay (`utils/format` có sẵn `formatUsd`, `formatDate`).
- "Hôm nay" ở backend lấy `CURRENT_DATE` của DB; hàm thuần nhận `today` làm tham số để test.
- Mọi danh sách có `deleted_at IS NULL`.
- Chữ nhãn lệch: `deltaLabel(days)` → "đúng dự kiến" (0), "muộn {n} ngày" / "sớm {n} ngày" (< 60), "muộn {x} tháng" / "sớm {x} tháng" (≥ 60, một chữ số lẻ, dấu phẩy).

---

## 7. Những chỗ đang đọc chuyến / vị trí cũ (Bước 7)

Đã tìm ngày 26/10. Chia ba nhóm:

| Nhóm | File | Làm gì |
|---|---|---|
| Giữ nguyên SQL (hợp đồng, thanh toán đọc bảng cũ) | `services/seafarer_contract.service.js`, `services/contract_bill.service.js`, `jobs.js` | Chỉ thêm `trip` (mục 3.3) và bỏ `move_onboard` |
| Đổi sang chuyến mới | `utils/crew_overview.js`, `services/seafarer.service.js` (~224, ~231, ~404), `services/fleet.service.js` (~373, `vesselUsage`), `pages/admin/seafarers/profileView.js`, `pages/admin/SeafarerDetailPage.jsx`, `pages/admin/fleet/VesselDetailPage.jsx` | Mục 3.3 |
| Viết lại / bỏ | `services/voyage.service.js`, `routes/v1/voyage.routes.js`, `api/voyageApi.js` (phần chuyến), `hooks/useVoyages.js` (phần chuyến), `pages/admin/voyages/*`, `components/ds/statusMap.js` (nhóm `voyage`), `constants/voyageContract.js` (phần chuyến) | Mục 4.5, 5 |
| Đổi link, khoá tạo | `pages/admin/contracts/*` (ContractListPage, ContractDetailPage, ContractFormPage, ApproveModal, contractView), `pages/admin/bills/BillDetailPage.jsx`, `BillFormPage.jsx`, `BillListPage.jsx`, `routes/v1/seafarer_contract.routes.js` | Mục 3.3 |

Chạy lại `grep -rln "voyage" backend/src frontend/src` ở Bước 0 vì danh sách có thể đã đổi.

## 8. Các bước

### Bước 0 — Chuẩn bị

- Đọc `CLAUDE.md`, mục 1–7 file này, wireframe (mục 5.1).
- Đếm trên DB dev (và, nếu người dùng cho, trên bản sao DB thật): số chuyến cũ theo trạng thái, số vị trí, số hợp đồng chưa xoá theo trạng thái, số hợp đồng ở chuyến `PLANNING`, số chuyến `ONBOARD`/`ENDED` thiếu `embark_port_id` / `disembark_port_id`, số người có hai hợp đồng ở hai chuyến cũ cùng `ONBOARD`. **⛔ DỪNG** chỉ khi có chuyến thiếu cảng hoặc người trùng: báo danh sách và hỏi cách sửa dữ liệu. Không có thì ghi các con số vào Nhật ký và làm tiếp.
- Tạo nhánh `feature/co-hoi-chuyen` từ nhánh chính hiện tại.

**Xong khi:** đã có các con số trong Nhật ký; nếu phải dừng thì người dùng đã trả lời.

### Bước 1 — Migration

Viết `023_opportunity_voyage.sql` theo mục 3.1, 3.4, 4.1 (quyền), 4.7 (`seafarer_voyage_log`), 4.9 (`export_pack.opportunity_id`). Chạy trên DB dev từ bản sạch (`npm run migrate`) và trên một bản sao dữ liệu có chuyến cũ.

**Xong khi:** migrate chạy qua cả hai; truy vấn kiểm: mỗi hợp đồng chưa xoá ở chuyến cũ `ONBOARD`/`ENDED` có đúng một `seafarer_voyage.legacy_contract_id`; số cơ hội = số vị trí chưa xoá; không ai có hai chuyến `ONBOARD`; bảng `voyage`, `voyage_position`, `seafarer_contract` không đổi số dòng; số người bị đặt lại `seafarer.status` đã ghi Nhật ký (khác 0 thì báo người dùng ở cuối bước).

### Bước 2 — Hằng số và hàm thuần (backend)

`constants/opportunity_voyage.js`, `utils/opportunity_rules.js`. Test: `displayStatus` đủ 7 nhánh; `deadlineFlag` (còn 0, 7, 8 ngày, quá 1 ngày); `requirementFit` (có, thiếu, hết hạn trước JOIN / LEAVE / LEAVE_PLUS, `no_expiry`, ba giấy đọc từ cột `seafarer`, kinh nghiệm tháng và chuyến); `suggestionScore` (thứ tự mục 1.7); `overlapsRange` (chuyến đang trên tàu, đã rời, rời trước `from`, lên sau `to`).

**Xong khi:** `npm test` backend qua.

### Bước 3 — API cơ hội

Mục 4.1, 4.2. Test service: tạo cấp mã đúng; sửa khi `WON` → 409; đóng `LOST` thiếu lý do → 400; nhân bản không chép ứng viên; preset theo thứ tự tàu → chức danh → trống.

### Bước 4 — API ứng viên, đề xuất, gửi

Mục 4.3, 1.7. Test: thêm người `INACTIVE` → 409; gắn nhãn người thứ hai thì người thứ nhất mất nhãn; `free_before` loại người `ONBOARD` rời sau ngày đó; `held_by` đúng; ghi gửi khi thiếu bản xuất → 409.

### Bước 5 — Chốt

Mục 4.4. Test: ngày mai → 400; người đang `ONBOARD` → 409; cơ hội chưa có tàu không gửi `vessel_id` → 400; thành công thì cơ hội `WON`, ứng viên `PLACED` / `NOT_SELECTED`, thuyền viên `ON_VESSEL`, `seafarer_voyage_log` có `PLACE`.

### Bước 6 — API chuyến

Mục 4.5–4.8. Test: tạo tay Chuyển tàu đóng chuyến cũ cùng ngày và nối `transferred_from_id`; tạo tay lý do khác khi đang `ONBOARD` → 409; nhập chuyến cũ trùng thời gian → 409; ghi rời ngày < ngày lên → 400; ghi rời nhiều chuyến có một chuyến đã `LEFT` → 409, không chuyến nào đổi; huỷ chốt khi có hợp đồng → 409; huỷ chốt đưa cơ hội về `OPEN`; `crew-timeline` đếm `leaving_without_cover` đúng.

### Bước 7 — Khoá tạo hợp đồng, đổi các chỗ đọc chuyến

Mục 3.3, mục 7. Sửa test hợp đồng / bill / seafarer / fleet đang có cho đúng.

**Xong khi:** `POST /contracts` trả 409 đúng câu; duyệt một hợp đồng chờ duyệt cũ qua API không đổi `seafarer.status`; `grep -rn "move_onboard" backend/src frontend/src` không còn; `voyage_position` chỉ còn trong `seafarer_contract.service.js`, `contract_bill.service.js`, migration; toàn bộ test backend qua; danh sách và chi tiết hợp đồng, yêu cầu thanh toán vẫn tải được và có `trip` cho hợp đồng đã chuyển.

### Bước 8 — Nền frontend

API, hooks, hằng số, `statusMap` (mục 5.4), điều hướng và route (mục 5.3), icon. Sửa chỗ frontend ở mục 3.3 (khoá tạo, link sang chuyến, bỏ câu hỏi chuyển trạng thái khi duyệt) cho hợp đồng, yêu cầu thanh toán, hồ sơ chạy được (chưa cần màn mới).

**Xong khi:** `npm run lint`, `npm test`, `npm run build` frontend qua; các màn hợp đồng, yêu cầu thanh toán, hồ sơ thuyền viên mở không lỗi.

### Bước 9 — Design system

`RequirementFit`, `CrewTimeline` (+ `timelineLayout` có test), `SlidePanel size="wide"`, `SeaServiceTimeline` nguồn `voyage`. Minh hoạ tất cả trên `/design-system`.

**Xong khi:** trang `/design-system` hiện bốn thay đổi, sáng và tối đều đọc được, không lỗi console.

### Bước 10 — Danh sách cơ hội (Màn 1)
### Bước 11 — Tạo / sửa cơ hội (Màn 2), cả hồ sơ yêu cầu và "Lưu thành mẫu"
### Bước 12 — Chi tiết cơ hội (Màn 3), nhãn Chủ tàu đã chọn, đóng / huỷ / nhân bản
### Bước 13 — Đề xuất và thêm ứng viên (Màn 4)
### Bước 14 — Bản xuất từ cơ hội (Màn 5) và gửi chủ tàu (Màn 6)
### Bước 15 — Chốt người (Màn 7)
### Bước 16 — Danh sách chuyến (Màn 8) và ghi rời nhiều chuyến
### Bước 17 — Tạo chuyến (Màn 9), cả Chuyển tàu và nhập chuyến cũ
### Bước 18 — Chi tiết chuyến (Màn 11), Ghi rời tàu, Đổi ngày rời, Sửa ngày đã ghi, Huỷ chốt / Xoá (Màn 12, 13, Đ4)
### Bước 19 — Thẻ Đội ngũ trên trang tàu (Màn 10)
### Bước 20 — Chuyến trên hồ sơ thuyền viên (Màn 14)

Mỗi bước 10–20 **xong khi:** màn khớp mục 5.5 và wireframe (trừ chỗ mục 5.1 nói khác); có trạng thái rỗng, đang tải, lỗi; ẩn nút theo quyền; mobile không cuộn ngang; lint, test, build frontend qua; kiểm trên app thật theo mục 9 phần của màn đó.

### Bước 21 — Kiểm cuối

- Toàn bộ lint, test, build backend và frontend.
- Chạy hết kịch bản mục 9 trên app thật, chụp màn hình từng màn.
- Đối chiếu dữ liệu đã chuyển (Bước 1) với màn: mở 3 chuyến cũ bất kỳ, so ngày, cảng, người, hợp đồng.
- **⛔ DỪNG:** báo người dùng kết quả, ảnh chụp, và các chỗ lệch với wireframe; chờ duyệt trước khi mở PR.

---

## 9. Kiểm tra trên app thật

Dùng dữ liệu mẫu (tạo bằng API hoặc seed dev): chủ tàu Đông Á Marine, tàu MV Lotus Star; chủ tàu Hải Phong Shipping, tàu MV Ocean Pride và MV Ocean Grace.

1. Tạo cơ hội Máy hai cho MV Lotus Star; hồ sơ yêu cầu tự điền; "Lưu & thêm vị trí khác" giữ tàu và ngày, tạo tiếp Thợ máy.
2. Đề xuất nhanh: thấy người đủ yêu cầu lên đầu; bỏ lọc "Đủ mục bắt buộc" thấy người thiếu; thêm 3 người.
3. Tạo bản xuất cho 2 người cùng lúc từ chi tiết cơ hội; ZIP có file giấy tờ và `THIEU-GIAY.txt` khi thiếu.
4. Gửi cho chủ tàu: tải 2 file, app mail mở đúng người nhận, tiêu đề, nội dung; bấm "Đã gửi" thì cột Gửi chủ tàu đổi, cơ hội "Chờ kết quả".
5. Gắn nhãn Chủ tàu đã chọn cho một người, rồi cho người khác: nhãn chuyển; cơ hội "Chủ tàu đã chọn"; người đó hiện "Đang giữ cho {mã}" ở đề xuất của cơ hội khác.
6. Chốt với ngày mai: bị chặn. Chốt hôm nay: có chuyến, thuyền viên "Đang trên tàu", cơ hội "Đã chốt".
7. Huỷ chốt: chuyến biến mất, cơ hội về "Chủ tàu đã chọn" / "Chờ kết quả", thuyền viên "Ở bờ".
8. Tạo chuyến tay lý do Chuyển tàu cho người đang trên MV Ocean Pride sang MV Ocean Grace: chuyến cũ "Đã rời tàu" cùng ngày, hai chuyến nối nhau trên hồ sơ.
9. Nhập chuyến cũ (bật "Chuyến đã kết thúc"); thử trùng thời gian thì bị chặn.
10. Ghi rời tàu sớm một người, toast có hai lối tắt; "Tạo cơ hội tìm người thay" mở form điền sẵn.
11. Đổi ngày rời dự kiến hai lần: lịch sử ghi hai lần, chênh lệch so với ngày gốc.
12. Trang MV Ocean Pride → Đội ngũ: biểu đồ đủ hàng, vạch hôm nay, hàng cơ hội đang mở nhạt; đổi sang Bảng ghi rời nhiều người.
13. Không còn nút Tạo hợp đồng ở đâu; mở `/contracts/new` thấy màn khoá. Mở một hợp đồng cũ: link sang chuyến đã chuyển đúng người, đúng tàu; duyệt một hợp đồng chờ duyệt cũ không còn câu hỏi chuyển Đang trên tàu; yêu cầu thanh toán cũ vẫn mở và sửa được như trước.
14. Người dùng vai trò có phạm vi "của mình" chỉ thấy cơ hội và chuyến mình tạo.

---

## 10. Việc còn mở (không làm, chỉ để biết)

- Giai đoạn 2 hợp đồng: nối `seafarer_contract` vào `seafarer_voyage` (dùng `legacy_contract_id` cho dữ liệu cũ), mở lại tạo hợp đồng từ chuyến; các màn Đ, Đ1–Đ3; hợp đồng Nháp tự tạo khi chốt / tạo chuyến; kết thúc sớm khi rời sớm; phụ lục; job hết hạn không chuyển Hết hạn khi người còn trên tàu.
- Thanh toán: thiết kế sau.
- Thẻ Đội ngũ trên trang chủ tàu.
- Sau giai đoạn 2: thôi dùng bảng `voyage`, `voyage_position` cũ và cột `seafarer_contract.voyage_position_id`, đổi tên `seafarer_voyage` nếu muốn.
- Nhắc người dùng: luồng "một thuyền viên rời tàu trước cả chuyến" hẹn ở giai đoạn 3 cũ đã nằm trong Ghi rời tàu của giai đoạn này; phần hợp đồng của nó thuộc giai đoạn 2.

---

## 11. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-10-26 | — | — | Lập kế hoạch từ wireframe bản 12. |
| 2026-10-26 | — | — | Người dùng chốt mục 2.3: khoá tạo hợp đồng mới tới giai đoạn 2, không nối lại. Chuyến mới ở bảng `seafarer_voyage`, bảng cũ giữ nguyên. |
| 2026-10-26 | 0 | (commit này) | DB dev: chuyến cũ 7 (PLANNING 5, ONBOARD 1, ENDED 1), 23 vị trí; hợp đồng chưa xoá 15 (ACTIVE 10, PENDING 3, REJECTED 1, ENDED 1); 8 hợp đồng ở chuyến PLANNING, 7 ở chuyến đã chạy; 0 chuyến thiếu cảng, 0 người trùng ONBOARD; 75 yêu cầu thanh toán; 3 thuyền viên ON_VESSEL. Không phải dừng. Nhánh `feature/co-hoi-chuyen` tách từ `feature/partner-fleet-contact-filters` (b731c75), không từ main, để giữ code đối tác mới và các file người dùng đang sửa dở (không commit các file đó). |
| 2026-10-26 | 1 | (commit này) | `023_opportunity_voyage.sql` chạy trên DB dev (đã thử trong transaction rồi rollback trước; dump trước khi chạy ở scratchpad). Kết quả: 23 cơ hội (17 OPEN, 6 WON), 6 chuyến mới (3 ONBOARD, 3 LEFT), 15 ứng viên (6 PLACED, 9 PICKED mang nhãn), `seafarer.status` không ai bị đổi, bảng cũ giữ nguyên số dòng. Khác kế hoạch: (1) chỉ hợp đồng ACTIVE/ENDED ở chuyến đã bắt đầu mới thành chuyến mới (đúng điều kiện cũ đặt ON_VESSEL); hợp đồng Chờ duyệt / Bị từ chối ở chuyến đang chạy thành ứng viên mang nhãn như chuyến chưa bắt đầu, nếu không sẽ có 1 người bị chuyển sai sang Đang trên tàu; (2) thêm `opportunity.legacy_position_id` để nối vị trí cũ; (3) bảng mẫu theo chức danh dùng cột `preset_rank_id` (vì `rank_id` đã là cột yêu cầu kinh nghiệm); (4) không chạy được trên DB sạch vì tài khoản DB không có quyền tạo database; (5) không vai trò nào ngoài admin có `voyage.create` nên chưa cấp thêm quyền cơ hội cho ai. Test backend 312 qua. |
| 2026-10-26 | 2 | (commit này) | `constants/opportunity_voyage.js`, `utils/opportunity_rules.js` (displayStatus, deadlineFlag, leaveFlag, neededUntil, requirementFit, experienceFromHistory, compareSuggestions, overlapsRange) + 12 test. Thêm `leaveFlag` và `experienceFromHistory` (kế hoạch nhắc ở mục 1.4, 1.6 nhưng chưa đặt tên). `suggestionScore` viết thành hàm so sánh `compareSuggestions`. Hằng số chưa có bản frontend (làm ở Bước 8). |
| 2026-10-26 | 3 | (commit này) | Quyền `opportunity.*` (45 quyền, 11 mục), `SCOPED_TABLES.opportunity`; `opportunity.service.js` + `opportunity.routes.js` (`/opportunities`: list, get, create, update, duplicate, close, reopen, delete) + 9 test; đã chạy thử từng hàm với DB dev (bản ghi thử đã xoá mềm). Khác kế hoạch: (1) API mẫu theo chức danh đặt dưới `/opportunities/requirement-presets/:rankId` cho gọn một file route, không phải `/rank-requirement-presets/:rankId`; (2) người phụ trách hiện bằng email vì bảng `user` không có cột tên; (3) `SCOPED_TABLES.voyage` chưa đổi sang `seafarer_voyage` (route chuyến cũ còn chạy tới Bước 6); (4) `get` đã trả `fit` của từng ứng viên (dùng chung `loadFitInputs` cho Bước 4). Ghi chú: 6 cơ hội chuyển từ dữ liệu cũ đang hiện ở tab Đang mở vì vừa cập nhật, sau 7 ngày tự sang tab Đã chốt. |
| 2026-10-26 | 4 | (commit này) | API ứng viên (thêm, bỏ, gắn / bỏ nhãn Chủ tàu đã chọn), đề xuất `GET /opportunities/:id/suggestions`, ghi nhận gửi `POST /:id/sends` + 5 test (14 test cơ hội); đã chạy thử trên DB dev, bản ghi thử đã dọn. Ghi chú: đề xuất lọc SQL trước rồi đối chiếu tối đa 500 người (`capped` báo khi chạm mức), sau đó mới xếp và chia trang 50; `reasons` trả `{ tone: good | miss, text }` để giao diện tô màu; phạm vi "của mình" của đề xuất theo phạm vi thuyền viên. `candidate_ids` khi ghi gửi là id dòng ứng viên (`opportunity_candidate.id`). Dữ liệu dev hầu hết chưa có số hộ chiếu nên đề xuất nhanh (bật "Đủ mục bắt buộc") chỉ ra 1 người. |
| 2026-10-26 | 5 | (commit này) | `POST /opportunities/:id/place` (cần `opportunity.close` và `voyage.view`) + 4 test (18 test cơ hội); chạy thử trên DB dev: ngày tương lai 400, người đang trên tàu khác 409, chốt thành công ra chuyến ONBOARD, cơ hội WON, ứng viên PLACED / NOT_SELECTED, thuyền viên ON_VESSEL; đã dọn bản ghi thử và trả trạng thái thuyền viên, mã CT-2026-0007 đã dùng cho bản thử nên chuyến thật tiếp theo bắt đầu từ 0008. Ngày rời dự kiến của chuyến = ngày rời của cơ hội, nếu sớm hơn ngày lên thì lấy ngày lên. Mã chuyến cấp theo năm của ngày lên tàu. |
| 2026-10-26 | 6 | (commit này) | Viết lại `voyage.service.js` / `voyage.routes.js` cho `seafarer_voyage`: danh sách (lọc khoảng thời gian, nguồn, sắp rời), chi tiết (cơ hội, chuyển từ / sang, hợp đồng cũ, lịch sử), tạo tay (Chuyển tàu tự đóng chuyến cũ), sửa ngày đã ghi, đổi ngày rời, ghi rời một / nhiều chuyến, huỷ chốt / xoá, thẻ Đội ngũ; bỏ start/end và code vị trí. `SCOPED_TABLES.voyage` → `seafarer_voyage`; sửa test phạm vi. 11 test chuyến mới. Chạy thử trên DB dev (chuyển tàu, đổi ngày rời, ghi rời, chặn xoá chuyến có hợp đồng cũ) rồi trả lại như cũ; mã CT-2026-0008 đã dùng cho bản thử. Khác kế hoạch: (1) thẻ Đội ngũ là `GET /voyages/crew-timeline?vessel_id=` thay cho `/vessels/:id/crew-timeline` để không phải sửa `fleet.routes.js` (route dựng kiểu builder); (2) xoá chuyến Chuyển tàu đang trên tàu thì mở lại chuyến trước nó; không cho xoá chuyến đã có chuyến chuyển tiếp. Lưu ý: frontend chuyến cũ (danh sách / chi tiết / form chuyến, form hợp đồng tạo từ vị trí) sẽ hỏng cho tới Bước 8. |
| 2026-10-26 | 7 | (commit này) | Phần backend: `POST /contracts` trả 409 "Tạm khoá tạo hợp đồng mới…" (service `create` giữ nguyên); bỏ `move_onboard` (route nhận body rỗng, service không đổi `seafarer.status`); hợp đồng (list, get) và yêu cầu thanh toán thêm `trip { id, code, status }` qua `seafarer_voyage.legacy_contract_id` (DB dev: 6/15 hợp đồng, 28/75 yêu cầu thanh toán có trip); `crew_overview` đọc tàu đang làm từ chuyến mới, hạn = hợp đồng cũ gắn với chuyến hoặc ngày rời dự kiến; `seafarer.service` lọc chức danh / tàu đã đi qua chuyến mới, câu báo tạm ngưng đổi chữ (giữ chặn hợp đồng cũ chưa kết thúc); `fleet.service` người đang trên tàu đọc chuyến mới, `vesselUsage` đếm cả chuyến mới và cơ hội. `voyage_position` chỉ còn trong service hợp đồng, yêu cầu thanh toán, chặn tạm ngưng. Phần frontend của mục 3.3 (ẩn nút tạo, link sang chuyến, bỏ câu hỏi khi duyệt) làm ở Bước 8 như kế hoạch. Sửa test duyệt hợp đồng, thêm test khoá tạo. |
| 2026-10-26 | 8 | (commit này) | `api/opportunityApi.js`, `hooks/useOpportunities.js`, `constants/opportunityVoyage.js`; `voyageApi` / `useVoyages` viết lại phần chuyến (+ `useCrewTimeline`); `statusMap` thêm nhóm `opportunity`, `candidate`, nhóm `voyage` đổi thành ONBOARD / LEFT. Hợp đồng: `ApproveModal` bỏ câu hỏi chuyển trạng thái; `/contracts/new` thành màn khoá; danh sách, chi tiết hợp đồng và yêu cầu thanh toán link sang chuyến mới qua `TripLink` (không có thì mã chuyến cũ dạng chữ); bỏ bộ lọc theo chuyến ở danh sách yêu cầu thanh toán (lọc theo id chuyến cũ, không còn chọn được). Hồ sơ: `voyageNow` đọc chuyến (`GET /voyages?seafarer_id=`), bỏ kiểu "Chuyến sắp tới". Ba màn chuyến cũ tạm thay bằng màn "đang dựng lại" (dựng lại ở Bước 16–18); bỏ `VoyageTransitionModal`, `VoyageParts`, route `/voyages/:id/edit`. Khác kế hoạch: mục Cơ hội trên sidebar, icon và route `/opportunities` để tới Bước 10 khi có trang, tránh mục menu dẫn vào trang trống. Kiểm tra: test frontend 176 qua, build qua; lint còn 1 lỗi có sẵn ở `fleet/OwnershipFields.jsx` (commit b731c75, không thuộc bước này). Chưa kiểm được trên trình duyệt: cần người dùng đăng nhập. `voyageView.js` (người dùng đang sửa dở 1 dòng chú thích) chưa đụng. |
| 2026-10-26 | 8 (kiểm) | (commit này) | Kiểm trên app thật ở `localhost:5173` (backend cổng 3000 chỉ cho CORS từ 5173; bản chạy ở 5174 bị chặn đăng nhập), đăng nhập bằng nút tài khoản demo: danh sách hợp đồng, chi tiết hợp đồng (link CT-2026-0004 kèm trạng thái chuyến), `/contracts/new` hiện màn khoá, danh sách yêu cầu thanh toán, màn chuyến tạm, hồ sơ thuyền viên (Tàu · Chuyến CT-2026-0004 · đến 15/06/2027) đều chạy, không lỗi console. Sửa thêm: bỏ bộ lọc "Tất cả chuyến" ở danh sách hợp đồng (cùng lý do như yêu cầu thanh toán). |
| 2026-10-26 | 9 | (commit này) | `components/ds`: `RequirementFit` (chip "8/8 bắt buộc" xanh / cam, "3/3 nên có" xám, `onOpen` thì thành nút, `short`), `CrewTimeline` + `CrewTimelineLegend` (5 kiểu thanh, cột tên dính trái, cuộn ngang, mỗi hàng là nút, rỗng thì `EmptyState`), hàm thuần `crewTimeline.js` `timelineLayout` + 3 test; `SlidePanel` thêm `size="wide"` (720px); `SeaServiceTimeline` nhận `source.type = "voyage"` (nút "Mở chuyến"). Trang `/design-system` thêm mục "Cơ hội và chuyến" (dữ liệu MV Ocean Pride như wireframe) và một chuyến nguồn "voyage" ở mục Chuyến đi tàu. Kiểm trên app: nhãn "Hôm nay" ban đầu đè chữ tháng rồi đè thanh, đã chuyển sang dải riêng dưới hàng tháng; panel rộng mở đúng 720px; không lỗi console. Test frontend 179, build qua. App chỉ có giao diện sáng nên không kiểm nền tối. |
| 2026-10-26 | 10 | (commit này) | `OpportunityListPage` theo khuôn danh sách hợp đồng: tab Đang mở / Đã chốt / Không thành / Huỷ / Tất cả, ô tìm, nút "Tạo cơ hội", hàng lọc Tàu / Chủ tàu / Chức danh, cột như mục 5.5, mobile dạng danh sách; `opportunityView.js` (`deadlineLabel`, `candidateSummary`) + 2 test. Thêm mục "Cơ hội" (icon `target`) trước "Chuyến tàu" ở sidebar, route `/opportunities`; sửa test sidebar. Kiểm trên app: 23 cơ hội đã chuyển hiện đúng, lọc chức danh chạy, màn 375px không cuộn ngang, không lỗi console. Khác kế hoạch: chưa có lọc Người phụ trách và Hạn chốt (cần danh sách tài khoản, mà quyền xem tài khoản thường chỉ admin có); nút Xem / Sửa trên dòng dẫn tới màn Bước 11–12 chưa có. |
| 2026-10-26 | 11 | (commit này) | `OpportunityFormPage` (tạo / sửa, `FormFrame` + `FormSection` như form chuyến cũ): khối Vị trí (chủ tàu theo tàu, tàu không bắt buộc, chức danh, budget/tháng ↔ cả chuyến tự tính theo ngày, người phụ trách), Thời gian dự kiến (bốn mốc, hạn chốt, ghi chú), Hồ sơ yêu cầu (`RequirementTable`: nhóm Giấy tờ / Chứng chỉ / Kinh nghiệm / Mẫu giấy, mức bằng `SegmentedPick`, mốc còn hạn, "Lưu thành mẫu cho {chức danh}"); tự điền theo tàu + chức danh, bảng có dòng thì hỏi trước khi thay; "Lưu & thêm vị trí khác"; sửa thì chip "Đã sửa" và đếm thay đổi; cơ hội đã đóng thì không cho sửa; nhận điền sẵn `?owner=&vessel=&rank=&join=`. Route `/opportunities/new`, `/opportunities/:id/edit`. Backend: lookup loại chứng chỉ trả thêm `category` để chia Giấy tờ / Chứng chỉ. 3 test hàm form. Kiểm trên app: tạo (budget cả chuyến tự ra 44.100), sửa thêm Hộ chiếu + mẫu CV và lưu mẫu cho Máy hai, tạo mới thì tự điền từ mẫu, "Lưu & thêm vị trí khác" ra toast "Đã tạo CH-2026-029 · Máy hai" và giữ chủ tàu, tàu; bản ghi thử và mẫu thử đã xoá. Ghi chú: người phụ trách chỉ chọn được khi có quyền xem tài khoản, không thì mặc định là người tạo; Enter ở ô ngày cuối gửi form (hành vi mặc định của form). |
| 2026-10-26 | 12 | (commit này) | `OpportunityDetailPage`: đầu trang (chức danh · tàu · mã, chủ tàu, người phụ trách, trạng thái, nhãn hạn chốt), menu "…" (Nhân bản cho vị trí khác → mở form sửa bản mới; Đóng · Không thành có ô lý do bắt buộc; Huỷ; Mở lại; Xoá khi chưa gửi), "Sửa cơ hội", "Mở chuyến {mã}" khi đã chốt; `DescriptionList` 6 dòng; bảng `CandidateTable` (chip "Chủ tàu đã chọn", trạng thái thuyền viên, `RequirementFit` bấm mở bảng đối chiếu từng mục, thiếu / sắp hết hạn, bản xuất, gửi chủ tàu, menu dòng đánh dấu / bỏ nhãn, mở hồ sơ, bỏ khỏi danh sách), chọn nhiều để bỏ khỏi danh sách; lịch sử gửi. Route `/opportunities/:id`. Kiểm trên app: CH-2026-015 bỏ nhãn → "Đang chọn ứng viên", gắn lại → "Chủ tàu đã chọn"; nhân bản thành CH-2026-030 rồi đóng Không thành (banner lý do), mở lại, xoá; CH-2026-013 đã chốt hiện "Mở chuyến CT-2026-0004". Chưa có (theo thứ tự kế hoạch): nút Đề xuất nhanh / Thêm ứng viên (Bước 13), Tạo bản xuất / Gửi chủ tàu (Bước 14), Chốt người (Bước 15). |
| 2026-10-26 | 13 | (commit này) | `CandidatePanel` (`SlidePanel size="wide"`): ô tìm (chờ 300ms), `FilterChips` Đủ mục bắt buộc / Chức danh / Rảnh trước ngày xuống / Đã làm cho chủ tàu ("Đề xuất nhanh" bật sẵn ba cái đầu, "Thêm ứng viên" tắt hết), danh sách `ListRow` có ô tích, chức danh · tuổi · đang ở đâu, chip lý do (xanh / cam), `RequirementFit` dạng ngắn, nhãn "Đã trong danh sách" (không tích được) và "Đang giữ cho CH-…", phân trang 20, báo khi chạm giới hạn 500; nút "Đề xuất nhanh" và "Thêm ứng viên" trên chi tiết cơ hội (và trong màn trống). Chưa làm bộ lọc loại tàu, quốc tịch, tuổi trên giao diện (API đã có). Kiểm trên app: CH-2026-015 bật đủ ba lọc ra 0 người (dữ liệu dev thiếu giấy), tắt bớt ra 11 người với nhãn giữ chỗ đúng, thêm Phan Anh Tuấn thành công; đã xoá dòng thử. |
| 2026-10-26 | 14 | (commit này) | Bản xuất gắn cơ hội: `POST /exports` nhận `opportunity_id` (chỉ ứng viên đang trong danh sách của cơ hội mở), ghi `opportunity_candidate.export_pack_id`; file zip thêm `GIAY-TO/` (hộ chiếu, sổ thuyền viên, chứng chỉ theo hồ sơ yêu cầu, lấy từ bản scan đã tải lên) và `THIEU-GIAY.txt`. `PackCreatePage` mở từ cơ hội (`?opportunity=&seafarers=`) chọn sẵn người, chủ tàu, tàu, mẫu giấy trong hồ sơ yêu cầu, banner nói giấy đính kèm, tạo nhiều người thì về lại cơ hội; `PackDetailPage` có đường dẫn cơ hội và nút "Gửi cho chủ tàu". Chi tiết cơ hội: thanh chọn nhiều thêm "Tạo bản xuất cho N người" (người chưa có) và "Gửi cho chủ tàu (N)" (người đã có), menu dòng "Tạo bản xuất" / "Gửi cho chủ tàu". Gửi (`useSendToOwner` + `sendToOwner.js`): lấy liên hệ chính có email, tải từng bộ về máy, mở app mail mặc định bằng `mailto:` điền sẵn tiêu đề / nội dung, hỏi "Đã gửi?" rồi ghi `opportunity_send`; chủ tàu chưa có email thì cảnh báo kèm nút mở trang đối tác. Kiểm trên app: CH-2026-020 chọn 2 người → tạo 2 bộ gắn đúng, quay về cơ hội, cột Bản xuất hiện ngày tạo; bấm gửi khi chủ tàu chưa có email ra cảnh báo; trang bộ giấy có đường dẫn CH-2026-020. Chưa bấm thử nhánh mở app mail trên trình duyệt (sẽ mở app mail thật trên máy), đã có test cho `buildMailto`. Đã xoá dữ liệu thử. |
| 2026-10-26 | 15 | (commit này) | `PlaceModal` (rộng 480): Người (ứng viên đang trong danh sách, người mang nhãn hiện "· chủ tàu đã chọn" và được chọn sẵn), Tàu (chỉ khi cơ hội chưa có tàu), Ngày xuống tàu (mặc định ngày dự kiến nếu không sau hôm nay, không thì hôm nay; chặn ngày sau hôm nay), Nơi xuống tàu (điền sẵn). Toast "Đã chốt {tên} · {mã chuyến}" có nút Mở chuyến. Nút chính "Chốt người" trên chi tiết cơ hội khi đang mở, có ứng viên và có quyền `opportunity.close`. Kiểm trên app: CH-2026-020 bấm Chốt chưa chọn người báo lỗi dưới ô; chốt Nguyễn Văn Hải ra CT-2026-0009, cơ hội "Đã chốt", nút đổi thành Mở chuyến, người còn lại "Không được chọn". Đã xoá dữ liệu thử. |
