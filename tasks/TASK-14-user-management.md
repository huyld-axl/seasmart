# TASK-14: Module Quản Lý User

**Status:** DONE ✅
**Priority:** High
**Access:** Admin only

---

## Mô tả

Xây dựng module quản lý user tập trung cho admin: CRUD user, đổi role, kích hoạt/khóa tài khoản. Hiển thị tốt trên cả desktop và mobile.

---

## Backend

### Files tạo mới

**`backend/src/constants/roles.js`**
```js
const ROLES = ['admin', 'operator', 'training_center', 'manning_agent', 'seafarer']
module.exports = { ROLES }
```

**`backend/src/schemas/userSchemas.js`** — Fastify JSON Schema:
- `createUserSchema`: required `email`, `password`, `role` (enum ROLES)
- `updateUserSchema`: tất cả optional, cùng enum
- `listUsersQuerySchema`: `page`, `limit` (default 1/20), `search`, `role`, `verification_status`, `is_active`

**`backend/src/services/userService.js`** — raw SQL qua `pool.query()`:
- `listUsers(db, filters, pagination)` → `{ rows, total }`
- `getUserById(db, id)` → user hoặc null
- `createUser(db, data)` — bcrypt cost 12, check email unique
- `updateUser(db, id, data)` — dynamic SET chỉ field có trong body
- `softDeleteUser(db, id)` — set `deleted_at = NOW()`
- `toggleActive(db, id)` — flip `is_active`

**`backend/src/routes/v1/users.js`** — tất cả guard `request.user.role !== 'admin'` → 403:

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/v1/users` | Danh sách, filter, phân trang |
| GET | `/api/v1/users/:id` | Chi tiết 1 user |
| POST | `/api/v1/users` | Tạo user mới |
| PATCH | `/api/v1/users/:id` | Sửa email/role/is_active |
| DELETE | `/api/v1/users/:id` | Soft delete (chặn tự xóa mình) |
| PATCH | `/api/v1/users/:id/toggle-active` | Flip is_active |

**Response envelope danh sách:**
```json
{ "data": [], "total": 0, "page": 1, "limit": 20 }
```

**Lỗi trả về có cấu trúc:**
```js
reply.code(400).send({ message: 'Email đã tồn tại' })
reply.code(403).send({ message: 'Không thể xóa tài khoản đang đăng nhập' })
reply.code(404).send({ message: 'Không tìm thấy user' })
```

### Files sửa

- **`backend/src/routes/v1/index.js`** — thêm:
  ```js
  const usersRoute = require('./users')
  fastify.register(usersRoute, { prefix: '/users' })
  ```

---

## Frontend

### Files tạo mới

**`frontend/src/api/usersApi.js`** — axios wrappers cho 6 endpoints

**`frontend/src/hooks/useUsers.js`** — React Query hooks:
```js
useUsers(filters)     // useQuery(['users', filters])
useUser(id)           // useQuery(['users', id])
useCreateUser()       // useMutation + invalidate ['users']
useUpdateUser()       // useMutation + invalidate ['users']
useDeleteUser()       // useMutation + invalidate ['users']
useToggleActive()     // useMutation + invalidate ['users']
```

**`frontend/src/components/admin/users/RoleBadge.jsx`** — Ant Design Tag màu theo role

**`frontend/src/components/admin/users/UserFilters.jsx`**:
- Desktop: inline (Select role, Select status, Select is_active, Input search email, nút Reset)
- Mobile (< 768px): nút "Bộ lọc" mở Drawer

**`frontend/src/components/admin/users/UserTable.jsx`**:
- Desktop: Ant Design `Table` với columns: email, role, verification_status, is_active, actions
- Mobile (< 768px): Ant Design `List` thay thế

**`frontend/src/components/admin/users/UserForm.jsx`** — Ant Design Form trong Drawer:
- Desktop: `width={480}`
- Mobile: `width="100%"`
- Fields: email, password (chỉ khi tạo mới), role (Select), is_active (Switch)
- Validation inline: email required + format, password required khi tạo, role required

**`frontend/src/pages/admin/users/UserListPage.jsx`**:
- Kết hợp UserFilters + UserTable + Drawer (UserForm)
- Nút "Thêm user" mở Drawer tạo mới
- Actions trong table: Xem, Sửa, Kích hoạt/Khóa, Xóa (confirm trước khi xóa)

**`frontend/src/pages/admin/users/UserDetailPage.jsx`**:
- Hiển thị đầy đủ thông tin user
- Nút Sửa mở Drawer, nút Kích hoạt/Khóa, nút Xóa

### Xử lý lỗi trên UI

```js
// Pattern chuẩn cho tất cả mutations
onSuccess: () => message.success('Thao tác thành công'),
onError: (err) => {
  const msg = err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
  message.error(msg)
}
```

Các trường hợp cụ thể:
- Email đã tồn tại → `'Email đã được sử dụng'`
- Tự xóa mình → `'Không thể xóa tài khoản đang đăng nhập'`
- User không tồn tại → `'Không tìm thấy user'`
- Lỗi 500 → `'Lỗi hệ thống, vui lòng thử lại sau'`

### Files sửa

- **`frontend/src/App.jsx`** — thêm routes dưới AdminLayout:
  ```jsx
  <Route path="/admin/users" element={<UserListPage />} />
  <Route path="/admin/users/:id" element={<UserDetailPage />} />
  ```
- **`frontend/src/layouts/AdminLayout.jsx`** — thêm menu item "Quản lý User" với icon UserOutlined

---

## Design System

Tuân theo design system enterprise hiện tại:
- `colorPrimary: #003366`
- Card: `border: '1px solid #D9D9D9'`, `borderRadius: 2`
- Không dùng `boxShadow` trên card

---

## Verification

1. Backend: `node server.js` trong `backend/`
2. Test API (cần JWT admin token):
   - `GET /api/v1/users?page=1&limit=20`
   - `POST /api/v1/users` với body `{ email, password, role }`
   - `PATCH /api/v1/users/:id/toggle-active`
   - `DELETE /api/v1/users/:id` với id của chính mình → expect 403
3. Frontend: `npm run dev` trong `frontend/`
4. Vào `/admin/users`:
   - Kiểm tra bảng hiển thị đúng
   - Test filter theo role/status
   - Tạo user mới qua Drawer
   - Toggle active
   - Xóa user (không phải mình)
5. Resize browser < 768px — kiểm tra List thay Table, filter Drawer
