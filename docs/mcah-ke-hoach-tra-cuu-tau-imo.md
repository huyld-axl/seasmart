# MCAH — Kế hoạch tra cứu tàu theo IMO từ internet

- **Ngày lập:** 2026-10-20
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự ở mục 7.
- **Nguồn đối chiếu:** tính năng đang chạy trên Crew Manning (legacy), nhánh `origin/claude/charming-heisenberg-6ai9y9` của repo `Crew-Manning/`. Mục 1 tóm tắt cách nó chạy; không cần đọc lại code legacy trừ khi một bước yêu cầu.

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` ở gốc repo trước. Mọi quy ước vẫn áp dụng: CommonJS không chấm phẩy, SQL tham số hoá, `pickAllowed`, lỗi dạng `{ statusCode, message }`, form theo mục 3.3, control theo mục 3.4, chữ giao diện tiếng Việt.
2. Làm đúng thứ tự mục 7. Mỗi bước có "Xong khi"; chỉ sang bước sau khi mọi ý đều đúng.
3. Một commit cho một bước, message tiếng Việt thể mệnh lệnh. Không push.
4. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ trả lời.
5. Ghi tiến độ vào mục 9 "Nhật ký" sau mỗi bước.

---

## 1. Crew Manning đang làm thế nào

### 1.1 Luồng

```
Người dùng gõ IMO ──► GET /api/v1/vessels/external/:imo[?refresh=1]
                         │  (chỉ admin, operator)
                         │  chặn 60 giây nếu tàu vừa cập nhật, trừ khi refresh=1
                         ▼
        fetch http://157.180.60.155:8888/api/vessel/:imo[?refresh=1]
                         │  (VESSEL_API_BASE_URL, server trung gian riêng)
                         ▼
        trả { e: "<base64>" }  → giải mã AES-256-GCM
             khoá = sha256(ENC_KEY), gói = iv(12) + tag(16) + ciphertext
        hoặc trả { data: {...} } không mã hoá
                         ▼
        map trường → UPSERT thẳng vào bảng vessel theo imo_number
        (khôi phục cả tàu đã xoá mềm), trả { vessel, external }
```

File legacy: `backend/src/services/vessel_external.service.js`, route trong `backend/src/routes/v1/vessel.routes.js`.

### 1.2 Trường lấy về và cách map

| Trường nguồn | Cột legacy | Ghi chú |
|---|---|---|
| `name` | `vessel_name` | Bắt buộc; thiếu thì lỗi 502 |
| `imo_number` | `imo_number` | Kiểm 7 chữ số (không kiểm số kiểm tra) |
| `vessel_type` / `type` / `ship_type` | `vessel_type` (chữ tự do) | |
| `flag` / `flag_country` / `flag_country_name` / `flag_state` | `flag_country` (chữ tự do) | |
| `mmsi`, `call_sign`, `trade_area` | cùng tên | |
| `gross_tonnage`, `deadweight`, `engine_power_kw`, `passenger_capacity`, `crew_capacity` | cùng tên | Ép số, sai thì null |
| `engine_type` | `engine_type` | |
| `dp_class` (`DPS-1..3`) | `dp_class` | |
| `has_boiler`, `has_refrigeration` | cùng tên | |
| `year_built` | `year_built` | Lấy 4 chữ số đầu tiên |
| `class_society` | `classification_society` | |
| `class_status` (chữ) | `CLASSED / SUSPENDED / WITHDRAWN / NOT_CLASSED` | Dò chuỗi con |
| `lifecycle_status` (chữ) | `IN_SERVICE / UNDER_CONSTRUCTION / SCRAPPED / LAID_UP` | Dò chuỗi con |
| `manager_name` | `technical_manager` | |
| `owner_name`, `class_number`, `class_notation`, `engine_maker`, `source` | ghi JSON vào `notes` | **Ghi đè** ghi chú của người dùng |

### 1.3 Chỗ dùng trên giao diện legacy

1. **Danh sách tàu:** ô "Tìm IMO" + nút "Tìm kiếm trên internet" → đồng bộ rồi lọc danh sách theo IMO đó.
2. **Chi tiết tàu:** nút "Cập nhật từ internet" → ghi đè dữ liệu tàu bằng bản mới.
3. **Tab điều động:** gõ IMO, bấm đồng bộ → điền `vessel_id` vào form điều động.
4. **Master tàu:** tìm theo tên trong `ship_catalog` (bảng nạp từ file SQLite `ships_plain.db` do admin upload, cột IMO, tên, tên cũ, MMSI, loại, cờ). Chọn một dòng → gọi tra cứu IMO; nguồn ngoài lỗi thì tạo tàu tối giản chỉ có tên + IMO.

### 1.4 Điểm yếu không mang sang

- **Ghi thẳng vào DB, không cho xem trước.** Bấm một nút là ghi đè mọi trường người dùng đã sửa tay, kể cả `notes`.
- **Phụ thuộc một server trung gian không rõ chủ**: IP trần, HTTP không mã hoá đường truyền, khoá `ENC_KEY` không có trong repo nào. Ngày 20/10/2026 gọi thử `http://157.180.60.155:8888/` **không phản hồi** (timeout).
- Loại tàu và cờ lưu chữ tự do; MCAH dùng khoá ngoại `vessel_type_id`, `flag_country_id`, `ship_owner_id`.
- Chặn 60 giây dựa trên `updated_at` của tàu: sửa tay một trường cũng bị chặn tra cứu.
- Không kiểm số kiểm tra IMO; MCAH đã có `isValidImo` ở `backend/src/utils/imo.js` và `frontend/src/utils/imo`.
- Bật log chi tiết giải mã khi `NODE_ENV !== 'production'` → dễ lộ thông tin khoá ra client.

