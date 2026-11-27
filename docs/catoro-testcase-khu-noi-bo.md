# Catoro — Testcase khu nội bộ `/internal/` và đổi đường dẫn tiếng Anh

- **Kế hoạch:** `docs/catoro-ke-hoach-khu-noi-bo.md`
- **Chạy ở:** máy dev bằng `docker compose` (có nginx + `htpasswd` thử), rồi lặp lại trên `https://mcah.axalize.vn`.
- **Chuẩn bị:** `CLOUD_ADMIN_EMAIL` đã đặt; đã chạy `scripts/admin.js set-password`; điện thoại có Google Authenticator; tệp `htpasswd` một dòng; **bản app máy tính cũ** (đang phát hành) và **bản mới**.

## A. Basic Auth

| # | Bước | Mong đợi |
|---|---|---|
| A1 | Mở `/internal/admin` ở cửa sổ ẩn danh | Hộp Basic Auth của trình duyệt |
| A2 | Huỷ hộp / nhập sai | 401, không thấy nội dung quản trị |
| A3 | Nhập đúng | Màn đăng nhập quản trị (W2) |
| A4 | Ẩn danh, chưa qua Basic Auth: mở `/internal/`, `/internal/login`, `/internal/design-system/` | Cả ba đều hỏi Basic Auth trước |
| A5 | Gỡ tệp `htpasswd` khỏi container, mở `/internal/` | 500 (đóng); `/login`, `/guide/` vẫn bình thường |

## B. Lần đầu: mật khẩu + cài 2FA

| # | Bước | Mong đợi |
|---|---|---|
| B1 | Trước khi chạy `set-password`: W2 nhập email admin + mật khẩu bất kỳ | "Email hoặc mật khẩu không đúng" |
| B2 | Chạy `set-password`, nhập mật khẩu 8 ký tự | Lệnh từ chối (tối thiểu 12) |
| B3 | Đặt mật khẩu hợp lệ; W2 nhập email khác + đúng mật khẩu | "Email hoặc mật khẩu không đúng" |
| B4 | W2 nhập đúng email + mật khẩu | Sang W4: QR + chuỗi bí mật + giờ server |
| B5 | Mở thẳng `/internal/login/setup` ở cửa sổ khác (chưa qua W2) | Về W2 |
| B6 | Quét QR bằng Google Authenticator | App hiện mục "Catoro internal" kèm email |
| B7 | Nhập mã sai | Báo sai, vẫn ở W4 |
| B8 | Nhập mã đúng | W5 hiện 8 mã khôi phục; tải lại trang không hiện lại |
| B9 | Bấm "Tôi đã lưu" | Vào `/internal/admin`; Audit log có `admin_password_set`, `admin_2fa_enroll` |

## C. Đăng nhập hằng ngày

| # | Bước | Mong đợi |
|---|---|---|
| C1 | Đăng xuất; W2 email + mật khẩu đúng → W3 mã đúng | Vào trang quản trị; nhật ký `admin_login` |
| C2 | Đăng nhập lại, dùng lại đúng mã vừa dùng (trong cùng 30 giây) | Bị từ chối |
| C3 | Sai tổng cộng 5 lần (trộn mật khẩu sai và mã sai) | Lần 6: "Sai quá nhiều lần, thử lại sau 15 phút", kể cả khi nhập đúng |
| C4 | W3 → "Mất điện thoại?" → mã khôi phục | Vào được; báo còn 7 mã; nhật ký `admin_recovery_used` |
| C5 | Dùng lại mã khôi phục vừa dùng | Bị từ chối |
| C6 | Qua W2 rồi để quá 5 phút mới nhập mã | Về W2 |
| C7 | Sửa tay cookie `mcah_admin` | Về W2 |
| C8 | Quá 8 giờ (hoặc chỉnh hạn ngắn ở máy dev) | Về W2 |
| C9 | Đổi `CLOUD_ADMIN_EMAIL` sang email khác, khởi động lại cloud, tải lại trang đang mở | Về W2 |

## D. Lệnh trên server

