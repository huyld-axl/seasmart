# MCAH — Testcase chạy tay: app máy tính, giai đoạn 4

- Kế hoạch: `docs/mcah-ke-hoach-desktop-gd4.md`. Wireframe: `docs/design/wireframes/desktop-gd4.html`.
- Chạy trên bản đã đóng gói và cài thật. B5, B6 cần một máy Ubuntu và một máy Windows; B8, B12, G7 cần thêm máy nhân viên.
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy. B1–B20 lấy từ kế hoạch tổng (mục 11).

## Chuẩn bị

- Máy chính có văn phòng, vài chục thuyền viên đủ giấy tờ, ảnh chân dung, hồ sơ đã gửi, logo đối tác, vài tệp trong thùng rác.
- Một ổ USB; một thư mục được Google Drive hoặc OneDrive đồng bộ.
- Bộ cài thử có migration cố ý lỗi ở tệp thứ hai (B9).
- Theo Q14 (2026-11-13) không còn mã hoá: B2, B6, B7, B11 đã đổi nội dung so với kế hoạch tổng.

## Testcase

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| B1 | Để yên 15 phút | App khoá, mở bằng mã PIN; sai 5 lần phải đăng nhập lại | Chưa thử | Chờ máy |
| B2 | Copy thư mục hồ sơ của máy chính sang máy khác, mở tệp | **Đổi theo Q14:** đọc được bình thường (không mã hoá). Ghi nhận để hướng dẫn nói rõ phải bảo vệ máy chính | Chưa thử | Chờ máy |
| B3 | Từ trình duyệt mở trang web gọi vào phần xử lý của máy chính | Bị từ chối | Chưa thử | Chờ máy |
| B4 | Tên thuyền viên chứa `<script>` | Hiện như chữ thường, không chạy | Chưa thử | Chờ máy |
| B5 | Sao lưu → cài máy mới (khác hệ điều hành) làm máy chính → khôi phục từ tệp .zip | Đủ dữ liệu; mở được ảnh / PDF; thư mục hồ sơ đúng cấu trúc trên máy mới | Chưa thử | Chờ máy |
| B6 | Mở tệp sao lưu .zip bằng trình giải nén của hệ điều hành | Thấy thư mục "Hồ sơ" đúng cấu trúc, tệp mở được (thay testcase mã khôi phục, bỏ theo Q14) | Chưa thử | Chờ máy |
| B7 | Khôi phục từ tệp .zip hỏng (cắt cụt) hoặc của văn phòng khác | Báo lỗi, máy vẫn trống, không hỏng gì | Chưa thử | Chờ máy |
| B8 | Sao lưu trong lúc hai máy nhân viên đang tải giấy tờ và sửa hồ sơ; khôi phục bản đó | Mọi dòng trong DB khôi phục đều có tệp tương ứng mở được | Chưa thử | Chờ máy |
| B9 | Cập nhật lên bản có migration cố ý lỗi ở tệp thứ hai | Máy chính tự khôi phục DB và khoá về trước cập nhật, quay về bản cũ, máy nhân viên nối lại được | Chưa thử | Chờ máy |
| B10 | Đọc log sau một ngày dùng | Không có tên, số hộ chiếu, số điện thoại | Chưa thử | Chờ máy |
| B11 | Mở tay thư mục hồ sơ trên máy chính | **Đổi theo Q14:** đúng cấu trúc mục 5.5, tên dễ đọc, có "Đọc tôi.txt"; không có tệp đã xoá, ảnh trang, ảnh thu nhỏ | Chưa thử | Chờ máy |
| B12 | Bấm "Mở thư mục hồ sơ" của một thuyền viên (trên máy chính và trên máy nhân viên) | Mở đúng cấu trúc mục 5.5, tệp mở được, không sửa được | Chưa thử | Chờ máy |
| B13 | Đóng app / đăng xuất / tắt điện đột ngột rồi mở lại; kiểm thư mục tạm (cả máy nhân viên) | Không còn bản xem tạm nào | Chưa thử | Chờ máy |
| B14 | Xuất toàn bộ hồ sơ ra USB | Có cảnh báo không mã hoá; cấu trúc đúng; bản cũ trong `Bản cũ/`; tệp đã xoá không có | Chưa thử | Chờ máy |
| B15 | Thuyền viên trùng tên, tên có ký tự `/:?` | Hai thư mục khác nhau nhờ mã; ký tự cấm bị bỏ | Chưa thử | Chờ máy |
| B16 | Nhân viên không có quyền xuất hàng loạt | Không thấy nút xuất nhiều / xuất toàn bộ | Chưa thử | Chờ máy |
| B17 | Tìm trong mã nguồn backend lệnh `fs` ghi thẳng vào kho tệp ngoài lớp kho tệp | Test tự động báo lỗi | Chưa thử | Chờ máy |
| B18 | Đang sao lưu thì: đầy ổ / rút USB / tắt điện | Không có bản sao lưu dở được tính là xong; lần sau sao lưu lại bình thường | Chưa thử | Chờ máy |
| B19 | Sao lưu thứ Hai → gỡ nhân viên X thứ Ba → khôi phục bản thứ Hai | X không vào được; mọi máy nhân viên phải ghép lại | Chưa thử | Chờ máy |
| B20 | Job xoá tệp tới hạn chạy giữa lúc sao lưu đang chép tệp | Bản sao lưu đủ tệp | Chưa thử | Chờ máy |
| G1 | Bản web sau bước 1: tải giấy tờ, xem, xuất CV, gửi hồ sơ cho chủ tàu, đổi logo, đổi chân dung | Chạy như trước khi đổi | Chưa thử | — |
| G4 | Máy chính cũ còn chạy sau khi khôi phục sang máy mới | Hiện "Văn phòng đã chuyển sang máy chính khác", máy nhân viên không nối vào máy cũ | Chưa thử | Chờ máy |
| G5 | Ổ máy chính có / không mã hoá (LUKS, BitLocker) | Thẻ máy chính và dải nhắc báo đúng | Chưa thử | Chờ máy |
| G6 | Lần đầu bấm quét giấy tờ; bấm "Không, tôi nhập tay"; rồi đồng ý | Không đồng ý thì không gửi ảnh; đồng ý một lần, máy khác không hỏi lại | Chưa thử | Chờ máy |
| G7 | Máy nhân viên lưu hồ sơ khi máy chính đang cập nhật | Dải "Máy chính đang cập nhật", lưu báo lỗi, form còn nguyên | Chưa thử | Chờ máy |
| G9 | Đổi họ tên thuyền viên; đổi số / hạn một giấy; thêm bản mới cùng loại | Thư mục và tên tệp đổi theo; bản cũ vào "Bản cũ/"; xem tệp trong app vẫn được | Chưa thử | Chờ máy |
| G10 | Đang mở một PDF trong trình xem (Windows) thì đổi tên thuyền viên | App lưu được; thư mục chuyển sau khi đóng PDF (thử lại mỗi phút) | Chưa thử | Chờ máy |
| G11 | Xoá tay một tệp, di chuyển tay một tệp sang thư mục khác trong cây hồ sơ | Tệp bị di chuyển: app tự tìm lại. Tệp bị xoá: hiện "Tệp không còn trong thư mục hồ sơ", quản trị nhận thông báo | Chưa thử | Chờ máy |
| G12 | Tạo văn phòng mới trên máy trống | Chỉ hỏi tên văn phòng, không còn bước mật khẩu sao lưu / mã khôi phục | Chưa thử | Chờ máy |
| G13 | Đổi chỗ thư mục hồ sơ sang ổ khác | Cả cây chuyển sang, app đọc tệp bình thường, thư mục cũ trống | Chưa thử | Chờ máy |
