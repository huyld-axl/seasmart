# MCAH — Kế hoạch Báo cáo tháng (4 báo cáo, xem trên màn hình và xuất Excel)

- **Ngày lập:** 2026-11-23
- **Trạng thái:** đã dựng bước 1–8 (2026-11-23), app máy tính 0.9.11; chờ chạy tay testcase (⛔).
- **Mục tiêu:** MCAH xuất được 4 báo cáo tháng giống bộ báo cáo của hệ thống môi giới nhân sự mẫu (Nhật). Mỗi báo cáo **hiện thành bảng trên màn hình** và **xuất được file Excel**. Số trên màn hình và trong file là một.
- **Mẫu gốc** (người dùng gửi 2026-11-20, tháng mẫu 2023/10):

  | File mẫu | Báo cáo MCAH | Mã (`key`) |
  |---|---|---|
  | `202310_売上管理基礎データ.xlsx` | Dữ liệu tổng hợp | `base` |
  | `202310_取引先別売上表.xlsx` | Phải thu theo đối tác | `sales` |
  | `202310_取引先別仕入表.xlsx` | Phải chi theo đối tác | `cost` |
  | `202310_入出金予定表.xlsx` | Lịch thu chi | `cashflow` |

- **Wireframe:** `docs/design/wireframes/bao-cao.html`. **Testcase:** `docs/mcah-testcase-bao-cao.md`. **Hướng dẫn (bản nháp):** `docs/mcah-huong-dan-bao-cao.html`.
- **Dựa trên:** Trả lương (`docs/mcah-ke-hoach-tra-luong.md`, đã dựng): 14 khoản cố định, bảng Thu / Trả theo tháng, hạn trả.
- **Nhánh:** `dev`. Một commit cho cả tính năng.

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` trước. Mọi quy ước áp dụng (CommonJS không chấm phẩy, SQL tham số hoá, lỗi `{ statusCode, message }`, control theo mục 3.4, chữ giao diện tiếng Việt).
2. Làm **đúng thứ tự mục 6**. Mỗi bước có "Xong khi".
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng, chờ trả lời.
4. Chi tiết trong file mâu thuẫn với code đang có: ưu tiên code, sửa cho khớp, ghi một dòng Nhật ký.
5. Dựng trên màn và component đang có. Wireframe chỉ chốt luồng, chữ, thứ tự cột.

---

## 1. Quyết định đã chốt (2026-11-23)

| # | Quyết định |
|---|---|
| Q1 | **Chọn tháng trên màn hình.** Một ô chọn tháng dùng chung cho cả 4 báo cáo. |
| Q2 | Báo cáo lấy **mọi bill của tháng được chọn**, mọi trạng thái (chưa duyệt, đã duyệt, đã gửi, đã thu). Không có cột trạng thái (Q6). |
| Q3 | Bỏ cặp cột **có thuế / không thuế** (税抜 / 税込 / 経費等) của mẫu. Thay bằng **Khoản hằng tháng / Khoản một lần / Tổng** (theo 14 khoản cố định). |
| Q4 | Xuất **Excel** (`.xlsx`). Không làm PDF. |
| Q5 | (2026-11-23) Tên bảng: **Phải thu theo đối tác** (thay Doanh thu theo chủ tàu), Phải chi theo chủ tàu (thay Chi theo chủ tàu; sau đổi theo Q11). |
| Q6 | (2026-11-23) **Không tự thêm cột** ngoài mẫu. Lịch thu chi bỏ cột trạng thái. Cột của mẫu mà MCAH không có dữ liệu thì bỏ; cột MCAH có mà mẫu không có thì không thêm. |
| Q7 | (2026-11-23) Dữ liệu tổng hợp: khi cuộn ngang, **tên nhóm cột dính** ở mép trái tới khi hết nhóm, nhóm sau đẩy nhóm trước ra, để luôn biết đang xem mục nào. |
| Q8 | (2026-11-23, sau khi xem bản dựng) Đổi tên **Dữ liệu gốc → Dữ liệu tổng hợp**. Nhóm cột: **Yêu cầu thanh toán** (thực tế, lấy từ yêu cầu thanh toán), **Trả lương** (thực tế, lấy từ trả lương), **Lãi thực tế** = yêu cầu thanh toán trừ trả lương. **Điều kiện phải thu / phải chi** thêm các khoản tiền ghi trong hợp đồng (dự kiến); **Lãi gộp dự kiến** tính từ hai nhóm này. Cột cuối không được bị che. |
| Q9 | (2026-11-23) **Dữ liệu tổng hợp đứng đầu** (chọn báo cáo và sheet khi xuất cả 4), mở trang vào Dữ liệu tổng hợp (thay D8). Lịch thu chi: cột Thu trong ngày đổi tên **Gộp thu**. Ô gộp: số ở đầu nhóm và dính trên cùng khi cuộn qua nhóm dài; kẻ đậm đầu mỗi nhóm gộp và đầu mỗi ngày (cả dòng). Không tô nền, không vạch dọc, không chú thích số dòng (người dùng bỏ sau khi xem). Excel: ô gộp căn trên. |
| Q10 | (2026-11-23) Hai cột **Lãi thực tế** và **Lãi gộp dự kiến** làm nổi bằng khung màu nhấn hai bên, số to và đậm, lãi xanh / lỗ đỏ; **không tô nền** (người dùng: nền làm cột chìm xuống). Trong Excel chữ đậm, xanh / đỏ, không nền. Ô tiêu đề cao hai dòng có kẻ đậm màu nhấn ở dưới như các tiêu đề khác. Số tiền âm chữ đỏ. |
| Q11 | (2026-11-23) Trong báo cáo, mọi chữ "chủ tàu" thống nhất thành **"đối tác"**: bảng **Phải chi theo đối tác**, cột Đối tác, **Thu theo đối tác** (Lịch thu chi), cột Đối tác (Dữ liệu tổng hợp). |

## 2. Quy ước tự chọn (không hỏi, sửa được khi duyệt plan)

| # | Quy ước | Lý do |
|---|---|---|
| D1 | "Bill của tháng" = bill phải thu còn sống có **ngày kết thúc kỳ (`period_end`) nằm trong tháng**. Giống hệt bảng Trả lương (Q9 của trả lương) và 該当月 của mẫu (kỳ tháng 10, hạn thu tháng 11–12). | Một quy tắc cho mọi màn tiền theo tháng; mỗi hợp đồng có tối đa một bill mỗi tháng. |
| D2 | **Số Trả** ở mọi báo cáo lấy đúng số đang hiện ở bảng Trả lương: dòng đã chốt là số đã chốt, dòng chưa chốt là số mặc định từ cột Phải chi của hợp đồng. | Q2 lấy cả bill chưa xong; báo cáo khớp với màn Trả lương. |
| D3 | Báo cáo **Phải chi theo đối tác** nhóm theo **đối tác** (không theo thuyền viên). MCAH trả thẳng cho thuyền viên, không có công ty trung gian (BP) như mẫu. | Đặt cạnh Phải thu theo đối tác là ra lãi gộp từng đối tác. |
| D4 | Một cột mẫu ứng với hai thứ giống nhau ở MCAH thì gộp làm một: 支払先 (người nhận) và 対象 (người làm) của Lịch thu chi → **Thuyền viên**. | MCAH trả thẳng cho thuyền viên. |
| D5 | Bỏ các cột của mẫu mà MCAH không có dữ liệu: giờ công, tăng ca, khấu trừ, biên độ thanh toán, hệ số, chênh lệch tháng trước, thuế, số đơn đặt hàng, gia hạn, thương lưu, thể chế, loại hình tuyển dụng, công ty của nhân viên, phí chuyển khoản (手数料). **Không thêm trường mới** vào hợp đồng để có các cột này. | MCAH tính lương tháng cố định, không chấm giờ, không có bên trung gian. |
| D6 | Cột "営業担当" (người phụ trách) = **Người phụ trách hợp đồng** khi tính năng PIC (`docs/mcah-ke-hoach-nguoi-phu-trach.md`) đã dựng; trước đó là **người tạo hợp đồng**, tiêu đề cột "Người tạo HĐ". Không có cột văn phòng (app chỉ có một văn phòng). | PIC chưa dựng; không chờ. |
| D7 | Định nghĩa cột cho từng báo cáo nằm ở **một chỗ trong backend** (`constants/reports.js`). API trả kèm danh sách cột; màn hình và file Excel cùng dựng từ danh sách đó. | Số và thứ tự cột trên màn hình luôn khớp file. |
| D8 | Mở trang: báo cáo **Dữ liệu tổng hợp** (Q9), **chưa chọn tháng** (bảng trống, lời nhắc chọn tháng). Tháng và báo cáo đang xem giữ trong phiên (`useListSessionState`) và trên URL (`?r=sales&month=2026-10`). | Giống Trả lương (D6 của trả lương). Doanh thu là báo cáo hay xem nhất và gọn nhất. |
| D9 | Nút **Xuất Excel** xuất báo cáo đang xem. Menu cạnh nút có **Xuất cả 4 báo cáo** = một file, 4 sheet. | Kế toán thường cần cả bộ của một tháng. |
| D10 | Tháng không có bill: bảng trống "Tháng {MM/YYYY} không có yêu cầu thanh toán nào", nút Xuất Excel **vẫn bấm được**, file có tiêu đề và dòng tổng bằng 0. | Lưu được bằng chứng "tháng không có số". |
| D11 | `month` thiếu hoặc sai dạng: API trả bảng rỗng, **không 400** (luật bộ lọc không kiểm). | Theo luật chung của bộ lọc danh sách. |
| D12 | Dữ liệu tổng hợp có công tắc **"Hiện 14 khoản"** (`ToggleRow`), mặc định tắt: chỉ hiện Hằng tháng / Một lần / Tổng của Thu và Trả. File Excel **luôn có đủ 14 khoản**. Ngoại lệ duy nhất của D7: màn hình được ẩn bớt cột, không được khác số. | Bảng 60 cột khó đọc trên màn; file dùng để lọc, tính tiếp. |
| D13 | Điện thoại (bản web, 375px): Phải thu theo đối tác, Phải chi theo đối tác và Lịch thu chi hiện **thẻ**, chỉ chứa số có trong bảng máy tính. Dữ liệu tổng hợp **không có bảng trên điện thoại**: hiện thẻ tổng (số bill, Thu tổng, Trả tổng, Lãi gộp kỳ) và lời nhắc "Bảng này rộng, xem trên máy tính hoặc xuất Excel" kèm nút Xuất Excel. | Không cuộn ngang trang; vẫn lấy được số. |
| D14 | Quyền mới `report.view` (xem) và `report.export` (xuất Excel), có phạm vi. Phạm vi "chỉ của mình" lọc như Trả lương: bill **mình tạo** (`contract_bill.created_by`; khi PIC dựng xong thì thêm "mình phụ trách"). Migration cấp hai quyền cho vai trò đang có `payout.view`, phạm vi chép từ `payout`. | Báo cáo chứa số tiền cả hai bên; cùng nhóm người với Trả lương. |
| D15 | Tiền hiện và xuất bằng **USD**, hai số lẻ, dấu phẩy ngăn nghìn như các màn tiền khác. Không quy đổi VND. | MCAH chỉ có USD. |
| D16 | Dữ liệu tổng hợp: hai cột **Tháng, Số hợp đồng** dính bên trái; tên nhóm dính ngay sau hai cột đó (Q7). Trong file Excel: cố định hàng tiêu đề và hai cột đầu. | Cuộn ngang vẫn biết dòng nào, mục nào. |

---

## 3. Nội dung từng báo cáo

Nguồn chung: hàm `monthRows(pool, { month, ownerId })` tách ra từ `payoutService.list` (mục 4.1). Mỗi dòng = một bill phải thu của tháng, đã có: bill (kỳ, hạn, trạng thái, 14 khoản Thu), trả lương (trạng thái, ngày trả, 14 khoản Trả, hạn trả), thuyền viên, chức danh, hợp đồng, đối tác, tàu. Báo cáo chỉ đọc thêm phần hợp đồng còn thiếu (ngày, trạng thái, người tạo, kỳ thanh toán hai bên, dòng tiền hằng tháng).

Ký hiệu: **HT** = tổng 7 khoản hằng tháng, **ML** = tổng 7 khoản một lần, **Tổng** = HT + ML.

### 3.1 `base` — Dữ liệu tổng hợp (thay 売上管理基礎データ)

Mỗi dòng một bill. Sắp xếp: đối tác, thuyền viên. Tiêu đề hai tầng (nhóm cột như mẫu). Chỉ cột của mẫu mà MCAH có dữ liệu (Q6). Thực tế lấy từ yêu cầu thanh toán và trả lương; dự kiến lấy từ khoản tiền ghi trong hợp đồng (Q8).

| Nhóm | Cột | Nguồn | Cột mẫu |
|---|---|---|---|
| **Thông tin hợp đồng** | Tháng · Số hợp đồng (hai cột dính) | `month`, `contract_number` | 該当月, 受注ID |
| | Người tạo HĐ (sau này: Phụ trách) | D6 | 営業担当 |
| | Tàu · Đối tác · Thuyền viên | | 業務名称 · クライアント名 · スタッフ |
| | Ngày bắt đầu HĐ · Ngày kết thúc HĐ | `start_date`, `end_date` | 契約開始日 · 契約終了日 |
| **Yêu cầu thanh toán** (thực tế) | Kỳ từ · Kỳ đến | `period_start`, `period_end` | 対象期間 |
| | 14 khoản *(ẩn khi tắt "Hiện 14 khoản")* | `contract_bill_item` | 請求データ |
| | Thu hằng tháng · Thu một lần · Thu tổng | Cộng | 課税額小計 · 非課税額 · 請求金額 |
| **Trả lương** (thực tế) | 14 khoản *(như trên)* · Trả hằng tháng · Trả một lần · Trả tổng | D2 | 支払いデータ |
| **Lãi thực tế** (cột riêng, không nhóm) | Thu tổng − Trả tổng | Tính | 粗利（実績） |
| **Điều kiện phải thu** (dự kiến) | Chốt sổ · Ngày thanh toán · Gặp ngày nghỉ | `contract_payment_term` RECEIVABLE | 締日 · 支払日 · 金融機関休日の場合 |
| | 14 khoản *(như trên)* · Phải thu hằng tháng · Phải thu một lần · Phải thu tổng | Cột Phải thu của `contract_item` áp vào kỳ này: khoản hằng tháng mọi kỳ, khoản một lần chỉ kỳ 1 (cùng quy tắc sinh bill) | 上位との契約条件 (基本単価…) |
| **Điều kiện phải chi** (dự kiến) | Chốt sổ · Ngày thanh toán · Gặp ngày nghỉ; không có kỳ thì "—" | `contract_payment_term` PAYABLE | BPとの契約条件 |
| | 14 khoản · Phải chi hằng tháng · Phải chi một lần · Phải chi tổng | Cột Phải chi của `contract_item`, cùng quy tắc | BPとの契約条件 |
| **Lãi gộp dự kiến** (cột riêng, không nhóm) | Phải thu tổng − Phải chi tổng | Tính | 粗利（予測） |

30 cột khi tắt "Hiện 14 khoản", 86 cột khi bật. Hai cột Lãi không thuộc nhóm: trên màn và trong Excel là một ô tiêu đề cao hai dòng (tên dài không bị cắt).

Bỏ (mẫu có, MCAH không có dữ liệu): 営業担当事務所, 雇用形態, スタッフ所属企業, 初回契約日, 注文書, 契約更新, 契約商流, 契約体制, 稼働時間, 超過時間, 控除時間, 前月差異, 消費税額, 単価単位, 時間単位, 初月精算方法, 係数, 精算幅, 超過控除, 超過単価, 控除単価, 振込手数料の負担.

Dòng tổng cuối bảng: số dòng; cộng mọi cột tiền.

### 3.2 `sales` — Phải thu theo đối tác (thay 取引先別売上表)

Mỗi dòng một đối tác (đối tác) có bill trong tháng. Sắp xếp theo Tổng giảm dần. Cột đúng như mẫu.

| Cột | Cách tính | Cột mẫu |
|---|---|---|
| STT | | No |
| Tháng | `month` | 該当月 |
| Đối tác | `ship_owner.company_name` | 取引先 |
| Khoản hằng tháng | Σ Thu hằng tháng các bill của đối tác | 売上額（税抜） |
| Khoản một lần | Σ Thu một lần | 経費等（非課税） |
| **Tổng** | Σ Thu tổng | 売上額（税込） |
| Số thuyền viên | Số thuyền viên khác nhau có bill của đối tác trong tháng | 人数 |
| Tỷ lệ số người | Số thuyền viên ÷ tổng cột Số thuyền viên, làm tròn 2 số lẻ, % | 人数比率 |

Dòng **Tổng cộng**: cộng các cột tiền, cộng Số thuyền viên, 100%. Một thuyền viên đi tàu hai đối tác trong cùng tháng được đếm ở cả hai dòng (giống mẫu).

### 3.3 `cost` — Phải chi theo đối tác (thay 取引先別仕入表)

Như 3.2, cùng cột (cột thứ ba tên **Đối tác**), đổi Thu → Trả (D2, D3): Khoản hằng tháng / Khoản một lần / **Tổng** = Σ số Trả; Số thuyền viên; Tỷ lệ số người. Dòng có Tổng = 0 vẫn hiện (đối tác có bill nhưng hợp đồng chưa nhập Phải chi).

### 3.4 `cashflow` — Lịch thu chi (thay 入出金予定表)

Mỗi dòng một bill. Sắp xếp: hạn thu, đối tác, thuyền viên. Cột theo đúng mẫu, **không có cột trạng thái** (Q6).

| Cột | Cách tính | Cột mẫu |
|---|---|---|
| STT | | NO |
| Hạn thu | `due_date` | 入金日 |
| **Gộp thu** | Σ Thu tổng của mọi bill **cùng hạn thu**. Gộp ô trên màn và trong Excel | 入金額 (cột C) |
| Đối tác | | 入金元 |
| **Thu theo đối tác** | Σ Thu tổng của các bill **cùng đối tác và cùng hạn thu**. Gộp ô | 入金額 (cột E) |
| Hạn trả | `payable_due_date` | 支払日 |
| Thuyền viên | Người nhận và cũng là người làm (D4) | 支払先 + 対象 |
| Thu kỳ này | Thu tổng của bill | 入金明細 |
| Trả kỳ này | Trả tổng (D2) | 支払い明細 |
| Lãi gộp | Thu kỳ này − Trả kỳ này | 粗利 |
| Kỳ từ / Kỳ đến | | 対象期間（始）/（終） |

Bỏ: 手数料 (MCAH chưa lưu ai chịu phí chuyển khoản). Dòng tổng: Σ Thu kỳ này, Σ Trả kỳ này, Σ Lãi gộp.

---

## 4. Backend

### 4.1 Tách nguồn dữ liệu dùng chung

| File | Việc |
|---|---|
| `services/payout.service.js` | Tách phần đọc bill + dựng dòng trong `list` thành hàm `monthRows(pool, { month, ownerId })` (export). `list` gọi lại hàm này rồi lọc tab / tìm / đối tác như cũ. **Không đổi kết quả của `GET /api/v1/payouts`.** Thêm vào mỗi dòng: `contract_id`, `bill.status` (đã có). |
| `services/__tests__/payout.service.test.js` | Test cũ chạy xanh, không sửa kỳ vọng. |

### 4.2 Định nghĩa cột — `constants/reports.js`

```js
// Một cột: key (đường dẫn trong dòng), label, group (tiêu đề tầng trên), type: 'text' | 'date' | 'money' | 'int' | 'percent',
// detail: true = một trong 14 khoản (D12), merge: 'day' | 'owner' = gộp ô theo nhóm (hai cột Thu của Lịch thu chi), sticky: true = cột dính (D16).
const REPORTS = {
  base: { title: 'Dữ liệu tổng hợp', sheet: 'Du lieu tong hop', columns: [ /* mục 3.1 */ ] },
  sales: { title: 'Phải thu theo đối tác', sheet: 'Phai thu', columns: [ /* mục 3.2 */ ] },
  cost: { title: 'Phải chi theo đối tác', sheet: 'Phai chi', columns: [ /* mục 3.3 */ ] },
  cashflow: { title: 'Lịch thu chi', sheet: 'Lich thu chi', columns: [ /* mục 3.4 */ ] },
}
```

Cột 14 khoản sinh từ `DEFAULT_ITEMS` (không chép tay tên khoản). Chữ kỳ thanh toán (chốt sổ, ngày trả, ngày nghỉ) lấy cùng hàm với form hợp đồng, không viết lại.

### 4.3 `services/report.service.js`

- `build(pool, key, { month, ownerId })` → `{ key, title, month, columns, rows, totals, groups? }`.
  - `month` sai dạng / thiếu → `rows: []`, `totals` toàn 0 (D11).
  - `base`: `monthRows` + truy vấn hợp đồng (`id IN (...)`): `start_date`, `end_date`, người tạo; kỳ thanh toán hai bên; `contract_item` (14 khoản, hai cột) để tính dự kiến bằng `planAmounts` (`COALESCE(full_name, email)`), hai kỳ thanh toán, Σ khoản hằng tháng hai cột.
  - `sales`, `cost`: gộp `monthRows` theo `ship_owner.id` trong JS.
  - `cashflow`: sắp xếp, tính `day_span` (cùng hạn thu) và `owner_span` (cùng đối tác, cùng hạn thu) cho hai cột gộp: số dòng của nhóm ở dòng đầu, 0 ở các dòng sau.
- Hàm thuần đặt ở `utils/report_math.js` (có test): `sumBy(rows, pick)`, `groupByOwner(rows, side)`, `headcountShare(groups)` (làm tròn để tổng = 100% như mẫu: phần dư dồn vào dòng lớn nhất), `mergeSpans(rows, keyFn)`, `termText(term)`.

### 4.4 Excel — `utils/report_xlsx.js`

Dùng `exceljs` (đã có). `workbook(reports, meta)` nhận một hoặc 4 kết quả `build`, trả Buffer.

- Mỗi báo cáo một sheet. Dòng 1: tên báo cáo; dòng 2: "Tháng 10/2026 · xuất {ngày giờ} bởi {tên}". Dòng 3 (nếu có `group`): tiêu đề nhóm, gộp ô như mẫu. Dòng tiếp: tiêu đề cột. Rồi dữ liệu, rồi dòng Tổng (chữ đậm).
- Định dạng: tiền `#,##0.00`, ngày `dd/mm/yyyy`, % `0.00%`; cố định hàng tiêu đề và các cột `sticky` (`views: frozen`), bật lọc (`autoFilter`) trên hàng tiêu đề; độ rộng cột theo `type`.
- Hai cột Gộp thu / Thu theo đối tác của Lịch thu chi: `mergeCells` theo `day_span` / `owner_span`.
- Tên file: `MCAH_Bao-cao_{key}_{YYYY-MM}.xlsx`; cả 4: `MCAH_Bao-cao_{YYYY-MM}.xlsx`. Header `Content-Disposition` dùng `filename*=UTF-8''` như bản xuất sẵn có.

