# TASK-07: Seafarer Portal API

## Why
API riêng cho thuyền viên đã đăng nhập — xem và cập nhật hồ sơ cá nhân, chứng chỉ, lịch sử đào tạo.
Thuyền viên chỉ được xem data của chính mình.

## Trạng thái: PENDING (blocked by TASK-06)

## Files cần tạo
- `backend/src/routes/v1/seafarer_portal.routes.js`

## Files cần sửa
- `backend/src/routes/v1/index.js` — đăng ký seafarerPortalRoutes

## How — Các bước thực hiện

### Bước 1: Middleware kiểm tra role

Tất cả routes trong file này đều cần:
```js
onRequest: [fastify.authenticate]
// Sau authenticate, kiểm tra thêm:
if (request.user.role !== 'seafarer') throw fastify.httpErrors.forbidden()
const seafarerId = request.user.linked_entity_id
if (!seafarerId) throw fastify.httpErrors.forbidden('Chưa xác minh danh tính')
```

### Bước 2: Các endpoints

**GET /profile**
```sql
SELECT s.*, r.name_vi as rank_name, c.name_vi as country_name
FROM seafarer s
LEFT JOIN rank r ON s.rank_id = r.id
LEFT JOIN country c ON s.nationality_id = c.id
WHERE s.id = ? AND s.deleted_at IS NULL
```

**PUT /profile**
- Chỉ cho sửa: address, phone_primary, phone_secondary, email, emergency_contact_*
- Không cho sửa: national_id, seafarer_code, full_name (cần admin)
- Validate email format nếu có

**GET /certificates**
- Reuse logic từ certificate.service.js
- Filter: seafarerId = user.linked_entity_id

**GET /contracts**
```sql
SELECT sc.*, ct.name_vi as contract_type_name, v.name as vessel_name
FROM seafarer_contract sc
LEFT JOIN contract_type ct ON sc.contract_type_id = ct.id
LEFT JOIN vessel v ON sc.vessel_id = v.id
WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL
ORDER BY sc.start_date DESC
```

**GET /enrollments**
```sql
SELECT e.*, tc.name as course_name, ctr.name_vi as center_name
FROM training_enrollment e
JOIN training_course tc ON e.course_id = tc.id
JOIN training_center ctr ON tc.training_center_id = ctr.id
WHERE e.seafarer_id = ?
ORDER BY e.enrollment_date DESC
```

**POST /enrollments**
- Body: `{ course_id }`
- Reuse logic từ enrollment.service.js create()
- Tự động set seafarer_id = user.linked_entity_id

### Bước 3: `seafarer_portal.routes.js`

```
GET    /profile         → xem hồ sơ
PUT    /profile         → sửa thông tin cá nhân (giới hạn fields)
GET    /certificates    → danh sách chứng chỉ
GET    /contracts       → lịch sử hợp đồng
GET    /enrollments     → lịch sử đào tạo
POST   /enrollments     → đăng ký khóa học
```

### Bước 4: Đăng ký trong `index.js`
```js
import seafarerPortalRoutes from './seafarer_portal.routes.js'
fastify.register(seafarerPortalRoutes, { prefix: '/portal/seafarer' })
```

## Các kịch bản

### Phương án A: Route file riêng, reuse service functions (CHỌN)
- Tạo file route mới, gọi lại các service đã có
- Ưu: không duplicate code, rõ ràng
- Nhược: route file phụ thuộc nhiều service

### Phương án B: Thêm vào seafarer.routes.js hiện có
- Thêm middleware check role=seafarer
- Nhược: lẫn lộn admin API và portal API

**Chọn Phương án A** — tách biệt rõ ràng admin API vs portal API.

## Điểm quan trọng
- Mọi query đều filter theo `seafarerId = user.linked_entity_id` — không bao giờ để client truyền seafarerId
- Nếu `linked_entity_id` null (chưa verify) → 403 với message rõ ràng
- PUT /profile: whitelist các field được phép sửa, ignore các field khác
- POST /enrollments: kiểm tra verification_status = 'verified' trước khi cho đăng ký

## Acceptance Criteria
- [ ] Tất cả endpoints yêu cầu role=seafarer
- [ ] GET /profile trả về đúng hồ sơ của user đang đăng nhập
- [ ] PUT /profile chỉ update được các field được phép
- [ ] GET /certificates, /contracts, /enrollments chỉ trả về data của mình
- [ ] POST /enrollments tự lấy seafarerId từ token, không nhận từ body
- [ ] Seafarer chưa verify (linked_entity_id null) → 403
