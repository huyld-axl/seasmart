# MCAH — Kế hoạch app máy tính, giai đoạn 2: máy chủ dịch vụ và tài khoản

- **Ngày lập:** 2026-11-12
- **Trạng thái:** đã duyệt 2026-11-12; code bước 0–4, 6–10, 11 (trừ triển khai thật) và 12 trên Ubuntu với máy chủ dịch vụ chạy ở máy dev. Google: đạt (2026-11-12, máy dev). Chờ: máy chủ thật trên mcah.axalize.dev/tai-khoan (M2), Windows.
- **Kế hoạch tổng:** `docs/mcah-ke-hoach-ung-dung-may-tinh.md` (mục 3.3 tài khoản, 5.4 khoá dữ liệu, 6.3 bí mật trong bộ cài, 8 tính năng cần mạng, 10 giai đoạn 2, 11 nhóm E).
- **Wireframe:** `docs/design/wireframes/desktop-gd2.html` (8 màn).
- **Testcase chạy tay:** `docs/mcah-testcase-desktop-gd2.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/mcah-huong-dan-desktop-gd2.html`, chép vào mục "Ứng dụng trên máy tính" của trang hướng dẫn ở bước 12.
- **Mục tiêu:** tài khoản nằm trên máy chủ của bên mình; đăng ký / đăng nhập qua trình duyệt (email + mật khẩu hoặc Google); làm việc offline tới 7 ngày; mã PIN; quản trị mời nhân viên bằng thư từ máy chủ dịch vụ; tạo văn phòng kèm khoá dữ liệu; AI đọc giấy và tra tàu chạy qua máy chủ dịch vụ, bộ cài không chứa khoá nào. **Vẫn một máy** (máy chính); máy nhân viên ở giai đoạn 3.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng và Nhật ký của `docs/mcah-ke-hoach-desktop-gd1.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong, kể cả Windows.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả giai đoạn trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. **Bản web giữ nguyên.** Mọi thay đổi đăng nhập chỉ bật khi `config.desktop`. Test hiện có phải qua sau mỗi bước.
6. Khoá bí mật của máy chủ dịch vụ (khoá ký vé, khoá AI, khoá tra tàu, SMTP hệ thống, Google client secret) **chỉ ở máy chủ**, đọc từ biến môi trường của `cloud/`; không bao giờ vào `desktop/` hay bộ cài.

## 1. Đã có (không làm lại)

| Có rồi | Ở đâu |
|---|---|
| Đăng nhập qua trình duyệt bản thử: PKCE, chuyển về `127.0.0.1`, vé Ed25519, route nhận vé bật bằng `DESKTOP_TICKET_PUBLIC_KEY` | `cloud/server.js`, `desktop/src/browser-login.js`, `backend/src/routes/v1/desktop_ticket.routes.js` |
| JWT nội bộ không sống quá `exp` của vé | `desktop_ticket.routes.js` |
| Khoá bọc bằng mật khẩu (scrypt + AES-GCM), mã khôi phục 24 ký tự | `desktop/src/backup.js` (`setupKeys`) |
| Cầu nối giao diện ↔ app (`window.mcah`), chuyển tiếp `/api` qua tiến trình chính | `desktop/src/preload.js`, `ipc.js`, `main.js` |
| Cài đặt trên máy này, `safeStorage` (két hệ điều hành), từ chối khi Ubuntu chỉ có `basic_text` | `desktop/src/settings.js` |
| Lớp nhà cung cấp AI (`callVision`) và tra tàu (`PROVIDERS`) | `backend/src/services/ai/`, `services/vessel_lookup/` |

## 2. Phạm vi

### 2.1 Làm

1. **Máy chủ dịch vụ thật** (`cloud/`): Fastify + Postgres riêng, migration, giới hạn tần suất, nhật ký; chạy sau HTTPS (Caddy) ở máy chủ thật.
2. **Tài khoản trên web:** đăng ký (xác minh email), đăng nhập, quên mật khẩu, "Tiếp tục với Google" (OpenID Connect), trang "Đã đăng nhập" kèm mã dự phòng (wireframe 2).
3. **OAuth cho app:** `authorize` (PKCE S256, `max_age`), `token` (đổi mã, làm mới bằng refresh token xoay vòng), vé Ed25519 gắn tài khoản, văn phòng, máy chính, mốc offline.
4. **Văn phòng:** tạo văn phòng + đăng ký máy chính (khoá thiết bị Ed25519 của máy chính, dấu vân tay), thành viên, lời mời (thư hệ thống), bỏ thành viên, khoá văn phòng.
5. **App:** màn đăng nhập mới (W1), lần đầu trên máy (W3), tạo văn phòng kèm khoá dữ liệu / mật khẩu sao lưu / mã khôi phục (W4), PIN và tự khoá (W5), dải 7 ngày (W7), đăng xuất.
6. **Phiên ở tiến trình chính:** JWT nội bộ và refresh token cất trong két hệ điều hành; giao diện **không giữ token** (tiến trình chính gắn `Authorization` khi chuyển tiếp `/api`). Bỏ `localStorage.token` trong app.
7. **Máy chính:** mọi request kiểm mốc offline trong JWT; bỏ đăng nhập email + mật khẩu khi desktop; user cục bộ gắn với tài khoản máy chủ dịch vụ.
8. **Tài khoản → Mời** (W6) thay "Tạo tài khoản" khi desktop; tắt người dùng thì báo máy chủ dịch vụ.
9. **AI đọc giấy + quét danh thiếp** qua máy chủ dịch vụ (nhà cung cấp `cloud`), **tra tàu theo IMO** qua máy chủ dịch vụ; ghi lượt dùng theo văn phòng.
10. **Trang quản trị nội bộ** (W8): văn phòng, thành viên, lượng quét AI và chi phí, khoá văn phòng.
11. **Script quét bộ cài** tìm bí mật (mục 6.3 kế hoạch tổng), chạy trong `npm run dist:*`.

### 2.2 Không làm

- Ghép máy nhân viên, mã thiết bị, mạng nội bộ: giai đoạn 3. Người được mời ở giai đoạn 2 đăng nhập trên **chính máy chính**.
- Sao lưu tự động, màn sao lưu / khôi phục, mã hoá kho tệp: giai đoạn 4 (giai đoạn 2 chỉ **sinh và cất** khoá dữ liệu và hai khoá bọc).
- Bản quyền, gói cước, giới hạn theo gói: chờ sales (Q5, Q8, Q10). Giai đoạn 2 chỉ có khoá văn phòng bằng tay.
- Không xoá luồng `createUser` / `sendInvite` / `/dat-mat-khau` của bản web.

### 2.3 Cần người dùng / sếp trước khi xong giai đoạn

| Việc | Mục kế hoạch tổng | Khi nào cần |
|---|---|---|
| Máy chủ dịch vụ và tên miền (vd. `dangnhap.mcah.vn`) | M2 | Bước 11 (triển khai thật). Bước 1–10 chạy trên máy dev |
| Đăng ký app với Google (OAuth client, trang chính sách riêng tư) | M9 | Bước 5. Chưa có thì làm phần email + mật khẩu trước, Google sau |
| Dịch vụ gửi thư hệ thống (vd. Postmark / Amazon SES / SMTP của công ty) | — | Bước 3. Máy dev dùng hộp thư giả (in thư ra log) |
| Khoá AI và nguồn tra tàu dùng ở máy chủ dịch vụ | — | Bước 9; dùng lại khoá đang có của bản web |

## 3. Thiết kế máy chủ dịch vụ (`cloud/`)

### 3.1 Cấu trúc

```
cloud/
  server.js              Fastify, đăng ký route, khoá ký vé
  src/config.js          biến môi trường (CLOUD_DB_*, CLOUD_SIGNING_KEY_FILE, GOOGLE_*, MAIL_*, AI_*, VESSEL_*)
  src/db.js              pg Pool
  migrations/            001_accounts.sql …
  scripts/migrate.js
  src/routes/            web.js (trang HTML), oauth.js, offices.js, services.js (AI, tra tàu), admin.js
  src/services/          accounts, sessions, offices, invites, mailer, tickets, ai_proxy, vessel_proxy, usage
  src/views/             HTML trang web (không framework; một tệp CSS chung)
  test/                  vitest
