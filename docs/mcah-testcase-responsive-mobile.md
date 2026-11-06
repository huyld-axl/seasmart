# MCAH — Testcase tay: giao diện điện thoại

- **Plan:** `docs/mcah-ke-hoach-responsive-mobile.md` (bước 13).
- **Wireframe:** `docs/design/wireframes/responsive-mobile.html`.
- **Thiết bị:** chạy mỗi case trên **hai máy thật**: một iPhone (Safari, iOS 16+) và một Android (Chrome). Cột Kết quả ghi `iOS: … / Android: …`. Case ghi "(desktop)" thì chạy trên Chrome máy tính 1440×900.
- **Chuẩn bị:** máy dev và điện thoại cùng mạng LAN, mở app bằng IP máy dev. Đăng nhập tài khoản quản trị. Dữ liệu cần có: một thuyền viên tên dài (≥ 30 ký tự) có ảnh, ≥ 5 chứng chỉ trong đó 1 hết hạn; một hợp đồng có ≥ 3 khoản tiền và chủ tàu tên dài; một YCTT ở trạng thái Cần duyệt; một chuyến đang trên tàu.
- **Cách kiểm cuộn ngang:** vuốt ngang ở giữa trang; trang không được trôi sang bên. Kiểm thêm bằng Chrome DevTools (thiết bị iPhone 12, 390px và Galaxy S8, 360px): `document.documentElement.scrollWidth === innerWidth`.
- **Ghi kết quả:** Đạt / Không đạt + ghi chú ngắn.

## Chạy trước bằng giả lập (06/11/2026)

Chạy tự động trên Chrome giả lập iPhone 12 (390×844) và Galaxy S8 (360×740), chỉ đọc (không lưu, duyệt, ghi, xoá). Cột Kết quả bên dưới vẫn để trống cho lượt chạy trên máy thật.

- **Đạt trên cả hai giả lập:** A1, A3 (cỡ chữ ô gõ, chưa phải hành vi phóng to thật), A4, A6, B1–B6, C1–C5, C9 (chạm nền mờ), C10–C13, D1–D3, E1–E4, E8, E9, E11, F1, F4, F6, F7, G1–G6, G8, H1, H4, H5, I1, I5, I6, J1. A7, A8 (desktop) đạt ở bước 11.
- **Sửa trong lượt này:** 3 nút Quét ở Giấy tờ tùy thân rớt 2 + 1 (A6) → xếp dọc; nút tròn "+" che nút "›" sang trang ở cuối danh sách (C3, C10) → trang có nút tròn chừa đáy; chặng của thanh tiến trình Cơ hội cao 20px, nút ">" 28px, nút chọn Bắt buộc / Nên có 24px, nút xoá ngày 32px (A4) → đủ 40px; ô ngày điện thoại chọn Đến trước Từ vẫn nhận nếu bảng ngày của máy không chặn (D3, D7) → kiểm lại sau khi chọn, báo "Chọn từ … trở đi".
- **G2:** số thay đổi hiện bên trái thanh lưu ("3 thay đổi"), không nằm trong nút; đã ghi là lệch có chủ ý ở bước 9.
- **Phải chạy trên máy thật:** A2, A3 (trang có tự phóng to không), A5 (xoay ngang), C3 (thanh Home iPhone), C9 (kéo tay kéo), G9, G11, H2 (bàn phím), E7 (mở ứng dụng gọi / Zalo), J2, J3 (thêm ra màn hình chính).
- **Chưa chạy được vì ghi dữ liệu hoặc thiếu dữ liệu dev:** D4, D5, D8, E10, F3, F8, G7 (lưu thật); C14 (cần vai trò chỉ xem); E5, E6 (DB dev không có thuyền viên có ảnh), E7 (không có thuyền viên có số điện thoại), E12, F5 (tàu 21 chưa có thuyền viên), H3 (cần hợp đồng chờ duyệt), I2 (không có giấy chờ duyệt). Chưa tự động: C6–C8, D6, F2, G10, H6, I3, I4, I7.

**Mở trên điện thoại:** máy dev và điện thoại cùng Wi-Fi; trên máy dev chạy cấu hình preview `frontend-lan` (cổng 5174, gọi API qua chính dev server, có nút "Nhập nhanh TK demo"); trên điện thoại mở `http://<IP máy dev>:5174`. Tường lửa của máy dev phải mở cổng 5174.

