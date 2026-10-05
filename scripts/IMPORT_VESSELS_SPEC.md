# SPEC: import_vessels.js

## Mục đích
Script Node.js CLI chạy trên server, đọc các file JSON từ **drop folder**, parse dữ liệu tàu
và upsert vào bảng `vessel` (dự án Crew Manning).

## Vị trí file
```
scripts/import_vessels.js        ← script chính
migrations/020_vessel_extra_cols.sql  ← ALTER TABLE (chạy 1 lần trước)
```

---

## Cấu hình (.env - thêm vào file .env hiện có)
```env
VESSEL_IMPORT_DIR=/data/vessels-import
```
Script đọc biến này làm drop folder mặc định.
Override bằng CLI arg `--dir`.

---

## Yêu cầu môi trường
- Node.js ≥ 16
- Package: `mysql2`, `dotenv` (đã có trong backend)
- DB vars đọc từ `.env`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Script **không** dùng `require('../backend/src/config')` để tránh JWT_SECRET check

---

## Migration (chạy trước khi import lần đầu)

File: `migrations/020_vessel_extra_cols.sql`

```sql
ALTER TABLE `vessel`
  ADD COLUMN IF NOT EXISTS `breadth`         DECIMAL(8,2)  NULL AFTER `length_overall`,
  ADD COLUMN IF NOT EXISTS `depth`           DECIMAL(8,2)  NULL AFTER `breadth`,
  ADD COLUMN IF NOT EXISTS `draft_design`    DECIMAL(8,2)  NULL AFTER `depth`,
  ADD COLUMN IF NOT EXISTS `engine_maker`    VARCHAR(200)  NULL AFTER `engine_type`,
  ADD COLUMN IF NOT EXISTS `engine_model`    VARCHAR(200)  NULL AFTER `engine_maker`,
  ADD COLUMN IF NOT EXISTS `engine_rpm`      SMALLINT      NULL AFTER `engine_model`,
  ADD COLUMN IF NOT EXISTS `photo_url`       VARCHAR(500)  NULL AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `inmarsat_number` VARCHAR(50)   NULL AFTER `photo_url`;
```

---

## Input

- Thư mục chứa các file `.json`, mỗi file = 1 tàu, tên file = IMO number
- Format JSON: đã mô tả trong `D:\app hàng hải\Document\vessels\1000033.json`

---

## Mapping JSON → DB vessel

| JSON path | DB column | Kiểu DB | Xử lý |
|-----------|-----------|---------|-------|
| `name` | `vessel_name` | VARCHAR(150) NOT NULL | toStr(150); fallback `"IMO-{imo_number}"` nếu null |
| `imo_number` | `imo_number` | VARCHAR(10) UNIQUE | **KEY** - skip nếu null |
| `mmsi` | `mmsi` | VARCHAR(10) | toStr(10) |
| `call_sign` | `call_sign` | VARCHAR(10) | toStr(10) |
| `metadata.shipinfo.ex_names` | `vessel_name_prev` | VARCHAR(150) | toStr(150) |
| `vessel_type` | `vessel_type_id` | INT FK | lookup `vessel_type.name_en` LIKE |
| `flag` | `flag_country_id` | INT FK | lookup `country.name_en` LIKE |
| `metadata.shipinfo.home_port` | `port_of_registry_id` | INT FK | lookup `port.name` LIKE |
| `gross_tonnage` | `gross_tonnage` | DECIMAL(10,2) | toFloat |
| `metadata.shipinfo.tonnage.nrt` | `net_tonnage` | DECIMAL(10,2) | toFloat |
| `deadweight` | `deadweight` | DECIMAL(10,2) | toFloat; 0→null |
| `metadata.shipinfo.dimensions.length_overall` *(hoặc `hifleet_list.LENGTH`)* | `length_overall` | DECIMAL(8,2) | toFloat |
| `metadata.shipinfo.dimensions.breadth` *(hoặc `hifleet_list.width`)* | `breadth` | DECIMAL(8,2) | toFloat |
| `metadata.shipinfo.dimensions.depth` | `depth` | DECIMAL(8,2) | toFloat |
| `metadata.shipinfo.dimensions.draft` | `draft_design` | DECIMAL(8,2) | toFloat |
| `year_built` | `year_built` | SMALLINT | parseYear ("21 Apr 1995" → 1995) |
| `classification_society` | `classification_society` | VARCHAR(50) | toStr(50) |
| `owner_name` | `ship_owner_id` | INT FK | lookupOrInsert `ship_owner` |
| `manager_name` | `technical_manager` | VARCHAR(200) | toStr(200) |
| `metadata.hifleet_list.operator` | `commercial_manager` | VARCHAR(200) | toStr(200) |
| `lifecycle_status` | `lifecycle_status` | ENUM | mapLifecycleStatus |
| `class_status` | `class_status` | ENUM | mapClassStatus |
| `engine_power_kw` | `engine_power_kw` | INT | toInt |
| `engine_type` | `engine_type` | VARCHAR(100) | parseEngineType |
| `engine_maker` | `engine_maker` | VARCHAR(200) | toStr(200) |
| `engine_model` | `engine_model` | VARCHAR(200) | toStr(200) |
| `engine_rpm` | `engine_rpm` | SMALLINT | toInt |
| `dp_class` | `dp_class` | ENUM(DPS-1/2/3) | toStr; validate ENUM |
| `has_boiler` | `has_boiler` | TINYINT(1) | toBool |
| `has_refrigeration` | `has_refrigeration` | TINYINT(1) | toBool |
| `passenger_capacity` | `passenger_capacity` | SMALLINT | toInt |
| `crew_capacity` | `crew_capacity` | SMALLINT | toInt; 0→null |
| `metadata.shipinfo.pics[0].url` | `photo_url` | VARCHAR(500) | toStr(500) |
| `inmarsat_number` *(hoặc parse từ `shipinfo.comm`)* | `inmarsat_number` | VARCHAR(50) | toStr(50) |

