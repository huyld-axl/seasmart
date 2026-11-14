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
| E1 | Máy trống: mở app, bấm "Đăng nhập qua trình duyệt" | Trình duyệt mặc định mở trang đăng nhập; xong thì app tự vào W3, trình duyệt hiện "Đã đăng nhập" | Đạt (trình duyệt giả bằng curl, dev): mở /authorize → đăng nhập web → về app → màn Lần đầu | Chờ máy |
| E2 | Đăng ký bằng email (bấm thư xác minh) và bằng Google | Cả hai vào được; chưa xác minh email thì trang báo và không vào app | Email: đạt (test máy chủ). Google: đạt (máy dev, tài khoản Google thật) | Chờ máy |
| E3 | Quên mật khẩu trên web | Thư đặt lại tới; đặt mật khẩu mới; đăng nhập app bằng mật khẩu mới; phiên cũ trên máy khác (nếu có) bị cắt khi làm mới | Đạt ở test máy chủ (đặt lại, mật khẩu cũ hết dùng); chưa thử qua app | Chờ máy |
| E4 | Chặn chuyển về app (đóng app giữa chừng rồi mở lại, hoặc chặn cổng nội bộ) | Trang "Đã đăng nhập" có mã; bấm "Nhập mã thủ công" trong app, dán mã → vào được | Đạt ở test máy chủ (mã ngắn đổi được); chưa bấm qua giao diện | Chờ máy |
| H1 | Lần đầu → Tạo văn phòng: tên, mật khẩu sao lưu, mã khôi phục, nhập lại nhóm 2 và 5 | Tạo xong vào W5 rồi Tổng quan; nhập sai nhóm thì báo, không tạo | Đạt: nhập sai nhóm bị chặn, đúng thì vào Tổng quan; khoá dữ liệu mở được bằng mật khẩu và mã khôi phục | Chờ máy |
| H2 | Tạo văn phòng khi rút mạng giữa chừng | Báo lỗi mạng, giữ các ô đã nhập; cắm mạng bấm Thử lại thì tạo được, không tạo hai văn phòng | Chưa thử | Chờ máy |
| H3 | Ubuntu không có gnome-keyring, tạo văn phòng | Không cho tạo, hướng dẫn cài kho mật khẩu | Chưa thử (máy có gnome-keyring) | — |
| E5 | Đã đăng nhập, rút mạng, chỉnh đồng hồ thử tới ngày thứ 6 | Vẫn làm việc; có dải vàng "Kết nối trước …" | Đạt (đồng hồ giả): ngày 6 có dải vàng | Chờ máy |
| E6 | Tới ngày thứ 8 | Về màn đăng nhập "Đã 7 ngày không kết nối internet…"; không có mạng thì không vào được | Đạt (đồng hồ giả): ngày 8 về đăng nhập | Chờ máy |
| E11 | Còn 1 ngày, mất mạng, đóng mở app nhiều lần | Vẫn hết đúng mốc cũ | Đạt: mốc không đổi khi mở lại app; thêm chặn chỉnh lùi đồng hồ | Chờ máy |
| H4 | Đặt PIN; để rỗi quá ngưỡng (đặt 5 phút) | App khoá; PIN đúng thì mở; trong lúc khoá không thao tác dữ liệu được | Đạt (khoá sau 40 giây chế độ thử): khoá → API 423 → PIN đúng mở được | Chờ máy |
| E12 | Sai PIN 5 lần khi trình duyệt vẫn đăng nhập (email hoặc Google) | Về màn đăng nhập; trang web bắt nhập lại mật khẩu / Google hỏi lại | Đạt: sau 5 lần sai về đăng nhập, app gửi max_age=0; máy chủ bắt nhập lại (test máy chủ) | Chờ máy |
| E9 | Đăng xuất | Lần mở sau phải đăng nhập qua trình duyệt; PIN cũ không dùng được | Đạt: đăng xuất xoá phiên + PIN | Chờ máy |
| E10 | Tìm mật khẩu / vé / token trong `localStorage` và mọi tệp của app | Không có dạng rõ | Đạt: localStorage chỉ có user; không có vé / refresh / JWT dạng rõ trong tệp app | Chờ máy |
| E7 | Quản trị → Tài khoản → Mời email mới vai trò Môi giới | Thư mời tới; người đó đăng ký trên web; đăng nhập app **trên máy chính** → vào với vai trò Môi giới; dòng đổi từ "Đã mời" sang "Đang hoạt động" | Đạt: thư mời qua cổng ký → đăng ký từ liên kết → nhân viên đăng nhập trên máy chính, đúng vai trò | Chờ máy |
| H5 | Gửi lại / huỷ lời mời; dùng liên kết mời đã huỷ | Gửi lại tới thư mới; liên kết đã huỷ báo hết hiệu lực | Đạt một phần (test máy chủ: liên kết đã dùng hết hiệu lực); chưa bấm gửi lại / huỷ trên giao diện | Chờ máy |
| E8 | Quản trị tắt "Đăng nhập" của một nhân viên đang mở app | Thao tác kế tiếp của người đó bị chặn; người đó đăng nhập lại cũng không vào được văn phòng | Đạt: khoá ở máy ngay, máy chủ bỏ thành viên, vé mới không còn văn phòng | Chờ máy |
| H6 | Có mạng: quét PDF giấy tờ, quét danh thiếp, tra IMO, tìm danh mục tàu | Kết quả như bản web; trang quản trị nội bộ thấy số trang quét của văn phòng | Tìm danh mục tàu qua máy chủ: đạt. AI và tra IMO thật: chưa (máy dev không có khoá AI / nguồn tàu) | Chờ máy |
| H7 | Rút mạng: bấm quét / tra / tìm danh mục | Báo "Cần kết nối internet", không lỗi lạ; các màn khác dùng bình thường | Chưa thử | Chờ máy |
| H8 | Quản trị nội bộ khoá văn phòng | Quét / tra báo văn phòng bị khoá; người đang làm vẫn làm offline tới mốc; đăng nhập mới bị từ chối | Đạt ở test máy chủ (trang quản trị khoá văn phòng, máy chính bị từ chối) | Chờ máy |
| H9 | `npm run dist:linux` / `dist:win` | Bước quét bí mật chạy và báo sạch; thử thêm một khoá giả vào backend thì build dừng | Đạt: quét sạch; cài thử khoá giả thì bị bắt | Chờ máy |
| H10 | Bản web sau khi cập nhật code | Đăng nhập email + mật khẩu, tạo tài khoản, thư mời, AI, tra tàu chạy như cũ | Test tự động bản web qua; chưa mở trình duyệt | Chờ máy |