## A. Chung cho mọi trang

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| A1 | Mở lần lượt mọi route ở mục 5 của plan, vuốt ngang ở đầu, giữa, cuối trang | Không trang nào trôi ngang. Bảng nhiều cột (nếu còn) chỉ cuộn trong khung của nó và cột đầu đứng yên ||
| A2 | Chạm vào ô tìm kiếm ở danh sách Thuyền viên | Bàn phím mở, **trang không tự phóng to** ||
| A3 | Chạm lần lượt vào ô nhập, ô chọn, ô ngày, ô ghi chú ở form Sửa thuyền viên | Không lần nào trang tự phóng to ||
| A4 | Bấm mọi nút icon ở một trang chi tiết (⋯, gọi, Zalo, sao chép) bằng ngón cái | Bấm trúng ngay lần đầu, không trúng nút bên cạnh ||
| A5 | Xoay ngang điện thoại ở danh sách và trang chi tiết | Không vỡ, không cuộn ngang; quay lại dọc thì bố cục về như cũ ||
| A6 | Tìm cụm nút ở mọi trang chi tiết và dialog | Không cụm nào có 2 nút một hàng, 1 nút hàng dưới ||
| A7 | (desktop) Mở 8 danh sách, 6 trang chi tiết, form Thuyền viên ở 1440×900, so ảnh chụp trước khi làm | Giống nhau ||
| A8 | (desktop) Thu cửa sổ từ 1440 xuống 640 | Không có bề rộng nào mà trang cuộn ngang hoặc nút xuống dòng chữ ||

## B. Khung app

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| B1 | Mở Quản trị → Mục tiêu tháng | Topbar ghi "Mục tiêu tháng", không ghi "Quản trị /", không bị cắt ||
| B2 | Nhìn góc phải topbar | Chuông và avatar, không có mũi tên; mỗi nút bấm được bằng ngón cái ||
| B3 | Bấm ☰ | Ngăn kéo mở từ trái, mục đang xem được tô; mục Quản trị mở sẵn trang con ||
| B4 | Nhìn đáy ngăn kéo | Có email, vai trò, nút Đăng xuất, link Dùng MCAH trên điện thoại ||
| B5 | Bấm một mục trong ngăn kéo | Sang trang đó, ngăn kéo tự đóng ||
| B6 | Mở trang có Hướng dẫn (Hợp đồng) | Link Hướng dẫn chỉ còn icon, tiêu đề vẫn đọc hết ||

## C. Trang danh sách

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| C1 | Mở Thuyền viên | Thanh công cụ 2 tầng: (ô tìm, nút Lọc, ⋯) và (ô Trạng thái). Thấy ít nhất 6 dòng thuyền viên không cần cuộn (màn cao ≥ 800px) ||
| C2 | Cuộn xuống giữa danh sách | Thanh công cụ dính ngay dưới topbar, vẫn gõ tìm được ||
| C3 | Nhìn góc phải dưới | Nút tròn "+" nổi, không che chữ của dòng cuối khi cuộn tới cuối; trên iPhone không đè thanh Home ||
| C4 | Bấm nút "+" | Mở trang Thêm thuyền viên ||
| C5 | Bấm nút Lọc | Sheet "Bộ lọc" trượt lên từ đáy, có tay kéo, chân có "Xoá lọc" và "Xem n thuyền viên" ||
| C6 | Chọn 2 điều kiện, bấm "Xem n thuyền viên" | Sheet đóng, danh sách đúng n dòng; nút Lọc có số 2; tầng 2 hiện 2 chip và "Xoá lọc" ||
| C7 | Bấm × trên một chip | Gỡ đúng điều kiện đó, số trên nút Lọc còn 1 ||
| C8 | Lọc 4 điều kiện để chip tràn | Chip cuộn ngang được, mép phải mờ dần; "Xoá lọc" vẫn thấy ở ngoài vùng cuộn ||
| C9 | Kéo sheet Bộ lọc xuống / chạm nền mờ | Sheet đóng, không áp điều kiện chưa bấm Xem ||
| C10 | Nhìn chân danh sách | "1–20 / n thuyền viên" + ‹ 1 / k ›; không có ô Số dòng/trang; bấm › sang trang 2, cuộn về đầu danh sách ||
| C11 | Lặp C1, C3–C5 cho Đối tác, Tàu, Cơ hội, Chuyến tàu, Hợp đồng, YCTT, Danh mục → Chứng chỉ | Cùng kiểu ở mọi trang ||
| C12 | Mở Quản trị → Tài khoản | Dòng: tên, email, vai trò, trạng thái, nút ⋯; không còn bảng cuộn ngang ||
| C13 | Bấm ⋯ ở một tài khoản | Menu có Xem, Sửa, Xoá (theo quyền); bấm dòng (ngoài ⋯) mở chi tiết ||
| C14 | Người dùng không có quyền thêm (vai trò chỉ xem) mở Thuyền viên | Không có nút "+" ||