---

## 2. Phạm vi

### 2.1 Làm

1. Backend tra cứu IMO qua **lớp nhà cung cấp** (provider), trả **bản đề xuất** đã map sang cột MCAH, **không tự ghi** vào bảng `vessel`.
2. Bộ đệm kết quả tra cứu theo IMO trong DB.
3. Form **Thêm tàu**: nút "Lấy từ internet" cạnh ô IMO, điền sẵn các trường còn trống.
4. **Chi tiết tàu**: thao tác "Cập nhật từ internet" mở panel so sánh từng trường, người dùng chọn trường nào áp dụng.
5. **Danh sách tàu**: tìm bằng một IMO hợp lệ mà không có kết quả → nút "Tra IMO này trên internet" dẫn sang form Thêm tàu đã điền IMO.

### 2.2 Không làm ở đợt này

- Tìm tàu **theo tên** từ catalog ngoài (`ship_catalog` / `ships_plain.db`). Ghi lại để làm đợt sau nếu cần (mục 8).
- Gắn vào panel đối chiếu tàu khi duyệt giấy tờ (B3) và ô chọn tàu trong form chuyến. Làm sau khi luồng chính ổn (mục 8).
- Tự động đồng bộ định kỳ (job).
- Tạo chủ tàu mới từ tên chủ tàu lấy về.

---

## 3. Nguồn dữ liệu — cần chốt trước khi code

Legacy chỉ có một nguồn và nguồn đó đang chết. Lớp provider cho phép thay nguồn mà không sửa phần còn lại.

| Phương án | Ưu | Nhược |
|---|---|---|
| **A. Dùng lại server trung gian của legacy** (`VESSEL_API_BASE_URL` + `ENC_KEY`) | Code giải mã có sẵn, trả đủ trường | Đang không phản hồi; không có khoá; không biết ai vận hành, dữ liệu lấy từ đâu |
| **B. API thương mại có hợp đồng** (ví dụ Datalastic, VesselFinder API, MarineTraffic) | Ổn định, hợp lệ về điều khoản | Tốn phí theo lượt, cần tài khoản; trường kỹ thuật (công suất máy, DP, nồi hơi) thường thiếu |
| **C. AI đọc web** qua lớp `services/ai` sẵn có (tìm trang công khai rồi trích trường) | Không cần nhà cung cấp mới | Chậm, có thể sai; bắt buộc người dùng xác nhận từng trường |

Đề xuất: dựng lớp provider với **A** làm adapter đầu tiên (port code có sẵn) nếu lấy được endpoint và khoá; song song hỏi giá **B** để thay về lâu dài. **C** chỉ cân nhắc nếu A và B đều không được.

