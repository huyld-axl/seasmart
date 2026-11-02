# MCAH — Kế hoạch dựng Hợp đồng gắn Chuyến (giai đoạn 2)

- **Ngày lập:** 2026-10-30
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự. Mọi quyết định cần cho việc dựng đã chép vào mục 1–7.
- **Wireframe:** `docs/design/wireframes/hop-dong-giai-doan-2.html` (16 màn, đánh số Màn 0–16).
- **Ca kiểm thử:** `docs/mcah-testcase-hop-dong-giai-doan-2.xlsx` (sheet Checklist, Tổng hợp, Hướng dẫn). Bước cuối của kế hoạch là chạy tay toàn bộ file này trên app thật (mục 9).
- **Hướng dẫn người dùng:** `frontend/public/huong-dan/hop-dong-va-chuyen.html`, mở trong app ở `/huong-dan/hop-dong-va-chuyen.html`. Giữ khớp với mọi thay đổi luồng (mục 10).
- **Thay cho:** phần giai đoạn 2 của `docs/mcah-ke-hoach-chuyen-tau-hop-dong.md` và các màn Đ, Đ1–Đ3 (nhãn "Giai đoạn 2") của `docs/design/wireframes/co-hoi-chuyen-tau.html`. **Không có phụ lục**, không có "Thay hợp đồng", không có trạng thái Huỷ / Đã thay.
- **Tiếp nối:** `docs/mcah-ke-hoach-co-hoi-chuyen.md` (giai đoạn 1, đã dựng).

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` trước khi viết dòng code nào. Mọi quy ước trong đó áp dụng (CommonJS không chấm phẩy ở backend, SQL tham số hoá, `pickAllowed`, lỗi `{ statusCode, message }`, form theo mục 3.3, control theo mục 3.4, chữ giao diện tiếng Việt, xoá mềm).
2. Làm **đúng thứ tự các bước ở mục 8**. Mỗi bước có "Xong khi"; chỉ sang bước sau khi mọi ý đúng.
3. Sau mỗi bước: chạy lint và test phần vừa sửa. Commit theo quy ước của người dùng: **một commit cho cả giai đoạn**, gộp các commit nhỏ trước khi push. Không push khi chưa được bảo.
4. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được yêu cầu, chờ trả lời.
5. Không làm việc ở mục 2.2.
6. Ghi tiến độ vào mục 11 "Nhật ký" sau mỗi bước.
7. Chi tiết trong file mâu thuẫn với code đang có (tên cột, tên hàm): ưu tiên code, sửa cho khớp, ghi một dòng Nhật ký.
8. Dựng trên màn và component đang có. Wireframe chỉ chốt luồng, chữ, thứ tự khối. Control mới thêm vào `frontend/src/components/ds/` và minh hoạ ở `/design-system` **trước**.

---

## 1. Nghiệp vụ cần hiểu

### 1.1 Ba tầng độc lập

| Tầng | Giữ gì | Ai đổi |
|---|---|---|
| **Chuyến** (`seafarer_voyage`) | Ngày xuống **J**, nơi lên, ngày rời dự kiến, ngày rời thực tế **L**, trạng thái Đang trên tàu / Đã rời tàu | Chốt, Tạo chuyến, Ghi rời tàu, Sửa ngày đã ghi, Huỷ chốt / Xoá chuyến |
| **Hợp đồng** (`seafarer_contract`) | Ngày bắt đầu **S**, ngày kết thúc **E**, dòng tiền, kỳ thanh toán, trạng thái | Form hợp đồng (chỉ khi Nháp / Bị từ chối), các nút chuyển trạng thái |
| **Bill** (`contract_bill`) | Các kỳ thanh toán của một hợp đồng | Sinh khi duyệt lần đầu; cắt / xoá mềm / sinh thêm / sinh lại khi duyệt lại; người dùng sửa tiền, gửi, thu |

- **J, L chỉ thuộc chuyến.** Ghi rời tàu, sửa ngày xuống, sửa ngày rời đã ghi **không đụng hợp đồng, bill hay tiền**.
- Mối nối duy nhất: lúc chốt (và lúc mở form Tạo hợp đồng từ chuyến), S và E **được chép** từ J và ngày rời dự kiến để điền sẵn. Sau đó độc lập.
- **Một chuyến tối đa một hợp đồng** (chưa xoá). **Hợp đồng luôn thuộc một chuyến** (hợp đồng mới). Hợp đồng cũ chưa nối chuyến giữ nguyên, xem 3.4.
- Không có chuyển tàu: người đang trên tàu phải ghi rời chuyến cũ rồi mới có chuyến mới.

### 1.2 Trạng thái hợp đồng

Giữ năm giá trị `DRAFT`, `PENDING`, `REJECTED`, `ACTIVE`, `ENDED`. Nhãn: Nháp, Chờ duyệt, Bị từ chối, Hiệu lực, **Đã kết thúc** (đổi từ "Hết hạn").

| Thao tác | Từ | Sang | Ghi log | Quyền |
|---|---|---|---|---|
| Xin duyệt (có sẵn) | DRAFT, REJECTED | PENDING | SUBMIT | `contract.submit` |
| Thôi xin duyệt (có sẵn) | PENDING | DRAFT | WITHDRAW | `contract.submit` |
| Từ chối (có sẵn) | PENDING | REJECTED | REJECT | `contract.approve` |
| Duyệt (có sẵn, thêm xử lý bill 1.4) | PENDING | ACTIVE | APPROVE (+ APPLY_BILLS nếu bill đổi) | `contract.approve` |
| **Đưa về Nháp** (mới) | ACTIVE | DRAFT | REVERT | `contract.update` |
| **Kết thúc hợp đồng** (mới) | ACTIVE | ENDED | END | `contract.end` (mới) |

- **ACTIVE khoá mọi trường**, kể cả ngày. Chỉ DRAFT và REJECTED sửa được (như hiện nay).
- **ENDED là cuối**, không mở lại.
- **Bỏ job** trong `backend/src/jobs.js` tự chuyển ACTIVE → ENDED. Hợp đồng chỉ kết thúc khi người dùng bấm.
- Đưa về Nháp chỉ đổi trạng thái; **bill giữ nguyên và vẫn gửi, thu được** (không khoá bill).
- Kết thúc hợp đồng chỉ đổi trạng thái; không đổi E, không đổi bill. E còn ở tương lai thì hộp xác nhận cảnh báo (Màn 13) nhưng vẫn cho kết thúc.
- "**Chờ duyệt lại**": hợp đồng chưa ACTIVE (DRAFT, PENDING, REJECTED) mà **đã có bill chưa xoá**. Tính ra, không lưu cột. Hiện nhãn ở danh sách và chi tiết.
- Hợp đồng đã có bill: **không xoá được** (kể cả khi Nháp). Nháp chưa từng có bill xoá như hiện nay.

### 1.3 Kiểm tra chặn khi đổi ngày hợp đồng

Áp dụng khi hợp đồng **đã có bill chưa xoá** và người dùng đổi S hoặc E (lưu form) hoặc duyệt.

"Bill bị ảnh hưởng":

| Đổi gì | Bill bị ảnh hưởng |
|---|---|
| S đổi (dù E có đổi hay không) | **Mọi** bill chưa xoá |
| Chỉ E, sớm hơn | Bill có `period_end` > E mới |
| Chỉ E, muộn hơn | Không có |
| Không đổi ngày | Không có |

- Có bill bị ảnh hưởng ở trạng thái `SENT` hoặc `PAID` → **409**, liệt kê mã bill, trạng thái và kỳ. Lời nhắn: "Các yêu cầu thanh toán sau đã gửi hoặc đã thu: {mã} kỳ {n} ({trạng thái}), … Huỷ ghi nhận thu, thu hồi rồi thử lại."
- Kiểm **hai lần**: lúc lưu form ở Nháp (báo sớm) và lúc duyệt (vì trong lúc Nháp bill vẫn gửi, thu được).
- Gỡ bill theo luồng có sẵn: `PAID` → Huỷ ghi nhận thu → `SENT` → Thu hồi → `OPEN`.

### 1.4 Duyệt: sinh và chỉnh bill

Duyệt (`PENDING → ACTIVE`) chạy trong một transaction:

1. Hợp đồng **chưa có bill** (lần duyệt đầu): sinh đủ bill như hiện nay (`generateForContract`). Không có hộp xác nhận mới.
2. Hợp đồng **đã có bill**: tính `planBillChanges` (mục 6) rồi:

| Trường hợp | Bill |
|---|---|
| **S đổi** | Xoá mềm mọi bill. Sinh lại từ S đến E bằng cách cắt kỳ chuẩn. Khoản một lần vào bill đầu mới. |
| **E sớm hơn** (S giữ) | Bill chứa E mới: `period_end` = E, tính lại `due_date`, **giữ nguyên các dòng tiền** (đủ tháng). Bill có `period_start` > E: xoá mềm. |
| **E muộn hơn** (S giữ) | Giữ bill cũ. Sinh thêm bill cho khoảng E cũ + 1 → E mới, cắt kỳ chuẩn, chỉ khoản hằng tháng, đủ tháng. |
| **Không đổi ngày** | Không đổi bill. |

- **Dòng tiền đổi** khi Nháp: bill đang có **không đổi**. Người dùng tự sửa bill. Bill sinh mới (sinh lại / kéo dài) dùng dòng tiền mới.
- **Bill sửa tay sẽ mất** khi xoá mềm (sinh lại, cắt đuôi). Hộp xác nhận nêu tên bill đã sửa tay (`contract_bill_log` có UPDATE).
- Có thay đổi bill → giao diện bắt hộp xác nhận **checkbox khoá 5 giây** (Màn 11). Server không biết hộp; server chỉ nhận `expected` (mục 4.3) để chống lệch.

### 1.5 Chốt và hợp đồng

- Chốt (giai đoạn 1) thêm: sinh hợp đồng **Nháp** gắn chuyến vừa tạo, trong cùng transaction.
- Điền sẵn: `seafarer_id`, `seafarer_voyage_id`; S = ngày xuống; E = ngày rời dự kiến của chuyến; dòng tiền mặc định với `BASIC_SALARY` (hoặc mã lương tháng chính trong `DEFAULT_ITEMS`) phải thu = budget tháng của cơ hội nếu có; kỳ thanh toán mặc định.
- **Trùng hợp đồng**: người đó còn hợp đồng chưa ENDED, chưa xoá, trùng khoảng [S, E] → **chốt vẫn thành công**, không sinh hợp đồng, trả `contract_skipped: { reason: 'OVERLAP', contract_number, contract_id }`. Toast vàng "Đã chốt, chưa tạo hợp đồng vì trùng {số}".
- Chuyến tạo tay **không** tự sinh hợp đồng. Chi tiết chuyến có nút "Tạo hợp đồng".

### 1.6 Huỷ chốt / Xoá chuyến

- Chuyến có hợp đồng ACTIVE hoặc ENDED → **409** "Chuyến có hợp đồng {số} đã hiệu lực, không huỷ được".
- Hợp đồng DRAFT / PENDING / REJECTED → xoá mềm cùng chuyến, ghi log hợp đồng. Hộp xác nhận liệt kê "Hợp đồng {số} ({trạng thái}) bị xoá mềm".
- Hợp đồng có bill thì chắc chắn từng ACTIVE; DRAFT có bill (chờ duyệt lại) cũng **chặn** như ACTIVE.

### 1.7 Cảnh báo

| Cảnh báo | Điều kiện | Nơi hiện |
|---|---|---|
| Đang có hợp đồng | Thuyền viên có hợp đồng chưa ENDED, chưa xoá (mọi ngày) | Dòng ứng viên trên chi tiết cơ hội, bảng Thêm ứng viên, bảng Đề xuất; hộp Chốt |
| Lệch ngày | Chuyến `LEFT`, hợp đồng chưa ENDED, E > L | Chi tiết chuyến (banner), chi tiết hợp đồng (banner), danh sách hợp đồng (nhãn) |
| Chờ duyệt lại | 1.2 | Danh sách và chi tiết hợp đồng |

Chỉ là nhãn, không tự đổi gì.

---

## 2. Phạm vi

### 2.1 Làm

- Nối hợp đồng với `seafarer_voyage`; mở khoá tạo hợp đồng.
- Chốt sinh hợp đồng Nháp; bỏ qua khi trùng.
- Tạo hợp đồng từ chuyến; thẻ hợp đồng trên chi tiết chuyến.
- Đưa về Nháp, Kết thúc hợp đồng; bỏ job tự kết thúc.
- Kiểm tra chặn khi lưu ngày; duyệt lại chỉnh bill; hộp xác nhận khoá 5 giây.
- Huỷ chốt / xoá chuyến xử lý hợp đồng.
- Ba cảnh báo ở 1.7.
- Gỡ logic chuyển tàu của giai đoạn 1.
- Trang hướng dẫn trong app và link tới nó.
- File ca kiểm thử và chạy tay hết.

### 2.2 Không làm

- Phụ lục, thay hợp đồng, trạng thái Huỷ / Đã thay.
- Bên phải trả (trả lương thuyền viên): bill chỉ `RECEIVABLE` như hiện nay. Hàm mới vẫn nhận tham số `side`.
- Tự cập nhật tiền của bill đang có khi dòng tiền hợp đồng đổi.
- Mở lại hợp đồng Đã kết thúc.
- Khoá gửi / thu bill khi hợp đồng ở Nháp.
- Tính theo tỷ lệ ngày (luật đủ tháng giữ nguyên).
- Lịch sử đi tàu sinh khi kết thúc chuyến, quyết định điều động / rời tàu hàng loạt (giai đoạn 3).
- Xoá cột `transferred_from_id` hay đổi CHECK `manual_reason` (giữ cho dữ liệu cũ).

---

## 3. Dữ liệu

### 3.1 Migration `backend/migrations/postgres/035_contract_voyage.sql`

```sql
-- Hợp đồng gắn chuyến mới. Hợp đồng cũ vẫn giữ voyage_position_id.
ALTER TABLE "seafarer_contract" ADD COLUMN "seafarer_voyage_id" INTEGER REFERENCES "seafarer_voyage" ("id");
ALTER TABLE "seafarer_contract" ALTER COLUMN "voyage_position_id" DROP NOT NULL;
CREATE UNIQUE INDEX "seafarer_contract_voyage_uniq" ON "seafarer_contract" ("seafarer_voyage_id")
  WHERE "deleted_at" IS NULL AND "seafarer_voyage_id" IS NOT NULL;
