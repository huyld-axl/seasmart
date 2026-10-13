# MCAH (Marineport)

Cổng tuyển dụng và quản lý thuyền viên hàng hải. Phần chính của đợt này: **AI tách và đọc giấy tờ thuyền viên**:
thả sổ thuyền viên, chứng chỉ, giấy khác vào hồ sơ; AI tách từng giấy, đọc từng ô; người duyệt so với bản gốc rồi
đưa vào hồ sơ (chứng chỉ và chuyến đi tàu).

- Backend: Fastify 5, MySQL/MariaDB (`mysql2`), JWT. Thư mục `backend/`.
- Frontend: React 19, Ant Design 6, React Query, Vite. Thư mục `frontend/`.
- Quy ước mã và kiến trúc: `CLAUDE.md`. Kế hoạch, số đo và quyết định của tính năng AI: `docs/mcah-ke-hoach-ai-tach-doc-giay-to.md`.

## Cần có

- Node.js (đã chạy với bản 24; dự án chưa khai báo `engines`).
- MySQL 8 hoặc MariaDB, bộ ký tự `utf8mb4` (đã chạy với MariaDB).
- Một khoá gọi AI (OpenAI hoặc endpoint tương thích). Không có khoá thì ứng dụng vẫn chạy: tệp tải lên được lưu
  kèm hồ sơ và báo "AI chưa được cấu hình", chưa được đọc.

## Cài và chạy

```bash
# 1. Cài thư viện (ba lần: gốc cho husky và lint-staged, backend, frontend)
npm install
npm install --prefix backend
npm install --prefix frontend

# 2. Tạo CSDL rồi chạy migration theo thứ tự tên tệp
mysql -u root -e "CREATE DATABASE marineport CHARACTER SET utf8mb4"
mysql -u root marineport < migration.sql
for f in backend/migrations/*.sql; do mysql -u root marineport < "$f"; done

# 3. Cấu hình
cp backend/.env.example backend/.env       # điền JWT_SECRET (>= 32 ký tự), DB_PASSWORD, khoá AI
cp frontend/.env.example frontend/.env.local

# 4. Chạy
npm run dev --prefix backend               # http://localhost:3000
npm run dev --prefix frontend              # http://localhost:5173
```

Các migration chạy lại nhiều lần không lỗi. Migration 021 đến 024 là của tính năng AI đọc giấy tờ
(tệp tải lên, chuyến đi tàu, chứng chỉ từ giấy, nhật ký gọi AI).

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
| `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`, `APP_URL` | Gửi link ký online (không liên quan AI đọc giấy tờ) |

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

# Test tích hợp trên DB riêng (không bao giờ dùng DB chính; tên DB phải khác `marineport`)
mysql -u root -e "CREATE DATABASE marineport_g15 CHARACTER SET utf8mb4"
# nạp migration.sql và backend/migrations vào marineport_g15 như trên, rồi:
INTEGRATION_DB_NAME=marineport_g15 npm test --prefix backend
```

Đo độ đúng của AI trên bộ mẫu (gọi AI thật, tốn token, gửi ảnh mẫu tới nhà cung cấp đang cấu hình):

```bash
cd backend
DB_NAME=marineport_g15 node scripts/eval_reader.js --truth ../docs/samples/ban_doc_chuan.json --out /tmp/eval.json
```

Bộ mẫu `docs/samples/` chứa giấy tờ thật nên nằm ngoài git (`.gitignore`).

## Thiết kế và UI

- Wireframe đã chốt: `docs/design/wireframes/nhom-d.html` (mở bằng một máy chủ tĩnh ở thư mục gốc dự án).
- UI Kit: `docs/design/ui-kit/mcah-ui.html`, nhóm "AI đọc giấy tờ" (D1 đến D4).
- Component dùng chung: `frontend/src/components/ds/`, xem tại `/design-system` khi chạy frontend.
- Công cụ đo giao diện `probe.mjs` mở route cần đăng nhập bằng `?devToken=<JWT>` (chỉ ở chế độ dev).