**⛔ DỪNG (trước Bước 1):** hỏi người dùng (1) chọn phương án nào, (2) nếu A: ai vận hành server `157.180.60.155:8888`, URL hiện tại, `ENC_KEY`, có HTTPS không; nếu B: nhà cung cấp và API key. Không đoán, không tự tìm khoá.

---

## 4. Dữ liệu

### 4.1 Migration `backend/migrations/postgres/007_vessel_lookup.sql`

```sql
-- Bộ đệm tra cứu tàu theo IMO từ nguồn ngoài. Một dòng cho một IMO và một nguồn.
CREATE TABLE "vessel_lookup" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "imo_number" varchar(10) NOT NULL,
  "provider" varchar(30) NOT NULL,
  "status" varchar(20) NOT NULL CHECK ("status" IN ('FOUND', 'NOT_FOUND', 'ERROR')),
  "raw" JSONB,          -- dữ liệu gốc đã giải mã, để map lại khi đổi luật map
  "error" TEXT,
  "fetched_by" INTEGER,
  "fetched_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX "vessel_lookup_uq_imo_provider" ON "vessel_lookup" ("imo_number", "provider");

-- Lần cuối người dùng áp dụng dữ liệu internet vào tàu
ALTER TABLE "vessel"
  ADD COLUMN "external_source" varchar(30),
  ADD COLUMN "external_synced_at" TIMESTAMP WITHOUT TIME ZONE;
```

- Không ghi JSON vào `vessel.notes`.
- Chỉ lưu `raw`, không lưu bản đã map: luật map đổi thì kết quả cũ vẫn dùng được.

### 4.2 Cấu hình (`backend/src/config/index.js`, `.env.example`)

```js
vesselLookup: {
  provider: process.env.VESSEL_LOOKUP_PROVIDER || '',   // '' = tắt tính năng
  baseUrl: process.env.VESSEL_API_BASE_URL || '',
  encKey: process.env.VESSEL_API_ENC_KEY || '',
  apiKey: process.env.VESSEL_API_KEY || '',
  cacheDays: parseInt(process.env.VESSEL_LOOKUP_CACHE_DAYS) || 30,
  timeoutMs: parseInt(process.env.VESSEL_LOOKUP_TIMEOUT_MS) || 15000,
},
```

Không ghi cứng IP mặc định như legacy. `provider` rỗng thì API trả 503 "Chưa cấu hình tra cứu tàu" và giao diện ẩn các nút.

---

## 5. Backend

### 5.1 Cấu trúc file

```
backend/src/services/vessel_lookup/
├── index.js              # lookup(pool, imo, { refresh, userId }) — chọn provider, đọc/ghi bộ đệm
├── map.js                # raw → đề xuất theo cột MCAH (hàm thuần, test kỹ)
├── legacy_proxy.js       # adapter phương án A: fetch + giải mã AES-256-GCM
└── __tests__/
```

Mỗi adapter xuất `{ name, fetchByImo(imo, { refresh }) }`, trả `{ found: true, raw }` hoặc `{ found: false }`; lỗi mạng hoặc giải mã ném `{ statusCode: 502, message }`. Thêm nguồn mới = thêm một file adapter.

### 5.2 `lookup()`

1. `isValidImo(imo)` sai → 400 "IMO sai số kiểm tra".
2. Có dòng `vessel_lookup` cùng IMO + provider, `status = 'FOUND'`, chưa quá `cacheDays`, và không `refresh` → dùng bộ đệm.
3. Ngược lại gọi adapter có timeout (`AbortSignal.timeout`), ghi/ghi đè dòng bộ đệm (kể cả `NOT_FOUND`, `ERROR`).
4. Gọi `map(raw, refs)` với `refs` là danh mục `vessel_type`, `country`, `ship_owner` đọc từ DB.
5. Tìm tàu đang có cùng IMO (kể cả đã xoá mềm, vì `vessel_imo_number` là unique trên cả bảng).
6. Trả:

