# MCAH — Testcase chạy tay: app máy tính, giai đoạn 5

- Kế hoạch: `docs/mcah-ke-hoach-desktop-gd5.md`. Không có wireframe (không đổi màn nào).
- Chạy trên **bản đã đóng gói và cài thật** (bảo vệ code chỉ có ở bản đóng gói, không có khi chạy `npm start`).
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy. C1–C6 lấy từ kế hoạch tổng (mục 11).

## Chuẩn bị

- Bộ cài Ubuntu và Windows dựng từ cùng một commit.
- Máy Windows sạch có Microsoft Defender bật (C1, G6).
- Máy chủ dịch vụ thử có dữ liệu lượt dùng giả (G8).

## Testcase

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| C1 | **Windows:** sửa một byte trong gói `app.asar` | App không khởi động | Chưa thử | Chờ máy |
| C2 | **Ubuntu:** như C1 | Ghi nhận là **không chặn được** (Electron chưa hỗ trợ kiểm toàn vẹn gói trên Linux); code vẫn ở dạng bytecode, không đọc được như mã nguồn | Ghi nhận: Electron chưa kiểm toàn vẹn gói trên Linux; code đã ở dạng bytecode | Chờ máy |
| C3 | Chạy `strings` / tìm chữ trên toàn bộ thư mục cài (cả hai hệ điều hành) | Không thấy khoá nào ở mục 6.3 | Đạt (quét bộ cài sạch; test quét bắt mẫu mới, cả chuỗi trong .jsc) | Chờ máy |
| C4 | Mở thư mục cài đặt, tìm code phần xử lý | Không đọc được như mã nguồn | Đạt (không còn mã nguồn backend / vỏ app; chỉ .jsc) | Chờ máy |
| C5 | Gọi thẳng API quét AI của máy chủ không kèm vé, vé hết hạn, hoặc văn phòng bị khoá | Bị từ chối | Đạt ở test tự động máy chủ dịch vụ (không chữ ký, văn phòng bị khoá) | Chờ máy |
| C6 | Bấm tổ hợp phím mở DevTools ở bản phát hành; chạy app với cờ gỡ lỗi (`--inspect`) | Không mở / bị bỏ qua | Đạt phần cờ (--inspect, --remote-debugging-port → app thoát); phím tắt chưa bấm tay | Chờ máy |
| G1 | Mở bản đóng gói, làm lần lượt: đăng nhập, tạo / sửa thuyền viên, tải giấy tờ và quét AI, xuất PDF, gửi hồ sơ cho chủ tàu (app mail và SMTP), mở thư mục hồ sơ, máy nhân viên nối máy chính | Chạy như trước giai đoạn 5 | Đạt một phần: mở app, xuất PDF / Excel, thư mục hồ sơ, tải bộ giấy tờ qua backend bytecode; đăng nhập thật, máy nhân viên chưa thử | Chờ máy |
| G2 | Mở thư mục cài đặt, tìm `resources/backend/src` và `src/*.js` trong `app.asar` (`npx asar list`) | Không có thư mục mã nguồn; chỉ có `*.jsc` và tệp nạp vài dòng | Đạt | Chờ máy |
| G3 | Tìm tệp `.map` trong toàn bộ thư mục cài | Không có | Đạt (0 tệp .map) | Chờ máy |
| G4 | Chạy app với `--remote-debugging-port=9222` | App thoát / không mở cổng gỡ lỗi | Đạt | Chờ máy |
| G5 | Đọc cầu chì bằng `npx @electron/fuses read --app <tệp chạy>` | Khớp cấu hình: không chạy như Node, không `--inspect`, không `NODE_OPTIONS`, chỉ nạp từ asar | Đạt (khớp cấu hình) | Chờ máy |
| G6 | Quét bộ cài và thư mục cài bằng Microsoft Defender | Không báo virus | — | Chờ máy |
| G7 | So số đo bước 0: cỡ bộ cài, thời gian mở app tới màn đăng nhập | Không chậm hơn rõ rệt (dưới 20%) | Đạt (2,9–3,0 giây, trước 2,5–3,8 giây) | Chờ máy |
| G8 | Trang quản trị nội bộ máy chủ dịch vụ với dữ liệu thử: một văn phòng quét AI gấp 10 lần thường ngày, một văn phòng đổi máy chính 3 lần | Hai văn phòng có cảnh báo, văn phòng khác không | Đạt ở test tự động | — |
