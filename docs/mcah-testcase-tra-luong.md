# MCAH — Testcase chạy tay: Khoản tiền cố định và Trả lương thuyền viên

- Kế hoạch: `docs/mcah-ke-hoach-tra-luong.md`. Wireframe: `docs/design/wireframes/tra-luong.html`.
- Chạy trên app dev (web, 1440px) trừ nhóm E (375px). Cột Kết quả ghi: Đạt / Không đạt (kèm mô tả) / Chưa thử.

## Lần chạy 20/11/2026

Tự động: test service trên Postgres thật (DB dev, trong transaction rồi ROLLBACK, 45 kiểm tra), test HTTP qua máy chủ dev, thao tác trên app web (máy tính 1300px và điện thoại 375px). Sửa trong lần chạy: gõ tìm khi có số sửa bị hỏi "Bỏ số đã sửa?" và mất chữ; Thời gian chốt lệch 7 giờ (giờ UTC đọc như giờ máy); chân bảng dưới (điện thoại) nằm ngoài màn khi nội dung dài. Bản ghi trả lương tạo khi thử trên app đã xoá sau khi chạy. Ca còn "Chưa thử" cần người làm (quyền chỉ xem, hai máy cùng lúc, cài app).

## Chuẩn bị

- Bản sao DB trước migration 050 có: một hợp đồng **X** có hai khoản tự đặt tên (hằng tháng "Phụ cấp tàu dầu" thu 100 / chi 80, một lần "Phí làm thẻ" thu 30 / chi trống); một bill **Y** chưa duyệt có dòng điều chỉnh "Trừ 5 ngày" −250; một bill **Z** có dòng điều chỉnh +50.
- Tài khoản **KT** có `payout.view`, `payout.pay`, `bill.*`, `contract.*`; tài khoản **XEM** chỉ có `payout.view`; tài khoản **NGOÀI** có quyền "chỉ của mình" và không tạo hợp đồng nào bên dưới.
- Hợp đồng **A** (Hiệu lực) 15/10/2026 → 14/04/2027, kỳ phải thu chốt cuối tháng; khoản: Lương cơ bản thu 1,500 / chi 1,300; Phí dịch vụ thu 150 / chi trống; Khác (hằng tháng) thu 100 / chi 80; Vé máy bay đi thu 500 / chi 500; còn lại trống. Kỳ thanh toán Phải chi: ngày 15 tháng sau, gặp ngày nghỉ làm trước.
- Hợp đồng **B** (Hiệu lực) có kỳ kết thúc 25/10/2026 (chốt sổ 25), chưa nhập cột Phải chi.