```

`cloud/server.js` bản thử của giai đoạn 0 được thay; giữ định dạng vé và khoá ký đang có trong `cloud/.data` cho máy dev.

### 3.2 Dữ liệu

| Bảng | Cột chính |
|---|---|
| `account` | `id uuid`, `email citext unique`, `full_name`, `password_hash` (scrypt, null nếu chỉ Google), `google_sub unique`, `email_verified_at`, `disabled_at`, `created_at` |
| `email_token` | `token_hash`, `account_id`, `kind` (`verify` / `reset`), `expires_at`, `used_at` |
| `auth_code` | `code_hash`, `account_id`, `challenge`, `redirect_uri`, `auth_time`, `expires_at` (2 phút), dùng một lần |
| `refresh_token` | `token_hash`, `account_id`, `office_id`, `device_id`, `family_id`, `expires_at` (90 ngày), `revoked_at`, `replaced_by` — xoay vòng; dùng lại token cũ thì huỷ cả `family` |
| `office` | `id uuid`, `name`, `locked_at`, `created_by`, `created_at` |
| `office_machine` | `office_id`, `public_key` (Ed25519 của máy chính), `cert_fingerprint` (giai đoạn 3 dùng), `registered_at`, `revoked_at` |
| `office_member` | `office_id`, `account_id`, `role` (`admin` / `member`), `removed_at` |
| `invite` | `token_hash`, `office_id`, `email`, `role`, `invited_by`, `expires_at` (14 ngày), `accepted_at`, `revoked_at` |
| `usage` | `office_id`, `kind` (`ai_page` / `vessel_lookup`), `units`, `cost_usd`, `created_at` |
| `audit` | `account_id`, `office_id`, `action`, `ip`, `created_at` (đăng nhập, đổi mật khẩu, mời, bỏ thành viên, khoá) |

Mọi mã bí mật (mã xác minh, mã đăng nhập, refresh token, lời mời) chỉ lưu **băm SHA-256**.

### 3.3 Trang web và OAuth

| Đường dẫn | Việc |
|---|---|
| `GET/POST /dang-nhap` | Email + mật khẩu; nút Google. Giữ tham số OAuth trong cookie phiên ký (`HttpOnly`, `SameSite=Lax`, 10 phút) |
| `GET/POST /dang-ky`, `GET /xac-minh?token=` | Đăng ký, gửi thư xác minh; chưa xác minh thì không cấp vé |
| `GET/POST /quen-mat-khau`, `GET/POST /dat-lai?token=` | Đặt lại mật khẩu (hạn 30 phút); huỷ mọi refresh token của tài khoản |
| `GET /google`, `GET /google/callback` | OpenID Connect (code + PKCE, kiểm `nonce`, `aud`, `iss`); gắn theo `sub`, email Google đã xác minh thì gộp với tài khoản cùng email |
| `GET /authorize` | `client_id=mcah-desktop`, `redirect_uri` chỉ `http://127.0.0.1:<cổng>/callback`, `code_challenge` S256, `state`, `max_age` (0 = bắt đăng nhập lại thật) |
| `GET /xong` | "Đã đăng nhập" + mã dự phòng 8 ký tự (đổi được ở `POST /token` như mã thường, hạn 5 phút) |
| `POST /token` | `grant_type=authorization_code` (mã + `code_verifier`) hoặc `refresh_token`; trả `{ ticket, refresh_token, offline_until }` |
| `GET /.well-known/mcah-keys` | Khoá công khai ký vé (app gói sẵn bản đang dùng; có `kid` để đổi khoá sau) |