```json
{
  "imo_number": "9747613",
  "provider": "legacy_proxy",
  "fetched_at": "2026-10-20T03:00:00Z",
  "from_cache": true,
  "existing_vessel": { "id": 4, "vessel_name": "GEIYO K", "deleted": false },
  "proposal": { "vessel_name": "GEIYO K", "vessel_type_id": 1, "flag_country_id": 12, "gross_tonnage": 31557 },
  "unmatched": { "vessel_type": "Bulk carrier", "ship_owner": "Sealift Maritime S.A." },
  "extra": { "owner_name": "...", "class_number": "...", "class_notation": "...", "engine_maker": "..." }
}
```

- `proposal` chỉ chứa cột thuộc `VESSEL_COLUMNS` và chỉ trường có giá trị.
- `unmatched` là chữ gốc của trường khoá ngoại không khớp danh mục, để giao diện gợi ý chọn tay.
- Không có `raw` trong response; không có chi tiết lỗi giải mã (chỉ log server).

### 5.3 Luật map (`map.js`)

| Đích MCAH | Luật |
|---|---|
| `vessel_type_id` | So khớp không phân biệt hoa thường, bỏ dấu với `vessel_type.name_en`, rồi bảng từ khoá (`bulk` → `BULK`, `container` → `CONTAINER`, `crude/oil/product tanker` → `TANKER-OIL`, `chemical` → `TANKER-CHEM`, `lng/lpg/gas` → `TANKER-GAS`, `general cargo` → `GENERAL-CARGO`, `ro-ro` → `RORO`, `tug` → `TUG`, `offshore/supply` → `OFFSHORE`, `passenger/cruise` → `PASSENGER`, `ferry` → `FERRY`, `fishing` → `FISHING`, `dredg` → `DREDGER`, `barge` → `BARGE`). Không khớp → `unmatched.vessel_type` |
| `flag_country_id` | Khớp `country.code` (ISO2) hoặc `name_en`, có bảng tên gọi khác (`Marshall Is.`, `Hong Kong, China`…). Không khớp → `unmatched.flag` |
| `ship_owner_id` | Khớp đúng `company_name` / `company_name_en` sau khi chuẩn hoá. Không khớp → `unmatched.ship_owner` |
| `status` | `construction` → `UNDER_CONSTRUCTION`, `scrap/broken` → `SCRAPPED`, `laid` → `LAID_UP`, còn lại có dữ liệu → `ACTIVE`, không có → bỏ qua |
| `class_status` | `in class/classed` → `IN_CLASS`, `suspend` → `SUSPENDED`, `withdraw` → `WITHDRAWN`, `not class/unclass` → `UNCLASSED` |
| `dp_class` | `DPS-1/DP1/DP 1` → `DP1` (tương tự 2, 3); `none` → `NONE` |
| `mmsi` | Chỉ nhận đúng 9 chữ số |
| `call_sign` | Cắt còn 10 ký tự |
| `year_built` | 4 chữ số đầu tiên, trong 1900–2100 |
| Số (`gross_tonnage`, `deadweight`, `engine_power_kw`, sức chứa) | Bỏ dấu phân cách nghìn, âm hoặc không phải số → bỏ |
| `has_boiler`, `has_refrigeration` | Chỉ đưa vào khi nguồn trả rõ true/false |
| `technical_manager` | `manager_name` |
| `classification_society` | `class_society`, cắt 50 ký tự |

Giá trị nào không qua được schema `vesselBody` ở `fleet.routes.js` thì bỏ khỏi `proposal` thay vì báo lỗi.

### 5.4 Route — thêm vào `backend/src/routes/v1/fleet.routes.js`

| Method | Đường dẫn | Quyền | Ghi chú |
|---|---|---|---|
| `GET` | `/api/v1/admin/master/vessels/lookup/:imo?refresh=1` | `admin`, `operator` | Trả mục 5.2. Đăng ký **trước** `/:id` (dùng `extra` của `crudRoutes`) |
| `GET` | `/api/v1/admin/master/vessels/lookup-status` | đăng nhập | `{ enabled: boolean }` để giao diện ẩn/hiện nút |

