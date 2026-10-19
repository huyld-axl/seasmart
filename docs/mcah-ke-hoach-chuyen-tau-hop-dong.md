# MCAH — Kế hoạch dựng Chuyến tàu và Hợp đồng (giai đoạn 1)

- **Ngày lập:** 2026-10-19
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự. Không cần đọc thêm tài liệu nào khác để biết phải làm gì; các file trong code thì phải đọc khi bước yêu cầu.
- **Thiết kế gốc (để đối chiếu, không bắt buộc đọc):** Claude Doc "Thiết kế Chuyến tàu và Hợp đồng cho MCAH" (https://claude.ai/code/artifact/0e382a48-28d1-4a43-b407-47a262798410). Mọi quyết định cần cho việc dựng đã chép vào mục 1–4 dưới đây.
- **Wireframe đã duyệt:** `docs/design/wireframes/chuyen-tau-hop-dong.html` (bản 13). Cách mở xem ở mục 5.

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` ở thư mục gốc repo trước khi viết dòng code nào. Mọi quy ước trong đó vẫn áp dụng (CommonJS không chấm phẩy ở backend, SQL tham số hoá, `pickAllowed`, lỗi dạng `{ statusCode, message }`, form theo mục 3.3, control theo mục 3.4, chữ trên giao diện bằng tiếng Việt).
2. Làm **đúng thứ tự các bước ở mục 7**. Mỗi bước có phần "Xong khi"; chỉ sang bước sau khi mọi ý trong đó đúng.
3. Sau mỗi bước: chạy lint và test của phần vừa sửa, rồi commit **một commit cho một bước**, message tiếng Việt, thể mệnh lệnh, ví dụ `Thêm bảng chuyến tàu và hợp đồng`. Không push.
4. Gặp dòng **⛔ DỪNG** thì dừng lại, báo người dùng đúng điều được yêu cầu và chờ trả lời. Không tự quyết thay.
5. Không làm những việc ở mục 2.2 "Không làm", kể cả khi thấy tiện tay.
6. Ghi tiến độ vào mục 10 "Nhật ký" cuối file sau mỗi bước (ngày, bước, commit, ghi chú). Mở lại phiên mới thì đọc mục 10 để biết đang ở đâu.
7. Khi một chi tiết trong file này mâu thuẫn với code đang có (tên cột, tên hàm đã đổi…), ưu tiên code đang có, sửa cho khớp, rồi ghi một dòng vào Nhật ký.

---

## 1. Nghiệp vụ cần hiểu

### 1.1 Khái niệm

- **Môi giới** là người dùng hệ thống. Môi giới nhận tiền của **chủ tàu** rồi trả lương cho **thuyền viên**. Phần môi giới giữ lại là **chênh lệch** (hoa hồng), không có ô hoa hồng riêng và không trừ vào lương thuyền viên.
- **Chuyến tàu (voyage):** một lần đưa người lên **một tàu**. Gồm thông tin chung và nhiều **vị trí dự kiến**.
- **Vị trí dự kiến (voyage_position):** một chỗ trên tàu (một chức danh). Cần 2 thủy thủ AB thì có 2 dòng. Mỗi vị trí có **budget dự kiến**: số tiền chủ tàu sẵn sàng trả cho chỗ đó, nhập theo **tổng chuyến** hoặc **mỗi tháng**.
- **Hợp đồng (seafarer_contract):** tạo từ một vị trí, cho một thuyền viên. Một hợp đồng gộp hai thỏa thuận trên một màn:
  - **Phải thu:** chủ tàu trả môi giới. Nội bộ, không in lên hợp đồng.
  - **Phải chi:** môi giới trả thuyền viên. Đây là phần sau này in lên hợp đồng lao động MLC.
- **Thuyền viên chính thức** của chuyến = người có hợp đồng ở trạng thái **Hiệu lực** trong chuyến.

### 1.2 Trạng thái hợp đồng

| Mã | Nhãn | Sửa nội dung | Nút trên màn chi tiết |
|---|---|---|---|
| `DRAFT` | Nháp | Được | Sửa hợp đồng, Xin duyệt, Xoá (trong menu "…") |
| `PENDING` | Chờ duyệt | Khoá | Thôi xin duyệt (về Nháp), Từ chối (bắt buộc lý do), Duyệt (hộp thoại xác nhận) |
| `REJECTED` | Bị từ chối | Được | Sửa hợp đồng, Xin duyệt lại |
| `ACTIVE` | Hiệu lực | Khoá | In hợp đồng (có nút, **chưa chạy**) |
| `ENDED` | Hết hạn | Khoá | Chỉ xem |

- Duyệt một cấp. **Tạm thời chưa phân quyền duyệt:** ai có quyền ghi (mục 4.1) cũng xin duyệt, duyệt, từ chối được, kể cả hợp đồng do mình tạo.
- Từ chối phải có lý do. Lý do gần nhất hiện ở banner đầu trang và trong lịch sử duyệt.
- `ACTIVE` → `ENDED` do **job hằng ngày**: khi ngày kết thúc của hợp đồng đã qua.
- Chỉ xoá được hợp đồng `DRAFT` (xoá mềm).

### 1.3 Trạng thái chuyến và luồng chuyến

Trạng thái lưu trong DB (`voyage.status`): `PLANNING`, `ONBOARD`, `ENDED`. Trạng thái **hiển thị** (`display_status`) tính ra:

| display_status | Nhãn | Khi nào |
|---|---|---|
| `RECRUITING` | Đang tuyển | `PLANNING` và còn vị trí chưa có hợp đồng (hợp đồng chưa xoá, trạng thái nào cũng được) |
| `FULL` | Đủ người | `PLANNING`, có ít nhất 1 vị trí và vị trí nào cũng có hợp đồng |
| `ONBOARD` | Đang trên tàu | `ONBOARD` |
| `ENDED` | Đã kết thúc | `ENDED` |

Luồng (hệ thống **không** tự đổi trạng thái chuyến):

1. **Cảnh báo trễ ngày** (chỉ khi `PLANNING`): còn 0–3 ngày tới ngày xuống tàu dự kiến → nhãn vàng "Còn N ngày"; đã qua ngày đó → nhãn đỏ "Quá N ngày chưa bắt đầu" và banner trên chi tiết chuyến. Chỉ cảnh báo, không đổi gì.
2. **Nút Bắt đầu chuyến** (hiện khi `PLANNING`): hộp thoại nhập **ngày xuống tàu thực tế** (mặc định = ngày dự kiến) và **nơi xuống tàu** (mặc định = nơi đã nhập ở chuyến), cả hai bắt buộc. Hộp thoại liệt kê thuyền viên chính thức sẽ chuyển **Ở bờ → Đang trên tàu**. Lưu xong: chuyến `ONBOARD`, các thuyền viên đó `seafarer.status = 'ON_VESSEL'`.
3. **Nút Kết thúc chuyến** (hiện khi `ONBOARD`): hộp thoại nhập **ngày rời tàu thực tế** và **nơi rời tàu** (mặc định = nơi đã nhập ở chuyến), cả hai bắt buộc; liệt kê thuyền viên chính thức sẽ chuyển **Đang trên tàu → Ở bờ**. Lưu xong: chuyến `ENDED`, các thuyền viên đó `seafarer.status = 'AVAILABLE'`.
4. **Hợp đồng chưa hiệu lực** (nháp, chờ duyệt, bị từ chối) lúc Bắt đầu hoặc Kết thúc: hộp thoại có khung cảnh báo vàng nêu tên từng người. Vẫn cho lưu, nhưng **không đổi trạng thái** những người này.
5. **Duyệt hợp đồng khi chuyến đang `ONBOARD`:** hộp thoại xác nhận duyệt có `ToggleRow` "Chuyển {tên} sang Đang trên tàu", **mặc định bật**. Bật thì duyệt xong đặt `seafarer.status = 'ON_VESSEL'`; tắt thì chỉ duyệt. Chuyến chưa bắt đầu hoặc đã kết thúc: hộp thoại xác nhận chỉ có một dòng ghi chú, không có toggle.
6. Quá ngày rời tàu dự kiến mà chưa Kết thúc: **không** cảnh báo.

Ngày thực tế của chuyến **không** đổi ngày của hợp đồng và **không** dùng để tính lương.

### 1.4 Trạng thái thuyền viên

- Hai giá trị dùng từ nay: `ON_VESSEL` nhãn **Đang trên tàu**, `AVAILABLE` nhãn **Ở bờ**. Cột vẫn là `seafarer.status`.
- Đổi tự động theo mục 1.3, **không chọn tay**. Ô chọn tay 7 giá trị trên form thuyền viên bị bỏ (bước 13).

### 1.5 Quy tắc tính

**Số tháng giữa hai ngày** (dùng cho budget và cân đối, đặt ở một hàm dùng chung):
- `m` = số tháng trọn lớn nhất sao cho `start + m tháng ≤ end`; `d` = số ngày từ `start + m tháng` tới `end`; kết quả `m + d / 30`, làm tròn 2 chữ số.
- Ví dụ phải có trong test: 05/11/2026 → 05/08/2027 = 9; 01/01/2027 → 16/01/2027 = 0,5; 31/01/2027 → 28/02/2027 = 1 (cộng tháng kiểu dayjs, ngày 31 lùi về cuối tháng); end < start → lỗi.

**Budget dự kiến:** mỗi tháng = tổng chuyến ÷ số tháng (từ ngày xuống tới ngày rời tàu **dự kiến**). Người dùng sửa ô nào thì ô kia tự tính; cả hai ô đều sửa tay được (không ô nào bị khoá). Sửa ngày dự kiến của chuyến thì giữ tổng chuyến, tính lại mỗi tháng. Tiền làm tròn 2 chữ số.

**Cân đối hợp đồng** (thanh dính đáy ở màn tạo/sửa, thẻ "Cân đối" ở màn chi tiết):

| Số | Cách tính | Dấu ✓ xanh khi | Không đạt |
|---|---|---|---|
| Budget dự kiến/tháng | `budget_monthly_usd` của vị trí. Hiện nổi bật nhất, kèm tổng chuyến | — | — |
| Phải thu/tháng | Tổng `receivable_usd` các khoản `MONTHLY` | ≤ budget | dấu cảnh báo vàng |
| Phải chi/tháng | Tổng `payable_usd` các khoản `MONTHLY` | ≤ budget | dấu đỏ |
| Chênh lệch/tháng | Phải thu − phải chi. Phụ: chênh lệch cả hợp đồng = chênh lệch/tháng × số tháng của hợp đồng | ≥ 0 và ≤ budget | dấu đỏ |

Vượt budget chỉ cảnh báo, vẫn lưu được. Phải chi lớn hơn phải thu vẫn lưu được.

**Lương thực tế** (giai đoạn 2, chưa làm): theo ngày bắt đầu → kết thúc của hợp đồng, tháng lẻ = mức tháng × số ngày ÷ 30.

### 1.6 Khoản tiền mặc định

Mỗi hợp đồng luôn có đủ 12 dòng mặc định, tên cố định (không sửa tên, không xoá, không khoá ô nào; khoản không dùng thì để trống). Mỗi dòng có hai ô: phải thu và phải chi. Người dùng thêm được dòng tự đặt tên ở cuối mỗi nhóm (nút "Thêm khoản hằng tháng" / "Thêm khoản một lần"); dòng tự đặt tên thì sửa tên và xoá được.

| Nhóm | `item_code` | Tên |
|---|---|---|
| Hằng tháng (`MONTHLY`, USD/tháng) | `BASIC_WAGE` | Lương cơ bản |
| | `FIXED_OVERTIME` | Làm thêm cố định |
| | `LEAVE_PAY` | Lương phép |
| | `ALLOWANCE` | Phụ cấp |
| | `BONUS` | Thưởng |
| | `SERVICE_FEE` | Phí dịch vụ |
| Một lần (`ONE_TIME`, USD) | `FLIGHT_OUT` | Vé máy bay đi |
| | `FLIGHT_BACK` | Vé máy bay về |
| | `VISA_FEE` | Phí visa |
| | `MEDICAL` | Khám sức khoẻ |
| | `TRAINING` | Huấn luyện/chứng chỉ |
| | `COMPLETION_BONUS` | Thưởng hoàn thành hợp đồng |

### 1.7 Kỳ thanh toán

Mỗi bên (phải thu, phải chi) một bộ, đều là dropdown:

| Mục | Lựa chọn | Lưu thành |
|---|---|---|
| Ngày chốt sổ | Ngày 5, Ngày 10, Ngày 15, Ngày 20, Ngày 25, Cuối tháng | `closing_day` 5/10/15/20/25/31 (31 = cuối tháng) |
| Ngày thanh toán | 7 ngày (Ngày 1, 5, 10, 15, 20, 25, Cuối tháng) × 3 mốc (tháng sau, sau 2 tháng, sau 3 tháng); dropdown chia 3 nhóm "Tháng sau", "Sau 2 tháng", "Sau 3 tháng"; nhãn ví dụ "Ngày 10 tháng sau", "Cuối tháng sau", "Ngày 5 sau 2 tháng", "Cuối tháng, sau 3 tháng" | `pay_day` 1/5/10/15/20/25/31 + `pay_month_offset` 1/2/3 |
| Gặp ngày nghỉ (gợi ý dưới nhãn: "Ngày nghỉ, lễ của ngân hàng") | Làm trước, Làm sau | `holiday_rule` `BEFORE` / `AFTER` |

Mặc định khi tạo hợp đồng: phải thu = Cuối tháng · Ngày 10 tháng sau · Làm sau; phải chi = Cuối tháng · Ngày 15 tháng sau · Làm trước.

### 1.8 Mã số

- Chuyến: `CT-{năm tạo}-{số thứ tự 3 chữ số trong năm}`, ví dụ `CT-2026-018`.
- Hợp đồng: `HĐ-{năm tạo}-{số thứ tự 4 chữ số trong năm}`, ví dụ `HĐ-2026-0142`. Cấp lúc tạo, không đổi.

---

## 2. Phạm vi

### 2.1 Làm trong giai đoạn 1

Danh sách, tạo, sửa, chi tiết chuyến tàu; danh sách, tạo, sửa, chi tiết hợp đồng; luồng xin duyệt, duyệt, từ chối, thôi xin duyệt; Bắt đầu / Kết thúc chuyến với cảnh báo trễ ngày; trạng thái thuyền viên Đang trên tàu / Ở bờ; nút In hợp đồng chưa chạy; job hết hạn hợp đồng; thay các chỗ đang đọc bảng hợp đồng cũ; chuyển dữ liệu hợp đồng cũ.

### 2.2 Không làm (ghi lại để khỏi làm nhầm)

- Tiền lương: ghi phải thu theo kỳ, nhận tiền, chi lương, phiếu lương (giai đoạn 2). Không đụng màn "Tiền lương" cũ trong wireframe.
- Một thuyền viên rời tàu trước cả chuyến, chấm dứt sớm hợp đồng, phụ lục gia hạn, sinh `sea_service` khi kết thúc chuyến, bộ giấy QĐ điều động / QĐ rời tàu từ chuyến (giai đoạn 3). **Không** thêm nút "Tạo bộ giấy" ở chuyến hay hợp đồng, dù wireframe hợp đồng còn vẽ nút đó.
- In hợp đồng thật theo mẫu MLC song ngữ (chờ người dùng gửi mẫu). Chỉ làm nút giả ở bước 12.
- Danh sách việc cần làm cho chuyến; phân quyền duyệt; duyệt nhiều cấp; khối tàu; điều động.
- Khối **Công tác** trên hồ sơ thuyền viên và các cột `seafarer.vessel_name_raw`, `contract_*`: **giữ nguyên**, vì `backend/src/services/form_export.service.js` đang đọc chúng để điền bản xuất. Bỏ khi làm bộ giấy từ chuyến.
- Bảng `employment_contract`: không xoá, chỉ thôi dùng.

---

## 3. Dữ liệu

### 3.1 Migration `backend/migrations/postgres/005_voyage_contract.sql`

Migration chạy bằng `cd backend && npm run migrate` (`scripts/migrate.js` chạy mọi file `NNN_*.sql` chưa chạy, theo thứ tự, mỗi file một transaction, và **từ chối nếu file đã chạy bị sửa**). Hàm `touch_updated_at()` đã có ở `001_schema.sql`. Viết theo kiểu của `001_schema.sql` / `004_vessel_technical_fields.sql` (tên bảng, cột trong ngoặc kép).

```sql
-- Chuyến tàu, vị trí dự kiến, hợp đồng hai bên (phải thu / phải chi), kỳ thanh toán, lịch sử duyệt.

CREATE TABLE "code_counter" (
  "kind" varchar(20) NOT NULL,
  "year" SMALLINT NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("kind", "year")
);

CREATE TABLE "voyage" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "code" varchar(20) NOT NULL UNIQUE,
  "vessel_id" INTEGER NOT NULL REFERENCES "vessel" ("id"),
  "ship_owner_id" INTEGER NOT NULL REFERENCES "ship_owner" ("id"),
  "embark_port_id" INTEGER REFERENCES "port" ("id"),
  "disembark_port_id" INTEGER REFERENCES "port" ("id"),
  "planned_embark_date" DATE NOT NULL,
  "planned_disembark_date" DATE NOT NULL,
  "actual_embark_date" DATE,
  "actual_disembark_date" DATE,
  "status" varchar(20) NOT NULL DEFAULT 'PLANNING',
  "notes" TEXT,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "deleted_at" TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT "voyage_status_check" CHECK ("status" IN ('PLANNING', 'ONBOARD', 'ENDED')),
  CONSTRAINT "voyage_planned_dates_check" CHECK ("planned_disembark_date" >= "planned_embark_date"),
  CONSTRAINT "voyage_actual_dates_check" CHECK ("actual_disembark_date" IS NULL OR "actual_embark_date" IS NULL OR "actual_disembark_date" >= "actual_embark_date"),
  CONSTRAINT "voyage_onboard_check" CHECK ("status" = 'PLANNING' OR ("actual_embark_date" IS NOT NULL AND "embark_port_id" IS NOT NULL)),
  CONSTRAINT "voyage_ended_check" CHECK ("status" <> 'ENDED' OR ("actual_disembark_date" IS NOT NULL AND "disembark_port_id" IS NOT NULL))
);
CREATE TRIGGER "voyage_updated_at" BEFORE UPDATE ON "voyage" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE INDEX "voyage_vessel_idx" ON "voyage" ("vessel_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "voyage_owner_idx" ON "voyage" ("ship_owner_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "voyage_position" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "voyage_id" INTEGER NOT NULL REFERENCES "voyage" ("id"),
  "rank_id" INTEGER NOT NULL REFERENCES "rank" ("id"),
  "budget_total_usd" decimal(12,2) NOT NULL CHECK ("budget_total_usd" >= 0),
  "budget_monthly_usd" decimal(12,2) NOT NULL CHECK ("budget_monthly_usd" >= 0),
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "deleted_at" TIMESTAMP WITHOUT TIME ZONE
);
CREATE TRIGGER "voyage_position_updated_at" BEFORE UPDATE ON "voyage_position" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE INDEX "voyage_position_voyage_idx" ON "voyage_position" ("voyage_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "seafarer_contract" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "contract_number" varchar(20) NOT NULL UNIQUE,
  "voyage_position_id" INTEGER NOT NULL REFERENCES "voyage_position" ("id"),
  "seafarer_id" INTEGER NOT NULL REFERENCES "seafarer" ("id"),
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "notes" TEXT,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "last_reject_reason" TEXT,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "deleted_at" TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT "seafarer_contract_status_check" CHECK ("status" IN ('DRAFT', 'PENDING', 'REJECTED', 'ACTIVE', 'ENDED')),
  CONSTRAINT "seafarer_contract_dates_check" CHECK ("end_date" >= "start_date")
);
CREATE TRIGGER "seafarer_contract_updated_at" BEFORE UPDATE ON "seafarer_contract" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
-- Một vị trí chỉ có một hợp đồng còn sống.
CREATE UNIQUE INDEX "seafarer_contract_position_uniq" ON "seafarer_contract" ("voyage_position_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "seafarer_contract_seafarer_idx" ON "seafarer_contract" ("seafarer_id") WHERE "deleted_at" IS NULL;

-- Một dòng = một khoản, hai ô tiền (phải thu, phải chi), khớp bảng hai cột trên màn.
CREATE TABLE "contract_item" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "contract_id" INTEGER NOT NULL REFERENCES "seafarer_contract" ("id") ON DELETE CASCADE,
  "kind" varchar(10) NOT NULL,
  "item_code" varchar(30),
  "custom_name" varchar(100),
  "receivable_usd" decimal(12,2) CHECK ("receivable_usd" >= 0),
  "payable_usd" decimal(12,2) CHECK ("payable_usd" >= 0),
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT "contract_item_kind_check" CHECK ("kind" IN ('MONTHLY', 'ONE_TIME')),
  CONSTRAINT "contract_item_name_check" CHECK (("item_code" IS NULL) <> ("custom_name" IS NULL))
);
CREATE UNIQUE INDEX "contract_item_code_uniq" ON "contract_item" ("contract_id", "item_code") WHERE "item_code" IS NOT NULL;

