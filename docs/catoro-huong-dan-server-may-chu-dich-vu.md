# Catoro — Đưa máy chủ dịch vụ lên server (cho người giữ server)

Máy chủ dịch vụ (`cloud/`) lo tài khoản, đăng nhập Google, thư mời và chuyển tiếp AI / tra tàu cho **app máy tính**.
Nó chạy cùng bản web trên một tên miền, ở đường dẫn **`/account`**: `https://mcah.axalize.vn/account`. Đường cũ `/tai-khoan` vẫn chạy song song cho app đã cài (xem mục "Đổi địa chỉ sang tiếng Anh").
Trang quản trị Axalize nằm ở khu nội bộ **`/internal/`** (Basic Auth + mật khẩu + mã xác minh hai bước).
Bản web không đổi gì. Sau khi làm một lần các việc dưới đây, mỗi lần deploy (`./deploy.sh`) sẽ dựng cả hai.

## Những gì `./deploy.sh` đã tự làm

- Dựng thêm hai container: `cloud-postgres` (Postgres riêng) và `cloud`; container web (`frontend`) chuyển `/account/` (và `/tai-khoan/` cũ), `/internal/` sang `cloud`.
- Lần đầu tự tạo `docker/cloud-postgres.env` (mật khẩu Postgres ngẫu nhiên, không hiện ra).
- Mỗi lần khởi động, `cloud` tự chạy migration của nó.
- Chưa có `cloud/.env` thì **bỏ qua máy chủ dịch vụ** và deploy bản web như cũ (in một dòng nhắc); `/account` trả lỗi 502 cho tới khi có.

## Việc cần làm một lần trên server

### 1. Tạo `cloud/.env` (không commit, giống `backend/.env`)

```bash
cp cloud/.env.example cloud/.env
chmod 600 cloud/.env
```

Điền:

| Biến | Giá trị |
|---|---|
| `CLOUD_PUBLIC_URL` | `https://mcah.axalize.vn/account` (đúng như vậy, không có `/` cuối) |
| `CLOUD_COOKIE_SECRET` | Chuỗi ngẫu nhiên: chạy `openssl rand -hex 32` rồi dán kết quả. Thiếu thì `cloud` không khởi động |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Lấy từ người phụ trách Google Cloud Console của Catoro |
| `SMTP_*` | Chép nguyên các dòng `SMTP_*` của `backend/.env` (cùng tên). **Bắt buộc**: gửi mã đăng nhập 6 số (không còn mật khẩu) |
| `AI_PROVIDER`, `OPENAI_*` | Chép từ `backend/.env` (cùng tên) |
| `VESSEL_LOOKUP_PROVIDER`, `VESSEL_API_BASE_URL`, `VESSEL_API_ENC_KEY` | Chép từ `backend/.env` nếu có; không có thì để trống (tắt tra tàu theo IMO) |
| `CLOUD_ADMIN_EMAIL` | Email của **admin duy nhất** khu nội bộ, ví dụ `admin@axalize.vn`. (Biến cũ `CLOUD_ADMIN_EMAILS` còn thì `cloud` tạm lấy email đầu; xoá sau khi đã có biến mới.) |
| `CLOUD_ADMIN_TOTP_KEY` | Khoá mã hoá bí mật xác minh hai bước: chạy `openssl rand -base64 32` rồi dán kết quả. Thiếu thì `cloud` không khởi động. **Sao lưu** cùng `cloud/.env` |

### 2. Deploy như mọi lần

```bash
./deploy.sh
```

Kiểm: mở `https://mcah.axalize.vn/account/health` thấy `{"status":"ok"}`; mở `https://mcah.axalize.vn/account/login` thấy trang đăng nhập Catoro có nút "Tiếp tục với Google" và ô email; nhập email của một tài khoản có thật, nhận được thư "Mã đăng nhập Catoro".

Nếu trước Docker còn một proxy riêng (Caddy, nginx của máy, Cloudflare…) chỉ chuyển một số đường dẫn: cho `/account/`, `/tai-khoan/`, `/internal/`, `/guide/`, `/release-notes/`, `/legal/` đi qua như các đường dẫn khác và **không** xoá header `Authorization` (Basic Auth của `/internal/` cần nó). Nếu cả tên miền đã đổ vào container web thì không phải làm gì.