- Rate limit riêng route tra cứu: 20 lần / phút / người dùng (`config: { rateLimit: ... }` của `@fastify/rate-limit` đã đăng ký ở `plugins/index.js`). Bỏ kiểu chặn 60 giây theo `updated_at` của legacy.
- Áp dụng đề xuất **không có route riêng**: giao diện gửi các trường đã chọn qua `POST` / `PUT` sẵn có, kèm `external_source` và `external_synced_at`. Thêm hai cột này vào `VESSEL_COLUMNS` và `vesselBody`.

---

## 6. Giao diện

### 6.1 API client — `frontend/src/api/fleetApi.js`

```js
lookup: (imo, refresh = false) => api.get(`/admin/master/vessels/lookup/${imo}`, { params: refresh ? { refresh: 1 } : {} }).then((r) => r.data),
lookupStatus: () => api.get('/admin/master/vessels/lookup-status').then((r) => r.data),
```

### 6.2 Control mới vào design system trước

Theo `CLAUDE.md` mục 3.4: thêm vào `components/ds/` và minh hoạ ở `/design-system` **trước khi** dùng trong trang.

- `ExternalDiffPanel.jsx`: dùng `SlidePanel`. Mỗi dòng: nhãn trường, giá trị hiện tại, giá trị internet, checkbox áp dụng (mặc định tick những trường hiện đang trống hoặc khác). Dòng khoá ngoại không khớp hiện chữ gốc kèm `Select` chọn tay. Chân panel: nguồn + thời điểm lấy, nút "Lấy lại bản mới" (refresh), "Áp dụng {n} trường", "Huỷ".
- Chip "Từ internet" cho trường được điền từ tra cứu, cùng kiểu với chip "Đã sửa" (`changedLabel.jsx`).

### 6.3 Form Thêm tàu — `VesselFormPage.jsx`

- Cạnh ô IMO: nút "Lấy từ internet", chỉ bấm được khi IMO qua `isValidImo`. Ẩn khi `lookupStatus.enabled = false`.
- Kết quả:
  - `existing_vessel` có và chưa xoá → `Banner` "Tàu IMO … đã có: {tên}" + nút "Mở tàu". Không điền form.
  - `existing_vessel` đã xoá → Banner + nút "Khôi phục tàu" (`POST /:id/restore`) rồi mở trang Sửa.
  - Tìm thấy → điền **chỉ các trường đang trống** bằng `form.setFieldsValue`, gắn chip "Từ internet"; toast "Đã điền {n} trường từ internet. Kiểm tra lại trước khi lưu."; `unmatched` hiện thành gợi ý dưới ô tương ứng.
  - Không tìm thấy → toast "Không tìm thấy tàu IMO … trên internet. Nhập tay."
- Đọc `?imo=` trên URL: có thì điền ô IMO và tự tra một lần.
- Lưu vẫn theo luồng form chuẩn (mục 3.3 `CLAUDE.md`), có gửi `external_source`, `external_synced_at` nếu đã áp dụng.

### 6.4 Chi tiết tàu — `VesselDetailPage.jsx`

- Menu "…" thêm "Cập nhật từ internet" (cần `imo_number`). Mở `ExternalDiffPanel`; áp dụng → `PUT` chỉ các trường đã tick → toast "Đã cập nhật {n} trường".
- Dưới khối thông tin: dòng nhỏ "Cập nhật từ internet lúc …" nếu có `external_synced_at`.

### 6.5 Danh sách tàu — `VesselListPage.jsx`

- `EmptyState` khi tìm kiếm: nếu từ khoá là IMO hợp lệ và tính năng bật → thêm nút "Tra IMO {imo} trên internet" → `navigate('/vessels/new?imo=…')`.

---

## 7. Các bước

### Bước 0 — Chốt nguồn dữ liệu
⛔ DỪNG theo mục 3. Ghi phương án đã chọn vào Nhật ký.
**Xong khi:** có phương án, URL và khoá (hoặc API key) trong `backend/.env` trên máy dev; gọi tay một IMO mẫu (ví dụ `9747613`) ra dữ liệu.

### Bước 1 — Migration và cấu hình
Mục 4.1, 4.2. Thêm biến vào `backend/.env.example` (không có giá trị thật).
**Xong khi:** migration chạy sạch trên DB dev; server khởi động được khi `VESSEL_LOOKUP_PROVIDER` rỗng.

