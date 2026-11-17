# MCAH — Testcase chạy tay: mã kích hoạt và trang quản trị Axalize

- Kế hoạch: `docs/mcah-ke-hoach-ma-kich-hoat.md`. Wireframe: `docs/design/wireframes/ma-kich-hoat.html`.
- Chạy trên máy dev: máy chủ dịch vụ dev (`cloud/`, `node scripts/dev-db.js` + `npm start`) và app Ubuntu dev nối máy chủ đó. Windows chạy khi có máy. Sau khi deploy, chạy lại nhóm K1–K8 trên `https://mcah.axalize.vn/tai-khoan/quan-tri`.
- Cột Ubuntu / Windows ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy. Trang quản trị là trang web nên chỉ có một cột.

## Chuẩn bị

- Một tài khoản Axalize có email trong `CLOUD_ADMIN_EMAILS` (gọi là **admin**), một tài khoản thường đã xác minh email (gọi là **khách A**), một tài khoản thường khác (**khách B**).
- Một văn phòng có sẵn từ trước (tạo trước khi có mã), có ít nhất một máy nhân viên đã nối.
- Một máy Ubuntu chưa có văn phòng (xoá dữ liệu app dev hoặc dùng hồ sơ dev mới).

## Trang quản trị

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| K1 | Mở `/tai-khoan/quan-tri` khi chưa đăng nhập; rồi đăng nhập bằng khách A | Chưa đăng nhập → về trang đăng nhập. Khách A → không vào được trang quản trị | Đạt ở test tự động |
| K2 | Đăng nhập bằng admin, mở `/quan-tri` | Thấy 3 tab Văn phòng / Mã kích hoạt / Nhật ký, email admin + Đăng xuất góc phải; văn phòng cũ hiện "Tạo trước khi có mã" | Đạt (máy chủ dev) |
| K3 | Tab Mã kích hoạt: bấm Tạo mã khi để trống Tên khách | Báo lỗi dưới ô Tên khách, chữ ở ô Ghi chú còn nguyên, không tạo mã | Đạt (máy chủ dev) |
| K4 | Nhập Tên khách "Khách thử K4", ghi chú "HĐ thử", bấm Tạo mã | Hiện mã dạng `MCAH-XXXX-XXXX-XXXX` + nút Chép + dòng "chỉ hiện lần này"; Chép dán ra đúng mã | Đạt (máy chủ dev); không có nút Chép, bấm vào mã là chọn hết |
| K5 | Ở trang mã vừa tạo, bấm F5 / quay lại rồi tiến | Không thấy lại mã đầy đủ (về danh sách hoặc trình duyệt hỏi gửi lại form; gửi lại thì ra **mã mới**, không lộ mã cũ) | Đạt ở test tự động (no-store; gửi lại form tạo mã mới) |
| K6 | Xem danh sách mã | Mã K4 hiện `…XXXX` (4 ký tự cuối), trạng thái Chưa dùng, người tạo là admin; bộ lọc Chưa dùng / Đã dùng / Đã huỷ đếm đúng | Đạt (máy chủ dev + test tự động) |
| K7 | Tạo thêm mã "Khách thử K7", bấm Huỷ mã, đồng ý | Trạng thái Đã huỷ kèm ngày và người huỷ; không còn nút Huỷ | Đạt ở test tự động |
| K8 | Tab Nhật ký | Có dòng Tạo mã (K4, K7), Huỷ mã (K7) đúng người, đúng giờ | Đạt (máy chủ dev) |
| K9 | Mở trang quản trị ở khung 375px | Không cuộn ngang cả trang; bảng cuộn ngang trong khung; tab và nút bấm được | Đạt (máy chủ dev, 375px) |

