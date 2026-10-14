# MCAH (Marineport)

Cổng tuyển dụng và quản lý thuyền viên hàng hải. Phần chính của đợt này: **AI tách và đọc giấy tờ thuyền viên**:
thả sổ thuyền viên, chứng chỉ, giấy khác vào hồ sơ; AI tách từng giấy, đọc từng ô; người duyệt so với bản gốc rồi
đưa vào hồ sơ (chứng chỉ và chuyến đi tàu).

- Backend: Fastify 5, PostgreSQL 17 (`pg`), JWT. Thư mục `backend/`.
- Frontend: React 19, Ant Design 6, React Query, Vite. Thư mục `frontend/`.
- Quy ước mã và kiến trúc: `CLAUDE.md`. Kế hoạch, số đo và quyết định của tính năng AI: `docs/mcah-ke-hoach-ai-tach-doc-giay-to.md`.

## Cần có

- Node.js (đã chạy với bản 24; dự án chưa khai báo `engines`).
- PostgreSQL 17. Có cấu hình Docker và script deploy ở [docker/README.md](docker/README.md).
- Một khoá gọi AI (OpenAI hoặc endpoint tương thích). Không có khoá thì ứng dụng vẫn chạy: tệp tải lên được lưu
  kèm hồ sơ và báo "AI chưa được cấu hình", chưa được đọc.

## Triển khai bằng Docker trên máy mới

Cần Docker Engine, Docker Compose V2 và Docker Buildx; máy phải chạy được `docker compose`.
Script dùng Bash, `openssl` và `flock`, phù hợp Linux hoặc WSL. Không cần cài Node.js hay PostgreSQL trực tiếp trên máy.

```bash
git clone <URL_REPO>
cd seasmart

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Điền cấu hình cần thiết vào hai file `.env`, đặc biệt cấu hình AI nếu dùng tính năng đọc giấy tờ.
Docker dùng đúng `frontend/.env`; file `frontend/.env.local` trong hướng dẫn chạy local bên dưới không thay thế file này.

```bash
bash deploy.sh
```

Script sẽ:

1. Tạo `docker/postgres.env` và `docker/jwt_secret` nếu chưa có, dùng cho PostgreSQL và JWT trong Docker.
2. Build image backend và frontend. Image backend có LibreOffice để xuất PDF.
3. Khởi động PostgreSQL, chạy migration và kiểm tra cấu hình/kết nối database.
4. Khởi động backend/frontend và chờ các container báo healthy.

Mở ứng dụng tại **http://localhost:8080**. Backend mặc định ở `127.0.0.1:3000`, PostgreSQL ở `127.0.0.1:5433`.
Frontend Docker gọi API qua `/api/v1` trên cùng địa chỉ ứng dụng.

Máy mới chỉ có schema và dữ liệu danh mục từ migration; dữ liệu nghiệp vụ và tài khoản trên máy cũ không đi theo Git.
Nếu không khôi phục database cũ, tạo tài khoản quản trị đầu tiên bằng lệnh sau rồi nhập email và mật khẩu theo hướng dẫn:

```bash
docker compose --env-file /dev/null exec backend node scripts/seed_admin.js
```

Mật khẩu cần ít nhất 12 ký tự; script yêu cầu nhập lại để xác nhận.

### Cập nhật code và migration tự động

```bash
git pull
bash deploy.sh
```

Mỗi lần chạy `bash deploy.sh` (hoặc `bash deploy.sh --deploy`), script build lại ứng dụng và tự chạy
các file SQL trong `backend/migrations/postgres/` theo thứ tự tên file:

- File mới chưa áp dụng: chạy trong transaction và ghi vào bảng `schema_migration`.
- File đã áp dụng, checksum không đổi: bỏ qua.
- File đã áp dụng nhưng nội dung bị sửa: báo lỗi và dừng triển khai.
- Migration bị lỗi: rollback migration đó và dừng triển khai; các migration trước đó đã thành công vẫn được giữ.

Khi thay đổi cấu trúc database, **thêm file migration mới**, ví dụ `003_add_export_field.sql`, thay vì sửa file đã chạy.
Chế độ `--build-only` chỉ build image, không chạy migration và không khởi động lại ứng dụng.

### Lệnh vận hành

```bash
bash deploy.sh --status          # Xem trạng thái container
bash deploy.sh --stop            # Dừng dịch vụ, giữ database và tệp đã tải lên
bash deploy.sh --build-only      # Chỉ build image