### 3. Nạp danh mục tàu thế giới (một lần, khoảng 1 phút)

```bash
docker compose run --rm -v "$PWD/docs/ships_plain.db:/data/ships.db:ro" cloud node scripts/seed-ship-catalog.js /data/ships.db
```

### 4. Sao lưu — quan trọng

| Cái gì | Ở đâu | Vì sao |
|---|---|---|
| **Khoá ký vé** `signing-key.pem` | volume Docker `cloud_data` (`/app/cloud/.data` trong container) | **Mất khoá này thì mọi app máy tính đã cài không đăng nhập được nữa.** Sao lưu ngay sau lần deploy đầu, cất nơi an toàn, không để chung chỗ với mã nguồn |
| Postgres của máy chủ dịch vụ | volume `cloud_postgres_data` | Tài khoản, văn phòng, lời mời của khách. Đặt lịch sao lưu như DB bản web |
| `cloud/.env` | trên server | Chứa secret Google, SMTP, AI và `CLOUD_ADMIN_TOTP_KEY` (mất khoá này thì xác minh hai bước của admin hỏng, phải reset) |
| Mật khẩu Basic Auth, mật khẩu admin, 8 mã khôi phục | trình quản lý mật khẩu của Axalize | Server chỉ lưu dạng băm, không ai lấy lại được |

Lấy khoá ký ra để sao lưu:

```bash
docker compose cp cloud:/app/cloud/.data/signing-key.pem ./signing-key.pem.backup && chmod 600 ./signing-key.pem.backup
```

(Rồi chuyển tệp đó tới nơi cất an toàn và xoá bản trên server.)

### 5. Báo lại cho người build app

Sau khi `https://mcah.axalize.vn/account/health` chạy, báo người build app máy tính. Bộ cài lấy địa chỉ máy chủ từ `desktop/endpoints.json` (`https://mcah.axalize.vn/account`); app đã cài tự học địa chỉ mới khi kiểm cập nhật. **Không** gỡ đường `/tai-khoan` khỏi nginx cho tới khi người build app báo mọi máy đã lên bản mới.

## Khu nội bộ `/internal/`: trang quản trị Axalize

Mọi trang riêng của Axalize nằm dưới `https://mcah.axalize.vn/internal/`, qua 3 lớp: **Basic Auth** của trình duyệt (nginx) → **email + mật khẩu** → **mã 6 số từ app Authenticator**. Chỉ có **một** admin (`CLOUD_ADMIN_EMAIL`). Không có trang đăng ký, quên mật khẩu hay tắt xác minh trên web: mọi việc đó làm bằng lệnh trên server.

### Làm một lần

1. **Tệp Basic Auth** (một dòng, ngoài repo). Tên người dùng tuỳ chọn, mật khẩu dài, **khác** mật khẩu admin:

   ```bash
   sudo apt install apache2-utils
   ```

   ```bash
   sudo mkdir -p /srv/mcah/internal-auth
   ```

   ```bash
   sudo htpasswd -c -B /srv/mcah/internal-auth/htpasswd axalize
   ```

   ```bash
   sudo chmod 644 /srv/mcah/internal-auth/htpasswd
   ```

   Đổi mật khẩu sau này: chạy lại lệnh `htpasswd -c -B …`, không cần deploy lại. Muốn để thư mục ở chỗ khác: đặt `INTERNAL_AUTH_DIR=/đường/dẫn` trong tệp `.env` của compose (cạnh `compose.yaml`). Thiếu tệp thì `/internal/` trả 500 (đóng, phần còn lại của web vẫn chạy) và `./deploy.sh` in một dòng nhắc.
2. Đặt `CLOUD_ADMIN_EMAIL`, `CLOUD_ADMIN_TOTP_KEY` trong `cloud/.env` (mục 1 ở trên), rồi `./deploy.sh`.
3. **Mật khẩu admin** (gõ ở dấu nhắc, ít nhất 12 ký tự, không hiện ra, không nằm trong lịch sử shell; tài khoản chưa có thì lệnh tạo luôn):

   ```bash
   docker compose exec cloud node scripts/admin.js set-password
   ```

