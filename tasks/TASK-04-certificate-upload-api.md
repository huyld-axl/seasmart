# TASK-04: Certificate Upload API

## Why
Quản lý chứng chỉ của thuyền viên — upload file scan, lưu metadata.
Đây là feature quan trọng: thuyền viên/admin có thể upload file PDF/ảnh chứng chỉ.

## Trạng thái: PENDING

## Files cần tạo
- `backend/src/services/certificate.service.js`
- `backend/src/routes/v1/certificate.routes.js`

## Files cần sửa
- `backend/src/routes/v1/index.js` — đăng ký certificateRoutes
- `backend/server.js` — đảm bảo `@fastify/multipart` đã đăng ký (đã có trong plugins)

## Schema bảng `seafarer_certificate`
```
id, seafarer_id, certificate_type_id, certificate_number, issued_date,
expiry_date, issued_by, issued_at_country_id, status, document_url, notes,
created_at, updated_at
```

## How — Các bước thực hiện

### Bước 1: Setup thư mục upload

```
backend/uploads/certificates/{seafarer_id}/
```

Tạo thư mục khi server start (hoặc lazy-create khi upload).

### Bước 2: `certificate.service.js`

**list(seafarerId)**
```sql
SELECT sc.*, ct.name_vi as cert_type_name, c.name_vi as country_name
FROM seafarer_certificate sc
LEFT JOIN certificate_type ct ON sc.certificate_type_id = ct.id
LEFT JOIN country c ON sc.issued_at_country_id = c.id
WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL
ORDER BY sc.expiry_date ASC
```

**create(seafarerId, data)**
- Validate: certificate_type_id tồn tại, issued_date <= today
- INSERT seafarer_certificate

**update(id, data)**
- UPDATE các field (không cho sửa seafarer_id)

**uploadFile(id, seafarerId, file)**
- Validate: mimetype in ['application/pdf', 'image/jpeg', 'image/png']
- Validate: file.size <= 10MB (10 * 1024 * 1024)
- Tạo thư mục `uploads/certificates/{seafarerId}/` nếu chưa có
- Tên file: `{id}_{timestamp}.{ext}` (tránh trùng)
- Lưu file, UPDATE document_url = `/uploads/certificates/{seafarerId}/{filename}`

**softDelete(id)**
- UPDATE SET deleted_at = NOW()

### Bước 3: `certificate.routes.js`

Route prefix: `/api/v1/seafarers/:seafarerId/certificates`

```
GET    /              → list (auth: admin, operator, hoặc seafarer chính mình)
POST   /              → create (auth: admin, operator, training_center)
PUT    /:id           → update (auth: admin, operator)
DELETE /:id           → softDelete (auth: admin)
POST   /:id/upload    → uploadFile (multipart, auth: admin, operator, seafarer chính mình)
```

### Bước 4: Serve static files

Trong `server.js` hoặc `plugins/index.js`:
```js
fastify.register(import('@fastify/static'), {
  root: path.join(process.cwd(), 'uploads'),
  prefix: '/uploads/'
})
```

### Bước 5: Đăng ký trong `index.js`
```js
import certificateRoutes from './certificate.routes.js'
fastify.register(certificateRoutes, { prefix: '/seafarers/:seafarerId/certificates' })
```

## Các kịch bản

### Phương án A: Lưu file local (CHỌN cho MVP)
- Lưu tại `./uploads/certificates/{seafarerId}/`
- Serve qua `@fastify/static`
- Ưu: đơn giản, không cần external service
- Nhược: không scale, mất file nếu server reset

### Phương án B: Cloudflare R2 (sau này)
- Upload lên R2, lưu URL vào DB
- Ưu: persistent, CDN
- Nhược: cần setup R2, thêm dependency

**Chọn Phương án A** cho MVP, migrate sang R2 sau khi deploy.

## Điểm quan trọng
- Cài thêm `@fastify/static` nếu chưa có: `npm install @fastify/static`
- Seafarer chỉ được xem/upload chứng chỉ của chính mình (kiểm tra `seafarerId === user.linked_entity_id`)
- Tên file phải unique — dùng `{id}_{Date.now()}.{ext}`
- Validate mimetype từ file thực tế, không chỉ dựa vào extension
- `document_url` lưu relative path, không lưu full URL (để dễ migrate)

## Acceptance Criteria
- [ ] GET / trả về list chứng chỉ kèm cert_type_name
- [ ] POST / tạo được chứng chỉ mới (không kèm file)
- [ ] POST /:id/upload: validate type (pdf/jpg/png), size <= 10MB
- [ ] File được lưu đúng thư mục, document_url được update
- [ ] File accessible qua GET /uploads/certificates/{seafarerId}/{filename}
- [ ] Seafarer không xem được chứng chỉ của người khác