## D. Ô ngày

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| D1 | Danh sách Chuyến tàu: mở Bộ lọc, chạm ô "Từ ngày" | Bảng chọn ngày của máy mở; trang không giãn, không thu nhỏ ||
| D2 | Chọn 01/11 và 30/11, bấm Xem | Danh sách lọc đúng khoảng; ô hiện 01/11/2026 và 30/11/2026 ||
| D3 | Chọn "Đến ngày" trước "Từ ngày" | Báo lỗi dưới ô, không lọc ||
| D4 | Ghi rời tàu, đổi ngày rời tàu sang hôm qua, lưu | Lưu đúng ngày (mở lại chi tiết chuyến thấy đúng) ||
| D5 | Form Thuyền viên: nhập ngày sinh, lưu, mở lại trên desktop | Desktop hiện đúng ngày đã nhập trên điện thoại ||
| D6 | (desktop) Mở cùng các ô trên | Vẫn là bảng chọn ngày của antd như trước ||
| D7 | Ô ngày có chặn (ngày hết hạn phải sau ngày cấp) chọn ngày bị chặn | Không chọn được hoặc báo lỗi dưới ô, không lưu ||
| D8 | Xoá ngày đã nhập trong ô không bắt buộc, lưu | Trường về trống ||

## E. Trang chi tiết

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| E1 | Mở Hợp đồng có chủ tàu tên dài | Tile nhỏ cạnh mã HĐ + trạng thái; khối Thuyền viên / Chủ tàu / Tàu / Chuyến nằm dưới, dài hết ngang; tên chủ tàu xuống dòng nguyên chữ, không vỡ từng từ; trang không cuộn ngang ||
| E2 | Nhìn hàng nút của Hợp đồng đang Hiệu lực | Tối đa 2 nút chia đều + ⋯; "Đưa về Nháp" nằm trong ⋯ ||
| E3 | Nhìn trên header | Chỉ một dòng "‹ Hợp đồng"; bấm về danh sách ||
| E4 | Cuộn xuống quá header | Ô "Mục:" dính dưới topbar; đổi mục không cần cuộn lên ||
| E5 | Mở Thuyền viên tên dài có ảnh | Ảnh 60×80 cạnh tên; tên dài xuống tối đa 2 dòng; badge "giấy tờ hết hạn" hiện ||
| E6 | Bấm ảnh thuyền viên | Mở xem ảnh lớn, có nút Tải ảnh ||
| E7 | Bấm nút gọi / Zalo cạnh số điện thoại | Mở ứng dụng gọi / Zalo của máy ||
| E8 | Mục Hồ sơ cá nhân → Hộ chiếu | Nhãn trái, giá trị phải; trường trống hiện "—" ||
| E9 | Mở YCTT có breadcrumb dài (Tàu › MV … › CT-… › HĐ-… › TT-…) | Chỉ còn "‹ HĐ-…" một dòng ||
| E10 | YCTT Cần duyệt: bấm Duyệt | Dialog duyệt mở thành sheet; duyệt xong trạng thái đổi ||
| E11 | Lặp E1–E4 cho Đối tác, Tàu, Cơ hội, Chuyến tàu, Tài khoản | Cùng kiểu, không trang nào cuộn ngang ||
| E12 | Cơ hội: phụ trách có email dài | Email xuống dòng / cắt cuối có `…`, không đẩy trang ||

## F. Bảng trong trang

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| F1 | Hợp đồng ≥ 3 khoản → khối Khoản tiền | Mỗi khoản một dòng: tên, chênh lệch bên phải, "Thu … · Chi …" nhỏ bên dưới; dòng Chênh lệch tổng cuối ||
| F2 | So số ở F1 với bảng desktop cùng hợp đồng | Khớp từng khoản và tổng ||
| F3 | Sửa YCTT trên điện thoại | Trang không cuộn ngang; sửa một khoản, lưu, số trên chi tiết đúng ||
| F4 | Thuyền viên → Chứng chỉ | Dòng: tên, mã, hạn bên phải; chứng chỉ hết hạn nhãn đỏ ||
| F5 | Tàu → Thuyền viên trên tàu | Dòng, không bảng cuộn ngang ||
| F6 | Cơ hội → Ứng viên, Yêu cầu | Dòng; hành động của dòng nằm trong ⋯ hoặc bấm dòng ||
| F7 | Quản trị → Mục tiêu tháng | "Cả công ty" ở đầu; mỗi người một card 2 ô; chạm ô mở bàn phím số ||
| F8 | Nhập mục tiêu cho 2 người, Lưu | Thanh lưu ghi "Lưu thay đổi · 2"; lưu xong Tổng quan đổi theo ||

