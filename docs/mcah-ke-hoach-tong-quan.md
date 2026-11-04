# MCAH — Kế hoạch dựng lại màn Tổng quan

- **Ngày lập:** 2026-11-04
- **Trạng thái:** plan đã duyệt, mục 9 đã chốt (2026-11-04). Chưa viết code.
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự. Mọi quyết định cần cho việc dựng đã chép vào mục 1–5.
- **Wireframe đã duyệt:** `docs/design/wireframes/tong-quan.html` (lần 4, cũng ở https://claude.ai/artifact/CXNKY2Ymt1rb3wLv4zdk62). Có hai màn: **Tổng quan · Quản lý** và **Tổng quan · Môi giới viên**.
- **Thay cho:** `frontend/src/pages/admin/DashboardPage.jsx` hiện tại (bảng chứng chỉ + bảng cơ hội sắp đến hạn chốt, bản thô).
- **Testcase tay:** `docs/mcah-testcase-tong-quan.md`.
- **Hướng dẫn trong app:** `frontend/public/huong-dan/tong-quan.html`.

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` ở thư mục gốc repo trước khi viết dòng code nào. Mọi quy ước trong đó vẫn áp dụng.
2. Làm **đúng thứ tự các bước ở mục 8**. Mỗi bước có phần "Xong khi"; chỉ sang bước sau khi mọi ý trong đó đúng.
3. Sau mỗi bước: chạy lint và test của phần vừa sửa, rồi commit **một commit cho một bước**, message tiếng Việt, thể mệnh lệnh. Không push.
4. Gặp dòng **⛔ DỪNG** thì dừng, báo người dùng đúng điều được yêu cầu và chờ trả lời.
5. Không làm những việc ở mục 2.2 "Không làm".
6. Ghi tiến độ vào mục 10 "Nhật ký" sau mỗi bước.
7. Chi tiết trong file mâu thuẫn với code đang có (tên cột, tên hàm đã đổi…) thì ưu tiên code, sửa cho khớp, ghi một dòng vào Nhật ký.
8. **Dựng trên màn và component đang có.** Wireframe chốt bố cục, chữ, thứ tự khối và mức độ màu. Control dùng chung mới (biểu đồ cột, thanh tiến độ) thêm vào `frontend/src/components/ds/` và minh hoạ ở `/design-system` **trước**, rồi mới dùng ở trang.

---

## 1. Nghiệp vụ cần hiểu

### 1.1 Mục đích

Mở Tổng quan là **thấy hết trên một màn hình, không cuộn** (màn 1440×900). Nhìn 5 giây phải biết: tháng này doanh thu và hợp đồng đang đạt hay chậm, và có việc gì đã quá hạn. Ít thông tin, chữ to, **màu đỏ chỉ dành cho việc quá hạn hoặc đang chậm**.

### 1.2 Hai góc nhìn

| Góc nhìn | Ai thấy | Số liệu |
|---|---|---|
| **Quản lý** | Người có quyền mới `kpi.view_all` ("Xem số của cả công ty trên Tổng quan") | Cả công ty, kèm từng môi giới viên |
| **Môi giới viên** | Mọi người còn lại | Chỉ số được tính cho chính người đó (mục 1.4) |

Không có nút chuyển góc nhìn trên màn. Một người chỉ thấy một góc nhìn, theo quyền.

### 1.3 Bố cục (giống wireframe lần 4)

```
┌ Chào {tên} · Thứ Tư, 04/11/2026 · số của cả công ty / số của bạn      Cập nhật 08:30 ⟳ ┐
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Thẻ 1                                │ Thẻ 2                                │
├──────────────────────────────────────┴──────────────────────────────────────┤
│ Cần chú ý   [Hạn chốt cơ hội 6•] [Chứng chỉ 9•] [Xuống / rời tàu 5•] [Chờ xử lý 6•]   Mở … → │
│ danh sách của tab đang chọn, quá hạn trước                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Quản lý:** Thẻ 1 = Doanh thu, Thẻ 2 = Hợp đồng mới ký (theo từng môi giới viên).
- **Môi giới viên:** Thẻ 1 = Hợp đồng bạn ký (thanh tiến độ + cột 6 tháng), Thẻ 2 = Doanh thu của bạn.
- Desktop (khung app rộng từ 1024px): lưới 2 cột × 2 hàng, cao bằng khung nhìn trừ topbar, **trang không cuộn**. Hàng trên : hàng dưới = 1 : 1,2.
- Dưới 1024px: xếp dọc, cuộn bình thường; mỗi danh sách hiện 5 dòng.

### 1.4 Chỉ số KPI

**Tháng** là tháng dương lịch theo giờ Việt Nam. "Hôm nay" là ngày máy chủ (`CURRENT_DATE`).

**Hợp đồng mới ký trong tháng** = số hợp đồng chưa xoá có **lần duyệt đầu tiên** (`contract_approval_log.action = 'APPROVE'`, sớm nhất của hợp đồng đó) rơi vào tháng. Duyệt lại sau khi Đưa về Nháp **không** tính thêm lần nữa.

**Doanh thu tháng** = với mỗi hợp đồng `ACTIVE` hoặc `ENDED` chưa xoá:
- Khoản hằng tháng: `(Σ receivable_usd − Σ payable_usd của các dòng MONTHLY) × số ngày hợp đồng nằm trong tháng / số ngày của tháng`. Ngày hợp đồng là `start_date … end_date` (cả hai đầu).
- Khoản một lần (`ONE_TIME`): chênh lệch tính trọn vào tháng chứa `start_date`.
- **Tháng đang chạy hiện số dự kiến cả tháng** (tính hết tháng theo hợp đồng hiện có), kèm dòng nhỏ "đã ghi nhận … USD tới hôm nay" (tính tới hôm nay).
- Tháng đã qua: số tính lại mỗi lần mở (không chốt sổ). Hợp đồng sửa ngày thì số tháng cũ đổi theo.

> Đã chốt 2026-11-04 (mục 9, câu 1).

**Tính cho ai.** Mỗi hợp đồng được tính cho **một** người:
1. Hợp đồng gắn chuyến có cơ hội (`seafarer_voyage.opportunity_id`): người phụ trách cơ hội (`opportunity.owner_user_id`).
2. Không có cơ hội: người tạo hợp đồng (`seafarer_contract.created_by`).

> Đã chốt 2026-11-04 (mục 9, câu 2).

**Mục tiêu tháng.** Mỗi môi giới viên có hai số cho từng tháng: số hợp đồng, doanh thu (USD). Mục tiêu công ty = tổng mục tiêu của mọi người trong tháng đó. Chưa đặt thì coi là không có mục tiêu (không phải 0): ẩn đường mục tiêu, ẩn nhãn Đạt / Chậm, ô KPI ghi "Chưa đặt mục tiêu tháng".

**Tiến độ cần có hôm nay** = mục tiêu × ngày hôm nay trong tháng / số ngày của tháng (ví dụ ngày 4/30, mục tiêu 10 → 1,33). Vẽ thành **vạch đứng** trên thanh tiến độ.

| Nhãn trên thẻ Hợp đồng | Điều kiện | Màu |
|---|---|---|
| Đạt mục tiêu | đã ký ≥ mục tiêu | xanh |
| Đúng tiến độ | đã ký ≥ tiến độ cần có hôm nay | xanh |
| Chậm tiến độ | đã ký < tiến độ cần có hôm nay | **đỏ** |

| Nhãn trên thẻ Doanh thu | Điều kiện | Màu |
|---|---|---|
| Đạt mục tiêu | dự kiến cả tháng ≥ mục tiêu | xanh |
| Thiếu {n} USD | dự kiến < mục tiêu | vàng |

Ở thẻ Hợp đồng của quản lý, mỗi môi giới viên một dòng: tên, thanh tiến độ có vạch, `đã ký / mục tiêu`. **Người chậm tiến độ tô đỏ cả tên và số.** Danh sách: tài khoản còn hoạt động có mục tiêu trong tháng **hoặc** có hợp đồng tính cho mình trong tháng, xếp theo tên. Quá 6 người thì thẻ cuộn bên trong (không đẩy trang dài ra).

Ở thẻ Hợp đồng của môi giới viên, thanh tiến độ có **phần gạch chéo** nối tiếp phần đã ký = số việc sắp thành hợp đồng tính cho người đó: hợp đồng `PENDING`, hợp đồng `DRAFT`, cơ hội `OPEN` có ứng viên được chủ tàu chọn (`owner_selected_at`). Dòng dưới thanh: "Gạch chéo: +3 sắp vào (1 chờ duyệt, 1 nháp, 1 chủ tàu đã chọn)".

**Biểu đồ cột 6 tháng** (thẻ Doanh thu ở cả hai màn, thẻ Hợp đồng ở màn môi giới): 5 tháng trước cột đặc, tháng này cột gạch chéo (nhãn trục "Tháng này"), số ở đầu cột, đường mục tiêu nét đứt của **tháng này** nếu có. Nhãn mục tiêu nằm ở chú thích dưới biểu đồ, không đè lên cột. Doanh thu ghi gọn: `26,9k`.

### 1.5 Khối Cần chú ý

Một khối, 4 tab. Mở trang: chọn tab đầu tiên có việc quá hạn; không có thì tab đầu tiên.

| Tab | Gồm | Quá hạn khi | Link góc khối |
|---|---|---|---|
| **Hạn chốt cơ hội** | Cơ hội `OPEN` có `deadline_flag` (quá hạn chốt, hoặc tới hạn trong 7 ngày, `DEADLINE_WARN_DAYS`) | `LATE` | Mở Cơ hội |
| **Chứng chỉ** | Như `certificateAlerts` đang có: chứng chỉ quá hạn hoặc hết hạn trong 60 ngày (`EXPIRING_DAYS`), bỏ bản đã có bản mới | `days_left < 0` | Mở Thuyền viên |
| **Xuống / rời tàu** | Chuyến (`seafarer_voyage`) chưa rời có `join_date` từ hôm nay tới 30 ngày tới (sắp xuống tàu); chuyến chưa rời có `leave_flag` (rời dự kiến trong 30 ngày, hoặc đã qua mà chưa ghi rời) | `leave_flag.kind = 'LATE'` | Mở Chuyến tàu |
| **Chờ xử lý** (quản lý) / **Việc của bạn** (môi giới) | Các dòng gom nhóm ở bảng dưới | dòng đánh dấu đỏ | Mở Hợp đồng |

Dòng của tab Chờ xử lý / Việc của bạn (mỗi dòng là một loại việc kèm số; dòng có số 0 thì ẩn):

| Dòng | Quản lý | Môi giới | Đỏ |
|---|---|---|---|
| Yêu cầu thanh toán quá hạn (kèm tổng USD) | ✓ | ✓ (bill của hợp đồng tính cho mình) | ✓ |
| Hợp đồng bị từ chối | ✓ | ✓ "cần sửa" | ✓ |
| Hợp đồng chờ duyệt | ✓ | ✓ "đang chờ duyệt" | |
| Hợp đồng nháp chưa xin duyệt | | ✓ | |
| Yêu cầu thanh toán cần duyệt | ✓ | | |
| Yêu cầu thanh toán cần gửi | ✓ | ✓ | |

**Chuyến quá ngày xuống tàu** trong wireframe thuộc mô hình chuyến cũ (có Bắt đầu chuyến). Mô hình hiện tại không có bước đó nên **bỏ dòng này**.

Mỗi dòng danh sách: một dòng chính đậm (16px), một dòng phụ xám (14px), bên phải là **nhãn đếm ngày**:
- Quá hạn: viên đỏ "Quá {n} ngày".
- Chưa quá hạn: chữ thường, không màu, "Còn {n} ngày" / "Hôm nay".
- Tab Chờ xử lý: "{n} việc", đỏ nếu dòng đánh dấu đỏ.

Thứ tự: quá hạn trước (quá lâu nhất lên đầu), rồi việc sắp tới (gần nhất lên đầu). **Không** có tiêu đề nhóm.

Chữ dòng theo wireframe:
- Cơ hội: `{chức danh ngắn} · {tàu hoặc "Chưa rõ tàu"}` / `Hạn chốt dd/mm · {trạng thái} · {chủ tàu}`.
- Chứng chỉ: `{thuyền viên} · {chứng chỉ}` / `Hết hạn dd/mm · {đang trên / sắp lên} {tàu} hoặc ở bờ · {chức danh}`.
- Xuống / rời tàu: `{thuyền viên} · {chức danh}` / `Xuống tàu dd/mm · {tàu} · {cảng}` hoặc `Rời tàu dự kiến dd/mm · {tàu} · chưa ghi rời tàu`.

**Thông tin đi tàu ở chứng chỉ** (mới): người có chuyến chưa rời → `join_date ≤ hôm nay` là "đang trên {tàu}", `join_date > hôm nay` là "sắp lên {tàu}". Không có chuyến chưa rời → "ở bờ". Chữ xám như phần còn lại; **không** tô màu riêng.

**Tab có việc quá hạn** có một chấm đỏ nhỏ sau số đếm. Số đếm màu xám.

**Vừa khung.** Desktop: danh sách hiện đúng số dòng lọt chiều cao còn lại (đo bằng `ResizeObserver`), dòng bị ẩn đếm ở link góc khối: "Mở Thuyền viên → · còn 5 ẩn". Dưới 1024px: 5 dòng.

Bấm một dòng: cơ hội → `/opportunities/:id`; chứng chỉ → `/seafarers/:id` (tab Chứng chỉ); xuống / rời tàu → trang chuyến; việc chờ → danh sách tương ứng đã lọc sẵn (hợp đồng theo trạng thái, YCTT theo tab).

### 1.6 Phạm vi dữ liệu và quyền

- Mỗi tab / thẻ chỉ hiện khi có quyền xem mục đó: Hạn chốt cơ hội cần `opportunity.view`; Chứng chỉ cần `seafarer.view`; Xuống / rời tàu cần `voyage.view`; dòng YCTT cần `bill.view`; dòng hợp đồng và thẻ KPI cần `contract.view`. Không còn tab nào thì ẩn cả khối.
- Danh sách tôn trọng phạm vi dữ liệu đang có (`utils/scope.js`, cột `created_by`).
- **Màn môi giới viên** lọc thêm "của bạn": cơ hội có `owner_user_id` = mình; chứng chỉ của thuyền viên mình tạo; chuyến mình tạo; hợp đồng và bill của hợp đồng tính cho mình (mục 1.4).
- Route Tổng quan đổi guard từ `seafarer.view` sang "đăng nhập là vào được". Người không có quyền nào ở trên thấy lời chào và một trang trống có chữ "Bạn chưa có quyền xem số liệu nào trên Tổng quan."

### 1.7 Bỏ khỏi màn hiện tại

Bảng chứng chỉ có tab Tất cả / Quá hạn / Sắp hết hạn và bảng cơ hội riêng: thay bằng hai tab của khối Cần chú ý. Wireframe lần 1–3 có lịch 30 ngày dạng ô ngày, số thuyền viên trên tàu, phải thu chưa về, biểu đồ giai đoạn cơ hội: **không làm**.

---

## 2. Phạm vi

### 2.1 Làm

- Màn Tổng quan mới, hai góc nhìn, bốn trạng thái của mỗi khối: đang tải, có dữ liệu, rỗng, lỗi (mỗi khối tải và lỗi riêng).
- Bảng mục tiêu tháng, quyền mới, màn **Quản trị → Mục tiêu tháng**.
- API KPI và API cho khối Cần chú ý.
- Hai component dùng chung mới: `KpiBars`, `ProgressMeter`.
- Hướng dẫn trong app, link Hướng dẫn trên trang Tổng quan.

### 2.2 Không làm

- Chốt sổ doanh thu theo tháng (số tháng cũ vẫn tính lại khi hợp đồng đổi).
- Mục tiêu theo quý / năm, mục tiêu công ty nhập riêng.
- Xếp hạng, so sánh giữa môi giới viên trên màn môi giới.
- Nút chuyển góc nhìn, lọc theo chủ tàu trên Tổng quan.
- Gửi thông báo / email khi chậm tiến độ.
- Doanh thu theo VND, quy đổi tỷ giá.

---

## 3. Dữ liệu

### 3.1 Migration `backend/migrations/postgres/040_kpi_target.sql`

(Số 040 là số kế tiếp lúc lập plan; trùng thì lấy số kế tiếp và ghi Nhật ký.)

```sql
CREATE TABLE "kpi_target" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "user" ("id"),
  "month" DATE NOT NULL,                       -- luôn là ngày 1 của tháng
  "contracts" SMALLINT CHECK ("contracts" >= 0),
  "revenue_usd" decimal(12,2) CHECK ("revenue_usd" >= 0),
  "created_by" INTEGER, "updated_by" INTEGER,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "kpi_target_month_check" CHECK (EXTRACT(DAY FROM "month") = 1),
  UNIQUE ("user_id", "month")
);
CREATE TRIGGER "kpi_target_updated_at" BEFORE UPDATE ON "kpi_target" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

- Không xoá mềm: xoá mục tiêu = đặt cả hai ô về NULL (dòng giữ lại).
- Chỉ mục cho truy vấn KPI: `contract_approval_log (contract_id, action, created_at)` nếu chưa có.
- Cấp quyền mới (mục 3.2) cho các vai trò đang có `contract.approve`, như cách đã làm với `bill.approve` ở migration 037.

### 3.2 Quyền (`backend/src/constants/permissions.js`)

Thêm mục `kpi`, nhóm "Hệ thống", **không** có phạm vi dữ liệu:

```js
{ key: 'kpi', group: 'Hệ thống', label: 'KPI', permissions: [['view_all', 'Xem số của cả công ty trên Tổng quan'], ['manage', 'Đặt mục tiêu tháng']] }
```

### 3.3 Hằng số (`backend/src/constants/dashboard.js`, mới)

`SCHEDULE_DAYS = 30`, `KPI_MONTHS = 6`. Dùng lại `DEADLINE_WARN_DAYS`, `LEAVE_WARN_DAYS`, `EXPIRING_DAYS` đang có, không khai báo lại.

---

## 4. API

Tất cả trong `routes/v1/dashboard.routes.js` + `services/dashboard.service.js`; `onRequest: [fastify.authenticate, …]`. Hàm tính tiền và ngày là hàm thuần trong `utils/kpi_math.js` để test riêng.

### 4.1 `GET /api/v1/dashboard/kpi?month=YYYY-MM`

Quyền: `contract.view`. `month` mặc định tháng hiện tại. Có `kpi.view_all` → `view: 'company'`, không có → `view: 'own'`.

```jsonc
{
  "view": "company",
  "month": "2026-11", "day": 4, "days_in_month": 30,
  "revenue": {
    "months": [{ "month": "2026-06", "value": 19200 }, …, { "month": "2026-11", "value": 26900, "projected": true }],
    "to_date": 3590,
    "target": 28000          // null khi chưa đặt
  },
  "contracts": {
    "months": [{ "month": "2026-06", "value": 7 }, …],
    "done": 3, "target": 10, "pace": 1.33,
    "pending": { "pending": 1, "draft": 1, "owner_selected": 1 }   // chỉ view 'own'
  },
  "people": [ { "user_id": 7, "name": "Nguyễn Thị Lan", "done": 1, "target": 3, "revenue": 7100 } ]  // chỉ view 'company'
}
```

- `kpi_math.js`: `monthOverlapDays(start, end, month)`, `contractRevenueByMonth(contract, months)`, `pace(target, day, daysInMonth)`, `paceLabel(done, target, pace)`.
- Truy vấn lấy hợp đồng có ngày giao với 6 tháng, kèm `contract_item`, người được tính (mục 1.4); cộng trong JS.

### 4.2 `GET /api/v1/dashboard/attention`

Trả số đếm cho cả 4 tab và danh sách đầy đủ (tối đa 200 dòng mỗi tab) của các tab người dùng có quyền. Tham số `mine=1` do server tự đặt theo quyền (không có `kpi.view_all` → lọc "của bạn").

```jsonc
{
  "tabs": {
    "opportunities": { "count": 6, "late": 2, "rows": [ … giống dòng danh sách cơ hội, có deadline_flag ] },
    "certificates":  { "count": 9, "late": 3, "rows": [ … như certificateAlerts + trip: { where: "ONBOARD"|"UPCOMING"|null, vessel_name, voyage_id } ] },
    "schedule":      { "count": 5, "late": 1, "rows": [ { kind: "JOIN"|"LEAVE", voyage_id, seafarer_name, rank_name, vessel_name, port_name, date, days, late } ] },
    "work":          { "count": 6, "late": 3, "rows": [ { key: "BILL_OVERDUE", n: 2, amount_usd: 18400, late: true, link: "/bills?tab=OVERDUE" }, … ] }
  }
}
```

- Tab không có quyền thì không có khoá trong `tabs`.
- `certificateAlerts` giữ nguyên chữ ký, thêm `trip` (một `LEFT JOIN` tới chuyến chưa rời của thuyền viên). Route `/dashboard/certificate-alerts` giữ lại tới khi frontend cũ bị gỡ ở bước 7, rồi xoá.
- Các khoá tab gọi song song trong service; một tab lỗi thì tab đó trả `{ "error": true }`, tab khác vẫn có dữ liệu.

### 4.3 Mục tiêu tháng

- `GET /api/v1/kpi-targets?month=YYYY-MM` (quyền `kpi.manage`): mọi tài khoản còn hoạt động, kèm mục tiêu tháng đó (null nếu chưa đặt) và số đã ký / doanh thu dự kiến để tham khảo.
- `PUT /api/v1/kpi-targets` (quyền `kpi.manage`): body `{ month, rows: [{ user_id, contracts, revenue_usd }] }`, lưu cả lưới trong một transaction (upsert). `pickAllowed`, JSON Schema: số nguyên ≥ 0, USD ≥ 0 tối đa 2 số lẻ, tháng dạng `YYYY-MM`.
- `POST /api/v1/kpi-targets/copy` (quyền `kpi.manage`): `{ from: 'YYYY-MM', to: 'YYYY-MM' }`, chép mục tiêu tháng trước sang, **chỉ điền ô đang trống** của tháng đích.

---

## 5. Giao diện

### 5.1 Xem wireframe

Mở `docs/design/wireframes/tong-quan.html` bằng trình duyệt. Thanh trên: chọn Màn (Quản lý / Môi giới viên), Màu, Desktop / Mobile, Trạng thái (Có dữ liệu, Đang tải, Rỗng, Lỗi, Không có quyền Cơ hội và YCTT, Chưa đặt mục tiêu). Số đen tròn trên mỗi khối là số khối dùng trong file này.

### 5.2 Dựng theo cái đang có

| Phần | Lấy từ |
|---|---|
| Khung trang, tiêu đề | `ds-page` của các trang danh sách; bỏ `ds-page__head` lớn, dùng một dòng chào như wireframe |
| Thẻ | `ds-card` (bo 16px, viền `--border`) |
| Tab | `StatusTabs` (`components/ds/Controls.jsx`), thêm prop `dot` cho chấm đỏ. Dưới 640px tự thành nút "Mục:" như đang có |
| Nhãn đếm ngày đỏ | `StatusBadge` tông `error`, cỡ lớn hơn (thêm `size="lg"` nếu chưa có) |
| Trạng thái rỗng / lỗi | `EmptyState` |
| Đang tải | `Skeleton` của antd như trang hiện tại |
| Link Hướng dẫn | `HelpLink` (`components/ds/HelpLink.jsx`), thêm hằng `GUIDE_DASHBOARD_URL` |

### 5.3 Component mới (thêm vào `components/ds/`, minh hoạ ở `/design-system` trước)

- **`KpiBars`**: props `data: [{ label, value, projected }]`, `target`, `format`. Vẽ bằng CSS/SVG tự viết (repo không có thư viện biểu đồ, không thêm). Cột co theo chiều cao thẻ.
- **`ProgressMeter`**: props `done`, `target`, `pace`, `pending`, `tone` tự tính (đỏ khi `done < pace`). Thanh 12px, vạch đứng tiến độ, phần gạch chéo.

### 5.4 File frontend

```
pages/admin/dashboard/
  DashboardPage.jsx        // thay file pages/admin/DashboardPage.jsx; chọn góc nhìn theo quyền
  KpiRevenueCard.jsx
  KpiContractCard.jsx      // hai biến thể: company (theo người), own (thanh + cột)
  AttentionCard.jsx        // tab + danh sách vừa khung
  attentionRows.js         // hàm thuần: dòng API → { main, sub, days, late, to }
  dashboard.css
  __tests__/
pages/admin/settings/KpiTargetPage.jsx   // Quản trị → Mục tiêu tháng
hooks/useDashboard.js      // useKpi(month), useAttention()
api/index.js               // dashboardApi.kpi, dashboardApi.attention, kpiTargetApi
```

`navConfig.js`: thêm tab `{ to: '/admin/kpi-targets', label: 'Mục tiêu tháng', perm: 'kpi.manage' }` vào mục Quản trị. `App.jsx`: route mới; route `/dashboard` bỏ guard `seafarer.view`.

### 5.5 Màn Quản trị → Mục tiêu tháng

Form lưới theo chuẩn mục 3.3 của `CLAUDE.md` (chế độ **sửa**: nút lưu chỉ tắt khi chưa đổi gì, ô đã đổi có chip "Đã sửa", thanh lưu dính đáy).

- Đầu trang: chọn tháng (`DatePicker` kiểu tháng), nút **Chép từ tháng trước**.
- Bảng: Môi giới viên | Hợp đồng (ô số) | Doanh thu USD (`MoneyInput`) | Tháng này đã ký / dự kiến (chỉ đọc, xám).
- Dòng cuối: tổng công ty (chỉ đọc).
- Tháng đã qua vẫn sửa được (không khoá).

---

## 6. Định dạng và quy ước

- USD: `26.900` (dấu chấm hàng nghìn), trên biểu đồ ghi gọn `26,9k`. Ngày `dd/mm` trong dòng, `dd/mm/yyyy` ở nơi khác.
- Chữ: "Hợp đồng mới ký", "Doanh thu", "Cần chú ý", "Chờ xử lý", "Việc của bạn", "Quá {n} ngày", "Còn {n} ngày", "Hôm nay", "Chậm tiến độ", "Đúng tiến độ", "Đạt mục tiêu", "Thiếu {n} USD", "Chưa đặt mục tiêu tháng".
- Màu: đỏ chỉ cho quá hạn / chậm; vàng chỉ cho "Thiếu … USD"; xanh cho đạt / đúng tiến độ. Khối Cần chú ý không có màu vàng.

---

## 7. Testcase

Chạy tay theo `docs/mcah-testcase-tong-quan.md` ở bước 9. Test tự động: hàm thuần `kpi_math.js`, `attentionRows.js`, `ProgressMeter`, `KpiBars`, route quyền.

---

## 8. Các bước

### Bước 0 — Chốt câu hỏi mở

Đã xong 2026-11-04: người dùng giữ cả 4 đề xuất ở mục 9. Không cần hỏi lại.

**Xong khi:** (đã xong).

### Bước 1 — Migration và quyền

`040_kpi_target.sql`, mục `kpi` trong `permissions.js`, cấp quyền cho vai trò đang có `contract.approve`.

**Xong khi:** migrate chạy trên DB dev; màn Vai trò và quyền hiện mục KPI với 2 quyền; vai trò quản lý đã có hai quyền mới; test backend qua.

### Bước 2 — Hàm thuần KPI

`utils/kpi_math.js` + test: hợp đồng nằm trọn tháng, cắt đầu, cắt cuối, dài hơn một tháng, khoản một lần, tháng 2, tháng 31 ngày, tiến độ ngày 1 và ngày cuối tháng, mục tiêu null.

**Xong khi:** `npm test` backend qua; tính tay ví dụ "1.000 USD/tháng, bắt đầu 16/11" ra 500 cho tháng 11 (30 ngày, 15 ngày).

### Bước 3 — API KPI và mục tiêu

Route 4.1, 4.3. Test route: không có `contract.view` → 403; không có `kpi.view_all` → `view: 'own'` và không có `people`; mục tiêu chưa đặt → `target: null`; chép tháng không ghi đè ô đã có.

**Xong khi:** test qua; gọi API trên DB dev, so một hợp đồng tính tay khớp.

### Bước 4 — API Cần chú ý

Route 4.2, thêm `trip` vào chứng chỉ. Test: thiếu `opportunity.view` thì không có khoá `opportunities`; phạm vi `own` lọc đúng; lọc "của bạn" đúng mục 1.6; tab lỗi không làm hỏng tab khác.

**Xong khi:** test qua; số đếm 4 tab trên DB dev khớp với lọc tay ở các danh sách Cơ hội, Chuyến tàu, Hợp đồng, YCTT.

### Bước 5 — Component dùng chung

`KpiBars`, `ProgressMeter`, prop `dot` của `StatusTabs`, cỡ lớn của nhãn đỏ; minh hoạ ở `/design-system` (có trạng thái chưa đặt mục tiêu, chậm, đạt, có phần gạch chéo).

**Xong khi:** `/design-system` hiện đủ biến thể; test component qua; lint frontend sạch.

### Bước 6 — Màn Tổng quan

`pages/admin/dashboard/*`, hook, API client. Lưới vừa khung trên desktop, đo dòng bằng `ResizeObserver`.

**Xong khi:** ở 1440×900, cả hai góc nhìn **không cuộn trang**, mỗi tab hiện ít nhất 4 dòng; dưới 1024px xếp dọc 5 dòng mỗi tab; tắt mạng một API thì chỉ khối đó báo lỗi kèm Thử lại; chụp màn so với wireframe lần 4, gửi người dùng.

**⛔ DỪNG:** gửi ảnh chụp hai góc nhìn (desktop + mobile), chờ người dùng duyệt trước khi sang bước 7.

### Bước 7 — Gỡ màn cũ

Xoá `pages/admin/DashboardPage.jsx` cũ, route `/dashboard/certificate-alerts`, `dashboardApi.certificateAlerts`; `grep -rn "certificateAlerts\|certificate-alerts" backend/src frontend/src` không còn chỗ dùng ngoài service.

**Xong khi:** grep sạch; test và lint cả hai phía qua.

### Bước 8 — Quản trị → Mục tiêu tháng, hướng dẫn trong app

Màn 5.5, tab trong `navConfig.js` (cập nhật `navConfig.test.js`). Rà lại `frontend/public/huong-dan/tong-quan.html` cho khớp chữ trên màn đã dựng; thêm `HelpLink` trên trang Tổng quan và trang Mục tiêu tháng.

**Xong khi:** đặt mục tiêu ở màn mới thì Tổng quan đổi theo; chép tháng trước chỉ điền ô trống; link Hướng dẫn mở đúng trang.

### Bước 9 — Chạy testcase tay

Chạy hết `docs/mcah-testcase-tong-quan.md`, ghi Đạt / Không đạt vào cột kết quả.

**Xong khi:** mọi case Đạt, hoặc case Không đạt đã sửa và chạy lại; **⛔ DỪNG** báo người dùng danh sách case còn lỗi nếu có.

---

## 9. Câu hỏi đã chốt (2026-11-04: giữ cả 4 đề xuất)

1. **Doanh thu** = chênh lệch phải thu − phải chi của hợp đồng `ACTIVE` / `ENDED`, chia theo ngày trong tháng; khoản một lần vào tháng bắt đầu. Không dùng tổng phải thu, không dùng tiền YCTT đã thu.
2. **Hợp đồng tính cho** người phụ trách cơ hội; chuyến không có cơ hội thì người tạo hợp đồng.
3. **Góc nhìn Quản lý** theo quyền mới `kpi.view_all`, cấp sẵn cho vai trò đang có `contract.approve`.
4. **Mục tiêu** đặt theo từng người, từng tháng; mục tiêu công ty = tổng, **không** nhập riêng.

---

## 10. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-11-04 | Lập plan | — | Wireframe lần 4 đã duyệt. |
| 2026-11-04 | Bước 0 | — | Người dùng giữ cả 4 đề xuất ở mục 9. Bắt đầu từ bước 1 khi được bảo code. |
| 2026-11-04 | Bước 1 | (commit này) | Nhánh `feature/tong-quan` tách từ `feature/timeline-di-tau-bo-trang-thai-chuyen` (cần migration 038–039). Migration `040_kpi_target.sql` + chỉ mục `contract_approval_log_action_idx`; mục quyền `kpi` (48 quyền, 12 mục). DB dev chưa vai trò nào có `contract.approve` nên chưa cấp `kpi.*` cho ai; quản trị viên vẫn có đủ quyền. |
| 2026-11-04 | Bước 2 | (commit này) | `utils/kpi_math.js`: `daysInMonth`, `lastMonths`, `monthOverlapDays`, `contractRevenue`, `revenueByMonth`, `pace`, `contractLabel`, `revenueLabel` (tên khác plan mục 4.1: `paceLabel` → `contractLabel` + `revenueLabel`). 16 test; ví dụ 1.000 USD từ 16/11 ra 500. |
| 2026-11-04 | Bước 3 | (commit này) | Service riêng `services/kpi.service.js` (không gộp vào dashboard.service), route mục tiêu ở `routes/v1/kpi_target.routes.js`. API KPI trả thêm `label` (nhãn đã tính sẵn) và `people[].pace`, `people[].revenue_target`. USD tối đa 2 số lẻ kiểm trong service (multipleOf của JSON Schema sai với số thực). 11 test route. DB dev: hợp đồng 28 tháng 9 ra 107,33 = 230 × 14/30, khớp tính tay. |
| 2026-11-04 | Bước 4 | (commit này) | `GET /dashboard/attention` trong `dashboard.service.js` (`deadlineOpportunities`, `certificateAlerts` thêm `trip`, `schedule`, `work`, `attention`). Route cần ít nhất một quyền xem trong 5 mục. Tab cơ hội dùng lại `LIST_SELECT`, `decorate` (export thêm từ opportunity.service). Dòng việc trả `key` (CONTRACT_REJECTED, CONTRACT_PENDING, CONTRACT_DRAFT, BILL_OVERDUE, BILL_TO_APPROVE, BILL_TO_SEND) + `link`; frontend tự đặt chữ. Tab Chờ xử lý `count` = tổng số việc. 6 test. DB dev khớp SQL tay: 10 cơ hội, 1 YCTT quá hạn, 3 HĐ bị từ chối, 4 chờ duyệt, 77 YCTT cần duyệt; Xuống / rời tàu 0 vì rời sớm nhất 31/12, xuống tàu muộn nhất 02/11. |
| 2026-11-04 | Bước 5 | (commit này) | `KpiBars`, `ProgressMeter`, thêm `DueTag` (nhãn đếm ngày cuối dòng, thay cho "StatusBadge tông error" ở mục 5.2), `StatusTabs` nhận `tab.dot`, `StatusBadge` nhận `size="lg"`, nhóm trạng thái `kpi` (DONE, ON_TRACK, BEHIND, SHORT) trong statusMap. Minh hoạ ở `/design-system#kpi`. 9 test. Lint frontend còn 1 lỗi có sẵn ở `fleet/OwnershipFields.jsx` (không thuộc bước này). |
