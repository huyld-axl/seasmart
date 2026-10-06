# MCAH — Kế hoạch thiết kế giao diện bằng skill `ui-ux` (evondevKit), đầu ra Figma

- **Ngày lập:** 2026-10-06
- **Trạng thái:** HuyLD duyệt ngày 2026-10-06, nhận các câu trả lời đoán sẵn ở mục 11.
- **Nguồn:**
  - **Tài liệu gốc nằm ngay trong repo này:** `docs/mcah-tong-hop-tinh-hinh-ke-hoach.md`. Kế hoạch này lấy từ đó phạm vi MVP Demo cho Sales (mục 3), kịch bản demo 10 phút (mục 3.4), các quyết định đã chốt và lịch 4 tuần (mục 7).
  - **Audit frontend của repo này** (chạy lại ngày 2026-10-06): `frontend/package.json`, `src/App.jsx`, `src/layouts/AdminLayout.jsx`, `src/index.css`, cùng `AdminLayout.css`, `App.css`, `MasterSubPage.jsx`, `LoginPage.jsx`. Kết quả ở mục 1.1.
  - **Skill nằm ở repo `huyld-axl/evondevKit`**, thư mục `skills/ui-ux`: `SKILL.md`, `references/` (gồm `layouts/`, `components/`), `scripts/probe.mjs`. Đọc ở bản 0.3.13 (commit `6465d4c`), cùng bản mà bản nháp dựa vào.
  - Trang hướng dẫn của skill (evondev-uiux.vercel.app) bị proxy chặn (403). Kế hoạch dựa vào `README.md` và mã nguồn skill.
  - **Tài khoản Figma** (đã kiểm bằng `whoami` ngày 2026-10-06): gói **Starter**, ghế **Full**, team `Huy Le Duc's team`, `planKey` `team::1303965334335449875`.
  - Bản nháp: `docs/mcah-ui-ux-design-plan.md` ở commit `09a5544` (repo evondevKit, nhánh `claude/stoic-darwin-8yei4x`). Chỗ đã sửa so với bản nháp ghi ở Phụ lục A.