| # | Bước | Mong đợi |
|---|---|---|
| D1 | Đang đăng nhập ở trình duyệt X; chạy `set-password` đổi mật khẩu | Trang ở X tải lại thì về W2; mật khẩu cũ không còn dùng được |
| D2 | Chạy `reset-2fa`; tải lại trang ở X | Về W2; đăng nhập đi lại W4; mã cũ trong app Authenticator không dùng được |
| D3 | Kiểm lịch sử shell sau `set-password` | Không thấy mật khẩu |

## E. Trang quản trị và design system

| # | Bước | Mong đợi |
|---|---|---|
| E1 | Mở `/tai-khoan/quan-tri`, `/tai-khoan/quan-tri/nhat-ky`, `/tai-khoan/quan-tri/tai-khoan?q=x` | 301 sang `/internal/admin`, `/internal/admin/audit-log`, `/internal/admin/accounts?q=x` |
| E2 | Đi các tab; khoá / mở khoá một văn phòng thử; thêm khách | Hoạt động như trước; mọi liên kết và form đều dưới `/internal/admin…` |
| E3 | Bấm tab Design system | Mở `/internal/design-system/`, đủ các mục |
| E4 | Đã qua Basic Auth nhưng chưa đăng nhập quản trị, mở `/internal/design-system/` | Về `/internal/login?next=…`; xong quay lại đúng trang |
| E5 | Mở `/design-system` trên web và trong app máy tính | Trang 404 của app |
| E6 | `curl -I` một trang dưới `/internal/` | Có `X-Robots-Tag: noindex`, `Cache-Control: no-store` |

## F. Đường dẫn mới và đường cũ

| # | Bước | Mong đợi |
|---|---|---|
| F1 | Ẩn danh mở `/login`, `/guide/`, `/release-notes/`, `/download/`, `/legal/terms`, `/legal/privacy`, `/account/login` | Mở được, không hỏi Basic Auth |
| F2 | Mở `/huong-dan/index#<một neo>`, `/phat-hanh/index` | 301 sang `/guide/…#neo`, `/release-notes/…` |
| F3 | Mở `/tai-khoan/dieu-khoan`, `/tai-khoan/quyen-rieng-tu` | 301 sang `/legal/terms`, `/legal/privacy` |
| F4 | Mở link `/dat-mat-khau?token=<token thật từ thư mời>` | Sang `/set-password?token=…`, đặt được mật khẩu |
| F5 | Đã đăng nhập web: mở `/cai-dat-may`, `/admin/may-trong-van-phong` | Sang `/device-settings`, `/admin/devices` |
| F6 | Mời người mới | Thư có link `/set-password?token=…` |
| F7 | `curl` `/health`, `/account/health`, `/tai-khoan/health`, `/account/.well-known/mcah-keys`, `/tai-khoan/.well-known/mcah-keys`, `/download/files/latest.json` | Như trước, không 401 / 404 |

## G. App máy tính

| # | Bước | Mong đợi |
|---|---|---|
| G1 | **Bản cũ**: đăng nhập bằng Google | Thành công; trang cuối là trang "xong" (đi qua `/tai-khoan/xong` → `/account/done`) |
| G2 | **Bản cũ**: đăng nhập bằng mã email; quét AI một trang; tra tàu IMO | Thành công |
| G3 | **Bản cũ**: bấm Hướng dẫn, "Có gì mới" | Mở đúng trang (qua 301) |
| G4 | **Bản mới**: lặp G1–G3 | Thành công, đi thẳng `/account/…`, `/guide/`, `/release-notes/` |
| G5 | **Bản mới**: máy chưa có văn phòng | Màn thiết lập ở `/setup` |
| G6 | **Bản cũ**: sau khi phát bản mới (`latest.json` mang `cloud_url` `/account`), bấm Kiểm tra cập nhật nhưng **chưa cài** | App ghi đã đổi địa chỉ máy chủ; đăng nhập lại đi `/account/…` |
| G7 | **Bản mới**: bấm Hướng dẫn, "Có gì mới" trong app | Mở trình duyệt ở `/guide/…?app=1`, `/release-notes/…?app=1` (đúng `#neo`) |
| G8 | Web app: đăng nhập, mở vài trang nhóm 1 | Bình thường |
| G9 | Người dùng thường đăng nhập app bằng mã email (luồng không mật khẩu của `faf725e`) qua `/account/login` | Thư mã đến, vào được; không có ô mật khẩu nào xuất hiện |