ALTER TABLE "seafarer_contract" ADD CONSTRAINT "seafarer_contract_link_check"
  CHECK ("seafarer_voyage_id" IS NOT NULL OR "voyage_position_id" IS NOT NULL);

-- Log hợp đồng: thêm Đưa về Nháp, Kết thúc, Áp thay đổi bill, Xoá theo chuyến.
ALTER TABLE "contract_approval_log" DROP CONSTRAINT "contract_approval_log_action_check";
ALTER TABLE "contract_approval_log" ADD CONSTRAINT "contract_approval_log_action_check"
  CHECK ("action" IN ('CREATE', 'SUBMIT', 'WITHDRAW', 'APPROVE', 'REJECT', 'REVERT', 'END', 'APPLY_BILLS', 'DELETE'));
ALTER TABLE "contract_approval_log" ADD COLUMN "payload" JSONB;

-- Bill: kỳ duy nhất chỉ tính bill chưa xoá; log thêm cắt kỳ và xoá.
ALTER TABLE "contract_bill" DROP CONSTRAINT "contract_bill_contract_id_side_seq_key";
CREATE UNIQUE INDEX "contract_bill_seq_uniq" ON "contract_bill" ("contract_id", "side", "seq") WHERE "deleted_at" IS NULL;
ALTER TABLE "contract_bill_log" DROP CONSTRAINT "contract_bill_log_action_check";
ALTER TABLE "contract_bill_log" ADD CONSTRAINT "contract_bill_log_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'SEND', 'UNSEND', 'COLLECT', 'UNCOLLECT', 'CUT', 'DELETE'));
ALTER TABLE "contract_bill_log" ADD COLUMN "payload" JSONB;