CREATE TABLE "contract_payment_term" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "contract_id" INTEGER NOT NULL REFERENCES "seafarer_contract" ("id") ON DELETE CASCADE,
  "side" varchar(10) NOT NULL,
  "closing_day" SMALLINT NOT NULL,
  "pay_day" SMALLINT NOT NULL,
  "pay_month_offset" SMALLINT NOT NULL,
  "holiday_rule" varchar(10) NOT NULL,
  UNIQUE ("contract_id", "side"),
  CONSTRAINT "contract_payment_term_side_check" CHECK ("side" IN ('RECEIVABLE', 'PAYABLE')),
  CONSTRAINT "contract_payment_term_closing_check" CHECK ("closing_day" IN (5, 10, 15, 20, 25, 31)),
  CONSTRAINT "contract_payment_term_pay_day_check" CHECK ("pay_day" IN (1, 5, 10, 15, 20, 25, 31)),
  CONSTRAINT "contract_payment_term_offset_check" CHECK ("pay_month_offset" IN (1, 2, 3)),
  CONSTRAINT "contract_payment_term_holiday_check" CHECK ("holiday_rule" IN ('BEFORE', 'AFTER'))
);

CREATE TABLE "contract_approval_log" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "contract_id" INTEGER NOT NULL REFERENCES "seafarer_contract" ("id") ON DELETE CASCADE,
  "action" varchar(20) NOT NULL,
  "actor_id" INTEGER REFERENCES "user" ("id"),
  "reason" TEXT,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "contract_approval_log_action_check" CHECK ("action" IN ('CREATE', 'SUBMIT', 'WITHDRAW', 'APPROVE', 'REJECT'))
);
CREATE INDEX "contract_approval_log_contract_idx" ON "contract_approval_log" ("contract_id");

-- Bảng lương cũ chưa từng có dữ liệu: xoá. Có dữ liệu thì dừng migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "contract_payroll") THEN
    RAISE EXCEPTION 'contract_payroll có dữ liệu, không xoá';
  END IF;