## Tạo văn phòng bằng mã (app)

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| K10 | Khách A đăng nhập trên máy chưa có văn phòng → Tạo văn phòng mới → để trống mã, bấm Tạo văn phòng | "Nhập mã kích hoạt"; nút vẫn bấm được | Chưa thử trên app; test giao diện Đạt | Chờ máy |
| K11 | Nhập mã sai một ký tự | "Mã kích hoạt không đúng. Kiểm lại mã MCAH đã gửi cho bạn." | Chưa thử trên app; API máy chủ dev Đạt | Chờ máy |
| K12 | Nhập mã đã huỷ (K7) | "Mã đã bị huỷ. Liên hệ MCAH." | Chưa thử trên app; test tự động Đạt | Chờ máy |
| K13 | Nhập mã K4 gõ chữ thường, có khoảng trắng, thay `0` bằng `O` | Tạo được văn phòng, vào app như hiện nay | Chưa thử trên app; API máy chủ dev Đạt | Chờ máy |
| K14 | Trang quản trị: tab Mã kích hoạt và tab Văn phòng | Mã K4 Đã dùng → tên văn phòng K13, ngày, email khách A. Văn phòng mới hiện "Khách thử K4 · …XXXX". Nhật ký có "Kích hoạt văn phòng" | Đạt (máy chủ dev) | — |
| K15 | Khách B, máy Ubuntu khác chưa có văn phòng, nhập lại mã K4 | "Mã này đã dùng cho một văn phòng khác. Liên hệ MCAH." | Chưa thử trên app; test tự động Đạt | Chờ máy |
| K16 | Khách B nhập mã sai 6 lần liền | Lần thứ 6: "Nhập sai quá nhiều lần, thử lại sau 1 giờ." (kể cả khi lần đó đúng mã) | Chưa thử trên app; test tự động Đạt | Chờ máy |
| K17 | Admin văn phòng K13 mời một người; người đó cài app, đăng nhập | Không bị hỏi mã; nối máy chính như hiện nay | | Chờ máy |
| K18 | Văn phòng cũ (tạo trước khi có mã): đăng nhập máy chính và máy nhân viên | Dùng bình thường, không bị hỏi mã | | Chờ máy |
| K19 | Đang ở bước Tạo văn phòng, rút mạng, bấm Tạo, cắm mạng, bấm lại | Lần đầu báo lỗi kết nối; lần sau tạo được, **không** báo "mã đã dùng" | Chưa thử trên app; test tự động Đạt (gọi lại không cần mã) | Chờ máy |

## Khoá / mở khoá văn phòng

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| K20 | Trang quản trị: bấm Khoá văn phòng K13, để trống lý do, bấm Khoá | Báo cần lý do, chưa khoá | Đạt ở test tự động | — |
| K21 | Nhập lý do "Thử K21", bấm Khoá | Văn phòng hiện "Đã khoá", nút thành Mở khoá; Nhật ký có dòng Khoá văn phòng + lý do | Đạt (máy chủ dev) | — |
| K22 | Máy chính K13 đang mở: bấm làm mới phiên hoặc chờ tối đa 1 giờ | App về màn đăng nhập với dải "Văn phòng … đang bị khoá… Dữ liệu trên máy vẫn còn nguyên" | Chưa thử trên app; test backend Đạt | Chờ máy |
| K23 | Máy nhân viên của K13, đăng nhập | Cùng dải lỗi, không vào được | Chưa thử trên app; test backend Đạt | Chờ máy |
| K24 | Ngay sau K21, trước khi máy chính K13 bị đưa ra (chưa tới lần làm mới): quét giấy tờ bằng AI, tra tàu theo IMO | Báo văn phòng đang bị khoá, không quét / tra được | | Chờ máy |
| K25 | Mở khoá (hỏi xác nhận), đăng nhập lại trên máy chính và máy nhân viên | Dùng tiếp, dữ liệu đủ như trước khi khoá; Nhật ký có dòng Mở khoá | | Chờ máy |
| K26 | Khoá văn phòng khi máy chính đang mất mạng; mở lại app khi vẫn mất mạng | Dùng tiếp tới hết mốc offline 7 ngày (giới hạn đã chấp nhận); có mạng lại thì bị đưa ra ở lần làm mới | | Chờ máy |
