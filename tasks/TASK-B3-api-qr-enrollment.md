# TASK-B3: API - QR Enrollment

## Why
Trung tâm đào tạo muốn tạo QR code dán ở cửa lớp hoặc gửi qua Zalo/email để thuyền viên quét và đăng ký nhanh mà không cần tài khoản portal.

## Trạng thái: PENDING (blocked by TASK-A1, TASK-A2)

## Files cần tạo
- `D:/code/app hàng hải/backend/src/services/qr_enrollment.service.js`
- `D:/code/app hàng hải/backend/src/routes/v1/qr_enrollment.routes.js`

## Files cần sửa
- `D:/code/app hàng hải/backend/src/routes/v1/index.js` - đăng ký qrEnrollmentRoutes

## API Endpoints

```
POST /api/v1/qr-enrollment/generate        - tạo QR link (admin/operator/accountant)
GET  /api/v1/qr-enrollment/:token          - public, lấy thông tin course từ token
POST /api/v1/qr-enrollment/:token/register - public, thuyền viên điền form đăng ký
GET  /api/v1/qr-enrollment/               - list QR links của course (admin/accountant)
DELETE /api/v1/qr-enrollment/:id/deactivate - vô hiệu hóa QR link
```

### POST /generate
- **Role**: admin, operator, accountant
- **Body**: `{ course_id, label?, max_uses?, expires_at? }`
- **Response**: `{ id, token, qr_url, qr_image_base64 }`
- **Logic**: Tạo token = `crypto.randomBytes(32).toString('hex')`, INSERT vào `qr_enrollment_link`

### GET /:token (public)
- Không cần auth
- Trả về: tên khóa học, trung tâm, ngày bắt đầu/kết thúc, số chỗ còn lại
- Kiểm tra: token tồn tại, `is_active = 1`, chưa hết hạn, chưa hết `max_uses`

### POST /:token/register (public)
- **Body**: `{ full_name, seafarer_code?, phone?, email?, rank? }`
- **Logic**:
  1. Validate token (active, chưa hết hạn, chưa hết max_uses)
  2. Tìm seafarer theo `seafarer_code` hoặc `phone`
  3. Nếu tìm thấy: tạo enrollment PENDING cho seafarer đó
  4. Nếu không tìm thấy: tạo enrollment PENDING với thông tin tạm (cần admin xác nhận)
  5. Tăng `used_count` trong `qr_enrollment_link`
  6. Trả về confirmation message

## How - Các bước thực hiện

### Bước 1: qr_enrollment.service.js

```js
import crypto from 'crypto';

async function generate(courseId, userId, { label, maxUses, expiresAt }) {
  const token = crypto.randomBytes(32).toString('hex');
  const result = await db.query(
    'INSERT INTO qr_enrollment_link (course_id, token, label, max_uses, expires_at, created_by) VALUES (?,?,?,?,?,?)',
    [courseId, token, label, maxUses, expiresAt, userId]
  );
  const qrUrl = `${process.env.FRONTEND_URL}/qr-enroll/${token}`;
  return { id: result.insertId, token, qr_url: qrUrl };
}

async function validateToken(token) {
  const link = await db.queryOne(
    'SELECT * FROM qr_enrollment_link WHERE token=? AND is_active=1',
    [token]
  );
  if (!link) throw new NotFoundError('QR link không hợp lệ');
  if (link.expires_at && new Date(link.expires_at) < new Date()) throw new BadRequestError('QR link đã hết hạn');
  if (link.max_uses && link.used_count >= link.max_uses) throw new BadRequestError('QR link đã đạt giới hạn sử dụng');
  return link;
}
```

### Bước 2: qr_enrollment.routes.js
```js
fastify.post('/generate', { preHandler: [authenticate, authorize(['admin','operator','accountant'])] }, generateHandler);
fastify.get('/:token', registerInfoHandler);           // public
fastify.post('/:token/register', registerHandler);     // public
fastify.delete('/:id/deactivate', { preHandler: [authenticate, authorize(['admin','operator','accountant'])] }, deactivateHandler);
```

### Bước 3: Đăng ký trong index.js
```js
import qrEnrollmentRoutes from './qr_enrollment.routes.js';
fastify.register(qrEnrollmentRoutes, { prefix: '/qr-enrollment' });
```

## Acceptance Criteria
- [ ] POST /generate tạo token unique, lưu DB
- [ ] GET /:token trả về thông tin course, báo lỗi nếu token hết hạn/hết lượt
- [ ] POST /:token/register tạo enrollment PENDING, tăng used_count
- [ ] POST /:token/register với token hết hạn → 400
- [ ] POST /:token/register với token đã hết max_uses → 400
- [ ] DELETE /:id/deactivate set is_active = 0