END $$;
DROP TABLE "contract_payroll";
```

Kiểm tra trước khi viết: chạy `grep -n 'CREATE TABLE "user"' backend/migrations/postgres/001_schema.sql` để chắc bảng tên `"user"`. Kiểm tra tên bảng chức danh là `"rank"` (từ khoá, luôn để trong ngoặc kép, kể cả trong câu SQL của service).

### 3.2 Hằng số

`backend/src/constants/voyage_contract.js` (CommonJS) và bản ESM `frontend/src/constants/voyageContract.js` cùng nội dung:

- `VOYAGE_STATUSES = ['PLANNING', 'ONBOARD', 'ENDED']`
- `VOYAGE_DISPLAY_STATUSES = ['RECRUITING', 'FULL', 'ONBOARD', 'ENDED']`
- `CONTRACT_STATUSES = ['DRAFT', 'PENDING', 'REJECTED', 'ACTIVE', 'ENDED']`
- `EDITABLE_CONTRACT_STATUSES = ['DRAFT', 'REJECTED']`
- `DEFAULT_ITEMS`: mảng 12 phần tử `{ code, kind, name }` đúng thứ tự bảng mục 1.6.
- `CLOSING_DAYS = [5, 10, 15, 20, 25, 31]`, `PAY_DAYS = [1, 5, 10, 15, 20, 25, 31]`, `PAY_MONTH_OFFSETS = [1, 2, 3]`, `HOLIDAY_RULES = ['BEFORE', 'AFTER']`
- `DEFAULT_TERMS = { RECEIVABLE: { closing_day: 31, pay_day: 10, pay_month_offset: 1, holiday_rule: 'AFTER' }, PAYABLE: { closing_day: 31, pay_day: 15, pay_month_offset: 1, holiday_rule: 'BEFORE' } }`
- `DUE_SOON_DAYS = 3`
- `VOYAGE_EDITOR_ROLES = ['admin', 'operator']` (giống `EDITOR_ROLES` của `fleet.routes.js`; đổi ở một chỗ nếu sau này cần)

---

## 4. API

Đăng ký ở `backend/src/routes/v1/index.js`: `voyageRoutes` prefix `/voyages`, `seafarerContractRoutes` prefix `/contracts`. Mọi route có `onRequest: [fastify.authenticate]`; route ghi thêm hàm kiểm vai trò `VOYAGE_EDITOR_ROLES` viết giống `requireEditor` trong `fleet.routes.js` (403 "Không có quyền"). Validation bằng JSON Schema inline như `fleet.routes.js`. Ngày nhận và trả dạng `YYYY-MM-DD` (DB đã trả DATE dạng chuỗi, xem `config/db.js`). Tiền là số, 2 chữ số thập phân.

### 4.1 Chuyến tàu — `backend/src/routes/v1/voyage.routes.js`, `backend/src/services/voyage.service.js`

| Method + path | Body / query | Trả về | Quy tắc |
|---|---|---|---|
| `GET /voyages` | `tab` = `all`/`RECRUITING`/`FULL`/`ONBOARD`/`ENDED`, `search` (mã chuyến, tên tàu, tên chủ tàu, không dấu như `fleet.service`), `ship_owner_id`, `page`, `limit` (≤100, mặc định 20) | `{ data, total, counts }`; `counts` có `all` và từng `display_status` | Mỗi dòng: `id, code, vessel_id, vessel_name, ship_owner_id, ship_owner_name, planned_embark_date, planned_disembark_date, actual_embark_date, actual_disembark_date, status, display_status, positions_total, positions_filled, budget_monthly_sum, diff_monthly_sum` (tổng chênh lệch/tháng các hợp đồng chưa xoá, `null` nếu chưa có hợp đồng), `due` (`{ kind: 'SOON'\|'LATE', days }` hoặc `null`). Sắp xếp: `PLANNING` trước, rồi ngày xuống tàu dự kiến tăng dần |
| `GET /voyages/:id` | | Chuyến + `positions[]` + `summary` | Mỗi vị trí: `id, rank_id, rank_name, budget_total_usd, budget_monthly_usd, sort_order, contract` (`null` hoặc `{ id, contract_number, status, seafarer_id, seafarer_name, seafarer_status, receivable_monthly, payable_monthly }`). Thêm `embark_port_name, disembark_port_name, months` (số tháng dự kiến), `display_status`, `due` |
| `POST /voyages` | `vessel_id`*, `ship_owner_id`*, `planned_embark_date`*, `planned_disembark_date`*, `embark_port_id`, `disembark_port_id`, `notes`, `positions`* (≥1, mỗi phần tử `rank_id`*, `budget_total_usd`*, `budget_monthly_usd`*) | 201 + chi tiết như GET | Cấp `code` (mục 4.3). Transaction. `created_by` = `request.user.id` |
| `PUT /voyages/:id` | Như POST; `positions[]` gửi đủ, phần tử cũ có `id`; thêm `actual_embark_date`, `actual_disembark_date` | Chi tiết | Ngày thực tế chỉ nhận khi chuyến không còn `PLANNING` (đang `PLANNING` mà gửi thì 400). Vị trí bị bỏ khỏi mảng mà còn hợp đồng chưa xoá → 409 "Vị trí {chức danh} đã có hợp đồng, không xoá được". Không cho xoá hết vị trí. Transaction |
| `DELETE /voyages/:id` | | `{ success: true }` | Chỉ khi `PLANNING` và không còn hợp đồng chưa xoá; xoá mềm chuyến và vị trí |
| `POST /voyages/:id/start` | `actual_embark_date`*, `embark_port_id`* | `{ voyage, moved, skipped }` | Chỉ khi `PLANNING`, khác thì 409. Transaction: cập nhật chuyến sang `ONBOARD`; `UPDATE seafarer SET status = 'ON_VESSEL'` cho người có hợp đồng `ACTIVE` trong chuyến. `moved` = danh sách `{ seafarer_id, seafarer_name, rank_name }` đã đổi; `skipped` = người có hợp đồng chưa hiệu lực `{ seafarer_id, seafarer_name, rank_name, contract_status }` |
| `POST /voyages/:id/end` | `actual_disembark_date`*, `disembark_port_id`* | `{ voyage, moved, skipped }` | Chỉ khi `ONBOARD`; ngày rời ≥ ngày xuống thực tế (400 nếu sai). Chuyến sang `ENDED`; `status = 'AVAILABLE'` cho người có hợp đồng `ACTIVE` trong chuyến **và** đang `ON_VESSEL` |

`display_status` và `due` tính bằng một hàm thuần trong service (dễ test), không rải logic ra nhiều chỗ. Ngày "hôm nay" lấy theo `CURRENT_DATE` của DB hoặc truyền vào hàm thuần để test được.

### 4.2 Hợp đồng — `backend/src/routes/v1/seafarer_contract.routes.js`, `backend/src/services/seafarer_contract.service.js`

| Method + path | Body / query | Trả về | Quy tắc |
|---|---|---|---|
| `GET /contracts` | `tab` = `all` + 5 trạng thái, `search` (số hợp đồng, tên thuyền viên), `ship_owner_id`, `voyage_id`, `seafarer_id`, `page`, `limit` | `{ data, total, counts }` | Mỗi dòng: `id, contract_number, status, seafarer_id, seafarer_name, rank_name, voyage_id, voyage_code, vessel_name, ship_owner_name, start_date, end_date, receivable_monthly, payable_monthly, diff_monthly` |
| `GET /contracts/:id` | | Hợp đồng đầy đủ | `contract` + `position` (`id, rank_name, budget_total_usd, budget_monthly_usd, sort_order`, số thứ tự dòng) + `voyage` (`id, code, status, display_status, vessel_name, ship_owner_name, actual_embark_date`) + `seafarer` (`id, full_name, seafarer_code, status`) + `items[]` (12 mặc định theo thứ tự rồi dòng tự đặt tên) + `terms` (`{ RECEIVABLE, PAYABLE }`) + `log[]` (mới nhất trước, có tên người làm) + `balance` (mục 1.5, tính bằng hàm thuần dùng chung với danh sách) |
| `POST /contracts` | `voyage_position_id`*, `seafarer_id`*, `start_date`*, `end_date`*, `notes`, `items[]` (`item_code` hoặc `custom_name`, `kind`, `receivable_usd`, `payable_usd`), `terms` (`RECEIVABLE`, `PAYABLE`, mỗi bên 4 trường) | 201 + chi tiết | Vị trí phải còn sống và chưa có hợp đồng (409 "Vị trí này đã có hợp đồng"). Chuyến của vị trí phải là `PLANNING` hoặc `ONBOARD` (409 nếu `ENDED`). Cùng thuyền viên đã có hợp đồng khác chưa xoá, không `ENDED`, trùng khoảng ngày → 409 "{tên} đã có hợp đồng {số} trùng thời gian". Thiếu khoản mặc định nào thì tự thêm dòng trống. `item_code` lạ → 400. Tối đa 40 dòng. Trạng thái `DRAFT`, ghi log `CREATE`. Cấp số (mục 4.3). Transaction |
| `PUT /contracts/:id` | Như POST trừ `voyage_position_id` | Chi tiết | Chỉ khi `DRAFT`/`REJECTED`, khác thì 409 "Hợp đồng đang khoá, không sửa được". Thay toàn bộ `items` và `terms`. Kiểm trùng thời gian như POST (bỏ qua chính nó) |
| `DELETE /contracts/:id` | | `{ success: true }` | Chỉ `DRAFT` |
| `POST /contracts/:id/submit` | | Chi tiết | `DRAFT`/`REJECTED` → `PENDING`, log `SUBMIT` |
| `POST /contracts/:id/withdraw` | | Chi tiết | `PENDING` → `DRAFT`, log `WITHDRAW` |
| `POST /contracts/:id/reject` | `reason`* (trim, 1–1000 ký tự) | Chi tiết | `PENDING` → `REJECTED`, ghi `last_reject_reason`, log `REJECT` kèm lý do |
| `POST /contracts/:id/approve` | `move_onboard` (boolean, mặc định `false`) | Chi tiết + `moved` (boolean) | `PENDING` → `ACTIVE`, log `APPROVE`. Nếu chuyến `ONBOARD` và `move_onboard = true` thì đặt thuyền viên `ON_VESSEL`, `moved = true`. Transaction |

Chuyển trạng thái sai (ví dụ duyệt hợp đồng `DRAFT`) → 409 với câu tiếng Việt nêu trạng thái hiện tại. Viết bảng chuyển trạng thái thành một hằng số `TRANSITIONS = { submit: { from: ['DRAFT', 'REJECTED'], to: 'PENDING', log: 'SUBMIT' }, … }` và một hàm `transition(pool, id, action, extra)` dùng chung.

### 4.3 Cấp mã

Trong `backend/src/utils/code_counter.js`:

```js
// Lấy số kế tiếp của (kind, year) trong cùng transaction với câu INSERT dùng nó.
async function nextCode(conn, kind, year, prefix, width) {
  const [[row]] = await conn.query(
    `INSERT INTO "code_counter" ("kind", "year", "last_value") VALUES (?, ?, 1)
     ON CONFLICT ("kind", "year") DO UPDATE SET "last_value" = "code_counter"."last_value" + 1
     RETURNING "last_value"`,
    [kind, year]
  )
  return `${prefix}-${year}-${String(row.last_value).padStart(width, '0')}`
}
```

Gọi `nextCode(conn, 'VOYAGE', năm, 'CT', 3)` và `nextCode(conn, 'CONTRACT', năm, 'HĐ', 4)`. Kiểm trước cách `wrapPool` trả kết quả `RETURNING` (đọc `backend/src/utils/postgres_query.js`) rồi chỉnh destructuring cho đúng.

### 4.4 Job

Trong `backend/src/jobs.js`:
- **Bỏ** "Job 2" (đồng bộ `seafarer.status` theo `employment_contract`). Trạng thái thuyền viên giờ chỉ đổi theo chuyến.
- **Thêm** job 2:10 sáng mỗi ngày: `UPDATE "seafarer_contract" SET "status" = 'ENDED' WHERE "status" = 'ACTIVE' AND "end_date" < CURRENT_DATE AND "deleted_at" IS NULL`, ghi log số dòng như các job khác.

---

## 5. Giao diện

### 5.1 Xem wireframe

Mở `docs/design/wireframes/chuyen-tau-hop-dong.html` trong trình duyệt (skill `/browse` của gstack, theo `CLAUDE.md`). Thanh công cụ trên cùng chọn **Màn** và **Trạng thái**. Mở thẳng một trạng thái bằng hash `#{màn}.a.mau.desktop.menu.{trạng thái}`, ví dụ `#chuyen.a.mau.desktop.menu.bat-dau`. Chụp màn hình không cần trình duyệt có giao diện:

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars --window-size=1440,1500 --virtual-time-budget=3000 \
  --screenshot=/tmp/wf.png "file://$PWD/docs/design/wireframes/chuyen-tau-hop-dong.html#chuyen.a.mau.desktop.menu.bat-dau"
