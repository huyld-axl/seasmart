# TASK-00b: Nâng cấp Import Thuyền viên từ HD-Hong.xlsx

## Why
Import hiện tại bỏ sót nhiều cột trong file HD-Hong.xlsx (sheet `data`).
Chiến lược: **lưu raw data trước, resolve FK sau** — không cần bảng lookup phải có data trước,
import được ngay 60.000 thuyền viên, sau này chạy script resolve để map sang FK.

## Trạng thái: DONE ✅

Hoàn thành 2026-03-14:
- Chạy migration 003 — thêm 20 cột vào bảng seafarer (68 cột tổng)
- Thêm cột `rank_name_vi` — lưu tên chức danh tiếng Việt từ cột 44
- Cập nhật import.service.js — map đủ 44 cột HD-Hong.xlsx (không bỏ sót cột nào)
- CHỨC DANH (cột 4, code) → current_rank_id (lookup rank table)
- CHỨC DANH (cột 44, tên VN) → rank_name_vi
- Index cứng FIXED_IDX cho cột trùng tên và date contract
- Test import thành công: rank/vessel/contract/marital/rank_name_vi đều đúng

## Files cần sửa
- `backend/src/services/import.service.js`
- `migration.sql` — thêm các cột mới vào bảng `seafarer`

---

## Chiến lược: Raw columns + Resolve later

Các cột phụ thuộc lookup (rank, vessel, contract) → lưu text thô vào cột `_raw`.
Sau khi có data trong bảng lookup → chạy UPDATE để populate FK.

```
Import lần 1:  CHỨC DANH "3E"  → seafarer.rank_raw = "3E"
Resolve sau:   UPDATE seafarer SET current_rank_id = (SELECT id FROM rank WHERE code = rank_raw)
```

---

## Cột cần thêm vào bảng `seafarer`

### Nhóm A — Cột cá nhân (lưu thẳng, không cần lookup)

| Cột Excel | Cột DB mới | Kiểu |
|-----------|-----------|------|
| `ngày cấp` (cột 12, hộ chiếu) | `passport_issued_date` | DATE NULL |
| `Ngày cấp` (cột 15, CMTND) | `national_id_issued_date` | DATE NULL |
| `Nơi cấp` (cột 16, CMTND) | `national_id_issued_place` | VARCHAR(150) NULL |
| `THAM GIA BH (Y/N)` | `social_insurance_joined` | TINYINT(1) NULL |
| `CHỦ TK` | `bank_account_holder` | VARCHAR(150) NULL |
| `TÌNH TRẠNG` | `marital_status` | VARCHAR(30) NULL |
| `SỐ CON` | `children_count` | TINYINT NULL |
| `THÔNG TIN CON` | `children_info` | TEXT NULL |
| `TUỔI CON` | `children_ages` | VARCHAR(100) NULL |
| `Size áo` | `shirt_size` | VARCHAR(10) NULL |
| `Size quần` | `pants_size` | VARCHAR(10) NULL |

### Nhóm B — Raw columns (lưu text thô, resolve FK sau)

| Cột Excel | Cột DB raw | Kiểu | Resolve về |
|-----------|-----------|------|-----------|
| `CHỨC DANH` (cột 4) | `rank_raw` | VARCHAR(20) NULL | `current_rank_id` |
| `KHỐI` (cột 5) | `vessel_group` | VARCHAR(20) NULL | Chưa có bảng |
| `TÊN TÀU` (cột 6) | `vessel_name_raw` | VARCHAR(150) NULL | `employment_contract.vessel_id` |
| `NGÀY BAY` (cột 7) | `contract_flight_date` | DATE NULL | `employment_contract` |
| `NGÀY NHẬP TÀU` (cột 8) | `contract_start_date` | DATE NULL | `employment_contract.start_date` |
| `THỜI GIAN HĐ` (cột 9) | `contract_duration_raw` | VARCHAR(30) NULL | `employment_contract` |
| `Lương hợp đồng` (cột 13) | `contract_salary_raw` | DECIMAL(10,2) NULL | `contract_payroll` |
| `NGÀY RỜI TÀU` (cột 42) | `contract_end_date` | DATE NULL | `employment_contract.end_date` |
| `NGÀY VỀ TỚI VN` (cột 43) | `contract_return_date` | DATE NULL | `employment_contract` |

