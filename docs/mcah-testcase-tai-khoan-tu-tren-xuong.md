# MCAH — Testcase chạy tay: tài khoản từ trên xuống, đăng nhập không mật khẩu

- Kế hoạch: `docs/mcah-ke-hoach-tai-khoan-tu-tren-xuong.md`. Wireframe: `docs/design/wireframes/tai-khoan-tu-tren-xuong.html`.
- Chạy trên máy dev: máy chủ dịch vụ dev (thư mã in ra log khi chưa cấu hình SMTP) + app Ubuntu dev nối máy chủ đó; sau khi deploy chạy lại nhóm A và B trên `https://mcah.axalize.vn` với hộp thư thật. Windows khi có máy.
- Ghi: Đạt / Không đạt (kèm mô tả) / Chờ máy.

## Chuẩn bị

- Một tài khoản Axalize trong `CLOUD_ADMIN_EMAILS` (**admin Axalize**), hai hộp thư thật cho quản trị văn phòng (**QT**) và nhân viên (**NV**), một Gmail chưa có tài khoản MCAH (**lạ**).
- Hai máy Ubuntu chưa có dữ liệu MCAH (máy chính, máy nhân viên).

## A. Đăng nhập trên website

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| A1 | App → Đăng nhập qua trình duyệt | Trang chỉ có Tiếp tục với Google, ô Email + Tiếp tục với email; không có mật khẩu, Đăng ký, Quên mật khẩu | Đạt (máy chủ dev, trang web); chưa thử qua app | |
| A2 | Nhập email QT, Tiếp tục với email | Trang nhập mã; thư "Mã đăng nhập MCAH: …" tới trong 1 phút | Đạt (máy chủ dev, thư in ra log) | |
| A3 | Nhập sai mã | "Mã không đúng"; nhập đúng sau đó vẫn được (chưa quá 5 lần) | Đạt ở test tự động | |
| A4 | Nhập đúng mã | Trang "Đã đăng nhập", app tự vào (hoặc dán mã 8 ký tự) | | |
| A5 | Đợi quá 10 phút rồi nhập mã | "Mã đã hết hiệu lực, bấm Gửi lại mã" | Đạt ở test tự động | |
| A6 | Bấm Gửi lại mã ngay; rồi sau 60 giây | Lần đầu bị chặn ("thử lại sau …"); sau 60 giây gửi được, mã cũ không dùng được nữa | Đạt ở test tự động | |
| A7 | Email lạ, Tiếp tục với email | Vẫn hiện trang nhập mã, không có thư; nhập mã bất kỳ: "Mã không đúng" | Đạt ở test tự động | |
| A8 | Tiếp tục với Google bằng Gmail lạ | "Email … chưa có tài khoản MCAH…"; không có tài khoản mới ở tab Tài khoản của Axalize | Đạt ở test tự động (Google giả) | |
| A9 | Tiếp tục với Google bằng Gmail đã được tạo tài khoản | Vào được; tab Tài khoản ghi "Google" | | |
| A10 | Sai PIN 5 lần trong app | Trang web hiện "xác nhận lại", email khoá sẵn; phải nhập mã mới (hoặc Google hỏi lại) | | |
| A11 | Mở các địa chỉ cũ `/tai-khoan/dang-ky`, `/quen-mat-khau`, `/dat-lai`, `/moi?token=x` | 404 / về trang đăng nhập; không còn đăng ký được | Đạt ở test tự động | — |

