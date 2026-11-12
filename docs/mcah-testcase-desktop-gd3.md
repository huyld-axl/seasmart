# MCAH — Testcase chạy tay: app máy tính, giai đoạn 3

- Kế hoạch: `docs/mcah-ke-hoach-desktop-gd3.md`. Wireframe: `docs/design/wireframes/desktop-gd3.html`.
- Chạy trên bản đã đóng gói và cài thật: 1 máy chính + 2 máy nhân viên, trộn Windows và Ubuntu, cùng một mạng văn phòng.
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy. D1–D13, E7 lấy từ kế hoạch tổng (mục 11).

## Chuẩn bị

- Máy chính đã tạo văn phòng (giai đoạn 2), có vài thuyền viên, tàu, hợp đồng, bill.
- Hai tài khoản nhân viên đã được mời (một vai trò thường, một quản trị).
- Một laptop lạ cùng Wi-Fi, chưa ghép (D3); Wireshark trên một máy (D4).
- Bộ cài bản kế tiếp có phiên bản giao tiếp khác, đã ký (D11).

## Testcase

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| D1 | Nhân viên được mời, đăng nhập trên máy mình | Tự tìm và ghép đúng máy chính (W1), vào được với đúng vai trò | Chưa thử | Chờ máy |
| E7 | Quản trị mời email mới với vai trò X; người đó đăng ký, đăng nhập trên máy mới | Ghép xong vào văn phòng với vai trò X; máy hiện ở Máy trong văn phòng (W2) | Chưa thử | Chờ máy |
| D2 | Dựng một máy giả cùng tên, cùng quảng bá mDNS với máy chính | Máy nhân viên hiện W7, không gửi gì | Chưa thử | Chờ máy |
| D3 | Laptop lạ gọi `https://<máy chính>:7443/api/...` (có hoặc không có vé của văn phòng khác) | Bị từ chối | Chưa thử | Chờ máy |
| D4 | Bắt gói tin khi máy nhân viên đang làm việc | Chỉ thấy TLS, không đọc được nội dung | Chưa thử | Chờ máy |
| D5 | Quản trị Gỡ một máy nhân viên **đang có phiên mở** | Thao tác kế tiếp trên máy đó bị từ chối, về màn đăng nhập; xin vào lại thì phải chờ duyệt | Chưa thử | Chờ máy |
| D6 | Tắt máy chính khi máy nhân viên đang gõ form | Dải đỏ (W3), nút lưu bị chặn, form giữ nguyên; bật lại thì dải xanh, lưu được | Chưa thử | Chờ máy |
| D7 | Đổi địa chỉ IP của máy chính | Máy nhân viên tự tìm lại theo tên máy, không hỏi gì | Chưa thử | Chờ máy |
| D8 | A và B cùng mở một thuyền viên; A đổi điện thoại, lưu; B đổi địa chỉ, lưu | B thấy W4, nội dung B còn nguyên; bấm "Lấy bản mới, giữ phần tôi đã đổi" rồi Lưu: có cả điện thoại của A và địa chỉ của B | Chưa thử | Chờ máy |
| D8b | Như D8 nhưng cả hai cùng đổi điện thoại | W4 hiện cả hai giá trị ở ô điện thoại để B chọn | Chưa thử | Chờ máy |
| D8c | D8 với tàu, hợp đồng, bill | Như D8 | Chưa thử | Chờ máy |
| D9 | Bấm "Thêm thuyền viên", cắt mạng nội bộ ngay sau khi máy chính lưu xong, nối lại và bấm lần nữa | Chỉ có một thuyền viên | Chưa thử | Chờ máy |
| D10 | Máy chính lên bản mới **cùng** phiên bản giao tiếp | Máy nhân viên bản cũ vẫn làm việc, không hiện W5 | Chưa thử | Chờ máy |
| D11 | Máy chính lên bản mới **khác** phiên bản giao tiếp; máy nhân viên **không có internet** | W5: tải từ máy chính, kiểm chữ ký, cài, nối lại | Chưa thử | Chờ máy |
| D11b | Như D11 nhưng bộ cài trên máy chính bị sửa một byte | Máy nhân viên báo chữ ký sai, không cài | Chưa thử | Chờ máy |
| D12 | Quét AI, xuất PDF, tra tàu, soạn thư có tệp đính kèm từ máy nhân viên | Chạy qua máy chính, kết quả như làm trên máy chính; trình thư của máy nhân viên mở kèm tệp | Chưa thử | Chờ máy |
| D13 | Máy chính Ubuntu, máy nhân viên Windows (và ngược lại) | Chạy như nhau | — | Chờ máy |
| G1 | Router chặn mDNS: máy nhân viên gõ tên máy rồi gõ IP ở W1 | Nối được cả hai cách | Chưa thử | Chờ máy |
| G2 | Windows: cài máy chính, máy nhân viên nối lần đầu | Không có hộp hỏi tường lửa; thẻ W6 báo đã mở cổng | — | Chờ máy |
| G3 | Để máy chính không đụng tới 1 giờ (MCAH đang mở) | Máy không ngủ; máy nhân viên vẫn nối được | Chưa thử | Chờ máy |
| G4 | Bản web: hai tab cùng sửa một thuyền viên | Như D8 (chống ghi đè cũng chạy ở bản web) | Chưa thử | — |
