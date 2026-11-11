# MCAH — Testcase chạy tay: app máy tính, giai đoạn 1

- Kế hoạch: `docs/mcah-ke-hoach-desktop-gd1.md`. Wireframe: `docs/design/wireframes/desktop-gd1.html`.
- Chạy trên **bản đã đóng gói và cài thật** (`.deb` bằng `apt install`, `.exe` bằng bộ cài), không chạy bằng `npm start`.
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy.
- Testcase A5–A9 lấy từ kế hoạch tổng (mục 11), chạy cùng lúc.

## Chuẩn bị

- Ubuntu 24.04 trở lên, có và không có Thunderbird; có và không có LibreOffice (gỡ bằng `sudo apt remove libreoffice-*` hoặc dùng máy ảo).
- Windows 11: một máy có Outlook bản Office, một máy chỉ có Outlook bản mới, một máy có Thunderbird.
- Dữ liệu: một cơ hội đang mở, có 2 ứng viên đã chọn đủ giấy tờ; một thuyền viên có chứng chỉ hết hạn sau đúng 7 ngày.
- Một tài khoản Gmail có bật xác minh 2 bước và tạo mật khẩu ứng dụng (cho A8).

## Testcase

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| G1 | Mở app lần đầu sau khi cài | Thấy màn chờ có logo, rồi màn đăng nhập; không có cửa sổ trắng. Thư mục dữ liệu tên `MCAH` | | |
| G2 | Đang mở app, bấm biểu tượng MCAH lần nữa | Không mở cửa sổ thứ hai; cửa sổ đang có được đưa lên trước | | |
| G3 | Tắt app qua đêm, sáng mở app | Chứng chỉ quá hạn đổi trạng thái "Hết hạn"; chuông có thông báo hạn mới | | |
| G4 | Có thông báo hạn mới khi app đang mở (hoặc lúc mở app) | Hiện thông báo của hệ điều hành (góc màn hình); bấm vào mở đúng trang thuyền viên | | |
| A9 | Máy chưa có LibreOffice: ở Bộ hồ sơ bấm tải PDF | Hiện "Cần cài thành phần xuất PDF"; bấm Cài ngay, nhập mật khẩu quản trị, chờ cài xong thì tự tải PDF; tải Excel luôn được | | |
| G5 | Trong lúc cài LibreOffice bấm "Để sau" / huỷ hộp xin mật khẩu | Hộp đóng hoặc báo "Chưa cài" kèm nút Thử lại; app không treo | | |
| A5 | Cơ hội → Gửi chủ tàu, cách "app mail", bấm Mở trong app mail | Thư mới trong app mail có đủ người nhận, CC, tiêu đề, nội dung và mỗi ứng viên một tệp .zip; tệp mở được | | |
| A6 | Như A5 trên máy không có app mail | Mở thư mục chứa các .zip; hộp có nút "Cài Thunderbird" mở đúng trang tải | | |
| A7 | Sau A5 chọn "Chưa gửi", rồi làm lại và chọn "Đã gửi" | "Chưa gửi": cơ hội không ghi gì. "Đã gửi": lịch sử gửi có đúng người nhận, tiêu đề, ứng viên | | |
| G6 | Gửi 2 ứng viên tổng hơn 20 MB | Báo "quá giới hạn 20 MB, gửi bớt người mỗi thư"; không mở thư | | |
| G7 | Mở thư mục `~/MCAH/Tệp gửi thư` (Windows: `%LOCALAPPDATA%\MCAH\Tệp gửi thư`) sau 1 ngày, mở lại app | Tệp của hơn 24 giờ trước đã bị dọn | | |
| A8 | Cài đặt trên máy này → Gửi thẳng từ app, khai Gmail + mật khẩu ứng dụng, bấm Gửi thử cho tôi | Nhận được thư thử; tìm mật khẩu trong thư mục dữ liệu của app không thấy dạng chữ rõ | | |
| G8 | Đổi cách gửi qua lại giữa app mail và gửi thẳng, mở hộp Gửi chủ tàu | App mail: nút "Mở trong app mail", không có nút đính kèm thêm. Gửi thẳng: nút "Gửi" và nút đính kèm như bản web | | |
| G9 | Quản trị → Tài khoản → tạo tài khoản mới | Hộp "Đã tạo tài khoản…"; Mở trang đặt mật khẩu → đặt mật khẩu → người đó đăng nhập được với đúng vai trò | | |
| G10 | Đi lần lượt mọi mục ở thanh bên, mở một bản ghi mỗi loại, bấm mọi nút tải tệp (Excel, .zip, tệp giấy tờ, ảnh) | Mọi màn mở được như bản web; tải tệp hiện hộp lưu của hệ điều hành, tệp lưu ra mở được; không thấy nút "Nhắn SMS" | | |
| G14 | Bấm "Hướng dẫn" ở thanh trên và "Hướng dẫn sử dụng" ở thanh bên | Trang hướng dẫn mở trong cửa sổ riêng, đúng mục; có mục "Ứng dụng trên máy tính" |  |  |
| G11 | Rút mạng, dùng các màn chính | Mọi việc chạy; quét giấy tờ / tìm tàu hiện trạng thái chưa dùng được, không lỗi | | |
| G12 | Đổi tên tạm `PG_VERSION` trong thư mục dữ liệu, mở app | Màn "MCAH chưa mở được" mã `DB_START`; trả lại tên, bấm Thử lại thì vào được | | |
| G13 | Bản web (trình duyệt) sau khi cập nhật code | Vẫn gửi chủ tàu qua mail server, vẫn gửi thư mời, vẫn có nút SMS; không thấy "Cài đặt trên máy này" | | |