- **Đầu ra cuối:** một file Figma **"MCAH — MVP Demo UI"** (đã tạo ở Drafts ngày 2026-10-06: https://www.figma.com/design/YuVCpyxaQQpgkWBsu0QAZO). File gồm token, component, toàn bộ màn trong phạm vi demo (desktop 1440, mobile 375, đủ trạng thái) và prototype bấm được theo kịch bản demo. Kèm một bảng FigJam vẽ luồng nghiệp vụ và sơ đồ trạng thái. **Canva chỉ dùng làm tài liệu cho Sales** (giai đoạn 7). Canva không chứa thiết kế gốc.

---

## 0. Tóm tắt nhanh

1. **Skill làm việc bằng code, không bằng Figma.** Skill tự ghi: *"code chính là hi-fi"* (`U5`). Ở nấc Màu, wireframe dùng đúng token và component của bản dựng (`U3`). Vì vậy kế hoạch **không vẽ Figma tay song song**. Thứ tự làm:
   - Skill ra HTML, HTML qua probe, HuyLD chọn phương án.
   - **Chuyển sang Figma** bằng `use_figma` (Figma MCP), giữ đúng token, khoảng cách, chữ.

   Figma là bản sao để duyệt, chia sẻ và trình bày. Nguồn gốc vẫn là HTML của skill và code.
2. **Dùng lần lượt cả 8 lối của skill:**

   | Lối | Dùng cho MCAH |
   | --- | --- |
   | Soi (`V`) | Ảnh "trước" của Marineport |
   | Làm logo | MCAH chưa có logo |
   | Design system trước (`D9`) | Theme Ant Design và nguyên tố riêng của MCAH |
   | Như một designer (`U`, mặc định) | 3 nhóm màn lõi |
   | Dựng luôn | CRUD Tàu, Chủ tàu |
   | Dựng lại theo gu skill | Danh mục cũ, quản lý user |
   | Việc nhỏ hơn một màn | Title, favicon, badge vai trò, sửa lẻ sau Figma |
   | Refactor (`L`) | Dọn CSS cũ |

   `scripts/probe.mjs` chạy ở mọi giai đoạn (bảng ở mục 2.3). Mọi file trong `references/layouts/` và `references/components/` đều có chỗ dùng, hoặc ghi rõ vì sao không dùng (mục 3).
3. **Phạm vi bám mục 3.2 và 7.2 của tài liệu gốc:**
   - Chỉ gồm luồng 1→6: tài liệu → AI → duyệt → hồ sơ → kiểm tra → xuất 2 mẫu.
   - Không có dashboard riêng. Hàng đợi duyệt là bộ lọc trên danh sách tài liệu.
   - Không có màn onboarding template, không gợi ý trùng người, không bulk accept, không so sánh revision bằng UI, không assignment draft.
   - Màn của phase sau chỉ vẽ khi có yêu cầu, và phải gắn nhãn "Định hướng".
4. **Thời gian:** khoảng **6 ngày làm việc**, chạy song song tuần 1–2 của lịch 4 tuần (mục 7.3 tài liệu gốc). File Figma xong trước mốc M1. Màn nào có backend trước thì dựng thật (`U4`) trước, theo sprint.

   Lịch 7.3 chưa tính giờ thiết kế. Vì vậy:
   - Claude Code chạy các giai đoạn thiết kế.
   - HuyLD chỉ dành thời gian ở các cổng duyệt, mỗi cổng khoảng 30–60 phút.
5. **Năm cổng duyệt của HuyLD:**
   - Chọn logo.
   - Duyệt trang design system.
   - Duyệt brief của từng nhóm màn (cổng 1).
   - Chọn wireframe của từng nhóm màn (cổng 2).
   - Duyệt file Figma.

   Lối dựng lại theo gu skill có thêm một lượt trả lời bảng (`ok` / `bỏ 7`). Ngoài các chỗ đó, skill không hỏi gì thêm: chỗ nào chưa rõ thì lấy mặc định và báo lúc giao.
6. **Hai việc phải gỡ ở ngày 1, nếu không thì kế hoạch kẹt:**
   - **Xác nhận cách làm Figma trên gói Starter:** mọi thao tác đọc, sửa, chụp kiểm đi qua `use_figma` (mục 1.4, câu hỏi 5).
   - **Probe không tự đăng nhập được** vào các route có `ProtectedRoute` (mục 1.4, câu hỏi 6).

---

## 1. Đầu vào và ràng buộc

### 1.1 Audit dự án (câu 2 của `SKILL.md`, đã chạy lại)

> Audit: React 19 + Vite 8, **không Tailwind**, UI kit **Ant Design 6** (`antd ^6.3.2`), React Router 7,
> React Query 5, Zustand 5, `dayjs`, icon `@ant-design/icons`. Chưa có thư viện biểu đồ, bảng ảo hay trình xem PDF.
> Theme ở `App.jsx` (`ConfigProvider`): `colorPrimary #003366`, `colorSuccess #07bc0c`, `colorWarning #f1c40f`,
> `colorError #e74c3c`, `colorInfo #3498db`, `borderRadius 2`, font Roboto, locale `viVN`.
> CSS thuần: `index.css` (nạp Roboto từ Google Fonts, biến `--color-*`), `App.css` (205 dòng, còn CSS mẫu của Vite
> như `.counter`, `--accent`), `AdminLayout.css` (sidebar `#001529`, header có `box-shadow`).
> Khung app: `AdminLayout` dùng `Menu theme="dark"`. Đầu sidebar là chữ "MarinePort" (thu gọn thành "MP").
> Dưới `md` là `Drawer` tối, có nút ✕. Header có `NotificationBell` và menu user ("Đăng xuất" `danger`).
> Avatar user viết cứng `#003366`. **Không có logo:** favicon là của Vite, `<title>` là "frontend", `lang="en"`.
> Đăng nhập (`LoginPage`) chỉ có email, mật khẩu, nút Đăng nhập. Backend không có quên mật khẩu hay đăng nhập Google.
> Danh mục `/master-data/:tab` có 6 tab: Chứng chỉ, Loại tàu, Quốc gia, Loại hợp đồng, Loại khóa học, Cảng biển.
> Menu chỉ hiện 5 tab (thiếu Quốc gia). **Không có tab Chức danh.** `/403` là một `div` trơn. Không có trang 404:
> mọi route lạ chuyển về `/seafarers`. Vai trò hiển thị qua `RoleBadge` và `UserFilters` (5 role cũ).
> Phong cách: flat (không glass, không gradient). Copy tiếng Việt. Không dark mode.

Hệ quả, theo bảng của câu 2 trong `SKILL.md`:

- **Dùng component Ant Design, không đưa thêm kit khác** (`S9`). Skill áp vào dự án bằng cách **chỉnh theme token của AntD** (`ConfigProvider`), cộng vài mặc định trái luật:
  - Bóng card và bóng header (`M15`).
  - Ô nhập phải có nền surface.
  - Chỉ dùng 4 dạng nút của `I1`.
- **Token AntD cần giá trị cụ thể**, không nhận `var(--…)` như shadcn. Vì vậy `D9` phải giữ **một nguồn**: một file token xuất cùng bộ mã cho cả `ConfigProvider` và `index.css`. Có thể bật chế độ CSS variable của AntD (`theme.cssVar`) để biến CSS và token AntD trùng nhau.
- Dự án không có Tailwind, nên **màu lấy theo biến trong `references/tokens.css`**, không tự đặt mã màu (bảng đối chiếu ở `M7`, `M30`). Wireframe HTML của skill vẫn dùng Tailwind bản trình duyệt. Đó chỉ là cách vẽ của skill, không đưa Tailwind vào dự án.
- **Không tự cài thư viện mới** (`N10`). Màn duyệt cần xem tài liệu. Với dữ liệu demo, xem ảnh trang là đủ, vì backend render PDF thành ảnh ở Sprint 1. Cần trình xem PDF thật thì skill chỉ đề xuất một dòng, HuyLD quyết.
- **Font Inter:** `brand-tokens.md` dặn dự án thật thì tự host bằng `@fontsource/inter`, mà đó là một gói mới. HuyLD chọn giữa cài gói đó hoặc tạm nạp Inter từ Google Fonts như Roboto đang làm (câu hỏi 2).

### 1.2 Ràng buộc nội dung (từ tài liệu gốc)

- **Dữ liệu synthetic** (mục 3.1):
  - Không dùng tên chủ tàu thật hay hồ sơ thuyền viên thật.
  - **Không dùng dữ liệu seed `011`** (nguồn là file V-ISEA, tên có thể là thật, xem B5) trong ảnh nào đưa lên Figma hay Canva.
- **Câu chữ readiness:** màn hình ghi "Sẵn sàng hồ sơ trong phạm vi MVP". Không ghi "Đủ điều kiện lên tàu", không ghi "Verified crew" (mục 1.4).
- **Trường không đọc được thì hiện UNKNOWN**, không đoán. Kịch bản demo cố ý giữ một trường UNKNOWN, nên trạng thái này phải có hình riêng: cả lúc "chưa xử lý", cả lúc "đã xác nhận giữ UNKNOWN".
- **Tên hiển thị: MCAH** (Q7). Thay "MarinePort" ở sidebar, drawer, `<title>`.
- **Module Marineport đóng băng** (Q3): đào tạo, khóa học, QR, waitlist, cổng thuyền viên, tin nhắn. Thông báo cũng thuộc nhóm "không liên quan MCAH" (mục 2.3), nên **chuông thông báo ẩn ở bản MCAH**. Các module này không thiết kế lại.

### 1.3 Đối chiếu phạm vi MVP với danh mục màn

| Mục tài liệu gốc | Yêu cầu | Màn ở mục 5 |
| --- | --- | --- |
| 3.2.1 Upload | PDF/JPG/PNG ≤ 25 MB, ≤ 50 trang; hash chống trùng; `RECEIVED → PROCESSING → REVIEW_REQUIRED → COMPLETED / FAILED`; file gốc chỉ tải khi có quyền | A1 |
| 3.2.2 AI extraction | `missing_reason`, số trang làm bằng chứng; bất đồng bộ, frontend hỏi trạng thái định kỳ (7.2) | A1 (trạng thái), A2 (kết quả) |
| 3.2.3 Màn duyệt | **Trái là tài liệu gốc (phóng to, lật trang), phải là form**; click trường nhảy tới trang; tô UNKNOWN, ngày mơ hồ, IMO chưa đối chiếu; chấp nhận, sửa (bắt buộc lý do), từ chối, ONGOING; lưu nháp | A2 |
| 3.2.4 Công bố | Revision, 409 khi xung đột, audit; 422 khi chưa duyệt đủ trường trọng yếu. **Gợi ý trùng người: cắt (7.2)** | A2, B2 |
| 3.2.5 Kiểm tra | Checksum IMO, đối chiếu danh mục tàu, bằng chứng thủ công; 5 trạng thái verification; sea time; 4 rule (7.3); readiness kèm "chưa đánh giá" | B2, B3 |
| 3.2.6 Xuất | 2 mẫu (CV, sea service matrix); policy hiện / ẩn / thay; preview → duyệt (người duyệt khác người tạo) → phát hành; `TEMPLATE_CAPACITY_EXCEEDED`; STALE | C1, C2, C3 |
| 3.2.7 Dashboard | **Cắt (7.2):** dùng danh sách tài liệu và hồ sơ có lọc theo trạng thái | A1, B1 (có bộ lọc). Không có màn riêng |
| 3.2.8 Đo thời gian | Ghi lúc mở và đóng màn duyệt | Không có UI |
| 7.2 cắt thêm | Upload/onboarding template, bulk accept, so sánh revision bằng UI, assignment draft, `OWNER_EXPERIENCE` | Không vẽ |
| 7.3 tuần 1 | Đổi tên MCAH, ẩn module Marineport, CRUD tàu và chủ tàu | D1, D3 |
| Sprint 2 (mục 4) | Thêm role `reviewer`; `operator` hiển thị là Crewing Officer; `admin` là Tenant Admin / Template Manager | D4 (Quản lý user) |

**Thứ tự cắt khi trễ (7.3) áp vào thiết kế.** Ba thứ có thể bị cắt nên phải vẽ thành **khối tách được**:
- Bằng chứng thủ công trong B3.
- Bước duyệt trong C2.
- Mẫu thứ hai trong C1.

Khi bị cắt, bỏ khối đó đi mà không phải vẽ lại khung.

### 1.4 Ràng buộc công cụ

| Thứ | Hiện trạng | Hệ quả cho kế hoạch |
| --- | --- | --- |
| Figma MCP | Đã nối. Có `use_figma`, `create_new_file`, `generate_diagram`, `get_screenshot`, `get_metadata`, `upload_assets`, `search_design_system`, `whoami`. **Không có** `generate_figma_design` trong phiên này | Đủ để dựng variables, components, frames và FigJam bằng code. Không chụp trang web thẳng vào Figma được |
| Gói Figma | **Starter**, ghế Full (đã kiểm) | Starter cho **3 file cộng tác, mỗi file 3 trang**; Drafts cá nhân không giới hạn. Kế hoạch gói file vào đúng 3 trang (mục 7, giai đoạn 5). **Lượt gọi MCP:** lệnh đọc riêng (`get_screenshot`, `get_metadata`, `get_design_context`, `search_design_system`) chỉ **6 lần mỗi tháng**; lệnh ghi (`use_figma`, `create_new_file`) **không bị đếm**. Hướng dẫn `figma-use` cho phép `use_figma` chạy script chỉ đọc và chụp ảnh bằng `node.screenshot()`, nên **đọc, sửa và kiểm đều đi qua `use_figma`**, không dùng lệnh đọc riêng. Figma đổi chính sách thì nâng Professional (khoảng 20 USD/tháng, 200 lượt/ngày) (câu hỏi 5) |
| Code Connect | Cần gói Organization trở lên | Bỏ. Ghi đường dẫn file React vào mô tả của từng component Figma |
| Playwright / Chromium | Chromium có sẵn (`/opt/pw-browsers`). Gói `playwright` chưa có trong dự án | `probe.mjs` chạy được. Cài `playwright` vào thư mục tạm, không cài vào dự án (mục 2.3) |
| **Đăng nhập khi probe** | Token nằm ở `localStorage` (`authStore.js`). Mọi route trừ `/login` có `ProtectedRoute`. `probe.mjs` không có tuỳ chọn đăng nhập hay nạp sẵn storage | Không gỡ thì probe các route app chỉ chụp được màn đăng nhập. Đề xuất (câu hỏi 6): một module **chỉ chạy ở dev** (`if (import.meta.env.DEV)`), import **đầu tiên** trong `main.jsx`, trước `authStore`. Module đọc `?devToken=` vào `localStorage` rồi xoá tham số khỏi URL. Token là JWT thật của admin synthetic, backend vẫn kiểm như thường. Code này không vào bản build production |
| Xem wireframe | Skill gửi link `http://localhost:<cổng>` | Chạy Claude Code **trên máy HuyLD** thì bấm được ngay. Chạy ở phiên cloud thì localhost không mở được từ app: gửi mỗi wireframe thành một **Artifact riêng tư** (Tailwind trình duyệt, lucide qua jsDelivr và Google Fonts đều nằm trong danh sách được phép), hoặc mở file HTML đã đẩy vào `docs/design/wireframes/` |
| Canva | Chưa nối connector trong phiên này | Chỉ dùng cho tài liệu Sales (giai đoạn 7), làm tay hoặc nối connector sau. Không chứa thiết kế gốc |

---

## 2. Bản đồ lối của skill

### 2.1 Tám lối, dùng ở đâu

| # | Lối của skill (câu 1 `SKILL.md`) | Mở file | Dùng cho MCAH | Đầu ra | Cổng |
| --- | --- | --- | --- | --- | --- |
| 1 | **Soi UI đang có** (`V`, chế độ soi) | `review.md` | 3 route sẽ còn trong MCAH: `/login`, `/seafarers`, `/seafarers/:id` | Bảng lỗi kèm ảnh 375–1920 và dòng "Đối chiếu probe". Dùng làm ảnh "trước" cho Figma và Sales | **Không trả lời `sửa …`**: các màn này đi nhánh `U` |
| 2 | **Làm logo** | `components/logo.md` | Logo và favicon MCAH (thay chữ "MarinePort" và favicon của Vite) | Trang chọn 3 hướng. Mỗi hướng hiện trong sidebar (mở và thu gọn), màn đăng nhập, tab trình duyệt, cỡ 16/32/64px | Chọn 1 hướng |
| 3 | **Design system trước** (`D9`) | `system.md`, `brand-tokens.md`, `tokens.css`, `budgets.md`, `rules-color.md`, `locked-rules.md` | Theme AntD + 7 nguyên tố `D1` + nguyên tố riêng của MCAH (mục 4.3) | Route `/design-system` trong app | Duyệt trang |
| 4 | **Như một designer** (`U`, mặc định) | `design-process.md` + file layout, component tương ứng | 3 nhóm màn lõi A, B, C (mục 5). Khung app, đăng nhập, trang lỗi đi cùng nhóm A | Brief `U1` + bảng `U2`. Wireframe A/B/C + D/E, thanh công cụ Màn / Phương án / Màu / Khổ / Nav / Trạng thái | Cổng 1 + cổng 2 mỗi nhóm |
| 5 | **Dựng luôn** | `design-process.md` (đầu file), `system.md` `D3` | CRUD Tàu và Chủ tàu (D3) | Bản dựng thẳng theo phương án skill sẽ khuyên, kèm dòng "Bố cục: … vì …" | Không cổng |
| 6 | **Dựng lại theo gu skill** | `review.md` (chế độ 3) | Loại tàu, Quốc gia, Cảng biển, Quản lý user (D4) | Bảng dòng Gu / Cấu trúc / Gọn chọn sẵn; chỉ giữ logo và màu nhấn; dòng `Dáng:` lúc giao | Trả lời `ok` / `bỏ 7` |
| 7 | **Việc nhỏ hơn một màn** | File component tương ứng + bố cục mặc định câu 4 | `<title>` "MCAH", `lang="vi"`, favicon (sau giai đoạn 2); `RoleBadge` và `UserFilters` thêm Reviewer, Crewing Officer; sửa lẻ sau vòng Figma | Sửa thẳng, báo một dòng | Không |
| 8 | **Refactor** (`L`) | `refactor.md` | Sau `U4`: dọn `App.css` (CSS mẫu của Vite), `AdminLayout.css` (màu sidebar tối cũ), `index.css` (Roboto, `--color-*`), mã màu viết cứng trong trang (`#003366`, `#fafafa`…) | Diff + ảnh trước/sau giữ nguyên hình. Danh sách "đề xuất sửa" chia hạng theo `V1` | Không |

**Thứ tự lối theo luật skill:**
- Đề vừa muốn đổi hình vừa muốn dọn code thì đi `U` trước, `L` sau (câu 1).
- Đề xin design system và cả màn thì làm hết `D9`, qua cổng, rồi mới vào `U1` (`D9`).
- Dự án đã qua `D9` thì tính là **dự án đã có UI**. Wireframe dán file token của dự án, không dán `tokens.css` của skill, và không có nhóm Nhấn.
- Logo đã chọn ở lối 2, nên thanh wireframe không có nhóm Logo.

**Bẫy câu chữ trong đề.** Bảng câu 1 đọc từ trên xuống, gặp dòng khớp thì dừng. Vì vậy:
- **Đề nhánh `U` không được chứa** "bỏ style cũ", "giữ brand", "dựng luôn", "design system". Nếu chứa, skill rẽ sang lối khác.
- Muốn `U4` dùng vai màu mới (sidebar sáng, trạng thái 4 tông) thay vai màu Marineport cũ, thì ghi trong đề: *"vai màu theo trang `/design-system` đã duyệt"*.
- Lối 6 thì ngược lại: **phải** có "bỏ style cũ".

### 2.2 Các file `references/` dùng xuyên suốt

| File | Dùng ở đâu |
| --- | --- |
| `principles.md` | Mười hai phép thử cho mọi màn. Luồng "Dựng một thứ chưa có mẫu" cho **ô trường có trạng thái duyệt** và **khung xem tài liệu cạnh form** (A2) |
| `budgets.md` | Thang chữ, nhịp, chiều cao control ở `D9`. Text styles Figma lấy đúng thang này |
| `brand-tokens.md`, `tokens.css` | Màu nhấn `#003366` (kèm `--primary-hover`, `--primary-light`, `--ring-focus`, `--border-focus` suy lại), Inter, bỏ khối `.dark` |
| `locked-rules.md` | Đọc trước khi chốt nút, bo góc, sidebar. Đáng chú ý: #1 Đăng xuất đỏ, #2 nút nguy hiểm nền mờ, #4 nút viền là mặc định, #8 mục sidebar đang chọn nền xám + chữ đậm (không màu nhấn), #10 bo góc theo chiều cao, #12 panel trượt 500/350ms, #15 dấu `*` đỏ, #16 không vòng focus ở nút |
| `rules-color.md` (`M`) | `M4` (màu nhấn chỉ ở nút chính, link, nút chọn), `M7` (badge 4 tông), `M14` (hai vai viền), `M15` (bóng chỉ ở lớp nổi), `M20` (không dark mode), `M34` (màu nhận diện cho ô chữ cái chủ tàu) |
| `rules-type.md` (`T`) | `T5` (dấu tiếng Việt), `T24` (ngôn ngữ copy: tiếng Việt, thuật ngữ ngành giữ tiếng Anh), `T27` (skill trả lời bằng tiếng Việt) |
| `rules-form.md` (`F`) | `F1` bo góc, `F15`/`F17` icon |
| `rules-state.md` (`I`) | `I1` 4 dạng nút, `I4` việc nguy hiểm, `I10` hover dòng, `I13` focus ô nhập, `I19` 4 trạng thái, `I20` lớp nổi |
| `responsive.md` (`R`) | Kiểm 375px. Bảng thành danh sách ở mobile, hàng nút không rớt nút lẻ (`R3`) |
| `styles.md` (`P`) | `P1` flat, `P4` đọc audit tầng 3. Không đổi phong cách |
| `checklist.md` | Cổng 3 sau mỗi lần dựng: chạy probe, xem ảnh, chạy hết checklist |
| `refactor.md`, `review.md`, `system.md`, `design-process.md` | Theo lối (mục 2.1) |
| `tailwind-v4-traps.md` | **Không áp:** dự án không có Tailwind. Wireframe dùng Tailwind bản trình duyệt nhưng không đụng CSS cũ |
| `scripts/lint-skill.mjs` | **Không dùng:** chỉ để kiểm chính skill khi sửa luật |

### 2.3 `scripts/probe.mjs`: lúc nào chạy, chạy thế nào

Cú pháp (đầu file `probe.mjs`):

```
node probe.mjs <url> [--widths 375,768,1024,1280,1440,1920] [--out <thư mục>] [--wait 800] [--dpr 1]
                     [--sweep [1440,375,20]] [--wireframe <link phương án đã chọn>] [--pw <thư mục có playwright>]
```

Cài một lần, ngoài dự án: `npm i --prefix "$TMPDIR/evon-probe" playwright`, rồi thêm `--pw "$TMPDIR/evon-probe"`. Môi trường đã có Chromium và đã đặt `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, nên lệnh cài không tải trình duyệt. Route sau đăng nhập cần `?devToken=…` (mục 1.4).

| Giai đoạn | Lệnh (skill tự chạy, đây là để kiểm) | Để làm gì |
| --- | --- | --- |
| 1 · Soi | `node probe.mjs "http://localhost:5173/seafarers?devToken=…" --sweep --out docs/design/before/seafarers` | Đo 6 khổ cố định + quét 1440→375 bước 20px. Ra ảnh "trước" và mã lỗi cho dòng "Đối chiếu probe" |
| 2 · Logo | `node probe.mjs "file://$TMPDIR/evon-design/logo.html?logo=1" --widths 1280,375` (lặp cho `logo=2`, `3`) | Kiểm trang chọn logo, mỗi hướng một lượt |
| 3 · Design system | `node probe.mjs "http://localhost:5173/design-system?devToken=…" --sweep` | Chạy tới khi danh sách `P` trống, tối đa 3 vòng. Ví dụ ép trạng thái bọc `inert data-demo-state` để probe bỏ qua |
| 4 · Wireframe | `node probe.mjs "http://localhost:<cổng>/nhom-a.html?man=duyet&v=a&mau=mau" --widths 1280,375` cho từng `man` × `v` (cả D, E) | Tin gửi cổng 2 có dòng *"Probe wireframe: A sạch, B sạch, C sạch"*. Kiểm thanh công cụ vừa một dòng ở 1280 |
| 5 · Ảnh tham chiếu Figma | `node probe.mjs "<link phương án đã chọn>&mau=mau&tt=<du-lieu\|dang-tai\|rong\|loi>" --widths 1440,375 --dpr 2 --out docs/design/ref/<màn>` | Ảnh gốc để dựng và soi lệch frame Figma (`upload_assets` làm lớp tham chiếu) |
| 6 · Dựng thật `U4` | `node probe.mjs "http://localhost:5173/<route>?devToken=…" --sweep --wireframe "<link phương án>&mau=mau"` | So bản dựng với wireframe ở 1440 và 375 (khoảng cách, chữ, cỡ, màu). Sửa tới khi `P` trống |
| 6 · Dựng lại theo gu (D4) | `--sweep` trên `/master-data/vessel`, `/admin/users` trước và sau | Bảng trước/sau và `so-sanh.html` (`V5`) |
| 6 · Refactor `L` | `--widths 375,1280,1440` trước và sau trên mọi route MCAH | Chứng minh giữ nguyên hình |

`--dark` không dùng (không dark mode, `M20`).

---

## 3. Bản đồ `references/layouts` và `references/components`

### 3.1 Layouts (mở sau khi chốt loại màn, `S11`)

| File, mục | Dùng cho |
| --- | --- |
| `layouts/app.md` · Khung app có sidebar (gồm thu gọn sidebar, chân sidebar, nhóm nút bên phải header, đầu trang trong vùng nội dung) | D1 khung app MCAH. Thu gọn sidebar từ `lg` để A2 đủ chỗ cho hai cột |
| `layouts/app.md` · Bảng dữ liệu | A1 danh sách tài liệu, bảng sea service trong A2 và B2, C3 |
| `layouts/app.md` · Danh sách có bộ lọc | B1 thuyền viên, D3 tàu và chủ tàu. A1 cũng có hàng lọc theo trạng thái thay cho dashboard |
| `layouts/app.md` · Trang chi tiết bản ghi | B2 hồ sơ thuyền viên, C2 bản xuất |
| `layouts/app.md` · Danh sách rỗng | Trạng thái Rỗng của A1, B1, C3, D3 |
| `layouts/app.md` · Trang lỗi (404, 403, 500, bảo trì) | D5. Thay `div` trơn ở `/403`, thêm 404 thay cho việc chuyển hướng im lặng |
| `layouts/app.md` · Trang thành viên và phân quyền | D4 Quản lý user (vai trò Crewing Officer, Reviewer, Quản trị) |
| `layouts/app.md` · Dashboard, onboarding, báo cáo, lịch, kanban, cài đặt, hồ sơ cá nhân, bảo mật, khoá API, thanh toán | **Không dùng.** Dashboard bị cắt (7.2). Các màn còn lại ngoài phạm vi |
| `layouts/form.md` · Đăng nhập | D2. Đề liệt kê đúng nội dung (`S4`): email, mật khẩu, nút Đăng nhập, logo MCAH. Không "Quên mật khẩu", không Google (backend chưa có), không "Ghi nhớ đăng nhập" |
| `layouts/form.md` · Form nhiều trường, trạng thái lỗi | Form Tàu, Chủ tàu (D3). Hộp nhập lý do khi sửa trường (A2) |
| `layouts/form.md` · Form nhiều bước (thanh các bước) | C1 tạo bản xuất: Mẫu → Chính sách liên lạc → Xem trước → Gửi duyệt |
| `layouts/overlay.md` · Panel trượt | B3 đối chiếu tàu, form D3, C1 nếu chọn dạng panel |
| `layouts/overlay.md` · Modal, hộp xác nhận | Xác nhận công bố hồ sơ, phát hành, trả lại bản xuất (`I4`: trả lại không mất dữ liệu nên trung tính) |
| `layouts/overlay.md` · Dropdown, toast, chuyển động | Menu user ("Đăng xuất" đỏ), lọc trạng thái, toast "Đã công bố revision 2". Toast "Hoàn tác" cho xoá mềm ở D3 (`D3`) |
| `layouts/overlay.md` · Panel thông báo, command palette | **Không dùng:** chuông ẩn ở bản MCAH (mục 1.2), không có command palette |
| `layouts/pricing.md` | **Không dùng:** MCAH không có bảng giá. Tài liệu Sales cũng không ghi giá (giai đoạn 7) |
| `layouts/app-kanban.html` | **Không dựng kanban.** Chỉ dùng làm **khung file wireframe** (nạp font, Tailwind trình duyệt, khối token) như `U3` dặn |

### 3.2 Components (dựng trang là ráp, không vẽ lại)

| File | Dùng cho MCAH |
| --- | --- |
| `button.md` | Mọi nút. 4 dạng `I1`: nút chính cho "Công bố hồ sơ", "Phát hành"; nút viền mặc định; nút nguy hiểm nền mờ cho "Từ chối" trường, "Đăng xuất" |
| `card.md` | Panel "Kết quả kiểm tra", khối trong B2, card phương án mẫu ở C1 |
| `description-list.md` | Thông tin cá nhân ở B2 và C2 (revision hồ sơ, version mẫu, hash file) |
| `input.md` | Mọi ô nhập. Khuôn gốc của **ô trường có trạng thái duyệt** (A2) |
| `inline-edit.md` | Khuôn mượn cho chuyển "xem ↔ sửa" của từng trường trong A2. Không dùng để sửa tên ở đầu trang |
| `choice-controls.md` | Select chức danh, loại tàu, cờ, chủ tàu; ô chọn ngày Sign on / Sign off (có cả ngày thiếu phần); checkbox ONGOING; **lựa chọn dạng card** cho mẫu xuất và chính sách liên lạc |
| `file-upload.md` | Khung kéo thả ở A1, danh sách tệp đang tải, dòng báo trùng hash, tệp quá 25 MB hay quá 50 trang |
| `loading.md` | Việc chạy lâu (AI đang trích xuất), khung chờ đúng hình dòng, "Đang lưu… / Đã lưu" cho nháp duyệt, tải lần hai khi hỏi trạng thái định kỳ |
| `banner.md` | STALE trên bản xuất cũ, xung đột 409, lý do BLOCKED, nhãn "Định hướng", câu "Chưa đánh giá: chứng chỉ, visa" |
| `timeline.md` | Lịch sử audit ở B2: ai sửa gì, trước/sau, lý do, trang nào của tài liệu nào (bước 6 kịch bản demo) |
| `list-row.md` | Danh sách rule trong panel kiểm tra, ứng viên tàu ở B3, dòng tài liệu ở mobile |
| `small-controls.md` | Tab của B2, chip lọc trạng thái, phân trang, **nút chỉ có icon** cho phóng to, thu nhỏ, lật trang trong khung xem tài liệu |
| `sortable-header.md` | Cột bảng A1, B1, C3, D3 (sắp theo ngày nhận, thời gian chờ, readiness) |
| `breadcrumb.md` | Đầu trang A2 ("Tài liệu / Sổ B"), B2 ("Thuyền viên / tên"), C2 |
| `avatar.md` | Ảnh thuyền viên ở B1, B2 (có người không ảnh). Avatar ở menu user. Ô chữ cái cho chủ tàu giả |
| `empty-state.md` | Rỗng ở A1 ("Chưa có tài liệu"), B1 sau khi lọc, C3, bảng sea service 0 dòng (sổ C) |
| `charts.md` | Chỉ mục **thanh tiến độ**: "12/18 trường đã duyệt" ở A2. Không biểu đồ, vì dashboard bị cắt |
| `logo.md` | Lối 2 |
| `accordion.md` | Nhóm trường gập mở trong A2 (phương án B), các nhóm rule trong panel kiểm tra |
| `chat.md` | **Không dùng:** MVP không có trợ lý chat (`S1`, `U5`) |
| `comment-thread.md` | **Không dùng:** lý do sửa là một trường của audit, không phải luồng bình luận |
| `otp-input.md` | **Không dùng:** OTP chỉ có ở cổng thuyền viên, đã đóng băng |
| `quantity-input.md`, `range-slider.md`, `tag-input.md`, `tree.md` | **Không dùng:** không có số lượng, khoảng giá, ô nhiều tag hay cây thư mục trong phạm vi demo |

---

## 4. Quyết định thiết kế chốt trước (đề xuất mặc định, HuyLD sửa nếu khác)

### 4.1 Phong cách và thương hiệu

Lối `D9` kèm câu *"bỏ style cũ của Marineport, chỉ giữ màu nhấn"* đổi luôn vai màu. Mọi lối sau theo trang `/design-system`.

| Mục | Hiện tại (Marineport) | Đề xuất cho MCAH | Luật skill |
| --- | --- | --- | --- |
| Phong cách | Flat, sidebar tối `#001529` | **Flat, hướng A "Đường tóc phẳng"**: nền xám nhạt, card trắng viền 1px, không bóng. Sidebar sáng | `P1`, câu 3 `SKILL.md`, `layouts/app.md` |
| Màu nhấn | `#003366` (navy) | **Giữ navy `#003366`** làm màu nhấn duy nhất. Hợp ngành hàng hải, và là màu brand cũ. Suy lại `--primary-hover`, `--primary-light`, `--ring-focus`, `--border-focus` | `brand-tokens.md`, `review.md` chế độ 3 |
| Mục sidebar đang chọn | Nền navy đặc (menu tối của AntD) | **Nền `--secondary` + chữ đậm, không màu nhấn** | Luật chốt #8 |
| Màu trạng thái | `#07bc0c`, `#f1c40f`, `#e74c3c`, `#3498db` (đậm, chói) | Bốn tông của `M7`: xám, xanh lá, hổ phách, đỏ. **Bỏ xanh dương "info"** | `M4`, `M7`, `M30` |
| Bo góc | `2px` mọi chỗ | **8px cho control dưới 40px, 12px cho card và khối từ 40px trở lên** | `F1`, luật chốt #10 |
| Font | Roboto | **Inter** (một font, phân vai bằng độ đậm), đủ dấu tiếng Việt. Cách nạp xem câu hỏi 2 | `brand-tokens.md`, `T2`, `T5` |
| Nút | AntD mặc định | Chỉ 4 dạng của `I1`. Nút viền là mặc định. Nút nguy hiểm nền mờ chữ đỏ | `I1`, luật chốt #2, #4 |
| Bóng | Header có `box-shadow` | Bỏ. Header tách bằng `border-border` | `M15`, luật chốt #18 |
| Ngôn ngữ copy | Tiếng Việt | Tiếng Việt. **Thuật ngữ ngành giữ tiếng Anh** khi tài liệu gốc dùng tiếng Anh: IMO, Sign on, Sign off, Rank, Discharge book | `T24` |
| Dark mode | Không | Không | `M20` |

### 4.2 Kiến trúc điều hướng (sidebar MCAH, 4 mục)

> **Đổi ở cổng 2 (2026-10-06):** HuyLD chốt tài liệu phải đi theo từng thuyền viên. Bỏ mục Tài liệu riêng; A1 thành màn Thuyền viên, mỗi dòng một người, tài liệu nằm trong người đó. Thêm thuyền viên = nhập họ tên + tải sổ.
>
> **Đổi lần 2 ở cổng 2 (2026-10-06):**
> - Màn Thuyền viên xoay quanh con người: tình trạng, tàu, ngày sẵn sàng, giấy tờ hết hạn, độ đầy đủ hồ sơ.
> - Thả giấy tờ vào hồ sơ là điểm wow, không phải trọng tâm: AI tự nhận loại giấy tờ, đọc và điền vào đúng mục.
> - Thêm màn **Hồ sơ thuyền viên** (`/seafarers/:id`): thông tin cá nhân, giấy tờ có hạn, lịch sử đi tàu, lịch sử chỉnh sửa.
> - Màn Duyệt thành dạng **so sánh**: bản gốc bên trái, bản số hoá dựng theo khuôn của từng loại giấy tờ bên phải.
> - Giấy tờ không chỉ có sổ thuyền viên: có cả chứng chỉ huấn luyện, giấy tiêm chủng, hộ chiếu.
> - Khuôn giấy tờ dựng theo ảnh mẫu HuyLD gửi. Chỉ lấy bố cục và nhãn trường, mọi giá trị là dữ liệu giả, ảnh không vào repo.

**Giữ route đang có khi được.** Đổi route là việc của logic, không phải của skill.

| Mục sidebar | Route | Ghi chú |
| --- | --- | --- |
| Thuyền viên | `/seafarers` (giữ) | Mỗi dòng một thuyền viên, tài liệu nằm trong người đó (A1). **Hàng đợi duyệt là tab "Chờ duyệt"** ở đây (7.2). Upload luôn gắn với một thuyền viên. Trang chi tiết `/seafarers/:id` |
| Bản xuất | `/exports` (mới) | Danh sách có lọc trạng thái (chờ duyệt, STALE). Người duyệt cần một chỗ để tìm bản chờ mình. Đây là danh sách, không phải dashboard |
| Danh mục | `/master-data/:tab` (giữ) | Thêm tab **Tàu** và **Chủ tàu** (tên tab cuối cùng do dev chốt, không trùng `vessel` đang là "Loại tàu"). Giữ Loại tàu, Quốc gia, Cảng biển. Chứng chỉ, Loại hợp đồng, Loại khóa học ẩn khỏi menu bản MCAH (Phase 3 hoặc Marineport) |
| Quản trị | `/admin/users` (giữ) | Chỉ `admin` thấy |

- Có 4 mục, nên ở khổ Mobile thanh wireframe có nhóm **Nav: ☰ · Thanh dưới** (`U3`, từ 5 mục trở xuống). **Đoán:** chọn ☰, vì app quản trị ít mở trên điện thoại. Skill ghi lý do trong khung lý do.
- Màn đã có, không thiết kế lại đợt này: `SeafarerFormPage` (`/seafarers/new`, `/:id/edit`) và `SeafarerImportPage`. Hồ sơ MCAH tạo từ màn duyệt. Hai màn này giữ route, ra khỏi menu.
- `DashboardPage` hiện chưa gắn route, và vẫn không gắn.

### 4.3 Nguyên tố riêng của MCAH (thêm vào `D9`, ngoài 7 nguyên tố của `D1`)

| Nguyên tố | Vì sao cần | Mẫu skill gần nhất |
| --- | --- | --- |
| **Ô trường có trạng thái duyệt** + chip "Trang 3" nhảy tới bằng chứng. 7 trạng thái: Đề xuất AI / Đã chấp nhận / Đã sửa (có lý do) / UNKNOWN / UNKNOWN đã xác nhận giữ / Ngày mơ hồ / Từ chối. Thêm cờ "IMO chưa đối chiếu" cho trường IMO | Trái tim của màn duyệt (FR-REV) | `input.md` + `inline-edit.md`. Chưa có mẫu đã duyệt, nên đi luồng "Dựng một thứ chưa có mẫu" (`principles.md`) |
| **Khung xem trang tài liệu**: ảnh trang, phóng to, lật trang, dải số trang, đánh dấu trang đang là bằng chứng | Cột trái của A2 (3.2.3) | `small-controls.md` (nút icon) + luồng chưa có mẫu |
| **Badge trạng thái** cho 7 bộ trạng thái (mục 6) | Một bảng `D2` dùng chung mọi màn | `M7` |
| **Panel "Kết quả kiểm tra"**: tổng readiness, 4 rule PASS / FAIL / UNKNOWN / NOT_APPLICABLE kèm hướng xử lý, dòng "Chưa đánh giá: chứng chỉ, visa" | Sales cần thấy lý do BLOCKED cụ thể | `card.md` + `list-row.md` + `banner.md` |
| **Khung kéo thả tài liệu** + danh sách tệp đang tải, báo trùng hash | Bước 1 của luồng | `file-upload.md` |
| **Việc chạy lâu** (AI đang trích xuất), "Đang lưu… / Đã lưu" | Extraction bất đồng bộ, frontend hỏi trạng thái định kỳ | `loading.md` |
| **Banner** STALE, 409, BLOCKED, "Định hướng" | Bước 2 và 5 của kịch bản demo | `banner.md` |
| **Dòng thời gian audit** | Bước 6 của kịch bản demo | `timeline.md` |
| **Bảng sea service**: tàu theo tài liệu, IMO, Rank, Sign on/off, số ngày, cờ overlap, ONGOING; dòng tổng sea time (union) | Lõi hồ sơ | `layouts/app.md` "Bảng dữ liệu" + `sortable-header.md` |
| **Lựa chọn dạng card**: mẫu xuất (CV / sea service matrix), chính sách liên lạc (hiện / ẩn / thay bằng liên lạc agency) | Bước xuất | `choice-controls.md` |
| **Danh sách mô tả**, **tab**, **phân trang**, **chip lọc**, **thanh tiến độ** | Trang hồ sơ, mọi danh sách, A2 | `description-list.md`, `small-controls.md`, `charts.md` |
| **Ô chữ cái cho chủ tàu** | Phân biệt Chủ tàu A / B ở bản xuất | `M34`, `avatar.md` |

---

## 5. Danh mục màn hình, chia nhóm cho nhánh `U`

Gom thành nhóm để mỗi lượt wireframe có nhóm **Màn** trên thanh công cụ. Mỗi nhóm tối đa 3–4 màn, nhãn một hai chữ, để thanh vừa một dòng ở 1280 (`U3`). Cột "Việc chính" là bản nháp của `U2`. Skill sửa ở cổng 1 và tra quy ước loại sản phẩm (cột cuối `U2`).

### Nhóm A: Tiếp nhận và duyệt, kèm khung app (rủi ro cao nhất, làm đầu tiên)

> **Cổng 2 đã chốt (2026-10-06): Thuyền viên A, Hồ sơ A, Duyệt A.** Wireframe: `docs/design/wireframes/nhom-a.html`.
> - Thuyền viên A: bảng, mỗi dòng một người (tình trạng, tàu hoặc ngày sẵn sàng, giấy tờ hết hạn, độ đầy đủ hồ sơ). Dấu nhỏ "giấy tờ chờ duyệt" dưới tên.
> - Hồ sơ A: đầu trang là người, tab Tổng quan · Giấy tờ · Đi tàu · Lịch sử. Khung thả giấy tờ (điểm wow) ở đầu tab Tổng quan và Giấy tờ.
> - Duyệt A: bản gốc trái, bản số hoá theo khuôn từng loại giấy tờ phải; bấm ô thì ô bên kia sáng; thanh quyết định dưới cùng.
> - Hệ quả: màn Thuyền viên và Hồ sơ của nhóm A đã thay **B1** và **B2**. Nhóm B còn B3 (đối chiếu tàu) và phần readiness (READY / NEEDS_REVIEW / BLOCKED) gắn vào Hồ sơ A.
> - Cần thêm vào design system khi dựng: nhóm trạng thái `crew` (Đang trên tàu, Chờ tàu, Nghỉ phép) và `cert` (Còn hạn, Sắp hết hạn, Hết hạn) trong `statusMap.js`; nút viền trên nền trang rê vào lấy nền `--secondary`.

| Màn | Đến để làm gì | So sánh, quyết định bằng gì | Hành động cuối | Trạng thái phải vẽ |
| --- | --- | --- | --- | --- |
| **A1. Thuyền viên** (`/seafarers`, thay màn Tài liệu riêng) | Thêm thuyền viên kèm sổ, tải thêm tài liệu cho đúng người; thấy ai có tài liệu chờ duyệt hay đang kẹt | Trạng thái xử lý, số trường UNKNOWN, thời gian chờ | Upload; mở màn duyệt | Rỗng, đang tải, lỗi. Tệp trùng hash. Tệp quá 25 MB / 50 trang. FAILED có "Nhập tay". **PROCESSING quá 5 phút tô hổ phách "Chậm"**: trạng thái suy từ giờ, đặt "bây giờ" của wireframe sao cho có một tài liệu như vậy (`U3`). Chip lọc "Chờ duyệt" có số đếm |
| **A2. Duyệt cạnh bằng chứng** (`/seafarers/:id/documents/:docId/review`) | Kiểm từng trường AI đề xuất so với trang gốc, rồi công bố hồ sơ | Giá trị đề xuất ↔ ảnh trang nguồn; trường trọng yếu còn thiếu | "Công bố hồ sơ" (chặn 422 khi chưa duyệt đủ 6 trường trọng yếu) | UNKNOWN, ngày mơ hồ, IMO sai checksum, overlap. Đang lưu nháp. 409 xung đột. Tài liệu 1 trang và 50 trang. Nhập tay (tài liệu FAILED, form trống). **Không có nút chấp nhận hàng loạt** (7.2) |
| **D1. Khung app** | Sidebar 4 mục, header, menu user | Mục đang chọn | | Sidebar thu gọn; ☰ ở mobile; "Đăng xuất" đỏ (luật chốt #1); không chuông |
| **D2. Đăng nhập**, **D5. Lỗi 403/404/500** | Theo bố cục mặc định `layouts/form.md` và `layouts/app.md` | | | D2 chỉ email, mật khẩu, nút. 403 quan trọng sau khi sửa B5 |

**A2 là màn quyết định thắng thua của demo.** Mục 3.2.3 đã chốt **trái là tài liệu, phải là form, bấm trường thì nhảy trang**. Vì vậy cả ba phương án giữ khung hai cột, và khác nhau thật ở **chiến lược duyệt bên phải** (`U3`):

- **A · Theo nhóm trường:** phải là form đầy đủ, chia nhóm "Thông tin cá nhân" và "Sea service" (bảng, mỗi dòng một hợp đồng). Duyệt theo thứ tự tài liệu.
- **B · Việc cần xử lý lên đầu:** phải mở đầu bằng "Cần bạn xem": UNKNOWN, ngày mơ hồ, IMO sai, overlap, trường trọng yếu chưa duyệt. Trường đã ổn gom vào nhóm gập (`accordion.md`). *(Đoán sẽ là phương án khuyên dùng, vì kịch bản demo xoay quanh sổ B. Skill chốt ở `U3`.)*
- **C · Từng trường một:** phải chỉ hiện một trường, trái phóng to đúng vùng trang của trường đó. Có phím tắt chấp nhận / sửa / từ chối và thanh tiến độ "12/18".

Biến thể **D** (gọn chữ) và **E** (bỏ lặp) làm trên phương án khuyên dùng. Dòng đánh đổi phải tính cả sidebar: hai cột cộng sidebar 240px ở 1280 còn bao nhiêu px, có cần thu gọn sidebar không.

### Nhóm B: Hồ sơ và kiểm tra

| Màn | Đến để làm gì | So sánh bằng gì | Hành động cuối | Trạng thái phải vẽ |
| --- | --- | --- | --- | --- |
| **B1. Danh sách thuyền viên** (`/seafarers`) | Tìm hồ sơ sẵn sàng để xuất, hoặc hồ sơ bị chặn | Readiness, Rank, tổng sea time, revision mới nhất | Mở hồ sơ | Tên dài 2 dòng, 0 sea service, BLOCKED, rỗng sau khi lọc, không avatar |
| **B2. Hồ sơ thuyền viên** (`/seafarers/:id`) | Xem hồ sơ chuẩn, lý do bị chặn, lịch sử sửa | Panel Kết quả kiểm tra; bảng sea service | Sửa (tạo revision mới, bắt buộc lý do); Tạo bản xuất | READY_IN_SCOPE / NEEDS_REVIEW / BLOCKED. ONGOING. Số revision ở đầu trang. Tab **Lịch sử** (dòng thời gian audit). **Không có tab so sánh revision** (7.2) |
| **B3. Đối chiếu tàu** (panel trượt trong A2 và B2) | Xác nhận tàu theo IMO, hoặc đính bằng chứng thủ công | Danh sách tàu ứng viên (IMO trước, tên chỉ để gợi ý), trạng thái verification | Chọn ứng viên / đính bằng chứng | NOT_FOUND, CONFLICT, nhiều ứng viên, IMO sai checksum. **Khối bằng chứng thủ công tách được** (thứ cắt đầu tiên của 7.3) |

> **Cổng 2 nhóm B và C đã chốt (2026-10-06): Đối chiếu tàu A, Sẵn sàng xuất A, Tạo bộ giấy A, Duyệt và ký A.** Bản xuất và Ký online mỗi màn một phương án. Wireframe: `docs/design/wireframes/nhom-bc.html`.
> - Đối chiếu tàu A: panel trượt từ màn Duyệt, thẻ ứng viên ghi Khớp / Khác từng trường, khối bằng chứng thủ công gập được.
> - Sẵn sàng xuất A: badge cạnh tên trong Hồ sơ, banner liệt kê lý do kèm nút sửa ngay.
> - Tạo bộ giấy A: tick tự do 12 giấy (nhóm theo giai đoạn, nút chọn nhanh, "Như lần trước"), các bộ đã xuất dùng lại được, xem trước bên phải.
> - Duyệt và ký A: danh sách giấy, xem giấy, cột chữ ký (ký trong app, link SMS, ô điền tay).
> - Cần thêm vào design system khi dựng: panel trượt, thanh bước, badge `pack` (Nháp, Chờ duyệt, Đang ký, Đã xong, Cần làm lại, Bị trả lại), trạng thái chữ ký (Đã ký, Chờ ký, Ký tay khi in).

### Nhóm C: Xuất bộ hồ sơ

> **Đổi phạm vi (2026-10-06), theo 12 mẫu thật HuyLD gửi:**
> - **Đơn vị xuất là bộ giấy tờ**, chia theo giai đoạn:
>   - Tuyển dụng: KQ thi tuyển, TB trúng tuyển, CV chủ tàu Trung Quốc, Phiếu thu.
>   - Lên tàu: QĐ điều động, Đơn tham gia BHXH hoặc Đơn không tham gia BHXH (chọn một), Thư bảo lãnh, Ủy quyền cá nhân, Ủy quyền nhận lương.
>   - Rời tàu: QĐ rời tàu, Thanh lý hợp đồng.
> - **Không có màn quản lý mẫu** (HuyLD chốt lại): dev thêm mẫu dần bằng cấu hình trong repo. Mỗi ô của mẫu vẫn lấy từ một trong bốn nguồn: hồ sơ, điền lúc xuất, điền tay khi in, ký online.
> - **Một thuyền viên xuất nhiều lần, mỗi lần một bộ khác nhau.** Giai đoạn chỉ là nhóm và nút chọn nhanh; người dùng tick giấy tự do. Màn tạo bộ và Hồ sơ (tab "Đã xuất") liệt kê các bộ đã xuất, có "Dùng lại".
> - **Ký online:** người trong agency ký trong app; thuyền viên ký qua link SMS trên điện thoại. Ô ngày tháng, điểm giám khảo vẫn để trống cho điền tay.
> - Bộ giấy làm cho một người hoặc cả đợt; HuyLD chưa rõ nên thiết kế hỗ trợ cả hai.
> - Hồ sơ cần thêm trường mà mẫu dùng: chiều cao, cân nặng, cỡ giày, cỡ đồng phục, nhóm máu, hôn nhân, người thân liên hệ, trường tốt nghiệp. Đi tàu cần thêm DWT, năm đóng, vùng hoạt động. Giấy tờ cần danh mục khoảng 25 loại chứng chỉ.
> - Ký online là việc backend mới, chưa có trong ước lượng ở tài liệu gốc mục 7, cần ước lượng lại.
> - Wireframe: `docs/design/wireframes/nhom-bc.html`. File mẫu thật không đưa vào repo.

| Màn | Đến để làm gì | So sánh bằng gì | Hành động cuối | Trạng thái phải vẽ |
| --- | --- | --- | --- | --- |
| **C1. Tạo bản xuất** (form nhiều bước, từ B2) | Chọn mẫu + chính sách liên lạc, xem trước file | Mẫu CV và mẫu sea service matrix; hiện / ẩn / thay SĐT | Gửi duyệt | `TEMPLATE_CAPACITY_EXCEEDED` (báo, không cắt). Hồ sơ BLOCKED không cho xuất, có giải thích. **Mẫu thứ hai là một card bỏ được** (cắt thứ ba của 7.3) |
| **C2. Duyệt phát hành** (`/exports/:id`) | Người duyệt (khác người tạo) kiểm file trước khi phát hành | Bản xem trước chính là file sẽ phát hành; revision hồ sơ; version mẫu; hash | Phát hành / Trả lại | Người tạo = người duyệt thì khoá nút, kèm câu giải thích. Đã phát hành (link tải ngắn hạn). STALE. **Bước duyệt tách được** (cắt thứ hai của 7.3: còn "Phát hành" thẳng, vẫn giữ STALE) |
| **C3. Bản xuất** (`/exports`) | Tìm bản chờ duyệt và bản STALE cần làm lại | Trạng thái, hồ sơ, mẫu, ngày | Mở C2, tải file | Rỗng, nhiều dòng STALE |

### Nhóm D: Danh mục và quản trị (không vẽ wireframe)

| Màn | Lối skill | Ghi chú |
| --- | --- | --- |
| **D3. Tàu, Chủ tàu** (tab mới trong Danh mục) | **Dựng luôn**, khuôn CRUD `D3` | Mới hoàn toàn: hiện chỉ có bảng và API đọc. Tạo và sửa dùng **cùng một form** trong panel trượt. **Xoá mềm** (`deleted_at`) thì xoá ngay + toast "Hoàn tác" (`D3`). Cần API khôi phục. Chưa có API thì skill hỏi một dòng lúc giao, khi đó dùng hộp xác nhận |
| **D4. Loại tàu, Quốc gia, Cảng biển, Quản lý user** | **Dựng lại theo gu skill** | Quản lý user thêm vai trò Reviewer. `operator` hiển thị là Crewing Officer, `admin` là Quản trị. **Chức danh chưa có màn**, MVP dùng seed. Cần màn đó thì dựng luôn như D3 |
| D1, D2, D5 | Đi cùng nhóm A | Xem nhóm A |

---

## 6. Bảng ánh xạ trạng thái duy nhất (`D2`)

Dán nguyên bảng này vào đề `D9` và mọi đề wireframe. Tông màu theo nghĩa (`M7`), không theo sở thích. Tên giá trị của bản xuất là tên tạm, chốt theo schema `export_artifact` ở Sprint 4.

| Bộ | Giá trị → nhãn hiển thị → tông |
| --- | --- |
| Tài liệu | `RECEIVED` → Đã nhận → xám · `PROCESSING` → Đang trích xuất → xám (quá 5 phút: hổ phách "Chậm") · `REVIEW_REQUIRED` → Chờ duyệt → hổ phách · `COMPLETED` → Đã xong → xanh lá · `FAILED` → Lỗi trích xuất → đỏ |
| Trường dữ liệu | Đề xuất AI → xám · Đã chấp nhận → xanh lá · Đã sửa → xanh lá + icon bút (lý do ở tooltip) · `UNKNOWN` → Không đọc được → hổ phách · UNKNOWN đã xác nhận → Giữ UNKNOWN → xám + icon khoá · Ngày mơ hồ → hổ phách · Từ chối → đỏ |
| Xác minh tàu | `NOT_CHECKED` → Chưa đối chiếu → xám · `VERIFIED` → Đã đối chiếu → xanh lá · `CONFLICT` → Không khớp → đỏ · `NOT_FOUND` → Không tìm thấy → hổ phách · `UNAVAILABLE` → Không kiểm được → xám |
| Kết quả rule | `PASS` → Đạt → xanh lá · `FAIL` → Không đạt → đỏ · `UNKNOWN` → Chưa đủ dữ liệu → hổ phách · `NOT_APPLICABLE` → Không áp dụng → xám |
| Readiness | `READY_IN_SCOPE` → Sẵn sàng (phạm vi MVP) → xanh lá · `NEEDS_REVIEW` → Cần xem lại → hổ phách · `BLOCKED` → Bị chặn → đỏ. Tiêu đề panel ghi đủ câu "Sẵn sàng hồ sơ trong phạm vi MVP" kèm "Chưa đánh giá: chứng chỉ, visa" |
| Sea service | `ONGOING` → Đang trên tàu → xanh lá · Overlap → Trùng thời gian → hổ phách |
| Bản xuất | `DRAFT` → Nháp → xám · `PENDING_APPROVAL` → Chờ duyệt → hổ phách · `PUBLISHED` → Đã phát hành → xanh lá · `STALE` → Cần làm lại → hổ phách · `REJECTED` → Bị trả lại → đỏ |

Tông hổ phách có nhiều trạng thái. Chữ trên badge phân biệt chúng, màu không cần phân biệt (`M6`). Hai trạng thái cùng tông mà cần tách bằng hình thì dùng icon theo bảng icon của `M7`.

---

## 7. Quy trình, từng giai đoạn kèm đề dùng thẳng

Tên lệnh tuỳ cách cài: cài plugin Claude Code thì gọi `/evon:ui-ux`. Trong phiên Claude Code cloud có sẵn skill thì gọi `/ui-ux`. Đề dưới viết `/evon:ui-ux`.

### Giai đoạn 0: chuẩn bị (0,5 ngày)

1. **Cài skill vào máy làm việc.** Chọn một trong hai:
   - Bản gốc: `/plugin marketplace add evondev/evondevKit` rồi `/plugin install evon@evondevkit`.
   - Bản fork: `/plugin marketplace add huyld-axl/evondevKit`.

   Lấy bản mới trước khi bắt đầu: `/plugin marketplace update evondevkit`. Dùng Cursor, Codex thì chạy `npx skills add evondev/evondevKit` (README).
2. **Chạy app local theo Phụ lục A của tài liệu gốc:** MariaDB 10.11, seed admin. Skill cần **link localhost đang chạy** để probe (Mẹo trong README).
3. **Gỡ hai chặn của mục 1.4:**
   - Thêm module `devToken` chỉ chạy ở dev (nếu HuyLD đồng ý ở câu hỏi 6).
   - Chạy thử một vòng đọc → sửa → chụp bằng `use_figma` trên file nháp, xác nhận không bị đếm lượt (câu hỏi 5).
4. **Seed dữ liệu synthetic** cho wireframe và ảnh (`S6`, `S8`, `S16`). **Xoá hoặc thay dữ liệu seed `011`** trước khi chụp ảnh "trước". Bộ tối thiểu:

   | Mẫu | Nội dung | Ca biên phủ |
   | --- | --- | --- |
   | Sổ A (rõ nét) | "Trần Minh Khôi", Chief Officer, 4 dòng sea service, IMO hợp lệ `9524451`, `9297723`, `9617507` | Ca đẹp, đi thẳng tới READY_IN_SCOPE |
   | Sổ B (có vấn đề) | "Nguyễn Thị Hồng Nhung Phương Anh" (tên dài 2 dòng), Able Seaman. Một Sign off mờ → UNKNOWN. Hai hợp đồng overlap 6 ngày. IMO `9524454` **sai checksum** | BLOCKED với 3 lý do |
   | Sổ C | 1 trang, chỉ có trang thông tin cá nhân, 0 sea service | Rỗng trong bảng sea service |
   | Tàu giả | "MV Lotus Pearl" `9163283`, "MV Halong Spirit" `9194945` + 2 tàu trùng tên khác IMO | Nhiều ứng viên khi đối chiếu bằng tên |
   | Chủ tàu giả | "Chủ tàu Demo A" (ẩn SĐT thuyền viên, thay bằng SĐT agency), "Chủ tàu Demo B" (hiện đủ) | Hai chính sách liên lạc |
   | Tài liệu | 1 FAILED, 1 PROCESSING đã 12 phút, 1 trùng hash | Trạng thái suy từ giờ |

   - **IMO:** các số trên đã kiểm checksum (5 số hợp lệ, `9524454` sai đúng như ý). Số 7 chữ số đầu 9 hợp lệ có thể trùng tàu thật. **Tra registry công khai trước khi dùng**, trùng thì đổi số khác.
   - **Tên chủ tàu:** dùng tên chung "Chủ tàu Demo A/B" để chắc chắn không trùng công ty thật (7.4).
   - **Avatar:** lấy từ randomuser, khớp giới của tên giả. Chừa ít nhất 1 người không có avatar.
5. **Playwright cho probe:** `npm i --prefix "$TMPDIR/evon-probe" playwright` (mục 2.3).

### Giai đoạn 1: soi hiện trạng, lối `V` (0,5 ngày)

Mỗi route một lượt (README: "Mỗi lượt một trang"). Không liệt kê lỗi trong đề, để skill tự tìm:

```
/evon:ui-ux Xem giúp màn này chỗ nào chưa ổn: http://localhost:5173/seafarers?devToken=<token>
/evon:ui-ux Xem giúp màn này chỗ nào chưa ổn: http://localhost:5173/seafarers/1?devToken=<token>
/evon:ui-ux Xem giúp màn này chỗ nào chưa ổn: http://localhost:5173/login
```

- **Chỉ lấy bảng và ảnh, không trả lời `sửa …`.** Các màn này thiết kế lại theo nhánh `U`. Vá theo `V` là phí công (`U5`).
- Kiểm bảng có dòng **"Đối chiếu probe"**. Không có nghĩa là skill chưa đo.
- Lưu ảnh 1280 và 375 vào `docs/design/before/`. Các ảnh này lên trang Figma "03 · Demo & Flow" làm cặp trước/sau.

### Giai đoạn 2: logo (0,5 ngày)

```
/evon:ui-ux Làm logo cho MCAH (Maritime Crewing Agency Harness): nền tảng biến sổ thuyền viên
và tài liệu rời rạc thành hồ sơ chuẩn có bằng chứng cho crewing agency. Màu nhấn navy #003366.
Không dùng mỏ neo hay bánh lái kiểu clip-art.
```

- Skill coi chữ "MarinePort" và favicon của Vite là **chưa có logo** (`logo.md`).
- **Cổng:** chọn 1 trong 3 hướng:
  - 1: chữ đầu dựng bằng khối;
  - 2: ẩn dụ việc chính;
  - 3: hai hình ghép.

  Trang chọn đặt logo trong sidebar (mở và thu gọn), màn đăng nhập, tab trình duyệt, cỡ 16/32/64px.
- Đầu ra: `ProductBrand` + favicon.
- Sau cổng, làm luôn việc nhỏ hơn một màn (lối 7): `<title>` "MCAH", `lang="vi"`, thay favicon.
- Dấu SVG đưa sang Figma ở giai đoạn 5.

### Giai đoạn 3: design system, lối `D9` (1 ngày)

```
/evon:ui-ux Dựng design system cho MCAH trước, chưa dựng màn nào.
Dự án dùng Ant Design 6: chỉnh theme của AntD (ConfigProvider, token), không thêm UI kit khác;
một file token dùng chung cho ConfigProvider và index.css.
Bỏ style cũ của Marineport (sidebar tối, màu trạng thái chói, bo 2px, Roboto), chỉ giữ màu nhấn #003366
và logo vừa chọn. Chỉ light mode. Copy tiếng Việt, thuật ngữ ngành (IMO, Sign on, Sign off, Rank) giữ tiếng Anh.
Ngoài bảy nguyên tố, cần thêm: badge trạng thái theo bảng dưới; ô trường dữ liệu có trạng thái
(Đề xuất AI / Đã chấp nhận / Đã sửa có lý do / UNKNOWN / Giữ UNKNOWN / Ngày mơ hồ / Từ chối, cờ IMO chưa
đối chiếu) kèm chip số trang bằng chứng; khung xem trang tài liệu (phóng to, lật trang); khung kéo thả tệp;
dòng thời gian audit; banner (STALE, xung đột 409, BLOCKED); lựa chọn dạng card; danh sách mô tả; tab;
phân trang; chip lọc; thanh tiến độ; mục sidebar.
<dán bảng mục 6>
```

- **Skill sẽ:**
  - Giữ tên token của AntD, trỏ giá trị về token của skill.
  - Bo góc theo `F1`. Font Inter.
  - Ô nhập nền trắng. Card và header không bóng (`M15`).
  - Trang `/design-system` có bảng màu kèm tỉ lệ tương phản (chỉ cặp trượt mới có nhãn), thang chữ, khoảng cách, bo góc, viền, bóng lớp nổi.
  - Từng component ở mọi trạng thái (thường, rê, focus, khoá, đang tải, lỗi). Ví dụ ép trạng thái bọc `inert`.
- Skill probe trang này bằng `--sweep` tới khi danh sách `P` trống.
- **Cổng:** HuyLD duyệt `/design-system`. Muốn đổi màu nhấn, font, bo góc thì đổi ở token, mọi component đổi theo.
- **Kết quả phụ:**
  - Bảng `D1` coi như đã chốt.
  - Vai màu mới (sidebar sáng, mục chọn nền xám, trạng thái 4 tông) là vai màu mà `U4` giữ.
  - Mọi wireframe sau dán file token của dự án, không dán `tokens.css` của skill.

**Kết quả (HuyLD duyệt ngày 2026-10-06):**
- **Token:** `frontend/src/theme/tokens.js` là nguồn duy nhất cho theme Ant Design và biến CSS.
- **Component riêng của MCAH:** `frontend/src/components/ds/`. Bảng ánh xạ trạng thái nằm ở `statusMap.js`.
- **Trang xem:** route `/design-system`, bản chia sẻ ở https://claude.ai/artifact/QfQ3kwDrMyLxW85R1Ln3k6.
- **Phần còn thiếu cho MVP**, bổ sung ở giai đoạn 4 khi chốt wireframe của màn cần nó, không dựng trước:
  - panel trượt;
  - form nhiều bước có thanh các bước;
  - toast;
  - breadcrumb;
  - bảng dữ liệu có tiêu đề cột sắp xếp;
  - menu thao tác dạng dropdown;
  - công tắc.

**Mở rộng design system về sau** (Phase 3–5, màn mới, người mới vào dự án):

1. **Tìm trước, dựng sau.** Màn mới cần thứ gì thì tìm trong `components/ds/`, theme Ant Design và trang `/design-system`. Đã có thì dùng, chỉ đổi qua prop. Không dựng bản thứ hai cho cùng một việc (`S9`, `D1`).
2. **Chưa có thì dựng theo file mẫu của skill** (`references/components/*.md`, `layouts/*.md`). Tô bằng token, không mã màu viết cứng. Thứ chưa có mẫu thì đi luồng "Dựng một thứ chưa có mẫu" ở `principles.md`.
3. **Dựng xong thì đưa vào cả ba chỗ:**
   - trang `/design-system`, đủ các trạng thái;
   - trang "01 · Foundations & Components" của file Figma;
   - chạy probe `--sweep` trang đó tới khi danh sách `P` trống.
4. **Trạng thái mới chỉ thêm vào `statusMap.js`**, vẫn trong bốn tông của `M7`. Ví dụ Phase 3 thêm nhóm "Chứng chỉ": Còn hạn, Sắp hết hạn, Hết hạn. Không đặt màu trạng thái riêng trong từng màn.
5. **Đổi token** (màu nhấn, font, bo góc) **chỉ sửa trong `tokens.js`**. Sau đó chụp lại `/design-system` và cập nhật variables trong Figma. Không đè token trong từng màn.

### Giai đoạn 4: wireframe nhóm A, B, C (nhánh `U`), D3 dựng luôn, D4 dựng lại (2 ngày)

Mỗi nhóm một lượt. Đề viết rõ **dữ liệu thật** (README: "Dựng mới thì nói dữ liệu thật") và **không liệt kê lỗi**. Đề không chứa các cụm đổi lối (mục 2.1).

**Nhóm A (ví dụ đầy đủ):**

```
/evon:ui-ux Thiết kế nhóm màn tiếp nhận và duyệt tài liệu cho MCAH, kèm khung app mới, màn đăng nhập
và trang lỗi 403/404/500. Vai màu theo trang /design-system đã duyệt.
1) /documents: danh sách sổ thuyền viên đã tải lên (PDF/JPG/PNG ≤ 25 MB, ≤ 50 trang), trạng thái
   RECEIVED → PROCESSING → REVIEW_REQUIRED → COMPLETED / FAILED, số trường UNKNOWN, thời gian chờ; chip lọc
   theo trạng thái (thay cho dashboard, không có màn hàng đợi riêng); báo trùng hash; FAILED cho nhập tay.
2) /documents/:id/review: duyệt cạnh bằng chứng. Trái là ảnh trang tài liệu gốc (phóng to, lật trang),
   phải là các trường AI đề xuất: họ tên, ngày sinh, chức danh, và các dòng sea service (tên tàu theo tài
   liệu, IMO, Rank raw, Sign on, Sign off). Bấm trường thì trái nhảy tới trang bằng chứng. Thao tác mỗi
   trường: chấp nhận, sửa (bắt buộc ghi lý do), từ chối, đánh dấu ONGOING; giữ UNKNOWN. Lưu nháp, công
   bố hồ sơ (chặn khi chưa duyệt đủ 6 trường trọng yếu). Không có chấp nhận hàng loạt.
3) Đăng nhập: chỉ ô email, ô mật khẩu, nút Đăng nhập, logo MCAH.
Sidebar 4 mục: Thuyền viên, Bản xuất, Danh mục, Quản trị (mục Tài liệu bỏ ở cổng 2). Header không có chuông thông báo.
Dữ liệu mẫu: sổ A rõ nét; sổ B có Sign off mờ (UNKNOWN), hai hợp đồng overlap 6 ngày, IMO 9524454 sai
checksum; một tài liệu PROCESSING đã 12 phút; một FAILED.
<dán bảng mục 6>
```

Ở mỗi nhóm:

1. **Cổng 1:** skill gửi `Audit:` + brief `U1` + bảng `U2`. HuyLD đối chiếu với bảng ở mục 5, rồi trả lời `ok` hoặc sửa dòng sai.
2. **Cổng 2:** skill gửi link từng phương án (`?man=…&v=a|b|c|d|e`). Trên thanh công cụ:
   - Bật **Màu**.
   - Xem **Mobile**, bấm thử ☰, xem nhóm Nav.
   - Chuyển **Trạng thái** Rỗng / Đang tải / Lỗi.
   - Mở **Ưu, nhược**.

   Góp ý theo **số khối** ("bỏ khối 3", "đưa khối 2 lên đầu"). Trả lời dạng `B + D`.
3. Kiểm dòng *"Probe wireframe: A sạch, B sạch, C sạch"* có trong tin skill gửi.
4. **Lưu file wireframe đã chọn** (`$TMPDIR/evon-design/*.html`) vào `docs/design/wireframes/` của repo này. File này là đặc tả cho `U4` và là nguồn cho giai đoạn 5.

Nhóm B và C dùng cùng mẫu đề. Nhóm B ghi rõ: tab Lịch sử là dòng thời gian audit, không so sánh revision; B3 có khối bằng chứng thủ công tách được. Nhóm C ghi rõ: người duyệt khác người tạo; STALE khi hồ sơ đổi; mẫu thứ hai và bước duyệt tách được.

**D3** đi lối dựng luôn:

```
/evon:ui-ux Dựng luôn tab danh mục Tàu trong /master-data: tên tàu, IMO (kiểm checksum), loại tàu, cờ,
chủ tàu; thêm và sửa chung một form trong panel trượt; xoá mềm (khôi phục được). Rồi tab Chủ tàu: tên,
quốc gia, thông tin liên lạc agency, chính sách liên lạc mặc định.
```

**D4** đi lối dựng lại theo gu skill, mỗi route một lượt:

```
/evon:ui-ux Dựng lại hoàn toàn theo gu skill, bỏ style cũ: http://localhost:5173/master-data/vessel?devToken=<token>
/evon:ui-ux Dựng lại hoàn toàn theo gu skill, bỏ style cũ: http://localhost:5173/admin/users?devToken=<token>
```

Màn Quốc gia và Cảng biển dùng chung `MasterSubPage`, nên đổi theo Loại tàu. Vai trò mới trên `RoleBadge` là việc nhỏ hơn một màn (lối 7), làm cùng lượt.

### Giai đoạn 5: chuyển sang Figma (1,5 ngày)

Nguyên tắc: **Figma chép wireframe nấc Màu (và bản dựng nếu đã có), không thiết kế lại.** Chép tới từng px, như `U4` chép wireframe.

#### Cấu trúc file (3 trang, vừa giới hạn Starter)

| Trang | Nội dung |
| --- | --- |
| **01 · Foundations & Components** | Xem chi tiết ngay dưới bảng |
| **02 · Screens** | Xem chi tiết ngay dưới bảng |
| **03 · Demo & Flow** | Prototype theo kịch bản mục 3.4 (6 bước, nối bằng interaction). Cặp ảnh trước/sau từ giai đoạn 1. Khung "Định hướng" (chỉ khi có yêu cầu, gắn nhãn) |

**Trang 01 · Foundations & Components:**
- **Variables**, collection `Color`, chỉ một mode Light. Lấy đúng tên token của file token dự án sau `D9`, gốc ở `tokens.css`:
  - `primary`, `primary-hover`, `primary-foreground`, `primary-light`
  - `background`, `surface`, `foreground`, `muted`, `border`, `border-strong`
  - `secondary`, `item-hover`, `ring-focus`, `border-focus`
  - `neutral` / `neutral-bg`, `success` / `success-bg`, `warning` / `warning-bg`, `error-strong` / `error-bg`
  - `danger` / `danger-bg`, `error-text`
- Collection `Space`, `Radius` (8, 12), `Size` (chiều cao control).
- **Text styles** theo thang của `budgets.md`.
- **Components có variants:**
  - Button (4 dạng × cỡ × trạng thái), Badge (theo bảng mục 6), Input, Review field (7 trạng thái + cờ IMO).
  - Document viewer, Card, List row, Table row, Modal, Drawer, Toast, Empty state, Banner.
  - Tabs, Pagination, Filter chip, Breadcrumb, File upload, Timeline item, Choice card, Progress bar, Sidebar item, Logo.
- **Mô tả mỗi component ghi đường dẫn file React** (thay Code Connect).

**Trang 02 · Screens:**
- Một Section cho mỗi nhóm A, B, C, D.
- Mỗi màn có frame `Desktop 1440` và `Mobile 375`, cộng frame trạng thái: Rỗng, Đang tải, Lỗi, và các trạng thái riêng của màn (UNKNOWN, BLOCKED, STALE, 409, Chậm…).
- Tên frame dạng `A2 / Duyệt / Desktop / Có dữ liệu`.
- Lớp con đặt tên theo số khối wireframe (`[3] Bảng sea service`), để góp ý bằng cùng một con số.

**Bảng FigJam riêng**, do `generate_diagram` tạo:
- Flowchart luồng 7 bước (mục 1.2 tài liệu gốc).
- `stateDiagram` cho tài liệu, bản xuất và readiness.
- Flowchart kịch bản demo 10 phút.

#### Trình tự gọi công cụ

1. Nạp hướng dẫn Figma:
   - `/figma-use`: bắt buộc trước `use_figma`.
   - `/figma-generate-library`: cho trang 01.
   - `/figma-generate-design`: cho trang 02.
   - `/figma-generate-diagram`: bắt buộc trước `generate_diagram`.

   Không có plugin thì đọc resource `skill://figma/...` tương ứng.
2. Kiểm team đã có thư viện chưa bằng một script chỉ đọc qua `use_figma` (biến, component trong file). Chỉ dùng `search_design_system` (tốn 1 trong 6 lượt đọc) khi team có thư viện đã publish. Có thì dùng, không dựng trùng.
3. `create_new_file` với `planKey: team::1303965334335449875`, tên file "MCAH — MVP Demo UI".
4. **Trang 01:**
   - Đọc file token đã duyệt ở giai đoạn 3, tạo variables bằng `use_figma`, rồi text styles, rồi components.
   - Đối chiếu mỗi component với `/design-system`: cùng trạng thái, cùng cỡ.
   - Dấu logo SVG đưa vào bằng `figma.createNodeFromSvg`.
5. **Trang 02**, với từng phương án đã chọn:
   - Lấy ảnh tham chiếu bằng probe (`--widths 1440,375 --dpr 2`, mục 2.3).
   - Dựng frame bằng auto-layout và **instance của component trang 01**, không vẽ hình rời. Màu và khoảng cách gắn variable, không gõ mã.
   - Tạo đủ mọi trạng thái theo nút Trạng thái của wireframe.
   - `upload_assets` ảnh probe làm lớp tham chiếu ẩn để soi lệch, xong thì xoá.
   - Mỗi lần gọi `use_figma` chỉ dựng một màn, để lỗi khoanh được và không vượt giới hạn ký tự mỗi lần gọi.
6. **Kiểm từng màn:**
   - Chụp frame bằng `await frame.screenshot()` ngay trong lần `use_figma` vừa dựng, đặt cạnh ảnh probe cùng khổ.
   - Đi từng khối (số mục, thứ tự, chữ, nút đặc hay viền), giống bảng "Đối chiếu wireframe" của `U4`.
   - Lệch thì sửa Figma, không sửa wireframe.
   - Không dùng `get_screenshot`, `get_metadata` (lượt đọc có giới hạn). Cấu trúc frame (tên lớp, số mục, biến đã gắn) đọc bằng script chỉ đọc trong `use_figma`.
   - HuyLD muốn sửa thì nhắn Claude: Claude sửa wireframe hoặc code trước, rồi đồng bộ frame. HuyLD sửa tay trong Figma thì Claude đọc lại bằng `use_figma` và chép ngược về HTML, code.
7. **Trang 03:** nối prototype 6 bước, đặt cặp ảnh trước/sau. Rồi `generate_diagram` cho FigJam.
8. Gửi link file Figma cho **cổng 5**.

#### Dự phòng nếu công cụ chạm giới hạn

| Tình huống | Cách xử lý |
| --- | --- |
| Gói Starter chặn số trang hoặc số file | Gộp trang 03 vào trang 02 dưới dạng Section. FigJam để ở file riêng |
| Figma bắt đầu đếm hay tính phí lệnh ghi | Nâng Professional 1 tháng (câu hỏi 5). Tạm thời gom nhiều màn đã ổn định vào một lần `use_figma` |
| Cần ảnh chụp y hệt trang web | Không có `generate_figma_design` trong phiên này. Dùng plugin html.to.design trong Figma, nhập URL wireframe. Kết quả chỉ làm lớp tham chiếu, frame chính vẫn dựng bằng component |

### Giai đoạn 6: dựng thật và giữ đồng bộ (theo sprint, ngoài 6 ngày)

- **`U4` theo từng sprint.** Màn nào có backend thì dựng màn đó:

  | Thời điểm | Màn |
  | --- | --- |
  | Tuần 1 | D1, D2, D3, A1 |
  | Tuần 2 (trước M1) | A2 |
  | Tuần 3 | B1, B2, B3 |
  | Tuần 4 | C1, C2, C3 |

  Chạy `probe.mjs --sweep --wireframe "<link phương án>&mau=mau"` (mục 2.3), sửa tới khi danh sách `P` trống. Tin giao phải có:
  - Dòng `Dáng:`.
  - Bảng "Đối chiếu wireframe".
  - 5 dòng tự soi.
  - Mục "Còn thấy".
- **Hợp đồng `D1`** đã chốt ở giai đoạn 3, không khai lại.
- **Lối `L` sau khi xong các màn:**

  ```
  /evon:ui-ux Refactor CSS: dọn App.css, AdminLayout.css, index.css và màu viết cứng trong các trang MCAH,
  bỏ CSS không còn dùng, giữ nguyên giao diện.
  ```

  Skill đo trước (`L1`), giữ pixel, đưa danh sách "đề xuất sửa" chứ không tự sửa.
- **Đồng bộ Figma:** màn nào đổi khi dựng thật (vì dữ liệu thật khác wireframe) thì sửa frame tương ứng bằng `use_figma`. Không chụp lại cả file.

### Giai đoạn 7: tài liệu Sales trên Canva (0,5 ngày, sau cổng 5)

- **Đầu ra:**
  - Một one-pager MCAH.
  - Vài trang slide theo 6 bước của kịch bản 3.4.
  - Thứ tự đúng mục 10 của tài liệu Sales: upload → trường cạnh bằng chứng → sửa → kết quả kiểm tra → xuất 2 mẫu.
- **Nguồn ảnh:** xuất PNG các frame Desktop từ trang 02 và 03 của Figma, đưa vào Canva. Canva chỉ chứa ảnh, không dựng lại giao diện trong Canva, thiết kế gốc vẫn ở Figma.
- **Luật nội dung** (mục 1.4 và R2 tài liệu gốc):
  - Chỉ có tính năng đã chạy thật. Phần chưa có gắn nhãn "Định hướng".
  - Không có "Đủ điều kiện lên tàu", "Verified crew", "verified by IMO", "tiết kiệm 50%". 50% là mục tiêu nội bộ, không phải claim.
  - Dữ liệu synthetic, không tên chủ tàu thật, không giá.
- Canva chưa nối trong phiên này, nên làm tay hoặc nối connector Canva sau.

---

## 8. Lịch (1 người + Claude Code, song song tuần 1–2 của lịch 4 tuần)

| Ngày | Việc | Cổng | Đầu ra |
| --- | --- | --- | --- |
| 1 | Giai đoạn 0 + 1 + 2 (gỡ chặn probe và Figma, seed synthetic, soi 3 route, logo) | Chọn logo | Ảnh "trước", logo, title/favicon |
| 2 | Giai đoạn 3: design system | Duyệt `/design-system` | Theme AntD + component MCAH |
| 3 | Giai đoạn 4: nhóm A (khung app, đăng nhập, trang lỗi) | Cổng 1, cổng 2 | Wireframe A đã chọn |
| 4 | Giai đoạn 4: nhóm B + C. D3 dựng luôn, D4 dựng lại | Cổng 1, cổng 2 ×2; bảng D4 | Wireframe B, C đã chọn; D3, D4 đã dựng |
| 5 | Giai đoạn 5: trang 01 + nhóm A, B lên trang 02 | | File Figma (một phần) |
| 6 | Giai đoạn 5: nhóm C, D + trang 03 + FigJam, kiểm từng màn | Duyệt file Figma | **File Figma hoàn chỉnh** |
| sau 6 | Giai đoạn 7 (Canva), giai đoạn 6 theo sprint | | Tài liệu Sales; màn dựng thật |

Nếu trễ, cắt theo thứ tự:

1. Bỏ khung "Định hướng" và giai đoạn 7 (Sales dùng PNG xuất thẳng từ Figma).
2. Mobile 375 trên Figma chỉ làm cho A2, B2, C1. Wireframe vẫn có mobile cho mọi màn, vì nút Khổ vẽ sẵn.
3. FigJam chỉ còn luồng 7 bước.

---

## 9. Tiêu chí nghiệm thu bản thiết kế

- [ ] Mọi màn ở mục 5 có trên Figma ở 1440. Màn cần mobile có thêm 375. Mỗi màn đủ **Có dữ liệu / Đang tải / Rỗng / Lỗi** (`I19`) cùng các trạng thái riêng của màn.
- [ ] Mọi màu, khoảng cách, bo góc trên trang 02 gắn variable của trang 01. Không có mã màu gõ tay.
- [ ] Mọi badge dùng đúng bảng mục 6. Không trạng thái nào có hai hình hay hai màu (`D2`).
- [ ] Màu nhấn chỉ ở nút chính, link và control đang chọn (`M4`, `D5`). **Mục sidebar đang chọn nền xám, chữ đậm, không màu nhấn** (luật chốt #8). Không trạng thái nào tô màu nhấn.
- [ ] Không có chữ "Đủ điều kiện lên tàu" hay "Verified crew". Readiness ghi "Sẵn sàng (phạm vi MVP)" trên badge, "Sẵn sàng hồ sơ trong phạm vi MVP" ở panel, kèm dòng "Chưa đánh giá: chứng chỉ, visa".
- [ ] Không có tên chủ tàu thật, hồ sơ thật (kể cả seed `011`), logo thương hiệu thật.
- [ ] Không có màn hay khối mà mục 7.2 đã cắt: dashboard, hàng đợi duyệt riêng, bulk accept, so sánh revision, gợi ý trùng người, assignment draft, onboarding template.
- [ ] Ba khối cắt-khi-trễ (bằng chứng thủ công, bước duyệt, mẫu thứ hai) bỏ đi được mà không vẽ lại khung.
- [ ] Prototype trang 03 đi trọn 6 bước của kịch bản 3.4, không cụt.
- [ ] Mỗi màn có bản wireframe HTML đã probe sạch, lưu trong `docs/design/wireframes/`, và frame Figma khớp nó.
- [ ] Mỗi màn đã qua 5 câu tự soi của `U4`:
  - Card cao thấp khác nhau không?
  - Link trông như chữ thường không?
  - Có bao nhiêu khung viền?
  - Ở 1920 có chỗ trống vô lý không?
  - Thứ nặng nhất có đúng là việc chính không?

---

## 10. Rủi ro

| # | Rủi ro | Giảm thiểu |
| --- | --- | --- |
| R1 | Figma lệch dần khỏi code (hai nguồn sự thật) | HTML và code là nguồn. Figma chỉ sửa theo code, không ngược lại. Ghi điều này lên trang 01 |
| R2 | Figma đổi chính sách lượt gọi MCP, hoặc gói Starter chặn số trang, số file | Mọi thao tác qua `use_figma`, không dùng lệnh đọc riêng. Thử ở ngày 1. Nâng Professional khi cần (câu hỏi 5). Có bảng dự phòng |
| R3 | A2 (duyệt cạnh bằng chứng) chưa có mẫu đã duyệt trong skill, dễ ra bố cục yếu | 3 phương án khác chiến lược duyệt + D/E. Mười hai phép thử `principles.md`. Diễn tập bằng dữ liệu sổ B trước khi chọn |
| R4 | AntD 6 có mặc định trái gu skill (bóng, ô nhập, nhiều variant nút, menu tối) | `D9` chỉnh token, một file token chung. Tự giới hạn 4 dạng nút. Probe bắt lệch dáng |
| R5 | Đổi Roboto sang Inter, radius 2 sang 8/12 làm các màn Marineport còn lại trông khác | Các màn đó ẩn theo Q3. Màn còn dùng thì đi lối dựng lại theo gu (D4) |
| R6 | Wireframe tốn nhiều token | Chỉ nhóm A, B, C vẽ wireframe. Nhóm D đi dựng luôn hoặc dựng lại |
| R7 | Probe không đăng nhập được, nên đo nhầm màn đăng nhập | Module `devToken` chỉ chạy ở dev (câu hỏi 6). Kiểm ảnh probe đầu tiên có đúng route không |
| R8 | Câu chữ trong đề làm skill rẽ nhầm lối (ví dụ đề `U` có "bỏ style cũ") | Dùng đúng đề mẫu ở mục 7. Kiểm dòng đầu tin trả lời của skill (`Audit:`, tên lối) |
| R9 | Thời gian thiết kế lấn lịch dev 4 tuần | Claude Code chạy thiết kế. HuyLD chỉ ngồi ở cổng. Cắt theo thứ tự mục 8 |

---

## 11. Cần HuyLD chốt trước ngày 1 (đã có câu trả lời đoán sẵn, đồng ý thì trả lời `ok`)

1. **Màu nhấn:** giữ navy `#003366`? *(Đoán: giữ.)*
2. **Font:** chuyển Roboto sang Inter? Nạp bằng `@fontsource/inter` (gói mới, đúng khuyến nghị skill) hay tạm từ Google Fonts như Roboto đang làm? *(Đoán: chuyển sang Inter, cài `@fontsource/inter`.)*
3. **Ngôn ngữ giao diện demo:** tiếng Việt, thuật ngữ ngành tiếng Anh? Hay cần cả bản tiếng Anh cho agency nước ngoài? *(Đoán: tiếng Việt. Bản tiếng Anh làm sau.)*
4. **Mobile:** cần 375 cho mọi màn, hay chỉ A2, B2, C1? *(Đoán: mọi màn có wireframe, vì nút Khổ của skill vẽ sẵn. Figma chỉ chuyển A2, B2, C1 nếu thiếu giờ.)*
5. **Gói Figma:** giữ Starter, mọi thao tác qua `use_figma`; chỉ nâng Professional nếu Figma bắt đầu đếm hay tính phí lệnh ghi? *(Đoán: đồng ý.)*
6. **Đăng nhập cho probe:** cho thêm module `devToken` chỉ chạy ở dev (mục 1.4)? *(Đoán: cho. Không cho thì probe chỉ đo được `/login` và wireframe.)*

---

## Phụ lục A: chỗ đã sửa so với bản nháp (commit `09a5544`)

| Bản nháp | Bản này | Lý do |
| --- | --- | --- |
| Dòng "Nguồn" trỏ tài liệu gốc ở repo `seasmart` từ bên ngoài, skill "trong repo này" | Tài liệu gốc nằm ngay trong repo này. Skill nằm ở repo `huyld-axl/evondevKit` | File chuyển về repo `seasmart` |
| Câu hỏi 5: nơi lưu kế hoạch | Bỏ. Thêm câu 5 (gói Figma) và câu 6 (đăng nhập cho probe) | File đã nằm đúng chỗ. Hai chặn mới tìm thấy khi rà lại |
| Có màn A3 "Hàng đợi duyệt" và mục sidebar "Duyệt" (6 mục) | Hàng đợi là chip lọc trong A1. Sidebar 5 mục, nên có nhóm Nav ở mobile | Mục 7.2 cắt dashboard: dùng danh sách có lọc theo trạng thái |
| B2 có "tab Revision" | Chỉ số revision ở đầu trang + tab Lịch sử (audit) | Mục 7.2 cắt so sánh revision bằng UI |
| Màn duyệt có phương án "bằng chứng mở trong panel trượt" | Ba phương án đều hai cột trái tài liệu, phải form; khác nhau ở chiến lược duyệt | Mục 3.2.3 đã chốt bố cục trái/phải (`S4`, `S13`) |
| Vai trò "Officer, Reviewer, Approver" | Thêm `reviewer`; `operator` hiển thị Crewing Officer; `admin` là Quản trị | Mục 4 Sprint 2 của tài liệu gốc chỉ thêm `reviewer` |
| D4 gồm "danh mục chức danh"; đề mẫu dựng lại trên `/master-data/cert` | D4 là Loại tàu, Quốc gia, Cảng biển, Quản lý user; đề mẫu trên `/master-data/vessel` | Không có tab Chức danh (`TAB_MAP`). Chứng chỉ là Phase 3 |
| D3 "xoá có xác nhận" | Xoá mềm: xoá ngay + toast "Hoàn tác" (`D3`). Không có API khôi phục thì dùng hộp xác nhận | DB dùng `deleted_at`. Luật `D3` của skill |
| Route mới `/crew`, `/catalog/*` | Giữ `/seafarers`, `/master-data/:tab` | Đổi route là logic, không cần cho demo |
| D2 "bỏ nút Google nếu backend không có" | Đề liệt kê rõ: email, mật khẩu, nút. Không có quên mật khẩu, không Google | Backend không có hai thứ đó. Bộ mặc định của `form.md` sẽ tự thêm nếu đề không liệt kê |
| D1 có chuông thông báo | Ẩn chuông | Thông báo thuộc nhóm "không liên quan MCAH" (mục 2.3) |
| Audit thiếu nhiều chi tiết | Thêm: menu tối `#001529`, Drawer có ✕, header có bóng, `App.css` còn CSS mẫu của Vite, favicon Vite, `<title>` "frontend", `lang="en"`, không trang 404 | Đối chiếu lại `package.json`, `App.jsx`, `AdminLayout.jsx`, `index.css` |
| "Màu nhấn ở nút chính, mục đang chọn, link" | Mục sidebar đang chọn nền xám, không màu nhấn | Luật chốt #8 của `locked-rules.md` |
| Variables Figma: `success`, `warning`, `error`, `rose`… | Tên đúng theo `tokens.css`: `neutral`, `error-strong`, `danger`, `ring-focus`, `border-focus`… | Tên trong bản nháp không có trong `tokens.css` |
| Dự phòng dùng `generate_figma_design` "nếu có" | Không có trong phiên này. Dùng plugin html.to.design làm lớp tham chiếu | Đã kiểm danh sách tool Figma MCP |
| Không nói gì về đăng nhập khi probe | Thêm module `devToken` chỉ chạy ở dev | `probe.mjs` không có tuỳ chọn đăng nhập. Token nằm ở `localStorage` |
| Chủ tàu giả "Blue Anchor Shipping", "Northwind Maritime" | "Chủ tàu Demo A/B". IMO giả phải tra registry trước khi dùng | Tránh trùng công ty và tàu thật (7.4) |
| Chỉ liệt kê một phần `layouts/`, `components/` | Mục 3 phủ mọi file, kèm lý do không dùng | Yêu cầu tận dụng hết skill |
| Canva chỉ ở bảng dự phòng | Giai đoạn 7 riêng, kèm luật claim của tài liệu Sales | Canva là kênh tài liệu Sales |
| "6 lần gọi/tháng, kế hoạch cần 25–40 lần"; kiểm từng màn bằng `get_screenshot` | Chỉ lệnh đọc riêng bị giới hạn 6 lần/tháng. Đọc, sửa, chụp kiểm đều qua `use_figma` (không bị đếm) | Kiểm lại tài liệu Figma và hướng dẫn `figma-use` sau khi đẩy bản đầu |