---

## How — Các bước thực hiện

### Bước 1: Tạo migration file

**File**: `backend/migrations/003_seafarer_extra_cols.sql`

```sql
ALTER TABLE seafarer
  -- Nhóm A: cột cá nhân
  ADD COLUMN passport_issued_date     DATE           NULL AFTER passport_number,
  ADD COLUMN national_id_issued_date  DATE           NULL AFTER national_id,
  ADD COLUMN national_id_issued_place VARCHAR(150)   NULL AFTER national_id_issued_date,
  ADD COLUMN social_insurance_joined  TINYINT(1)     NULL AFTER social_insurance_number,
  ADD COLUMN bank_account_holder      VARCHAR(150)   NULL AFTER bank_account_number,
  ADD COLUMN marital_status           VARCHAR(30)    NULL AFTER gender,
  ADD COLUMN children_count           TINYINT        NULL AFTER marital_status,
  ADD COLUMN children_info            TEXT           NULL AFTER children_count,
  ADD COLUMN children_ages            VARCHAR(100)   NULL AFTER children_info,
  ADD COLUMN shirt_size               VARCHAR(10)    NULL AFTER weight_kg,
  ADD COLUMN pants_size               VARCHAR(10)    NULL AFTER shirt_size,
  -- Nhóm B: raw columns
  ADD COLUMN rank_raw                 VARCHAR(20)    NULL COMMENT 'Raw từ Excel, resolve → current_rank_id',
  ADD COLUMN vessel_group             VARCHAR(20)    NULL COMMENT 'KHỐI: SEC, FEI, ASL...',
  ADD COLUMN vessel_name_raw          VARCHAR(150)   NULL COMMENT 'Tên tàu raw, resolve → employment_contract',
  ADD COLUMN contract_flight_date     DATE           NULL COMMENT 'Ngày bay',
  ADD COLUMN contract_start_date      DATE           NULL COMMENT 'Ngày nhập tàu',
  ADD COLUMN contract_duration_raw    VARCHAR(30)    NULL COMMENT 'Thời gian HĐ, vd "10±2"',
  ADD COLUMN contract_salary_raw      DECIMAL(10,2)  NULL COMMENT 'Lương HĐ USD',
  ADD COLUMN contract_end_date        DATE           NULL COMMENT 'Ngày rời tàu',
  ADD COLUMN contract_return_date     DATE           NULL COMMENT 'Ngày về tới VN';
```

Cũng cập nhật `migration.sql` để đồng bộ.

### Bước 2: Cập nhật `COL_MAP` trong `import.service.js`

```js
const COL_MAP = {
  // --- Cột hiện có ---
  'MÃ TV':                          'seafarer_code',
  'HỌ VÀ TÊN':                      'full_name',
  'NGÀY SINH':                       'date_of_birth',
  'HỘ CHIẾU':                        'passport_number',
  'Số CMTND':                        'national_id',
  'SỐ ĐIỆN THOẠI ':                  'phone_primary',
  'SỐ SỔ BHXH':                      'social_insurance_number',
  'SỐ TÀI KHOẢN':                    'bank_account_number',
  'NGÂN HÀNG':                       'bank_name',
  'QUÊ QUÁN-Xã':                     'permanent_ward',
  'QUÊ QUÁN-huyện':                  'permanent_district',
  'QUÊ QUÁN-tỉnh':                   'permanent_province',
  'NƠI THƯỜNG TRÚ':                  'permanent_address',
  'Chiều cao':                       'height_cm',
  'Cân nặng':                        'weight_kg',
  // --- Nhóm A mới ---
  'Nơi cấp':                         'national_id_issued_place',
  'THAM GIA BH (Y/N)':               'social_insurance_joined',
  'CHỦ TK':                          'bank_account_holder',
  'TÌNH TRẠNG':                      'marital_status',
  'SỐ CON':                          'children_count',
  'THÔNG TIN CON':                   'children_info',
  'TUỔI CON':                        'children_ages',
  'Size áo':                         'shirt_size',
  'Size quần':                       'pants_size',
  // --- Nhóm B raw ---
  'CHỨC DANH':                       'rank_raw',       // cột 4 (code: 3E, 2E...)
  'KHỐI ':                           'vessel_group',
  'TÊN TÀU':                         'vessel_name_raw',
  'THỜI GIAN \r\nHD)':               'contract_duration_raw',
  'Lương hợp đồng':                  'contract_salary_raw',
}
```