### 4.5 Quyền và route

`constants/permissions.js`, nhóm Vận hành, sau `payout`:

```js
{ key: 'report', group: 'Vận hành', label: 'Báo cáo', scoped: true, permissions: [
  ['view', 'Xem báo cáo tháng', 'Phải thu theo đối tác, phải chi theo đối tác, lịch thu chi, dữ liệu gốc'],
  ['export', 'Xuất báo cáo ra Excel'],
] },
```

Migration `053_report_permission.sql`:

```sql
-- Báo cáo tháng (docs/mcah-ke-hoach-bao-cao.md): cấp cho vai trò đang xem được bảng trả lương, phạm vi theo trả lương.
INSERT INTO "role_permission" ("role_id", "permission")
SELECT "role_id", v.p FROM "role_permission", (VALUES ('report.view'), ('report.export')) AS v(p) WHERE "permission" = 'payout.view'
ON CONFLICT DO NOTHING;
UPDATE "role" SET "scopes" = "scopes" || jsonb_build_object('report', "scopes" -> 'payout') WHERE "scopes" ? 'payout';
```

`routes/v1/report.routes.js` (đăng ký trong `routes/v1/index.js`):

| Method | Đường dẫn | Quyền | Việc |
|---|---|---|---|
| GET | `/api/v1/reports/:key` | `report.view` | `key` ∈ `base`, `sales`, `cost`, `cashflow` (khác → 404). Query `month`. Trả kết quả `build`. |
| GET | `/api/v1/reports/:key/export` | `report.view` + `report.export` | `key` như trên hoặc `all`. Trả file `.xlsx`. |