- Chống dò mật khẩu: 5 lần sai / 15 phút / tài khoản và / IP thì chờ; mật khẩu ≥ 10 ký tự, chặn 1000 mật khẩu phổ biến.
- Trang web có CSP chặt, `X-Frame-Options: DENY`, cookie `Secure` khi chạy HTTPS.
- **Vé** (JWT EdDSA, `kid`): `sub` (account), `email`, `name`, `office` (id hoặc null), `office_role`, `machine` (khoá máy chính, null khi chưa có văn phòng), `auth_time`, `iat`, `exp` = **mốc offline** = lúc cấp + 7 ngày. Mỗi lần làm mới bằng refresh token thì cấp vé mới với mốc mới.

### 3.4 API cho máy chính (ký bằng khoá máy chính)

Máy chính có cặp khoá Ed25519 sinh lúc tạo văn phòng (khoá riêng mã hoá bằng `safeStorage`). Mỗi request gửi `X-MCAH-Office`, `X-MCAH-Time`, `X-MCAH-Signature` = Ed25519(method + path + time + sha256(body)); máy chủ kiểm chữ ký với `office_machine.public_key`, lệch giờ ≤ 5 phút, văn phòng không bị khoá.

| Endpoint | Việc |
|---|---|
| `POST /offices` (vé của người tạo, chưa có văn phòng) | Tạo văn phòng + đăng ký khoá máy chính; người tạo là `admin` |
| `POST /offices/:id/invites` | Tạo lời mời, gửi thư; trả id lời mời |
| `DELETE /offices/:id/invites/:inviteId`, `POST …/resend` | Huỷ / gửi lại |
| `DELETE /offices/:id/members/:accountId` | Bỏ thành viên (tắt người dùng ở máy chính); huỷ refresh token của người đó cho văn phòng này |
| `POST /ai/vision` | Chuyển tiếp `callVision` (ảnh base64, `task`, `tier`, `schema`) tới nhà cung cấp AI; ghi `usage`; trả `{ data, model, usage, requestId, latencyMs }` như nhà cung cấp hiện có |
| `GET /vessels/imo/:imo` | Tra tàu theo IMO qua nguồn hiện có; giữ hai lớp chặn (theo IMO, trần chung) ở máy chủ |
| `GET /vessels/catalog?q=` | Tìm trong danh mục tàu thế giới (xem 3.6) |

