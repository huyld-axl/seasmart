# MCAH — Kế hoạch luồng duyệt yêu cầu thanh toán (bill)

- **Ngày lập:** 2026-11-02
- **Trạng thái:** chờ duyệt, chưa viết code.
- **Mục tiêu:** bill phải được duyệt (xác minh) rồi mới gửi được. Bill đã duyệt thì khoá, không sửa được. Luồng phải khớp với sửa ngày bắt đầu / kết thúc hợp đồng, Ghi rời tàu và tạo lại hợp đồng (xem `docs/mcah-ke-hoach-hop-dong-giai-doan-2.md`).

## 1. Luồng trạng thái

Cột `status` thêm giá trị `APPROVED` (Đã duyệt), nằm giữa `OPEN` và `SENT`:

```
OPEN (Chưa duyệt) ──Duyệt──▶ APPROVED ──Gửi──▶ SENT ──Thu──▶ PAID
      ▲                          │               │            │
      │◀────── Bỏ duyệt ─────────┘               │            │
      │◀────── Thu hồi ──────────────────────────┘            │
                                         Huỷ ghi nhận thu: PAID → SENT
```

| Hành động | Từ → Đến | Điều kiện | Quyền |
|---|---|---|---|
| Duyệt | OPEN → APPROVED | Từ ngày chốt sổ (`today >= period_end`); người duyệt khác người sửa gần nhất | `bill.approve` (mới) |
| Bỏ duyệt | APPROVED → OPEN | Chưa gửi | `bill.approve` |
| Gửi | **APPROVED** → SENT | Đã duyệt (trước đây từ OPEN) | `bill.send` |
| Thu hồi | SENT → **OPEN** | Thu hồi là để sửa nên bill phải qua duyệt lại | `bill.send` |
| Thu / Huỷ ghi nhận thu | giữ nguyên | | `bill.collect` |

- **Không có bước "Gửi duyệt".** Bill sinh tự động khi duyệt hợp đồng nên mặc định đã ở trạng thái chờ duyệt.
- **Người duyệt phải khác người sửa.** Bill từng được sửa số tiền hoặc ghi chú thì người sửa gần nhất (theo log `UPDATE`) không được duyệt bill đó; người khác có `bill.approve` mới duyệt được. Bill chưa ai sửa thì ai có quyền cũng duyệt được.
- **Sửa số tiền, ghi chú chỉ khi `OPEN`** (đã đúng trong code: `update` chặn mọi trạng thái khác). Bill đã duyệt phải Bỏ duyệt rồi mới sửa.
- Mỗi lần Duyệt / Bỏ duyệt ghi log bill (`APPROVE`, `UNAPPROVE`) và lưu `approved_at`, `approved_by` (xoá khi Bỏ duyệt hoặc Thu hồi).

### Nhãn hiển thị (tính ra, không có job)

| Điều kiện | Nhãn |
|---|---|
| PAID | Đã thu |
| SENT, quá `due_date` | Quá hạn |
| SENT | Đã gửi |
| APPROVED | Cần gửi |
| OPEN, `today < period_end` | Chưa đến kỳ |
| OPEN, `today >= period_end` | **Cần duyệt** (mới) |


## 2. Ảnh hưởng đến các luồng hợp đồng

Quy tắc chặn hiện có: khi duyệt lại hợp đồng, bill bị ảnh hưởng phải là `OPEN`, nếu không thì chặn và liệt kê (`planBillChanges`: `status !== 'OPEN'` → `blocked`). **`APPROVED` tự rơi vào nhóm bị chặn** vì không phải `OPEN`; không đổi logic, chỉ đổi chữ.

