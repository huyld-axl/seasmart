# MCAH — Đưa máy chủ dịch vụ lên server (cho người giữ server)

Máy chủ dịch vụ (`cloud/`) lo tài khoản, đăng nhập Google, thư mời và chuyển tiếp AI / tra tàu cho **app máy tính**.
Nó chạy cùng bản web trên một tên miền, ở đường dẫn **`/tai-khoan`**: `https://mcah.axalize.dev/tai-khoan`.
Bản web không đổi gì. Sau khi làm một lần các việc dưới đây, mỗi lần deploy (`./deploy.sh`) sẽ dựng cả hai.

## Những gì `./deploy.sh` đã tự làm

- Dựng thêm hai container: `cloud-postgres` (Postgres riêng) và `cloud`; container web (`frontend`) chuyển `/tai-khoan/` sang `cloud`.
- Lần đầu tự tạo `docker/cloud-postgres.env` (mật khẩu Postgres ngẫu nhiên, không hiện ra).
- Mỗi lần khởi động, `cloud` tự chạy migration của nó.
- Chưa có `cloud/.env` thì **bỏ qua máy chủ dịch vụ** và deploy bản web như cũ (in một dòng nhắc); `/tai-khoan` trả lỗi 502 cho tới khi có.

## Việc cần làm một lần trên server

### 1. Tạo `cloud/.env` (không commit, giống `backend/.env`)

```bash
cp cloud/.env.example cloud/.env
chmod 600 cloud/.env
```

Điền:

| Biến | Giá trị |
|---|---|
| `CLOUD_PUBLIC_URL` | `https://mcah.axalize.dev/tai-khoan` (đúng như vậy, không có `/` cuối) |
| `CLOUD_COOKIE_SECRET` | Chuỗi ngẫu nhiên: chạy `openssl rand -hex 32` rồi dán kết quả. Thiếu thì `cloud` không khởi động |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Lấy từ người phụ trách Google Cloud Console của MCAH |
| `SMTP_*` | Chép nguyên các dòng `SMTP_*` của `backend/.env` (cùng tên). Dùng để gửi thư xác minh, quên mật khẩu, lời mời |
| `AI_PROVIDER`, `OPENAI_*` | Chép từ `backend/.env` (cùng tên) |
| `VESSEL_LOOKUP_PROVIDER`, `VESSEL_API_BASE_URL`, `VESSEL_API_ENC_KEY` | Chép từ `backend/.env` nếu có; không có thì để trống (tắt tra tàu theo IMO) |
| `CLOUD_ADMIN_EMAILS` | Email nội bộ được vào trang quản trị `https://mcah.axalize.dev/tai-khoan/quan-tri` |

### 2. Deploy như mọi lần

```bash
./deploy.sh
```

Kiểm: mở `https://mcah.axalize.dev/tai-khoan/health` thấy `{"status":"ok"}`; mở `https://mcah.axalize.dev/tai-khoan/dang-nhap` thấy trang đăng nhập MCAH có nút "Tiếp tục với Google".

Nếu trước Docker còn một proxy riêng (Caddy, nginx của máy, Cloudflare…) chỉ chuyển một số đường dẫn: cho `/tai-khoan/` đi qua như các đường dẫn khác. Nếu cả tên miền đã đổ vào container web thì không phải làm gì.

### 3. Nạp danh mục tàu thế giới (một lần, khoảng 1 phút)

```bash
docker compose run --rm -v "$PWD/docs/ships_plain.db:/data/ships.db:ro" cloud node scripts/seed-ship-catalog.js /data/ships.db
```

### 4. Sao lưu — quan trọng

| Cái gì | Ở đâu | Vì sao |
|---|---|---|
| **Khoá ký vé** `signing-key.pem` | volume Docker `cloud_data` (`/app/cloud/.data` trong container) | **Mất khoá này thì mọi app máy tính đã cài không đăng nhập được nữa.** Sao lưu ngay sau lần deploy đầu, cất nơi an toàn, không để chung chỗ với mã nguồn |
| Postgres của máy chủ dịch vụ | volume `cloud_postgres_data` | Tài khoản, văn phòng, lời mời của khách. Đặt lịch sao lưu như DB bản web |
| `cloud/.env` | trên server | Chứa secret Google, SMTP, AI |

Lấy khoá ký ra để sao lưu:

```bash
docker compose cp cloud:/app/cloud/.data/signing-key.pem ./signing-key.pem.backup && chmod 600 ./signing-key.pem.backup
```

(Rồi chuyển tệp đó tới nơi cất an toàn và xoá bản trên server.)

### 5. Báo lại cho người build app

Sau khi `https://mcah.axalize.dev/tai-khoan/health` chạy, báo người build app máy tính. Bộ cài cho server này phải build với `MCAH_CLOUD_URL=https://mcah.axalize.dev/tai-khoan` (bộ cài tự lấy khoá công khai từ địa chỉ đó).

## Việc liên quan tên miền (trước khi mở cho khách thật)

- Google yêu cầu chủ DNS của `axalize.dev` xác minh quyền sở hữu trên Google Search Console (thêm một bản ghi TXT). Chỉ cần khi chuyển đăng nhập Google sang chế độ chính thức; chế độ thử chưa cần.
- Nếu đổi sang tên miền khác: đổi `CLOUD_PUBLIC_URL`, báo người phụ trách Google Cloud Console thêm địa chỉ chuyển về mới, và build lại bộ cài app.

## Chỗ phát bộ cài app máy tính (giai đoạn 6)

Trang `https://mcah.axalize.dev/download` và app máy tính đọc bộ cài ở `/download/files/` (kênh ổn định) và `/download/files/beta/` (kênh thử nghiệm). Bộ cài không nằm trong git: script phát hành chép thẳng lên server bằng rsync.

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

Kiểm: `curl -I https://mcah.axalize.dev/download/files/latest.json` trả 404 khi chưa phát bản nào, 200 sau lần phát đầu.

Trên máy phát hành, đặt đích đẩy: `export MCAH_RELEASE_TARGET=mcah-release@mcah.axalize.dev:/srv/mcah/releases`.
