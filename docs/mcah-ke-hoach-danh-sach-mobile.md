# MCAH — Kế hoạch thiết kế lại danh sách trên điện thoại

- **Ngày lập:** 2026-11-09
- **Trạng thái:** wireframe đã duyệt, mục 8 đã chốt theo đề xuất (2026-11-09). **Chưa viết code**, chờ người dùng bảo bắt đầu.
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự.
- **Wireframe:** `docs/design/wireframes/danh-sach-mobile.html` (kiểu thẻ chung, Yêu cầu thanh toán, Hợp đồng, Cơ hội, Chuyến, Thuyền viên).
- **Testcase tay:** `docs/mcah-testcase-danh-sach-mobile.md`.
- **Hướng dẫn trong app:** cập nhật `frontend/public/huong-dan/dien-thoai.html` (bước 7).
- **Nhánh:** `dev`. Không tạo nhánh mới. Commit chỉ `git add` file của bước đang làm.

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` (nhất là mục 3.4, 3.5) trước khi viết code.
2. Làm **đúng thứ tự các bước ở mục 7**. Mỗi bước có phần "Xong khi"; chỉ sang bước sau khi mọi ý đúng.
3. Sau mỗi bước: lint và test frontend, **một commit cho một bước**, message tiếng Việt. Gộp sửa nhỏ trong bước trước khi push. Không push khi chưa được bảo.
4. Gặp **⛔ DỪNG** thì dừng, gửi đúng thứ được yêu cầu, chờ trả lời.
5. Code khác với file này (tên class, tên trường) thì theo code, sửa cho khớp, ghi một dòng vào Nhật ký.
6. **Desktop không đổi.** Mọi thay đổi chỉ áp khi `useViewport().isCompact` (dưới 768px), đúng chỗ các trang đang rẽ nhánh `isMobile`. Chụp 1440px trước và sau ở trang đã sửa.
7. Thấy dữ liệu dev phải bấm thao tác thật (Duyệt, Gửi, Ghi nhận đã thu) thì **đọc `onClick` trước, không bấm thử** trên DB dev; các nút này ghi ngay.

---

## 1. Mục tiêu

Ở điện thoại, môi giới viên lướt danh sách và **biết ngay từng thông tin là gì** mà không phải đoán: đâu là tàu, chủ tàu, kỳ, hạn, tiền bao nhiêu, trễ hay không. Việc kế tiếp (duyệt, gửi, ghi nhận đã thu, ghi rời tàu) làm được ngay trên danh sách.

### 1.1 Hiện trạng (đo 09/11/2026, app dev, tài khoản demo, 375×812)

- 8 trang dùng chung `crew-list` / `crew-list__row` + `ds-cell2`: mỗi dòng 2–3 hàng chữ nối bằng " · ", **không nhãn**.
- Yêu cầu thanh toán: "HĐ-2026-0034 · MV Mekong Star · Halong Maritime …" bị cắt ở 375px; hàng ngày "Kỳ 9/9 · 01/07/2027 → 02/07/2027 · hạn 10/08/2027" gộp kỳ thu và hạn; số tiền "1.900" không đơn vị, nằm dưới cùng cạnh badge.
- Hợp đồng: "+250" không ghi là chênh lệch / tháng; chủ tàu không hiện; "0" trông như lỗi.
- Chuyến: cảnh báo "Quá 7 ngày chưa rời" lẫn cuối hàng ngày.
- Lọc trạng thái là ô chọn "Trạng thái: Tất cả · 44": phải mở ra mới thấy số đếm các mục khác.

### 1.2 Thế nào là xong

Ở 360 và 375px, trên mọi trang mục 5:

1. Mỗi thẻ có tên chính, dòng phụ, badge; mọi thông tin còn lại nằm trong ô **có nhãn**. Không còn hàng chữ nối " · " ngoài dòng phụ.
2. Số tiền luôn có đơn vị (USD, USD/th).
3. Cảnh báo (quá hạn, sắp hết hạn, chưa ghi rời) là dải màu riêng, không lẫn trong hàng chữ.
4. Không cuộn ngang; chữ dài cắt bằng "…" trong ô, không đẩy bố cục.
5. Nút trên thẻ ≥ 44px cao; bấm nút không mở chi tiết; bấm phần còn lại mở chi tiết.
6. 1440px giống trước.

---

## 2. Phạm vi

### 2.1 Làm

- Component mới `ListCard` (+ `ListCardList`) trong `components/ds/`, minh hoạ ở `/design-system`.
- `StatusTabs` thêm chế độ hàng chip cho trang danh sách ở điện thoại.
- Áp vào 7 danh sách: Yêu cầu thanh toán, Hợp đồng, Cơ hội, Chuyến, Thuyền viên, Tàu, Đối tác; Danh mục nếu cùng khuôn.
- Nút việc kế tiếp trên thẻ YCTT, Hợp đồng, Chuyến.
- CLAUDE.md mục 3.4 thêm dòng `ListCard`; cập nhật hướng dẫn điện thoại.

### 2.2 Không làm

- Không đổi bảng desktop, API, quyền, nghiệp vụ. **Không thêm trường mới vào API danh sách**: thẻ chỉ dùng dữ liệu mà danh sách đang trả (xem mục 5 từng màn). Ngoại lệ duy nhất nếu mục 8 câu 6 đồng ý: trả thêm `paid_date` (đã có trong câu SQL) ở danh sách YCTT.
- Không đổi Tài khoản (đã dùng `RowList`), các bảng trong trang chi tiết, danh sách trong Tổng quan.
- Không làm vuốt thẻ (swipe action), không chọn nhiều thẻ.

---

## 3. Kiểu thẻ `ListCard`

File `components/ds/ListCard.jsx`, CSS trong `ds.css` (lớp `ds-lcard*`). Chỉ dùng ở điện thoại; trang vẫn tự rẽ nhánh `isMobile`.

```jsx
<ListCardList>              // <ul> có khoảng hở 10px, padding 12px; thay <ul className="crew-list">
  <ListCard
    title="Đỗ Mạnh Cường"     // 16px đậm, một dòng, cắt "…"
    figure={{ value: '1.595', unit: 'USD', tone: 'pos' | 'neg' | 'muted' }}  // tuỳ chọn, góc phải
    sub={<>Kỳ 10/10 · <span className="ds-mono">TT-2026-00067</span></>}     // 13px xám, một dòng
    badge={<StatusBadge … />}
    media={<CrewThumb … />}  // tuỳ chọn, ảnh 40px trước tiêu đề (Thuyền viên, Đối tác)
    fields={[                 // tối đa 4; null / '' thì bỏ ô
      { label: 'Tàu', value: 'MV Ocean Glory' },
      { label: 'Hạn thanh toán', value: '12/07/2027', tone: 'err' | 'warn', wide: false },
    ]}
    extra={<MoneyStrip … />} // tuỳ chọn, khối dưới các ô (dải Thu − Chi của hợp đồng)
    alert={{ text: 'Quá hạn 5 ngày, chưa thu', tone: 'err' | 'warn' }}
    actions={[{ label: 'Ghi nhận đã thu', onClick, danger, disabled }]}  // tối đa 2
    onOpen={() => navigate(…)}
    openLabel="Mở yêu cầu thanh toán TT-2026-00067"
  />