Ảnh giấy tờ chỉ đi qua bộ nhớ, **không ghi đĩa, không ghi log** (kế hoạch tổng mục 5.3).

### 3.5 Thư hệ thống

`src/services/mailer.js`: gửi qua SMTP cấu hình bằng cùng tên biến với `backend/.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_SSL`, `SMTP_USE_TLS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`); `SMTP_HOST` trống thì in thư ra log (máy dev). Mẫu thư: xác minh email, đặt lại mật khẩu, lời mời ("Hà Linh mời bạn vào văn phòng Công ty ABC trên MCAH"), báo đổi mật khẩu.

### 3.6 Danh mục tàu thế giới

Hiện nằm ở bảng `ship_catalog` của từng máy (nạp từ `ships_plain.db` bằng `seed_ship_catalog.js`). Kế hoạch tổng chuyển sang máy chủ để khỏi phát nguyên dữ liệu trong bộ cài.

- Máy chủ dịch vụ nạp `ship_catalog` một lần (dùng lại `utils/ship_catalog_rows.js`), có chỉ mục tìm như `ship_catalog.service.js`.
- Backend thêm nguồn danh mục `cloud`: khi `config.desktop`, `shipCatalogService.search` gọi `GET /vessels/catalog`; bản web giữ bảng cục bộ.
- Không có internet: ô tìm danh mục báo "Cần kết nối internet"; tàu đã thêm vào bảng `vessel` của văn phòng vẫn dùng bình thường.

## 4. Thiết kế phía máy chính và app

### 4.1 Phiên ở tiến trình chính

- `desktop/src/session.js` (mới): giữ `{ jwt, refreshToken, offlineUntil, user, office }`. JWT và refresh token mã hoá bằng `safeStorage` ở `userData/session.bin`; Ubuntu `basic_text` thì **không lưu** (đăng nhập lại mỗi lần mở app) và báo một lần.
- Chuyển tiếp `/api` (`main.js`): gắn `Authorization: Bearer <jwt>`; bỏ header `Authorization` do giao diện gửi. `401` từ backend → xoá phiên, đưa giao diện về W1.
- Làm mới: có internet thì mỗi giờ và lúc mở app gọi `POST /token` (refresh) → vé mới → `POST /api/v1/auth/desktop-ticket` lấy JWT mới. Lỗi mạng thì giữ phiên cũ tới mốc.
- Giao diện: `authStore` khi `isDesktop` lấy `user` từ `window.mcah.session()` (không có token); đăng xuất gọi `window.mcah.logout()`. `client.js` không gắn token khi desktop.
- Kênh IPC mới: `session`, `login` (mở trình duyệt / nhập mã), `cancelLogin`, `logout`, `setPin`, `unlock`, `createOffice`, `lockState` (sự kiện).

### 4.2 Máy chính (backend)

- Migration `044_desktop_accounts.sql`: `user.cloud_account_id uuid unique`, `user.invited_at`; bảng `office_info` (một dòng: `office_id`, `name`, `machine_public_key`, `created_at`).
- `desktop_ticket.routes.js` (chính thức, bỏ chữ "thử"): kiểm vé (chữ ký, `kid`, `aud`, `exp`, `office` khớp `office_info`, `machine` khớp khoá máy này); tìm user theo `cloud_account_id`, chưa có thì theo email của dòng "Đã mời" rồi gắn `cloud_account_id`; người tạo văn phòng là quản trị. JWT nội bộ mang `offline_until` = `exp` của vé.
- `plugins/index.js` `authenticate`: khi `config.desktop`, từ chối JWT không có `offline_until` hoặc đã qua (`401`, `code: 'OFFLINE_EXPIRED'`). Kiểm user còn hoạt động như hiện nay.
- `POST /auth/login` (email + mật khẩu) trả `404` khi `config.desktop`.
- `POST /api/v1/office` (chỉ khi chưa có `office_info`, gọi từ tiến trình chính sau khi máy chủ dịch vụ tạo văn phòng): ghi `office_info`, tạo user quản trị cho người tạo.
- Người dùng (desktop): `POST /users` → tạo user "Đã mời" (không mật khẩu) + gọi máy chủ dịch vụ tạo lời mời (qua tiến trình chính, ký bằng khoá máy chính). Tắt user → gọi bỏ thành viên. Lỗi mạng → không tạo, báo "Cần kết nối internet".

