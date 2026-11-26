# Catoro — Kế hoạch Khoản tiền cố định và Trả lương thuyền viên

- **Ngày lập:** 2026-11-20
- **Trạng thái:** đã dựng phần A và B (2026-11-20), chờ chạy tay testcase.
- **Mục tiêu:**
  1. **Khoản tiền cố định** (phần A): hợp đồng, yêu cầu thanh toán (bill) và bảng trả lương dùng chung **một danh sách 14 khoản cố định**. Bỏ khoản tự đặt tên ở hợp đồng và dòng điều chỉnh ở bill. Luôn hiện đủ 14 khoản, khoản không có là 0.
  2. **Trả lương thuyền viên** (phần B): ghi nhận đã trả lương thuyền viên cho từng bill phải thu, theo tháng, để thống kê và đối chiếu. Catoro chưa chuyển tiền trong hệ thống: người dùng trả ngoài rồi bấm **Chốt** để ghi nhận.
- **Wireframe:** `docs/design/wireframes/tra-luong.html`. **Testcase:** `docs/catoro-testcase-tra-luong.md`. **Hướng dẫn (bản nháp):** `docs/catoro-huong-dan-tra-luong.html`.
- **Tham khảo:** màn 請求・支払一覧 (ảnh người dùng gửi): lọc theo tháng, mỗi bill hai dòng (請求 / 支払), dòng dưới sửa được, chọn nhiều dòng để xử lý một lần.
- **Nhánh:** `dev`. Làm phần A trước, phần B dựa trên phần A.

---

## 1. Quyết định đã chốt (2026-11-20)

| # | Quyết định |
|---|---|
| K1 | Bỏ tính năng **thêm khoản tự đặt tên** ở hợp đồng. Danh sách khoản cố định, thêm 2 khoản: **Khác (hằng tháng)** và **Khác (một lần)**. |
| K2 | Bill và bảng trả lương dùng **đúng 14 khoản cố định** đó. Bỏ hẳn **dòng điều chỉnh** của bill (không có khoản Điều chỉnh thay thế). Muốn trừ thì sửa thẳng số của khoản đó. **Không khoản nào được âm.** |
| K3 | **Không ẩn khoản trống** ở bất kỳ màn nào: hợp đồng, chi tiết / sửa bill, bảng trả lương đều hiện đủ 14 khoản; không có số thì hiện 0. |
| Q1 | Bảng trả lương: mỗi dòng = **một bill phải thu** (một kỳ của một hợp đồng) = một thuyền viên. Kỳ trả theo đúng kỳ bill. |
| Q2 | Dòng **Thu** = số đang dùng của bill, chỉ xem, đổi theo bill. |
| Q3 | Dòng **Trả** mặc định lấy **cột Phải chi của hợp đồng**, cùng quy tắc bill: khoản hằng tháng ở mọi kỳ (kỳ lẻ vẫn đủ tháng), khoản một lần ở kỳ 1, kỳ khác là 0. Cơ hội không có ô lương, không thêm. |
| Q4 | Dòng Trả sửa được từng khoản. Bấm **Chốt** = ghi nhận đã trả theo số đang hiện. **Ngày trả = ngày bấm chốt** (ngày server). |
| Q5 | **Không có cột Hoa hồng** (bỏ theo yêu cầu 2026-11-20). |
| Q6 | Chốt **lúc nào cũng được**, bất kể trạng thái bill. Trạng thái bill hiện cạnh dòng Thu để đối chiếu. |
| Q7 | Bảng hiện **14 khoản, mỗi khoản một cột** + Tổng. |
| Q8 | Có ô chọn nhiều dòng + nút **Chốt các dòng đã chọn** (máy tính). |
| Q9 | Lọc theo **tháng của ngày kết thúc kỳ** bill (ngày chốt sổ), như 対象月 / 締日 trong ảnh. |

## 2. Quy ước tự chọn (không hỏi, sửa được khi duyệt plan)

