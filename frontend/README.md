# Frontend - Marineport

Ứng dụng React cho các vai trò vận hành trong hệ thống Marineport.

## Tech stack

- React 19
- Vite 8
- Ant Design 6
- React Query 5
- Zustand 5
- React Router 7
- Vitest + Testing Library

## Cấu trúc thư mục

- `src/api`: lớp gọi API theo module
- `src/components`: component tái sử dụng
- `src/layouts`: layout theo khu vực màn hình
- `src/pages`: màn hình theo route
- `src/stores`: Zustand stores
- `src/hooks`, `src/utils`, `src/contexts`: shared logic

## Scripts

```bash
npm run dev        # chạy local dev server
npm run build      # build production
npm run preview    # preview bản build
npm run lint       # lint source
npm run test       # chạy test 1 lần
npm run test:watch # chạy test watch mode
```

## Môi trường

- Frontend đọc URL backend từ biến môi trường Vite (prefix `VITE_`).
- Đảm bảo backend đang chạy trước khi test luồng chức năng có gọi API.