Gọi máy chủ dịch vụ từ backend: backend không giữ khoá máy chính. Tiến trình chính mở một cổng ký nội bộ (`MCAH_SIGNER_URL` trên `127.0.0.1`, kèm mã bí mật ngẫu nhiên mỗi lần chạy trong biến môi trường của backend): backend gửi yêu cầu cần ký, tiến trình chính ký và gửi đi. Khoá riêng không rời tiến trình chính.

### 4.3 Khoá dữ liệu lúc tạo văn phòng

Theo kế hoạch tổng 5.4 và W4: sinh khoá dữ liệu 32 byte, cất bằng `safeStorage` (`userData/data-key.bin`); bọc bằng mật khẩu sao lưu và mã khôi phục (`setupKeys` của `backup.js`, mở rộng để bọc khoá dữ liệu chứ không chỉ khoá gói). Giai đoạn 2 chỉ cất; giai đoạn 4 dùng để mã hoá kho tệp và sao lưu. Ubuntu `basic_text` → **không cho tạo văn phòng**, hướng dẫn cài `gnome-keyring` (máy chính phải có két an toàn).

### 4.4 PIN và tự khoá

- PIN 6 số, lưu băm scrypt + muối trong `userData/pin.bin` (mã hoá `safeStorage`), số lần sai trong cùng tệp.
- Tự khoá: `powerMonitor.getSystemIdleTime()` mỗi 30 giây; quá ngưỡng (mặc định 15 phút, Cài đặt trên máy này 5–60) hoặc máy khoá màn hình (`lock-screen`) → khoá. Khi khoá: tiến trình chính từ chối mọi `/api` (`423`), giao diện hiện màn khoá (W5).
- Sai 5 lần: xoá phiên + PIN, về W1, lần đăng nhập đó gửi `max_age=0`; máy chủ bắt nhập lại mật khẩu (Google: `prompt=login`, kiểm `auth_time`).

### 4.5 AI và tra tàu qua máy chủ

- `services/ai/cloud_provider.js`: `isConfigured()` = có văn phòng; `callVision(args)` → `POST /ai/vision` qua cổng ký. `config.ai.provider = 'cloud'` khi desktop (tiến trình chính đặt `AI_PROVIDER=cloud`). Giữ `ai_call` cục bộ (không nội dung).
- `vessel_lookup`: thêm `PROVIDERS.cloud`; desktop đặt `VESSEL_LOOKUP_PROVIDER=cloud`.
- Màn đồng ý lần đầu quét AI: giai đoạn 4 (kế hoạch tổng 5.3). Giai đoạn 2 hiện câu nhỏ dưới nút quét: "Ảnh được gửi lên máy chủ MCAH để AI đọc, không được lưu lại."

### 4.6 Quét bộ cài tìm bí mật

`desktop/scripts/scan-secrets.js`: mở `app.asar` và `resources/`, tìm mẫu khoá (`sk-`, `sk-ant-`, `AKIA`, `-----BEGIN .*PRIVATE KEY-----`, `GOCSPX-`, chuỗi entropy cao dài ≥ 32 trong tệp cấu hình), các biến `*_API_KEY=` có giá trị. Có là build lỗi. Chạy cuối `dist:linux` / `dist:win`.

## 5. File sẽ sửa / thêm

| Nơi | File |
|---|---|
| `cloud/` | Viết lại theo 3.1 (thêm `package.json` riêng: fastify, pg, @fastify/rate-limit, @fastify/cookie, nodemailer, openid-client; dùng lại `openai` / `@anthropic-ai/sdk` như backend) |
| `desktop/src/` | `session.js`, `signer.js` (cổng ký), `pin.js`, `office.js` (tạo văn phòng, khoá dữ liệu), `pages/login.html` không cần (W1 là màn React); sửa `main.js` (chuyển tiếp gắn token, khoá), `browser-login.js` (`max_age`, nhập mã), `preload.js`, `ipc.js`, `backup.js` (`setupKeys` bọc khoá dữ liệu), `scripts/scan-secrets.js`, `package.json` |
| `backend/` | migration `044_desktop_accounts.sql`; `routes/v1/desktop_ticket.routes.js`, `routes/v1/office.routes.js` (mới), `plugins/index.js`, `routes/v1/auth.routes.js`, `services/user.service.js`, `routes/v1/users.js`, `services/ai/cloud_provider.js`, `services/ai/index.js`, `services/vessel_lookup/index.js`, `services/ship_catalog.service.js`, `config/index.js` |
| `frontend/` | `pages/admin/LoginPage.jsx` (nhánh desktop → `DesktopLoginPage.jsx` mới), `pages/desktop/FirstRunPage.jsx`, `CreateOfficeWizard.jsx`, `PinSetup.jsx`, `LockScreen.jsx` (mới), `layouts/AdminLayout.jsx` (dải 7 ngày, màn khoá), `stores/authStore.js`, `api/client.js`, `pages/admin/users/UserListPage.jsx` + `components/admin/users/UserForm.jsx` (Mời), `pages/admin/settings/DeviceSettingsPage.jsx` (thời gian tự khoá), câu báo dưới nút quét AI |