4. **Cài xác minh hai bước:** cần điện thoại có Google Authenticator (hoặc Microsoft Authenticator, Authy, 1Password, Bitwarden — không cần đăng ký gì với Google). Mở `https://mcah.axalize.vn/internal/` → Basic Auth → email + mật khẩu → quét mã QR trong app (bấm **+** → **Quét mã QR**, app hiện mục **Catoro internal**) → nhập mã 6 số → trang hiện **8 mã khôi phục, chỉ hiện một lần**: chép vào trình quản lý mật khẩu hoặc in ra cất kỹ.

### Dùng hằng ngày

Mở `https://mcah.axalize.vn/internal/` → (Basic Auth, trình duyệt nhớ tới khi đóng) → email + mật khẩu → mã 6 số trong app Authenticator. Phiên giữ **8 giờ**. Các tab:

- **Khách hàng:** khách mua Catoro thì nhập **Tên văn phòng**, ghi chú (tên công ty, số hợp đồng…), **email và họ tên quản trị văn phòng**, bấm **Thêm khách hàng**. Không có thư nào gửi đi: báo khách tải Catoro và đăng nhập bằng đúng email đó. Văn phòng ở trạng thái "Chờ cài máy chính" tới khi quản trị đăng nhập trên máy chính. **Thêm quản trị** khi quản trị cũ nghỉ. **Khoá** văn phòng (phải ghi lý do) làm mọi máy của văn phòng không vào được Catoro trong vòng 1 giờ; dữ liệu trên máy khách giữ nguyên; **Mở khoá** là dùng tiếp.
- **Tài khoản:** mọi tài khoản, kể cả nhân viên do quản trị văn phòng tạo trong app: văn phòng, vai trò, người tạo, lần đăng nhập gần nhất (Google / mã email), trạng thái. **Khoá** một người (phải ghi lý do): người đó không đăng nhập được nữa, máy đang mở bị đưa ra trong vòng 1 giờ.
- **Nhật ký:** thêm khách hàng / quản trị / tài khoản, cài máy chính, khoá / mở khoá kèm lý do.

- **Design system ↗:** mở `/internal/design-system/` ở tab mới (bộ control dùng chung của app).

- Sai mật khẩu hoặc sai mã tổng cộng 5 lần trong 15 phút → khoá đăng nhập quản trị 15 phút. Chờ rồi thử lại.
- Mã luôn sai dù gõ đúng: giờ điện thoại hoặc server lệch. Điện thoại: bật giờ tự động. Server: `timedatectl`, dòng `System clock synchronized` phải là `yes` (không thì `sudo timedatectl set-ntp true`). Trang cài xác minh có hiện giờ server để đối chiếu.
- Mọi lần đăng nhập, sai mật khẩu / mã, dùng mã khôi phục, đặt mật khẩu, reset xác minh nằm ở tab **Nhật ký** (kèm IP).

### Khi có sự cố

| Tình huống | Làm gì |
|---|---|
| Mất / đổi điện thoại, **còn** mã khôi phục | Ở màn nhập mã bấm **Mất điện thoại?**, nhập một mã khôi phục. Rồi chạy `reset-2fa` (dòng dưới) và cài lại trên điện thoại mới để có bộ mã mới |
| Mất điện thoại **và** hết mã khôi phục | `docker compose exec cloud node scripts/admin.js reset-2fa`, gõ `co` để đồng ý. Lần đăng nhập sau hiện QR mới |
| Quên mật khẩu admin, hoặc nghi lộ | `docker compose exec cloud node scripts/admin.js set-password` — mọi phiên quản trị đang mở bị đăng xuất ngay |
| Quên / nghi lộ mật khẩu Basic Auth | Chạy lại `sudo htpasswd -c -B /srv/mcah/internal-auth/htpasswd axalize` |
| Đổi admin sang email khác | Sửa `CLOUD_ADMIN_EMAIL`, `docker compose up -d cloud`, rồi `set-password` và cài xác minh lại |
| Lộ hoặc mất `CLOUD_ADMIN_TOTP_KEY` | Đặt khoá mới, `docker compose up -d cloud`, rồi `reset-2fa` và cài lại |
| `/internal/` báo 500 | Thiếu `/srv/mcah/internal-auth/htpasswd` hoặc không đọc được: làm lại bước 1 |
| `cloud` không khởi động, log nói thiếu `CLOUD_ADMIN_TOTP_KEY` | Đặt biến ở mục 1 |