`ownerId = ownerIdFor(request, 'report')`; `monthRows` lọc `b.created_by = ownerId` như Trả lương.

---

## 5. Frontend

Theo wireframe. Dựng trên khuôn `PayoutListPage` (chọn tháng ‹ ›, `useListSessionState`, chân bảng).

| File | Việc |
|---|---|
| `api/reportApi.js` | `getReport(key, month)`, `exportReport(key, month)` (blob, lưu bằng `saveBlob` của `pages/admin/exports/download.js`; lỗi đọc bằng `downloadError`). |
| `layouts/navConfig.js` | Mục **Báo cáo**, nhóm Vận hành, sau Trả lương, `perm: 'report.view'`, icon `chart`. Cập nhật `navConfig.test.js`. |
| `App.jsx` | Route `/reports`, `guard('report.view')`. |
| `pages/admin/reports/ReportPage.jsx` | Thanh trên: `SegmentedPick` 4 báo cáo · `DateField picker="month"` + ‹ › · nút **Xuất Excel** (`Dropdown.Button`: mục phụ "Xuất cả 4 báo cáo"), ẩn khi thiếu `report.export`. Dữ liệu tổng hợp thêm `ToggleRow` "Hiện 14 khoản" (D12). |
| `pages/admin/reports/ReportTable.jsx` | antd `Table` dựng từ `columns` của API: nhóm cột (`children`) theo `group`, căn phải và định dạng theo `type`, `rowSpan` cho cột `merge`, `Table.Summary` cho dòng tổng, `scroll.x`, cột `sticky` → `fixed: 'left'`. Không phân trang. Ô số hợp đồng / đối tác / thuyền viên là link sang chi tiết. **Tên nhóm dính (Q7, D16):** tiêu đề nhóm render `<span className="report-group-label">` với `position: sticky; left: <tổng bề rộng các cột fixed>` (đo sau khi bảng vẽ, cập nhật khi bật / tắt 14 khoản); span nằm trong ô gộp nên dừng ở mép phải nhóm và bị nhóm sau đẩy ra. Nếu antd chặn sticky trong ô tiêu đề (overflow) thì nới đúng ô đó, ghi Nhật ký. |
| `pages/admin/reports/reportCards.jsx` | Điện thoại (D13): thẻ `ListCard` cho `sales`, `cost`, `cashflow`; `base` chỉ thẻ tổng + lời nhắc + nút Xuất. |
| `pages/admin/reports/reportView.js` | Định dạng số / ngày / % dùng chung cho bảng và thẻ; có test. |