## 6. Test tự động

- `cloud/test`: đăng ký / xác minh / đăng nhập / khoá khi sai nhiều; PKCE (verifier sai, mã dùng lại, `redirect_uri` lạ); `max_age=0` bắt đăng nhập lại; refresh xoay vòng và huỷ cả họ khi dùng lại; chữ ký máy chính (sai chữ ký, lệch giờ, văn phòng khoá); lời mời (hết hạn, đã dùng, sai email); `ai/vision` ghi `usage`, không ghi ảnh.
- Backend: vé hết hạn / sai văn phòng / sai máy; `authenticate` từ chối `offline_until` đã qua; `POST /auth/login` 404 khi desktop; gắn user "Đã mời" theo email; `cloud_provider` gọi đúng cổng ký.
- Desktop: phiên (lưu, đọc, `basic_text`), PIN (đúng, sai, 5 lần), tự khoá theo thời gian rỗi (giả lập), quét bí mật bắt được mẫu khoá.
- Frontend: `authStore` desktop không đọc `localStorage.token`; màn đăng nhập desktop; form Mời.

## 7. Các bước

### Bước 0 — Chuẩn bị

- Chạy test cả bốn phần, ghi số. Hỏi người dùng tình trạng các việc ở 2.3.
- **Xong khi:** test hiện có qua; Nhật ký ghi rõ việc nào ở 2.3 đã có, việc nào chạy bằng hàng giả trên máy dev.

### Bước 1 — Khung `cloud/` (3.1, 3.2)

- **Xong khi:** `cloud` chạy với Postgres riêng (máy dev: Postgres nhúng của `desktop/` hoặc Docker), migration chạy, `GET /health`, test khung qua.

### Bước 2 — Tài khoản email + mật khẩu, trang web (3.3, 3.5, W2)

- **Xong khi:** đăng ký → thư xác minh (in ra log) → xác minh → đăng nhập; quên / đặt lại mật khẩu; chống dò; test qua.

### Bước 3 — OAuth cho app, vé, làm mới (3.3)

- **Xong khi:** app thử của giai đoạn 0 đăng nhập trọn vòng qua máy chủ mới; mã dự phòng dán vào app được; refresh xoay vòng; `max_age=0` bắt nhập lại mật khẩu; test qua.

### Bước 4 — Phiên ở tiến trình chính, màn đăng nhập app (4.1, W1)

- **Xong khi:** giao diện không còn token trong `localStorage` (testcase E10); đăng nhập / đăng xuất / mở lại app vẫn đăng nhập; tắt mạng mở app vẫn vào (trước mốc); `POST /auth/login` 404 trong app; bản web đăng nhập như cũ.

### Bước 5 — Google (3.3)

- ⛔ **DỪNG** nếu chưa có Google OAuth client (M9): báo người dùng, làm tiếp bước 6 trở đi, quay lại bước này khi có.
- **Xong khi:** "Tiếp tục với Google" đăng ký và đăng nhập được; gộp với tài khoản email cùng địa chỉ; `max_age=0` → Google hỏi lại.

### Bước 6 — Tạo văn phòng, khoá máy chính, khoá dữ liệu (3.4, 4.2, 4.3, W3, W4)

- **Xong khi:** máy trống → đăng nhập → W3 → W4 → có văn phòng trên máy chủ và `office_info` trên máy; có `data-key.bin` mã hoá và hai bản bọc; mở bản bọc bằng mật khẩu sao lưu và bằng mã khôi phục ra cùng khoá dữ liệu (test); Ubuntu `basic_text` không cho tạo văn phòng.

### Bước 7 — Mốc offline 7 ngày, dải vàng (4.1, 4.2, W7)