| # | Quy ước | Lý do |
|---|---|---|
| D1 | Số sửa ở bảng trả lương **chỉ lưu khi Chốt**; không có Lưu nháp. Rời trang / đổi tháng khi còn ô "Đã sửa" thì hỏi. | Người dùng chỉ nói tới nút chốt. |
| D2 | Có **Huỷ chốt** (về Chưa trả, giữ số đã chốt). Toast sau khi chốt có Hoàn tác. | Bấm nhầm phải sửa được; giống Huỷ ghi nhận thu. |
| D3 | Khi chốt, lưu **tổng bill lúc chốt**. Bill đổi tổng sau đó → chip vàng "Bill đổi sau khi chốt". Không chặn sửa bill. | Phục vụ "check" mà không khoá luồng bill. |
| D4 | Bill đã chốt trả lương bị **khoá với luồng sửa ngày / duyệt lại hợp đồng** như bill đã gửi / đã thu. | Không để mất bản ghi đã trả. |
| D5 | Hiện **Hạn trả** tính từ kỳ thanh toán Phải chi đang có của hợp đồng áp lên ngày kết thúc kỳ bill. Chỉ xem. | Dữ liệu đã có, chưa dùng ở đâu. |
| D6 | Mở trang: tab **Tất cả**, **chưa chọn tháng** (bảng trống), chọn tháng mới hiện dữ liệu (người dùng đổi 2026-11-20). Bảng chỉ còn thuyền viên + mã bill, đối tác, hạn thu / hạn trả; bỏ chức danh, tàu, kỳ. | Theo yêu cầu người dùng. |
| D6b | (2026-11-20) Không phân trang, đổ hết dòng của tháng. Chân bảng: **Thu đã duyệt** (bill khác Chưa duyệt) và **Đã trả** (dòng đã chốt). Thêm cột Người chốt / Thời gian chốt: dòng Thu là người và lúc duyệt bill, dòng Trả là người và lúc chốt trả lương. | Theo yêu cầu người dùng. |
| D7 | Chốt hàng loạt **tất cả hoặc không**. | Một transaction, dễ hiểu khi lỗi. |
| D8 | Không chốt hàng loạt trên điện thoại. | Bảng hai dòng 14 cột không vừa 375px. |
| D9 | Dữ liệu cũ: khoản tự đặt tên của hợp đồng **cộng dồn** vào Khác (hằng tháng / một lần) theo nhóm, tên cũ ghi vào ghi chú hợp đồng. Dòng điều chỉnh của bill **cộng vào Khác (hằng tháng)** của bill đó, tên cũ ghi vào ghi chú bill; tổng âm thì trừ phần thiếu vào Lương cơ bản, rồi tới các khoản khác theo thứ tự, và in danh sách bill bị đổi ở cuối migration. Tổng mỗi bill giữ nguyên. | Không mất tiền, không vi phạm "không âm". Web không có khách thật (Q7 app máy tính) nên ca âm hầu như không có. |

---

# Phần A — Khoản tiền cố định

## A1. Danh sách khoản (`constants/voyage_contract.js`, bản frontend giống hệt)

| # | Mã | Tên | Nhóm |
|---|---|---|---|
| 1 | `BASIC_WAGE` | Lương cơ bản | Hằng tháng |
| 2 | `FIXED_OVERTIME` | Làm thêm cố định | Hằng tháng |
| 3 | `LEAVE_PAY` | Lương phép | Hằng tháng |
| 4 | `ALLOWANCE` | Phụ cấp | Hằng tháng |
| 5 | `BONUS` | Thưởng | Hằng tháng |
| 6 | `SERVICE_FEE` | Phí dịch vụ | Hằng tháng |
| 7 | `OTHER_MONTHLY` | **Khác (hằng tháng)** — mới | Hằng tháng |
| 8 | `FLIGHT_OUT` | Vé máy bay đi | Một lần |
| 9 | `FLIGHT_BACK` | Vé máy bay về | Một lần |
| 10 | `VISA_FEE` | Phí visa | Một lần |
| 11 | `MEDICAL` | Khám sức khoẻ | Một lần |
| 12 | `TRAINING` | Huấn luyện/chứng chỉ | Một lần |
| 13 | `COMPLETION_BONUS` | Thưởng hoàn thành hợp đồng | Một lần |
| 14 | `OTHER_ONE_TIME` | **Khác (một lần)** — mới | Một lần |

Thứ tự này dùng cho mọi bảng (hợp đồng, bill, trả lương).

