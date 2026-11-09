# MCAH — Testcase tay: danh sách trên điện thoại

- **Plan:** `docs/mcah-ke-hoach-danh-sach-mobile.md` (bước 8).
- **Wireframe:** `docs/design/wireframes/danh-sach-mobile.html`.
- **Thiết bị:** một iPhone (Safari, iOS 16+) và một Android (Chrome). Cột Kết quả ghi `iOS: … / Android: …`. Case ghi "(desktop)" chạy trên Chrome 1440×900.
- **Mở trên điện thoại:** cấu hình preview `frontend-lan` (cổng 5174), mở `http://<IP máy dev>:5174`, đăng nhập tài khoản quản trị.
- **Dữ liệu cần có:** YCTT ở đủ các trạng thái Cần duyệt, Cần gửi, Đã gửi, Quá hạn, Đã thu; hợp đồng Hiệu lực còn ≤ 7 ngày, Chờ duyệt, Nháp chưa nhập tiền, Đã kết thúc; một chuyến quá hạn chưa ghi rời; một cơ hội quá hạn chốt; một thuyền viên có giấy tờ chờ duyệt; một chủ tàu tên dài (≥ 30 ký tự).
- **Lưu ý:** các nút Duyệt / Đánh dấu đã gửi / Ghi nhận đã thu ghi dữ liệu thật. Chỉ bấm trên bản ghi dùng để test, ghi lại mã để hoàn tác (Bỏ duyệt, Bỏ gửi, Bỏ ghi nhận).
- **Ghi kết quả:** Đạt / Không đạt + ghi chú ngắn.

## Chạy trước bằng giả lập (09/11/2026)

Chạy tự động trên Chrome giả lập 390×844 và 360×740 (cộng 700px và 1440px cho A8), chỉ đọc: không Duyệt, không Đánh dấu đã gửi, không Ghi nhận đã thu, không lưu. Hộp xác nhận / hộp thoại mở rồi Huỷ; "Sửa nháp" chỉ chuyển trang. Cột Kết quả bên dưới ghi `GL: …` cho lượt giả lập; ô trống là chưa chạy.

- **Đạt trên giả lập:** A1, A2, A3, A4, A5, A6 (nhãn đọc được, chưa nghe bằng trình đọc màn hình thật), A8; B1–B5; C1, C3, C4, C5, C6, C7; D1, D3, D4, D5, D6; E1, E2, E3, E4, E6.
- **Sửa trong lượt này:** tiêu đề thẻ danh mục dài bị cắt "…" ở 360px (A3) → tiêu đề thẻ xuống tối đa 2 dòng.
- **Phải chạy trên máy thật:** A6 (VoiceOver / TalkBack).
- **Cần dữ liệu hoặc tài khoản khác, chưa chạy được:** A7 (cần vai trò chỉ xem); C2 (Duyệt bill thật: chỉ kiểm hộp xác nhận mở / Huỷ, chưa bấm Duyệt); D2 (cần hợp đồng Hiệu lực còn ≤ 7 ngày: dev không có, đã có test đơn vị cho ngưỡng); D7 (cần hợp đồng chênh lệch âm: dev không có); E5 (cần thuyền viên có giấy hết hạn / sắp hết hạn / chờ duyệt: dev không có, đã có test đơn vị `seafarerAlert`); thẻ YCTT "Cần gửi" (dev 0 bill).

## A. Chung

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| A1 | Mở lần lượt 7 danh sách, vuốt ngang ở đầu, giữa, cuối | Không trang nào trôi ngang | GL: Đạt. 8 trang thẻ ở 390 và 360px, `scrollWidth` bằng bề rộng màn; 700px cũng không tràn |
| A2 | Nhìn một thẻ bất kỳ ở mỗi danh sách | Mọi thông tin ngoài tên, dòng phụ, badge đều có nhãn nhỏ ở trên; không còn hàng chữ nối nhiều " · " | GL: Đạt. Mọi ô ngoài tên, dòng phụ, badge có nhãn `dt`; không còn hàng chữ nối nhiều " · " |
| A3 | Tìm thẻ có chủ tàu / tên tàu dài | Giá trị cắt "…" trong ô của nó, ô bên cạnh không bị đẩy | GL: Đạt sau khi sửa. Ô giá trị xuống tối đa 2 dòng; tiêu đề xuống tối đa 2 dòng, không bị cắt ở 360px |
| A4 | Bấm vào phần thân một thẻ (tên, ô) | Mở đúng trang chi tiết | GL: Đạt. Bấm phần thân thẻ mở đúng trang chi tiết ở 7 danh sách |
| A5 | Bấm nút ở chân một thẻ | Làm đúng việc của nút, **không** mở trang chi tiết | GL: Đạt. "Sửa nháp" đi tới /contracts/:id/edit (không phải trang chi tiết); Duyệt, Từ chối, Ghi nhận đã thu, Ghi rời tàu chỉ mở hộp, trang không đổi |
| A6 | Bật trình đọc màn hình (VoiceOver / TalkBack), lướt qua một thẻ | Đọc được "Mở … {mã}" rồi tới các nút riêng | GL: nhãn nút phủ "Mở …" đủ ở mọi thẻ; chưa nghe bằng trình đọc màn hình thật |
| A7 | Đăng nhập vai trò chỉ xem, mở YCTT và Hợp đồng | Không thẻ nào có nút Duyệt, Gửi, Ghi nhận, Sửa nháp ||
| A8 | (desktop) Mở 7 danh sách ở 1440×900, so ảnh chụp trước khi làm | Giống nhau | GL: Đạt. 1440px: 8 trang vẫn là bảng, 0 thẻ, 0 chip |

