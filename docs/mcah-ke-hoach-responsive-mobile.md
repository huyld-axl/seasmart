# MCAH — Kế hoạch revamp responsive cho điện thoại

- **Ngày lập:** 2026-11-05
- **Trạng thái:** wireframe đã duyệt, mục 9 đã chốt theo đề xuất (2026-11-05). **Chưa viết code**, chờ người dùng bảo bắt đầu.
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự. Mọi quyết định cần cho việc dựng đã chép vào mục 1–6.
- **Wireframe:** `docs/design/wireframes/responsive-mobile.html` (10 phần: hiện trạng, 8 nhóm màn, design system), cũng ở https://claude.ai/artifact/MAVGYpKKuLGX5ziskgH6j9.
- **Testcase tay:** `docs/mcah-testcase-responsive-mobile.md`.
- **Hướng dẫn trong app:** `frontend/public/huong-dan/dien-thoai.html` (viết ở bước 12, khi hành vi đã chốt).
- **Nhánh:** `dev` (dự án chỉ dùng `main` và `dev`, mọi sửa code làm trên `dev`, không tạo nhánh mới). `dev` tạo từ `origin/main` ngày 05/11/2026 (đã có PR #40 Tổng quan và PR #42 Đội ngũ tàu và mật khẩu). Khi commit bước responsive chỉ `git add` file của bước đó, không gom thay đổi chưa commit của việc khác.

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` ở thư mục gốc repo trước khi viết dòng code nào. Mọi quy ước trong đó vẫn áp dụng.
2. Làm **đúng thứ tự các bước ở mục 8**. Mỗi bước có phần "Xong khi"; chỉ sang bước sau khi mọi ý trong đó đúng.
3. Sau mỗi bước: chạy lint và test frontend, rồi commit **một commit cho một bước**, message tiếng Việt, thể mệnh lệnh. Gộp các sửa nhỏ trong cùng bước trước khi push. Không push khi chưa được bảo.
4. Gặp dòng **⛔ DỪNG** thì dừng, báo người dùng đúng điều được yêu cầu và chờ trả lời.
5. Không làm những việc ở mục 2.2 "Không làm".
6. Ghi tiến độ vào mục 10 "Nhật ký" sau mỗi bước.
7. Chi tiết trong file mâu thuẫn với code đang có (tên class, tên component đã đổi…) thì ưu tiên code, sửa cho khớp, ghi một dòng vào Nhật ký.
8. **Sửa ở component dùng chung, không vá từng trang.** Thứ gì lặp ở hai trang trở lên thì đưa vào `frontend/src/components/ds/`, minh hoạ ở `/design-system` **trước**, rồi mới dùng ở trang (CLAUDE.md mục 3.4).
9. **Desktop không được đổi.** Mọi thay đổi chỉ áp dưới mốc của nó (mục 4.1). Mỗi bước chụp 1440px trước và sau ở các trang đã sửa; khác nhau thì là lỗi, trừ khi mục 5 nói rõ.

---

## 1. Mục tiêu

### 1.1 Mục đích

Môi giới viên mở MCAH trên điện thoại để **tra cứu và làm việc nhanh ngoài văn phòng**: tìm thuyền viên, gọi / Zalo, xem chuyến và hợp đồng, ghi rời tàu, duyệt yêu cầu thanh toán, sửa vài trường hồ sơ. Mỗi việc đó phải làm được bằng một tay trên màn 375px mà **không phóng to, không cuộn ngang, không bấm trượt**.

Không đặt mục tiêu làm mọi việc trên điện thoại dễ như desktop. Việc dài (nhập cả hồ sơ, soát giấy tờ quét, ma trận quyền, xuất bộ hồ sơ) chỉ cần **dùng được, không vỡ**.

### 1.2 Thiết bị đích

| Nhóm | Bề rộng | Trình duyệt | Mức |
|---|---|---|---|
| Điện thoại dọc | 360, 375, 390, 414, 430px | Safari iOS 16+, Chrome Android | Thiết kế riêng (wireframe) |
| Điện thoại ngang, máy tính bảng | 640–1023px | như trên | Không vỡ, dùng luật của mốc tương ứng (mục 4.1) |
| Desktop | từ 1024px | Chrome, Edge, Safari | Giữ nguyên |

### 1.3 Thế nào là xong (đo được)

Ở mọi route trong mục 5, bề rộng 360 và 375px:

1. `document.documentElement.scrollWidth` = bề rộng màn, kể cả khi đang mở dropdown, ô ngày, dialog.
2. Không có ô gõ được (`input`, `textarea`, ô Select có tìm kiếm) nào chữ dưới 16px.
3. Không có thứ bấm được nào nhỏ hơn 40×40px (tính cả vùng bấm mở rộng bằng padding / pseudo-element), trừ link chữ nằm trong câu.
4. Không có cụm nút nào rớt hàng lẻ (2 + 1), không có chữ bị cắt mất phần nghĩa.
5. Mọi dialog mở thành sheet từ đáy; mọi ô ngày mở bảng chọn của máy.
6. Ở 1440px, ảnh chụp trước và sau giống nhau.

---

## 2. Phạm vi

### 2.1 Làm

- Gom mốc breakpoint về 3 mốc, thêm hook `useViewport`.
- Kích thước control, chữ ô nhập, vùng bấm, vùng an toàn đáy cho điện thoại.
- Component mới: `Fab`, `BottomSheet`, `DateField` / `DateRangeField`, `ScrollRow`, `RowList`.
- Component đổi: `AdminLayout`, `DetailHead` (tách từ `crew-head`), `ListToolbar`, `ListFooter`, `DescriptionList`, `FormFrame` (thanh lưu, hàng mục), `Crumb`, `StatusTabs`.
- Áp vào mọi trang trong mục 5.
- Cập nhật CLAUDE.md (mục 3.4 thêm dòng, thêm mục 3.5 "Màn hẹp") và trang `/design-system`.
- Một test chặn mốc breakpoint lạ trong CSS.
- Hướng dẫn trong app cho môi giới viên.

### 2.2 Không làm

- Không làm app native, không offline / service worker. Chỉ manifest + icon + `theme-color` để thêm ra màn hình chính (mục 9 câu 7, bước 12).
- Không thiết kế lại desktop, không đổi màu, font, bo góc.
- Không đổi nghiệp vụ, API, quyền.
- Không thêm tính năng mới chỉ có trên điện thoại (quét QR, chụp ảnh giấy tờ… ngoài cái đang có).
- Không dark mode.
- Không làm thanh tab dưới (mục 9 câu 1 chọn A).
- Không tự cài thư viện UI mới. `DateField` dùng `<input type="date">` của trình duyệt, `BottomSheet` dựng trên `Drawer` của antd.

---

## 3. Hiện trạng (đo 05/11/2026, app dev, tài khoản demo, 375×812)

Chi tiết và ảnh vẽ lại ở wireframe phần 0. Tóm tắt:

| # | Lỗi | Gốc |
|---|---|---|
| H1 | Cuộn ngang cả trang: chi tiết Hợp đồng 466px, chi tiết Cơ hội 425px, sửa YCTT 397px | Giá trị không xuống dòng trong `crew-head__meta`; bảng tiền 363px trong khung 343px |
| H2 | Ô khoảng ngày rộng 744px, mở ra khung nhìn bị nới lên 777px | `DatePicker.RangePicker` (14 file dùng DatePicker) |
| H3 | Chữ ô nhập 14px → iOS tự phóng to | `fontSize: 14` chung trong `theme/tokens.js` |
| H4 | Header chi tiết: tile/ảnh 130px, cột giá trị ~150px, chữ vỡ từng từ | `crew-head` trong `SeafarerProfile.css`, chép ở 6 trang |
| H5 | Thanh công cụ danh sách 170px, nút Thêm bị cắt | `ds-toolbar` chỉ có `flex-wrap` |
| H6 | Bảng còn dạng desktop: Tài khoản 857px, Mục tiêu tháng 640px, bảng khoản tiền HĐ 640px (×3), không ghim cột | Trang dùng `Table` / `<table>` trực tiếp |
| H7 | Breadcrumb 4 dòng, nút rớt hàng 2 + 1 | `Crumb`, `crew-head__actions` |
| H8 | Vùng bấm < 32px: Vai trò 49, Tài khoản 9, form thuyền viên 10 | Nút `size="small"`, link chữ |
| H9 | Topbar 64px, tiêu đề bị cắt vì kèm mục cha | `AdminLayout` |
| H10 | Thanh lưu 2 tầng ~110px, hàng mục không báo còn mục | `sf-savebar`, `sf-toc` |
| H11 | Chi tiết đọc: mỗi trường ~60px | `DescriptionList` chỉ chia 2 cột từ 384px |
| H12 | 14 mốc breakpoint khác nhau; JS đổi ở 768 còn CSS phần lớn ở 639 | Mỗi trang tự chọn |

Đã ổn, giữ: danh sách dạng dòng ở 8 trang danh sách (`crew-list`), menu ngăn kéo, ô chọn "Mục:" / "Trạng thái:" thay hàng tab, bản điện thoại của Vai trò và quyền (`RolePhoneView`), Tổng quan xếp dọc dưới 1024px.

---

## 4. Design system cho điện thoại

### 4.1 Ba mốc

| Mốc | Tên | Dưới mốc này |
|---|---|---|
| 640px | `sm`, "điện thoại" | Form / lưới / chi tiết 1 cột; dialog → sheet; nút nổi "Thêm"; thanh lưu 1 hàng; control 44px chữ 16px; ô ngày của máy; bảng nhỏ → `RowList`; breadcrumb một nấc |
| 768px | `md` (trùng `Grid.useBreakpoint().md` của antd) | Sidebar → ngăn kéo; bảng danh sách → dòng; thanh công cụ danh sách 2 tầng |
| 1024px | `lg` | Tổng quan xếp dọc; trang chi tiết / form bỏ cột phụ |

- CSS chỉ được dùng `@media (max-width: 639px)`, `(max-width: 767px)`, `(max-width: 1023px)` và các bản `min-width: 640px / 768px / 1024px`. Container query (`@container`) không bị giới hạn.
- Quy đổi mốc cũ (đã làm ở bước 1): 575, 599, 600, 640 (max) → 639; 720 → 767; 899, 900, 991 → 1023. Mốc trong trang mà sidebar đang mở (từ 768px) thì quy **lên** 1023 chứ không xuống 767, vì khung nội dung ở 768–1023px (496–751px) còn hẹp hơn ở 640–767px. Giữ làm "mốc riêng" (ghi comment `mốc riêng:` cạnh `@media`): `min-width: 1100px` (chi tiết HĐ 2 cột), `min-width: 1200px` (exports, hồ sơ thuyền viên 2 cột), `max-width: 1099px` (form thuyền viên), `max-width: 1199px` (soát giấy tờ); các bố cục 2 cột này cần khung nội dung rộng, hạ về 1024 thì chật.
- Hook mới `frontend/src/hooks/useViewport.js`: `{ isPhone, isCompact, isWide }` = `< 640`, `< 768`, `≥ 1024`, dùng `useMediaQuery` đang có. Thay mọi `!Grid.useBreakpoint().md` bằng `isCompact`, `Grid.useBreakpoint().sm` (mốc 576 của antd, ở `SlidePanel`, `ToastHost`) bằng `isPhone`, các `useMediaQuery(…)` rời bằng `isPhone` / `isWide`.
- Test `frontend/src/__tests__/breakpoints.test.js`: đọc mọi `*.css` trong `src/`, lỗi nếu gặp `@media` có `max-width` / `min-width` ngoài danh sách trên (trừ dòng có comment `/* mốc riêng: … */`).

### 4.2 Kích thước

| | Điện thoại (< 640) | Từ 640 |
|---|---|---|
| Ô nhập, Select, DatePicker, InputNumber: cao | 44px | 40px |
| Chữ trong ô gõ được | **16px** | 14px |
| Nút thường | 40px; 44px trong thanh lưu và chân sheet | 40px |
| Vùng bấm tối thiểu | 40×40px | 32×32px |
| Topbar | 56px | 64px |
| Lề trang / lề card | 16 / 16px | 24 / 20px |
| Khoảng giữa các khối | 12px | 16px |

Cách làm:

- `App.jsx` (đã làm ở bước 2): `ThemeProvider` chọn `antThemePhone` khi `isPhone` (`theme/tokens.js`): `Input`, `InputNumber`, `Select`, `DatePicker`, `Cascader`, `Mentions` có `controlHeight: 44`, `fontSize: 16`; `Select` thêm `lineHeight: 1.375` vì antd tính đệm theo chữ 14px (không có thì ô cao 47px). Nút giữ 40px. Token desktop không đổi.
- `index.css`: dưới 640px, `input, textarea, select, .ant-select-selection-search-input { font-size: 16px }` làm lưới an toàn cho ô tự dựng.
- Vùng bấm (đã làm ở bước 2): dưới 640px, mọi nút antd nhỏ (`size="small"`, chỉ icon, dạng link / chữ) và `Switch` có `::after` trong suốt 40×40px phủ quanh, không đổi hình. Quy tắc chung trong `index.css`, không cần class `.ds-hit` riêng.
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, thêm `<meta name="theme-color" content="#ffffff">`.
- Vùng an toàn: thanh lưu, `Fab`, chân sheet cộng `env(safe-area-inset-bottom)`.

### 4.3 Component mới (`components/ds/`, minh hoạ ở `/design-system` trước khi dùng)

| Component | Làm gì | Ghi chú |
|---|---|---|
| `Fab` | Nút nổi 56px, bo 18px, nền nhấn, góc phải dưới, cách đáy 16px + vùng an toàn | Prop `label` → `aria-label` và tooltip. Chỉ render khi `isPhone`; desktop trang vẫn có nút trong thanh công cụ. Chỉ dùng cho "Thêm …" của trang danh sách |
| `BottomSheet` | Sheet từ đáy: tay kéo, tiêu đề + nút đóng, thân cuộn, chân dính đáy hai nút chia đều 44px | Dựng trên `Drawer placement="bottom"` của antd, cao theo nội dung, tối đa `88dvh`. Dùng cho Bộ lọc ở điện thoại |
| Modal → sheet | Mọi `Modal` antd ở dưới 640px tự thành sheet | **Một quy tắc CSS chung** trong `ds.css` cho `.ant-modal-wrap` / `.ant-modal` / `.ant-modal-footer` (bám đáy, rộng 100%, bo trên 20px, chân dính, nút chia đều). Không sửa 31 file dialog. `Modal.confirm` cũng theo |
| `DateField`, `DateRangeField` | Desktop: `DatePicker` / `RangePicker` antd như cũ. Điện thoại: `<input type="date">` (bảng chọn của máy); khoảng ngày = hai ô Từ / Đến | Cùng giá trị `dayjs` vào ra, dùng được trong `Form.Item` như DatePicker. Hỗ trợ `disabledDate` bằng `min` / `max`; trường hợp chặn ngày lẻ (không phải khoảng) thì kiểm lúc chọn và báo lỗi dưới ô |
| `ScrollRow` | Hàng cuộn ngang: mép mờ 32px phía còn mục, vạch mảnh 3px dưới hàng khi tràn, nút mũi tên khi dùng chuột (`any-pointer: fine`), tự cuộn mục đang chọn vào giữa (tính `scrollLeft`, không `scrollIntoView`) | Theo luật R6, R10 của skill ui-ux (`.claude/skills/ui-ux/references/responsive.md`) |
| `RowList` | Bảng ít cột → dòng hai tầng ở điện thoại: tiêu đề + số chính bên phải, dòng phụ nhỏ, hành động vào ⋯ 40px | Nhận `columns` kiểu antd kèm `mobile: 'title' \| 'sub' \| 'value' \| 'meta' \| 'actions' \| false`. Từ 640px render `Table` như cũ |

### 4.4 Component đổi

| Component | Đổi gì ở dưới 640px (desktop giữ nguyên) |
|---|---|
| `AdminLayout` | Topbar 56px; tiêu đề chỉ là trang đang xem (bỏ "Quản trị /"); nút tài khoản còn avatar 40×40, bỏ mũi tên; link "Hướng dẫn" (`HelpLink`) còn icon 40×40; ngăn kéo: mục 44px, đáy có email · vai trò · Đăng xuất. Dưới 768px vẫn là ngăn kéo như hiện tại |
| `DetailHead` (mới, tách từ `crew-head*` ở `SeafarerProfile.css` sang `ds.css`) | Tile 44px hoặc ảnh 60×80 cạnh tên + trạng thái + dòng phụ; khối thông tin (`dl`) xuống dưới, dài hết ngang, nhãn `minmax(96px, 38%)`, giá trị xuống dòng được; tối đa 2 nút hiện chia đều + ⋯ chứa phần còn lại; ghi chú đặt dưới khối thông tin. Bấm ảnh thuyền viên mở xem lớn (thay nút "Tải ảnh" đè trên ảnh, nút tải nằm trong khung xem) |
| `ListToolbar` (gom `ds-toolbar` của các trang danh sách thành component) | Không còn là card: nền trắng sát mép, dính dưới topbar. Tầng 1: ô tìm + nút Lọc (badge số điều kiện) + ⋯. Tầng 2: `StatusTabs` bản ô chọn + chip đang lọc trong `ScrollRow` + "Xoá lọc" ngoài vùng cuộn. Nút "Thêm …" thành `Fab`. Dưới 768px đã 2 tầng |
| `ListFooter` | Tổng số + ‹ trang hiện tại / tổng › ; ẩn "Số dòng/trang" (giữ 20) |
| `DescriptionList` | Chia 2 cột từ container 280px (đang 384px), nhãn `minmax(96px, 38%)`, gap 12px, kẻ mảnh giữa các dòng |
| `FormFrame` + `sf-savebar` + `sf-toc` | Hàng mục dùng `ScrollRow`, dính dưới topbar. Thanh lưu một hàng: **Sửa** = "Huỷ" + "Lưu thay đổi · n" (nút chính dài, khoá khi chưa đổi); **Thêm** = "Lưu & thêm {đối tượng} khác" + "Thêm {đối tượng}" chia đều, "Huỷ" chuyển thành link "‹ {danh sách}" đầu form (hỏi lại nếu đã nhập dở) — đã chốt ở mục 9 câu 4 |
| `Crumb` | Còn một nấc: "‹ {nấc cha}", một dòng, vùng bấm 32px cao |
| `StatusTabs` (bản ô chọn "Mục:" của trang chi tiết) | Dính dưới topbar khi cuộn (prop `sticky`) |

### 4.5 Ghi vào quy ước

- CLAUDE.md mục 3.4: thêm dòng "Ngày / khoảng ngày → `DateField` / `DateRangeField`, không dùng `DatePicker` trực tiếp", "Nút thêm ở danh sách điện thoại → `Fab`", "Bảng ít cột trong trang → `RowList`", "Lớp nổi chọn / lọc ở điện thoại → `BottomSheet`".
- CLAUDE.md thêm mục **3.5 Màn hẹp**: 3 mốc; ô gõ 16px; vùng bấm 40px; không `min-width` cố định lớn hơn 343px ngoài khung cuộn; không cụm nút rớt hàng lẻ; kiểm 375px trước khi báo xong.
- `/design-system`: mỗi component mới / đổi có khung xem 375px cạnh bản desktop.

---

## 5. Màn hình

Mỗi dòng: route, việc phải làm, component dùng. "—" = chỉ hưởng thay đổi chung (mục 4.2, Modal → sheet), kiểm lại là đủ.

| Nhóm | Route | Việc | Bước |
|---|---|---|---|
| Khung | mọi route trong `AdminLayout` | Topbar, ngăn kéo | 4 |
| Danh sách | `/seafarers`, `/partners`, `/vessels`, `/opportunities`, `/voyages`, `/contracts`, `/bills`, `/master-data/:tab` | `ListToolbar`, `ListFooter`, `Fab`, Bộ lọc trong `BottomSheet` | 5 |
| Danh sách | `/admin/users` | Như trên + `UserTable` → `RowList` (xem / sửa / xoá vào ⋯) | 5 |
| Ô ngày | 14 file dùng `DatePicker` (danh sách Chuyến tàu, form Thuyền viên / Cơ hội / Chuyến / Hợp đồng / YCTT, `LeaveModal`, `VoyageModals`, `PlaceModal`, `CollectModal`, `CandidatePanel`, `DocumentsSection`, chi tiết Thuyền viên, Mục tiêu tháng) | `DateField` / `DateRangeField` | 6 |
| Chi tiết | `/seafarers/:id`, `/partners/:id`, `/vessels/:id`, `/opportunities/:id`, `/voyages/:id`, `/contracts/:id`, `/bills/:id`, `/admin/users/:id`, `/seafarers/:id/upload` | `DetailHead`, `Crumb`, `DescriptionList`, `StatusTabs sticky` | 7 |
| Bảng trong trang | `TermsTable`, `DealTable` (HĐ), `BillMoneyTable` + bảng trong `BillFormPage`, `CertificateTable`, `RecordTable`, `CandidateTable`, `RequirementTable`, bảng thuyền viên ở `VesselDetailPage` / `VesselCrewTab`, `SmartCompareCard` | `RowList`; bảng nhiều cột thật (so sánh) thì cuộn trong khung + ghim cột đầu | 8 |
| Quản trị | `/admin/kpi-targets` | Mỗi người một card, 2 ô `inputmode="numeric"`, "Cả công ty" lên đầu | 8 |
| Form | `/seafarers/new`, `/seafarers/:id/edit`, `/partners/*`, `/vessels/*`, `/opportunities/*`, `/voyages/new`, `/contracts/*`, `/bills/:id/edit`, `UserForm`, `RoleFormModal` | `FormFrame` mới; form chưa dùng `FormFrame` (thuyền viên, hợp đồng, YCTT) dùng chung `sf-savebar` / `sf-toc` nên hưởng cùng thay đổi, kiểm từng form | 9 |
| Còn lại | `/dashboard` | Nhãn trục "Tháng này" bị cắt thành "Thá…", tên người cắt quá sớm | 10 |
| Còn lại | `/seafarers/:id/review` | Soát giấy tờ: ảnh trên, ô dưới, thanh chuyển trang dính đáy; chỉ cần không vỡ | 10 |
| Còn lại | `/seafarers/import`, màn xuất bộ hồ sơ (`exports/*`) | Không vỡ; bản xem trước A4 thu vừa ngang màn | 10 |
| Còn lại | `/admin/roles` | Giữ `RolePhoneView`; nới vùng bấm 49 chỗ | 10 |
| Còn lại | `/login`, `/dat-mat-khau`, trang lỗi, `/no-role` | Ô 16px, kiểm | 10 |

---

## 6. Quy ước khi code

- Chỉ dùng 3 mốc (mục 4.1). Trong JS chỉ dùng `useViewport()`; không gọi `Grid.useBreakpoint()` trực tiếp trong trang.
- Không render hai cây DOM (desktop + mobile) cùng lúc rồi ẩn bằng CSS cho khối lớn; khối lớn thì rẽ nhánh bằng `useViewport()`. Khối nhỏ (một nút, một nhãn) thì ẩn / hiện bằng CSS được.
- Con của flex / grid chứa chữ dài: `min-width: 0`. Lưới: `grid-template-columns: minmax(0, 1fr)`.
- Giá trị dài (tên công ty, email, mã) trong khối thông tin: `overflow-wrap: anywhere`, không `white-space: nowrap`.
- Ngày tháng, số tiền, mã, tên người trong dòng: `white-space: nowrap` + cắt `…` ở cuối, có `title` đầy đủ.
- Không thêm `size="small"` cho nút bấm được trên trang điện thoại.
- Chữ trên nút giữ nguyên như desktop; chỉ rút gọn khi mục 5 / wireframe ghi rõ (ví dụ "Kết thúc HĐ").

---

## 7. Testcase

Chạy tay theo `docs/mcah-testcase-responsive-mobile.md` ở bước 13, trên **máy thật**: một iPhone (Safari) và một Android (Chrome). Ngoài ra mỗi bước tự kiểm bằng `.claude/skills/ui-ux/scripts/probe.mjs` ở 375 và 1440 (`--widths 360,375,1440`), bước 11 chạy `--sweep 1440,360,20`.

---

## 8. Các bước

### Bước 0 — Chốt câu hỏi mở

Đã xong 2026-11-05: người dùng giữ cả 7 đề xuất ở mục 9 (điều hướng A, nút nổi, ô ngày của máy, Huỷ thành link đầu form thêm mới, không ẩn trường trống, máy tính bảng chỉ cần không vỡ, có "Thêm vào màn hình chính" bản nhẹ). Không cần hỏi lại.

**Xong khi:** (đã xong).

### Bước 1 — Mốc và hook

Thêm `useViewport`, test chặn mốc, quy đổi 14 mốc về 3 (mục 4.1), thay 13 chỗ `useBreakpoint().md`, sửa `index.html` (viewport-fit, theme-color).

**Xong khi:** test mốc qua; `grep -rn "useBreakpoint" frontend/src/pages` rỗng; chụp 1440 ở 8 danh sách + 6 chi tiết giống trước; ở 700px (giữa 640 và 767) danh sách là dòng và form vẫn 2 cột như trước bước này.

### Bước 2 — Kích thước và CSS chung

`ConfigProvider` lồng cho điện thoại, lưới an toàn 16px trong `index.css`, `.ds-hit`, quy tắc Modal → sheet, vùng an toàn.

**Xong khi:** probe ở 375px báo 0 ô chữ dưới 16px trên mọi route mục 5; dialog Ghi rời tàu, Duyệt YCTT, Xoá thuyền viên mở thành sheet, bàn phím mở không che nút (thử trên Chrome DevTools thiết bị iPhone 12); 1440px không đổi.

### Bước 3 — Component mới

`Fab`, `BottomSheet`, `DateField` / `DateRangeField`, `ScrollRow`, `RowList` vào `components/ds/` kèm test; thêm vào `/design-system` với khung 375px; cập nhật CLAUDE.md mục 3.4 và thêm 3.5.

**Xong khi:** `/design-system` hiện đủ 5 component ở cả hai bề rộng; test component qua (`DateField` vào / ra `dayjs` đúng ở cả hai chế độ; `ScrollRow` báo đúng cờ mép trái / phải; `RowList` rẽ đúng theo bề rộng); lint sạch.

### Bước 4 — Khung app

`AdminLayout` theo mục 4.4.

**Xong khi:** ở 375px topbar 56px, tiêu đề không còn tên mục cha, nút tài khoản 40×40; ngăn kéo có email, vai trò, Đăng xuất; 1440px không đổi.

**⛔ DỪNG:** gửi ảnh 375px (topbar + ngăn kéo mở), chờ duyệt trước khi áp xuống các trang.

### Bước 5 — Trang danh sách

`ListToolbar`, `ListFooter`, `Fab`, bộ lọc trong `BottomSheet` cho 8 danh sách + Danh mục; `UserTable` → `RowList`.

**Xong khi:** ở 375px thanh công cụ ≤ 104px khi không lọc, dính dưới topbar khi cuộn; nút Thêm là `Fab` và mở đúng trang thêm; bộ lọc mở thành sheet, nút "Xem n …" đúng số; Tài khoản không còn bảng cuộn ngang; 1440px không đổi.

### Bước 6 — Ô ngày

Thay mọi `DatePicker` / `RangePicker` trong 14 file bằng `DateField` / `DateRangeField`.

**Xong khi:** `grep -rn "DatePicker" frontend/src/pages` chỉ còn trong `components/ds/DateField.jsx`; ở 375px chạm ô ngày mở bảng chọn của máy, khung nhìn không giãn; lưu form có ngày ra đúng giá trị như trước (so DB một bản ghi sửa ở desktop và điện thoại); 1440px vẫn là DatePicker antd.

### Bước 7 — Trang chi tiết

`DetailHead`, `Crumb` một nấc, `DescriptionList` mới, `StatusTabs sticky` cho 9 route chi tiết ở mục 5.

**Xong khi:** ở 360 và 375px không trang chi tiết nào cuộn ngang (hết H1 phần header); không giá trị nào vỡ từng chữ; không cụm nút 2 + 1; 1440px không đổi.

**⛔ DỪNG:** gửi ảnh 375px của Thuyền viên, Hợp đồng, YCTT, Cơ hội (đầu trang + một mục cuộn xuống), chờ duyệt.

### Bước 8 — Bảng trong trang và Mục tiêu tháng

`RowList` cho các bảng ở mục 5; Mục tiêu tháng thành card.

**Xong khi:** ở 375px không còn bảng nào cuộn ngang mà không ghim cột; sửa YCTT không còn rộng 397px (hết H1); tổng tiền trong `RowList` khớp bảng desktop trên cùng bản ghi.

### Bước 9 — Form

`FormFrame` theo mục 4.4; kiểm từng form ở mục 5.

**Xong khi:** ở 375px mọi form: thanh lưu một hàng ≤ 72px (chưa tính vùng an toàn), hàng mục có mép mờ khi tràn; thêm mới bấm lưu khi thiếu trường thì cuộn tới ô lỗi đầu tiên và ô đó không bị thanh lưu hay hàng mục che; "Lưu & thêm khác" ở lại trang, form trống, cuộn lên đầu; sửa rồi bấm "‹" / Huỷ khi đã đổi thì hỏi lại.

### Bước 10 — Trang còn lại

Các dòng "Còn lại" ở mục 5.

**Xong khi:** từng route ở 375px đạt 1.3 (1)–(4).

### Bước 11 — Quét toàn bộ

Chạy probe `--sweep 1440,360,20` trên mọi route mục 5 (một bản ghi có nhiều dữ liệu cho mỗi trang chi tiết: tên dài, nhiều chứng chỉ, hợp đồng nhiều khoản); sửa chỗ lỗi; chụp 1440 so với trước bước 1.

**Xong khi:** probe không báo cuộn ngang, nút rớt hàng, chữ trong nút xuống dòng ở mọi bề rộng; 1440 giống trước.

### Bước 12 — Hướng dẫn trong app

`frontend/public/huong-dan/dien-thoai.html`, cùng kiểu các trang hướng dẫn đang có, viết cho môi giới viên, không bảng, không API: mở menu; tìm và lọc; thêm mới bằng nút tròn; gọi / Zalo từ hồ sơ; ghi rời tàu và duyệt YCTT trên điện thoại; thêm MCAH ra màn hình chính (Safari: Chia sẻ → Thêm vào MH chính; Chrome: ⋮ → Thêm vào màn hình chính). Thêm link "Dùng MCAH trên điện thoại" ở đáy ngăn kéo, cạnh email và Đăng xuất.

**Xong khi:** trang mở được từ ngăn kéo, đọc tốt ở 375px.

### Bước 13 — Chạy testcase tay

Chạy `docs/mcah-testcase-responsive-mobile.md` trên iPhone Safari và Android Chrome thật (cùng mạng LAN với máy dev, mở bằng IP; thêm IP vào `VITE_DEMO_LOGIN_HOSTS` nếu cần nút Nhập nhanh TK demo).

**Xong khi:** mọi case Đạt, hoặc case Không đạt đã sửa và chạy lại; **⛔ DỪNG** báo người dùng danh sách case còn lỗi nếu có.

---

## 9. Câu hỏi đã chốt (2026-11-05: giữ cả 7 đề xuất)

| # | Câu hỏi | Đề xuất | Trả lời |
|---|---|---|---|
| 1 | Điều hướng trên điện thoại: **A** giữ ngăn kéo (☰) làm gọn, hay **B** thanh tab dưới 4 mục + "Khác"? | **A.** Đã có sẵn, mục không đổi theo quyền, không chiếm đáy màn (đáy dành cho thanh lưu và nút nổi). B tiện một tay hơn, làm sau nếu cần | Theo đề xuất (05/11/2026) |
| 2 | Nút "Thêm …" ở danh sách điện thoại thành **nút tròn nổi** góc phải dưới? | Có. Giải phóng một tầng thanh công cụ, ngón cái với tới | Theo đề xuất (05/11/2026) |
| 3 | Ô ngày trên điện thoại dùng **bảng chọn ngày của máy** thay bảng của antd? | Có. Không giãn trang, quen tay người dùng. Trả giá: giao diện chọn theo máy (iOS cuộn bánh xe), không tô xám từng ngày bị chặn, chỉ chặn được khoảng min / max | Theo đề xuất (05/11/2026) |
| 4 | Form **thêm mới** trên điện thoại: thanh lưu chỉ còn "Lưu & thêm khác" + "Thêm …", **"Huỷ" chuyển thành link "‹ Thuyền viên" ở đầu form**? (Lệch CLAUDE.md 3.3 ở điện thoại) | Có. Ba nút không vừa một hàng 343px; xếp 3 hàng thì thanh lưu cao ~170px | Theo đề xuất (05/11/2026) |
| 5 | Trang chi tiết đọc trên điện thoại có **ẩn trường trống** không? | Không. Giữ "—" để môi giới thấy hồ sơ còn thiếu gì; chia 2 cột nên mỗi trường chỉ còn ~40px | Theo đề xuất (05/11/2026) |
| 6 | Máy tính bảng / điện thoại ngang (640–1023px): **chỉ cần không vỡ**, không thiết kế riêng? | Có | Theo đề xuất (05/11/2026) |
| 7 | Có làm **"Thêm vào màn hình chính"** bản nhẹ (manifest, icon 192/512, `theme-color`), không offline? | Có, gộp vào bước 12. Mở từ màn hình chính sẽ không có thanh địa chỉ, rộng thêm ~60px chiều cao | Theo đề xuất (05/11/2026) |

---

## 10. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-11-05 | Lập kế hoạch | — | Đo app dev ở 375×812 bằng tài khoản demo: 3 trang cuộn ngang (HĐ 466px, Cơ hội 425px, sửa YCTT 397px), RangePicker 744px nới khung nhìn lên 777px, ô nhập 14px ở mọi form, 14 mốc breakpoint. Vẽ wireframe 10 phần, viết plan và testcase. Chưa sửa code. |
| 2026-11-05 | Bước 0 | — | Người dùng chốt "Theo đề xuất" cho cả 7 câu ở mục 9. Ghi vào plan. Chưa sửa code, chờ lệnh bắt đầu bước 1. |
| 2026-11-05 | Bước 1 | (commit này) | Thêm `hooks/useViewport.js` (640 / 768 / 1024) và test `src/__tests__/breakpoints.test.js`. Quy đổi 18 `@media` lệch mốc: 13 chỗ đổi số, 5 chỗ giữ làm "mốc riêng" (1099, 1100, 1199, 1200×2 — bố cục 2 cột cần khung rộng; lệch mục 4.1 cũ, đã sửa mục 4.1). Thay `Grid.useBreakpoint` ở 11 file và `useMediaQuery` rời ở 3 file. `index.html`: `viewport-fit=cover`, `theme-color`. `test-setup.js` thêm `matchMedia` mặc định cho jsdom. Kiểm trên app (tải lại sau mỗi lần đổi bề rộng vì công cụ giả lập không phát sự kiện đổi cỡ): 1440 có sidebar + bảng ở 8 danh sách; 700 ngăn kéo + dòng, form thuyền viên 2 cột (span 6), không trang nào tràn; 375 như trước bước này (3 trang tràn đã biết, sửa ở bước 7–8). Quy tắc ≥ 1024px không đổi nên 1440 giống trước. Lint file đã đổi sạch; `npm run lint` còn 1 lỗi cũ ở `OwnershipFields.jsx`. 302 test frontend qua. |
| 2026-11-05 | Bước 2 | (commit này) | Theme điện thoại (`antThemePhone`) + `ThemeProvider` trong `App.jsx`; lưới an toàn chữ 16px và vùng bấm 40×40 trong `index.css`; dialog thành sheet từ đáy trong `ds.css` (cả `Modal.confirm`, chân 3 nút trở lên xếp dọc); `index.html` thêm `interactive-widget=resizes-content`. Kiểm ở 375px: 14 trang 0 ô chữ dưới 16px, ô 44px (nhỏ 32px); Ghi rời tàu và hộp xác nhận Xoá thuyền viên là sheet bám đáy rộng 375px, nút 168×44. 1440: dialog giữ giữa màn 480px, ô 40px chữ 14px. Không vẽ tay kéo trên sheet của dialog vì chưa kéo được (chỉ `BottomSheet` ở bước 3 có kéo). **Sự cố:** khi tìm dialog Duyệt YCTT, tôi bấm nút "Duyệt" ở TT-2026-00379 trên DB dev; nút này duyệt ngay, không có dialog. Đã đưa về "Cần duyệt" bằng "Bỏ duyệt"; lịch sử YCTT có thêm hai dòng Duyệt / Bỏ duyệt của tài khoản demo. Dialog duyệt trên điện thoại chưa xem được, để testcase E10. 302 test frontend qua. |
| 2026-11-05 | Bước 3 | (commit này) | Thêm `Fab`, `BottomSheet` (Drawer đáy, kéo tay kéo > 80px thì đóng), `DateField` / `DateRangeField` (điện thoại: `<input type="date">` / `type="month"` trong suốt phủ lên ô hiện DD/MM/YYYY; `disabledDate` kiểm sau khi chọn, `minDate` / `maxDate` chặn ngay; khoảng ngày chỉ báo khi đủ hai đầu), `ScrollRow` (+ `scrollRow.js` hàm thuần), `RowList` (cột khai báo `mobile`). CSS trong `ds.css`. Test `components/ds/__tests__/phoneParts.test.jsx` 12 case. `/design-system` thêm mục "Điện thoại" kèm khung 375px nhúng chính trang (iframe), ở điện thoại không nhúng. CLAUDE.md: 5 dòng mới ở bảng 3.4, thêm mục 3.5 Màn hẹp. Kiểm trên app: khung 375px chạy đúng bản điện thoại (ô ngày của máy, RowList thành dòng, Fab), sửa ô Từ / Đến tràn 2px và cắt chữ ngày (bỏ icon lịch trong khoảng ngày); sheet cao 361px bám đáy bo 20px, nút 167×44, kéo 120px thì đóng. 314 test qua; `npm run lint` còn 1 lỗi cũ ở `OwnershipFields.jsx`. Mục "Nút" của /design-system tràn 8px ở 375px là lỗi cũ, để bước 10. |
| 2026-11-05 | Bước 4 | (commit này) | `AdminLayout`: biến `--topbar-h` (64px, 56px dưới 768px) thay số 64 cứng ở khung danh sách dính, mục lục form, ma trận vai trò, xem trước exports. Dưới 768px (cả dải ngăn kéo, không chỉ dưới 640px như mục 4.4 ghi): tiêu đề bỏ mục cha, ẩn tên + mũi tên ở nút tài khoản, nút icon 40×40. Ngăn kéo: mục 44px (trang con 40px), đầu cao bằng topbar (`min-height`, vì antd đè `height`), đáy có email, vai trò và nút Đăng xuất (dòng riêng để email không bị cắt). Link "Dùng MCAH trên điện thoại" để bước 12 khi có trang hướng dẫn. Kiểm 375px: topbar 375×56, tiêu đề "Mục tiêu tháng" không cắt, ba nút 40×40, ngăn kéo 280px, đầu 56px. 1440px không đổi. Ảnh chụp của công cụ trình duyệt bị thu nửa ở màn DPR 2 (đã thử thẻ viewport cũ, vẫn vậy: lỗi công cụ), nên chụp ảnh duyệt bằng Chrome headless (Playwright cài tạm ở scratchpad, đăng nhập bằng nút Nhập nhanh TK demo). Server Vite của phiên khác từng phục vụ `AdminLayout.css` rỗng sau khi ghi file; lưu lại file là hết. ⛔ Chờ duyệt ảnh. |
| 2026-11-06 | Bước 5 | (commit này) | Thanh công cụ danh sách dưới 768px làm bằng CSS chung trong `ds.css` (không đổi JSX desktop): không còn card, dính dưới topbar, tầng 1 ô tìm + Lọc / ⋯ / Thêm, tầng 2 các ô chọn chia đều một hàng; nút Bộ lọc còn icon + số. Dưới 640px nút Thêm trong thanh ẩn, thay bằng `Fab` ở 9 trang (8 danh sách + Danh mục) và Tài khoản. Component mới `ListFilters`: desktop là hàng lọc như cũ, điện thoại là `BottomSheet` "Bộ lọc" với Xoá lọc / "Xem n …" (số lấy từ tổng danh sách, điều kiện vẫn áp ngay khi đổi). `CrewFilterBar` thành `CrewFilterFields` (chỉ các ô). Đối tác dùng chung `CrewFilterButton`. Chuyến tàu: ở điện thoại ô "Trên tàu trong khoảng" vào sheet (dùng `DateRangeField`), tính vào số điều kiện. `ListFooter` ở điện thoại: "1–20 / n …" + phân trang gọn, bỏ ô số dòng. Tài khoản: `UserTable` dùng `RowList`; điện thoại bấm dòng mở chi tiết, Xem / Sửa / Xoá vào menu ⋯ (desktop không đổi, không bấm dòng). `useListSticky` đọc `--topbar-h`. Kiểm 375px: 9 trang không tràn, thanh công cụ 121px (2 tầng ô 44px; mục "Xong khi" ghi ≤ 104px tính theo ô 40px), Fab mở đúng trang thêm, sheet lọc đúng số, menu ⋯ không mở dòng. 700px: Fab ẩn, nút Thêm ở thanh, không tràn; YCTT 157px (hàng tab trạng thái đầy đủ). 1440px: thanh công cụ, hàng lọc, bảng, ô số dòng như cũ. Server dev hôm nay do phiên này bật (máy khởi động lại). 314 test qua; lint còn lỗi cũ ở `OwnershipFields.jsx`. |
| 2026-11-06 | Bước 6 | (commit này) | Thay 28 chỗ `DatePicker` và 1 `RangePicker` trong 14 file trang (cùng 2 ví dụ ở `/design-system`) bằng `DateField` / `DateRangeField`, giữ nguyên mọi prop. Form thuyền viên có hàm riêng tên `DateField` nên import đặt tên `DateInput`. `DateField` ở điện thoại đọc `Form.Item.useStatus()` để viền đỏ khi thiếu trường. `disabledDate` giữ như cũ (desktop không đổi); ở điện thoại kiểm sau khi chọn. Kiểm 375px: 0 bảng lịch antd, 0 trang tràn ở form thuyền viên / chuyến / cơ hội / hợp đồng / mục tiêu tháng; đổi ngày cấp hộ chiếu thì form ghi "1 thay đổi" (không lưu); Ghi rời tàu chọn 01/01/2030 thì báo "Ngày này không chọn được", giá trị giữ (đã Huỷ); Tạo chuyến trống bấm lưu thì ô ngày viền đỏ + "Chọn ngày lên tàu", không tạo gì. 1440px: vẫn ô antd, cỡ như cũ. Chưa lưu thật một bản ghi để so DB (mục "Xong khi"): để testcase D4, D5 chạy trên máy thật. 314 test qua; lint các file đã đổi sạch. |
| 2026-11-06 | Bước 7 | (commit này) | Header chi tiết làm bằng CSS trên lớp `crew-head` đang có (không tách component `DetailHead` như mục 4.4 ghi, vì 8 trang đã chung một cấu trúc; desktop không đụng JSX): dưới 640px header là grid một cột; trang có ảnh / tile thì ảnh 60×80 hoặc tile 44px cạnh tên, khối `dl` trải ngang "nhãn 38% – giá trị", kẻ mảnh; ẩn nút Tải ảnh đè trên ảnh (chưa làm bấm ảnh xem lớn). Component mới `HeadActions` (8 trang): desktop render y cũ; điện thoại một hàng ⋯ + nút chính (primary, hoặc `data-main`, không có thì nút cuối) + thêm một nút nếu cả hai chữ ≤ 12 ký tự, phần còn lại vào menu ⋯ gộp với menu sẵn có. Hợp đồng Hiệu lực đánh dấu "Kết thúc hợp đồng" là nút chính. `Crumb` ở điện thoại còn "‹ {nấc cha}"; thêm prop `back`; Thuyền viên, Tải giấy tờ, Soát giấy tờ chuyển sang `Crumb` (2 trang sau `back={false}` để desktop giữ nguyên). `StatusTabs` thêm `sticky` (ô "Mục:" dính dưới topbar ở điện thoại) cho 6 trang. Khối chỉ đọc `sf-ro` và `DescriptionList` ở điện thoại thành 2 cột từ 280px (desktop giữ 384px). Bỏ quy tắc riêng `.partner-profile .crew-head__meta` một cột. Kiểm 360 và 375px: 10 trang không tràn (trước: HĐ 466px, Cơ hội 425px), không giá trị vỡ từng chữ, mọi hàng nút một hàng không cắt chữ, menu ⋯ của HĐ có In hợp đồng + Đưa về Nháp. Hai lỗi tìm ra khi chụp và đã sửa: header xếp dọc bằng flex làm ô ghi chú cao 280px (đổi sang grid), và header không có ảnh (YCTT) bị đẩy tiêu đề vào cột hẹp (giới hạn quy tắc vào `.crew-head__person`). 1440px: ảnh 130×195, tile 168px, đủ nút, breadcrumb đủ chuỗi như cũ. 316 test qua (thêm 2 test `HeadActions`). ⛔ Chờ duyệt ảnh. |
| 2026-11-06 | Bước 8 | (commit này) | Quét mọi tab trang chi tiết và form ở 375px. Các bảng đã có dạng thẻ từ trước (Giấy tờ, Hợp đồng của thuyền viên, YCTT của hợp đồng) giữ nguyên; bảng tiền YCTT và trang sửa YCTT đã vừa 375px sau bước 2–7. Sửa: (1) 3 bảng khoản tiền / kỳ thanh toán của Hợp đồng (chi tiết, thêm, sửa) là `<table>` tự dựng có ô nhập nên không dùng `RowList`: ở điện thoại CSS xếp lại, chỉ xem thì 3 cột gọn tên / Phải thu / Phải chi với hàng chú thích, có ô nhập thì mỗi khoản một khối tên trên, hai ô dưới (nhãn từ `data-label`); bảng `ct-table--two` của YCTT không đổi. (2) `RowList` thêm `rowSelection` (ô tích đầu dòng) và `rowClassName`; bảng Ứng viên của Cơ hội và bảng Đi tàu của Tàu chuyển sang `RowList`. (3) Mục tiêu tháng ở điện thoại: "Cả công ty" lên đầu, mỗi người một card hai ô (dùng lại ô nhập của bảng). (4) `MoneyInput` mặc định `inputMode="decimal"` (ô cho số âm giữ bàn phím thường); ô số hợp đồng ở Mục tiêu tháng `inputMode="numeric"`. Kiểm 375px: không còn bảng cuộn ngang (HĐ 3 bảng 341px, Ứng viên 2 dòng, Mục tiêu tháng 4 card). 1440px: bảng HĐ 790px 3 cột có đầu bảng, Ứng viên còn cột ô tích, Mục tiêu tháng vẫn bảng. `SmartCompareCard` (so sánh khi tra cứu tàu) chưa kiểm: cần thao tác tra cứu, để bước 11. 316 test qua. Thấy ở bước này, để bước 9: thanh cân đối ở form Hợp đồng chiếm ~250px đáy màn. |
| 2026-11-06 | Bước 9 | (commit này) | Thanh lưu dựng tay ở 9 form nhưng chung class `sf-savebar*`, nên làm bằng CSS điện thoại trong `SeafarerForm.css`: một hàng sát đáy (chừa vùng an toàn), ẩn câu nhắc và danh sách trường, còn "n thay đổi"; nút cao 44px; form thêm mới (3 nút) ẩn Huỷ — nút Huỷ ở 7 form gắn class `sf-savebar__cancel`; câu báo lỗi (`sf-savebar__msg--err`, vd. tổng âm ở sửa YCTT) vẫn hiện. Lệch mục 4.4: số thay đổi đứng bên trái thay vì nằm trong nút "Lưu thay đổi · n" (không sửa JSX từng form). `FleetParts`: thêm `FormCrumb` (điện thoại một nấc "‹ …", cũng là lối Huỷ của form thêm mới), `FormToc` (điện thoại dùng `ScrollRow`) và `AddAnotherLabel` (điện thoại "Lưu & thêm khác"; bọc một span vì nút antd giãn chữ khi có nhiều con). Form thuyền viên dùng `FormCrumb`, `FormToc`. Điện thoại: cột tóm tắt (hàng mục) dính dưới topbar, ẩn khối tên + ảnh; `scroll-margin` của khối form cộng chiều cao hàng mục. Thanh cân đối Hợp đồng / thanh tổng sửa YCTT: dòng budget / tổng, ba số một hàng, nút một hàng. **Chưa làm:** hỏi lại khi rời form lúc đã nhập (testcase G5, G8) — hiện cả desktop cũng chưa có (nút Huỷ chuyển trang luôn, chỉ màn Vai trò có `useBlocker`); chờ người dùng quyết. Kiểm 375px: 10 form, thanh lưu thường 65px một hàng, HĐ / sửa YCTT 161px (trước ~250px), không nút cắt chữ, không tràn; Tạo chuyến trống bấm lưu thì ô lỗi đầu "Thuyền viên" nằm giữa hàng mục (đáy 244px) và thanh lưu (đỉnh 747px). 1440px: thanh lưu, câu nhắc, Huỷ, nhãn đầy đủ, mục lục dọc, breadcrumb như cũ. 316 test qua. |
| 2026-11-06 | Bước 9 (bổ sung) | (commit này) | Người dùng chọn "Thêm hỏi lại" cho mọi form, cả desktop. Hook mới `hooks/useLeaveGuard.js` (tách từ màn Vai trò): còn thay đổi chưa lưu mà chuyển trang trong app (Huỷ, link "‹ …", menu, nút quay lại) thì hỏi "Rời trang này?" — Ở lại / Rời trang; tải lại, đóng tab thì `beforeunload`; đổi query cùng đường dẫn không hỏi; lưu xong gọi `allow()` trước `navigate`. Gắn vào form Thuyền viên, Tàu, Đối tác, Cơ hội, Chuyến, Hợp đồng, sửa YCTT, Mục tiêu tháng; màn Vai trò dùng lại hook. "Đã đổi": form sửa theo bộ đếm thay đổi sẵn có; form thêm mới theo `form.isFieldsTouched()` (form thuyền viên tính thêm giấy tờ quét đang chờ lưu, vì tự điền không đánh dấu ô đã chạm). Test `hooks/__tests__/useLeaveGuard.test.jsx` 3 case. Kiểm trên app: 1440 thêm tàu chưa nhập → Huỷ đi luôn; nhập tên → Huỷ hỏi một hộp, Ở lại giữ chữ, bấm menu Thuyền viên hỏi, Rời trang thì đi; 375 sửa thuyền viên chưa đổi → "‹ huy" đi luôn, đổi Nơi sinh → hỏi (sheet đáy), Ở lại giữ chữ. Không lưu bản ghi nào. 319 test qua. |