## A2. Dữ liệu — migration `050_fixed_money_items.sql`

```sql
-- 1. Hợp đồng: gộp khoản tự đặt tên vào OTHER_MONTHLY / OTHER_ONE_TIME, ghi tên cũ vào ghi chú, rồi bỏ cột custom_name.
--    (Cộng receivable_usd, payable_usd theo kind; NULL + NULL = NULL; tạo dòng OTHER_* cho mọi hợp đồng còn thiếu.)
-- 2. Bill: mọi bill (cả đã xoá mềm) có đủ 14 dòng; dòng thiếu thêm với amount_usd = default_usd = 0.
--    Dòng ADJUSTMENT cộng vào OTHER_MONTHLY của bill; tổng âm thì trừ vào khoản khác theo D9; tên cũ vào note; xoá dòng ADJUSTMENT.
ALTER TABLE "contract_item" DROP CONSTRAINT "contract_item_name_check";
ALTER TABLE "contract_item" DROP COLUMN "custom_name";
ALTER TABLE "contract_item" ALTER COLUMN "item_code" SET NOT NULL;
ALTER TABLE "contract_item" ADD CONSTRAINT "contract_item_code_check" CHECK ("item_code" IN (/* 14 mã */));

ALTER TABLE "contract_bill_item" DROP CONSTRAINT "contract_bill_item_kind_check";
ALTER TABLE "contract_bill_item" ADD CONSTRAINT "contract_bill_item_kind_check" CHECK ("kind" IN ('MONTHLY', 'ONE_TIME'));
ALTER TABLE "contract_bill_item" ALTER COLUMN "item_code" SET NOT NULL;
ALTER TABLE "contract_bill_item" ADD CONSTRAINT "contract_bill_item_amount_check" CHECK ("amount_usd" >= 0);
CREATE UNIQUE INDEX "contract_bill_item_code_uniq" ON "contract_bill_item" ("bill_id", "item_code");
```

- Cột `name` của `contract_bill_item` giữ lại (tên chụp lúc sinh), nhưng màn hình hiện tên theo mã.
- Migration in ra (RAISE NOTICE) số hợp đồng có khoản tự đặt tên đã gộp và danh sách bill có điều chỉnh âm đã trừ sang khoản khác.

## A3. Backend

| File | Việc |
|---|---|
| `constants/voyage_contract.js` | Thêm `OTHER_MONTHLY`, `OTHER_ONE_TIME` vào `DEFAULT_ITEMS` đúng thứ tự A1; bỏ `ADJUSTMENT` khỏi `BILL_ITEM_KINDS`. |
| `routes/v1/seafarer_contract.routes.js` | Schema `items`: bỏ `custom_name`, `item_code` bắt buộc, `additionalProperties: false`. |
| `services/seafarer_contract.service.js` | `parseItems`: chỉ nhận mã trong `DEFAULT_ITEMS`, không lặp; luôn trả đủ 14 dòng theo thứ tự (thiếu thì dòng trống). Bỏ nhánh khoản tự đặt tên, `MAX_ITEMS`. `get`: bỏ `custom_name`. |
| `services/contract_bill.service.js` | `loadGeneration`: **không lọc `amount > 0`**, lấy đủ 14 khoản (trống = 0). `insertBill`: mọi bill có đủ 14 dòng; khoản một lần lấy số hợp đồng ở bill 1, **0 ở các bill sau** (`default_usd = 0`). `update`: body `{ items: [{ item_code, amount_usd }] }`, chỉ đổi số, `amount_usd ≥ 0`; bỏ thêm / xoá dòng, `MAX_ADJUSTMENTS`, kiểm "tổng không âm". |
| `scripts/backfill_contract_bills.js` | Theo cách sinh mới. |
| Test | Sửa test hợp đồng, bill theo quy tắc mới; thêm ca: bill 2 có đủ khoản một lần với 0; gửi `custom_name` hoặc mã lạ → 400; số âm → 400. |

## A4. Frontend