## B. Trang quản trị Axalize

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| B1 | Thêm khách hàng thiếu Email quản trị | Lỗi dưới ô, chữ đã nhập còn nguyên | Đạt ở test tự động |
| B2 | Thêm khách hàng "Nam Hải Crew", email QT | Văn phòng "Chờ cài máy chính"; tab Tài khoản có QT "Chưa đăng nhập", người tạo là admin Axalize; không có thư nào gửi đi | Đạt (máy chủ dev) |
| B3 | Thêm khách hàng khác với email QT | "Email này đã thuộc một văn phòng khác" | Đạt ở test tự động |
| B4 | Thêm quản trị cho Nam Hải Crew (email thứ hai) | Tab Tài khoản có thêm dòng Quản trị của Nam Hải Crew | Đạt ở test tự động |
| B5 | Sau C1: xem tab Khách hàng, Tài khoản | Nam Hải Crew "Đang dùng"; QT "Đang dùng", đăng nhập gần nhất + cách | |
| B6 | Khoá tài khoản NV (có lý do) khi NV đang mở app | NV bị đưa ra trong vòng 1 giờ (hoặc bấm làm mới); đăng nhập lại báo "Tài khoản này đã bị khoá" (cả mã email lẫn Google) | |
| B7 | Mở khoá NV | NV đăng nhập lại dùng tiếp | |
| B8 | Khoá cả văn phòng, rồi mở khoá | Như testcase mã kích hoạt K21–K25 (mọi máy bị đưa ra, dữ liệu còn, mở là dùng tiếp) | |
| B9 | Tab Nhật ký | Có Thêm khách hàng, Thêm quản trị, Tạo tài khoản (do QT), Khoá / Mở khoá tài khoản và văn phòng kèm lý do | Đạt ở test tự động + máy chủ dev |
| B10 | Mở trang quản trị ở 375px | Không cuộn ngang cả trang; bảng cuộn trong khung | |

## C. Lần đầu và tạo tài khoản trong app

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| C1 | QT đăng nhập lần đầu trên máy chính | Màn "Cài máy chính cho Nam Hải Crew" → Dùng máy này làm máy chính → đặt PIN → vào app | | |
| C2 | QT: Quản trị → Tài khoản → Thêm tài khoản (email NV, họ tên, Môi giới) | Dòng mới "Chưa đăng nhập"; không có nút Gửi lại thư mời; tab Tài khoản của Axalize có NV, người tạo là QT | | |
| C3 | Thêm tài khoản khi máy chính mất mạng | Báo cần internet, không tạo gì | | |
| C4 | NV đăng nhập trên máy nhân viên | Không bị hỏi mật khẩu hay đăng ký; tìm và nối máy chính như hiện nay | | |
| C5 | Tạo khách hàng mới, nhân viên của họ đăng nhập **trước** khi QT cài máy chính | Màn "Văn phòng chưa có máy chính"; sau khi QT cài xong, bấm Thử lại thì nối được | | |
| C6 | QT tắt "Đăng nhập" của NV trong app | NV bị đưa ra; tab Tài khoản của Axalize hiện "Đã rời văn phòng" | | |
| C7 | Tài khoản không thuộc văn phòng nào đăng nhập app | "Tài khoản chưa thuộc văn phòng nào. Hỏi quản trị văn phòng." | | |
| C8 | Chuyển máy chính (luồng giai đoạn 4) sau thay đổi | Vẫn chạy như trước | | |
| C9 | Bản web (không phải app): Thêm tài khoản | Vẫn gửi thư mời + đặt mật khẩu như cũ | | — |

## D. Mã PIN tuỳ chọn, hạn 30 ngày

| # | Bước | Kết quả đúng | Ubuntu | Windows |
|---|---|---|---|---|
| D1 | Văn phòng mới, QT cài máy chính | Khoá bằng mã PIN theo mặc định (Q-T5); nếu Bật thì được hỏi đặt PIN | | |
| D2 | QT tắt Khoá bằng mã PIN; máy nhân viên đang mở | Trong vòng 1 giờ (hoặc mở lại app) máy nhân viên không còn tự khoá, không hỏi PIN | | |
| D3 | QT bật lại; NV mở app | NV được hỏi đặt PIN; để rỗi quá thời gian tự khoá thì app khoá, mở bằng PIN | | |
| D4 | Nhân viên (không phải quản trị) mở trang Máy trong văn phòng | Không thấy / không đổi được công tắc | | |
| D5 | PIN bật, sai PIN 5 lần | Phải đăng nhập lại qua trình duyệt (mã email mới / Google) | | |
| D6 | Giả giờ máy qua 30 ngày từ lần đăng nhập (máy dev: `MCAH_FAKE_NOW`), có mạng | App về màn đăng nhập "Đã 30 ngày từ lần đăng nhập trước…"; đăng nhập lại dùng tiếp, dữ liệu còn | | |
| D7 | Còn 2 ngày tới mốc 30 ngày | Dải vàng nhắc phải đăng nhập lại | | |
| D8 | Mất mạng từ ngày 27 sau lần đăng nhập | App vẫn bắt đăng nhập lại ở mốc 30 ngày (không kéo tới 7 ngày offline) | | |

