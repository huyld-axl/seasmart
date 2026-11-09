# MCAH — Testcase tay: danh sách trên điện thoại

- **Plan:** `docs/mcah-ke-hoach-danh-sach-mobile.md` (bước 8).
- **Wireframe:** `docs/design/wireframes/danh-sach-mobile.html`.
- **Thiết bị:** một iPhone (Safari, iOS 16+) và một Android (Chrome). Cột Kết quả ghi `iOS: … / Android: …`. Case ghi "(desktop)" chạy trên Chrome 1440×900.
- **Mở trên điện thoại:** cấu hình preview `frontend-lan` (cổng 5174), mở `http://<IP máy dev>:5174`, đăng nhập tài khoản quản trị.
- **Dữ liệu cần có:** YCTT ở đủ các trạng thái Cần duyệt, Cần gửi, Đã gửi, Quá hạn, Đã thu; hợp đồng Hiệu lực còn ≤ 7 ngày, Chờ duyệt, Nháp chưa nhập tiền, Đã kết thúc; một chuyến quá hạn chưa ghi rời; một cơ hội quá hạn chốt; một thuyền viên có giấy tờ chờ duyệt; một chủ tàu tên dài (≥ 30 ký tự).
- **Lưu ý:** các nút Duyệt / Đánh dấu đã gửi / Ghi nhận đã thu ghi dữ liệu thật. Chỉ bấm trên bản ghi dùng để test, ghi lại mã để hoàn tác (Bỏ duyệt, Bỏ gửi, Bỏ ghi nhận).
- **Ghi kết quả:** Đạt / Không đạt + ghi chú ngắn.

## A. Chung

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| A1 | Mở lần lượt 7 danh sách, vuốt ngang ở đầu, giữa, cuối | Không trang nào trôi ngang ||
| A2 | Nhìn một thẻ bất kỳ ở mỗi danh sách | Mọi thông tin ngoài tên, dòng phụ, badge đều có nhãn nhỏ ở trên; không còn hàng chữ nối nhiều " · " ||
| A3 | Tìm thẻ có chủ tàu / tên tàu dài | Giá trị cắt "…" trong ô của nó, ô bên cạnh không bị đẩy ||
| A4 | Bấm vào phần thân một thẻ (tên, ô) | Mở đúng trang chi tiết ||
| A5 | Bấm nút ở chân một thẻ | Làm đúng việc của nút, **không** mở trang chi tiết ||
| A6 | Bật trình đọc màn hình (VoiceOver / TalkBack), lướt qua một thẻ | Đọc được "Mở … {mã}" rồi tới các nút riêng ||
| A7 | Đăng nhập vai trò chỉ xem, mở YCTT và Hợp đồng | Không thẻ nào có nút Duyệt, Gửi, Ghi nhận, Sửa nháp ||
| A8 | (desktop) Mở 7 danh sách ở 1440×900, so ảnh chụp trước khi làm | Giống nhau ||

## B. Lọc trạng thái

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| B1 | Mở danh sách YCTT | Trạng thái là hàng chip có số đếm, không còn ô "Trạng thái:" ||
| B2 | Vuốt hàng chip sang trái, bấm "Đã thu" | Hàng chip cuộn, danh sách đổi ngay, trang không cuộn ngang ||
| B3 | Mở từ Tổng quan link tới YCTT tab Quá hạn | Chip "Quá hạn" đang chọn và nằm trong khung nhìn ||
| B4 | Ở YCTT bấm nút lọc, chọn một chủ tàu | Sheet "Bộ lọc" có ô chủ tàu; đóng sheet thì nút lọc hiện số 1, danh sách chỉ còn chủ tàu đó ||
| B5 | Mở chi tiết một hợp đồng | Ô "Mục:" vẫn là ô chọn như cũ (không thành chip) ||

## C. Yêu cầu thanh toán

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| C1 | Xem thẻ Cần duyệt | Dòng đầu tên thuyền viên + "x.xxx USD"; dòng phụ "Kỳ a/b · TT-…"; 4 ô Tàu, Chủ tàu, Kỳ thu, Hạn thanh toán; nút "Duyệt" ||
| C2 | Bấm "Duyệt" trên bill test | (Theo mục 8 câu 2) hỏi xác nhận; đồng ý thì badge thành Cần gửi, nút thành "Đánh dấu đã gửi". Hoàn tác bằng Bỏ duyệt ở chi tiết ||
| C3 | Xem thẻ Quá hạn | Hạn thanh toán màu đỏ; dải đỏ "Quá hạn N ngày, chưa thu"; nút "Ghi nhận đã thu" ||
| C4 | Bấm "Ghi nhận đã thu" rồi Huỷ | Mở hộp chọn ngày thu; Huỷ thì không đổi gì ||
| C5 | Xem thẻ Đã thu | Không dải cảnh báo, không nút; ô cuối là "Đã thu ngày" (hoặc "Hạn thanh toán" nếu mục 8 câu 6 của plan chọn không) ||
| C6 | Mở YCTT từ trang chi tiết một chủ tàu | Thẻ không có ô Chủ tàu (đã lọc sẵn) ||
| C7 | Cuộn xuống cuối danh sách | Chân ghi số yêu cầu và tổng USD; nút "+" (nếu có) không che phân trang ||

## D. Hợp đồng

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| D1 | Xem thẻ Hiệu lực | Góc phải "+N USD/th" màu xanh; ô Tàu, Chủ tàu, Thời hạn (cả hàng, có số tháng); dải "Thu … − Chi … = +N USD/tháng" ||
| D2 | Xem thẻ Hiệu lực còn ≤ 7 ngày | Thời hạn màu cam "còn N ngày"; dải cam "Hết hạn sau N ngày" ||
| D3 | Xem thẻ có chênh lệch 0 và thẻ Nháp chưa nhập tiền | Số xám; dải tiền ghi "Chưa nhập tiền" với nháp ||
| D4 | Xem thẻ Chờ duyệt (tài khoản có quyền duyệt) | Hai nút "Duyệt" và "Từ chối" (đỏ) ||
| D5 | Bấm "Duyệt" rồi Huỷ; bấm "Từ chối" rồi Huỷ | Mỗi lần mở đúng hộp như trang chi tiết; Huỷ không đổi gì ||
| D6 | Bấm "Sửa nháp" trên thẻ Nháp | Mở form sửa hợp đồng ||
| D7 | Xem thẻ chênh lệch âm (nếu có) | Số màu đỏ có dấu "−" ||

## E. Cơ hội, Chuyến, Thuyền viên, Tàu, Đối tác

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| E1 | Cơ hội: xem thẻ Chủ tàu đã chọn | Tên là chức danh; ô "Người được chọn" có tên ứng viên ||
| E2 | Cơ hội: xem thẻ quá hạn chốt | Dải đỏ "Hạn chốt quá N ngày" ||
| E3 | Chuyến: xem chuyến quá hạn chưa ghi rời | Ô "Rời tàu dự kiến" đỏ; dải đỏ; nút "Ghi rời tàu" (nếu plan bước 5 làm được) ||
| E4 | Chuyến: bấm "Ghi rời tàu" rồi Huỷ | Mở đúng hộp ghi rời tàu; Huỷ không đổi gì ||
| E5 | Thuyền viên: xem người đang trên tàu và người có giấy tờ chờ duyệt | Ảnh 40px; ô "Tàu hiện tại"; dải cam "n giấy tờ chờ duyệt" ||
| E6 | Tàu, Đối tác: xem vài thẻ | Cùng khung thẻ; ô có nhãn (Chủ tàu, IMO / Quốc gia) ||