| Màn | Việc |
|---|---|
| Form hợp đồng (`DealTable.jsx`, `contractView.js`) | Bỏ nút "Thêm khoản hằng tháng / một lần", ô tên tự đặt, nút xoá. Hai nhóm cố định 7 + 7 dòng. |
| Chi tiết hợp đồng (`DealView.jsx`) | Hiện đủ 14 khoản, trống là 0 (đã gần đúng; bỏ `nameOf` cho khoản tự đặt tên). |
| Sửa bill (`BillMoneyTable.jsx`, `billView.js`) | Bỏ nhóm Điều chỉnh, nút "Thêm dòng điều chỉnh", xoá dòng, `allowNegative`. Hai nhóm cố định 7 + 7 dòng, mỗi dòng một ô số ≥ 0; "Đã sửa" khi khác số mặc định. Thanh lưu: tổng, hằng tháng, một lần. |
| Chi tiết bill (`BillParts.jsx`) | Không bỏ nhóm trống: luôn hai nhóm, đủ 14 dòng, 0 hiện "0.00". Cột phải "Số tiền" bỏ dòng Điều chỉnh. |
| `MoneyInput` | Giữ prop `allowNegative` (có thể nơi khác dùng; kiểm khi làm), chỉ thôi dùng ở bill. |

---

# Phần B — Trả lương thuyền viên

## B1. Dữ liệu — migration `051_seafarer_payout.sql`

Bản ghi trả lương chỉ sinh **lần đầu Chốt**. Bill chưa có bản ghi thì dòng Trả tính mặc định từ hợp đồng mỗi lần đọc, nên sửa cột Phải chi của hợp đồng (khi về Nháp) thì dòng chưa chốt đổi theo.

```sql
-- Trả lương thuyền viên theo từng bill phải thu. Ghi nhận ngoài hệ thống: chỉ lưu đã trả hay chưa, số đã trả, ngày trả.
CREATE TABLE "seafarer_payout" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "bill_id" INTEGER NOT NULL UNIQUE REFERENCES "contract_bill" ("id"),
  "status" varchar(10) NOT NULL DEFAULT 'PAID',
  "paid_date" DATE,
  "paid_by" INTEGER REFERENCES "user" ("id"),
  "bill_total_usd" decimal(12,2),           -- tổng bill lúc chốt (D3)
  "version" INTEGER NOT NULL DEFAULT 1,     -- cùng cơ chế row_version (045)
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "seafarer_payout_status_check" CHECK ("status" IN ('UNPAID', 'PAID')),
  CONSTRAINT "seafarer_payout_paid_check" CHECK ("status" <> 'PAID' OR ("paid_date" IS NOT NULL AND "bill_total_usd" IS NOT NULL))
);

-- Luôn đủ 14 dòng, một dòng một mã khoản cố định.
CREATE TABLE "seafarer_payout_item" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "payout_id" INTEGER NOT NULL REFERENCES "seafarer_payout" ("id") ON DELETE CASCADE,
  "item_code" varchar(30) NOT NULL,
  "kind" varchar(10) NOT NULL,
  "default_usd" decimal(12,2) NOT NULL,     -- số mặc định từ hợp đồng lúc chốt lần đầu
  "amount_usd" decimal(12,2) NOT NULL CHECK ("amount_usd" >= 0),
  UNIQUE ("payout_id", "item_code"),
  CONSTRAINT "seafarer_payout_item_kind_check" CHECK ("kind" IN ('MONTHLY', 'ONE_TIME'))
);

CREATE TABLE "seafarer_payout_log" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "payout_id" INTEGER NOT NULL REFERENCES "seafarer_payout" ("id") ON DELETE CASCADE,
  "action" varchar(10) NOT NULL,            -- PAY | UNPAY
  "actor_id" INTEGER REFERENCES "user" ("id"),
  "payload" JSONB,                          -- số từng khoản lúc chốt
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "seafarer_payout_log_action_check" CHECK ("action" IN ('PAY', 'UNPAY'))
);

-- Trigger updated_at, version như các bảng khác. Quyền mới cấp cho vai trò đang có bill.collect.
INSERT INTO "role_permission" ("role_id", "permission")
SELECT "role_id", p FROM "role_permission", (VALUES ('payout.view'), ('payout.pay')) AS v(p) WHERE "permission" = 'bill.collect'
ON CONFLICT DO NOTHING;
```

