# Catoro — Testcase chạy tay: đổi tên từ MCAH

- Kế hoạch: `docs/catoro-ke-hoach-doi-ten.md`.
- Nhóm N (nâng cấp) chạy trên **máy đã dùng MCAH 0.9.13 có dữ liệu thử**, không chạy trên máy cài mới. Trước khi chạy: tạo bản chụp dữ liệu (Cài đặt > bản chụp) để quay lại được.
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy. Nhóm W (web) và M (máy chủ dịch vụ) chỉ có một cột.

## Chuẩn bị

- Máy chính Ubuntu chạy 0.9.13: văn phòng có ≥ 3 thuyền viên có giấy tờ, 1 hợp đồng, 1 bill; đã đặt mã PIN; đã lưu mật khẩu SMTP; thư mục hồ sơ để mặc định (`Tài liệu/MCAH - Hồ sơ`).
- Một máy nhân viên (Ubuntu hoặc Windows) đã ghép với máy chính, chạy 0.9.13.
- Máy Windows chạy 0.9.13 có biểu tượng Desktop.
- Bản 0.9.14 đã phát ở kênh beta (hoặc thư mục cập nhật thử).

## Nâng cấp app máy tính

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| N1 | Trên máy chính 0.9.13, mở app, chờ thông báo có bản mới, bấm cập nhật | Thông báo ghi "Có bản mới Catoro 0.9.14…"; cài xong app tự mở lại; tiêu đề cửa sổ, splash, menu ghi Catoro, logo tạm | | |
| N2 | Sau N1, không đăng nhập lại | Vào thẳng (hoặc chỉ hỏi PIN nếu đã khoá); đủ thuyền viên, giấy tờ, hợp đồng, bill như trước; mở được ảnh giấy tờ | | |
| N3 | Khoá app, nhập mã PIN cũ; vào Cài đặt thư xem SMTP | PIN cũ mở được; mật khẩu SMTP vẫn đã lưu, gửi thư thử được | | |
| N4 | Xem menu Start / màn ứng dụng, Desktop, Gỡ cài đặt (Windows: Apps & features) | Chỉ còn **một** app tên Catoro; không còn MCAH; biểu tượng Desktop cũ (nếu có) đã thay bằng Catoro, mở được | | |
| N5 | Ubuntu: `dpkg -l \| grep -E "mcah\|catoro"` | Chỉ có `catoro-desktop 0.9.14`; `mcah-desktop` đã gỡ | | — |
| N6 | Mở thư mục hồ sơ từ app (Cài đặt trên máy này) | Vẫn là `Tài liệu/MCAH - Hồ sơ` với đủ tệp cũ; thêm giấy tờ mới thì tệp mới vào đúng thư mục này | | |
| N7 | Máy nhân viên **vẫn 0.9.13** mở app sau khi máy chính lên 0.9.14 | Thấy máy chính, làm việc bình thường; rồi nhận lời mời cập nhật, cập nhật từ máy chính, sau đó vẫn nối được | | |
| N8 | Windows: kiểm tường lửa (`netsh advfirewall firewall show rule name=all \| findstr /i "may chinh"`) | Có luật `Catoro may chinh`; không còn `MCAH may chinh`; máy nhân viên vẫn nối tới | — | |
| N9 | Tạo bản chụp dữ liệu trên 0.9.14, khôi phục lên một máy 0.9.14 khác | Khôi phục được; bản chụp cũ từ 0.9.13 cũng khôi phục được | | |
| N10 | Gửi báo lỗi khi không có mạng | Tệp `catoro-bao-loi-*.txt` trong Tải xuống, app mở đúng thư mục | | |

## Cài mới

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| C1 | Cài 0.9.14 trên máy chưa từng có MCAH, tạo văn phòng | Bộ cài, app, chữ trong bộ cài Windows đều ghi Catoro; thư mục hồ sơ mặc định `Tài liệu/Catoro - Hồ sơ` | | |
| C2 | Ghép một máy nhân viên cài mới vào máy chính C1 | Ghép được như trước | | |

## Web và máy chủ dịch vụ

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| W1 | Mở bản web: đăng nhập, Tổng quan, Thuyền viên, Hợp đồng, Báo cáo, Hướng dẫn | Không còn chữ MCAH ở đâu; tab trình duyệt ghi Catoro, favicon logo tạm | |
| W2 | W1 ở khung 375px | Logo và tên không vỡ dòng, không cuộn ngang | |
| W3 | Xuất PDF hợp đồng / bill | Không còn chữ MCAH trong PDF | |
| M1 | Trang tài khoản máy chủ dịch vụ: đăng nhập bằng mã email | Email người gửi tên Catoro; trang ghi Catoro; người đang đăng nhập từ trước phải đăng nhập lại một lần (đúng thiết kế) | |
| M2 | Trang tải `/download` | Chữ và nút ghi Catoro; tải được `catoro-desktop_0.9.14_amd64.deb` và `Catoro Setup 0.9.14.exe` | |
| M3 | App 0.9.13 (chưa cập nhật) đăng nhập lại qua máy chủ dịch vụ đã lên bản mới | Đăng nhập được | |
| M4 | Server chạy với `.env` còn tên `MCAH_*` | Chạy bình thường, nhật ký có dòng nhắc tên cũ | |