| Luồng | Xử lý |
|---|---|
| **Sửa ngày bắt đầu (S)** | Mọi bill phải `OPEN`. Có bill `APPROVED` → chặn, liệt kê, người dùng Bỏ duyệt từng bill (hoặc hàng loạt) rồi duyệt lại hợp đồng |
| **Sửa ngày kết thúc (E) sớm hơn** | Bill bị cắt hoặc xoá mềm phải `OPEN`. Bill ở kỳ không bị đụng giữ nguyên trạng thái, kể cả đã duyệt |
| **Sửa E muộn hơn** | Bill cũ giữ nguyên (đã duyệt vẫn đã duyệt). Bill mới sinh ra ở `OPEN` |
| **Đưa hợp đồng về Nháp** | Giữ quyết định cũ: không đụng bill, bill vẫn Gửi / Thu được. Bill đã duyệt vẫn là đã duyệt. Việc chặn xảy ra ở lần duyệt lại |
| **Tạo lại hợp đồng** (Đưa về Nháp → sửa → duyệt lại; hoặc huỷ chuyến) | Duyệt lại theo hai dòng trên. Huỷ chuyến vẫn bị chặn khi hợp đồng đã có bill (`splitContractsForRemoval`), không đổi |
| **Ghi rời tàu** | Không đụng bill (hướng B: ngày chuyến không chạm hợp đồng và bill). Không có việc gì thêm |
| **Bill mới sinh khi duyệt hợp đồng lần đầu** | `OPEN` (Chưa duyệt) |
| **Hộp xác nhận khi duyệt lại hợp đồng** | Liệt kê bill bị chặn kèm trạng thái "Đã duyệt"; thêm nút **Bỏ duyệt các bill này** nếu có `bill.approve`, để khỏi đi từng bill |

Thông báo chặn mới: *"Các yêu cầu thanh toán sau đã duyệt, đã gửi hoặc đã thu: … Huỷ ghi nhận thu, thu hồi, bỏ duyệt rồi thử lại."*

## 3. Phần việc

### Backend
1. **Migration `037_bill_approval.sql`:**
   - `contract_bill_status_check` thêm `'APPROVED'`.
   - `contract_bill_log_action_check` thêm `'APPROVE'`, `'UNAPPROVE'`.
   - Thêm cột `approved_at`, `approved_by` (+ check: `status` là `APPROVED` / `SENT` / `PAID` thì `approved_at` có giá trị).
   - Cấp quyền `bill.approve` cho vai trò đang có `contract.approve` (cách đã làm với `contract.end`).
   - Dữ liệu cũ: bill `OPEN` giữ nguyên là chưa duyệt; bill `SENT` / `PAID` điền `approved_at = sent_at` để khớp check, `approved_by = sent_by`.
2. **`constants/permissions.js`:** thêm `['approve', 'Duyệt và bỏ duyệt']` vào mục `bill`.
3. **`contract_bill.service.js`:**
   - `TRANSITIONS`: thêm `approve`, `unapprove`; `send` đổi `from` thành `APPROVED`; `unsend` đổi `to` thành `OPEN` và xoá `approved_*`.
   - `DISPLAY_SQL` và `billDisplayStatus` (`utils/voyage_math.js`): thêm `TO_APPROVE`; `APPROVED` → `TO_SEND`.
   - `approve` chặn nếu chưa tới `period_end`; `STATUS_LABELS` thêm `APPROVED: 'Đã duyệt'`; `counts` và tab có `TO_APPROVE`.
4. **`seafarer_contract.service.js`:** `BILL_STATUS_LABELS` thêm `APPROVED`; đổi chữ trong `assertNotBlocked`; cột `has_sent_or_paid` (dòng 227) rà xem có cần tính cả `APPROVED` không (hiện chỉ để hiện cảnh báo, kiểm khi làm).
5. **`contract_bill.routes.js`:** route `approve` / `unapprove` dùng `bill.approve`; thêm `POST /bills/bulk-unapprove` (danh sách id, trong một transaction, cùng phạm vi dữ liệu) cho nút ở hộp duyệt lại hợp đồng.

### Frontend
6. **`statusMap.js`:** nhãn `TO_APPROVE` "Cần duyệt" (tông cảnh báo), `APPROVED` nếu cần hiện ở chi tiết ("Đã duyệt").
7. **Danh sách bill:** thêm tab "Cần duyệt". Tab mặc định: "Cần duyệt" nếu người dùng có `bill.approve`, ngược lại "Cần gửi". Nút nhanh ở cột thao tác: Cần duyệt → **Duyệt**, Cần gửi → **Gửi** (đã có), Đã gửi / Quá hạn → **Thu** (đã có).
8. **Chi tiết bill:** nút Duyệt, Bỏ duyệt (menu thao tác khác), Gửi chỉ khi đã duyệt, Sửa chỉ khi chưa duyệt; dòng lịch sử `APPROVE`, `UNAPPROVE`; 
9. **Hộp duyệt lại hợp đồng:** hiện bill bị chặn do đã duyệt kèm nút Bỏ duyệt hàng loạt.
10. **Hướng dẫn trong app** (`hop-dong-va-chuyen.html`): thêm mục luồng duyệt bill, cập nhật bảng "Khi bị chặn" và các nhãn cảnh báo.
11. **Ghi nhớ:** cập nhật plan hợp đồng giai đoạn 2 (mục chặn bill) trỏ về file này.