</ListCardList>
```

- Thẻ: nền `--surface`, viền `--border`, bo 14px. Phần thân (tiêu đề → extra) là **một `<button>` phủ** (giống `crew-list__row` hiện nay) để cả thẻ bấm được và đọc được bằng trình đọc màn hình; `aria-label` = `openLabel`.
- Ô: lưới 2 cột, kẻ đứt phía trên; nhãn 11.5px `--muted`, giá trị 14px 500, một dòng cắt "…". `wide` chiếm cả hàng.
- Dải cảnh báo: nằm giữa thân và nút, nền `--error-bg` / `--warning-bg`.
- Nút: hàng dưới cùng, viền trên, mỗi nút 44px chia đều, chữ `--primary` (danger thì `--error-strong`). Là `<button>` riêng ngoài nút phủ, không lồng nút trong nút.
- `figure.tone`: `pos` xanh, `neg` đỏ, `muted` xám, không có thì `--foreground`.
- Không vẽ ô trống: `fields` lọc `value == null || value === ''`.

`/design-system` thêm mục "Thẻ danh sách": 4 ví dụ đúng như mục "Kiểu thẻ chung" của wireframe (có tiền + cảnh báo + nút; có dải tiền; có ảnh; tối thiểu chỉ tiêu đề + badge).

## 4. Lọc trạng thái dạng chip

`StatusTabs` thêm prop `phone="chips"` (mặc định `"select"` như cũ, các trang chi tiết dùng "Mục:" không đổi). Khi `phone="chips"` và màn dưới 768px: không render `Select`, hiện `ds-tabs-boxed` trong `ScrollRow` (cuộn ngang, có số đếm, chấm đỏ giữ nguyên), chip cao 36px, vùng bấm 40px. Chip đang chọn cuộn vào giữa khi mở trang.

Lọc phụ đang nằm thành ô chọn trên thanh công cụ ở điện thoại (YCTT: "Tất cả chủ tàu") chuyển vào `ListFilters` (BottomSheet "Bộ lọc") như Hợp đồng đang làm; nút lọc hiện số điều kiện.

---

## 5. Màn hình

Cột "Nguồn" là trường trên dòng API đang có; tên lấy từ code ngày lập plan.

### 5.1 Yêu cầu thanh toán — `pages/admin/bills/BillListPage.jsx`

| Phần | Nội dung | Nguồn |
|---|---|---|
| title | Tên thuyền viên | `seafarer.full_name` |
| figure | `formatUsd(total_usd)` + "USD" | `total_usd` |
| sub | "Kỳ {seq}/{periods} · {code}" | `seq`, `periods`, `code` |
| badge | như desktop (`badge(row)`, có nhãn quá hạn) | `display_status` |
| Tàu | tên tàu | `vessel.vessel_name` |
| Chủ tàu | tên công ty (ẩn khi trang lọc sẵn theo chủ tàu: `shipOwnerId`) | `ship_owner.company_name` |
| Kỳ thu | "dd/mm – dd/mm/yyyy" (cùng năm thì bỏ năm đầu) | `period_start`, `period_end` |
| Hạn thanh toán / Đã thu ngày | PAID: "Đã thu ngày" + `paid_date`; OVERDUE: tone `err`. `paid_date` có trong `BILL_SELECT` nhưng hàm `summary()` của `contract_bill.service.js` chưa trả ra ở danh sách: mục 8 câu 6 | `due_date`, `paid_date` |
| alert | OVERDUE: `overdueLabel(row)` + ", chưa thu", tone err | |
| actions | đúng `quickAction` desktop: Cần duyệt → "Duyệt"; Cần gửi → "Đánh dấu đã gửi"; Đã gửi / Quá hạn → "Ghi nhận đã thu" (mở `CollectModal`). Theo quyền như desktop | |

Bỏ số hợp đồng khỏi thẻ (vẫn tìm được bằng ô tìm). Chân danh sách: `ListFooter` đã có `note` tổng USD; ở điện thoại hiện "n yêu cầu · Tổng X USD" một dòng.

Tách `quickAction` thành hàm trả `{ label, run }` để desktop (icon + Tooltip) và thẻ (nút chữ) dùng chung một nguồn quyết định.

### 5.2 Hợp đồng — `pages/admin/contracts/ContractListPage.jsx`

| Phần | Nội dung | Nguồn |
|---|---|---|
| title | Tên thuyền viên | `seafarer_name` |
| figure | `formatDiff(diff_monthly)` + "USD/th"; dương `pos`, âm `neg`, 0 hoặc chưa có tiền `muted` | `diff_monthly` |
| sub | "{chức danh} · {số HĐ}" | `rank_name`, `contract_number` |
| badge | `StatusBadge group="contract"` | `status` |
| Tàu | | `vessel_name` |
| Chủ tàu | | `ship_owner_name` |
| Thời hạn (wide) | "dd/mm/yyyy → dd/mm/yyyy · N tháng"; Hiệu lực và còn ≤ 30 ngày: "· còn N ngày", tone warn | `start_date`, `end_date` |
| extra | `MoneyStrip`: "Thu {receivable} − Chi {payable} = {diff} USD/tháng"; cả hai chưa có: "Chưa nhập tiền" | `receivable_monthly`, `payable_monthly` |
| alert | Hiệu lực, còn ≤ 7 ngày: "Hết hạn sau N ngày", warn | |
| actions | Chờ duyệt + quyền duyệt: "Duyệt" (mở `ApproveModal`) và "Từ chối" (danger, mở `RejectModal`), cả hai đã là file riêng trong `pages/admin/contracts/`. Nháp / Bị từ chối + `contract.update`: "Sửa nháp" → `/contracts/:id/edit`. Khác: không nút | |

Ngưỡng 30 / 7 ngày: xem mục 8 câu 3.

### 5.3 Cơ hội — `pages/admin/opportunities/OpportunityListPage.jsx`

title = `rank_name`; sub = `code`; badge = `display_status`; ô: Tàu (`vessel_name` hoặc "Chưa rõ tàu"), Chủ tàu, Xuống tàu dự kiến (`planned_join_date`), ô thứ 4: có `chosenCandidate(row)` → "Người được chọn"; không thì "Ứng viên" = số ứng viên nếu dòng có sẵn (không có thì bỏ ô). alert: hạn chốt quá hạn, dùng cùng hàm cờ hạn mà trang chi tiết dùng (`flag`), tone err. Không có nút.

### 5.4 Chuyến — `pages/admin/voyages/VoyageListPage.jsx`

title = `seafarer_name`; sub = "{rank_name} · {code}"; badge trạng thái chuyến (desktop đang có thì dùng lại); ô: Tàu, Lên tàu (`join_date`), Rời tàu dự kiến / Rời tàu (wide, `leaveCell(row)`), tone theo `leaveFlagLabel(row.leave_flag)`. alert: `flag.text` khi có cờ. actions: "Ghi rời tàu" khi đang trên tàu và có quyền, mở đúng dialog ghi rời đang dùng ở chi tiết chuyến; nếu dialog đó không tách được khỏi trang chi tiết thì bỏ nút, ghi Nhật ký.

### 5.5 Thuyền viên — `pages/admin/SeafarerListPage.jsx`

media = `CrewThumb`; title = `full_name`; sub = chức danh (hoặc "Chưa có chức danh"); badge = `status`; ô: "Tàu hiện tại" (`vesselNow(row)`) khi trên tàu. alert: `pending_review_count > 0` → "{n} giấy tờ chờ duyệt", warn. Không thêm điện thoại / chứng chỉ sắp hết hạn (wireframe chỉ ví dụ; danh sách không trả các trường này — mục 8 câu 4).

### 5.6 Tàu, Đối tác, Danh mục

Tàu: title tên tàu, sub loại tàu, ô "Chủ tàu", "IMO" (hiện có). Đối tác: media logo / chữ viết tắt đang có, title tên, badge, ô "Quốc gia" khi có. Danh mục (`MasterSubPage`): chỉ đổi nếu đang dùng `crew-list`; nếu là khuôn khác thì để nguyên, ghi Nhật ký.

---

## 6. Quy ước khi code

- Không định dạng lại ngày / tiền trong `ListCard`; trang truyền chuỗi đã định dạng (`formatDate`, `formatUsd`, `formatDiff`).
- Hàm quyết định nút (`billNextAction(row, can)`, `contractNextAction(row, can)`) đặt cạnh file view sẵn có (`billView.js`, `contractView.js`) và có test thuần.
- Hết dùng `crew-list` ở trang nào thì gỡ import CSS thừa; xoá quy tắc `crew-list*` trong `SeafarerListPage.css` chỉ khi không còn nơi nào dùng (`exports.css` đang dùng: kiểm trước).
- Mốc chỉ dùng 640 / 768 / 1024 (test `breakpoints.test.js`).

---

## 7. Các bước

### Bước 0 — Chốt câu hỏi mở
Đã xong ngày 2026-11-09: người dùng chốt "Theo đề xuất" cho cả 6 câu ở mục 8. Câu 6 yêu cầu thêm `paid_date` vào `summary()` của `contract_bill.service.js` (kèm test backend) trước khi làm thẻ Đã thu ở bước 3: làm việc này ở đầu bước 3.
**Xong khi:** đã ghi vào Nhật ký.

### Bước 1 — `ListCard` và design system
Tạo `ListCard`, `ListCardList`, `MoneyStrip` (nếu chỉ hợp đồng dùng thì đặt trong `pages/admin/contracts/`), CSS, test component (render ô có nhãn, bỏ ô trống, bấm nút không gọi `onOpen`, `aria-label`). Thêm mục "Thẻ danh sách" ở `/design-system`. CLAUDE.md 3.4 thêm dòng: "Danh sách ở điện thoại | `ListCard` | `crew-list` với hàng chữ nối ' · '".
**Xong khi:** 4 ví dụ ở /design-system khớp wireframe ở 375px; test qua; 1440px /design-system không đổi phần cũ.
**⛔ DỪNG:** gửi ảnh 375px của 4 ví dụ, chờ duyệt.

### Bước 2 — Chip trạng thái
`StatusTabs phone="chips"`; áp cho 7 danh sách. YCTT: ô "Tất cả chủ tàu" vào `ListFilters` ở điện thoại.
**Xong khi:** ở 375px không trang danh sách nào còn ô "Trạng thái:"; trang chi tiết vẫn ô "Mục:"; chip đang chọn thấy được khi mở `?tab=OVERDUE`; 1440px không đổi.

### Bước 3 — Yêu cầu thanh toán
Theo 5.1. Tách `billNextAction` + test.
Đầu bước: thêm `paid_date` vào `summary()` (mục 8 câu 6) kèm test backend.
**Xong khi:** đủ 4 trạng thái hiển thị đúng ô / dải / nút (dữ liệu demo hoặc giả lập trong test); bấm thẻ mở bill; nút chỉ hiện khi có quyền; không bấm thao tác thật trên DB dev (mục 0.7).

### Bước 4 — Hợp đồng
Theo 5.2. `contractNextAction` + test; dùng lại `ApproveModal`, `RejectModal`.
**Xong khi:** thẻ Hiệu lực / Chờ duyệt / Nháp / Đã kết thúc đúng wireframe; "0" và chưa có tiền hiện xám; mở Duyệt rồi Huỷ không ghi gì.
**⛔ DỪNG:** gửi ảnh 375px YCTT (Cần duyệt, Quá hạn, Đã thu) và Hợp đồng (Hiệu lực sắp hết, Chờ duyệt, Nháp), chờ duyệt trước khi áp các trang còn lại.

### Bước 5 — Cơ hội, Chuyến, Thuyền viên
Theo 5.3–5.5.
**Xong khi:** 3 trang dùng `ListCard`, cảnh báo thành dải, không trang nào tràn ở 360px.

### Bước 6 — Tàu, Đối tác, Danh mục, dọn dẹp
Theo 5.6. Gỡ `crew-list` không còn dùng.
**Xong khi:** `grep -rn "crew-list__row" frontend/src/pages` chỉ còn chỗ đã ghi lý do ở Nhật ký.

### Bước 7 — Hướng dẫn trong app
Thêm đoạn "Đọc thẻ danh sách" vào `frontend/public/huong-dan/dien-thoai.html`: nhãn, số tiền, dải cảnh báo, nút việc kế tiếp, hàng chip trạng thái. Lời cho môi giới viên, không nói về code.
**Xong khi:** trang mở được từ ngăn kéo, đọc ổn ở 375px.

### Bước 8 — Chạy testcase tay
Chạy `docs/mcah-testcase-danh-sach-mobile.md` (giả lập trước, máy thật sau), ghi kết quả.
**Xong khi:** mọi case Đạt, hoặc case Không đạt đã sửa và chạy lại; **⛔ DỪNG** báo danh sách case còn lỗi nếu có.

---

## 8. Câu hỏi đã chốt (2026-11-09: giữ cả 6 đề xuất)

1. **Thẻ Hợp đồng Chờ duyệt có nút Duyệt / Từ chối ngay trên danh sách?** Đề xuất: **có**, mở đúng dialog như trang chi tiết (vẫn có bước xác nhận). Khác: chỉ nút "Mở để duyệt".
2. **Nút "Duyệt" trên thẻ YCTT duyệt ngay như nút icon desktop hiện nay, hay hỏi xác nhận trước?** Trên điện thoại dễ bấm nhầm khi cuộn. Đề xuất: **hỏi xác nhận một bước** ("Duyệt TT-… 1.595 USD?") chỉ ở điện thoại; desktop giữ nguyên.
3. **Ngưỡng "sắp hết hạn" của hợp đồng:** ô Thời hạn đổi màu khi còn ≤ **30 ngày**, dải cảnh báo khi còn ≤ **7 ngày**. Nếu đã có ngưỡng ở Tổng quan thì dùng ngưỡng đó.
4. **Thẻ Thuyền viên:** wireframe vẽ ô "Điện thoại" và cảnh báo "chứng chỉ sắp hết hạn", nhưng API danh sách chưa trả hai thông tin này. Đề xuất: **lần này chỉ dùng dữ liệu đang có** (chức danh, tàu hiện tại, giấy tờ chờ duyệt); thêm điện thoại / chứng chỉ để việc sau.
5. **Chip trạng thái thay ô chọn "Trạng thái:"** ở cả 7 danh sách (kể cả danh sách ít mục như Tàu, Đối tác)? Đề xuất: **cả 7** cho đồng bộ.
6. **Thẻ YCTT Đã thu ghi "Đã thu ngày"?** Cần trả thêm `paid_date` ở API danh sách (một dòng trong `summary()`, câu SQL đã có sẵn, kèm test backend). Đề xuất: **có**. Không thì thẻ Đã thu giữ ô "Hạn thanh toán".

---

## 9. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-11-09 | Lập kế hoạch | — | Đo 7 danh sách ở 375×812 bằng tài khoản demo (mục 1.1). Vẽ wireframe `danh-sach-mobile.html`, người dùng duyệt. Viết plan và testcase. Chưa sửa code. |
| 2026-11-09 | Bước 0 | — | Người dùng chốt "Theo đề xuất" cho cả 6 câu ở mục 8 (Duyệt / Từ chối trên thẻ Hợp đồng; xác nhận một bước khi Duyệt YCTT ở điện thoại; ngưỡng 30 / 7 ngày; Thuyền viên chỉ dùng dữ liệu có sẵn; chip ở cả 7 danh sách; trả thêm `paid_date`). Chưa sửa code, chờ lệnh bắt đầu bước 1. |
| 2026-11-09 | Bước 1 | 1e454ae | `ListCard`, `ListCardList`, `MoneyStrip` + 9 test + 4 ví dụ ở `/design-system` + dòng ở CLAUDE.md 3.4. Nút phủ để cả thẻ bấm được, nút việc kế tiếp nằm ngoài. |
| 2026-11-09 | Bước 2 | b71d2c7 | `StatusTabs phone="chips"` (hàng chip cuộn ngang, dưới 768px) cho 7 danh sách; YCTT: lọc chủ tàu vào sheet Bộ lọc ở điện thoại (dưới 640px). 3 test. |
| 2026-11-09 | Bước 3 | bafb63d | Thẻ YCTT. API danh sách trả thêm `paid_date` (+ test backend). `billNextAction` dùng chung cho nút icon desktop và nút chữ ở thẻ; Duyệt trên thẻ hỏi xác nhận (mục 8 câu 2). Kỳ thu ghi "01/09–30/09/2026" (không khoảng trắng quanh gạch) cho vừa nửa thẻ; badge trên thẻ chỉ ghi "Quá hạn", số ngày nằm ở dải cảnh báo. Ô giá trị của `ListCard` xuống tối đa 2 dòng. |
| 2026-11-09 | Bước 4 | 85e8032 | Thẻ Hợp đồng. Thêm `contractMonthsLabel`, `daysLeft`, `contractNextActions` (+ test). Ngoài kế hoạch: hợp đồng Hiệu lực đã quá ngày kết thúc hiện dải đỏ "Đã quá ngày kết thúc N ngày" (dữ liệu demo có nhiều). "Sửa lại" cho Bị từ chối, "Sửa nháp" cho Nháp. Dòng phụ của thẻ xuống tối đa 2 dòng, mã không bị ngắt. |
| 2026-11-09 | Bước 5 | 7dd8c19 | Thẻ Cơ hội, Chuyến, Thuyền viên. Thêm nhóm trạng thái `voyage` (Đang trên tàu / Đã rời tàu). Chuyến có nút Ghi rời tàu mở `LeaveModal`. Thuyền viên dùng `expired_count` / `expiring_count` / `pending_review_count` sẵn có (API đã trả, khác dự đoán ở mục 5.5). Lưới đầu thẻ đặt chỗ tường minh để badge không ép tiêu đề khi không có con số chính. |
| 2026-11-09 | Bước 6 | (commit này) | Thẻ Tàu (Chủ tàu · IMO · Cờ), Đối tác (logo, Quốc gia), Danh mục (`MasterSubPage`: tên + dòng phụ, bấm mở sửa khi có quyền). Gỡ toàn bộ CSS `crew-list*` ở `SeafarerListPage.css` và `exports.css`; `grep crew-list frontend/src` = 0. Danh mục dùng `crew-list` nên đổi luôn (mục 5.6 chỉ cho phép khi đúng như vậy). |