## K. Khoản tiền cố định

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| K1 | Chạy migration 050 trên bản sao DB | Không lỗi. Hợp đồng X: Khác (hằng tháng) 100 / 80, Khác (một lần) 30 / trống; ghi chú hợp đồng có tên hai khoản cũ | Đạt (chạy thử trên DB local có dữ liệu giả rồi rollback, 20/11) |
| K2 | Sau migration, xem bill Y | Đủ 14 dòng; −250 đã trừ vào Khác (hằng tháng) rồi phần thiếu vào Lương cơ bản; tổng bill không đổi; ghi chú có "Trừ 5 ngày"; Y có tên trong danh sách migration in ra | Đạt (như K1; điều chỉnh âm lớn hơn tổng kỳ thì kỳ về 0, có thông báo) |
| K3 | Sau migration, xem bill Z | Khác (hằng tháng) +50, tổng không đổi | Đạt (như K1) |
| K4 | Form thêm / sửa hợp đồng | Hai nhóm 7 + 7 khoản cố định, có Khác (hằng tháng) và Khác (một lần); không có nút thêm khoản, ô tên, nút xoá | Đạt (app web, 20/11) |
| K5 | Chi tiết hợp đồng có khoản trống | Đủ 14 dòng, khoản trống hiện 0.00 | Đạt |
| K6 | Gọi API tạo hợp đồng có `custom_name` hoặc mã khoản lạ | 400 | Đạt (service + route) |
| K7 | Duyệt hợp đồng A lần đầu | Bill kỳ 1 đủ 14 dòng: số phải thu của hợp đồng, khoản trống là 0. Bill kỳ 2 trở đi: khoản một lần (Vé máy bay đi…) là 0 | Đạt (test tự động trên DB thật, rollback) |
| K8 | Sửa bill kỳ 2 của A | Đủ 14 ô; không có nhóm Điều chỉnh, nút thêm dòng; không gõ được số âm | Đạt (app web) |
| K9 | Giảm Lương cơ bản 1,500 → 1,450, lưu | Chip Đã sửa, số mặc định gạch ngang; tổng 1,700 | Chưa thử |
| K10 | Đặt Vé máy bay về ở kỳ cuối = 600, lưu | Lưu được; tổng kỳ cuối cộng 600 | Chưa thử |
| K11 | Gọi API sửa bill với số âm, hoặc dòng không có `item_code` | 400 | Đạt (HTTP 400) |
| K12 | Chi tiết bill | Luôn hai nhóm, đủ 14 dòng, kể cả 0; khối Số tiền không còn dòng Điều chỉnh | Đạt (app web) |
| K13 | Sửa ngày kết thúc hợp đồng muộn hơn, duyệt lại | Bill mới sinh đủ 14 dòng, khoản một lần 0 | Đạt (test tự động: bill sinh thêm đủ 14 khoản) |
| K14 | Form hợp đồng, sửa bill ở 375px | Không cuộn ngang trang | Chưa thử |

## A. Bảng trả lương và số mặc định

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| A1 | KT mở menu Trả lương | Tab Tất cả, chưa chọn tháng, bảng trống "Chọn tháng để xem bảng trả lương"; chọn 10/2026 thì hiện dữ liệu; menu nằm sau Yêu cầu thanh toán | Đạt (app web) |
| A2 | Xem các cột | Đủ 14 khoản chia hai nhóm Hằng tháng / Một lần, rồi Tổng; không có cột Hoa hồng, cột Điều chỉnh | Đạt |
| A3 | Xem dòng A kỳ 1 (15/10–31/10) | Thu: LCB 1,500, Phí DV 150, Khác (hằng tháng) 100, Vé đi 500, còn lại 0; tổng 2,250. Trả: LCB 1,300, Khác (hằng tháng) 80, Vé đi 500, còn lại 0; tổng 1,880 | Đạt (test tự động so với cột Phải chi trên mọi dòng tháng 10) |
| A4 | Đổi sang 11/2026, xem dòng A kỳ 2 | Vé đi 0 ở cả Thu và Trả; Thu 1,750, Trả 1,380 | Đạt (như A3) |
| A5 | Dòng B (10/2026) | Có trong tháng 10 (kết thúc 25/10). Trả toàn 0 | Chưa thử |
| A6 | Tháng mà không bill nào có khoản Phí visa | Cột Phí visa vẫn hiện, toàn 0 | Đạt |
| A7 | Hạn trả dòng A kỳ 1 | 13/11/2026 (15/11 là CN, làm trước) | Đạt |
| A8 | Trạng thái bill cạnh dòng Thu | Khớp nhãn ở màn Yêu cầu thanh toán | Đạt |
| A9 | Tìm theo tên thuyền viên, mã bill, số hợp đồng; lọc đối tác | Đúng dòng; đếm tab và chân bảng đổi theo | Đạt (tìm theo tên không dấu, mã bill; lọc đối tác) |
| A10 | Tab Tất cả / Chưa trả / Đã trả | Đếm đúng; không phân trang; chân bảng: Thu đã duyệt (bill đã duyệt trở đi) và Đã trả (dòng đã chốt) của tab đang xem | Đạt |
| A11 | Bill bị xoá mềm (sau khi sửa ngày hợp đồng) | Không có trong bảng | Đạt (test tự động) |
| A12 | Cuộn ngang bảng | Cột chọn + thuyền viên và cột Thao tác đứng yên | Đạt |