Trạng thái trống:
- Chưa chọn tháng: "Chọn tháng để xem báo cáo." (giống Trả lương).
- Tháng không có bill: D10.
- Đang tải: khung xương bảng như các danh sách khác.

---

## 6. Các bước dựng

Mỗi bước chạy lint + test phần vừa sửa.

| Bước | Việc | Xong khi |
|---|---|---|
| 1 | Tách `monthRows` khỏi `payoutService.list` (4.1) | Test trả lương cũ xanh; `GET /api/v1/payouts` trả y như trước (so JSON một tháng có dữ liệu trước / sau) |
| 2 | `constants/reports.js`, `utils/report_math.js` + test | Tỷ lệ số người tổng đúng 100%; `mergeSpans` đúng với nhóm 1, 2, 3 dòng; `termText` đúng mọi tổ hợp kỳ thanh toán |
| 3 | `services/report.service.js` + test trên DB thật (transaction, rollback) | 4 báo cáo khớp số với bảng Trả lương cùng tháng; tháng trống trả rỗng; `month` sai trả rỗng |
| 4 | `utils/report_xlsx.js` + test (đọc lại file bằng exceljs) | Đủ sheet, tiêu đề nhóm gộp ô, dòng tổng đúng, ô Thu gộp gộp đúng, số định dạng tiền |
| 5 | Quyền `report.*`, migration `053_report_permission.sql`, `report.routes.js` + test route | Thiếu `report.view` 403; thiếu `report.export` thì export 403; `key` lạ 404; phạm vi "của mình" chỉ thấy bill mình tạo |
| 6 | Frontend máy tính: API, nav, route, `ReportPage`, `ReportTable` | Chạy trên app dev với dữ liệu thật một tháng: 4 bảng đúng thứ tự cột wireframe, không cột nào ngoài mục 3; Dữ liệu tổng hợp cuộn ngang thì tên nhóm dính đúng; Xuất Excel tải đúng tên file |
| 7 | Frontend điện thoại (D13) | 375px không cuộn ngang trang; 1440px không đổi |
| 8 | Hướng dẫn: chép `docs/mcah-huong-dan-bao-cao.html` vào `frontend/public/guide/index.html` mục `#bao-cao` sau `#tra-luong`, thêm vào mục lục | Mục lục và lọc theo công việc (Kế toán, Duyệt & quản lý) thấy mục mới |
| ⛔ | **DỪNG** — chạy tay `docs/mcah-testcase-bao-cao.md`, ghi kết quả, báo người dùng | Mọi ca Đạt hoặc có ghi chú |
| Z | Build app máy tính `npm run dist:linux` (luật phiên bản trong `docs/mcah-quy-trinh-phat-hanh.md`) | Build thành công |