### Bước 3: Xử lý cột trùng tên và cột date bằng index cứng

File có 2 cột tên `Ngày cấp` và header có `\r\n` — dùng index để chắc chắn:

```js
// Sau khi parse headers, xác định index theo vị trí cố định
const IDX = {
  PASSPORT_ISSUED_DATE:    11, // cột 12 (0-indexed)
  NATIONAL_ID_ISSUED_DATE: 14, // cột 15
  CONTRACT_FLIGHT_DATE:     6, // cột 7
  CONTRACT_START_DATE:      7, // cột 8
  CONTRACT_END_DATE:       41, // cột 42
  CONTRACT_RETURN_DATE:    42, // cột 43
}

// Trong vòng lặp row:
seafarerData.passport_issued_date    = parseDate(row[IDX.PASSPORT_ISSUED_DATE])
seafarerData.national_id_issued_date = parseDate(row[IDX.NATIONAL_ID_ISSUED_DATE])
seafarerData.contract_flight_date    = parseDate(row[IDX.CONTRACT_FLIGHT_DATE])
seafarerData.contract_start_date     = parseDate(row[IDX.CONTRACT_START_DATE])
seafarerData.contract_end_date       = parseDate(row[IDX.CONTRACT_END_DATE])
seafarerData.contract_return_date    = parseDate(row[IDX.CONTRACT_RETURN_DATE])
```

### Bước 4: Xử lý THAM GIA BH

```js
const bhRaw = get('THAM GIA BH (Y/N)')
seafarerData.social_insurance_joined = bhRaw
  ? (['Y', 'CÓ', 'CO', '1', 'YES'].includes(String(bhRaw).trim().toUpperCase()) ? 1 : 0)
  : null
```

### Bước 5: Script resolve (chạy sau khi có data lookup)

**File**: `backend/migrations/004_resolve_rank.sql`

```sql
-- Chạy sau khi bảng rank đã có data seed
UPDATE seafarer s
JOIN rank r ON UPPER(r.code) = UPPER(s.rank_raw)
SET s.current_rank_id = r.id
WHERE s.rank_raw IS NOT NULL AND s.current_rank_id IS NULL;

-- Kiểm tra còn bao nhiêu chưa resolve
SELECT rank_raw, COUNT(*) as cnt
FROM seafarer
WHERE rank_raw IS NOT NULL AND current_rank_id IS NULL
GROUP BY rank_raw
ORDER BY cnt DESC;
```

**File**: `backend/migrations/005_resolve_contracts.sql` (làm sau)

```sql
-- Tạo employment_contract từ raw data khi đã có bảng vessel
-- TODO: implement sau khi có vessel data
```

---

## Điểm quan trọng
- `CHỨC DANH` cột 4 là code (3E), cột 44 là tên VN (Máy ba) — chỉ import cột 4
- `KHỐI ` có dấu cách ở cuối trong header — cần `norm()` khi match
- `contract_salary_raw` có thể là số nguyên (3100 = $3100 USD) — parse thành DECIMAL
- Sau khi resolve rank xong, cột `rank_raw` vẫn giữ lại (không xóa) để debug
- Import vẫn backward compatible — các cột mới đều NULL nếu file không có

## Acceptance Criteria
- [ ] Migration 003 chạy thành công, không mất data cũ
- [ ] Import HD-Hong.xlsx: tất cả 44 cột được lưu (không bỏ sót)
- [ ] `rank_raw` lưu đúng code chức danh (3E, 2E, CO...)
- [ ] Các cột date (ngày cấp, ngày nhập tàu...) parse đúng từ Excel serial
- [ ] `social_insurance_joined` = 1 khi Y, 0 khi Không
- [ ] Script resolve 004 update đúng `current_rank_id` từ `rank_raw`
- [ ] Import file cũ (chỉ có cột cơ bản) vẫn chạy được