## G. Form

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| G1 | Sửa thuyền viên, chưa đổi gì | Thanh lưu một hàng: Huỷ + "Lưu thay đổi" bị khoá ||
| G2 | Đổi 3 trường | Viền nhấn + chip "Đã sửa" ở 3 ô; nút "Lưu thay đổi · 3" bấm được ||
| G3 | Cuộn form dài | Hàng mục dính dưới topbar, mục đang xem tự sáng và nằm trong tầm nhìn; mép phải mờ khi còn mục ||
| G4 | Bấm một mục trên hàng mục | Nhảy tới mục đó, tiêu đề mục không bị hàng mục che ||
| G5 | Đổi một trường rồi bấm Huỷ | Hỏi lại trước khi bỏ thay đổi ||
| G6 | Thêm thuyền viên: bỏ trống Họ tên, bấm "Thêm thuyền viên" | Báo lỗi dưới ô Họ tên, cuộn tới ô đó, ô không bị che ||
| G7 | Điền đủ, bấm "Lưu & thêm khác" | Lưu, ở lại trang, form trống, cuộn lên đầu ||
| G8 | Điền dở, bấm "‹ Thuyền viên" ở đầu form | Hỏi lại trước khi rời ||
| G9 | Gõ trong ô ở cuối form khi bàn phím đang mở | Ô đang gõ không bị bàn phím hay thanh lưu che ||
| G10 | Lặp G1–G2, G6 cho form Tàu, Đối tác, Cơ hội, Chuyến, Hợp đồng, YCTT, Tài khoản | Cùng kiểu ||
| G11 | Trên iPhone có thanh Home: nhìn thanh lưu | Nút không nằm sát / dưới thanh Home ||

## H. Dialog

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| H1 | Chuyến tàu → Ghi rời tàu | Sheet từ đáy, tay kéo, nút đóng; Huỷ và Ghi rời tàu chia đều ở chân ||
| H2 | Chạm ô Ghi chú trong sheet | Bàn phím mở, chân sheet đẩy lên theo, nút vẫn thấy ||
| H3 | Dialog dài (Duyệt hợp đồng, Soạn thư) | Thân sheet cuộn, chân đứng yên, sheet không cao quá ~88% màn ||
| H4 | Xoá thuyền viên (dialog xác nhận) | Sheet ngắn, hai nút chia đều, nút xoá màu nguy hiểm ||
| H5 | Đóng sheet bằng kéo xuống / chạm nền mờ / nút đóng | Đóng, không lưu ||
| H6 | (desktop) Mở cùng các dialog | Vẫn là dialog giữa màn như trước ||

## I. Trang còn lại

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| I1 | Tổng quan | Không cuộn ngang; nhãn trục biểu đồ đọc hết ("Tháng này" hoặc "T11"); tên môi giới không cắt quá sớm ||
| I2 | Soát giấy tờ (`/seafarers/:id/review`) | Không cuộn ngang; ảnh trang trên, ô dưới; chuyển trang được ||
| I3 | Nhập thuyền viên từ Excel | Không cuộn ngang; chọn tệp được ||
| I4 | Xuất bộ hồ sơ | Bản xem trước thu vừa ngang màn; tải về được ||
| I5 | Vai trò và quyền | Bản điện thoại như cũ; mọi nút bật / tắt bấm trúng bằng ngón cái ||
| I6 | Đăng nhập, Đặt mật khẩu | Ô 16px, không phóng to khi chạm; bàn phím không che nút Đăng nhập ||
| I7 | Trang lỗi 404, không có vai trò | Không cuộn ngang, nút về trang chủ bấm được ||

## J. Hướng dẫn và màn hình chính

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| J1 | Ngăn kéo → Dùng MCAH trên điện thoại | Trang hướng dẫn mở, đọc tốt ở 375px, không cuộn ngang ||
| J2 | Safari: Chia sẻ → Thêm vào MH chính; mở từ icon | Icon MCAH đúng; mở không có thanh địa chỉ; topbar không bị tai thỏ che ||
| J3 | (như trên) Chrome Android: ⋮ → Thêm vào màn hình chính | Như J2 ||
