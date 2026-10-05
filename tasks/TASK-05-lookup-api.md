# TASK-05: Lookup / Reference Data API

## Why
Frontend cần dropdown data (chức danh, loại chứng chỉ, quốc gia...) cho các form.
Đây là API đơn giản nhất, không cần auth, cần làm trước để unblock các task frontend.

## Trạng thái: DONE ✅

## Files cần tạo
- `backend/src/routes/v1/lookup.routes.js` — route handler (không cần service riêng, query đơn giản)

## Files cần sửa
- `backend/src/routes/v1/index.js` — đăng ký lookupRoutes

## How — Các bước thực hiện

### Bước 1: Tạo `lookup.routes.js`

```js
// Không cần authenticate — public endpoints
// Dùng in-memory cache đơn giản: { data, cachedAt }
// TTL: 5 phút (300_000 ms)
```

Endpoints:
| Method | Path | Bảng DB | Columns trả về |
|--------|------|---------|----------------|
| GET | `/api/v1/lookup/ranks` | `rank` | id, code, name_vi, name_en |
| GET | `/api/v1/lookup/certificate-types` | `certificate_type` | id, code, name_vi, name_en, abbreviation, category, validity_years, is_stcw |
| GET | `/api/v1/lookup/course-types` | `course_type` | id, code, name_vi, name_en |
| GET | `/api/v1/lookup/countries` | `country` | id, code, name_vi, name_en |
| GET | `/api/v1/lookup/vessel-types` | `vessel_type` | id, code, name_vi, name_en |
| GET | `/api/v1/lookup/contract-types` | `contract_type` | id, code, name_vi, name_en |

### Bước 2: Cache pattern

```js
const cache = {}
async function getCached(key, queryFn) {
  const now = Date.now()
  if (cache[key] && now - cache[key].cachedAt < 300_000) {
    return cache[key].data
  }
  const data = await queryFn()
  cache[key] = { data, cachedAt: now }
  return data
}
```

### Bước 3: Đăng ký route trong `index.js`

```js
import lookupRoutes from './lookup.routes.js'
fastify.register(lookupRoutes, { prefix: '/lookup' })
```

## Các kịch bản

### Phương án A: Route file đơn (CHỌN)
- 1 file `lookup.routes.js` xử lý tất cả 6 endpoints
- Cache in-memory trong cùng file
- Ưu: đơn giản, nhanh, không cần service riêng
- Nhược: nếu sau này cần invalidate cache thì phải sửa

### Phương án B: Tách service riêng
- `lookup.service.js` + `lookup.routes.js`
- Ưu: tách biệt rõ ràng
- Nhược: overkill cho 6 query SELECT đơn giản

**Chọn Phương án A** vì đây là read-only reference data, không có business logic.

## Điểm quan trọng
- Không cần `onRequest: [fastify.authenticate]` — public API
- Nếu bảng chưa có data → trả về `[]` (không báo lỗi)
- Cache key = tên endpoint (vd: `'ranks'`, `'countries'`)

## Acceptance Criteria
- [ ] 6 endpoints trả về đúng data từ DB
- [ ] Cache hoạt động: request thứ 2 trong 5 phút không query DB
- [ ] Trả về `[]` nếu bảng rỗng, không crash
- [ ] Đăng ký đúng prefix `/api/v1/lookup`
