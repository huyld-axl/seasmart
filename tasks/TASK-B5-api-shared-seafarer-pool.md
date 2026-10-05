# TASK-B5: API — Shared Seafarer Pool cho Training Center

## Why
Hiện tại role `training_center` không thể tìm kiếm thuyền viên để enroll vào khóa học của mình — họ phải nhờ admin.
Cần cho phép training_center xem danh sách thuyền viên với thông tin cơ bản (không thấy dữ liệu nhạy cảm).

## Trạng thái: PENDING

## Files cần sửa
- `D:/code/app hàng hải/backend/src/services/seafarer.service.js` — thêm role-based field filtering
- `D:/code/app hàng hải/backend/src/routes/v1/seafarer.routes.js` — kiểm tra lại quyền GET /

## API Endpoint

```
GET /api/v1/seafarers?available_for_training=true&rank=Captain&search=Nguyen
```

- **Role**: admin, operator — thấy toàn bộ fields
- **Role**: training_center — chỉ thấy fields được phép

## Fields theo role

### training_center được thấy (public pool)
```
id, seafarer_code, full_name, date_of_birth, nationality,
current_rank, english_level, english_score,
certificates (type, number, expiry — không thấy issuing_authority nhạy cảm),
current_status (AVAILABLE/STANDBY/ONBOARD)
```

### training_center KHÔNG được thấy
```
salary, contract details, home_address, phone, email,
passport details, bank account, family info,
employment history chi tiết
```

## How — Các bước thực hiện

### Bước 1: Định nghĩa ALLOWED_FIELDS trong seafarer.service.js

```js
const TRAINING_CENTER_ALLOWED_FIELDS = [
  's.id', 's.seafarer_code', 's.full_name', 's.date_of_birth',
  's.nationality', 's.current_rank', 's.current_status',
  's.english_level', 's.english_score', 's.photo_url'
];

const ADMIN_FIELDS = ['s.*']; // toàn bộ
```

### Bước 2: Thêm filter available_for_training

```js
if (filters.available_for_training === 'true') {
  whereConditions.push("s.current_status IN ('AVAILABLE', 'STANDBY')");
}
```

### Bước 3: Role-based field selection trong hàm list()

```js
async function list(filters, userRole) {
  const fields = userRole === 'training_center'
    ? TRAINING_CENTER_ALLOWED_FIELDS.join(', ')
    : 's.*';

  const sql = `SELECT ${fields} FROM seafarer s WHERE ... `;
  // ...
}
```

### Bước 4: Lọc certificates trả về cho training_center

```js
function filterCertificateFields(certs, userRole) {
  if (userRole !== 'training_center') return certs;
  return certs.map(c => ({
    id: c.id,
    certificate_type: c.certificate_type,
    certificate_number: c.certificate_number,
    issue_date: c.issue_date,
    expiry_date: c.expiry_date,
    status: c.status
    // bỏ: issuing_authority, file_url, notes
  }));
}
```

### Bước 5: Cập nhật route để truyền userRole vào service
```js
fastify.get('/', async (req, reply) => {
  const data = await seafarerService.list(req.query, req.user.role);
  reply.send(data);
});
```

## Acceptance Criteria
- [ ] training_center GET /seafarers → không thấy salary, phone, email, address
- [ ] admin GET /seafarers → thấy toàn bộ fields
- [ ] ?available_for_training=true → chỉ trả về status AVAILABLE hoặc STANDBY
- [ ] ?search=Nguyen → tìm theo full_name, seafarer_code
- [ ] training_center GET /seafarers/:id → chỉ thấy fields được phép