### Enum mappings

**lifecycle_status:**
| JSON value | DB ENUM |
|-----------|---------|
| "In Service/Commission" | `IN_SERVICE` |
| "Laid Up" | `LAID_UP` |
| "Broken Up" / "Scrapped" | `SCRAPPED` |
| "Under Construction" | `UNDER_CONSTRUCTION` |
| anything else / null | `IN_SERVICE` (default) |

**class_status:**
| Điều kiện | DB ENUM |
|-----------|---------|
| có URL (http...) hoặc có giá trị | `CLASSED` |
| null / empty | `NOT_CLASSED` |
| chứa "suspended" | `SUSPENDED` |
| chứa "withdrawn" | `WITHDRAWN` |

**dp_class:** Giữ nguyên nếu là `DPS-1`, `DPS-2`, `DPS-3`; else null.

---

## Logic upsert

```sql
INSERT INTO vessel (imo_number, vessel_name, mmsi, ...)
VALUES (?, ?, ?, ...)
ON DUPLICATE KEY UPDATE
  vessel_name     = IF(vessel_name     IS NULL OR TRIM(vessel_name) = '',
                        VALUES(vessel_name), vessel_name),
  mmsi            = IF(mmsi            IS NULL, VALUES(mmsi),            mmsi),
  -- (tương tự cho tất cả cột)
  updated_at      = NOW()
```

- Mặc định: **chỉ điền ô trống**, không ghi đè data operator đã nhập
- Flag `--overwrite`: cập nhật tất cả, kể cả ô đã có data

---

## NOT NULL / Required

- `vessel_name` là cột NOT NULL duy nhất. Nếu JSON thiếu `name` → dùng `"IMO-{imo_number}"` làm fallback
- `imo_number` là UNIQUE KEY: skip file nếu null (không có cách identify tàu)
- Tất cả cột khác NULL-able → không required, để null nếu JSON thiếu

---

## Lookup cache (tối ưu tốc độ)

Load 1 lần khi khởi động, lưu vào `Map`:
```
vesselTypeCache : Map<name_en_uppercase → id>
countryCache    : Map<name_en_uppercase → id>   +  Map<name_vi_uppercase → id>
portCache       : Map<name_uppercase → id>
```

`lookupOrInsertOwner` không cache (INSERT on miss):
```sql
SELECT id FROM ship_owner WHERE company_name = ? AND deleted_at IS NULL
-- nếu không có:
INSERT INTO ship_owner (company_name) VALUES (?)
```

---

## CLI Interface

```
Usage: node scripts/import_vessels.js [options]

Options:
  --dir <path>     Drop folder chứa file JSON [default: $VESSEL_IMPORT_DIR]
  --limit <n>      Chỉ xử lý n file đầu (test)
  --dry-run        Parse và validate, không ghi vào DB
  --overwrite      Ghi đè tất cả field, kể cả field đã có data
  --help           Hiển thị help này
```

---

## Output format

```
Crew Manning - Vessel Import
Drop folder : /data/vessels-import
Mode        : upsert (no-overwrite)

[✓] 1000033.json  → inserted  ASTRALIUM
[~] 1000150.json  → updated   OCEAN WARRIOR
[!] 1000200.json  → skipped   (no imo_number)
[✗] 1000999.json  → error     ER_DATA_TOO_LONG: ...

────────────────────────────────────
Processed : 8,854 files
Inserted  : 8,832
Updated   : 12
Skipped   : 5
Errors    : 5
Elapsed   : 2m 14s
```

---

## Quy trình sử dụng trên server

```bash
# 1. Chạy migration 1 lần
mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME < migrations/020_vessel_extra_cols.sql

# 2. Upload JSON vào drop folder
scp D:\vessels\*.json user@server:/data/vessels-import/

# 3. Test 5 file
node scripts/import_vessels.js --limit 5 --dry-run

# 4. Chạy thật
node scripts/import_vessels.js

# 5. Re-import cập nhật (nếu có data mới)
node scripts/import_vessels.js --overwrite
```

---

## Verification SQL

```sql
-- Tổng số tàu đã import
SELECT COUNT(*) as total FROM vessel;

-- Kiểm tra 1 tàu cụ thể
SELECT vessel_name, imo_number, mmsi, call_sign,
       gross_tonnage, year_built, engine_maker, engine_model,
       lifecycle_status, photo_url
FROM vessel WHERE imo_number = '1000033';

-- 10 tàu mới nhất
SELECT vessel_name, imo_number, created_at
FROM vessel ORDER BY created_at DESC LIMIT 10;

-- Thống kê theo loại tàu
SELECT vt.name_en, COUNT(*) as count
FROM vessel v JOIN vessel_type vt ON v.vessel_type_id = vt.id
GROUP BY vt.name_en ORDER BY count DESC;
```
