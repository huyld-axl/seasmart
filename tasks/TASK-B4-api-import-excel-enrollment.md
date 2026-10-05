# TASK-B4: API - Import Excel Enrollment Hàng Loạt

## Why
Trung tâm đào tạo thường có danh sách học viên sẵn trong Excel. Thay vì nhập từng người, cần cho phép upload file Excel để enroll hàng loạt vào một khóa học.

## Trạng thái: PENDING (blocked by TASK-A1)

## Files cần sửa
- `D:/code/app hàng hải/backend/src/services/import.service.js` - thêm hàm importEnrollments
- `D:/code/app hàng hải/backend/src/routes/v1/enrollment.routes.js` - thêm endpoint import

## API Endpoint

```
POST /api/v1/enrollments/import
Content-Type: multipart/form-data
```

- **Role**: admin, operator, accountant
- **Body**: `course_id` (form field) + `file` (Excel file)
- **Response**:
```json
{
  "total": 20,
  "success": 17,
  "errors": [
    { "row": 3, "seafarer_code": "SF001", "error": "Seafarer không tồn tại" },
    { "row": 8, "seafarer_code": "SF045", "error": "Đã đăng ký khóa học này rồi" },
    { "row": 15, "seafarer_code": "SF099", "error": "Trùng lịch với khóa học ABC" }
  ]
}
```

## Format file Excel mẫu

| seafarer_code | full_name | rank | notes |
|---|---|---|---|
| SF001 | Nguyễn Văn A | Captain | |
| SF002 | Trần Văn B | Chief Officer | Ưu tiên |

- Cột bắt buộc: `seafarer_code` HOẶC `full_name`
- Cột tùy chọn: `rank`, `notes`

## How - Các bước thực hiện

### Bước 1: Thêm hàm importEnrollments vào import.service.js

```js
async function importEnrollments(courseId, fileBuffer, userId) {
  const workbook = XLSX.read(fileBuffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const course = await getCourse(courseId);
  if (!course) throw new NotFoundError('Khóa học không tồn tại');

  const results = { total: rows.length, success: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row number (1-indexed + header)
    try {
      // Tìm seafarer
      const seafarer = await findSeafarer(row.seafarer_code, row.full_name);
      if (!seafarer) throw new Error('Seafarer không tồn tại');

      // Kiểm tra đã enroll chưa
      const existing = await checkExistingEnrollment(courseId, seafarer.id);
      if (existing) throw new Error('Đã đăng ký khóa học này rồi');

      // Kiểm tra max_students
      await checkCapacity(courseId, course.max_students);

      // Tạo enrollment
      await db.query(
        'INSERT INTO training_enrollment (course_id, seafarer_id, status, enrollment_date, notes) VALUES (?,?,?,NOW(),?)',
        [courseId, seafarer.id, 'PENDING', row.notes || null]
      );
      results.success++;
    } catch (err) {
      results.errors.push({ row: rowNum, seafarer_code: row.seafarer_code, error: err.message });
    }
  }
  return results;
}
```

### Bước 2: Thêm route vào enrollment.routes.js
```js
fastify.post('/import', {
  preHandler: [authenticate, authorize(['admin','operator','accountant'])],
  config: { multipart: true }
}, importEnrollmentsHandler);
```

### Bước 3: Download template
```
GET /api/v1/enrollments/import/template - trả về file Excel mẫu
```

## Điểm quan trọng
- Dùng thư viện `xlsx` (đã có trong import.service.js hiện tại)
- Xử lý từng dòng độc lập - lỗi 1 dòng không ảnh hưởng dòng khác
- Trả về kết quả chi tiết từng dòng lỗi để user biết cần sửa gì
- accountant chỉ import vào course của mình

## Acceptance Criteria
- [ ] Upload Excel 20 dòng, 17 hợp lệ → success=17, errors có 3 entries
- [ ] Dòng lỗi có row number và message rõ ràng
- [ ] Không tạo duplicate enrollment
- [ ] accountant không import được vào course của trung tâm khác → 403
- [ ] GET /import/template trả về file Excel mẫu
