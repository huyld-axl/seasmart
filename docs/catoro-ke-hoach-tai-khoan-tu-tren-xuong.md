# Catoro — Kế hoạch tài khoản từ trên xuống, đăng nhập không mật khẩu

- **Ngày lập:** 2026-11-17
- **Trạng thái:** đã duyệt 2026-11-17 (Q-T1, Q-T2, Q-T5 theo đề xuất; Q-T3, Q-T4 theo đề xuất); code bước 1–5b, 7 (phần tài liệu). Chờ: chạy app Electron trọn luồng trên Ubuntu / Windows (bước 6), Q-L2 (liên hệ Catoro), push, deploy `cloud/` rồi phát bản app (bước 7 ⛔).
- **Thay cho:** `docs/catoro-ke-hoach-ma-kich-hoat.md` (mã kích hoạt). Phần mã kích hoạt đã code ở commit `05ead6a` (chưa push, chưa deploy) sẽ được gỡ; phần **giữ lại**: khoá văn phòng chặn dùng app (Q-L1 = A), trang quản trị có nhật ký, khoá có lý do.
- **Kế hoạch tổng:** `docs/catoro-ke-hoach-ung-dung-may-tinh.md` (Q11–Q13 tài khoản trên máy chủ dịch vụ, M8).
- **Wireframe:** `docs/design/wireframes/tai-khoan-tu-tren-xuong.html` (10 màn).
- **Testcase chạy tay:** `docs/catoro-testcase-tai-khoan-tu-tren-xuong.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/catoro-huong-dan-tai-khoan-tu-tren-xuong.html`.
- **Mục tiêu:** app máy tính không còn đăng ký, mật khẩu hay mã kích hoạt.
  1. Axalize tạo **khách hàng** = văn phòng + tài khoản quản trị văn phòng.
  2. Quản trị văn phòng tạo **tài khoản nhân viên** trong app.
  3. Mọi người đăng nhập trên website bằng **Google** hoặc **mã 6 số gửi qua email** (giống app Claude); website trao mã cho app như hiện nay.
  4. Axalize thấy mọi tài khoản và khoá được từng người hoặc cả văn phòng.
  5. Mã PIN thành **tuỳ chọn của cả văn phòng** (quản trị bật / tắt); phiên đăng nhập có **hạn cứng 30 ngày**, hết hạn phải đăng nhập lại qua trình duyệt.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng, `docs/catoro-quy-trinh-phat-hanh.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả việc trên `dev` (gộp với commit mã kích hoạt `05ead6a` chưa push). Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. **Bản web giữ nguyên** (mời bằng thư + đặt mật khẩu ở backend bản web). Chỉ đổi máy chủ dịch vụ (`cloud/`) và phần app máy tính.

## 1. Đã có

| Có rồi | Ở đâu | Số phận |
|---|---|---|
| App mở trình duyệt (PKCE), website trả mã về `127.0.0.1` hoặc hiện mã 8 ký tự để dán | `desktop/src/browser-login.js`, `cloud/src/routes/web.js` `/authorize`, `/token` | **Giữ nguyên** |
| Đăng nhập Google (OIDC, `prompt=select_account` / `login`) | `cloud/src/services/google.js` | Giữ; **bỏ tự tạo tài khoản** khi email chưa có |
| Đăng nhập mật khẩu, đăng ký, xác minh email, quên / đặt lại mật khẩu | `web.js`, `accounts.js`, `pages.js` | **Bỏ** |
| Mời bằng thư (`/api/office/invites`, `/moi`, `invite`) | `offices.js`, `api.js`, `web.js`, backend `user.service.js` | **Bỏ** cho app máy tính; thay bằng tạo tài khoản trực tiếp |
| Tạo văn phòng trong app (tên + mã kích hoạt), bảng `activation_code` | commit `05ead6a` | **Bỏ**; thay bằng Axalize tạo khách |
| Khoá văn phòng chặn app (`OFFICE_LOCKED`), trang xác nhận khoá có lý do, tab Nhật ký | commit `05ead6a` | **Giữ** |
| Chuyển máy chính, ghép máy nhân viên, PIN, offline 7 ngày | giai đoạn 2–4 | Giữ nguyên |
| Gửi thư (SMTP) | `cloud/src/services/mailer.js` | Giữ, chỉ còn thư **mã đăng nhập** và thư báo chuyển máy chính |

## 2. Phạm vi

### 2.1 Làm

1. **Đăng nhập không mật khẩu** (3.1, W1–W3): Google hoặc mã 6 số qua email.
2. **Axalize tạo khách hàng** (3.2, W4): văn phòng + quản trị; thêm quản trị cho văn phòng có sẵn.
3. **Axalize thấy và khoá từng tài khoản** (3.3, W5).
4. **Quản trị văn phòng tạo tài khoản trong app** (3.4, W6).
5. **Lần đầu đăng nhập**: quản trị cài máy chính (W7), nhân viên khi chưa có máy chính (W8) (3.5).
6. **Gỡ** đăng ký, mật khẩu, thư mời, mã kích hoạt (3.6).
7. **Mã PIN tuỳ chọn theo văn phòng** (3.7, W9).
8. **Hạn cứng 30 ngày** (3.8, W10).

### 2.2 Không làm

- Subdomain `admin.mcah.axalize.vn` + basic auth (để sau, như đã chốt).
- SSO công ty (Okta, Azure AD…), passkey.
- Gói, giới hạn số tài khoản, giá (để sau; bảng tài khoản đã đủ để đếm khi cần).
- Đổi bản web.

### 2.3 Cần chốt trước khi code

- **⛔ Q-T1 — "Tiếp tục với email" khi email chưa có tài khoản.** Đề xuất: vẫn hiện trang nhập mã, **không gửi thư**, không nói email chưa có (người ngoài không dò được email nào là khách Catoro). Trang có dòng "Không thấy thư… email này có thể chưa được tạo tài khoản, hỏi quản trị văn phòng". Cách khác: báo thẳng "Email này chưa có tài khoản Catoro".
- **⛔ Q-T2 — Tạo tài khoản có gửi thư báo không** ("Bạn đã có tài khoản Catoro, tải app ở …, đăng nhập bằng email này"). Đề xuất: **không** (theo ý không gửi thư ngoài mã đăng nhập); người tạo tự báo.
- **Q-T3 — Axalize thêm quản trị cho văn phòng có sẵn** (quản trị cũ nghỉ, mất email). Đề xuất: có (nút Thêm quản trị, W4).
- **Q-T4 — Tài khoản đang có mật khẩu** (chỉ là tài khoản thử nội bộ): bỏ mật khẩu luôn, đăng nhập bằng Google / mã email như mọi người.
- **Q-T5 — Mặc định của Khoá bằng mã PIN** cho văn phòng mới. Đề xuất: **Bật** (giữ như hiện nay; quản trị tắt nếu không cần).
- **Q-L2 (còn từ kế hoạch mã kích hoạt)** — liên hệ Catoro hiện trong app / website: số điện thoại, email, Zalo nào?

## 3. Thiết kế

### 3.1 Đăng nhập không mật khẩu (W1–W3)

**Trang `/dang-nhap`** (W1): nút "Tiếp tục với Google", ô Email + "Tiếp tục với email". Không còn ô mật khẩu, Đăng ký, Quên mật khẩu. Đăng nhập lại bắt buộc (`max_age=0`, sau 5 lần sai PIN): email điền sẵn và khoá như hiện nay (`mcah_last`), Google `prompt=login`.

**Mã email** (W2), bảng mới `login_code`:

| Cột | Ghi chú |
|---|---|
| `id`, `email CITEXT`, `code_hash` | Băm (SHA-256 + `email` làm muối) của mã 6 số |
| `account_id` | Tài khoản lúc gửi (null nếu email chưa có — không gửi, chỉ ghi để đếm) |
| `created_at`, `expires_at` (10 phút), `attempts`, `used_at`, `ip` | |

- `POST /dang-nhap/email`: chuẩn hoá email; tài khoản có, chưa khoá → sinh mã `crypto.randomInt(0, 1e6)` 6 chữ số, huỷ mã cũ chưa dùng của email đó, gửi thư. Luôn chuyển tới `/dang-nhap/ma` (cookie ký `mcah_otp` = email, 10 phút) dù email có tài khoản hay không (Q-T1).
- `POST /dang-nhap/ma`: mã đúng, chưa hết hạn, `attempts < 5` → `finishLogin` (giữ nguyên: trao mã cho app, xoá phiên trình duyệt). Sai → `attempts + 1`, báo "Mã không đúng"; đủ 5 → "Mã đã hết hiệu lực, bấm Gửi lại mã". Lần đầu đăng nhập thành công đặt `email_verified_at`.
- `POST /dang-nhap/gui-lai`: chặn nếu mã trước gửi chưa đủ 60 giây; tối đa 5 thư / email / giờ, 20 / IP / giờ (đếm trong `login_code`).
- Thư: tiêu đề `Mã đăng nhập Catoro: 481072`, thân: mã, hạn 10 phút, "Không phải bạn thì bỏ qua thư này". Không có liên kết.
- Trang là HTML thường (CSP cấm script): một ô `inputmode="numeric" autocomplete="one-time-code" maxlength="6"`.

**Google** (W3): `google.accountFor` chỉ nhận tài khoản đã có (theo `google_sub`, hoặc email trùng thì gắn `google_sub`); email chưa có → trang đăng nhập với lỗi "Email … chưa có tài khoản Catoro. Hỏi quản trị văn phòng…". Không tạo tài khoản.

**Tài khoản bị khoá** (`account.disabled_at`): cả hai cách đều báo "Tài khoản này đã bị khoá. Liên hệ quản trị."; làm mới vé (`/token` refresh) đã từ chối tài khoản khoá (`oauth.js`) → app về màn đăng nhập (đã có: refresh lỗi 4xx thì bỏ phiên).

**Ghi lần đăng nhập:** thêm `account.last_login_at`, `account.last_login_method` (`google` / `email_code`), đặt trong `finishLogin`.

### 3.2 Axalize tạo khách hàng (W4)

- `office` thêm `note TEXT` (tên công ty, số hợp đồng…). Văn phòng tạo trên trang quản trị **chưa có máy chính** (không có dòng `office_machine`) → trạng thái "Chờ cài máy chính".
- `POST /quan-tri/khach` (Tên văn phòng*, Ghi chú, Email quản trị*, Họ tên quản trị*), một transaction: tìm / tạo `account` (email chưa có thì tạo, `password_hash` null, `created_by` = admin Axalize); tài khoản đã thuộc văn phòng khác đang hoạt động → lỗi dưới ô Email; tạo `office` + `office_member` role `admin`; audit `customer_create` (detail: tên văn phòng · email).
- `GET/POST /quan-tri/khach/:id/quan-tri` (Q-T3): thêm một quản trị (email + họ tên) cho văn phòng có sẵn, cùng quy tắc.
- Tab "Khách hàng" thay tab "Văn phòng" + "Mã kích hoạt": thêm cột Trạng thái (Chờ cài máy chính / Đang dùng / Đã khoá), Tài khoản (số), ghi chú dưới tên. Giữ cảnh báo dùng bất thường, khoá / mở khoá có lý do.
- `account` thêm `created_by UUID` (Axalize admin hoặc quản trị văn phòng tạo).

### 3.3 Axalize thấy và khoá từng tài khoản (W5)

- Tab "Tài khoản": mọi `account` kèm văn phòng hiện tại + vai trò, người tạo (email), đăng nhập gần nhất + cách, trạng thái: **Chưa đăng nhập** (`last_login_at` null) / **Đang dùng** / **Đã rời văn phòng** (không còn `office_member` đang hoạt động) / **Đã khoá** (`disabled_at`). Tìm (form GET), lọc Tất cả / Chưa đăng nhập / Đã khoá.
- Khoá / Mở khoá tài khoản: trang xác nhận, lý do bắt buộc khi khoá; đặt `account.disabled_at`, **thu hồi mọi refresh token** của tài khoản (máy đang mở bị đưa ra ở lần làm mới, tối đa 1 giờ); audit `account_lock` / `account_unlock`.
- Nhật ký thêm các việc: Thêm khách hàng, Thêm quản trị, Tạo tài khoản (do quản trị văn phòng), Khoá / Mở khoá tài khoản.

### 3.4 Quản trị văn phòng tạo tài khoản trong app (W6)

- Máy chủ dịch vụ: `POST /api/office/members` (chữ ký máy chính, thay `/api/office/invites`): `{ email, full_name, role, created_by_email }` → tìm / tạo `account`, thêm `office_member`; email thuộc văn phòng khác → 409 "Email này đã thuộc một văn phòng khác. Liên hệ Catoro."; audit `member_create`. Không gửi thư (Q-T2). Giữ `members/remove`, `members/restore`.
- Backend máy chính `user.service.js` `createUser` (nhánh app máy tính): gọi `/api/office/members` thay `/api/office/invites`, rồi tạo dòng `user` như hiện nay (gắn `cloud_account_id` ở lần đăng nhập đầu theo email, đã có). `resendInvite` (nhánh app máy tính) bỏ; giao diện ẩn "Gửi lại thư mời" khi `isDesktop()`.
- Giao diện (`UserListPage` + panel): chữ "Mời" → "Thêm tài khoản"; trạng thái PENDING hiện "Chưa đăng nhập" khi `isDesktop()`; dòng hướng dẫn trong panel (W6). Bản web không đổi.

### 3.5 Lần đầu đăng nhập (W7, W8)

- Vé thêm `office_has_machine` (văn phòng đã có máy chính chưa). Backend `/desktop-ticket` trên máy chưa có văn phòng trả `needs_office` + `account` (đã có) + thêm `office_has_machine`, `office_role`.
- `FirstRunPage`:
  - `office` có, **chưa có máy chính**, vai trò `admin` → W7 "Cài máy chính cho …" → `session.setupMainMachine()`: `POST /api/offices/:id/machine` (đã có cho chuyển máy chính; nới điều kiện: văn phòng chưa có máy thì không cần `auth_time` ≤ 10 phút) → làm mới vé → `/desktop-office` (đã có) → vào app.
  - `office` có, chưa có máy chính, vai trò nhân viên → W8 (Thử lại = làm mới vé rồi kiểm lại).
  - `office` có, đã có máy chính → ghép máy chính (`PairPanel`, đã có).
  - Không có `office` → "Tài khoản chưa thuộc văn phòng nào. Hỏi quản trị văn phòng." (Không còn nhánh tự tạo văn phòng.)
- `POST /api/offices` (tạo văn phòng từ app) **bỏ**.

### 3.6 Gỡ bỏ

- `cloud/`: route `/dang-ky`, `/xac-minh`, `/gui-lai-xac-minh`, `/quen-mat-khau`, `/dat-lai`, `POST /dang-nhap` (mật khẩu), `/moi`, `/api/offices` (POST), `/api/office/invites*`, `/quan-tri/ma*`; `accounts.register / login / resendVerify / verifyEmail / requestReset / resetPassword`, `offices.invite / revokeInvite / findInvite / acceptInvite`, `services/activation.js`; trang `register / checkEmail / forgot / reset`; thư xác minh, đặt lại, mời.
- Migration `004_activation_code.sql` **chưa phát hành → viết lại** thành `004_passwordless.sql` (`login_code`, `account.created_by / last_login_at / last_login_method`, `office.note`, `audit.detail`, xoá `password_hash` cũ: `UPDATE account SET password_hash = NULL`). DB dev đã chạy `004` cũ (`mcah_cloud_test`, `mcah_cloud_ui` trên máy dev) thì xoá và tạo lại. Bảng `invite`, `email_token`, cột `password_hash` để nguyên (không còn dùng), dọn ở một migration sau khi chắc chắn.
- App: ô mã kích hoạt, màn tạo văn phòng (tên); `createOffice` trong `session.js` / IPC thay bằng `setupMainMachine`.
- Test: viết lại `cloud/test/accounts_oauth.test.js`, `offices.test.js`, `activation.test.js` (→ `passwordless.test.js`, `customers.test.js`).

### 3.7 Mã PIN tuỳ chọn theo văn phòng (W9)

PIN **không thay cho đăng nhập**: chỉ mở khoá màn hình app khi người dùng rời máy; đăng nhập luôn qua trình duyệt (3.1) và hết hạn sau 30 ngày (3.8).

- Lưu ở máy chính: `office_info.pin_required BOOLEAN` (mặc định theo Q-T5), `office_info.lock_minutes` (5–60, mặc định 15; chuyển từ cài đặt từng máy về cấp văn phòng). Backend: `GET/PUT /api/v1/office-settings/security` (chỉ quản trị, quyền `system.manage` hoặc tương đương đang dùng cho Máy trong văn phòng).
- Mọi máy biết cài đặt qua kết quả `/desktop-ticket` (thêm `pin_required`, `lock_minutes`) ở lần đăng nhập và mỗi lần làm mới phiên (mỗi giờ); máy nhân viên nhận qua máy chính như hiện nay.
- `desktop/src/pin.js` + tiến trình chính: `pin_required = false` → không hỏi đặt PIN, không tự khoá, xoá `pin.bin`; `true` → chưa có PIN thì hỏi đặt ngay (màn đặt PIN đã có), tự khoá theo `lock_minutes`.
- Giao diện: thẻ "Bảo vệ khi rời máy" trên trang Máy trong văn phòng, công tắc `ToggleRow` + chọn thời gian tự khoá; mục tự khoá trong "Cài đặt trên máy này" bỏ (hoặc chỉ hiện để xem, ghi "do quản trị văn phòng đặt").
- Sai PIN 5 lần vẫn bỏ phiên và bắt đăng nhập lại qua trình duyệt (`max_age=0`).

### 3.8 Hạn cứng 30 ngày (W10)

- Máy chủ dịch vụ: `/token` refresh từ chối khi `auth_time` (lần đăng nhập thật qua trình duyệt, đã lưu theo họ refresh token) cũ hơn 30 ngày → `invalid_grant` "Đã 30 ngày từ lần đăng nhập trước, đăng nhập lại". Refresh token không còn tự kéo dài 90 ngày: hạn = `auth_time + 30 ngày`.
- Vé: `exp = min(now + 7 ngày, auth_time + 30 ngày)` (mốc offline không vượt mốc 30 ngày). Backend máy chính đã từ chối JWT quá `offline_until` → app tự về màn đăng nhập ở mốc này kể cả khi mất mạng.
- App: lý do `expired` ở màn đăng nhập (W10); dải nhắc khi còn 2 ngày (gộp dải nhắc offline đã có: nhắc theo mốc gần hơn).
- Hằng số `SESSION_MAX_DAYS = 30` ở `cloud/src/config.js`.

## 4. File sẽ sửa / thêm

| Phần | File |
|---|---|
| cloud | `migrations/004_*.sql`, `src/routes/web.js`, `src/routes/admin.js`, `src/routes/api.js`, `src/services/accounts.js`, `src/services/offices.js`, `src/services/google.js`, `src/services/oauth.js` (vé thêm `office_has_machine`, từ chối tài khoản khoá), `src/services/mailer.js` (thư mã), `src/services/login_codes.js` (mới), `src/views/pages.js`, test |
| backend | `src/routes/v1/desktop_ticket.routes.js` (`needs_office` thêm thông tin; trả `pin_required`, `lock_minutes`), `src/services/user.service.js`, route cài đặt bảo mật văn phòng, migration `office_info.pin_required / lock_minutes`, test |
| desktop | `src/session.js` (`setupMainMachine`, lý do `expired`, cài đặt PIN từ vé), `src/pin.js` + `src/main.js` (bật / tắt tự khoá), `src/settings.js`, `src/ipc.js`, `src/preload.js` |
| frontend | `pages/desktop/FirstRunPage.jsx` (W7, W8), `pages/admin/devices/DevicesPage.jsx` (W9), `pages/desktop/DesktopLoginPage.jsx` (W10), trang Cài đặt trên máy này (bỏ tự khoá), `lib/desktop.js`, `pages/admin/users/UserListPage.jsx` + panel (chữ, trạng thái khi `isDesktop()`), trang hướng dẫn |
| tài liệu | `docs/catoro-huong-dan-server-may-chu-dich-vu.md` (trang quản trị mới, SMTP bắt buộc cho mã đăng nhập), kế hoạch tổng (Q11–Q13), `docs/catoro-ke-hoach-ma-kich-hoat.md` (ghi "đã thay") |

## 5. Rủi ro riêng

| Rủi ro | Cách xử lý |
|---|---|
| Thư mã đến chậm / vào Thư rác | Hạn 10 phút, Gửi lại mã sau 60 giây, dòng nhắc Thư rác; tiêu đề có sẵn mã. **SMTP thành bắt buộc** cho máy chủ dịch vụ: kiểm ở bước 7 (SPF/DKIM của tên miền gửi) |
| Dò mã 6 số | 5 lần sai / mã, 5 thư / email / giờ, 20 / IP / giờ, giới hạn tốc độ route |
| Dò email nào là khách | Q-T1: không báo email chưa có tài khoản ở luồng email |
| Mất quyền vào email = mất tài khoản | Axalize / quản trị văn phòng tạo tài khoản email mới, bỏ tài khoản cũ khỏi văn phòng |
| Quản trị văn phòng nghỉ việc | Q-T3: Axalize thêm quản trị |
| Máy mất mạng không nhận được khoá tài khoản | Đã chấp nhận (mốc offline 7 ngày) |
| Thay đổi lớn ở luồng đăng nhập | Bản web không đổi; test tự động đủ trường hợp; chạy testcase tay trên Ubuntu trước khi phát |

## 6. Test tự động

- cloud: gửi mã (tài khoản có / chưa có / bị khoá — trang giống nhau, chỉ có tài khoản mới có thư), mã đúng / sai / hết hạn / sai 5 lần / dùng lại, giới hạn gửi lại 60 giây và 5 thư / giờ, mã cũ bị huỷ khi gửi mã mới; đăng nhập xong trao mã cho app (PKCE như cũ) và đặt `email_verified_at`, `last_login_*`; `max_age=0` bắt nhập mã mới; Google email chưa có → không tạo tài khoản; tài khoản khoá → không đăng nhập, refresh bị từ chối; route cũ (`/dang-ky`, `/quen-mat-khau`, `POST /dang-nhap` mật khẩu, `/moi`, `POST /api/offices`) trả 404; trang quản trị: thêm khách (thiếu trường, email thuộc văn phòng khác), thêm quản trị, tab Tài khoản (trạng thái), khoá tài khoản thu hồi refresh; `POST /api/office/members` (chữ ký, email thuộc văn phòng khác).
- backend: `createUser` nhánh app gọi `/api/office/members`; `desktop-ticket` trả `office_has_machine`.
- desktop: `setupMainMachine` gọi đúng thứ tự; `pin_required` tắt thì không tự khoá và xoá PIN, bật thì bắt đặt PIN.
- cloud: refresh từ chối khi `auth_time` quá 30 ngày; `exp` của vé không vượt `auth_time + 30 ngày`.
- frontend: `FirstRunPage` ba nhánh (W7, W8, chưa có văn phòng).

## 7. Các bước

### Bước 0 — Duyệt
**⛔ DỪNG** người dùng duyệt wireframe + kế hoạch, trả lời Q-T1, Q-T2 (Q-T3, Q-T4, Q-T5 theo đề xuất nếu không có ý khác), Q-L2 nếu đã có.

### Bước 1 — Gỡ mã kích hoạt, migration mới (3.6)
**Xong khi:** không còn `activation`; `004` mới chạy trên DB dev tạo lại; test cloud còn lại qua.

### Bước 2 — Đăng nhập không mật khẩu (3.1, W1–W3)
**Xong khi:** test tự động 3.1 qua; trên máy chủ dev: đăng nhập bằng mã (thư in ra log khi `SMTP_HOST` trống) và Google (nếu có cấu hình) trao mã cho app.

### Bước 3 — Trang quản trị: Khách hàng, Tài khoản (3.2, 3.3, W4, W5)
**Xong khi:** trên máy chủ dev: thêm khách, thêm quản trị, khoá / mở khoá tài khoản, nhật ký đủ dòng; 375px không cuộn ngang trang.

### Bước 4 — Tạo tài khoản trong app (3.4, W6)
**Xong khi:** test backend qua; trên app dev: thêm tài khoản → thấy ngay trên tab Tài khoản của Axalize.

### Bước 5 — Lần đầu đăng nhập (3.5, W7, W8)
**Xong khi:** app Ubuntu dev nối máy chủ dev: quản trị cài máy chính, nhân viên nối máy chính; nhân viên đăng nhập trước khi có máy chính thấy W8.

### Bước 5b — PIN tuỳ chọn, hạn 30 ngày (3.7, 3.8, W9, W10)
**Xong khi:** test tự động qua; trên app dev: tắt PIN → máy nhân viên không còn tự khoá ở lần làm mới; bật lại → bị hỏi đặt PIN; giả giờ (`MCAH_FAKE_NOW`) qua mốc 30 ngày → về màn đăng nhập với W10.

### Bước 6 — Testcase tay
Chạy `docs/catoro-testcase-tai-khoan-tu-tren-xuong.md` trên Ubuntu (Windows khi có máy).

### Bước 7 — Hướng dẫn, Nhật ký, phát hành
Hướng dẫn trong app, hướng dẫn server (SMTP bắt buộc), kế hoạch tổng, Nhật ký. **⛔ DỪNG** hỏi trước khi push, deploy `cloud/` (trước) và phát bản app (sau).

## 8. Nhật ký

- 2026-11-17: người dùng chốt: bỏ đăng ký trên app; tài khoản từ trên xuống (Axalize → quản trị văn phòng → nhân viên); không mật khẩu, đăng nhập như app Claude (Google hoặc mã 6 số qua email); bỏ mã kích hoạt, Axalize tạo tài khoản kèm văn phòng; nhân viên tự dùng được, Axalize thấy và khoá được; Google với email chưa có thì từ chối. Lập kế hoạch, wireframe, testcase, nháp hướng dẫn. Chờ duyệt, Q-T1, Q-T2.
- 2026-11-17: người dùng chốt: PIN không được thay cho đăng nhập lại; PIN là tuỳ chọn quản trị văn phòng bật / tắt cho cả văn phòng; hạn cứng 30 ngày phải đăng nhập lại qua trình duyệt. Thêm 3.7, 3.8, W9, W10, Q-T5.
- 2026-11-17: duyệt (Q-T1 không báo email chưa có tài khoản; Q-T2 không gửi thư khi tạo tài khoản; Q-T5 PIN mặc định bật), code. Gộp vào cùng commit với phần mã kích hoạt cũ (chưa push).
  - Máy chủ dịch vụ: `004_passwordless.sql` thay `004_activation_code.sql` (chưa phát hành; DB dev `mcah_cloud_test`, `mcah_cloud_ui` đã xoá tạo lại). `services/login_codes.js` (mã 6 số, băm theo email, 10 phút, 5 lần sai, gửi lại sau 60 giây, 5 thư / email / giờ, 20 / IP / giờ). `web.js` viết lại: `/dang-nhap` (Google + email), `/dang-nhap/email`, `/dang-nhap/ma`, `/dang-nhap/gui-lai`, `/dang-nhap/email-khac`; bỏ đăng ký, xác minh, quên / đặt lại mật khẩu, `/moi`. Google không tự tạo tài khoản. `accounts.js` bỏ mật khẩu; `addToOffice`, `recordLogin`, `setDisabled`. `offices.js`: `createCustomer`, `addMember`, bỏ tạo văn phòng từ app và thư mời; cài máy chính đầu tiên không cần đăng nhập lại, không gửi thư báo chuyển máy. API: `POST /api/office/members` thay `/api/office/invites`; bỏ `POST /api/offices`. Vé: `office_has_machine`, `login_until`; `exp` không quá `auth_time + 30 ngày`; refresh hết hạn theo `auth_time` (lỗi `session_expired`). Trang quản trị: tab Khách hàng, Tài khoản, Nhật ký.
  - **Thêm ngoài thiết kế:** email trong `CLOUD_ADMIN_EMAILS` tự có tài khoản ở lần đăng nhập đầu (mã email hoặc Google) — không có ai ở trên tạo tài khoản cho nhân viên Axalize. Tab Tài khoản có thêm trạng thái "Nội bộ Axalize", "Chưa vào văn phòng".
  - Backend máy chính: `createUser` (app) gọi `/api/office/members`; gửi lại thư mời (app) báo không cần; `/desktop-ticket` trả `office_role`, `office_has_machine` khi máy chưa có văn phòng và `security` (`pin_required`, `lock_minutes`) trong mọi phiên; `GET/PUT /api/v1/auth/office-security`; migration `049_office_security.sql`.
  - App: `FirstRunPage` viết lại (W7 cài máy chính, W8 chờ máy chính, chưa thuộc văn phòng); `session.setupMainMachine`, `recheckOffice`; lý do `expired`; dải nhắc đăng nhập lại khi gần mốc 30 ngày (gộp với dải offline); PIN theo cài đặt văn phòng (`pin.applyPolicy`: tắt thì xoá PIN, không tự khoá); thẻ "Bảo vệ khi rời máy" trên Máy trong văn phòng (`ToggleRow` + thời gian tự khoá); bỏ mục Tự khoá ở Cài đặt trên máy này. Màn Tài khoản (app): "Thêm tài khoản", "Chưa đăng nhập", bỏ gửi lại thư mời. Bản web giữ nguyên.
  - Test tự động: cloud 31 (đăng nhập mã email đủ trường hợp, Google, OAuth + hạn 30 ngày, văn phòng / thành viên, trang quản trị), backend 603, desktop 16, frontend 509 — qua. Chưa có test tự động cho `pin.applyPolicy` (cần Electron thật).
  - Thử trên máy chủ dev (DB `mcah_cloud_ui`): đăng nhập bằng mã email (thư in ra log), admin Axalize tự có tài khoản, thêm khách hàng ("Chờ cài máy chính"), tab Tài khoản, nhật ký. **Chưa chạy app Electron trọn luồng** (cài máy chính, nhân viên nối, bật / tắt PIN, mốc 30 ngày).