# Nếu mạng Docker khi build không tải được dependency, dùng mạng host
BUILD_NETWORK=host bash deploy.sh

# Đổi cổng frontend nếu 8080 đã được sử dụng
WEB_PORT=8081 bash deploy.sh
```

Trước khi push, đưa đầy đủ cấu hình Docker, `deploy.sh`, script backend, migration và **12 file mẫu Excel trong `forms/` ở root**
vào Git. Docker gắn thư mục `forms/` vào backend để xem trước và xuất giấy tờ; không có mẫu thì API xem trước trả 404.

Không commit `.env`, `docker/postgres.env` hoặc `docker/jwt_secret`. Database và tệp đã tải lên nằm trong Docker volumes;
muốn chuyển dữ liệu sang máy khác cần sao lưu và khôi phục riêng cả database lẫn tệp tải lên.
Xem thêm cấu hình tại [docker/README.md](docker/README.md).

## Cài và chạy local bằng Node.js

```bash
# 1. Cài thư viện (ba lần: gốc cho husky và lint-staged, backend, frontend)
npm install
npm install --prefix backend
npm install --prefix frontend

# 2. Cấu hình PostgreSQL local (hoặc dùng ./deploy.sh để chạy toàn bộ bằng Docker)
cp backend/.env.example backend/.env       # điền JWT_SECRET (>= 32 ký tự), DB_PASSWORD, khoá AI
cp frontend/.env.example frontend/.env.local

# 3. Tạo database PostgreSQL theo DB_NAME rồi chạy schema và danh mục
npm run migrate --prefix backend

# 4. Chạy
npm run dev --prefix backend               # http://localhost:3000
npm run dev --prefix frontend              # http://localhost:5173
```

Migration PostgreSQL ở `backend/migrations/postgres/`, có transaction và checksum,
chạy lại sẽ bỏ qua các file đã áp dụng. Các migration MySQL cũ giữ để tham chiếu.

## Cấu hình `backend/.env`

| Biến | Ý nghĩa |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Kết nối CSDL. Đặt mật khẩu riêng cho máy chủ thật |
| `JWT_SECRET` | Bắt buộc, chuỗi ngẫu nhiên từ 32 ký tự. Tạo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGINS` | Địa chỉ frontend được gọi API, ngăn cách bằng dấu phẩy (mặc định `http://localhost:5173`) |
| `UPLOAD_DIR` | Nơi lưu tệp gốc và ảnh trang (mặc định `./uploads`). Tệp chứa giấy tờ cá nhân: không commit, sao lưu như dữ liệu thật |
| `AI_PROVIDER` | `openai` (mặc định) hoặc `anthropic` |
| `OPENAI_API_KEY` | Khoá gọi AI. Thiếu thì "AI chưa được cấu hình" |
| `OPENAI_BASE_URL` | Để trống khi gọi thẳng OpenAI; điền khi dùng máy chủ trung gian. **Ảnh giấy tờ đi qua máy chủ này** |
| `OPENAI_MODEL_SMALL` | Model nhỏ, dùng để tách trang |
| `OPENAI_MODEL_STRONG` | Model mạnh, dùng để đọc sổ thuyền viên và chứng chỉ (số chứng chỉ sai ít hơn nhiều so với model nhỏ) |
| `AI_CONCURRENCY` | Số lời gọi AI chạy đồng thời (mặc định 3) |
| `AI_TIMEOUT_MS` | Hết giờ một lời gọi (mặc định 120000); lời gọi tự thử lại 3 lần |
| `SOFFICE_PATH` | Lệnh LibreOffice dùng để xuất giấy tờ ra PDF (mặc định `soffice`). Máy chủ phải cài LibreOffice; chưa cài thì chỉ tải được Excel |
| `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`, `APP_URL` | Cổng gửi SMS. Hiện không tính năng nào dùng (ký online đã bỏ) |