```

| Màn (mã) | Trạng thái (mã) |
|---|---|
| Danh sách chuyến (`ds-chuyen`) | `du-lieu`, `rong`, `dang-tai` |
| Chi tiết chuyến (`chuyen`) | `du-lieu` (Đang tuyển), `tre-ngay`, `bat-dau` (hộp thoại), `tren-tau`, `ket-thuc` (hộp thoại), `da-ket-thuc`, `rong`, `dang-tai` |
| Tạo / sửa chuyến (`tao-chuyen`) | `du-lieu`, `moi`, `loi-nhap`, `sua` |
| Danh sách hợp đồng (`ds-hop-dong`) | `du-lieu`, `rong`, `dang-tai` |
| Tạo hợp đồng (`hop-dong`) | `moi`, `menu` (dropdown ngày thanh toán), `am`, `loi-nhap` |
| Chi tiết hợp đồng (`hd-chi-tiet`) | `nhap`, `cho-duyet`, `duyet`, `duyet-tren-tau`, `tu-choi`, `bi-tu-choi`, `hieu-luc`, `in-hd` |

Wireframe là HTML tĩnh có CSS riêng để mô phỏng; **dựng bằng AntD + `components/ds` + CSS `sf-*` có sẵn**, chỉ lấy bố cục, chữ, thứ tự khối và hành vi từ wireframe. Số khối đánh trên wireframe (1, 2, 3…) chỉ để trao đổi, không dựng.

Chỗ code khác wireframe (đã chốt, làm theo code):
- Không có nút "Tạo bộ giấy" ở chi tiết hợp đồng (mục 2.2).
- Sidebar thật lấy từ `navConfig.js`, không lấy danh sách mục của wireframe.

### 5.2 Điều hướng

- `frontend/src/layouts/navConfig.js`: thêm hai mục ngay sau "Thuyền viên": `{ key: 'voyages', label: 'Chuyến tàu', icon: 'anchor', to: '/voyages', match: ['/voyages'] }` và `{ key: 'contracts', label: 'Hợp đồng', icon: 'file', to: '/contracts', match: ['/contracts'] }`.
- `frontend/src/layouts/AdminLayout.jsx`: thêm `anchor` (SVG mỏ neo 24×24 kiểu `ShipSvg` đang có: `<path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>`) và `file` (`FileTextOutlined`) vào `ICONS`.
- Sửa `layouts/__tests__/navConfig.test.js` cho thứ tự mới: Thuyền viên, Chuyến tàu, Hợp đồng, Bản xuất, Tàu, Đối tác, Danh mục, Quản trị. Kiểm `sectionsFor` của các vai trò khác: hai mục mới chỉ cho vai trò đang thấy "Tàu".
- `frontend/src/App.jsx`, trong khối route admin cạnh `/vessels`:

| Đường dẫn | Trang |
|---|---|
| `/voyages` | `VoyageListPage` |
| `/voyages/new` | `VoyageFormPage` |
| `/voyages/:id` | `VoyageDetailPage` |
| `/voyages/:id/edit` | `VoyageFormPage` |
| `/contracts` | `ContractListPage` |
| `/contracts/new?positionId=…` | `ContractFormPage` |
| `/contracts/:id` | `ContractDetailPage` |
| `/contracts/:id/edit` | `ContractFormPage` |

### 5.3 Trạng thái (badge)

`frontend/src/components/ds/statusMap.js` là bảng ánh xạ duy nhất. Thêm/sửa (dấu `mark` phải là dấu đã có trong `StatusBadge.jsx` hoặc `ring` / `ring-dot`):

```js
voyage: {
  RECRUITING: { label: 'Đang tuyển', tone: 'warning', mark: 'ellipsis' },
  FULL: { label: 'Đủ người', tone: 'success', mark: 'check' },
  ONBOARD: { label: 'Đang trên tàu', tone: 'success', mark: 'ring-dot' },
  ENDED: { label: 'Đã kết thúc', tone: 'neutral', mark: 'ring' },
},
contract: {
  DRAFT: { label: 'Nháp', tone: 'neutral', mark: 'edit' },
  PENDING: { label: 'Chờ duyệt', tone: 'warning', mark: 'clock' },
  REJECTED: { label: 'Bị từ chối', tone: 'error', mark: 'cross' },
  ACTIVE: { label: 'Hiệu lực', tone: 'success', mark: 'check' },
  ENDED: { label: 'Hết hạn', tone: 'neutral', mark: 'ring' },
},
```

Trong nhóm `crew` có sẵn: đổi nhãn `AVAILABLE` thành **"Ở bờ"** (giữ `ON_VESSEL` là "Đang trên tàu"). Sửa thêm nhãn `AVAILABLE` / `ON_VESSEL` ở `pages/admin/SeafarerDetailPage.jsx` (bảng màu và nhãn dòng 60–80) và `pages/admin/seafarers/crewView.js` (`availabilityText`) cho cùng chữ. Kiểm `STATUS_GROUP_LABELS` cuối file có cần thêm nhóm mới không. Trên trang `/design-system`, chỗ đang liệt kê các nhóm badge, thêm hai nhóm mới nếu trang đó tự liệt kê theo `STATUS`.

### 5.4 Cấu trúc file frontend

```
frontend/src/
  api/voyageApi.js                 voyageApi + seafarerContractApi (tên này để không đụng contractApi cũ)
  hooks/useVoyages.js              useVoyageList, useVoyage, useVoyageMutations, useContractList, useContract, useContractMutations
  constants/voyageContract.js      mục 3.2
  pages/admin/voyages/
    voyageView.js                  hàm thuần: monthsBetween, splitBudget, dueLabel, crewMoves, toFormValues, toPayload
    VoyageListPage.jsx
    VoyageFormPage.jsx
    VoyageDetailPage.jsx
    VoyageTransitionModal.jsx      một component cho cả Bắt đầu và Kết thúc (prop kind)
    voyages.css
    __tests__/voyageView.test.js
  pages/admin/contracts/
    contractView.js                hàm thuần: balance, itemRows, termLabel, payOptions, toFormValues, toPayload
    ContractListPage.jsx
    ContractFormPage.jsx
    ContractDetailPage.jsx
    DealTable.jsx                  bảng khoản tiền hai cột (sửa được hoặc chỉ đọc)
    TermsTable.jsx                 bảng kỳ thanh toán (sửa được hoặc chỉ đọc)
    BalanceBar.jsx                 thanh dính đáy của form
    BalanceCard.jsx                thẻ Cân đối ở cột phải của màn chi tiết
    ApproveModal.jsx
    RejectModal.jsx
    contracts.css
    __tests__/contractView.test.js
