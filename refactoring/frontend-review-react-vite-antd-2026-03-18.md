# Frontend Review (React + Vite + Ant Design + React Query + Zustand) - 2026-03-18

Phạm vi: `frontend/` (React Router v7, Axios client, React Query, Zustand auth store, các page Admin + Seafarer portal + QR enroll).

## Tổng quan

### Điểm làm tốt
- Routing tách layout rõ: Admin layout vs Seafarer layout, có role guard (`ProtectedRoute`).
- API layer tập trung ở `src/api/*` dùng Axios interceptor để gắn token và xử lý lỗi.
- React Query đã được dùng cho đa số list/detail; query keys đặt tương đối hợp lý.
- UI layout theo design system thống nhất (màu #003366, sidebar #001529, breakpoint 768px).

## Findings theo mức độ ưu tiên

### 🔴 CRITICAL
1) **Bug shape của `/auth/me` → `refreshUser()` lưu sai user**
   - `backend` trả `GET /auth/me` dạng `{ user: request.user }`.
   - `frontend/src/stores/authStore.js` đang làm:
     - `const user = res.data` rồi `localStorage.setItem('user', JSON.stringify(user))`
   - Hậu quả:
     - `user` trong store có thể trở thành `{ user: {...} }`, làm `ProtectedRoute`/role check sai hoặc UI hiển thị sai.
   - Khuyến nghị: set `const user = res.data.user` (và cân nhắc refresh lại token/claims nếu cần).

2) **Thông báo: unread count không bao giờ fetch**
   - `frontend/src/components/common/NotificationBell.jsx` query unread count đang `enabled: false`, có `refetchInterval` nhưng không chạy.
   - Có biến/logic chưa dùng: `useEffect`, `refetchCount`.
   - Hậu quả: badge count luôn 0 dù có thông báo mới.
   - Khuyến nghị:
     - Bật `enabled: true` (hoặc chủ động `refetchCount()` khi dropdown mở/interval).
     - Dọn unused state/effect để tránh nhầm.

### 🟠 HIGH
3) **Token lưu trong `localStorage` (XSS risk)**
   - `src/api/client.js` + `src/stores/authStore.js` dùng `localStorage`.
   - Đây là trade-off phổ biến nhưng nếu có XSS thì token bị đọc được.
   - Khuyến nghị (tùy khả năng backend):
     - Ưu tiên HttpOnly cookie + CSRF protection.
     - Nếu giữ localStorage: audit XSS kỹ, hạn chế render HTML, sanitize mọi content động.

4) **401 handler chỉ xóa `token` nhưng không xóa `user`**
   - `frontend/src/api/client.js`: khi 401 (không phải login) chỉ `removeItem('token')`.
   - Hậu quả: state `user` có thể còn “cũ” cho tới khi reload/route guard chạy lại.
   - Khuyến nghị: xóa cả `user` hoặc gọi `logout()` của store (tránh state lệch).

### 🟡 MEDIUM
5) **Search/filter gọi API quá dày (không debounce)**
   - Ví dụ `SeafarerListPage`: `filters.search` update mỗi keystroke → `useQuery` refetch liên tục.
   - Khuyến nghị: debounce 300–500ms cho search (hoặc bấm “Tìm”).

6) **Master data load cố định 500 records**
   - `frontend/src/pages/admin/MasterSubPage.jsx`: `GET /admin/master/${resource}?limit=500`.
   - Hậu quả: payload lớn, chậm trên mạng yếu; UI không phản ánh paging.
   - Khuyến nghị:
     - Có paging thật (page/limit) và UI pagination.
     - Hoặc cache + chỉ load theo nhu cầu (search server-side).

7) **Polling messaging khá dày**
   - `MessagingPage`: threads 15s, messages 8s.
   - Khuyến nghị: tạm dừng khi tab không active (Page Visibility API) hoặc khi không chọn thread; cân nhắc websocket sau.

8) **QueryKey chứa object filters**
   - Một số queryKey dạng `['seafarers', filters]`, `['users', filters]`.
   - React Query hash được object, nhưng vẫn nên đảm bảo filters ổn định và chỉ chứa primitives.
   - Khuyến nghị: chuẩn hóa filters, tránh nhét function/Date vào filters; cân nhắc serialize key.

## Gợi ý thứ tự xử lý
1) Fix `refreshUser()` (Critical)
2) Fix `NotificationBell` unread count (Critical)
3) Đồng bộ logout/401 clear user + token (High)
4) Debounce search + tối ưu MasterData load + tối ưu polling messaging (Medium)