**Thư bắt buộc phải gửi được:** mã đăng nhập đi qua email, nên `SMTP_*` trong `cloud/.env` phải đúng. Sau khi deploy, đăng nhập thử bằng mã email; kiểm thư không vào Thư rác (tên miền gửi cần SPF / DKIM). Mỗi người phải đăng nhập lại qua trình duyệt sau 30 ngày.

## Đổi địa chỉ sang tiếng Anh (2026-11)

Các địa chỉ cũ vẫn mở được (nginx chuyển 301, hoặc chạy song song):

| Cũ | Mới |
|---|---|
| `/tai-khoan/…` (máy chủ dịch vụ) | `/account/…` — `/tai-khoan/` vẫn chạy song song cho app đã cài, không gỡ khi chưa được báo |
| `/tai-khoan/quan-tri…` | `/internal/admin…` |
| `/tai-khoan/dieu-khoan`, `/tai-khoan/quyen-rieng-tu` | `/legal/terms`, `/legal/privacy` |
| `/huong-dan/`, `/phat-hanh/` | `/guide/`, `/release-notes/` |
| `/design-system` | `/internal/design-system/` (đường cũ trả 404) |

**Google Cloud Console** (người phụ trách Google Cloud của MCAH, làm **trước** khi deploy bản đổi địa chỉ): Google Auth Platform → Clients → client Web của MCAH → **Authorized redirect URIs**: **thêm** `https://mcah.axalize.vn/account/google/callback`, **giữ** `…/tai-khoan/google/callback` tới khi mọi máy lên bản mới. Branding → điều khoản: `https://mcah.axalize.vn/legal/terms`, quyền riêng tư: `https://mcah.axalize.vn/legal/privacy` (có thể làm Google xét lại màn đồng ý; địa chỉ cũ vẫn chuyển sang trang mới nên không lỗi trong lúc chờ).

Ai đang đăng nhập trên trình duyệt ở trang tài khoản sẽ phải đăng nhập lại một lần. App máy tính không bị ảnh hưởng.

## Việc liên quan tên miền (trước khi mở cho khách thật)

- Google yêu cầu chủ DNS của `axalize.vn` xác minh quyền sở hữu trên Google Search Console (thêm một bản ghi TXT). Chỉ cần khi chuyển đăng nhập Google sang chế độ chính thức; chế độ thử chưa cần.
- Nếu đổi sang tên miền khác: đổi `CLOUD_PUBLIC_URL`, báo người phụ trách Google Cloud Console thêm địa chỉ chuyển về mới, và build lại bộ cài app.

## Chỗ phát bộ cài app máy tính (giai đoạn 6)

Trang `https://mcah.axalize.vn/download` và app máy tính đọc bộ cài ở `/download/files/` (kênh ổn định) và `/download/files/beta/` (kênh thử nghiệm). Bộ cài không nằm trong git: script phát hành chép thẳng lên server bằng rsync.

Làm một lần trên server:

1. Tạo thư mục và tài khoản chỉ dùng để đẩy bộ cài:

   ```bash
   sudo mkdir -p /srv/mcah/releases/beta
   sudo useradd --system --create-home --shell /bin/bash mcah-release
   sudo chown -R mcah-release:mcah-release /srv/mcah/releases
   ```

2. Thêm khoá SSH công khai của máy phát hành (người giữ khoá ký gửi) vào `/home/mcah-release/.ssh/authorized_keys`. Tài khoản này chỉ cần ghi vào `/srv/mcah/releases`.
3. Nếu muốn để thư mục ở chỗ khác: đặt `RELEASES_DIR=/đường/dẫn` trong tệp `.env` của compose (cạnh `compose.yaml`). Mặc định `/srv/mcah/releases`.
4. Chạy lại `./deploy.sh` (frontend gắn thư mục đó chỉ đọc vào `/srv/releases`, nginx phục vụ ở `/download/files/`).

Kiểm: `curl -I https://mcah.axalize.vn/download/files/latest.json` trả 404 khi chưa phát bản nào, 200 sau lần phát đầu.

Trên máy phát hành, đặt đích đẩy: `export CATORO_RELEASE_TARGET=mcah-release@mcah.axalize.vn:/srv/mcah/releases` (tên cũ `MCAH_RELEASE_TARGET` vẫn chạy).