## 7. Không làm lần này

- PDF, in trực tiếp, gửi báo cáo qua email.
- Báo cáo theo khoảng nhiều tháng, theo năm, so sánh tháng trước.
- Biểu đồ.
- Thêm trường mới vào hợp đồng cho các cột mẫu không có dữ liệu (D5): giờ công, thuế, số đơn đặt hàng, phí chuyển khoản…
- Quy đổi VND.
- Đưa số báo cáo vào Tổng quan / KPI.

## 8. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-11-23 | — | — | Đọc 4 file mẫu, đối chiếu cột với MCAH. Người dùng chốt Q1–Q4. Lập kế hoạch, wireframe, testcase, bản nháp hướng dẫn. |
| 2026-11-23 | — | — | Người dùng chốt Q5–Q7: đổi tên hai bảng; bỏ mọi cột tự thêm (trạng thái, Trong đó đã thu / đã trả, mã bill, chức danh, hạn thu, trạng thái HĐ…); Lịch thu chi theo đúng cột mẫu (thêm Gộp thu); điều kiện thanh toán tách 3 cột như mẫu; tên nhóm cột Dữ liệu tổng hợp dính khi cuộn ngang. Wireframe sửa theo, ảnh chụp ở `docs/design/wireframes/bao-cao-anh/`. |
| 2026-11-23 | 1–8 | xem git log (0.9.11) | Dựng xong. Backend: `monthRows` tách khỏi Trả lương (test cũ xanh), `constants/reports.js`, `utils/report_math.js`, `services/report.service.js`, `utils/report_xlsx.js`, `routes/v1/report.routes.js`, quyền `report.view` / `report.export`, migration 053 (đã chạy trên DB local). Frontend: `/reports`, menu Báo cáo, `ReportPage` (bảng từ cột của API, tên nhóm dính khi cuộn ngang, thẻ điện thoại), hướng dẫn `#bao-cao` (Rời tàu thành Vận hành · 08). Số định dạng kiểu Việt Nam như các màn khác (8.750,00). Kiểm: backend 648 test, frontend 519 test; trên app dev tháng 10/2026 (26 bill) tổng 4 báo cáo khớp bảng Trả lương (Thu 48.790, Trả 42.180); tên nhóm dính ở 242px sau 2 cột dính khi cuộn; gộp ô Lịch thu chi đúng; xuất 1 báo cáo và cả 4 đúng tên file; 375px không tràn ngang. Lint frontend còn 1 lỗi có sẵn ở `OwnershipFields.jsx` (không thuộc tính năng này). |
| 2026-11-23 | Q8 | xem git log | Sau khi xem bản dựng: đổi tên Dữ liệu tổng hợp; nhóm Yêu cầu thanh toán / Trả lương; Lãi thực tế; điều kiện phải thu / phải chi thêm 14 khoản hợp đồng (dự kiến) + 3 cột cộng; Lãi gộp dự kiến = phải thu tổng − phải chi tổng; hai cột Lãi là ô tiêu đề cao hai dòng (hết bị cắt chữ); dòng tổng bù bề rộng thanh cuộn dọc để số cuối thẳng cột. Wireframe mục 4 chưa vẽ lại theo Q8; mục 3.1 ở đây là bản đúng. |
| 2026-11-23 | — | — | Sau khi có người phụ trách (`mcah-ke-hoach-nguoi-phu-trach.md`): Dữ liệu tổng hợp đổi cột "Người tạo HĐ" thành **Phụ trách** = người phụ trách bill (D6). Lịch thu chi: "Đối tác" → **Nguồn thu**, "Thuyền viên" → **Người nhận tiền**, thêm cột **Phụ trách** (người phụ trách bill) sau Người nhận tiền. |
