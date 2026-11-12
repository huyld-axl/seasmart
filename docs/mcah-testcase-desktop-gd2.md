# MCAH — Testcase chạy tay: app máy tính, giai đoạn 2

- Kế hoạch: `docs/mcah-ke-hoach-desktop-gd2.md`. Wireframe: `docs/design/wireframes/desktop-gd2.html`.
- Chạy trên bản đã đóng gói và cài thật, nối với máy chủ dịch vụ thử (bước 1–10) hoặc thật (bước 11).
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy. E1–E13 lấy từ kế hoạch tổng (mục 11).

## Chuẩn bị

- Hai địa chỉ email nhận được thư (một cho quản trị, một cho nhân viên được mời) và một tài khoản Google.
- Máy chủ dịch vụ thử có đồng hồ giả (cho E5, E6, E11).
- Một PDF giấy tờ thật và một ảnh danh thiếp (cho H6).

## Testcase

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| E1 | Máy trống: mở app, bấm "Đăng nhập qua trình duyệt" | Trình duyệt mặc định mở trang đăng nhập; xong thì app tự vào W3, trình duyệt hiện "Đã đăng nhập" | | |
| E2 | Đăng ký bằng email (bấm thư xác minh) và bằng Google | Cả hai vào được; chưa xác minh email thì trang báo và không vào app | | |
| E3 | Quên mật khẩu trên web | Thư đặt lại tới; đặt mật khẩu mới; đăng nhập app bằng mật khẩu mới; phiên cũ trên máy khác (nếu có) bị cắt khi làm mới | | |
| E4 | Chặn chuyển về app (đóng app giữa chừng rồi mở lại, hoặc chặn cổng nội bộ) | Trang "Đã đăng nhập" có mã; bấm "Nhập mã thủ công" trong app, dán mã → vào được | | |
| H1 | Lần đầu → Tạo văn phòng: tên, mật khẩu sao lưu, mã khôi phục, nhập lại nhóm 2 và 5 | Tạo xong vào W5 rồi Tổng quan; nhập sai nhóm thì báo, không tạo | | |
| H2 | Tạo văn phòng khi rút mạng giữa chừng | Báo lỗi mạng, giữ các ô đã nhập; cắm mạng bấm Thử lại thì tạo được, không tạo hai văn phòng | | |
| H3 | Ubuntu không có gnome-keyring, tạo văn phòng | Không cho tạo, hướng dẫn cài kho mật khẩu | | — |
| E5 | Đã đăng nhập, rút mạng, chỉnh đồng hồ thử tới ngày thứ 6 | Vẫn làm việc; có dải vàng "Kết nối trước …" | | |
| E6 | Tới ngày thứ 8 | Về màn đăng nhập "Đã 7 ngày không kết nối internet…"; không có mạng thì không vào được | | |
| E11 | Còn 1 ngày, mất mạng, đóng mở app nhiều lần | Vẫn hết đúng mốc cũ | | |
| H4 | Đặt PIN; để rỗi quá ngưỡng (đặt 5 phút) | App khoá; PIN đúng thì mở; trong lúc khoá không thao tác dữ liệu được | | |
| E12 | Sai PIN 5 lần khi trình duyệt vẫn đăng nhập (email hoặc Google) | Về màn đăng nhập; trang web bắt nhập lại mật khẩu / Google hỏi lại | | |
| E9 | Đăng xuất | Lần mở sau phải đăng nhập qua trình duyệt; PIN cũ không dùng được | | |
| E10 | Tìm mật khẩu / vé / token trong `localStorage` và mọi tệp của app | Không có dạng rõ | | |
| E7 | Quản trị → Tài khoản → Mời email mới vai trò Môi giới | Thư mời tới; người đó đăng ký trên web; đăng nhập app **trên máy chính** → vào với vai trò Môi giới; dòng đổi từ "Đã mời" sang "Đang hoạt động" | | |
| H5 | Gửi lại / huỷ lời mời; dùng liên kết mời đã huỷ | Gửi lại tới thư mới; liên kết đã huỷ báo hết hiệu lực | | |
| E8 | Quản trị tắt "Đăng nhập" của một nhân viên đang mở app | Thao tác kế tiếp của người đó bị chặn; người đó đăng nhập lại cũng không vào được văn phòng | | |
| H6 | Có mạng: quét PDF giấy tờ, quét danh thiếp, tra IMO, tìm danh mục tàu | Kết quả như bản web; trang quản trị nội bộ thấy số trang quét của văn phòng | | |
| H7 | Rút mạng: bấm quét / tra / tìm danh mục | Báo "Cần kết nối internet", không lỗi lạ; các màn khác dùng bình thường | | |
| H8 | Quản trị nội bộ khoá văn phòng | Quét / tra báo văn phòng bị khoá; người đang làm vẫn làm offline tới mốc; đăng nhập mới bị từ chối | | |
| H9 | `npm run dist:linux` / `dist:win` | Bước quét bí mật chạy và báo sạch; thử thêm một khoá giả vào backend thì build dừng | | |
| H10 | Bản web sau khi cập nhật code | Đăng nhập email + mật khẩu, tạo tài khoản, thư mời, AI, tra tàu chạy như cũ | | |
