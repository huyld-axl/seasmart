# MCAH — Kế hoạch khu nội bộ `/internal/` (Basic Auth + mật khẩu + 2FA) và đổi đường dẫn sang tiếng Anh

- **Ngày lập:** 2026-11-17 · **Sửa:** 2026-11-17 (một admin; đăng nhập email + mật khẩu + TOTP; mọi đường dẫn sang tiếng Anh) · 2026-11-17 (đối chiếu code mới `03bae9a`, `faf725e`: mục 1.1, 1.2)
- **Trạng thái:** đã code (bước 2–7, bản app 0.9.4) trên `dev`, chưa push, chưa deploy. Còn: Google Console + server (Q-N4, Q-N7), deploy, chạy testcase trên server; nginx chưa chạy thử được ở máy dev (không có Docker).
- **Liên quan:** `docs/mcah-ke-hoach-tai-khoan-tu-tren-xuong.md` (trang quản trị hiện có), `docs/mcah-ke-hoach-ma-kich-hoat.md` mục 2.2 (basic auth để sau — kế hoạch này làm phần đó bằng đường dẫn `/internal/`, **không cần subdomain / DNS / HTTPS mới**).
- **Wireframe:** `docs/design/wireframes/khu-noi-bo.html` (11 màn: 0 tổng quan, 1 Basic Auth, 2 email + mật khẩu = W2, 3 mã = W3, 4 QR = W4, 5 mã khôi phục = W5, 6 dùng mã khôi phục = W6, 7 sai nhiều lần, 8 trang quản trị, 9 design system, 10 lệnh server).
- **Testcase chạy tay:** `docs/mcah-testcase-khu-noi-bo.md`.
- **Hướng dẫn cho người giữ server:** đã gộp vào `docs/mcah-huong-dan-server-may-chu-dich-vu.md` (mục "Khu nội bộ", "Đổi địa chỉ sang tiếng Anh"). Đã duyệt wireframe 2026-11-17.
- **Mục tiêu:**
  1. Mọi trang riêng tư của Axalize nằm dưới **một** tiền tố `/internal/`, qua 3 lớp: **Basic Auth** (nginx) → **email + mật khẩu** → **mã 6 số từ app Authenticator (TOTP)**.
  2. **Mọi đường dẫn** trên `mcah.axalize.vn` (web app, trang tĩnh, máy chủ tài khoản, khu nội bộ) đổi sang tiếng Anh cho thống nhất. Đường cũ không chết: chuyển hướng sang đường mới, vì app máy tính đã phát hành, thư đã gửi và Google đang trỏ vào chúng.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` và `docs/mcah-quy-trinh-phat-hanh.md` trước.
2. Làm đúng thứ tự mục 8; mỗi bước có "Xong khi". Chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, hỏi người dùng đúng điều cần hỏi.
4. Một commit cho cả việc trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
4a. **Định nghĩa xong (người dùng chốt 2026-11-17):** việc này sửa cả app máy tính, nên chỉ coi là **hoàn thành khi build được bộ cài Ubuntu mới** (`npm run dist:linux` thành công, cài thử chạy được) theo `docs/mcah-quy-trinh-phat-hanh.md` — code xong + test qua **chưa** phải là xong. Xem bước 9.
5. Test hiện có (`cloud/`, `backend/`, `desktop/`, `frontend/`) phải qua sau mỗi bước.

## 1. Hiện trạng (kiểm kê 2026-11-17)

Một tên miền, ba thứ chạy chung: web app React (`frontend/`), trang tĩnh (`frontend/public/`), máy chủ tài khoản `cloud/` dưới `/tai-khoan/` (nginx bỏ tiền tố rồi chuyển vào, `frontend/nginx.conf`).

- **Nhóm 1 — Web app, phải đăng nhập:** `/dashboard`, `/seafarers…`, `/vessels…`, `/partners…`, `/opportunities…`, `/voyages…`, `/contracts…`, `/bills…`, `/master-data/*`, `/cai-dat-may`, `/no-role`, `/admin/*` (`/admin/*` là quản trị **của văn phòng khách**, không phải trang nội bộ Axalize).
- **Nhóm 2 — Public:** đăng nhập web (`/login`, `/dat-mat-khau`), luồng đăng nhập app máy tính (`/tai-khoan/dang-nhap…`, `/google…`, `/authorize`, `/xong`), `/huong-dan/`, `/phat-hanh/`, `/download/`, pháp lý (`/tai-khoan/dieu-khoan`, `/tai-khoan/quyen-rieng-tu`), địa chỉ máy gọi máy (`/api/*`, `/tai-khoan/token`, `/tai-khoan/.well-known/mcah-keys`, `/tai-khoan/api/*`, `/health`).
- **Nhóm 3 — Nội bộ, đang rải rác:** `/tai-khoan/quan-tri*` (Google / mã email + `CLOUD_ADMIN_EMAILS`, không 2FA) và `/design-system` (**không bảo vệ gì**).
- **Code thừa:** `cloud/src/routes/web.js` route `/dieu-khoan`, `/quyen-rieng-tu` + `pages.legal` — nginx đã trả tệp tĩnh cho hai địa chỉ này, route cloud không bao giờ chạy → xoá.

### 1.1 Chỗ đang ghi cứng đường dẫn tiếng Việt (ảnh hưởng tới việc đổi tên)

| Chỗ | Ghi cứng | Hệ quả nếu đổi mà không giữ đường cũ |
|---|---|---|
| App máy tính **đã phát hành**: `desktop/endpoints.json` | `cloud_url = https://mcah.axalize.vn/tai-khoan` | App cũ không đăng nhập, không quét AI / tra tàu được |
| App máy tính đã phát hành: `desktop/src/browser-login.js:74` | chuyển trình duyệt về `${cloud_url}/xong` | Đăng nhập xong thấy 404 |
| App đã phát hành: `HelpLink.jsx`, `WhatsNew.jsx`, `AdminLayout.jsx` | `/huong-dan/index#…`, `/phat-hanh/index` | Nút trợ giúp / "Có gì mới" ra 404 |
| Thư đã gửi: `backend/src/services/email.service.js:83` | `/dat-mat-khau?token=…` | Người được mời không đặt được mật khẩu |
| Google Cloud Console (OAuth) | callback `/tai-khoan/google/callback`; trang điều khoản / quyền riêng tư `/tai-khoan/dieu-khoan`, `/tai-khoan/quyen-rieng-tu` | Đăng nhập Google lỗi `redirect_uri_mismatch`; Google xét lại màn đồng ý |
| App máy tính đã phát hành: `desktop/src/main.js` `WEB_PAGES` | chỉ chuyển `app://mcah/huong-dan/…`, `app://mcah/phat-hanh/…` ra trình duyệt (`<gốc cloud_url>/huong-dan/…?app=1`) | App mới đổi link sang `/guide/` mà quên regex → nút Hướng dẫn không mở được |
| Cookie `cloud` | `path=/tai-khoan` (`mcah_s`, `mcah_last` mới thêm ở `03bae9a`…) | Đổi tiền tố → mọi người phải đăng nhập lại trên trình duyệt một lần, email không được điền sẵn một lần (chấp nhận) |

**Điểm có lợi:** app máy tính **tự học địa chỉ mới** từ `endpoints` trong `latest.json` đã ký (`desktop/src/endpoints.js` `learn`, `desktop/scripts/release.js`). Sửa `desktop/endpoints.json` thành `/account` rồi phát bản mới là máy cũ đổi theo ở lần kiểm cập nhật kế tiếp — đường `/tai-khoan` chỉ cần giữ tới khi các máy đã kiểm cập nhật, không phải mãi mãi.

### 1.2 Code mới trên `dev` sau lần kiểm kê đầu (`03bae9a`, `faf725e`, 2026-11-17)

Đã đọc lại; **danh sách route không đổi** so với mục 1. Những điểm ảnh hưởng tới kế hoạch:

| Thay đổi | Ảnh hưởng |
|---|---|
| Người dùng đăng nhập **không mật khẩu** (Google hoặc mã 6 số qua email); SMTP thành bắt buộc | Mật khẩu ở kế hoạch này **chỉ cho admin khu nội bộ**, không đụng luồng người dùng. Admin không phụ thuộc SMTP |
| `accounts.forLogin`: email trong `CLOUD_ADMIN_EMAILS` **tự có tài khoản** ở lần đăng nhập đầu; `admin.js` gắn nhãn "Nội bộ Axalize" theo cùng danh sách | Hai chỗ này đổi sang `CLOUD_ADMIN_EMAIL` (một email). `scripts/admin.js set-password` tạo tài khoản qua đúng hàm này nếu chưa có |
| Tab Tài khoản khoá được tài khoản; đã chặn tự khoá tài khoản đang dùng | Giữ nguyên. Admin bị `disabled_at` thì không vào `/internal` được (5.3) — vì không ai khác khoá được, chỉ xảy ra khi sửa DB tay |
| `03bae9a`: trao mã cho app xong thì xoá `mcah_s`, giữ `mcah_last` | Không ảnh hưởng khu nội bộ (cookie riêng `mcah_admin`, `path=/internal`). Đổi tiền tố `/account` phải đổi `path` của cả `mcah_last` |
| `sessionMaxDays: 30` (đăng nhập lại qua trình duyệt sau 30 ngày) | Không liên quan phiên admin (8 giờ) |
| Hướng dẫn server (`docs/mcah-huong-dan-server-may-chu-dich-vu.md`) có mục mới "Trang quản trị Axalize" ghi "đăng nhập bằng Google hoặc mã email, không có mật khẩu" | Viết lại mục này theo 5.3 / 5.4 |
| Test mới `cloud/test/passwordless_oauth.test.js`, `offices.test.js` gọi `/dang-nhap…`, `/quan-tri…` | Sửa theo tên mới; thêm vào `legacy_paths.test.js` vài ca đường cũ |
| Trang tĩnh có link tuyệt đối / tương đối giữa nhau: `download/index.html` (`/phat-hanh/index.html`, `/huong-dan/`, `/tai-khoan/dieu-khoan`, `/tai-khoan/quyen-rieng-tu`), `phat-hanh/index.html` (`../huong-dan/`, `../download/`), `huong-dan/index.html` (`../phat-hanh/`) | Sửa hết khi đổi tên thư mục (mục 6) |

## 2. Phạm vi

### 2.1 Làm

1. **Đổi tên mọi đường dẫn sang tiếng Anh** theo bảng mục 3 (web app, trang tĩnh, `cloud`, khu nội bộ), giữ đường cũ bằng chuyển hướng (mục 4).
2. **Khu nội bộ `/internal/`**: Basic Auth ở nginx cho toàn khu (5.1).
3. **Chuyển trang quản trị** về `/internal/admin…` (5.2).
4. **Đăng nhập quản trị**: một tài khoản, email + mật khẩu + TOTP, mã khôi phục, lệnh đặt / reset trên server (5.3, 5.4).
5. **Design system** tách khỏi web app, vào `/internal/design-system/` (5.5).
6. Xoá code thừa (mục 1).

### 2.2 Không làm

- Nhiều tài khoản admin, phân quyền giữa các admin (đã chốt: **một** admin, 2026-11-17).
- Đăng nhập Google / mã email cho trang quản trị (thay bằng mật khẩu + TOTP).
- Trang tự đổi mật khẩu / tự tắt 2FA trên web: chỉ bằng lệnh trên server (5.4).
- 2FA cho người dùng thường (web app, app máy tính).
- Đổi nhãn tiếng Việt trên giao diện — chỉ đổi **đường dẫn**. Tên tệp tài liệu trong `docs/` giữ nguyên.
- Đổi tham số / nội dung API (`/api/*` đã là tiếng Anh).

### 2.3 Đã chốt (2026-11-17)

- **Q-N1:** sau Basic Auth là **email + mật khẩu**, rồi **mã Authenticator**.
- **Q-N2:** **một** tài khoản admin; tệp `htpasswd` có **một** dòng.
- **Q-N5:** mọi đường dẫn đổi sang **tiếng Anh**.

### 2.4 Còn cần trả lời / làm ngoài code

- **Q-N3 — Phiên quản trị** (đề xuất, đổi được): 8 giờ; hết hạn nhập lại mật khẩu + mã Authenticator (Basic Auth trình duyệt tự nhớ).
- **Q-N6 — Tên đường dẫn** ở mục 3 (đề xuất, sửa được lúc duyệt wireframe).
- **⛔ Q-N7 — Google Cloud Console** (người giữ tài khoản Google Cloud làm, trước khi deploy): **thêm** callback `https://mcah.axalize.vn/account/google/callback` (giữ cả callback cũ trong thời gian chuyển); đổi link điều khoản / quyền riêng tư trên màn đồng ý OAuth sang `/legal/terms`, `/legal/privacy`. Đổi link có thể khiến Google xét lại màn đồng ý — đường cũ vẫn 301 nên trang vẫn mở được.
- **Q-N4 — Server** (người giữ server): tạo tệp `htpasswd` một dòng, đặt `CLOUD_ADMIN_TOTP_KEY`, chạy lệnh đặt mật khẩu admin. Lệnh viết sẵn trong hướng dẫn server.

## 3. Bảng đổi tên đường dẫn

### 3.1 Web app (`frontend/src/App.jsx`, nav, link trong code)

| Cũ | Mới |
|---|---|
| `/dat-mat-khau` | `/set-password` |
| `/cai-dat-may` | `/device-settings` |
| `/bat-dau` (chỉ app máy tính) | `/setup` |
| `/admin/may-trong-van-phong` | `/admin/devices` |
| `/design-system` | bỏ khỏi app → `/internal/design-system/` (5.5) |
| Các đường còn lại (`/login`, `/dashboard`, `/seafarers`, `/master-data/cert`…) | đã là tiếng Anh, giữ nguyên |

### 3.2 Trang tĩnh (`frontend/public/`)

| Cũ | Mới |
|---|---|
| `/huong-dan/` (`/huong-dan/index#…`) | `/guide/` (giữ nguyên các `#neo`) |
| `/phat-hanh/` | `/release-notes/` |
| `/tai-khoan/dieu-khoan` (tệp `phap-ly/dieu-khoan.html`) | `/legal/terms` |
| `/tai-khoan/quyen-rieng-tu` (tệp `phap-ly/quyen-rieng-tu.html`) | `/legal/privacy` |
| `/download/`, `/download/files/*` | giữ nguyên |

### 3.3 Máy chủ tài khoản (`cloud/`, tiền tố `/tai-khoan` → `/account`)

| Cũ (dưới `/tai-khoan`) | Mới (dưới `/account`) |
|---|---|
| `/dang-nhap` | `/login` |
| `/dang-nhap/email` (POST) | `/login/email` |
| `/dang-nhap/ma` | `/login/code` |
| `/dang-nhap/gui-lai` (POST) | `/login/resend` |
| `/dang-nhap/email-khac` | `/login/change-email` |
| `/dang-xuat` | `/logout` |
| `/xong` | `/done` |
| `/google`, `/google/callback`, `/authorize`, `/token`, `/.well-known/mcah-keys`, `/api/*`, `/health` | giữ tên, chỉ đổi tiền tố |
| `/dieu-khoan`, `/quyen-rieng-tu` | xoá (mục 1), đã thay bằng `/legal/*` |

### 3.4 Khu nội bộ (mới, thay `/tai-khoan/quan-tri*`)

| Cũ | Mới |
|---|---|
| — | `/internal/` → 302 `/internal/admin` |
| — | `/internal/login` (email + mật khẩu), `/internal/login/verify` (mã 6 số), `/internal/login/recovery` (mã khôi phục), `/internal/login/setup` (cài 2FA lần đầu), `/internal/logout` |
| `/tai-khoan/quan-tri` | `/internal/admin` (tab Khách hàng) |
| `/tai-khoan/quan-tri/khach` (POST) | `/internal/admin/customers` |
| `/tai-khoan/quan-tri/khach/quan-tri` | `/internal/admin/customers/admins` |
| `/tai-khoan/quan-tri/khoa` | `/internal/admin/customers/lock` |
| `/tai-khoan/quan-tri/tai-khoan` | `/internal/admin/accounts` |
| `/tai-khoan/quan-tri/tai-khoan/khoa` | `/internal/admin/accounts/lock` |
| `/tai-khoan/quan-tri/nhat-ky` | `/internal/admin/audit-log` |
| `/design-system` | `/internal/design-system/` |
| — | `/internal/_check` (chỉ nội bộ nginx, cho `auth_request`) |

Tham số query đang dùng (`?q=`, `?email=`) đã là tiếng Anh, giữ nguyên.

## 4. Giữ đường cũ (tương thích)

| Đường cũ | Cách giữ | Giữ tới khi |
|---|---|---|
| `/tai-khoan/*` (app máy tính cũ gọi: `/authorize`, `/token`, `/.well-known/…`, `/api/*`) | nginx chuyển **cả** `/tai-khoan/` và `/account/` vào cloud (proxy, **không** redirect — `POST /token` và API không đi theo 301 an toàn). Cloud không cần biết tiền tố nào: nginx bỏ tiền tố trước khi chuyển | Mọi máy đã học `cloud_url` mới từ `latest.json` (mục 1.1); xem lại sau 2 bản phát hành |
| `/tai-khoan/dang-nhap…`, `/xong`, `/dang-xuat` (trang người xem) | Cloud trả **301** (GET) / **308** (POST) sang tên mới dưới `/account` | Như trên |
| `/tai-khoan/google/callback` | Cloud vẫn nhận ở đường cũ trong thời gian chuyển (Google có thể còn trả về đó) | Đã gỡ callback cũ khỏi Google Console |
| `/tai-khoan/dieu-khoan`, `/tai-khoan/quyen-rieng-tu` | nginx 301 → `/legal/terms`, `/legal/privacy` | Mãi mãi (đã khai với Google) |
| `/huong-dan/*`, `/phat-hanh/*` | nginx 301, giữ đường con; `#neo` trình duyệt tự giữ | Mãi mãi (rẻ) |
| `/dat-mat-khau?token=…` | Route React chuyển sang `/set-password` **giữ query** | Mãi mãi (link trong thư mời) |
| `/cai-dat-may`, `/bat-dau`, `/admin/may-trong-van-phong` | Route React `<Navigate replace>` sang tên mới | Mãi mãi (rẻ, như `/fleet` hiện có) |
| `/tai-khoan/quan-tri*` | nginx 301 → `/internal/admin…` theo bảng 3.4 | Mãi mãi |
| `/design-system` | **Không** chuyển hướng: trả 404 (không lộ có khu nội bộ) | — |

Cookie: `cloud` đặt cookie `path=/account`. Người đang có phiên dưới `/tai-khoan` phải đăng nhập lại trên trình duyệt một lần; app máy tính dùng vé riêng nên không bị ảnh hưởng.

## 5. Thiết kế khu nội bộ

### 5.1 nginx (`frontend/nginx.conf`)

```
/internal/                 auth_basic "MCAH internal"; auth_basic_user_file /etc/nginx/internal-auth/htpasswd;
  = /internal/             → 302 /internal/admin
  /internal/login…         → proxy cloud:4100 (giữ nguyên tiền tố)
  /internal/logout         → proxy cloud
  /internal/admin…         → proxy cloud
  = /internal/_check       internal; proxy cloud (auth_request)
  /internal/design-system/ auth_request /internal/_check; tệp tĩnh (5.5); 401 → 302 /internal/login?next=…
/account/                  → proxy cloud (bỏ tiền tố /account)
/tai-khoan/…               → như mục 4
```

- `auth_basic` đặt ở `location /internal/` cha; mọi location con thừa kế → không đường nào dưới `/internal/` lọt Basic Auth.
- Proxy vào cloud: `proxy_set_header Authorization "";` (mật khẩu Basic Auth không vào ứng dụng).
- Tệp `htpasswd` ngoài repo: `compose.yaml` service `frontend` gắn `${INTERNAL_AUTH_DIR:-/srv/mcah/internal-auth}:/etc/nginx/internal-auth:ro` (gắn thư mục, không gắn tệp: thiếu tệp thì Docker không tạo thư mục rác). **Thiếu tệp → nginx trả 500 cho `/internal/`** (đóng, không mở); phần còn lại của web vẫn chạy.
- `auth_request` có sẵn trong `nginx:stable-alpine`; kiểm bằng `nginx -V` ở bước 1.
- Mọi phản hồi dưới `/internal/`: `X-Robots-Tag: noindex`, `Cache-Control: no-store`.
- Máy dev không nginx: chạy cloud thẳng `localhost:4100/internal/…`, không có Basic Auth (chấp nhận ở máy dev).

### 5.2 Trang quản trị (`cloud/`)

- `config.js`: `basePath` thành `/account` (theo `CLOUD_PUBLIC_URL`), thêm `internalBase` (`CLOUD_INTERNAL_PATH`, mặc định `/internal`), `adminEmail` (`CLOUD_ADMIN_EMAIL`, **một** email; thay `CLOUD_ADMIN_EMAILS` ở cả 3 chỗ đang dùng: `admin.js` `adminAccount`, nhãn "Nội bộ Axalize", `accounts.forLogin`), `adminTotpKey` (`CLOUD_ADMIN_TOTP_KEY`). Server đang đặt `CLOUD_ADMIN_EMAILS` thì đọc tạm làm dự phòng khi thiếu biến mới (lấy email đầu), để deploy không gãy.
- `admin.js` đăng ký route theo bảng 3.4 dưới `internalBase` (nginx giữ tiền tố nên đường trong cloud = đường công khai). Mọi liên kết trong trang dùng `internalBase`.
- Bỏ `adminAccount` dựa trên cookie `mcah_s` → dùng phiên quản trị (5.3).
- Thanh tab: **Customers · Accounts · Audit log · Design system ↗** — nhãn hiện trên giao diện vẫn tiếng Việt (Khách hàng · Tài khoản · Nhật ký · Design system), chỉ đường dẫn tiếng Anh. Góc phải: email · Đăng xuất.
- Kiểm `sameSite` cho POST, CSP không script giữ nguyên; QR là SVG dựng phía máy chủ nhúng thẳng vào HTML.

### 5.3 Đăng nhập quản trị

**Cookie** `mcah_admin`: ký, `HttpOnly`, `SameSite=Strict`, `Secure`, `path=/internal`, nội dung `{ a: account_id, t: lúc vào, v: auth_version }`, hạn 8 giờ (Q-N3). Đổi mật khẩu hoặc reset 2FA → tăng `auth_version` → mọi phiên cũ mất hiệu lực. Cookie tạm `mcah_admin_step` (ký, 5 phút, `path=/internal`) giữ trạng thái "đã qua mật khẩu, chờ mã".

**Luồng** (wireframe W1–W6):

| Màn | Đường dẫn | Việc |
|---|---|---|
| W1 | (hộp trình duyệt) | Basic Auth |
| W2 | `GET/POST /internal/login` | Email + mật khẩu. Sai bất kỳ cái nào → cùng một câu "Email hoặc mật khẩu không đúng". Đúng → W3 (đã cài 2FA) hoặc W4 (chưa) |
| W3 | `GET/POST /internal/login/verify` | Ô mã 6 số. Đúng → vào `next` hoặc `/internal/admin`. Link "Mất điện thoại?" → W6 |
| W4 | `GET/POST /internal/login/setup` | Lần đầu: QR + chuỗi bí mật để gõ tay + giờ server + ô mã đầu tiên. Đúng → W5 |
| W5 | (kết quả POST của W4) | 8 mã khôi phục, **hiện một lần**, `Cache-Control: no-store`, nút "Tôi đã lưu" → `/internal/admin` |
| W6 | `GET/POST /internal/login/recovery` | Ô mã khôi phục thay mã 6 số; dùng xong mã đó hết hiệu lực, trang báo còn mấy mã |

- W3, W4, W6 chỉ mở được khi có `mcah_admin_step` hợp lệ; không có → về W2.
- Trước khi chạy lệnh đặt mật khẩu lần đầu (5.4), W2 luôn báo sai — không có cách tạo admin từ web.
- `CLOUD_ADMIN_EMAIL` đổi sang email khác hoặc tài khoản bị `disabled_at` → phiên đang mở bị từ chối ở request kế tiếp.

### 5.4 Mật khẩu, TOTP, lưu trữ

**Mật khẩu:** băm bằng `crypto.scrypt` có sẵn của Node (không thêm thư viện), muối 16 byte; tối thiểu 12 ký tự. Đặt bằng lệnh trên server, nhập qua prompt ẩn ký tự (không qua tham số dòng lệnh để không nằm trong lịch sử shell).

**TOTP:** RFC 6238, SHA-1, 6 số, 30 giây, lệch ±1 bước — đúng mặc định Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden. **Không cần đăng ký hay xin phép Google.**
- Tự viết `cloud/src/services/totp.js` (~40 dòng, `crypto.createHmac`), test bằng số mẫu RFC 6238 phụ lục B. Thư viện mới duy nhất: `qrcode` (dựng SVG phía máy chủ).
- URI trong QR: `otpauth://totp/MCAH%20internal:<email>?secret=<base32>&issuer=MCAH`.
- Bí mật 20 byte ngẫu nhiên, **mã hoá AES-256-GCM** bằng `CLOUD_ADMIN_TOTP_KEY` (32 byte base64). Chạy https mà thiếu khoá → dừng khởi động (giống `CLOUD_COOKIE_SECRET`).
- Chống dùng lại: lưu bước thời gian vừa dùng; mã của bước ≤ bước đã dùng → từ chối.
- Mã khôi phục: 8 mã `xxxx-xxxx` (Crockford base32), lưu SHA-256, mỗi mã một lần.

**Chặn dò:** sai mật khẩu, mã 6 số hoặc mã khôi phục cộng chung: 5 lần / 15 phút → khoá đăng nhập quản trị 15 phút ("Sai quá nhiều lần, thử lại sau 15 phút"). Thêm rate limit 10 lần / phút / IP cho các POST `/internal/login*`.

**Migration** `cloud/migrations/00X_admin_auth.sql` (số tiếp theo):

| Bảng / cột | Ghi chú |
|---|---|
| `admin_auth.account_id UUID PK → account` | Một dòng (một admin) |
| `password_hash TEXT NOT NULL` | `scrypt$N$r$p$salt$hash` |
| `totp_secret_enc BYTEA`, `totp_iv BYTEA`, `totp_tag BYTEA` | NULL = chưa cài 2FA |
| `totp_confirmed_at TIMESTAMPTZ`, `totp_last_step BIGINT` | |
| `auth_version INT NOT NULL DEFAULT 1` | Tăng khi đổi mật khẩu / reset 2FA |
| `admin_recovery_code(id, account_id, code_hash UNIQUE, used_at)` | |

**Nhật ký** (`audit.action`): `admin_login`, `admin_login_fail`, `admin_2fa_enroll`, `admin_2fa_fail`, `admin_recovery_used`, `admin_password_set`, `admin_2fa_reset`, `admin_logout`. Tab Audit log hiện thêm các dòng này.

**Lệnh trên server** (`cloud/scripts/admin.js`):
```
docker compose exec cloud node scripts/admin.js set-password   # đặt / đổi mật khẩu cho CLOUD_ADMIN_EMAIL (tạo account nếu chưa có)
docker compose exec cloud node scripts/admin.js reset-2fa      # xoá TOTP + mã khôi phục; lần đăng nhập sau đi lại W4
```
Cả hai tăng `auth_version` và ghi nhật ký.

### 5.5 Design system → `/internal/design-system/`

- Bỏ route `/design-system` khỏi `App.jsx` (cả web lẫn app máy tính).
- Trang Vite thứ hai: `frontend/internal/design-system/index.html` + `src/design-system-main.jsx` (bọc cùng `ConfigProvider` / theme / `App` antd như `main.jsx`, render `DesignSystemPage`). `vite.config.js` khai `build.rollupOptions.input` gồm `index.html` và trang này.
- Build ra `dist/internal/design-system/index.html` → nginx phục vụ tĩnh, qua Basic Auth **và** `auth_request` (cần phiên quản trị đã qua 2FA).
- JS của trang nằm trong `/assets/*` (public như mọi JS khác) — chỉ là trình diễn component, không dữ liệu, chấp nhận.
- Máy dev: `npm run dev` → `http://localhost:5173/internal/design-system/`, không cần đăng nhập. Sửa `CLAUDE.md` mục 3.4 và chú thích trong `components/ds/*` sang đường mới.

## 6. File sẽ sửa / thêm

| Phần | File |
|---|---|
| nginx / deploy | `frontend/nginx.conf`, `compose.yaml` (gắn `htpasswd`, biến cloud), `cloud/.env.example`, `deploy.sh` nếu có kiểm đường dẫn |
| cloud | `src/config.js`, `src/routes/web.js` (tên mới + chuyển hướng tên cũ, xoá route pháp lý), `src/routes/api.js` + `services.js` (hai tiền tố), `src/routes/admin.js` (đường mới, phiên mới, tab), `src/routes/internal_login.js` (mới, W2–W6, `_check`, logout), `src/services/totp.js` (mới), `src/services/admin_auth.js` (mới: mật khẩu, mã hoá TOTP, mã khôi phục, đếm sai), `src/views/pages.js` (link trong trang), `migrations/00X_admin_auth.sql`, `scripts/admin.js` (mới), `package.json` (`qrcode`), test mới `test/totp.test.js`, `test/internal_login.test.js`, `test/legacy_paths.test.js`; sửa test cũ có đường dẫn |
| frontend | `src/App.jsx` (tên mới + `<Navigate>` tên cũ, bỏ design-system), `src/layouts/navConfig.js`, `src/layouts/AdminLayout.jsx`, `src/components/ds/HelpLink.jsx`, `src/components/common/WhatsNew.jsx`, `src/pages/desktop/*` (link `/bat-dau`), đổi thư mục `public/huong-dan` → `public/guide`, `public/phat-hanh` → `public/release-notes`, `public/phap-ly` → `public/legal` (đổi tên tệp thành `terms.html`, `privacy.html`); `internal/design-system/index.html`, `src/design-system-main.jsx` (mới), `vite.config.js` |
| backend | `src/services/email.service.js` (link `/set-password`), test liên quan |
| desktop | `endpoints.json` (`cloud_url` → `/account`; máy cũ học qua `latest.json`), `src/browser-login.js` (`/done`), `src/main.js` (`WEB_PAGES` nhận `guide` / `release-notes`, giữ cả tên cũ cho chắc), `src/ipc.js` nếu có đường tiếng Việt, test `endpoints.test.js`; **build:** `vite.frontend.config.mjs` (`closeBundle` đang bỏ `huong-dan`, `phat-hanh` khỏi gói app → đổi thành `guide`, `release-notes`, `legal`, thêm `internal`; bản app không được mang trang design system), `scripts/notes-page.js` (ghi vào `frontend/public/release-notes/index.html`); `package.json` nâng phiên bản + `release-notes/<phiên bản>.md` |
| tài liệu | `docs/mcah-huong-dan-server-may-chu-dich-vu.md` (đường mới, `htpasswd`, biến, lệnh `scripts/admin.js`), `docs/mcah-quy-trinh-phat-hanh.md` (link `/release-notes/`), `CLAUDE.md` 3.4, nội dung trang `/guide/` có link nội bộ; `docs/mcah-ke-hoach-ma-kich-hoat.md` 2.2 ghi đã làm theo kế hoạch này. Kế hoạch / wireframe cũ trong `docs/` **không** sửa (là lịch sử) |

Trước bước code, chạy `grep` toàn repo (trừ `node_modules`, `docs/` cũ) các chuỗi `tai-khoan`, `dang-nhap`, `dang-xuat`, `xong`, `huong-dan`, `phat-hanh`, `phap-ly`, `dieu-khoan`, `quyen-rieng-tu`, `dat-mat-khau`, `cai-dat-may`, `bat-dau`, `may-trong-van-phong`, `quan-tri`, `design-system` để bảng trên không sót. Test `legacy_paths.test.js` giữ danh sách đường cũ ở mục 4 và kiểm từng cái vẫn chuyển đúng.

## 7. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| App máy tính đã phát hành gọi `/tai-khoan/*` | Proxy cả hai tiền tố (mục 4), không redirect API; testcase chạy bằng **bản app cũ** đang phát hành |
| Google trả về callback cũ / màn đồng ý bị xét lại | Giữ callback cũ chạy song song; đổi Google Console trước deploy (⛔ Q-N7); trang pháp lý cũ 301 mãi mãi |
| Thư mời cũ với `/dat-mat-khau` | Chuyển hướng giữ `?token=` |
| Chặn nhầm địa chỉ public | Basic Auth chỉ ở `location /internal/`; testcase nhóm F |
| Hướng dẫn tạo `htpasswd` bằng bcrypt (`-B`); nginx đọc bằng `crypt()` của musl trong ảnh alpine | Bước 6 thử đúng tệp `-B` trong container; không nhận thì đổi hướng dẫn sang `-m` (apr1, nginx tự đọc) |
| Quên `htpasswd` trên server | nginx 500 cho `/internal/` (đóng); ⛔ bước 7 dừng chờ |
| Quên mật khẩu admin / mất điện thoại | 8 mã khôi phục; hết thì `scripts/admin.js set-password` / `reset-2fa` trên server |
| Lệch giờ server → mã TOTP luôn sai | Chấp nhận ±30 giây; hướng dẫn kiểm `timedatectl` (NTP); W4 hiện giờ server |
| Lộ `CLOUD_ADMIN_TOTP_KEY` | Chỉ ở secret server; đổi khoá = `reset-2fa` |
| Sót link tiếng Việt trong code / trang hướng dẫn | `grep` ở mục 6 + test `legacy_paths` |

## 8. Thứ tự làm

| Bước | Việc | Xong khi |
|---|---|---|
| 1 | Wireframe W1–W6 + trang quản trị có tab mới; cập nhật testcase; hướng dẫn server (nháp) (⛔ DỪNG chờ duyệt, kèm duyệt tên ở mục 3) | Người dùng duyệt |
| 2 | Đổi tên web app + trang tĩnh + backend email; `<Navigate>` / nginx 301 cho tên cũ | Web chạy ở dev; mọi đường cũ ở mục 4 chuyển đúng |
| 3 | Cloud: tiền tố `/account`, tên mới, chuyển hướng tên cũ, giữ `/tai-khoan` cho API / OAuth; desktop `endpoints.json` + `/done` | Bản app **mới** và bản app **cũ** đều đăng nhập (Google + mã email), quét AI, tra tàu được qua docker compose ở máy dev |
| 4 | `totp.js` + test RFC; migration; `admin_auth.js`; `scripts/admin.js` | `cloud` test qua |
| 5 | `internal_login.js` W2–W6, `_check`, logout; `admin.js` sang `/internal/admin…` + phiên mới | Đi trọn luồng bằng Google Authenticator thật ở máy dev, reset được |
| 6 | Design system thành trang Vite riêng; nginx `/internal/` (Basic Auth, proxy, `auth_request`) + compose; xoá code thừa | Testcase nhóm A–F qua bằng docker compose ở máy dev |
| 7 | Cập nhật tài liệu (mục 6), gộp hướng dẫn vào `docs/mcah-huong-dan-server-may-chu-dich-vu.md`. ⛔ DỪNG: Google Console (Q-N7) + server (Q-N4) | Người dùng báo đã xong |
| 8 | Deploy `./deploy.sh`, chạy testcase trên `mcah.axalize.vn` | Testcase A–F và G (bản cũ) qua trên server thật |
| 9 | **Build app Ubuntu** theo "Luật phiên bản" của `docs/mcah-quy-trinh-phat-hanh.md`: nâng `desktop/package.json` (số kế tiếp sau bản đang phát), viết `release-notes/<phiên bản>.md` (người dùng đọc được: "Đổi địa chỉ trang hướng dẫn / ghi chú phát hành", không thuật ngữ), `npm run notes:page`, gộp vào **một** commit trên `dev`; ⛔ hỏi người dùng trước khi push `dev`; rồi `npm run dist:linux` | `dist:linux` chạy hết không lỗi (kể cả `scan-secrets`, `build-info`); `build-info-linux.json` đúng commit; cài `.deb` (hoặc chạy `linux-unpacked`) trên máy Ubuntu: đăng nhập qua `/account`, quét AI, mở Hướng dẫn / Có gì mới ra `/guide/`, `/release-notes/` (testcase G4, G5, G7); gói không có `internal/`, `guide/`, `release-notes/`. **Chưa phát hành** (`npm run release`) — việc đó người dùng quyết riêng |

**Việc chỉ coi là hoàn thành khi xong bước 9.** Bản Windows build trên máy nhà theo luồng thường của quy trình phát hành, không thuộc điều kiện xong của kế hoạch này.