- Không xoá mềm. Huỷ chốt = `status = 'UNPAID'`, xoá `paid_date`, `paid_by`, `bill_total_usd`; giữ các dòng tiền.
- Phạm vi dữ liệu ("chỉ của mình") theo `contract_bill.created_by` của bill gốc.

## B2. Hàm thuần (`backend/src/utils/payout_math.js`, có test)

- `payoutDefaults({ contractItems, seq })` → `{ [item_code]: số }` đủ 14 mã: `payable_usd` (trống = 0); khoản một lần chỉ khi `seq = 1`, còn lại 0.
- `sumAmounts(amounts)`, làm tròn 2 số.

## B3. API

Quyền mới trong `constants/permissions.js`, nhóm Vận hành, `scoped: true`:

```js
{ key: 'payout', group: 'Vận hành', label: 'Trả lương', scoped: true, permissions: [
  ['view', 'Xem bảng trả lương'],
  ['pay', 'Sửa số trả, chốt và huỷ chốt'],
] },
```

`utils/scope.js`: `payout` lọc theo `contract_bill.created_by`.

| Method | Đường dẫn | Quyền | Việc |
|---|---|---|---|
| GET | `/api/v1/payouts` | `payout.view` | Query `month` (YYYY-MM, bắt buộc), `tab` (all / UNPAID / PAID), `search` (tên thuyền viên, mã bill, số hợp đồng), `ship_owner_id`, `page`, `limit`. Trả `rows`, `counts`, `totals` (tổng thu, tổng trả của tab + bộ lọc). |
| POST | `/api/v1/payouts/pay` | `payout.pay` | Body `{ rows: [{ bill_id, version, amounts: { [item_code]: number } }] }`, 1–200 dòng, `amounts` đủ 14 mã. Một transaction, tất cả hoặc không. `paid_date = CURRENT_DATE`. |
| POST | `/api/v1/payouts/:id/unpay` | `payout.pay` | Body `{ version }`. `PAID → UNPAID`. |

Mỗi phần tử `rows` của GET (`amounts` luôn đủ 14 mã, rút gọn ở đây):

```json
{
  "bill": { "id": 41, "code": "CH2609-02/HĐ/T1", "seq": 1, "periods": 6, "period_start": "2026-10-15", "period_end": "2026-10-31",
            "due_date": "2026-11-10", "display_status": "SENT", "total_usd": 2150,
            "amounts": { "BASIC_WAGE": 1500, "FIXED_OVERTIME": 0, "SERVICE_FEE": 150, "FLIGHT_OUT": 500, "...": 0 } },
  "payout": { "id": null, "version": null, "status": "UNPAID", "paid_date": null, "paid_by_name": null, "bill_total_usd": null,
              "amounts": { "BASIC_WAGE": 1300, "FLIGHT_OUT": 500, "...": 0 }, "defaults": { "BASIC_WAGE": 1300, "FLIGHT_OUT": 500, "...": 0 }, "total_usd": 1800 },
  "payable_due_date": "2026-11-13",
  "seafarer": { "id": 7, "full_name": "Nguyễn Hữu Phước", "rank_name": "Thợ máy" },
  "contract": { "id": 12, "contract_number": "CH2609-02/HĐ" },
  "ship_owner": { "id": 3, "company_name": "Hải Âu Shipping" },
  "vessel": { "id": 5, "vessel_name": "MV Ocean Glory" }
}
```

Kiểm khi Chốt (lỗi thì cả lô huỷ, trả 409 / 400 kèm danh sách `{ bill_id, code, message }`):

| Kiểm | Lỗi |
|---|---|
| Bill không tồn tại, đã xoá mềm, ngoài phạm vi | 404 |
| Bill không phải bên phải thu | 400 |
| Đã có bản ghi `PAID` | 409 "Đã chốt trả lương" |
| `version` không khớp bản ghi đang có | 409 xung đột |
| Thiếu mã, mã lạ, số âm | 400 |

Bill chưa có bản ghi: tạo mới (`UNIQUE bill_id` chặn hai người tạo cùng lúc → 409). Đã có bản ghi `UNPAID` (sau Huỷ chốt): ghi đè số, giữ `default_usd` cũ.