- **Xong khi:** testcase E5, E6, E11 qua (dùng đồng hồ giả ở máy chủ dịch vụ thử và `MCAH_FAKE_NOW` ở máy chính, chỉ bật khi không đóng gói).

### Bước 8 — PIN, tự khoá (4.4, W5)

- **Xong khi:** đặt PIN sau đăng nhập đầu; để rỗi 5 phút (đặt ngưỡng nhỏ) thì khoá; mở bằng PIN; sai 5 lần về W1 và web bắt nhập lại mật khẩu (E12); khi khoá `/api` trả 423.

### Bước 9 — Mời, bỏ thành viên (3.4, 4.2, W6)

- **Xong khi:** E7 (tới bước người được mời đăng nhập app trên máy chính, vào với đúng vai trò), E8 (tắt người dùng → chặn ngay, máy chủ bỏ thành viên, làm mới vé của người đó bị từ chối).

### Bước 10 — AI và tra tàu qua máy chủ, danh mục tàu (3.4, 3.6, 4.5)

- **Xong khi:** quét một PDF giấy tờ và một danh thiếp trong app, kết quả như bản web; tra IMO trong app; tìm danh mục tàu trong app; máy chủ ghi `usage` đúng văn phòng; văn phòng bị khoá thì quét báo rõ lý do; mất mạng thì báo "Cần kết nối internet".

### Bước 11 — Trang quản trị nội bộ, quét bí mật, triển khai thử (3.4, 4.6, W8)

- Triển khai `cloud/` lên máy chủ thật sau HTTPS (khi có M2); app đóng gói trỏ tới địa chỉ thật; khoá ký vé thật (không dùng khoá máy dev).
- **Xong khi:** trang quản trị liệt kê văn phòng và lượng quét; khoá văn phòng có hiệu lực; `scan-secrets` chạy trong `dist:*` và báo sạch; cài `.deb` thật (và `.exe` khi có máy Windows), làm lại E1–E13.

### Bước 12 — Hướng dẫn, Nhật ký

- Chép nháp hướng dẫn vào trang hướng dẫn (chỉ hiện trong app), ghi Nhật ký ở đây và mục 15 kế hoạch tổng, cập nhật mục 13 (số đo đăng nhập, cổng ký).
- ⛔ **DỪNG:** báo kết quả, hỏi commit và có viết kế hoạch giai đoạn 3 không.

## 8. Rủi ro riêng

| Rủi ro | Cách giảm |
|---|---|
| Máy chủ dịch vụ sập lúc khách cần đăng nhập mới | Người đã đăng nhập làm tiếp 7 ngày; theo dõi máy chủ; trang trạng thái |
| Lộ khoá ký vé | Khoá chỉ trên máy chủ, có `kid` để đổi; app nhận nhiều khoá công khai theo `kid` |
| Đồng hồ máy chính bị chỉnh lùi để kéo dài 7 ngày | Máy chính nhớ thời điểm lớn nhất từng thấy (từ vé và đồng hồ), không chấp nhận lùi quá 1 giờ |
| Ubuntu không có két an toàn | Máy chính không tạo văn phòng; máy dùng thử thì đăng nhập lại mỗi lần mở |
| Google duyệt app chậm | Làm email + mật khẩu trước (bước 5 có DỪNG) |

## 9. Nhật ký