```

`api/voyageApi.js` viết theo `api/fleetApi.js` (`.then((r) => r.data)`), thêm các hàm `start(id, body)`, `end(id, body)`, `submit`, `withdraw`, `approve(id, { move_onboard })`, `reject(id, { reason })`. `hooks/useVoyages.js` viết theo `hooks/useFleet.js`; mọi mutation làm mới cả query `['voyages']`, `['contracts']` và `['seafarers']` (trạng thái thuyền viên đổi).

`monthsBetween` ở frontend phải cho đúng các ví dụ mục 1.5 như bản backend (`backend/src/utils/voyage_math.js`). Hai bản có test cùng bộ ví dụ.

Định dạng: ngày hiện `DD/MM/YYYY` (AntD `DatePicker format="DD/MM/YYYY"`, gửi API `YYYY-MM-DD`); tiền USD hiện kiểu Việt Nam `1.150,00` (`Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`), cột tổng không cần số lẻ thì `maximumFractionDigits: 2` không ép `,00`. Trước khi viết hàm định dạng mới, tìm trong `frontend/src/utils` và `pages/admin/fleet/fleetView.js` xem đã có chưa.

Control: dùng `ToggleRow`, `SegmentedPick`, `StatusTabs`, `EmptyState`, `Banner`, `StatusBadge`, `useToast`, `AuditTimeline` (nếu hợp với lịch sử duyệt, đọc props trước) đã có. Theo `CLAUDE.md` mục 3.4: nếu thấy cần một control **dùng chung** mới, thêm vào `components/ds/` và minh hoạ ở `/design-system` trước. Các bảng `DealTable`, `TermsTable`, `BalanceBar` là thành phần riêng của màn, để trong thư mục trang. `useToast` chưa có kiểu `info`: thêm `info` (icon `InfoCircleOutlined`) vào `components/ds/useToast.jsx` cho nút In hợp đồng.

### 5.5 Từng màn

**Danh sách chuyến** (`VoyageListPage`, theo khuôn `PartnerListPage.jsx`): tiêu đề trang "Chuyến tàu", mô tả "Mỗi chuyến là một lần đưa người lên một tàu, gồm nhiều vị trí. Hợp đồng tạo từ từng vị trí.", nút chính "Tạo chuyến tàu". `StatusTabs`: Tất cả, Đang tuyển, Đủ người, Đang trên tàu, Đã kết thúc (có số đếm từ `counts`). Ô tìm "Tìm mã chuyến, tên tàu" và `Select` "Tất cả chủ tàu". Cột: Mã chuyến (chữ mono) · Tàu (dòng phụ: chủ tàu) · Xuống → rời tàu (ngày thực tế nếu có, kèm chữ nhỏ "thực tế"; dòng dưới "→ ngày rời"; dưới nữa nhãn trễ ngày nếu có) · Vị trí (thanh tiến độ nhỏ + "4/7", dòng phụ "có hợp đồng") · Budget dự kiến/tháng (phải) · Chênh lệch/tháng (phải, "+2.000" hoặc "—") · Trạng thái (badge `voyage`). Chân bảng: "{n} chuyến · ngày dự kiến, trừ chỗ ghi "thực tế"" và "USD". Có trạng thái rỗng, đang tải, lỗi, tìm không thấy, mobile dạng danh sách như trang mẫu.

**Tạo / sửa chuyến** (`VoyageFormPage`, khung `FormFrame` + `FormSection` của `pages/admin/fleet/FleetParts.jsx`, theo `PartnerFormPage.jsx`):
- Khối 1 "Thông tin chung" (mô tả "Dùng chung cho mọi vị trí của chuyến. Hợp đồng lấy ngày ở đây làm mặc định."): Tàu* (`Select` tìm, dùng `lookupApi.vessels(search)`; chọn tàu thì tự điền Chủ tàu nếu tàu có `ship_owner_id`), Chủ tàu* (`Select` từ `shipOwnerApi.list`, gợi ý "Lấy theo tàu"), Ngày xuống tàu dự kiến*, Nơi xuống tàu (`Select` cảng từ `lookupApi.ports`), Ngày rời tàu dự kiến* (gợi ý dưới ô: "{n} tháng"), Nơi rời tàu, Ghi chú (textarea, chỗ giữ chỗ "Yêu cầu của chủ tàu, lịch bay…"). Khi tạo: mỗi hàng 2 ô (`sf-c6`). Khi sửa chuyến **đã bắt đầu**: thêm "Ngày xuống tàu thực tế" và "Ngày rời tàu thực tế", mỗi hàng 3 ô (`sf-c4`): dự kiến · thực tế · nơi; mô tả khối đổi thành "Ngày thực tế được ghi khi bấm Bắt đầu chuyến và Kết thúc chuyến. Sửa ở đây khi nhập sai."; gợi ý dưới ô thực tế "Ghi khi bấm Bắt đầu chuyến" / "Ghi khi bấm Kết thúc chuyến".
- Khối 2 "Vị trí dự kiến" (mô tả "Budget dự kiến là số chủ tàu sẵn sàng trả cho mỗi chỗ. Nhập tổng chuyến hoặc mỗi tháng, ô kia tự tính theo số tháng của chuyến. Cần 2 AB thì thêm 2 dòng."): bảng nhiều dòng `Form.List`: # · Chức danh* (`Select` từ `lookupApi.ranks`) · nhóm cột "Budget dự kiến (USD)*" gồm "Tổng chuyến" và "Mỗi tháng" (hai `InputNumber`, hậu tố USD, sửa ô nào ô kia tự tính, không khoá ô nào) · nút Nhân đôi dòng, Xoá dòng (icon). Dưới bảng nút "Thêm vị trí" và dòng tổng "{n} vị trí · budget dự kiến · {m} tháng" — "{tổng} USD · {tổng tháng} USD/tháng". Đổi ngày dự kiến thì tính lại cột Mỗi tháng theo Tổng chuyến.
- Thanh lưu theo `CLAUDE.md` mục 3.3: tạo = "Huỷ", "Lưu & tạo chuyến khác", "Tạo chuyến tàu"; sửa = "Huỷ", "Lưu thay đổi" (khoá khi chưa đổi gì, trường đã đổi có chip "Đã sửa" qua `changedLabel`). Thiếu ô bắt buộc thì báo lỗi dưới ô và cuộn tới. Tạo xong sang chi tiết chuyến.

**Chi tiết chuyến** (`VoyageDetailPage`):
- Đầu trang: đường dẫn "Chuyến tàu > {mã}"; ô hình tàu (`FleetTile`); tiêu đề "{tên tàu} · {mã}"; dòng phụ "{chủ tàu} · {nơi xuống} → {nơi rời}"; badge `voyage` + nhãn trễ ngày (nếu có). Nút bên phải: "…" (menu: Xoá chuyến, chỉ khi xoá được), "Sửa chuyến", và nút chính "Bắt đầu chuyến" (khi `PLANNING`) hoặc "Kết thúc chuyến" (khi `ONBOARD`); `ENDED` không có nút chính.
- Banner (`Banner` của ds): trễ ngày → vàng "Quá ngày xuống tàu dự kiến {n} ngày", nội dung "Dự kiến xuống tàu {ngày} nhưng chuyến chưa bắt đầu. Thuyền viên đã lên tàu thì bấm Bắt đầu chuyến để ghi ngày và nơi xuống tàu thực tế."; đang trên tàu mà còn hợp đồng chưa hiệu lực → vàng "{n} hợp đồng chưa hiệu lực", nội dung "{tên, tên} vẫn ở trạng thái Ở bờ. Khi duyệt hợp đồng, hộp thoại sẽ hỏi có chuyển người đó sang Đang trên tàu không."
- Khối thông tin: 4 ô cùng hàng: Xuống tàu, Nơi xuống tàu, Rời tàu, Nơi rời tàu; mỗi ô có dòng phụ "Dự kiến" / "Thực tế · dự kiến {ngày}" / "Dự kiến · {n} tháng"; trễ ngày thì dòng phụ Xuống tàu màu đỏ "Dự kiến · đã quá {n} ngày". Dưới, ngăn bằng đường kẻ: "Chủ tàu · ghi chú".
- 3 ô tóm tắt: Budget dự kiến (tổng cả chuyến; phụ "{x} USD/tháng · {n} vị trí · {m} tháng"), Hợp đồng ("{có}/{tổng}"; phụ "{a} hiệu lực · {b} chờ duyệt · {c} cần sửa · {d} trống"), Chênh lệch dự kiến ("{x} USD/tháng"; phụ "{y} USD cả chuyến · từ {n} hợp đồng").
- Bảng "Vị trí dự kiến {n}" (nút "Thêm vị trí" mở trang sửa chuyến, ẩn khi `ENDED`): # · Vị trí · Budget dự kiến (USD) Tổng chuyến / Mỗi tháng · Thuyền viên · hợp đồng (tên + badge `contract` cỡ nhỏ, hoặc "Chưa có người") · Trạng thái (badge `crew` của thuyền viên) · Phải chi (USD/tháng) · Chênh lệch (đậm "+800", dòng dưới "8%" = chênh lệch ÷ budget/tháng) · nút "Mở hợp đồng" hoặc "Tạo hợp đồng" (tới `/contracts/new?positionId=…`; ẩn khi `ENDED`). Chân bảng: "Trạng thái thuyền viên đổi khi bấm Bắt đầu chuyến và Kết thúc chuyến, chỉ với người có hợp đồng Hiệu lực." và "Phải thu {x} · phải chi {y} · chênh lệch {z} USD/tháng".
- `VoyageTransitionModal` (AntD `Modal`, rộng 600): tiêu đề "Bắt đầu chuyến {mã}?" / "Kết thúc chuyến {mã}?"; mô tả "Ghi ngày và nơi xuống tàu thực tế. Chuyến chuyển sang Đang trên tàu." / "Ghi ngày và nơi rời tàu thực tế. Chuyến chuyển sang Đã kết thúc."; hai ô bắt buộc cùng hàng (ngày + nơi, mặc định và gợi ý như mục 1.3); khung danh sách "Chuyển sang Đang trên tàu {n}" / "Chuyển sang Ở bờ {n}", mỗi dòng: tên, dòng phụ "{chức danh ngắn} · hợp đồng hiệu lực", bên phải badge trạng thái cũ → mũi tên → badge trạng thái mới; nếu có người hợp đồng chưa hiệu lực thì `Banner` vàng "{n} người có hợp đồng chưa hiệu lực, giữ nguyên trạng thái" với danh sách "{tên} · {chức danh} · {trạng thái hợp đồng}". Nút: "Huỷ", "Bắt đầu chuyến" / "Kết thúc chuyến". Danh sách tính bằng `crewMoves(positions, kind)` trong `voyageView.js` từ dữ liệu chi tiết chuyến. Lưu xong: toast "Đã bắt đầu chuyến {mã} · {n} người chuyển sang Đang trên tàu" (hoặc tương ứng), đóng hộp thoại.

**Danh sách hợp đồng** (`ContractListPage`): tiêu đề "Hợp đồng", mô tả "Hợp đồng tạo từ vị trí của chuyến tàu. Nháp và bị từ chối thì sửa được; chờ duyệt và hiệu lực thì khoá.", không có nút tạo (tạo từ chuyến). Tabs: Tất cả, Chờ duyệt, Nháp, Bị từ chối, Hiệu lực, Hết hạn. Ô tìm "Tìm số hợp đồng, thuyền viên", lọc chủ tàu và chuyến. Cột: Số hợp đồng (mono) · Thuyền viên (phụ: vị trí) · Tàu (phụ: mã chuyến; ẩn dưới màn lớn) · Bắt đầu → kết thúc · Phải thu/tháng · Phải chi/tháng · Chênh lệch (đậm, "+250") · Trạng thái. Trạng thái rỗng: "Chưa có hợp đồng nào" / "Mở một chuyến tàu, bấm Tạo hợp đồng ở dòng vị trí còn trống." + nút "Xem chuyến tàu".

**Tạo / sửa hợp đồng** (`ContractFormPage`): không dùng `FormFrame` (màn này không có mục lục); dùng `ds-page` + CSS `sf-*` + `contracts.css`.
- Đầu trang: đường dẫn "Chuyến tàu > {mã chuyến} > Tạo hợp đồng"; tiêu đề "Tạo hợp đồng · {chức danh}"; mô tả "Hợp đồng tạo ra ở dạng nháp. Tạo xong mở hợp đồng và bấm Xin duyệt; duyệt xong mới có hiệu lực." Sửa: "Sửa hợp đồng {số}".
- Khối "Thông tin chung" (mô tả "{tàu} · {chủ tàu} · chuyến {mã}"): Thuyền viên* (`Select` tìm theo tên, mã, số hộ chiếu qua API danh sách thuyền viên đang có; mỗi lựa chọn hiện tên · mã; gợi ý dưới ô là badge trạng thái thuyền viên), Vị trí* (chỉ đọc khi tạo từ vị trí, gợi ý "Dòng {n} của chuyến"), Ngày bắt đầu* (mặc định ngày xuống tàu dự kiến, gợi ý "Mặc định: xuống tàu dự kiến"), Ngày kết thúc* (mặc định ngày rời tàu dự kiến, gợi ý "{n} tháng"), Ghi chú.
- `DealTable`: một bảng kẻ ô, 3 cột: "Khoản" (24%) · "Phải thu" + tên chủ tàu (38%) · "Phải chi" + tên thuyền viên (38%); nhãn "Phải thu"/"Phải chi" là thẻ nhỏ cùng dòng với tên, không giải thích thêm. Nhóm "Hằng tháng · USD/tháng" rồi "Một lần · USD", mỗi nhóm 6 dòng mặc định + dòng tự đặt tên + nút "Thêm khoản hằng tháng"/"Thêm khoản một lần". Ô tiền là `InputNumber` canh phải, chỗ giữ chỗ "0,00", để trống được, không disable ô nào. Chân bảng: "Tổng mỗi tháng" và "Tổng một lần" cho từng bên.
- `TermsTable`: cùng kiểu kẻ ô và cùng đầu cột; một nhóm "Kỳ thanh toán · chốt sổ, ngày trả tiền"; 3 dòng: Ngày chốt sổ, Ngày thanh toán (dropdown chia 3 nhóm như mục 1.7), Gặp ngày nghỉ (dòng phụ dưới nhãn "Ngày nghỉ, lễ của ngân hàng"); mỗi ô một `Select`.
- `BalanceBar` dính đáy, **cao bằng thanh lưu của các form khác**, một hàng: khối nền xanh nhạt "Budget dự kiến/tháng" số to (title = tổng chuyến) · ba số "Phải thu/tháng", "Phải chi/tháng", "Chênh lệch/tháng" mỗi số có dấu ✓ xanh hoặc dấu cảnh báo theo mục 1.5 (title giải thích: "Bằng budget", "87% budget", "Vượt budget 120"…) · nút "Huỷ" và nút chính "Tạo hợp đồng" / "Lưu thay đổi". Màn hẹp thì xuống hàng như wireframe.
- Tạo xong sang chi tiết hợp đồng. Sửa: nút "Lưu thay đổi" khoá khi chưa đổi gì. Mở trang sửa của hợp đồng đang khoá thì chuyển về trang chi tiết kèm toast lỗi.

**Chi tiết hợp đồng** (`ContractDetailPage`):
- Đầu trang: đường dẫn "Hợp đồng > {số}"; tiêu đề "{số} · {tên thuyền viên}"; dòng phụ "{chức danh} · {tàu} · chuyến {mã}" (mã chuyến là link); badge `contract`. Nút theo bảng mục 1.2; "In hợp đồng" kèm chip nhỏ "Chưa chạy", bấm thì `toast.info('Chưa có mẫu hợp đồng MLC. Nút này để nhắc, chưa in được.')`.
- Banner theo trạng thái: Chờ duyệt (vàng, icon khoá) "{người} xin duyệt lúc {thời điểm}" / "Nội dung khoá cho tới khi được duyệt hoặc từ chối. Cần sửa thì bấm Thôi xin duyệt, hợp đồng về Nháp."; Bị từ chối (đỏ) "{người} từ chối lúc {thời điểm}" / "Lý do: {lý do}"; Hiệu lực (trung tính, icon check xanh) "Hiệu lực từ {bắt đầu} đến {kết thúc}" / "{người} duyệt lúc {thời điểm}. Nội dung không sửa được nữa."
- Cột trái: khối "Thông tin chung" chỉ đọc (Thuyền viên, Vị trí, Ngày bắt đầu, Ngày kết thúc · {n} tháng, Ghi chú, Chuyến = mã + badge `voyage`, Trạng thái thuyền viên = badge `crew`) với thẻ "Đã khoá" khi khoá; `DealTable` chỉ đọc (ô trống hiện "—"); `TermsTable` chỉ đọc.
- Cột phải (dính khi cuộn, màn ≥1100px): `BalanceCard` "Cân đối" (budget nổi bật trên nền xanh nhạt + 3 dòng có dấu ✓ như mục 1.5) và "Lịch sử duyệt" (mới nhất trên: Tạo hợp đồng, Xin duyệt, Thôi xin duyệt, Từ chối kèm lý do, Duyệt · có hiệu lực; mỗi mục có người làm và thời điểm).
- `RejectModal`: "Từ chối hợp đồng {số}?" / "Hợp đồng về trạng thái Bị từ chối. Người tạo thấy lý do, sửa và xin duyệt lại." Ô "Lý do từ chối"* textarea, gợi ý "Ghi rõ cần sửa gì để người tạo sửa đúng." Nút "Huỷ", "Từ chối hợp đồng" (kiểu danger).
- `ApproveModal`: "Duyệt hợp đồng {số}?" / "Hợp đồng chuyển sang Hiệu lực và khoá nội dung." Chuyến `ONBOARD`: `Banner` trung tính "Chuyến {mã} đang trên tàu từ {ngày}" / "{tên} đang ở trạng thái Ở bờ vì lúc bắt đầu chuyến hợp đồng chưa hiệu lực." + `ToggleRow` label "Chuyển {tên} sang Đang trên tàu", hint "Tắt nếu người này chưa lên tàu, trạng thái giữ Ở bờ.", mặc định bật. Chuyến khác: một đoạn chữ nền xám "Chuyến {mã} chưa bắt đầu. {tên} sẽ chuyển sang Đang trên tàu khi bấm Bắt đầu chuyến." (chuyến `ENDED` thì "Chuyến {mã} đã kết thúc."). Nút "Huỷ", "Duyệt hợp đồng".
- Xin duyệt, Thôi xin duyệt: không hỏi lại, bấm là làm, toast kết quả.

---

## 6. Thay chỗ đang dùng hợp đồng cũ

Các chỗ dưới đây đang đọc bảng `employment_contract` hoặc API `/employment-contracts`. Sau bước 14 không còn chỗ nào đọc bảng đó (trừ script chuyển dữ liệu). Kiểm bằng `grep -rn "employment_contract\|employment-contracts\|contractApi" backend/src frontend/src`.

| File | Đang làm | Đổi thành |
|---|---|---|
| `backend/src/utils/crew_overview.js` | `activeContract()` lấy tàu và ngày hết hạn từ `employment_contract` | Lấy từ `seafarer_contract` `ACTIVE` mới nhất của thuyền viên, join `voyage_position` → `voyage` → `vessel`; `contract_end` = `end_date` |
| `backend/src/services/fleet.service.js` (dòng ~165, ~173) | Đếm hợp đồng cũ để chặn xoá tàu / đối tác | Đếm `voyage` chưa xoá theo `vessel_id` / `ship_owner_id`. Sửa test `fleet.test.js` tương ứng |
| `backend/src/services/seafarer_portal.service.js` `getContracts` | Hợp đồng cũ của thuyền viên đăng nhập | `seafarer_contract` (trừ `DRAFT`, `REJECTED`) + tàu, chức danh, ngày; giữ tên trường mà `frontend/src/pages/seafarer/HistoryPage.jsx` đang đọc, hoặc sửa trang đó cho khớp |
| `backend/src/jobs.js` | Job 2 | Mục 4.4 |
| `backend/src/routes/v1/employment_contract.routes.js`, `backend/src/services/employment_contract.service.js`, dòng đăng ký trong `routes/v1/index.js` | API cũ | Xoá |
| `frontend/src/api/index.js` `contractApi` | Gọi API cũ | Xoá |
| `frontend/src/pages/admin/SeafarerDetailPage.jsx` `ContractsSection` (dòng ~522–756) và query `contractApi.list` (dòng ~150) | Khối Hợp đồng cũ có thêm/sửa/xoá | Bỏ khối cũ. Thay bằng khối chỉ đọc "Hợp đồng" liệt kê `GET /contracts?seafarer_id=` (số hợp đồng là link, tàu · chuyến, ngày, badge trạng thái), trống thì "Chưa có hợp đồng. Hợp đồng tạo từ chuyến tàu." |
| `SeafarerDetailPage.jsx` dòng ~197–272 (`contractList`, `readinessRules`, `headLine(activeContract(...))`) | Dùng hợp đồng cũ cho dòng phụ đầu trang và quy tắc sẵn sàng của bộ giấy | Đọc `activeContract`, `headLine` trong `seafarers/profileView.js` và `readinessRules` / `overlappingContracts` trong `exports/packModel.js`; viết một hàm đổi hợp đồng mới về đúng dạng các hàm đó đang cần (tên tàu, ngày bắt đầu, ngày kết thúc, trạng thái) rồi truyền vào; giữ nguyên các hàm đó và test của chúng |

---

## 7. Các bước

### Bước 0 — Chuẩn bị

1. `cd` vào thư mục `seasmart`. Chạy `git status` và `git branch --show-current`.
2. ⛔ **DỪNG** nếu có thay đổi chưa commit: báo người dùng danh sách file và hỏi tạo nhánh mới từ nhánh nào. Chỉ khi cây sạch mới tự tạo nhánh `feature/chuyen-tau-hop-dong` từ nhánh hiện tại.
3. Đọc: `CLAUDE.md`; `backend/src/routes/v1/fleet.routes.js`; `backend/src/services/fleet.service.js`; `backend/src/services/__tests__/fleet.test.js`; `backend/src/utils/postgres_query.js`; `backend/src/utils/transaction.js`; `frontend/src/pages/admin/fleet/` (cả thư mục); `frontend/src/components/ds/` (`Controls.jsx`, `statusMap.js`, `StatusBadge.jsx`, `ToggleRow.jsx`, `Banner.jsx`, `useToast.jsx`, `ds.css`); `frontend/src/pages/admin/seafarers/SeafarerForm.css`.
4. Chạy `cd backend && npm run lint && npm test` và `cd frontend && npm run lint && npm test` để biết mốc ban đầu. Ghi số test qua vào Nhật ký. Có test đỏ sẵn thì ghi lại, không sửa.

**Xong khi:** đang ở nhánh mới, đã ghi mốc test.

### Bước 1 — Migration

1. Tạo `backend/migrations/postgres/005_voyage_contract.sql` đúng mục 3.1.
2. Chạy `cd backend && npm run migrate` trên DB dev (đọc `backend/.env` hoặc `README.md` để biết DB nào). Kiểm bằng `psql` các bảng mới và ràng buộc.
3. Nếu migration dừng vì `contract_payroll` có dữ liệu: ⛔ **DỪNG**, báo số dòng, hỏi người dùng.

**Xong khi:** migrate chạy qua, chạy lại lần hai không làm gì; commit.

### Bước 2 — Hằng số, hàm tính, cấp mã (backend)

1. `backend/src/constants/voyage_contract.js` (mục 3.2).
2. `backend/src/utils/voyage_math.js`: `monthsBetween(start, end)`, `splitBudget({ total, monthly, months })`, `contractBalance({ items, budgetMonthly, contractMonths })` trả `{ budgetMonthly, receivableMonthly, payableMonthly, diffMonthly, receivableOnce, payableOnce, diffOnce, diffContract, receivableOk, payableOk, diffOk }`, `dueFlag({ status, plannedEmbark, today })`, `displayStatus({ status, positionsTotal, positionsFilled })`. Hàm thuần, không đọc DB, không đọc giờ máy (nhận `today`).
3. `backend/src/utils/code_counter.js` (mục 4.3).
4. Test `backend/src/utils/__tests__/voyage_math.test.js`: các ví dụ mục 1.5; `dueFlag` đúng ở các mốc còn 4 ngày (null), còn 3 ngày (SOON 3), hôm nay (SOON 0), quá 1 ngày (LATE 1), `ONBOARD` (null); `displayStatus` cho 0 vị trí, thiếu, đủ, `ONBOARD`, `ENDED`; `contractBalance` cho ví dụ của wireframe (budget 1.900; thu 1.150+345+230+75+100 = 1.900 ✓; chi 1.050+315+210+75 = 1.650 ✓; chênh lệch 250 ✓; 9 tháng → 2.250) và cho một ca vượt budget.

**Xong khi:** `npm run lint && npm test` ở backend qua; commit.

### Bước 3 — API chuyến tàu

1. `voyage.service.js` và `voyage.routes.js` theo mục 4.1; đăng ký ở `routes/v1/index.js`.
2. Viết theo kiểu `fleet.service.js`: hằng số cột cho phép + `pickAllowed`, `paging`, câu SELECT chung, lỗi `{ statusCode, message }` tiếng Việt, ghi nhiều bảng thì dùng `withTransaction`.
3. Test `backend/src/services/__tests__/voyage.test.js` với pool giả kiểu `fleet.test.js`: tạo chuyến cấp mã và ghi vị trí; sửa chuyến xoá vị trí có hợp đồng → 409; ngày thực tế gửi khi `PLANNING` → 400; `start` khi không phải `PLANNING` → 409; `start` chỉ đổi trạng thái người có hợp đồng `ACTIVE` và trả đúng `moved`/`skipped`; `end` kiểm ngày rời ≥ ngày xuống; xoá chuyến có hợp đồng → 409.
4. Gọi thử bằng `curl` với token thật của người dùng dev **nếu người dùng đã đưa sẵn cách đăng nhập**; không tự tạo tài khoản hay token. Không có thì chỉ dựa vào test.

**Xong khi:** lint, test qua; commit.

### Bước 4 — API hợp đồng

1. `seafarer_contract.service.js` và `seafarer_contract.routes.js` theo mục 4.2; đăng ký ở `routes/v1/index.js`.
2. Test `backend/src/services/__tests__/seafarer_contract.test.js`: tạo hợp đồng tự thêm đủ 12 khoản mặc định và 2 bộ kỳ thanh toán; vị trí đã có hợp đồng → 409; trùng thời gian cùng thuyền viên → 409; sửa hợp đồng `PENDING`/`ACTIVE` → 409; đủ các đường chuyển trạng thái hợp lệ và một ca sai cho mỗi thao tác; từ chối không lý do → 400; duyệt với `move_onboard` khi chuyến `ONBOARD` thì đổi `seafarer.status`, khi chuyến `PLANNING` thì không; mỗi thao tác ghi đúng một dòng log.

**Xong khi:** lint, test qua; commit.

### Bước 5 — Job

Sửa `backend/src/jobs.js` theo mục 4.4. **Xong khi:** lint qua; commit.

### Bước 6 — Nền frontend

1. `frontend/src/constants/voyageContract.js`, `api/voyageApi.js`, `hooks/useVoyages.js`.
2. `statusMap.js` (mục 5.3); `useToast` thêm `info`.
3. `navConfig.js`, icon trong `AdminLayout.jsx`, route trong `App.jsx` (mục 5.2). Trang chưa có thì tạm tạo file trang trả về `null` để build không vỡ; các bước sau thay nội dung.
4. `pages/admin/voyages/voyageView.js`, `pages/admin/contracts/contractView.js` và test của chúng (cùng bộ ví dụ với bước 2; thêm test `payOptions` ra đúng 21 lựa chọn với nhãn mục 1.7, `crewMoves` tách đúng người chuyển và người bị bỏ qua).
5. Sửa `navConfig.test.js`.

**Xong khi:** `npm run lint && npm test && npm run build` ở frontend qua; commit.

### Bước 7 — Danh sách chuyến

`VoyageListPage.jsx` (mục 5.5). So với wireframe `ds-chuyen` ở các trạng thái `du-lieu`, `rong`, `dang-tai`.
**Xong khi:** lint, build qua; chụp màn hình trang thật (mục 8) đặt cạnh wireframe, khớp bố cục và chữ; commit.

### Bước 8 — Form chuyến

`VoyageFormPage.jsx` (mục 5.5). So với `tao-chuyen` ở `du-lieu`, `moi`, `loi-nhap`, `sua`.
**Xong khi:** tạo được chuyến 7 vị trí, sửa được; budget hai ô tự tính hai chiều; đổi ngày tính lại mỗi tháng; "Lưu & tạo chuyến khác" về form trống; sửa chưa đổi gì thì nút khoá; commit.

### Bước 9 — Chi tiết chuyến và Bắt đầu / Kết thúc

`VoyageDetailPage.jsx`, `VoyageTransitionModal.jsx` (mục 5.5). So với `chuyen` ở mọi trạng thái.
**Xong khi:** đi được hết vòng: chuyến Đang tuyển → đủ hợp đồng thì Đủ người → bấm Bắt đầu (thấy đúng danh sách chuyển và danh sách bị bỏ qua) → Đang trên tàu, hồ sơ thuyền viên hiện "Đang trên tàu" → bấm Kết thúc → Đã kết thúc, hồ sơ hiện "Ở bờ". Chuyến có ngày dự kiến đã qua hiện nhãn và banner trễ ngày. Commit.

### Bước 10 — Form hợp đồng

`ContractFormPage.jsx`, `DealTable.jsx`, `TermsTable.jsx`, `BalanceBar.jsx` (mục 5.5). So với `hop-dong` ở `moi`, `menu`, `am`, `loi-nhap`.
**Xong khi:** tạo được hợp đồng từ nút "Tạo hợp đồng" của một vị trí; thanh dưới tính đúng và đổi dấu ✓ / cảnh báo ngay khi gõ; thêm và xoá được khoản tự đặt tên; dropdown ngày thanh toán chia 3 nhóm; commit.

### Bước 11 — Chi tiết hợp đồng, duyệt

`ContractDetailPage.jsx`, `BalanceCard.jsx`, `ApproveModal.jsx`, `RejectModal.jsx` (mục 5.5). So với `hd-chi-tiet` ở mọi trạng thái.
**Xong khi:** đi được: Nháp → Xin duyệt → Thôi xin duyệt → Xin duyệt → Từ chối (lý do hiện ở banner và lịch sử) → Sửa → Xin duyệt lại → Duyệt. Duyệt hợp đồng của chuyến đang trên tàu: toggle bật thì thuyền viên thành Đang trên tàu, tắt thì giữ Ở bờ. Nút In hợp đồng hiện toast. Trang sửa của hợp đồng đang khoá chuyển về chi tiết. Commit.

### Bước 12 — Danh sách hợp đồng

`ContractListPage.jsx` (mục 5.5). So với `ds-hop-dong`.
**Xong khi:** tab, tìm, lọc chủ tàu và chuyến chạy; commit.

### Bước 13 — Trạng thái thuyền viên trên hồ sơ

1. ⛔ **DỪNG** trước khi sửa: chạy `SELECT status, COUNT(*) FROM seafarer WHERE deleted_at IS NULL GROUP BY status` trên DB dev, báo kết quả cho người dùng và hỏi: bỏ ô chọn trạng thái trên form thuyền viên thì các giá trị khác `ON_VESSEL` / `AVAILABLE` (ví dụ `BLACKLISTED`, `RETIRED`) xử lý thế nào (giữ nguyên trong DB, hay đổi về `AVAILABLE`). Làm theo câu trả lời.
2. `frontend/src/pages/admin/SeafarerFormPage.jsx`: bỏ ô "Trạng thái" (`STATUS_OPTIONS`) và trường `status` khỏi giá trị gửi đi khi sửa (khi tạo mới, backend tự đặt `AVAILABLE`). Kiểm `backend/src/services/seafarer.service.js` không còn nhận `status` từ form (bỏ khỏi danh sách cột cho phép nếu có), trừ khi câu trả lời ở ý 1 yêu cầu khác.
3. Nhãn: mục 5.3.

**Xong khi:** form thuyền viên không còn ô trạng thái; hồ sơ hiện "Đang trên tàu" / "Ở bờ"; lint, test hai phía qua; commit.

### Bước 14 — Thay chỗ dùng hợp đồng cũ

Làm từng dòng của bảng mục 6. Chạy lại lệnh `grep` ở mục 6.
**Xong khi:** `grep` chỉ còn ra file script chuyển dữ liệu (bước 15) và migration cũ; trang thuyền viên, trang tàu, trang đối tác, cổng thuyền viên (`/portal` lịch sử) vẫn mở được, không lỗi console; lint, test hai phía qua; commit.

### Bước 15 — Chuyển dữ liệu hợp đồng cũ

1. Viết `backend/scripts/migrate_employment_contracts.js`, chạy bằng `node scripts/migrate_employment_contracts.js [--apply]`. Không có `--apply` thì chỉ đọc và in báo cáo (dry run), không ghi gì.
2. Mỗi dòng `employment_contract` chưa xoá → một chuyến + một vị trí + một hợp đồng, trong một transaction cho mỗi dòng:
   - Chuyến: `vessel_id`, `ship_owner_id` lấy từ hợp đồng cũ; ngày dự kiến = `start_date` → `end_date` (thiếu `end_date` thì `start_date + duration_months`, thiếu cả hai thì bỏ qua dòng và ghi vào báo cáo); `embark_port_id` = `sign_on_port_id`, `disembark_port_id` = `sign_off_port_id`. Trạng thái: hợp đồng cũ đã kết thúc (`actual_end_date` có, hoặc `end_date` < hôm nay) → `ENDED` với ngày thực tế = `start_date` → `COALESCE(actual_end_date, end_date)`; còn lại mà `start_date` ≤ hôm nay → `ONBOARD` với ngày xuống thực tế = `start_date`; còn lại → `PLANNING`. Thiếu cảng mà ràng buộc yêu cầu (chuyến `ONBOARD`/`ENDED`) thì bỏ qua dòng và ghi báo cáo.
   - Vị trí: `rank_id` của hợp đồng cũ; budget tổng chuyến và mỗi tháng = 0.
   - Hợp đồng: số mới cấp theo mục 4.3; ngày = ngày hợp đồng cũ; `notes` = ghi chú cũ + " (chuyển từ hợp đồng {contract_number cũ})"; trạng thái `ENDED` nếu chuyến `ENDED`, còn lại `DRAFT`; 12 khoản mặc định, `BASIC_WAGE.payable_usd` = `basic_wage_usd` cũ (`overtime_rate_usd` là đơn giá giờ, không chuyển; ghi vào `notes` nếu có), `LEAVE_PAY.payable_usd` = `leave_pay_usd`, `SERVICE_FEE.receivable_usd` = `agency_fee_usd`, `VISA_FEE` / `MEDICAL` / `TRAINING` `.receivable_usd` = các phí tương ứng; kỳ thanh toán mặc định; log `CREATE`.
   - Bỏ qua dòng đã chuyển rồi (dò theo chuỗi "chuyển từ hợp đồng {số cũ}" trong `notes`) để chạy lại không tạo trùng.
3. Báo cáo in ra: số dòng cũ, số sẽ chuyển theo từng trạng thái, danh sách dòng bỏ qua kèm lý do.
4. Chạy dry run trên DB dev. ⛔ **DỪNG**: gửi báo cáo cho người dùng, hỏi có chạy `--apply` không. Chỉ chạy khi được đồng ý.
5. Khối Công tác trên hồ sơ (`seafarer.vessel_name_raw`, `contract_*`): **không** chuyển trong giai đoạn này (mục 2.2).

**Xong khi:** người dùng đã quyết; nếu đã `--apply` thì số hợp đồng mới khớp báo cáo; commit script.

### Bước 16 — Kiểm cuối

1. Backend: `npm run lint && npm test`. Frontend: `npm run lint && npm test && npm run build`. Số test qua ≥ mốc ở bước 0 cộng test mới.
2. Đi lại toàn bộ danh sách mục 8 trên app chạy thật, chụp màn hình từng màn ở desktop 1440px và mobile 390px, so với wireframe.
3. Rà `CLAUDE.md` mục 7 (Review Checklist) cho mọi file đã sửa.
4. Ghi Nhật ký: những gì đã làm, chỗ nào khác kế hoạch và vì sao, việc còn mở.
5. Báo người dùng: tóm tắt, danh sách commit, ảnh chụp các màn chính, việc còn mở. **Không** push, không tạo PR khi chưa được bảo.

---

## 8. Kiểm tra trên app thật

Chạy `cd backend && npm run dev` và `cd frontend && npm run dev`. Đăng nhập bằng tài khoản dev mà người dùng cung cấp (README hoặc hỏi người dùng); không tự tạo tài khoản. Nếu không có cách đăng nhập: ⛔ **DỪNG** và hỏi.

Danh sách đi:

1. Tạo chuyến MV bất kỳ, 3 vị trí (Master, Oiler, AB), ngày xuống tàu dự kiến = hôm nay − 2 ngày. Danh sách chuyến: tab Đang tuyển, nhãn đỏ "Quá 2 ngày chưa bắt đầu".
2. Tạo hợp đồng cho cả 3 vị trí: một cái duyệt tới Hiệu lực, một cái để Chờ duyệt, một cái để Nháp. Chuyến thành Đủ người.
3. Bắt đầu chuyến: hộp thoại liệt kê 1 người chuyển, 2 người bị bỏ qua. Lưu. Hồ sơ người đã duyệt hiện Đang trên tàu; hai người kia Ở bờ. Banner "2 hợp đồng chưa hiệu lực".
4. Duyệt hợp đồng đang Chờ duyệt, để toggle bật → người đó Đang trên tàu. Xin duyệt và duyệt hợp đồng Nháp, tắt toggle → người đó vẫn Ở bờ.
5. Kết thúc chuyến: ngày rời < ngày xuống thì báo lỗi; đúng thì chuyến Đã kết thúc, những người Đang trên tàu (có hợp đồng Hiệu lực) về Ở bờ.
6. Sửa chuyến đã kết thúc: thấy và sửa được ngày thực tế.
7. Danh sách hợp đồng: các tab đếm đúng.
8. Thử sửa hợp đồng Hiệu lực qua đường dẫn `/contracts/{id}/edit` → bị đưa về trang chi tiết.
9. Trang thuyền viên, tàu, đối tác, bản xuất vẫn chạy.

---

## 9. Việc còn mở (không làm, chỉ để biết)

- Mẫu hợp đồng MLC song ngữ: người dùng gửi khi làm phần in hợp đồng.
- Giai đoạn 2 Tiền lương, giai đoạn 3 Mở rộng hợp đồng (một người rời tàu sớm, phụ lục gia hạn, sinh lịch sử đi tàu, bộ giấy từ chuyến, bỏ khối Công tác), giai đoạn 4 Công việc.
- Phân quyền duyệt: làm khi làm lại quản trị và vai trò người dùng.

---

## 10. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-10-19 | — | — | Lập kế hoạch. Wireframe bản 13 chép vào `docs/design/wireframes/chuyen-tau-hop-dong.html`. |
| 2026-10-19 | 0 | (commit này) | Tạo nhánh `feature/chuyen-tau-hop-dong` từ `feature/seafarer-form-redesign` (cây sạch). Mốc: backend lint 0 lỗi/14 cảnh báo, test 148 qua/17 bỏ qua; frontend lint 0 lỗi/1 cảnh báo, test 89 qua. Không có test đỏ. Lưu ý: `wrapConnection` trả INSERT dạng `[{ insertId, rows }]`, nên `nextCode` ở bước 2 đọc `res.rows[0].last_value`, không destructure `[[row]]`. |
| 2026-10-19 | 1 | (commit này) | Thêm `005_voyage_contract.sql`, migrate chạy qua trên DB dev, chạy lần hai không làm gì; 7 bảng mới có mặt, `contract_payroll` (0 dòng) đã xoá. Khác kế hoạch: bỏ dòng `DELETE FROM contract_payroll` trong `scripts/seed_demo_synthetic.sql` vì bảng không còn. Script seed chưa xoá các bảng mới (chuyến, hợp đồng) — việc còn mở nếu cần chạy lại seed khi đã có dữ liệu chuyến. |
| 2026-10-19 | 2 | (commit này) | Thêm `constants/voyage_contract.js`, `utils/voyage_math.js`, `utils/code_counter.js` + test (157 qua trên toàn backend). `voyage_math` tự cộng tháng bằng `Date.UTC` thay vì dayjs vì dayjs không có trong `package.json` backend; kết quả khớp quy tắc dayjs (31/01 + 1 tháng = 28/02). `nextCode` đọc `res.rows[0]` theo ghi chú bước 0. |
| 2026-10-19 | 3 | (commit này) | Thêm `voyage.service.js`, `voyage.routes.js` (đăng ký `/voyages`), test `voyage.test.js` (10 test; toàn backend 167 qua). Export thêm `paging` từ `fleet.service.js`. Danh sách lấy hết chuyến khớp tìm kiếm rồi lọc tab/phân trang trong JS vì `display_status` tính bằng hàm thuần. Chưa gọi bằng `curl` (người dùng chưa đưa cách đăng nhập); thay bằng chạy service thật trên DB dev trong một transaction rồi rollback (tạo → bắt đầu → kết thúc → sửa chạy đúng, DB không đổi). Dev DB hiện chưa có tàu hay chủ tàu nào — cần cho bước 8 trở đi. |
| 2026-10-19 | 4 | (commit này) | Thêm `seafarer_contract.service.js`, `seafarer_contract.routes.js` (đăng ký `/contracts`), test (11 test; toàn backend 177 qua). Chạy thật trên DB dev trong transaction rồi rollback: tạo → xin duyệt → từ chối → xin duyệt lại → duyệt, 12 khoản + 2 kỳ thanh toán, cân đối 2.250 đúng. Khác kế hoạch: **route đọc** của `/contracts` và `/voyages` cũng yêu cầu vai trò `admin`/`operator` (kế hoạch chỉ ghi `authenticate`), vì hợp đồng và budget chứa số phải thu nội bộ, mà vai trò `seafarer` cũng đăng nhập được; khớp cách API hợp đồng cũ đang làm. `TRANSITIONS` và `transition()` nằm trong service. Tên người làm ở lịch sử duyệt lấy từ `user.email` (bảng `user` không có tên). |
| 2026-10-19 | 5 | (commit này) | Thay Job 2 trong `jobs.js` bằng job 2:10 sáng chuyển hợp đồng `ACTIVE` quá `end_date` sang `ENDED`. Câu UPDATE chạy thử trên DB dev (0 dòng, không lỗi). Phát hiện ngoài bảng mục 6: job nhắc "hợp đồng sắp kết thúc" (~dòng 134 của `jobs.js`) cũng đọc `employment_contract` — xử lý ở bước 14. |
| 2026-10-19 | 6 | (commit này) | Frontend nền: `constants/voyageContract.js`, `api/voyageApi.js`, `hooks/useVoyages.js`, `voyageView.js`, `contractView.js` + test (frontend 105 qua, lint 0 lỗi, build qua), badge `voyage`/`contract`, nhãn `AVAILABLE` = "Ở bờ" (cả `SeafarerDetailPage`, `crewView`), `useToast.info`, mục điều hướng + icon + route, 6 trang tạm trả `null`. `frontend/src/pages/admin/SeafarerFormPage.jsx` còn nhãn cũ "Sẵn sàng"/"Đang tàu" ở ô chọn tay — bỏ cả ô ở bước 13. Hàm `dueLabel` thêm trường hợp 0 ngày: "Xuống tàu hôm nay" (kế hoạch chỉ nêu "Còn N ngày"). |
| 2026-10-19 | 7 | (commit này) | Thêm `VoyageListPage.jsx`, `VoyageParts.jsx` (`DueTag`, `FillBar`), `voyages.css`, `utils/format.js` (+test; frontend 108 qua, lint, build qua). Chụp trang thật ở 1440px và 390px, khớp wireframe `ds-chuyen` (tab, khung tìm, cột, nhãn trễ ngày, thanh vị trí, chân bảng). Chưa chụp riêng trạng thái rỗng / đang tải (có trong code, cùng mẫu `PartnerListPage`). **Cách chụp:** script CDP `shot.mjs` trong scratchpad, đăng nhập bằng nút "Nhập nhanh TK demo" có sẵn của trang đăng nhập dev. **Dữ liệu thử:** dev DB không có tàu/chủ tàu/thuyền viên nên tôi nạp tạm 7 chuyến + 13 thuyền viên (mã `SEED-…`, ghi chú `DEV-SEED`) bằng `seed_dev.js`; sẽ dọn bằng `unseed_dev.js` ở bước 16 (id lưu trong `seed_ids.json`, cùng thư mục scratchpad). |
| 2026-10-19 | 8 | (commit này) | Thêm `VoyageFormPage.jsx` (tạo + sửa), CSS bảng vị trí trong `voyages.css`, control dùng chung mới `components/ds/MoneyInput.jsx` (minh hoạ ở `/design-system`, mục "Ô nhập"), `utils/apiError.js`. Kiểm trên app thật bằng script CDP: gửi trống báo lỗi dưới ô; chọn tàu có chủ tàu thì tự điền + gợi ý "Lấy theo tàu"; tổng 88.200 ↔ mỗi tháng 9.800 hai chiều; đổi ngày rời giữ tổng và tính lại mỗi tháng (9.000 → 1.500 khi còn 6 tháng); nhân đôi/thêm/xoá dòng; tạo chuyến 7 vị trí (88.200 USD · 9.800 USD/tháng); "Lưu & tạo chuyến khác" về form trống; sửa chưa đổi gì thì nút khoá, đổi thì mở và có chip "Đã sửa"; lưu sửa gọi PUT thành công; chuyến đã bắt đầu có 2 ô ngày thực tế; vị trí đã có hợp đồng không xoá được. Bắt được và sửa lỗi: `id`/`hasContract` của vị trí không có ô nhập nên `useWatch` làm rơi → phải đăng ký hai `Form.Item` ẩn. Khác kế hoạch: ô chọn tàu dùng `vesselApi.list` (có `ship_owner_id`) thay vì `lookupApi.vessels` (chỉ trả id và tên, không tự điền được chủ tàu). Chưa chụp riêng trạng thái `loi-nhap`/mobile của form (đã xem lỗi dưới ô ở ảnh chụp). |
| 2026-10-19 | 9 | (commit này) | Thêm `VoyageDetailPage.jsx`, `VoyageTransitionModal.jsx` + CSS. Chạy thật trên app (script CDP) vòng: chuyến Đủ người, quá hạn 4 ngày (nhãn đỏ + banner) → Bắt đầu (hộp thoại liệt kê 1 người chuyển, 2 người bị bỏ qua) → Đang trên tàu (DB: người hiệu lực `ON_VESSEL`, hai người kia `AVAILABLE`; banner "2 hợp đồng chưa hiệu lực") → Kết thúc (ngày rời trước ngày xuống báo lỗi; đúng thì `ENDED`, người đó về `AVAILABLE`). Hồ sơ thuyền viên và danh sách thuyền viên hiện "Đang trên tàu" / "Ở bờ". Ghi chú: nút "Mở hợp đồng"/"Tạo hợp đồng" trỏ tới trang của bước 10–11 (đang trống); trang "Tạo bộ giấy" của hồ sơ thuyền viên không đụng. Chưa chụp trạng thái rỗng/đang tải/mobile của chi tiết chuyến. |
| 2026-10-19 | 10 | (commit này) | Thêm `ContractFormPage.jsx` (tạo + sửa), `DealTable.jsx`, `TermsTable.jsx`, `BalanceBar.jsx`, `contracts.css`; `contractView.js` thêm `balanceNotes` (+test; frontend 109 qua). Kiểm trên app thật bằng script CDP: tạo từ nút "Tạo hợp đồng" của một vị trí; trống thì báo "Chọn thuyền viên"; ngày mặc định theo chuyến (10/01/2027 → 10/10/2027, 9 tháng); thanh cân đối đổi số và dấu ✓/⚠ ngay khi gõ (thu 3.500 > budget 3.400 → ⚠ vàng, title "Vượt budget 100"); thêm/xoá khoản hằng tháng tự đặt tên; dropdown ngày thanh toán có nhóm "Tháng sau…"; tạo xong sang `/contracts/:id` (số HĐ-2026-0014). Khác kế hoạch: (1) URL tạo hợp đồng có thêm `voyageId` — `/contracts/new?positionId=…&voyageId=…` — vì backend không có API tra vị trí → chuyến; thiếu `voyageId` thì hiện hướng dẫn mở từ chuyến tàu. (2) Màn tạo hợp đồng chỉ có "Huỷ" và "Tạo hợp đồng", không có "Lưu & tạo hợp đồng khác" (kế hoạch mục 5.5 không có và mỗi hợp đồng gắn một vị trí). Chưa chụp riêng trạng thái `loi-nhap`/mobile; trang sửa sẽ kiểm ở bước 11. |
| 2026-10-19 | 11 | (commit này) | Thêm `ContractDetailPage.jsx`, `BalanceCard.jsx`, `ApproveModal.jsx`, `RejectModal.jsx`; mở rộng nhẹ hai control ds: `Banner` có prop `icon`, `AuditTimeline` thêm kiểu `reject` và `withdraw`; `utils/format.js` thêm `formatDateTime` (+test; frontend 110 qua). Chạy thật trên app (script CDP, DB đối chiếu): Nháp → Xin duyệt → Thôi xin duyệt → Xin duyệt → Từ chối (không lý do báo "Ghi lý do từ chối"; có lý do thì hiện ở banner đỏ và lịch sử) → Sửa (nút lưu khoá khi chưa đổi, mở khi đổi) → Xin duyệt lại → Duyệt (chuyến chưa bắt đầu: chỉ có đoạn chữ, không toggle) → Hiệu lực. Chuyến đang trên tàu: toggle mặc định bật; tắt thì hợp đồng `ACTIVE`, thuyền viên vẫn `AVAILABLE`; bật thì thuyền viên `ON_VESSEL` và toast ghi rõ. Nút "In hợp đồng" hiện toast thông tin; mở `/contracts/:id/edit` của hợp đồng hiệu lực bị đưa về trang chi tiết kèm toast lỗi. Tên người làm hiện email (bảng `user` không có tên). |
| 2026-10-19 | 12 | (commit này) | Thêm `ContractListPage.jsx`. Chạy thật: số đếm các tab khớp (15 = 1 chờ duyệt + 1 nháp + 1 bị từ chối + 12 hiệu lực), đổi tab, tìm theo tên, lọc chủ tàu (số đếm tab đổi theo bộ lọc: 6), lọc thêm chuyến (4 hợp đồng của CT-2026-005), tìm không ra thì hiện "Không có hợp đồng nào khớp bộ lọc". Cột "Tàu" chỉ hiện từ màn xl trở lên theo kế hoạch ("ẩn dưới màn lớn"). Chưa chụp mobile/trạng thái rỗng. |