Frontend: `VITE_API_URL` là địa chỉ API (`http://localhost:3000/api/v1`). Hai biến `VITE_LOCAL_DEMO_*` chỉ để có nút
đăng nhập nhanh trên máy cá nhân; chúng nằm trong mã JS đã build, chỉ dùng tài khoản thử, không dùng tài khoản thật.

## Cách dùng tính năng AI đọc giấy tờ

1. Mở hồ sơ thuyền viên, bấm **Tải giấy tờ lên** (đường dẫn `/seafarers/:id/upload`). Thả PDF, JPG, PNG, tối đa 25 MB
   mỗi tệp, thả nhiều tệp một lần được. Mỗi tệp chỉ hiện "Đang xử lý" hoặc "Xong"; thả 21 tệp mẫu mất khoảng 3 phút.
2. Bấm **Duyệt N giấy** (`/seafarers/:id/review`). Từng giấy một: bản gốc bên trái, ô bên phải.
   - Bỏ qua ô là chấp nhận; gõ khác giá trị AI đọc là "Đã sửa".
   - Ngày AI chưa chắc và số GCNKNCM phải bấm ✓ một lần.
   - Chứng chỉ bấm **Đã so số, xác nhận**; giấy mang tên khác hồ sơ phải bấm "Vẫn đúng người" hoặc bỏ giấy.
   - Giấy loại "Khác" (hộ chiếu, tiêm chủng, sổ nước ngoài) chỉ lưu kèm hồ sơ, không cần duyệt.
3. **Đưa vào hồ sơ**: chứng chỉ vào tab Chứng chỉ, mỗi trang bố trí chức danh thành một chuyến ở tab Đi tàu.
   Sửa hay xoá chuyến đi tàu sau đó bắt buộc ghi lý do (lưu vào lịch sử hồ sơ).

Giới hạn đã biết: chưa tô sáng ô tương ứng trên bản gốc (cần AI trả vị trí ô; đã đo thử, xem tài liệu kế hoạch mục B1);
chưa có giao diện để người dùng tự chia lại trang hay tách giấy (API `regroup` đã có).

## Kiểm tra

```bash
npm test                 # backend và frontend
npm run lint

# Test tích hợp trên PostgreSQL riêng, có schema và một hồ sơ thuyền viên giả
# Không dùng database chính. Tạo seasmart_test và chạy migration trước.
INTEGRATION_DB_NAME=seasmart_test npm test --prefix backend
```

Đo độ đúng của AI trên bộ mẫu (gọi AI thật, tốn token, gửi ảnh mẫu tới nhà cung cấp đang cấu hình):

```bash
cd backend
DB_NAME=seasmart_test node scripts/eval_reader.js --truth ../docs/samples/ban_doc_chuan.json --out /tmp/eval.json
```

Bộ mẫu `docs/samples/` chứa giấy tờ thật nên nằm ngoài git (`.gitignore`).

## Thiết kế và UI

- Wireframe đã chốt: `docs/design/wireframes/nhom-d.html` (mở bằng một máy chủ tĩnh ở thư mục gốc dự án).
- UI Kit: `docs/design/ui-kit/mcah-ui.html`, nhóm "AI đọc giấy tờ" (D1 đến D4).
- Component dùng chung: `frontend/src/components/ds/`, xem tại `/design-system` khi chạy frontend.
- Công cụ đo giao diện `probe.mjs` mở route cần đăng nhập bằng `?devToken=<JWT>` (chỉ ở chế độ dev).
