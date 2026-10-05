# Handoff Checklist

Checklist bàn giao nhanh cho người nhận dự án Crew Manning.

## 1) Trạng thái bàn giao

- [ ] Đã gửi link branch/commit hiện tại
- [ ] Đã nêu rõ phạm vi đã làm và phần chưa làm
- [ ] Đã ghi các quyết định kỹ thuật quan trọng (nếu có)
- [ ] Đã cập nhật docs liên quan (README, tasks, docs/*)

## 2) Môi trường local

- [ ] Người nhận đã cài Node.js + npm + MySQL
- [ ] Đã copy `backend/.env.example` -> `backend/.env`
- [ ] `JWT_SECRET` đã được set hợp lệ (không để trống)
- [ ] DB đã tạo và import `migration.sql`
- [ ] (Nếu cần) frontend `.env` có `VITE_API_URL`

## 3) Chạy ứng dụng

- [ ] Backend chạy được: `cd backend && npm run dev`
- [ ] Frontend chạy được: `cd frontend && npm run dev`
- [ ] Health check pass: `GET /health` trả `{ "status": "ok" }`
- [ ] Login vào UI thành công

## 4) Kiểm tra chất lượng cơ bản

- [ ] `npm run lint` (root) pass
- [ ] `npm run test` (root) pass hoặc đã note rõ test nào fail sẵn
- [ ] Không còn thay đổi tạm / debug code trong working tree

## 5) Domain người nhận cần nắm trước

- [ ] Đã đọc `docs/DOMAIN_OVERVIEW.md`
- [ ] Đã đọc `docs/ARCHITECTURE.md`
- [ ] Đã đọc `docs/API_OVERVIEW.md`
- [ ] Đã đọc `docs/SETUP.md`

## 6) Backlog và ưu tiên

- [ ] Đã đọc `tasks/README.md`
- [ ] Đã xác nhận task ưu tiên tiếp theo
- [ ] Đã xác nhận task nào đang blocked/phụ thuộc

## 7) Cảnh báo dễ nhầm trong dự án

- [ ] Domain cũ `ship_owner` đã chuyển sang `partner` (có alias cũ)
- [ ] Dấu vết `training/enrollment` còn trong code/db cũ, không phải luồng chính hiện tại
- [ ] Có module legacy tồn tại file route nhưng không phải phần trung tâm sản phẩm

## 8) Thông tin bắt buộc khi bàn giao người-người

- [ ] Ai là owner kỹ thuật hiện tại
- [ ] Ai xác nhận nghiệp vụ (business owner)
- [ ] Kênh liên hệ khi block (chat/group/email)
- [ ] SLA phản hồi khi có blocker

## 9) Kết thúc bàn giao

- [ ] Người nhận đã chạy được local
- [ ] Người nhận đã tự làm thử 1 thay đổi nhỏ và verify pass
- [ ] Người nhận xác nhận "đã nhận bàn giao"
