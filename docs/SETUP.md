# Setup Guide

## Yêu cầu

- Node.js 20+
- npm
- MySQL 8+ hoặc compatible MySQL/MariaDB

## 1. Cài dependencies

Từ thư mục root:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## 2. Chuẩn bị database

Tạo database, mặc định tên đang dùng trong config là:

```sql
CREATE DATABASE marineport CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sau đó import schema hiện tại từ `migration.sql`.

Nếu có migration rời được yêu cầu bởi task/deploy, chạy thêm theo đúng task note.

## 3. Cấu hình backend env

Copy `backend/.env.example` thành `backend/.env`, rồi chỉnh các biến tối thiểu:

```env
PORT=3000
HOST=0.0.0.0

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=marineport

JWT_SECRET=<chuoi-random-it-nhat-32-ky-tu>
JWT_EXPIRES_IN=7d

CORS_ORIGINS=http://localhost:5173
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

Lưu ý:

- Backend sẽ **không khởi động** nếu `JWT_SECRET` trống hoặc dùng giá trị mặc định yếu.
- `CORS_ORIGINS` hỗ trợ nhiều domain, phân tách bằng dấu phẩy.
- `VITE_API_URL` mặc định phía frontend sẽ gọi `http://localhost:3000/api/v1`.

## 4. Cấu hình frontend env

Frontend hiện không bắt buộc phải có file `.env`, nhưng nếu muốn đổi API URL thì tạo:

`frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api/v1
```

## 5. Chạy local

### Terminal 1: backend

```bash
cd backend
npm run dev
```

Backend chạy mặc định ở:

- API: `http://localhost:3000/api/v1`
- Health check: `http://localhost:3000/health`

### Terminal 2: frontend

```bash
cd frontend
npm run dev
```

Frontend chạy mặc định ở:

- `http://localhost:5173`

## 6. Đăng nhập và auth

Luồng auth chính:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

Frontend lưu:

- `token` trong `localStorage`
- `user` trong `localStorage`

Nếu API trả `401`, frontend tự xóa token và điều hướng về `/login`.

## 7. Upload và static files

Backend expose:

- `/public/*` cho static nội bộ,
- `/uploads/*` cho file upload thực tế.

Khi setup local, bảo đảm thư mục upload tồn tại hoặc cho phép backend tạo file trong thư mục đã cấu hình.

## 8. Kiểm tra nhanh sau khi setup

### Backend

```bash
curl http://localhost:3000/health
```

Kỳ vọng:

```json
{"status":"ok"}
```

### Frontend

- mở `/login`,
- thử gọi API login bằng tài khoản có sẵn trong DB local,
- sau login phải vào được `/dashboard`.

## 9. Lệnh dùng hằng ngày

```bash
# root
npm run lint
npm run test

# backend
cd backend && npm run dev
cd backend && npm run lint
cd backend && npm test

# frontend
cd frontend && npm run dev
cd frontend && npm run lint
cd frontend && npm test
```

## 10. Những chỗ dễ vấp khi người mới setup

- Quên set `JWT_SECRET`, backend sẽ fail ngay lúc boot.
- DB chưa import `migration.sql`, login và lookup sẽ lỗi dây chuyền.
- `VITE_API_URL` sai base path, frontend sẽ gọi thiếu `/api/v1`.
- CORS thiếu `http://localhost:5173`, login sẽ fail từ browser.
- Dùng dữ liệu cũ còn bám domain training/enrollment, dễ hiểu nhầm đây là luồng chính hiện tại.