| Ngày | Bước | Việc | Ghi chú |
|---|---|---|---|
| 2026-11-12 | — | Lập kế hoạch, wireframe, testcase, hướng dẫn nháp | Chờ duyệt |
| 2026-11-12 | 0 | Test gốc | backend 507, frontend 356, desktop 5. Mục 2.3 chưa có gì: máy dev dùng Postgres riêng (cloud/scripts/dev-db.js), thư in ra log |
| 2026-11-12 | 1–3 | Máy chủ dịch vụ `cloud/` | Fastify + Postgres, trang web (đăng ký, xác minh, đăng nhập, quên / đặt lại, lời mời), OAuth PKCE + mã ngắn + refresh xoay vòng + max_age, vé EdDSA có kid. 16 test qua. Sửa lỗi thật do test bắt: /authorize khi đã có phiên trình duyệt không trả mã (đọc cookie vừa đặt) |
| 2026-11-12 | 4, 6 | Phiên ở tiến trình chính, tạo văn phòng | `desktop/src/session.js`, `office.js`; màn W1, W3, W4; route `desktop-ticket` chính thức + `desktop-office`; JWT mang offline_until, `authenticate` kiểm mọi request; `/auth/login` 404 khi desktop. Thử trọn vòng trên app: đăng nhập → Lần đầu → tạo văn phòng → Tổng quan; tắt máy chủ dịch vụ, mở lại app vẫn làm việc; khoá dữ liệu mở được bằng mật khẩu sao lưu và mã khôi phục. Khoá bọc sao lưu chuyển vào két (backup-keys.bin) |
| 2026-11-12 | 5 | ⛔ Google | Chưa có Google OAuth client (M9). Bỏ qua, làm khi có |
| 2026-11-12 | 5 | Google | Người dùng tạo OAuth client (Web application, redirect `https://mcah.axalize.dev/tai-khoan/google/callback` và `http://localhost:4100/google/callback`), điền `cloud/.env`. `cloud/src/services/google.js`: OIDC code + PKCE + state + nonce, kiểm iss / aud / exp / email đã xác minh, đăng nhập lại bắt buộc dùng prompt=login + max_age=0 và kiểm auth_time; gắn theo google_sub rồi email. 4 test Google giả. Người dùng đăng nhập Google thật trong app: vào màn Lần đầu đúng tên. Máy dev đổi sang `http://localhost:4100` (Google không nhận 127.0.0.1). Biến thư của `cloud/` đổi về `SMTP_*` như backend; test ép thư chỉ in log (một lần chạy trước đó đã thử gửi thư thật tới địa chỉ thử @thu.vn) |
| 2026-11-12 | 7 | Mốc 7 ngày | Dải vàng W7; ngày 6 / ngày 8 đạt bằng `MCAH_FAKE_NOW` (chỉ dev). Thêm: chặn chỉnh lùi đồng hồ (lùi quá 1 giờ → bỏ phiên), lý do hiện ở màn đăng nhập |
| 2026-11-12 | 8 | PIN, tự khoá | `desktop/src/pin.js`, `DesktopLock.jsx` (dùng `Input.Password` sẵn có, không thêm control mới). Khoá → 423; sai 5 lần → về đăng nhập với max_age=0. Thời gian tự khoá ở Cài đặt trên máy này |
| 2026-11-12 | 9 | Mời, khoá thành viên | Cổng ký `desktop/src/signer.js` + `backend/src/utils/desktop_cloud.js`; Tài khoản → "Mời" khi desktop có văn phòng; khoá / xoá báo máy chủ, không có mạng thì vẫn khoá ở máy và cảnh báo |
| 2026-11-12 | 10 | AI, tra IMO, danh mục | Nhà cung cấp AI `cloud`, nguồn tra tàu `cloud`, danh mục tàu tìm ở máy chủ (732.869 tàu, nạp 30 giây). Máy chủ dùng lại module AI / tra tàu của backend (`cloud/src/routes/services.js`; triển khai phải chép kèm). AI và tra IMO thật chưa thử: máy dev không có khoá |
| 2026-11-12 | 11 | Quản trị nội bộ, quét bí mật | `/quan-tri` (CLOUD_ADMIN_EMAILS), khoá / mở khoá văn phòng; `desktop/scripts/scan-secrets.js` chạy trong `dist:*`, bắt được khoá giả. Triển khai thật chờ M2 |
| 2026-11-12 | 12 | Test | cloud 16, backend 510, frontend 358, desktop 6 test qua. Hướng dẫn phần tài khoản đã vào trang hướng dẫn (chỉ hiện trong app) |
| 2026-11-12 | 11 | Đưa máy chủ dịch vụ vào deploy | Máy chủ dịch vụ chạy dưới đường dẫn con (`config.basePath` lấy từ `CLOUD_PUBLIC_URL`): liên kết, form, chuyển hướng, cookie có tiền tố; đã thử qua proxy giả lập nginx ở `/tai-khoan`. `cloud/Dockerfile` (context gốc repo, `.dockerignore` gốc chỉ cho vào `backend/src` + `cloud`), `compose.yaml` thêm `cloud-postgres` + `cloud` (volume `cloud_data` giữ khoá ký vé), `frontend/nginx.conf` chuyển `/tai-khoan/`, `deploy.sh` tự tạo `docker/cloud-postgres.env`; chưa có `cloud/.env` thì bỏ qua cloud và deploy bản web như cũ (nginx tìm `cloud` lúc có request nên bản web không phụ thuộc cloud). Chạy thật mà thiếu `CLOUD_COOKIE_SECRET` thì máy chủ không khởi động. Build bộ cài cho server lấy khoá công khai từ `<máy chủ>/.well-known/mcah-keys`. Hướng dẫn cho người giữ server: `docs/mcah-huong-dan-server-may-chu-dich-vu.md`. **Chưa dựng thử bằng Docker** (máy dev không có Docker) |