-- Nối hợp đồng cũ đã chuyển sang chuyến mới ở giai đoạn 1.
UPDATE "seafarer_contract" c SET "seafarer_voyage_id" = sv."id"
  FROM "seafarer_voyage" sv WHERE sv."legacy_contract_id" = c."id" AND sv."deleted_at" IS NULL;
```

- Tên ràng buộc UNIQUE thật của `contract_bill` phải đọc trên DB (`\d contract_bill`); tên trên là tên mặc định Postgres đặt.
- Quyền mới `contract.end` thêm vào `backend/src/constants/permissions.js` (nhóm `contract`) và cấp cho các vai trò đang có `contract.approve` (cùng migration, như cách migration 028 cấp quyền).

### 3.2 Hằng số

- `backend/src/constants/voyage_contract.js` + `frontend/src/constants/…` tương ứng: thêm `CONTRACT_LOG_ACTIONS` mới, `BILL_LOG_ACTIONS` mới.
- `MANUAL_REASONS` (backend `constants/opportunity_voyage.js` và frontend `constants/opportunityVoyage.js`) bỏ `TRANSFER`. `MANUAL_REASON_LABELS` frontend **giữ** `TRANSFER: 'Chuyển tàu'` để hiện chuyến cũ.
- `statusMap.js` nhóm `contract`: `ENDED` nhãn "Đã kết thúc".

### 3.3 Các câu SQL phải đổi

`CONTRACT_SELECT` (`seafarer_contract.service.js`), `BILL_FROM` / `BILL_SELECT` (`contract_bill.service.js`) đang `JOIN voyage_position … JOIN voyage`. Đổi thành: lấy tàu, chủ tàu, chức danh **ưu tiên từ `seafarer_voyage`**, rơi về `voyage_position`/`voyage` cho hợp đồng cũ chưa nối:

```sql
LEFT JOIN seafarer_voyage sv ON sv.id = c.seafarer_voyage_id
LEFT JOIN voyage_position p ON p.id = c.voyage_position_id
LEFT JOIN voyage v ON v.id = p.voyage_id
JOIN vessel ves ON ves.id = COALESCE(sv.vessel_id, v.vessel_id)
JOIN ship_owner o ON o.id = COALESCE(sv.ship_owner_id, v.ship_owner_id)
JOIN "rank" r ON r.id = COALESCE(sv.rank_id, p.rank_id)
```

Bộ lọc `voyage_id` trên danh sách hợp đồng / bill đổi nghĩa thành `seafarer_voyage_id`. Mọi chỗ khác đọc `voyage_position_id` của hợp đồng: `grep -rn "voyage_position" backend/src frontend/src`, liệt kê vào Nhật ký trước khi sửa.

### 3.4 Hợp đồng cũ

- Hợp đồng cũ có chuyến mới (qua `legacy_contract_id`) được nối ở 3.1 và đi theo luồng mới.
- Hợp đồng cũ **không** có chuyến mới (chuyến cũ `PLANNING`, nháp lẻ): giữ `voyage_position_id`, xem và in được. Không sửa, không đưa về Nháp, không duyệt lại (409 "Hợp đồng cũ chưa gắn chuyến"). **⛔ DỪNG** ở Bước 0 nếu có hợp đồng loại này ở trạng thái DRAFT / PENDING / REJECTED / ACTIVE: báo danh sách, hỏi xử lý.

---

## 4. API

### 4.1 Quyền

| Route | Quyền |
|---|---|
| `POST /contracts` | `contract.create` |
| `PUT /contracts/:id` | `contract.update` |
| `POST /contracts/:id/revert` | `contract.update` |
| `POST /contracts/:id/end` | `contract.end` |
| `GET /contracts/:id/bill-plan` | `contract.view` |
| `POST /contracts/:id/approve` | `contract.approve` (có sẵn) |

Giữ `fastify.can` và lọc phạm vi bằng `utils/scope.js` như các route hợp đồng đang có.

### 4.2 Hợp đồng — `routes/v1/seafarer_contract.routes.js`, `services/seafarer_contract.service.js`

- **Bỏ khoá tạo** (route đang ném 409 "Tạm khoá tạo hợp đồng mới").
- `POST /contracts`: body thay `voyage_position_id` bằng `seafarer_voyage_id` (bắt buộc). Kiểm: chuyến tồn tại, chưa xoá; chuyến chưa có hợp đồng chưa xoá (409 "Chuyến {mã} đã có hợp đồng {số}"); `seafarer_id` lấy **từ chuyến**, không nhận từ body; `assertNoOverlap` như cũ; thuyền viên `INACTIVE` → 409.
- `PUT /contracts/:id`: như cũ (chỉ DRAFT / REJECTED). Thêm: hợp đồng đã có bill và S hoặc E đổi so với giá trị đang lưu → chạy kiểm tra chặn 1.3 với S, E mới so với bill (409 có `blocked_bills`). Không cho đổi chuyến hay thuyền viên của hợp đồng đã có bill.
- `POST /contracts/:id/revert`: ACTIVE → DRAFT, log REVERT. Hợp đồng cũ chưa gắn chuyến → 409.
- `POST /contracts/:id/end`: ACTIVE → ENDED, log END với `payload: { end_date, today }`.
- `DELETE /contracts/:id`: thêm điều kiện không có bill chưa xoá (409 "Hợp đồng đã có yêu cầu thanh toán, không xoá được").
- `GET /contracts/:id` trả thêm: `voyage` (chuyến mới: id, mã, trạng thái, J, L), `bills_summary` (`{ count, first_start, last_end, has_sent_or_paid }`), `awaiting_reapproval` (bool), `date_mismatch` (`{ leave_date, end_date }` hoặc null).
- `GET /contracts` thêm cột tương ứng cho danh sách (`awaiting_reapproval`, `date_mismatch`), lọc `seafarer_voyage_id`.

### 4.3 Duyệt và bản xem trước

- `GET /contracts/:id/bill-plan` (chỉ đọc): trả kết quả `planBillChanges` cho hợp đồng **ở trạng thái hiện tại** (dùng cho Màn 9 và Màn 11):
  ```json
  { "mode": "NONE | FIRST | REGENERATE | CUT | EXTEND",
    "cut": [{ "bill_id", "code", "seq", "from": {"start","end"}, "to": {"start","end"}, "edited": true }],
    "remove": [{ "bill_id", "code", "seq", "start", "end", "status", "edited": false }],
    "create": [{ "seq", "start", "end", "with_one_time": true }],
    "blocked": [{ "bill_id", "code", "seq", "status" }],
    "fingerprint": "sha1 của danh sách bill và S/E" }
  ```
- `POST /contracts/:id/approve` (có sẵn) nhận thêm `expected_fingerprint`. Trong transaction: khoá dòng hợp đồng và mọi bill của nó `FOR UPDATE`; tính lại plan; `blocked` khác rỗng → 409 kèm `blocked_bills`; `mode` khác `NONE`/`FIRST` mà `expected_fingerprint` thiếu hoặc khác → 409 "Yêu cầu thanh toán vừa thay đổi, mở lại hộp duyệt"; rồi áp plan: cập nhật cắt kỳ (`period_end`, `due_date`), xoá mềm (`deleted_at`), sinh mới; log bill CUT / DELETE / CREATE; log hợp đồng APPROVE và APPLY_BILLS với `payload` là plan rút gọn.
- `mode = FIRST` dùng `generateForContract` đang có. Bỏ điều kiện "đã có bill thì không làm gì" khỏi đường duyệt lại (đường duyệt lại không gọi hàm này).

### 4.4 Chốt — `POST /opportunities/:id/place`

Sau khi tạo chuyến (giai đoạn 1), trong cùng transaction: nếu `assertNoOverlap` không lỗi thì tạo hợp đồng Nháp (1.5), log CREATE; trả `contract: { id, contract_number }`. Lỗi trùng → không tạo, trả `contract_skipped`. Lỗi khác vẫn rollback cả chốt.

### 4.5 Chuyến — `services/voyage.service.js`

- `create`: bỏ nhánh `TRANSFER`. Người đang `ONBOARD` mà chuyến mới chưa kết thúc → 409 "{tên} đang trên {tàu}, ghi rời tàu chuyến đó trước". Không ghi `transferred_from_id`.
- `get`: bỏ `transferred_from`, `transferred_to`. Trả thêm `contract` (`{ id, contract_number, status, start_date, end_date, diff_monthly }` hoặc null) và `date_mismatch`.
- `remove`: bỏ kiểm tra / mở lại chuyến chuyển tàu. Thêm 1.6: hợp đồng chưa xoá của chuyến ở ACTIVE / ENDED hoặc có bill → 409; DRAFT / PENDING / REJECTED → xoá mềm, log `DELETE` (log hợp đồng). Trả `deleted_contracts: [{ id, contract_number, status }]`. Thêm `GET /voyages/:id/remove-preview` (hoặc trả trong `get`) để hộp xác nhận biết trước hợp đồng nào bị xoá.
- `leave`, `leaveMany`, `editDates`, `leavePlan`: **không đổi**, không đụng hợp đồng.

### 4.6 Cơ hội — cảnh báo đang có hợp đồng

Các API trả dòng ứng viên (chi tiết cơ hội, `GET /opportunities/:id/suggestions`, tìm thêm ứng viên) thêm `open_contract: { id, contract_number, end_date, status }` hoặc null: hợp đồng chưa ENDED, chưa xoá, gần nhất theo `end_date`. Một truy vấn gom cho cả danh sách, không N+1.

### 4.7 Job

Xoá Job 2 trong `backend/src/jobs.js` (chuyển ACTIVE → ENDED). Sửa chú thích số job còn lại.

---

## 5. Giao diện

### 5.1 Xem wireframe

Mở `docs/design/wireframes/hop-dong-giai-doan-2.html` bằng trình duyệt. Màn 0 là mô hình, Màn 15 là dữ liệu, Màn 16 là giả định còn để ngỏ.

### 5.2 Từng màn

| Màn | File | Việc |
|---|---|---|
| 1 Ứng viên đang có hợp đồng | `pages/admin/opportunities/*` (dòng ứng viên, bảng Thêm ứng viên, Đề xuất) | `StatusBadge` tone warning "Đang có hợp đồng {số} · tới {E}", bấm mở hợp đồng |
| 2 Chốt | Hộp chốt đang có | `Banner` warning khi người chọn có `open_contract` trùng; toast theo `contract` / `contract_skipped` |
| 3 Chi tiết chuyến | `pages/admin/voyages/VoyageDetailPage.jsx` | Thẻ Hợp đồng thật; nút Tạo hợp đồng; banner lệch ngày; bỏ menu Chuyển tàu và dòng Chuyển từ / Chuyển sang |
| 4 Tạo hợp đồng | `pages/admin/contracts/ContractFormPage.jsx` | Ô Chuyến (`Select` tìm kiếm, chỉ chuyến chưa có hợp đồng); `?voyage=` chọn sẵn và khoá; S, E điền sẵn từ chuyến |
| 5 Ghi rời tàu | Hộp ghi rời đang có | Toast thêm dòng hợp đồng còn tới và link Mở hợp đồng; bỏ lối tắt Chuyển sang tàu khác |
| 6 Danh sách hợp đồng | `ContractListPage.jsx` | Cột Chuyến · tàu; nhãn Chờ duyệt lại, Đã rời tàu {L}; tab ENDED "Đã kết thúc" |
| 7 Hợp đồng Hiệu lực | `ContractDetailPage.jsx` | Nút Đưa về Nháp, Kết thúc hợp đồng; banner lệch ngày; khối bill |
| 8 Đưa về Nháp | `modal.confirm` | Như wireframe |
| 9 Nháp chờ duyệt lại | `ContractDetailPage.jsx` | Banner info: ngày bill đang có → ngày đang lưu, tóm tắt plan từ `bill-plan`; ẩn Xoá khi có bill |
| 10 Lưu bị chặn | `ContractFormPage.jsx` | Lỗi dưới ô ngày + `Banner` error liệt kê `blocked_bills` có link |
| 11, 12 Duyệt lại | `ApproveModal.jsx` | Gọi `bill-plan` khi mở; `mode` NONE/FIRST giữ hộp cũ; còn lại hiện bảng thay đổi + `CountdownCheck`; gửi `expected_fingerprint`; 409 lệch thì tải lại plan |
| 13 Kết thúc | `modal.confirm` | Biến thể cảnh báo khi E > hôm nay |
| 14 Huỷ chốt | `pages/admin/voyages/VoyageModals.jsx` (`RemoveModal`) | Dòng hợp đồng bị xoá mềm; biến thể bị chặn |
| Tạo chuyến | `VoyageFormPage.jsx` | Bỏ lý do Chuyển tàu và mọi chữ nhắc tới nó; người đang trên tàu → banner warning "ghi rời tàu chuyến đó trước" và chặn lưu |

### 5.3 Control mới: `CountdownCheck`

`frontend/src/components/ds/CountdownCheck.jsx`, minh hoạ ở `/design-system` trước khi dùng.

- Props: `seconds` (mặc định 5), `label`, `checked`, `onChange`, `resetKey` (đổi thì đếm lại).
- Trong lúc đếm: checkbox tắt, nhãn thêm "(chờ {n} giây…)". Hết giờ: bật, bỏ chữ đếm.
- `prefers-reduced-motion` không ảnh hưởng thời gian chờ.
- Có test: đếm bằng fake timers, không tick được trước 5 giây.

### 5.4 Link tới trang hướng dẫn

Thêm một link "Hướng dẫn" (icon dấu hỏi) ở đầu các trang Chuyến tàu, Hợp đồng, Yêu cầu thanh toán, mở `/huong-dan/hop-dong-va-chuyen.html` ở tab mới. Đặt bằng một component dùng chung `HelpLink` trong `components/ds/` (thêm vào `/design-system` trước).

---

## 6. Hàm thuần `planBillChanges`

Đặt ở `backend/src/utils/voyage_math.js` (cạnh `splitPeriods`, `dueDate`), có bản test riêng. Không chạm DB.

```
planBillChanges({ start, end, bills, term, today }) → { mode, cut, remove, create, blocked }
  bills: bill chưa xoá của một bên, sắp theo seq: { id, code, seq, period_start, period_end, status, edited }
```

1. `bills` rỗng → `mode = FIRST`, `create = splitPeriods(start, end)`.
2. `oldStart = bills[0].period_start`, `oldEnd = bills.at(-1).period_end`.
3. `start ≠ oldStart` → `REGENERATE`: `remove = bills`, `create = splitPeriods(start, end)` (seq từ 1, bill đầu có khoản một lần), `blocked = bills` có status ≠ OPEN.
4. Ngược lại `end < oldEnd` → `CUT`: bill có `period_start > end` vào `remove`; bill có `period_start ≤ end < period_end` vào `cut` (to.end = end); `blocked` = bill trong `remove` ∪ `cut` có status ≠ OPEN.
5. Ngược lại `end > oldEnd` → `EXTEND`: `create = splitPeriods(oldEnd + 1, end)`, seq tiếp theo `max(seq) + 1`, không có khoản một lần; `blocked = []`.
6. Ngược lại `NONE`.

- `due_date` của bill cắt và bill mới tính bằng `dueDate` với `term`.
- Bill mới (EXTEND, REGENERATE) lấy dòng tiền **hiện tại** của hợp đồng, đủ tháng, như `generateForContract`.
- Ca kiểm bắt buộc (unit test): bốn mode; E rơi đúng ngày chốt; E rơi giữa kỳ; E trước kỳ đầu (không cho: S ≤ E đã kiểm); S muộn hơn qua nhiều kỳ; EXTEND từ kỳ lẻ; ngày chốt 31 tháng 2; blocked đúng tập.

---

## 7. Những chỗ đang có cần sửa

| File | Sửa |
|---|---|
| `backend/src/jobs.js` | Bỏ Job 2 |
| `backend/src/routes/v1/seafarer_contract.routes.js` | Bỏ khoá tạo; route revert, end, bill-plan |
| `backend/src/services/seafarer_contract.service.js` | 4.2, 4.3; SQL 3.3 |
| `backend/src/services/contract_bill.service.js` | SQL 3.3; hàm áp plan; log CUT / DELETE |
| `backend/src/services/voyage.service.js` | 4.5 |
| `backend/src/services/opportunity.service.js` (chốt, ứng viên) | 4.4, 4.6 |
| `backend/src/constants/*` | 3.2 |
| `frontend/src/constants/opportunityVoyage.js` | Bỏ TRANSFER khỏi danh sách chọn |
| `frontend/src/pages/admin/voyages/*` | Bỏ chuyển tàu; thẻ hợp đồng; banner; RemoveModal |
| `frontend/src/pages/admin/contracts/*` | Màn 4, 6–13 |
| `frontend/src/pages/admin/opportunities/*` | Màn 1, 2 |
| `frontend/src/components/ds/statusMap.js` | ENDED "Đã kết thúc" |
| Test hiện có nhắc TRANSFER | `backend/src/services/__tests__/voyage.test.js`, `frontend/src/pages/admin/voyages/__tests__/voyageList.test.js`: sửa theo luồng mới |

---

## 8. Các bước

### Bước 0 — Chuẩn bị

- Đọc `CLAUDE.md`, mục 1–7, wireframe, file ca kiểm thử.
- Trên DB dev (và bản sao DB thật nếu người dùng cho), đếm: hợp đồng chưa xoá theo trạng thái; trong đó có / không có `seafarer_voyage.legacy_contract_id` trỏ tới; chuyến có `manual_reason = 'TRANSFER'`; hợp đồng ACTIVE đã qua `end_date` (job cũ sẽ không chạy nữa); bill theo trạng thái.
- **⛔ DỪNG** nếu có hợp đồng cũ không gắn được chuyến mà đang DRAFT / PENDING / REJECTED / ACTIVE (3.4), hoặc có chuyến TRANSFER: báo danh sách, hỏi cách xử lý. Không có thì ghi số liệu vào Nhật ký.
- Tạo nhánh `feature/hop-dong-chuyen` từ nhánh chính.

**Xong khi:** số liệu trong Nhật ký; nếu dừng thì người dùng đã trả lời.

### Bước 1 — Migration 035

Viết theo 3.1 (kèm quyền `contract.end`). Chạy từ bản sạch và trên bản sao có dữ liệu.

**Xong khi:** migrate chạy qua cả hai; mỗi hợp đồng có `legacy_contract_id` trỏ tới đã có `seafarer_voyage_id`; không chuyến nào có hai hợp đồng chưa xoá; số dòng `seafarer_contract`, `contract_bill` không đổi.

### Bước 2 — Hàm thuần

`planBillChanges` (mục 6) và test đủ các ca liệt kê.

**Xong khi:** test qua; lint sạch.

### Bước 3 — Gỡ chuyển tàu

4.5 phần `create`, `get`, `remove` liên quan chuyển tàu; 3.2 `MANUAL_REASONS`; frontend `VoyageFormPage`, `VoyageDetailPage`, `VoyageModals`, `voyageList.js`; sửa test.

**Xong khi:** không còn `TRANSFER` / `transferred_from` trong code chạy (trừ nhãn hiển thị và migration cũ); test chuyến qua; tạo chuyến cho người đang trên tàu trả 409 với mọi lý do.

### Bước 4 — SQL hợp đồng và bill đọc chuyến mới

3.3. Danh sách, chi tiết hợp đồng và bill hiện đúng tàu, chủ tàu, chức danh cho cả hợp đồng cũ lẫn hợp đồng gắn chuyến.

**Xong khi:** test service hiện có qua; mở danh sách hợp đồng và bill trên DB dev không lỗi.

### Bước 5 — API hợp đồng

4.1, 4.2 (tạo, sửa có kiểm tra chặn, revert, end, xoá, dữ liệu trả thêm). Bỏ job (4.7).

**Xong khi:** test service cho: tạo gắn chuyến, chuyến đã có hợp đồng → 409, revert / end sai trạng thái → 409, lưu ngày bị chặn trả `blocked_bills`, xoá hợp đồng có bill → 409.

### Bước 6 — Duyệt lại

4.3: `bill-plan`, duyệt áp plan, fingerprint, log.

**Xong khi:** test service cho bốn mode, blocked lúc duyệt, fingerprint lệch → 409, transaction rollback khi lỗi giữa chừng (không bill nào đổi).

### Bước 7 — Chốt sinh hợp đồng, Huỷ chốt, cảnh báo ứng viên

4.4, 4.5 (`remove`, `get`), 4.6.

**Xong khi:** test: chốt không trùng sinh Nháp đúng S/E/tiền; chốt trùng → chuyến có, hợp đồng không, `contract_skipped`; huỷ chốt xoá mềm Nháp, chặn ACTIVE; dòng ứng viên có `open_contract`.

### Bước 8 — Design system

`CountdownCheck`, `HelpLink`, nhãn `statusMap`, minh hoạ ở `/design-system`.

**Xong khi:** hai component có test và có mặt trên `/design-system`.

### Bước 9 — Màn chuyến và cơ hội

Màn 1, 2, 3, 5, 14 và Tạo chuyến (5.2).

### Bước 10 — Màn hợp đồng

Màn 4, 6–13.

**Xong khi (Bước 9, 10):** lint và test frontend qua; từng màn khớp chữ và thứ tự khối của wireframe.

### Bước 11 — Hướng dẫn trong app

Kiểm `frontend/public/huong-dan/hop-dong-va-chuyen.html` khớp hành vi đã dựng (chữ nút, nhãn, thông báo). Sửa chỗ lệch. Gắn `HelpLink` (5.4).

**Xong khi:** mở `/huong-dan/hop-dong-va-chuyen.html` từ app chạy dev thấy trang; link từ ba trang mở đúng.

### Bước 12 — Chạy ca kiểm thử

Chạy tay **toàn bộ** sheet Checklist của `docs/mcah-testcase-hop-dong-giai-doan-2.xlsx` trên app thật (mục 9). Mỗi ca chọn cột "Kết quả" (Pass / Fail / Blocked / N/A), ghi điều đã thấy vào "Mô tả kết quả thực tế", điền "Người test", "Ngày test". Sheet Tổng hợp tự đếm. Ca lỗi: sửa, chạy lại ca đó và các ca cùng nhóm.

**Xong khi:** mọi ca Đạt, hoặc ca chưa đạt đã được người dùng chấp nhận để lại. **⛔ DỪNG** báo người dùng bảng kết quả trước khi commit cuối.

### Bước 13 — Kiểm cuối

Lint và test cả backend, frontend; `npm run build` frontend; gộp commit; cập nhật Nhật ký.

---

## 9. Kiểm tra trên app thật

- Dùng DB dev có dữ liệu mẫu: ít nhất hai chủ tàu, hai tàu, năm thuyền viên, một cơ hội có ba ứng viên, một hợp đồng ACTIVE có bill đủ ba trạng thái (dựng bằng cách duyệt rồi gửi, thu một vài bill). Cách dựng dữ liệu ghi ở đầu file ca kiểm thử.
- Hôm nay của server có thể phải giả lập cho ca liên quan ngày chốt sổ; ghi rõ cách làm trong Nhật ký.
- Mỗi ca ghi kết quả vào file ca kiểm thử, không ghi ở đây.

---

## 10. Trang hướng dẫn

- File: `frontend/public/huong-dan/hop-dong-va-chuyen.html`, một trang HTML tĩnh tự chứa (CSS trong file, không gọi API, không script ngoài). Vite phục vụ `public/` ở gốc, build chép sang `dist/`.
- Viết cho **người dùng môi giới**: nói bằng nghiệp vụ, không nhắc bảng, API.
- Mọi thay đổi luồng sau này phải sửa trang này cùng commit.

---

## 11. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-10-30 | Lập kế hoạch | — | Thống nhất luồng với người dùng; wireframe, ca kiểm thử, hướng dẫn viết cùng ngày |
| 2026-11-02 | Bước 0 | — | DB dev: hợp đồng chưa xoá: 5 Hiệu lực + 1 Đã kết thúc đã nối chuyến mới (qua `legacy_contract_id`); 5 Hiệu lực + 3 Chờ duyệt + 1 Bị từ chối **chưa nối** (HĐ-2026-0001…0011, 47 bill đều Chưa gửi). Không có chuyến `TRANSFER`. 2 hợp đồng Hiệu lực đã qua ngày kết thúc. Bill: 75, tất cả Chưa gửi. ⛔ DỪNG theo 3.4: người dùng chọn "Xoá dữ liệu mẫu cũ" → xoá mềm 9 hợp đồng chưa nối chuyến và 47 bill của chúng. Nhánh `feature/hop-dong-chuyen` từ `main` |
| 2026-11-02 | Bước 1 | — | Migration `035_contract_voyage.sql` (kèm quyền `contract.end` cấp cho vai trò có `contract.approve`) chạy trên DB dev có dữ liệu: mọi hợp đồng có `legacy_contract_id` trỏ tới đã có `seafarer_voyage_id`. **Chưa chạy từ DB trống**: tài khoản DB của app không có quyền CREATE DATABASE; cần chạy `npm run migrate` trên DB sạch trước khi merge |
| 2026-11-02 | Bước 2 | — | `planBillChanges` + 11 ca test (4 mode, E đúng ngày chốt, E giữa kỳ, S qua nhiều kỳ, EXTEND từ kỳ lẻ, chốt 31 tháng 2, blocked đúng tập) |
| 2026-11-02 | Bước 3 | — | Gỡ chuyển tàu: backend `create`, `get`, `remove`, `MANUAL_REASONS`; frontend form tạo chuyến, chi tiết chuyến, hộp huỷ chốt, `voyagePrefill`. Nhãn `TRANSFER` và `TRANSFER_OUT` giữ để đọc dữ liệu cũ |
| 2026-11-02 | Bước 4 | — | `grep voyage_position` ngoài hai service hợp đồng và bill chỉ còn `seafarer.service.js` (`setActive`, đã đổi sang LEFT JOIN và coi hợp đồng không có chuyến cũ là chưa kết thúc). Phía giao diện đổi chỗ đọc `voyage_id`, `voyage_code` của hợp đồng: `SeafarerDetailPage`, ba trang bill (`bill.voyage` có thể rỗng) |
| 2026-11-02 | Bước 5, 6 | — | API hợp đồng, `revert`, `end`, `bill-plan`, duyệt lại có `expected_fingerprint`, bỏ job tự kết thúc. `server.js` trả thêm `blocked_bills` trong lỗi 4xx. `bill-plan` trả thêm `contract_range`, `bills_range` cho banner Màn 9. Fingerprint gồm kỳ, trạng thái, tổng tiền và `updated_at` của từng bill |
| 2026-11-02 | Bước 7 | — | Chốt sinh hợp đồng Nháp (`createDraftForPlacement`, trùng thì `contract_skipped`); `GET /voyages/:id/remove-preview` (quyền `voyage.delete`); `open_contract` kèm `start_date` để hộp Chốt tự so trùng; `GET /voyages?no_contract=true` cho ô Chuyến |
| 2026-11-02 | Bước 8 | — | `CountdownCheck` (ô tắt trong lúc đếm; khác `ConfirmGate`, cho tích trước) và `HelpLink`, minh hoạ ở `/design-system`. `HelpLink` đặt ở thanh trên của `AdminLayout` cho `/voyages`, `/contracts`, `/bills` |
| 2026-11-02 | Bước 9, 10 | — | Màn 1–8, 9–14 và Tạo chuyến dựng trên màn đang có. Khác wireframe: toast chốt và toast ghi rời tàu chỉ có **một** lối tắt (toast chung chỉ có một nút): chốt → "Mở hợp đồng" (hoặc "Mở chuyến" khi không có hợp đồng / thiếu quyền), ghi rời → "Mở hợp đồng" khi hợp đồng còn tới, không thì "Tạo cơ hội tìm người thay". Phản hồi `GET /contracts/:id`: `voyage` là chuyến mới, hợp đồng cũ chưa nối có `legacy_voyage`, bỏ `trip` |
| 2026-11-02 | Bước 11 | — | Đối chiếu chữ hướng dẫn với màn đã dựng: khớp; chỉ đổi ngày cập nhật. Mở được ở dev (375px không cuộn ngang) và bản build |
| 2026-11-02 | Bước 12 | — | Chạy 82 ca bằng kịch bản gọi API backend thật trên DB dev (không giả lập ngày: hôm nay là 02/11/2026 nên kỳ tháng 10 gửi được), ghi từng ca ở file ca kiểm thử. Ca chỉ có ở giao diện được kiểm bằng test component (ApproveModal, ContractDetailPage, RemoveModal, CountdownCheck, HelpLink); chưa bấm thử trên giao diện đã đăng nhập vì trình duyệt không có phiên đăng nhập. Dữ liệu thử gắn tên `[KT-HĐ2]` còn trong DB dev. ⛔ DỪNG: chờ người dùng xem bảng kết quả trước khi commit |
| 2026-11-02 | — | — | Chuyển file ca kiểm thử từ md sang `docs/mcah-testcase-hop-dong-giai-doan-2.xlsx` theo mẫu TEST_CHECKLIST; giữ nguyên kết quả lần chạy 02/11 (Đạt → Pass), dòng mới kiểm qua API / code có ghi chú "Cần kiểm lại trên giao diện" |
| 2026-11-03 | — | — | Viết lại file ca kiểm thử: 203 ca (14 chuẩn bị + 13 nhóm A–K, R hồi quy), bước đánh số với dữ liệu cụ thể, kỳ vọng ghi chữ nguyên văn trên giao diện; giữ kết quả lần chạy 02/11 cho 96 ca cũ theo mã; 107 ca mới chưa test |
| 2026-11-03 | — | — | Xoá hết kết quả lần chạy 02/11 khỏi file ca kiểm thử theo yêu cầu người dùng (kết quả đó chấm theo câu chữ cũ). Cả 203 ca chưa test |