## B. Lọc trạng thái

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| B1 | Mở danh sách YCTT | Trạng thái là hàng chip có số đếm, không còn ô "Trạng thái:" | GL: Đạt. YCTT 7 chip có số đếm, 0 ô "Trạng thái:" |
| B2 | Vuốt hàng chip sang trái, bấm "Đã thu" | Hàng chip cuộn, danh sách đổi ngay, trang không cuộn ngang | GL: Đạt. Bấm "Đã thu" đổi danh sách ngay, trang không tràn |
| B3 | Mở từ Tổng quan link tới YCTT tab Quá hạn | Chip "Quá hạn" đang chọn và nằm trong khung nhìn | GL: Đạt. Mở trực tiếp ?tab=OVERDUE thì chip "Quá hạn" đang chọn và nằm trong khung nhìn |
| B4 | Ở YCTT bấm nút lọc, chọn một chủ tàu | Sheet "Bộ lọc" có ô chủ tàu; đóng sheet thì nút lọc hiện số 1, danh sách chỉ còn chủ tàu đó | GL: Đạt. Sheet có ô Chủ tàu; chọn một chủ tàu thì "Xoá lọc" bật, bấm thì tắt; chân ghi "Xem 1 yêu cầu" |
| B5 | Mở chi tiết một hợp đồng | Ô "Mục:" vẫn là ô chọn như cũ (không thành chip) | GL: Đạt. Chi tiết hợp đồng vẫn ô "Mục:", 0 chip |

## C. Yêu cầu thanh toán

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| C1 | Xem thẻ Cần duyệt | Dòng đầu tên thuyền viên + "x.xxx USD"; dòng phụ "Kỳ a/b · TT-…"; 4 ô Tàu, Chủ tàu, Kỳ thu, Hạn thanh toán; nút "Duyệt" | GL: Đạt. Thẻ Cần duyệt: tên + "1.900 USD", "Kỳ 2/6 · TT-…", 4 ô Tàu / Chủ tàu / Kỳ thu / Hạn thanh toán, nút "Duyệt" |
| C2 | Bấm "Duyệt" trên bill test | (Theo mục 8 câu 2) hỏi xác nhận; đồng ý thì badge thành Cần gửi, nút thành "Đánh dấu đã gửi". Hoàn tác bằng Bỏ duyệt ở chi tiết | GL: một phần. Bấm "Duyệt" mở hộp xác nhận "Duyệt TT-…?" kèm tên và số tiền; Huỷ thì không đổi (số Cần duyệt vẫn 77). Chưa bấm Duyệt thật |
| C3 | Xem thẻ Quá hạn | Hạn thanh toán màu đỏ; dải đỏ "Quá hạn N ngày, chưa thu"; nút "Ghi nhận đã thu" | GL: Đạt. Hạn màu đỏ, dải "Quá hạn 272 ngày, chưa thu", nút "Ghi nhận đã thu" |
| C4 | Bấm "Ghi nhận đã thu" rồi Huỷ | Mở hộp chọn ngày thu; Huỷ thì không đổi gì | GL: Đạt. Mở hộp "Ghi nhận đã thu TT-…?" có ô Ngày thu; Huỷ thì không đổi |
| C5 | Xem thẻ Đã thu | Không dải cảnh báo, không nút; ô cuối là "Đã thu ngày" (hoặc "Hạn thanh toán" nếu mục 8 câu 6 của plan chọn không) | GL: Đạt. Không dải, không nút; ô cuối "Đã thu ngày" |
| C6 | Mở YCTT từ trang chi tiết một chủ tàu | Thẻ không có ô Chủ tàu (đã lọc sẵn) | GL: Đạt. Tab Yêu cầu thanh toán của chủ tàu: thẻ chỉ có Tàu / Kỳ thu / Hạn thanh toán |
| C7 | Cuộn xuống cuối danh sách | Chân ghi số yêu cầu và tổng USD; nút "+" (nếu có) không che phân trang | GL: một phần. Chân ghi "1–1 / 1 yêu cầu · Tổng 1.900,00 USD"; chưa kiểm nút "+" ở cuối danh sách dài |

