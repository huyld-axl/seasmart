# Catoro — Testcase chạy tay: app máy tính trên macOS

- Bộ cài: artifact `catoro-installer-mac-arm64` (Mac chip Apple) và `catoro-installer-mac-x64` (Mac chip Intel) của workflow "Desktop build" (`.github/workflows/desktop-build.yml`), hoặc trang tải sau khi phát hành.
- Bản macOS ký ad-hoc, chưa có Apple Developer ID (`docs/catoro-quy-trinh-phat-hanh.md`, mục "macOS: chưa có chữ ký Apple").
- Code macOS viết trên Ubuntu, chưa chạy trên máy Mac thật: mọi dòng dưới đây đều cần thử. Cột ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy.

## Chuẩn bị

- Một máy Mac chip Apple (M1 trở lên) và, nếu có, một máy Mac chip Intel; macOS 12 trở lên. Tài khoản đăng nhập máy là tài khoản quản trị.
- Một văn phòng thử có máy chính Ubuntu hoặc Windows để thử nối máy Mac làm máy nhân viên.

## Testcase

| # | Bước | Kết quả đúng | Chip Apple | Chip Intel |
|---|---|---|---|---|
| M1 | Tải `.dmg` qua trình duyệt, mở, kéo Catoro vào Ứng dụng, mở Catoro | macOS báo chưa xác minh nhà phát triển; vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Vẫn mở thì app chạy | Chờ máy | Chờ máy |
| M2 | Mở lần đầu, tạo văn phòng (máy chính) | Postgres chạy, đăng nhập qua trình duyệt được, không hỏi kho mật khẩu lạ (dùng Keychain) | Chờ máy | Chờ máy |
| M3 | Thêm thuyền viên, tải lên tài liệu, xuất PDF, xuất Excel | Lưu được; PDF và Excel mở được | Chờ máy | Chờ máy |
| M4 | Gửi hồ sơ qua email, app mail mặc định là Mail của máy | Lần đầu macOS hỏi "Catoro muốn điều khiển Mail" → OK; thư mới mở đủ người nhận, tiêu đề, nội dung, tệp .zip | Chờ máy | Chờ máy |
| M5 | Như M4, app mail mặc định là Thunderbird | Thunderbird mở thư mới kèm tệp | Chờ máy | Chờ máy |
| M6 | Cài đặt → Máy trong văn phòng, máy bật / tắt FileVault | Báo "đã mã hoá" khi FileVault bật; cảnh báo kèm hướng dẫn FileVault khi tắt | Chờ máy | Chờ máy |
| M7 | Nối máy Mac làm máy nhân viên vào máy chính Ubuntu / Windows | Tìm thấy máy chính, nối được, dùng dữ liệu máy chính | Chờ máy | Chờ máy |
| M8 | Phát bản mới hơn (kênh thử nghiệm), máy Mac đang mở Catoro trong Ứng dụng | Hộp "Có bản mới" → Cập nhật ngay: tải, tự đóng và mở lại bản mới, không hỏi mật khẩu; lần mở sau không còn `Catoro.app.old` trong Ứng dụng | Chờ máy | Chờ máy |
| M9 | Như M8 nhưng mở Catoro thẳng từ `.dmg` (chưa kéo vào Ứng dụng) | Báo không ghi được, hướng dẫn kéo Catoro vào Ứng dụng; app cũ vẫn chạy bình thường | Chờ máy | Chờ máy |
| M10 | Máy nhân viên Mac, máy chính đã lên bản mới | Hộp "Cần cập nhật để nối máy chính", tải bộ cài từ máy chính (đúng chip), cài, mở lại | Chờ máy | Chờ máy |
| M11 | Bản mới có migration lỗi (bản thử `CATORO_TEST_MIGRATION`) | Trả dữ liệu như trước, cài lại bản cũ, mở lại bản cũ | Chờ máy | Chờ máy |
| M12 | Phím tắt ⌘C / ⌘V trong ô nhập, ⌘Q, ⌘H | Chạy như app Mac thường; menu Catoro trên thanh menu có Ẩn / Thoát | Chờ máy | Chờ máy |
| M13 | Mở https://mcah.axalize.vn/download trên máy Mac | Ô macOS được làm nổi, hai nút tải đúng `.dmg` từng chip, có dòng hướng dẫn "Vẫn mở" | Chờ máy | Chờ máy |