## 4. Testcase

| # | Tình huống | Kết quả mong đợi |
|---|---|---|
| 1 | Duyệt hợp đồng lần đầu, sinh bill | Mọi bill `OPEN`, nhãn Chưa đến kỳ |
| 2 | Qua ngày chốt sổ, bill chưa duyệt | Nhãn Cần duyệt, có trong tab Cần duyệt; **không** có trong Cần gửi |
| 3 | Duyệt bill trước ngày chốt sổ | 409 "Chưa đến ngày chốt sổ" |
| 4 | Duyệt bill đủ điều kiện, người có `bill.approve` | `APPROVED`, ghi log và `approved_by`; nhãn Cần gửi |
| 5 | Người không có `bill.approve` gọi duyệt | 403; nút không hiện |
| 6 | Gửi bill `OPEN` (chưa duyệt) bằng API | 409, nói rõ cần duyệt trước |
| 7 | Gửi bill đã duyệt | `SENT`; `approved_*` giữ nguyên |
| 8 | Sửa số tiền bill đã duyệt | 409, không sửa; nút Sửa ẩn |
| 9 | Bỏ duyệt bill chưa gửi | Về `OPEN`, xoá `approved_*`, sửa lại được |
| 10 | Bỏ duyệt bill đã gửi | 409 (dùng Thu hồi) |
| 11 | Thu hồi bill đã gửi | Về `OPEN` (chưa duyệt), phải duyệt lại mới gửi lại |
| 12 | Huỷ ghi nhận thu rồi Thu hồi | PAID → SENT → OPEN |
| 13 | Sửa S, có bill `APPROVED` | Chặn khi lưu ngày và khi duyệt lại; liệt kê bill "Đã duyệt" |
| 14 | Sửa E sớm, bill bị cắt đang `APPROVED` | Chặn; bill ở kỳ không bị đụng giữ nguyên trạng thái |
| 15 | Sửa E sớm, chỉ kỳ không bị đụng đã duyệt | Cho duyệt lại, cắt / xoá các kỳ `OPEN` |
| 16 | Sửa E muộn, bill cũ đã duyệt | Giữ bill cũ đã duyệt, bill mới `OPEN` |
| 17 | Bỏ duyệt hàng loạt từ hộp duyệt lại, rồi duyệt hợp đồng | Mọi bill bị chặn về `OPEN`, duyệt hợp đồng được trong cùng hộp |
| 18 | Đưa hợp đồng về Nháp khi có bill đã duyệt | Bill không đổi, vẫn Gửi được |
| 19 | Ghi rời tàu khi có bill đã duyệt | Bill không đổi |
| 20 | Huỷ chuyến có hợp đồng đã có bill | Vẫn bị chặn như cũ |
| 21 | Người đã sửa bill tự duyệt | 409 "Người sửa không được duyệt"; nút Duyệt ẩn / tắt kèm giải thích; người khác duyệt được |
| 22 | Dữ liệu cũ sau migration | Bill `SENT` / `PAID` giữ nguyên, `OPEN` cũ là Chưa duyệt, không vi phạm check |
| 23 | Hai người cùng bấm Duyệt một bill | Một thành công, một nhận 409 trạng thái đã đổi |

## 5. Thứ tự làm đề xuất

Migration + quyền → backend (chuyển trạng thái, nhãn hiển thị, đổi chữ chặn) kèm test → route bỏ duyệt hàng loạt → frontend danh sách và chi tiết → hộp duyệt lại hợp đồng → hướng dẫn trong app. Một commit cho mỗi bước.

## 6. Đã chốt (2026-11-02)

- Thu hồi đưa bill về **Chưa duyệt**.
- Người duyệt **khác** người sửa; không có bước Gửi duyệt riêng.
- Duyệt chỉ từ ngày chốt sổ; tab mặc định theo quyền.
- **Không** làm nhãn "Trễ n ngày".
- Bill cũ đang `OPEN` coi là chưa duyệt (duyệt lại một lượt).