## D. Hợp đồng

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| D1 | Xem thẻ Hiệu lực | Góc phải "+N USD/th" màu xanh; ô Tàu, Chủ tàu, Thời hạn (cả hàng, có số tháng); dải "Thu … − Chi … = +N USD/tháng" | GL: Đạt. "+250 USD/th" xanh; Tàu, Chủ tàu, Thời hạn cả hàng kèm "7 tháng"; dải "Thu 1.900 − Chi 1.650 = +250 USD/tháng" |
| D2 | Xem thẻ Hiệu lực còn ≤ 7 ngày | Thời hạn màu cam "còn N ngày"; dải cam "Hết hạn sau N ngày" ||
| D3 | Xem thẻ có chênh lệch 0 và thẻ Nháp chưa nhập tiền | Số xám; dải tiền ghi "Chưa nhập tiền" với nháp | GL: Đạt. Số "0 USD/th" xám, dải "Chưa nhập tiền" (hợp đồng Hiệu lực và Đã kết thúc không có tiền) |
| D4 | Xem thẻ Chờ duyệt (tài khoản có quyền duyệt) | Hai nút "Duyệt" và "Từ chối" (đỏ) | GL: Đạt. Thẻ Chờ duyệt có "Duyệt" và "Từ chối" |
| D5 | Bấm "Duyệt" rồi Huỷ; bấm "Từ chối" rồi Huỷ | Mỗi lần mở đúng hộp như trang chi tiết; Huỷ không đổi gì | GL: Đạt. Mở hộp Duyệt (đang chặn vì có bill đã gửi) và hộp Từ chối rồi Huỷ; số Chờ duyệt vẫn 4 |
| D6 | Bấm "Sửa nháp" trên thẻ Nháp | Mở form sửa hợp đồng | GL: Đạt. "Sửa nháp" mở /contracts/:id/edit |
| D7 | Xem thẻ chênh lệch âm (nếu có) | Số màu đỏ có dấu "−" ||

## E. Cơ hội, Chuyến, Thuyền viên, Tàu, Đối tác

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| E1 | Cơ hội: xem thẻ Chủ tàu đã chọn | Tên là chức danh; ô "Người được chọn" có tên ứng viên | GL: Đạt. Cơ hội Chủ tàu đã chọn: ô "Người được chọn"; chưa chọn: ô "Ứng viên" |
| E2 | Cơ hội: xem thẻ quá hạn chốt | Dải đỏ "Hạn chốt quá N ngày" | GL: Đạt. Dải đỏ "Hạn chốt quá N ngày" |
| E3 | Chuyến: xem chuyến quá hạn chưa ghi rời | Ô "Rời tàu dự kiến" đỏ; dải đỏ; nút "Ghi rời tàu" (nếu plan bước 5 làm được) | GL: Đạt. Ngày rời đỏ, dải đỏ "Quá 7 ngày chưa rời", nút "Ghi rời tàu"; chuyến sắp rời: dải cam "Còn 5 ngày" |
| E4 | Chuyến: bấm "Ghi rời tàu" rồi Huỷ | Mở đúng hộp ghi rời tàu; Huỷ không đổi gì | GL: Đạt. Mở hộp "Ghi rời tàu · …" rồi Huỷ; không đổi |
| E5 | Thuyền viên: xem người đang trên tàu và người có giấy tờ chờ duyệt | Ảnh 40px; ô "Tàu hiện tại"; dải cam "n giấy tờ chờ duyệt" | GL: chưa chạy được (không có thuyền viên có giấy hết hạn / chờ duyệt ở dev). Ảnh đại diện 40px và ô "Tàu hiện tại" đạt |
| E6 | Tàu, Đối tác: xem vài thẻ | Cùng khung thẻ; ô có nhãn (Chủ tàu, IMO / Quốc gia) | GL: Đạt. Tàu: Chủ tàu / IMO / Cờ; Đối tác: logo + Quốc gia; cùng khung thẻ |