## B. Sửa và chốt từng dòng

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| B1 | Sửa LCB dòng A kỳ 1 thành 1,250 | Ô viền nhấn, chip Đã sửa; Tổng trả 1,830; chân bảng đổi ngay | Đạt |
| B2 | Gõ số âm vào bất kỳ ô nào | Không nhận | Đạt (ô không nhận số âm; API 400) |
| B3 | Gõ 200 vào Vé máy bay về (đang 0) | Nhận; tổng cộng 200 | Chưa thử |
| B4 | Bấm Bỏ sửa | Dòng về số trước khi sửa, hết chip | Chưa thử |
| B5 | Sửa rồi bấm Chốt | Không hỏi; toast có Hoàn tác; dòng thành Đã trả {hôm nay}, xám, ô khoá; chuyển sang tab Đã trả | Đạt |
| B6 | Mở lại trang | Số đã chốt còn nguyên (không quay về mặc định) | Đạt |
| B7 | Bấm Hoàn tác trên toast | Dòng về Chưa trả, giữ số đã chốt | Đạt (Hoàn tác trên toast) |
| B8 | Đặt trả lớn hơn thu rồi chốt | Chốt được, không cảnh báo | Chưa thử |
| B9 | Chốt dòng có bill Chưa duyệt | Chốt được | Đạt |

## C. Chốt hàng loạt

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| C1 | Không chọn dòng nào | Nút "Chốt … dòng đã chọn" tắt | Đạt |
| C2 | Bấm ô chọn ở đầu bảng | Chọn mọi dòng Chưa trả của trang; dòng Đã trả không chọn được | Đạt |
| C3 | Chọn 2 dòng (một dòng đang sửa), bấm Chốt | Hộp: số dòng, tổng trả theo số đang hiện, ngày trả hôm nay; có dải nếu có bill chưa thu | Đạt |
| C4 | Xác nhận | Cả 2 dòng Đã trả; dòng đang sửa lưu đúng số đã sửa | Đạt |
| C5 | Chọn 3 dòng; trong lúc đó người khác chốt 1 dòng; bấm Chốt | Báo lỗi nêu tên dòng đó; không dòng nào được chốt | Đạt (test tự động: lô có dòng đã chốt → 409, không ghi dòng nào) |

## D. Huỷ chốt, rời trang, quyền

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| D1 | Menu ⋯ → Huỷ chốt trên dòng đã trả | Hộp một dòng; xác nhận → Chưa trả, giữ số, sửa được lại | Đạt |
| D2 | Huỷ chốt rồi sửa cột Phải chi hợp đồng (về Nháp, sửa, duyệt lại) | Dòng đó vẫn giữ số đã lưu | Đạt (test tự động) |
| D3 | Dòng chưa chốt lần nào, sửa cột Phải chi hợp đồng | Dòng Trả đổi theo mặc định mới | Đạt (test tự động) |
| D4 | Còn ô Đã sửa, đổi tháng / đổi tab / bấm menu khác | Hỏi "Bỏ số đã sửa?"; Ở lại giữ nguyên | Đạt (chỉ đổi tháng mới hỏi; đổi tab, tìm, lọc giữ số sửa — sửa 20/11) |
| D5 | Còn ô Đã sửa, tải lại trang | Hộp mặc định của trình duyệt | Chưa thử |
| D6 | XEM mở trang | Thấy bảng; dòng Trả chỉ xem; không có ô chọn, nút Chốt, cột Thao tác | Chưa thử |
| D7 | XEM gọi `POST /api/v1/payouts/pay` | 403 | Đạt (test route) |
| D8 | NGOÀI mở trang | Không thấy dòng của người khác; gọi pay bằng bill_id người khác → 404 | Đạt (test service + route) |
| D9 | Hai tab cùng chốt một dòng | Một thành công, một 409 | Đạt (test tự động: 409) |
| D10 | Tab 1 huỷ chốt, tab 2 (đang mở cũ) huỷ chốt | Tab 2 nhận xung đột phiên bản, tải lại | Đạt (test tự động: sai phiên bản → 409) |
| D11 | Gọi pay thiếu mã khoản hoặc có mã lạ | 400 | Đạt (HTTP 400) |