## B4. Ảnh hưởng tới luồng sẵn có

| Luồng | Xử lý |
|---|---|
| **Sửa ngày bắt đầu / kết thúc hợp đồng, duyệt lại hợp đồng** (`planFor` / `planBillChanges`) | Bill có trả lương `PAID` coi như bị khoá: vào `blocked` dù bill đang `OPEN`. Thông báo chặn thêm "đã trả lương" và "Huỷ chốt trả lương". `brief()` thêm cờ `payout_paid`. |
| Bill bị xoá mềm / cắt khi chưa chốt trả lương | Dòng biến khỏi bảng; bản ghi `UNPAID` (nếu có) bỏ lại, không đọc tới. |
| Sửa số tiền bill, Duyệt, Gửi, Thu, Thu hồi, Huỷ ghi nhận thu | Không chặn, không đổi bản ghi trả lương. Dòng Thu đổi theo; tổng khác lúc chốt → chip "Bill đổi sau khi chốt". |
| Đưa hợp đồng về Nháp, sửa cột Phải chi | Dòng chưa chốt lần nào đổi mặc định theo. Dòng đã chốt / đã huỷ chốt giữ số đã lưu. |
| Ghi rời tàu | Không đụng. |
| Chi tiết bill | Thêm dòng ở Thông tin chung: "Trả lương: Đã trả 18/11/2026 · 1,900 USD" hoặc "Chưa trả", link sang bảng Trả lương tháng đó. |
| Tổng quan / KPI | Không đổi lần này. |

## B5. Giao diện

Theo wireframe. Dựng trên khuôn `BillListPage` (thanh công cụ, `StatusTabs`, ô tìm, `SearchSelect` đối tác, `ListFooter`, `useListSessionState`, `ListCard` ở điện thoại).

- **Route** `/payouts`, `guard('payout.view')`. **Menu** "Trả lương", nhóm Vận hành sau "Yêu cầu thanh toán". Cập nhật `navConfig.test.js`.
- **Chọn tháng:** `DateField picker="month"` + hai nút ‹ ›; lưu trong `useListSessionState` và `?month=`.
- **Bảng (≥ 768px):** antd `Table`, mỗi bill hai dòng (Thu / Trả) bằng `rowSpan` cho ô chung (chọn, thuyền viên, đối tác, thao tác). Cột trái (chọn, thuyền viên) và cột Thao tác dính; **14 cột khoản** + Tổng cuộn ngang trong khung bảng; tiêu đề cột có nhóm "Hằng tháng" / "Một lần". Ô Trả dùng `MoneyInput` (≥ 0). Ô đã đổi: viền nhấn + chip "Đã sửa".
- **Trạng thái sửa** giữ ở state trang theo `bill_id`; tính lại Tổng và chân bảng mỗi lần gõ. Chặn rời trang: `useBlocker` + `beforeunload`; đổi tháng / tab / lọc cũng hỏi.
- **Chốt một dòng:** không hỏi lại; toast có Hoàn tác. **Chốt hàng loạt:** `modal.confirm`. **Huỷ chốt:** `modal.confirm` một dòng.
- **Điện thoại (< 768px):** `ListCard` (ô Thu, Trả, trạng thái bill; dải "Đã sửa") + `BottomSheet` liệt kê đủ 14 khoản (hai nhóm), mỗi khoản ô Trả và gợi ý số Thu; nút "Chốt đã trả" / "Huỷ chốt".
- **Badge** (`statusMap.js`, nhóm `payout`): `UNPAID` "Chưa trả" (xám), `PAID` "Đã trả {ngày}" (xanh), `BILL_CHANGED` "Bill đổi sau khi chốt" (vàng).
- Không có quyền `payout.pay`: dòng Trả chỉ xem, ẩn ô chọn, nút Chốt và cột Thao tác.

---

## 3. Các bước dựng

Mỗi bước chạy lint + test phần vừa sửa. Một commit cho mỗi phần (A, B), gộp các bước nhỏ trước khi push.

