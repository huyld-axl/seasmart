# Catoro — Testcase chạy tay: Người phụ trách

- Kế hoạch: `docs/catoro-ke-hoach-nguoi-phu-trach.md`. Wireframe: `docs/design/wireframes/nguoi-phu-trach.html`.
- Chuỗi: **Thuyền viên → Hợp đồng → Yêu cầu thanh toán**. Đối tác không có người phụ trách; cơ hội giữ trường sẵn có, ngoài chuỗi.
- Chạy trên app dev (web, 1440px) trừ nhóm G (375px). Cột Kết quả ghi: Đạt / Không đạt (kèm mô tả) / Chưa thử.

## Lần chạy 23/11/2026

Tự động: test service / route với pool giả (backend 655 test, frontend 519 test). Trên app dev (web 1300px và 375px): lọc Tôi ở Hợp đồng, đổi người phụ trách hợp đồng Hiệu lực rồi trả lại, đổi người phụ trách thuyền viên, form thuyền viên 375px, sheet lọc bill. Ca còn "Chưa thử" cần người làm (tài khoản phạm vi hẹp, tài khoản khoá, app máy tính).

## Chuẩn bị

- Bản sao DB trước migration 054 có: thuyền viên **PHƯỚC** do **LAN** tạo, có một hợp đồng Hiệu lực (tạo bởi **HUY**) với 3 bill; thuyền viên **NAM** nhập từ Excel trước đây, `created_by` trống.
- Tài khoản: **LAN**, **MINH**, **HUY** có `seafarer.*`, `opportunity.*`, `contract.*`, `bill.update`, `bill.approve`, phạm vi "tất cả". **HẸP** có các quyền đó nhưng phạm vi "chỉ của mình". **XEM** chỉ có quyền xem. **NGHỈ** là tài khoản đã khoá.

## A. Dữ liệu cũ (migration)

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| A1 | Chạy migration 054 trên bản sao DB | Không lỗi; in ra số thuyền viên / hợp đồng / bill còn trống | Đạt trên DB dev (thử trong transaction rồi áp; 56 thuyền viên, 5 hợp đồng, 28 bill chưa giao), chưa thử bản sao DB thật |
| A2 | Xem PHƯỚC, NAM | PHƯỚC: Lan. NAM: Chưa giao | Chưa thử |
| A3 | Xem hợp đồng của PHƯỚC và 3 bill | Hợp đồng: Lan (theo thuyền viên, không theo Huy tạo); 3 bill: Lan | Chưa thử |
| A4 | Hợp đồng của thuyền viên chưa giao | Hợp đồng = người tạo hợp đồng; bill theo hợp đồng | Chưa thử |
| A5 | Chạy lại lệnh migrate trên DB đã có | Không chạy lại, không đổi dữ liệu | Chưa thử |

## B. Mặc định khi tạo

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| B1 | LAN thêm thuyền viên mới | Mục Thông tin chung: ô Người phụ trách điền sẵn Lan; lưu được | Chưa thử |
| B2 | LAN thêm thuyền viên, xoá trống ô Người phụ trách, bấm Thêm | Lưu được, hồ sơ "Chưa giao" (không bắt buộc) | Chưa thử |
| B3 | MINH nhập thuyền viên bằng Excel | Các thuyền viên mới phụ trách là Minh | Chưa thử |
| B4 | Sửa NAM (chưa giao), không chọn người phụ trách, đổi trường khác, bấm Lưu | Lưu được, vẫn Chưa giao | Chưa thử |
| B5 | Cơ hội do HUY phụ trách, MINH chốt PHƯỚC (PIC Lan) | Hợp đồng nháp phụ trách **Lan**; thông báo ghi "Phụ trách: Trần Thị Lan"; cơ hội vẫn Huy | Chưa thử |
| B6 | Tạo tay hợp đồng cho chuyến của PHƯỚC | Ô điền sẵn Lan, đổi được | Chưa thử |
| B7 | Chốt một thuyền viên chưa giao | Hợp đồng phụ trách là người bấm chốt | Chưa thử |
| B8 | Đặt PIC của một thuyền viên là NGHỈ (bằng SQL), chốt người đó | Hợp đồng bỏ qua NGHỈ, giao cho người bấm chốt | Chưa thử |
| B9 | Duyệt hợp đồng phụ trách Lan (MINH duyệt) | Mọi bill sinh ra phụ trách Lan | Chưa thử |
| B10 | Tạo cơ hội mới | Ô Người phụ trách như cũ (mặc định là mình) | Chưa thử |

## C. Đổi không lan (không đổi kép)

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| C1 | Đổi PIC PHƯỚC Lan → Minh | Hợp đồng, bill đã có vẫn Lan. Hợp đồng PHƯỚC tạo **sau** đó mặc định Minh | Đạt phần hợp đồng đã có (app dev 23/11: đổi PIC thuyền viên, hợp đồng giữ người cũ); chưa thử tạo hợp đồng sau đó |
| C2 | Đổi PIC hợp đồng Hiệu lực Lan → Minh | PHƯỚC vẫn Lan (hoặc người đang phụ trách); 3 bill đã có vẫn Lan; hộp đổi ghi "Thuyền viên và 3 yêu cầu thanh toán đã có giữ người phụ trách của chúng" | Đạt (app dev 23/11: hợp đồng HĐ-2026-0057, bill kỳ 1 giữ người cũ; hộp đổi ghi "Thuyền viên và 7 yêu cầu thanh toán đã có…") |
| C3 | Tiếp C2: đưa hợp đồng về Nháp, kéo dài ngày kết thúc thêm 2 tháng, gửi duyệt, duyệt | Bill cũ giữ Lan; bill kỳ mới là Minh; bill cuối bị cắt / kéo dài giữ Lan | Đạt phần bill mới theo PIC hợp đồng (test tự động, pool giả); chưa thử trên app |
| C4 | Đổi PIC một bill Lan → Minh | Hợp đồng và các bill khác không đổi | Chưa thử |
| C5 | Đổi PIC cơ hội | Hợp đồng, thuyền viên không đổi | Chưa thử |