## E. Điện thoại (375px, bản web)

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| E1 | Mở Trả lương | Thẻ: tên, chức danh, bill, đối tác, Thu / Trả, trạng thái; không cuộn ngang trang | Đạt (375px, không cuộn ngang) |
| E2 | Bấm thẻ chưa trả | Bảng dưới đủ 14 khoản hai nhóm, mỗi khoản ô Trả và gợi ý Thu; cuộn được; Chốt đã trả | Đạt (sửa 20/11: chân bảng dưới bị đẩy ra ngoài màn) |
| E3 | Sửa số, đóng bảng dưới | Thẻ có dải Đã sửa, số mới | Chưa thử |
| E4 | Chốt trong bảng dưới | Thẻ Đã trả; bảng dưới đóng | Đạt |
| E5 | Thẻ đã trả | Bảng dưới chỉ xem, nút Huỷ chốt | Đạt |

## F. Ảnh hưởng luồng khác

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| F1 | Sửa số tiền bill (đã Bỏ duyệt) sau khi chốt trả lương | Sửa được; dòng Thu đổi; chip "Bill đổi sau khi chốt", rê chuột thấy tổng lúc chốt | Đạt (test tự động) |
| F2 | Sửa lại bill về đúng tổng lúc chốt | Hết chip | Chưa thử |
| F3 | Gửi / Thu / Thu hồi / Huỷ ghi nhận thu bill đã trả lương | Không bị chặn; trạng thái trả lương không đổi | Đạt (code: luồng bill không đọc bản ghi trả lương) |
| F4 | Hợp đồng A: Đưa về Nháp, sửa ngày bắt đầu, lưu — bill kỳ 1 đã trả lương (bill còn OPEN) | Chặn, liệt kê CH…/T1 "Đã trả lương", hướng dẫn Huỷ chốt trả lương | Đạt (test tự động: 409 nêu "đã trả lương") |
| F5 | Sửa ngày kết thúc sớm, bill bị cắt đã trả lương | Chặn khi lưu và khi duyệt lại | Chưa thử |
| F6 | Sửa ngày kết thúc sớm, chỉ kỳ không bị đụng đã trả lương | Duyệt lại được; bản ghi trả lương giữ nguyên | Chưa thử |
| F7 | Huỷ chốt bill ở F4 rồi duyệt lại hợp đồng | Duyệt được; bill sinh lại, dòng Trả mới theo mặc định | Đạt (test tự động: huỷ chốt thì không còn chặn) |
| F8 | Chi tiết bill đã trả lương / chưa trả | Dòng "Trả lương: Đã trả {ngày} · {số} USD" / "Chưa trả"; link mở đúng tháng | Đạt (app web, link mở đúng tháng) |
| F9 | Ghi rời tàu khi có bill đã trả lương | Không đổi gì ở Trả lương | Chưa thử |

## G. Dữ liệu và build

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| G1 | Chạy migration 051 trên DB hiện có | Không lỗi; vai trò có `bill.collect` có thêm hai quyền mới | Đạt (DB local) |
| G2 | Ma trận vai trò | Có nhóm "Trả lương" với hai quyền | Chưa thử |
| G3 | Hướng dẫn trong app | Mục "Trả lương thuyền viên" sau "Yêu cầu thanh toán", lọc Kế toán thấy; mục Yêu cầu thanh toán không còn nhắc dòng điều chỉnh | Chưa thử |
| G4 | `npm run dist:linux` | Build thành công, mở app thấy menu Trả lương | Chưa thử |