| Bước | Việc | Xong khi |
|---|---|---|
| A1 | Hằng số 14 khoản (backend + frontend), migration `050_fixed_money_items.sql` | Chạy sạch trên DB trống và DB hiện có; hợp đồng có khoản tự đặt tên → gộp đúng vào Khác, tên vào ghi chú; mọi bill đủ 14 dòng, tổng bill không đổi |
| A2 | Backend hợp đồng + bill (A3) + test | Gửi `custom_name` / mã lạ / số âm → 400; duyệt hợp đồng sinh bill đủ 14 dòng, bill 2 trở đi khoản một lần = 0 |
| A3 | Frontend form + chi tiết hợp đồng, sửa + chi tiết bill (A4) | Không còn nút thêm khoản / thêm điều chỉnh; mọi màn hiện đủ 14 khoản, 0 khi trống; kiểm 375px |
| A4 | Sửa mục Hợp đồng, Yêu cầu thanh toán trong `frontend/public/guide/index.html` (bỏ "dòng điều chỉnh", nói rõ 14 khoản cố định) | — |
| B1 | Migration `051_seafarer_payout.sql`, quyền `payout.*`, `scope.js` | Chạy sạch; vai trò có `bill.collect` có thêm `payout.view`, `payout.pay` |
| B2 | `utils/payout_math.js` + test | Kỳ 1 có khoản một lần, kỳ sau 0; đủ 14 mã |
| B3 | `services/payout.service.js`: `list`, `pay`, `unpay` + test | Đúng bảng kiểm B3; lỗi một dòng thì cả lô không ghi; hai lần chốt song song → một 409 |
| B4 | Nối `contract_bill.service.js` + `seafarer_contract.service.js` (B4) + test | Sửa S / E đụng bill đã trả lương → chặn; huỷ chốt rồi duyệt lại được |
| B5 | Routes `/api/v1/payouts` + test route | Thiếu quyền 403, ngoài phạm vi 404, `month` sai dạng 400 |
| B6 | Frontend: `payoutApi.js`, hook, nav + route, `PayoutListPage.jsx`, badge | Chạy thử với dữ liệu mẫu mục 1 wireframe |
| B7 | Điện thoại: thẻ + bảng dưới | 375px không cuộn ngang trang; 1440px không đổi |
| B8 | Chi tiết bill: dòng "Trả lương" | Đúng hai trạng thái, link đúng tháng |
| B9 | Hướng dẫn: chép `docs/catoro-huong-dan-tra-luong.html` vào `guide/index.html` mục `#tra-luong` sau `#thanh-toan`; bỏ ghi chú "Phía chi trả lương thuyền viên chưa có" | Mục lục và lọc theo công việc thấy mục mới |
| ⛔ | **DỪNG** — chạy tay `docs/catoro-testcase-tra-luong.md`, ghi kết quả | Mọi ca Đạt hoặc có ghi chú |
| Z | Build app máy tính `npm run dist:linux` (luật phiên bản trong `docs/catoro-quy-trinh-phat-hanh.md`) | Build thành công |

## 4. Không làm lần này

- Chuyển tiền thật, xuất lệnh chi / phiếu lương / Excel.
- Trả một phần, nhiều lần trả cho một bill.
- Kỳ trả lương khác kỳ bill.
- Hoa hồng: không có cột hoa hồng; không đưa số đã trả vào Tổng quan / Mục tiêu tháng.
- Quy đổi VND.

## 5. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-11-20 | — | — | Lập kế hoạch trả lương, wireframe, testcase, bản nháp hướng dẫn. Chốt Q1–Q9. |
| 2026-11-20 | — | — | Thêm phần A: 14 khoản cố định (K1–K3), bỏ khoản tự đặt tên và dòng điều chỉnh, luôn hiện đủ khoản. Bỏ cột Hoa hồng. |
| 2026-11-20 | A1–A4, B1–B9, Z | xem git log | Dựng xong. Migration 050 thử trên DB local (thêm khoản tự đặt tên, điều chỉnh âm / dương giả rồi rollback): đủ 14 khoản mỗi hợp đồng và bill, tổng bill giữ nguyên. Backend 625 test, frontend 514 test. Kiểm trên app dev: sửa ô, hỏi khi đổi tháng, chốt một dòng, huỷ chốt, hộp chốt hàng loạt, 375px. App máy tính 0.9.9. Chưa chạy tay testcase. |