### Bước 2 — Luật map
`vessel_lookup/map.js` + test vitest: mỗi dòng bảng 5.3 ít nhất một ca khớp và một ca không khớp; dùng 9 tàu ở `docs/mcah-danh-muc-tau-demo.md` làm dữ liệu mẫu.
**Xong khi:** `npm test` ở backend xanh.

### Bước 3 — Adapter và `lookup()`
`legacy_proxy.js` (port `decryptPayload` và `fetchDecryptedVesselByImo` từ legacy, bỏ log lộ khoá) hoặc adapter của phương án đã chọn; `index.js` theo 5.2. Test với `fetch` giả: tìm thấy, không thấy, lỗi mạng, timeout, giải mã sai, bộ đệm còn hạn, `refresh`.
**Xong khi:** test xanh; gọi thật một IMO mẫu ra `proposal` đúng.

### Bước 4 — Route
Mục 5.4, kể cả rate limit và thêm `external_source`, `external_synced_at` vào `VESSEL_COLUMNS` / `vesselBody`.
**Xong khi:** `curl` có token: IMO sai số kiểm tra → 400; quyền `seafarer` → 403; tắt provider → 503; IMO mẫu → 200; gọi lại → `from_cache: true`.

### Bước 5 — Control design system
Mục 6.2, minh hoạ trên `/design-system`.
**Xong khi:** trang `/design-system` hiện panel với dữ liệu mẫu, sáng và tối, desktop và mobile.

### Bước 6 — Form Thêm tàu
Mục 6.3.
**Xong khi:** chạy app, thêm tàu bằng IMO mẫu: form điền đúng, chip hiện, lưu được; IMO đã có → banner; `?imo=` tự tra.

### Bước 7 — Chi tiết và danh sách
Mục 6.4, 6.5.
**Xong khi:** sửa tay một trường, bấm "Cập nhật từ internet": panel hiện khác biệt, bỏ tick trường vừa sửa thì giá trị tay được giữ; tìm IMO chưa có trong danh sách → nút tra hiện và dẫn đúng.

### Bước 8 — Rà lại
`npm run lint`, `npm test` cả hai phía; thử mobile; cập nhật `TASKS.md` nếu có mục liên quan.

---

## 8. Để sau

1. **Tìm theo tên tàu** như Master tàu của legacy: cần một catalog (legacy dùng `ships_plain.db`, bảng `SHOW_FLEET`). Hỏi nguồn và giấy phép của file đó trước khi mang sang.
2. Panel **đối chiếu tàu** khi duyệt giấy tờ (B3, `VesselMatchChip`): giấy có IMO chưa có trong danh mục → nút "Tra trên internet và thêm tàu".
3. Ô chọn tàu ở **form chuyến**: không thấy tàu → tra IMO tại chỗ.
4. Thêm adapter thứ hai (API thương mại) và cho chọn thứ tự ưu tiên.

---

## 9. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-10-20 | Lập kế hoạch | — | Server legacy `157.180.60.155:8888` không phản hồi; chưa có `ENC_KEY`. |
| 2026-10-20 | Bước 0 | — | HuyLD chốt **phương án A**: dùng lại server trung gian của legacy, adapter `legacy_proxy`. Đang chờ URL hiện tại và `ENC_KEY`. |
| 2026-10-27 | Thiết kế lại và làm | — | Làm bản **Lấy thông tin thông minh** thay cho thiết kế mục 6 (đã duyệt wireframe `docs/design/wireframes/tim-tau-danh-muc.html`): Danh mục tàu thế giới (`ship_catalog`, 733 nghìn tàu) tìm theo tên, tên cũ, IMO, MMSI ở panel cạnh ô tìm; bấm Thêm thì hỏi có lấy thông tin thông minh (nguồn ngoài, tra theo IMO) không; nút Lấy thông minh cạnh ô IMO ở form Thêm và Sửa. Trần chung 1 lần mỗi 2 phút cho cả hệ thống (bảng `vessel_lookup_gate`), mỗi IMO giữ bản lưu 2 phút. Nhóm tab và panel bên phải ở trang chi tiết tàu đổi sang mục lục như thuyền viên. |
