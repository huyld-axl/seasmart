# TASK-01: Training Center API

## Why
Quản lý danh sách trung tâm đào tạo — entity trung tâm của hệ thống đào tạo.
Cần có trước TASK-02 (Training Course) vì course có FK đến training_center.

## Trạng thái: PENDING

## Files cần tạo
- `backend/src/services/training_center.service.js`
- `backend/src/routes/v1/training_center.routes.js`

## Files cần sửa
- `backend/src/routes/v1/index.js` — đăng ký trainingCenterRoutes

## Schema bảng `training_center`
```
id, code, name_vi, name_en, country_id, license_number, license_expiry,
accredited_by, address, phone, email, contact_person, is_active, notes,
created_at, updated_at
```
(Không có `deleted_at` — dùng `is_active` thay soft delete)

## How — Các bước thực hiện

### Bước 1: `training_center.service.js`

**list(filters)**
```
SELECT tc.*, c.name_vi as country_name
FROM training_center tc
LEFT JOIN country c ON tc.country_id = c.id
WHERE is_active = ? (nếu có filter)
  AND (name_vi LIKE ? OR name_en LIKE ? OR code LIKE ?) (nếu có search)
ORDER BY name_vi ASC
LIMIT ? OFFSET ?
```

**getById(id)**
```
SELECT tc.*, c.name_vi as country_name
FROM training_center tc
LEFT JOIN country c ON tc.country_id = c.id
WHERE tc.id = ?
```

**create(data, actorUserId)**
- Validate: `code` unique, `name_vi` required
- INSERT vào `training_center`
- Nếu body có `user_id` → UPDATE user SET linked_entity_type='training_center', linked_entity_id=newId

**update(id, data, actor)**
- Kiểm tra quyền: admin/operator được sửa tất cả; training_center chỉ sửa nếu `actor.linked_entity_id === id`
- UPDATE các field được phép

**softDelete(id)**
- UPDATE training_center SET is_active = 0 WHERE id = ?
- (Không dùng deleted_at vì bảng này dùng is_active)

### Bước 2: `training_center.routes.js`

```
GET    /              → list (auth: tất cả roles)
GET    /:id           → getById (auth: tất cả roles)
POST   /              → create (auth: admin, operator)
PUT    /:id           → update (auth: admin, operator, training_center)
DELETE /:id           → softDelete (auth: admin)
```

### Bước 3: Đăng ký trong `index.js`
```js
import trainingCenterRoutes from './training_center.routes.js'
fastify.register(trainingCenterRoutes, { prefix: '/training-centers' })
```

## Các kịch bản

### Phương án A: Kiểm tra quyền trong service (CHỌN)
- Service nhận `actor` object, tự kiểm tra role
- Ưu: logic tập trung, dễ test
- Nhược: service biết về auth context

### Phương án B: Kiểm tra quyền trong route handler
- Route check role trước khi gọi service
- Ưu: service thuần túy
- Nhược: logic phân tán

**Chọn Phương án A** — nhất quán với pattern đã dùng trong seafarer.service.js

## Điểm quan trọng
- `training_center` dùng `is_active` (không phải `deleted_at`) — khác với seafarer
- User role `training_center` chỉ sửa được record có `linked_entity_id = id`
- Khi tạo mới có `user_id` → phải update bảng `user` trong cùng transaction
- `code` phải unique — check trước khi INSERT

## Acceptance Criteria
- [ ] GET / trả về list với pagination, filter search và is_active
- [ ] GET /:id trả về chi tiết kèm country_name
- [ ] POST / tạo được, validate unique code
- [ ] PUT /:id: admin/operator sửa được tất cả; training_center chỉ sửa của mình
- [ ] DELETE /:id set is_active=0 (không xóa hẳn)
- [ ] Nếu có user_id khi tạo → update user.linked_entity_id
