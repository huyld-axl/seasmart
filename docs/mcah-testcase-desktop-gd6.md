# MCAH — Testcase chạy tay: app máy tính, giai đoạn 6

- Kế hoạch: `docs/mcah-ke-hoach-desktop-gd6.md`. Wireframe: `docs/design/wireframes/desktop-gd6.html`.
- Chạy trên bộ cài phát thật qua `https://mcah.axalize.dev/download` (kênh thử nghiệm), máy Windows sạch và Ubuntu 22.04 / 24.04 sạch.
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy. F1–F4 lấy từ kế hoạch tổng (mục 11).

## Chuẩn bị

- Hai bản phát thử liên tiếp (vd. `0.9.0`, `0.9.1`) có ghi chú; một văn phòng thử (máy chính + một máy nhân viên) chạy `0.9.0` có dữ liệu.
- Một `latest.json` sửa tay (sai chữ ký) để thử F3.

## Testcase

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| F1 | Tải từ website về máy Windows sạch và máy Ubuntu sạch | Cài và chạy được | Chưa thử | Chờ máy |
| F2 | Phát bản 1.0.1, văn phòng đang chạy 1.0.0 | Tự nhận và cập nhật, dữ liệu còn nguyên | Chưa thử | Chờ máy |
| F3 | Đặt một bản cập nhật sai chữ ký lên chỗ phát (Windows và Ubuntu) | App từ chối cài | Chưa thử | Chờ máy |
| F4 | Chạy script phát hành khi thiếu bản Ubuntu | Script dừng, không phát hành | Đạt ở test tự động (thiếu bản Ubuntu → dừng) | Chờ máy |
| G1 | Chạy `npm run release` khi `.exe` và `.deb` khác commit, hoặc thiếu ghi chú, hoặc khoá riêng không khớp khoá công khai trong repo | Script dừng, không phát hành, báo rõ lý do | Đạt ở test tự động | Chờ máy |
| G2 | Máy build không có khoá riêng: chạy `npm run dist:linux` | Build được (chỉ cần khoá công khai trong repo); không sinh khoá mới | Chưa thử | Chờ máy |
| G3 | Máy chính đổi kênh sang Thử nghiệm; có bản beta mới | Máy chính nhận bản beta; máy nhân viên theo máy chính | Chưa thử | Chờ máy |
| G4 | Đổi kênh từ Thử nghiệm về Ổn định khi bản ổn định cũ hơn bản đang chạy | Không hạ bản; chờ bản ổn định mới hơn | Chưa thử | Chờ máy |
| G5 | Có bản mới: xem hộp (W1) | Hiện số phiên bản, cỡ tải, ghi chú tiếng Việt; Ubuntu có dòng hỏi mật khẩu quản trị | Chưa thử | Chờ máy |
| G6 | Sau khi cập nhật, mở app lần đầu rồi lần hai | Lần đầu có dải "Đã cập nhật…"; lần hai không còn | Chưa thử | Chờ máy |
| G7 | Windows: gỡ không tích "Xoá cả dữ liệu", cài lại | Đăng nhập lại là thấy đủ dữ liệu và thư mục hồ sơ | — | Chờ máy |
| G8 | Windows: gỡ có tích, xác nhận lần hai | Không còn `%APPDATA%\MCAH` và `Tài liệu\MCAH - Hồ sơ` | — | Chờ máy |
| G9 | Ubuntu: `sudo apt remove mcah-desktop`, cài lại | Dữ liệu còn nguyên | Chưa thử | — |
| G10 | Mở https://mcah.axalize.dev/download trên máy tính và điện thoại | Đúng bản mới nhất, ngày, ghi chú, SHA-256, dòng SmartScreen; nút tải đúng tệp | Đạt với latest.json mẫu trên máy dev; chờ server thật | — |
| G11 | Trong lúc đẩy bản mới lên server, app kiểm bản mới | Không bao giờ thấy latest.json trỏ tệp chưa có (không tải hỏng) | Chưa thử | Chờ máy |
