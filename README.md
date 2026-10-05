# Marineport

Hệ thống quản lý thuyền viên và vận hành tuyển dụng/đào tạo cho doanh nghiệp hàng hải.

## Tech stack

- Backend: Fastify 5 + MySQL (`mysql2`)
- Frontend: React 19 + Vite 8 + Ant Design 6
- Auth: JWT (`@fastify/jwt`) với phân quyền theo vai trò
- Testing: Vitest cho cả backend và frontend

## Cấu trúc chính

- `backend/`: API server, nghiệp vụ, truy cập dữ liệu, jobs
- `frontend/`: ứng dụng web cho chủ doanh nghiệp, chuyên viên, kế toán và các màn public
- `migration.sql`: schema dữ liệu hiện tại
- `tasks/`: backlog và tài liệu yêu cầu theo task

## Tài liệu nên đọc trước

- `CLAUDE.md`: conventions, cấu trúc code, checklist review
- `docs/DOMAIN_OVERVIEW.md`: thực thể chính và luồng nghiệp vụ
- `docs/SETUP.md`: setup local, env vars, thứ tự chạy
- `docs/ARCHITECTURE.md`: module map backend/frontend
- `docs/API_OVERVIEW.md`: endpoint và flow API chính

## Chạy dự án local

```bash
# Cài dependencies root + workspace con
npm install

# Chạy backend
cd backend && npm install && npm run dev

# Chạy frontend (tab khác)
cd frontend && npm install && npm run dev
```

## Kiểm tra chất lượng

```bash
# lint toàn bộ
npm run lint

# test toàn bộ
npm run test
```

Chi tiết conventions và quy ước dev xem trong `CLAUDE.md`.