## D. Trạng thái và quyền

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| D1 | Đổi PIC thuyền viên tạm ngưng, hợp đồng Kết thúc | Được | Chưa thử |
| D2 | Đổi PIC bill Đã duyệt, Đã gửi, Đã thu | Được; số tiền, trạng thái, ngày duyệt không đổi | Chưa thử |
| D3 | LAN sửa số bill (chưa duyệt), MINH đổi PIC bill sang Minh, rồi MINH duyệt | Được (đổi PIC không tính là sửa); LAN tự duyệt vẫn bị chặn như cũ | Chưa thử |
| D4 | Thuyền viên có bộ giấy đang ký, đổi PIC thuyền viên | Bộ giấy **không** chuyển "Cần làm lại"; Lịch sử hồ sơ có dòng đổi người phụ trách | Đạt phần lịch sử hồ sơ (app dev); không còn luồng Cần làm lại khi sửa hồ sơ |
| D5 | XEM mở hồ sơ thuyền viên, chi tiết hợp đồng, bill | Thấy tên phụ trách, không có chữ Đổi | Chưa thử |
| D6 | XEM gọi `PUT /contracts/:id/pic` | 403 | Chưa thử |
| D7 | Gán PIC là NGHỈ qua API | 400 "Tài khoản không tồn tại hoặc đã khoá" | Đạt (test tự động) |
| D8 | Ô chọn người (tài khoản không có quyền xem tài khoản) | Mở được, liệt kê tài khoản đang hoạt động, không có NGHỈ | Chưa thử |
| D9 | Hộp đổi: chọn lại đúng người đang phụ trách | Nút Lưu mờ | Đạt (app dev) |
| D10 | Đổi PIC xong xem lịch sử hợp đồng, bill | Có dòng "Đổi người phụ trách: A → B", đúng người làm và giờ | Đạt hợp đồng (app dev: "Đổi người phụ trách", tên cũ gạch → tên mới); bill có test tự động |

## C2. Form sửa bill và bảng trả lương

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| C6 | Sửa bill chưa duyệt, chỉ đổi Người phụ trách, Lưu | Lịch sử bill chỉ có "Đổi người phụ trách", không có "Sửa số tiền"; người được giao tự duyệt được | Đạt (app dev 23/11, bill TT-2026-00384, đã trả lại) |
| C7 | Sửa bill, đổi cả số tiền và người phụ trách | Có cả "Sửa số tiền" và "Đổi người phụ trách" | Chưa thử |
| C8 | Bảng trả lương, cột Đối tác | Dòng Thu: tên người phụ trách bill ("—" khi chưa giao); dòng Chi: tên đối tác | Đạt (app dev, tháng 09/2026) |

## E. Phạm vi "chỉ của mình"

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| E1 | MINH đổi PIC một thuyền viên (do Lan tạo) sang HẸP | HẸP thấy thuyền viên trong danh sách, mở được hồ sơ, giấy tờ, chứng chỉ | Chưa thử |
| E2 | Như E1 với hợp đồng và bill | Thấy và mở được | Chưa thử |
| E3 | HẸP mở bản ghi khác không tạo, không phụ trách (gõ URL) | 404 | Chưa thử |
| E4 | MINH đổi PIC ở E1 về Lan | HẸP không còn thấy (trừ khi HẸP tạo) | Chưa thử |
| E5 | Bảng Trả lương của HẸP | Có dòng của bill HẸP phụ trách | Chưa thử |

## F. Danh sách và hiển thị

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| F1 | Danh sách Thuyền viên, Hợp đồng, Yêu cầu thanh toán | Có cột Phụ trách. Đối tác không có | Chưa thử |
| F2 | Lọc "Tôi" | Chỉ bản ghi mình phụ trách | Đạt hợp đồng (app dev: 44 → 39) |
| F3 | Lọc "Chưa giao" ở Thuyền viên | Có NAM | Chưa thử |
| F4 | Lọc theo người, rời trang rồi quay lại | Bộ lọc còn giữ | Chưa thử |
| F5 | Khoá tài khoản LAN, mở hồ sơ PHƯỚC | "Trần Thị Lan" kèm nhãn Đã khoá | Chưa thử |
| F6 | Tài khoản không có tên đầy đủ | Hiện email | Chưa thử |
| F7 | Tổng quan / Mục tiêu tháng trước và sau khi đổi PIC hợp đồng | Số không đổi | Chưa thử |

## G. Điện thoại (375px)

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| G1 | Bộ lọc Người phụ trách ở 3 danh sách | Mở trong sheet từ đáy; chọn được Tôi / Chưa giao / người | Đạt bill (app dev 375px) |
| G2 | Đầu trang hồ sơ thuyền viên, chi tiết hợp đồng, bill | Có Phụ trách + Đổi, không cuộn ngang | Chưa thử |
| G3 | Form thuyền viên, ô Người phụ trách ở Thông tin chung | Ô chọn cao 44px, không tràn | Đạt (app dev 375px) |
| G4 | Hộp đổi người phụ trách | Thành sheet từ đáy | Chưa thử |

## H. App máy tính

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| H1 | Cài bản mới trên máy chính có dữ liệu cũ | Nâng dữ liệu xong, A2–A4 đúng | Chưa thử |
| H2 | Máy nhân viên đổi PIC hợp đồng | Máy chính và máy khác thấy người mới sau khi tải lại | Chưa thử |
