# MCAH — Tổng hợp tình hình, kế hoạch triển khai MVP và blockers

- **Phiên bản:** 2 (2026-10-05). Bản 1 đánh giá nhầm trên code nhánh `master` cũ; bản này đánh giá lại trên nhánh `dev`.
- **Nguồn:**
  - 3 tài liệu MCAH trong repo (Ý tưởng sản phẩm, Nền tảng cho Sales & Marketing, Đặc tả SRS & MVP).
  - Code nhánh `dev` của repo cũ `axlthanhptp/Crew-Manning` (commit `cbdf00e`, 8/7/2026): **đọc code, chưa chạy thử** (phiên làm việc không được phép chạy code từ repo cũ).
  - Kết quả chạy thử nhánh `master` (31/3/2026) trên MariaDB/MySQL, cho các phần không thay đổi.
- **Quyết định đã chốt:** xem mục 6.

---

## 0. Tóm tắt nhanh

1. **Repo `seasmart` đang chứa nhầm bản cũ.** Code hiện tại giống hệt nhánh `master` (31/3). Bản đang chạy trên server dev là nhánh **`dev`** (144 commit, đến 8/7/2026). Cần đồng bộ `dev` vào `seasmart` trước khi làm tiếp (mục 4, tuần 0).
2. **Nhánh `dev` đã có khoảng 40–45% MVP Demo của MCAH:**
   - AI quét **sổ thuyền viên PDF ra lịch sử đi tàu** (tên tàu, loại tàu, cờ, GRT/DWT, chức danh, ngày lên/xuống tàu) theo từng trang, có màn hình xem và sửa kết quả trước khi lưu.
   - AI quét chứng chỉ (Claude Vision) và giấy tờ tùy thân; quét QR CCCD.
   - Lịch sử điều động (`seafarer_deployment`), danh mục tàu theo IMO (`ship_catalog`) và tra cứu tàu qua API ngoài.
   - **Xuất 2 mẫu CV kiểu chủ tàu** (`CV china.xlsx`, `CV eng.xlsx`) kèm service record và chứng chỉ, cùng 12+ biểu mẫu hành chính.
   - Script `deploy.sh` + PM2 cho server dev.
3. **Phần MCAH còn thiếu:** lưu bản gốc tài liệu và bằng chứng theo trang; màn hình duyệt cạnh trang nguồn; bắt buộc duyệt trường trọng yếu; revision và audit hồ sơ; kiểm tra IMO và trạng thái xác minh tàu; tính sea time, overlap, rule và trạng thái sẵn sàng; chính sách ẩn/thay thông tin liên lạc khi xuất; duyệt trước khi phát hành; trạng thái STALE.
4. **Có 3 vấn đề bảo mật cần xử lý ngay trên server dev**, không đợi kế hoạch:
   - `POST /api/v1/migration/run-019` và `/run-020` **không cần đăng nhập** mà vẫn chạy lệnh SQL thay đổi cấu trúc DB (`run-020` là lệnh `DROP TABLE`).
   - Khóa mã hóa `ENC_KEY` của API tra cứu tàu được commit trong `decrypt.js`, mật khẩu DB viết cứng trong `run_migration.js`, `quick_migration.js`.
   - Gọi AI qua `ANTHROPIC_BASE_URL=https://fallback.viber.vn` (file `.env.example`), tức là dữ liệu thuyền viên có thể đang đi qua một máy chủ trung gian của bên thứ ba.
5. **Kế hoạch 1 tháng (1 người + Claude Code) khả thi** nếu xây tiếp trên `dev`: tuần 2 có demo nội bộ, tuần 4 có MVP Demo cho Sales. Không còn thời gian dự phòng; nếu trễ có thứ tự cắt giảm ở mục 4.

---

## 1. MCAH cần gì (tóm tắt 3 tài liệu)

### 1.1 Sản phẩm

MCAH giúp crewing/manning agency **biến tài liệu rời rạc (ảnh, PDF, Excel) thành hồ sơ thuyền viên chuẩn hóa, có bằng chứng, có người duyệt, dùng lại được cho nhiều mẫu chủ tàu**. Giá trị đo bằng thời gian thao tác, số lần sửa, tỷ lệ tái sử dụng hồ sơ. Mục tiêu nội bộ (chưa phải claim): giảm ≥ 50% median thời gian thao tác mà không tăng tỷ lệ sửa lại.

**4 nguyên tắc bất biến:** *AI trích xuất → Quy tắc quyết định → Nguồn bên ngoài xác minh → Con người duyệt ngoại lệ.* Dữ liệu chưa rõ phải hiện là UNKNOWN, không đoán.

### 1.2 Luồng lõi

| # | Bước | Kết quả |
|---|---|---|
| 1 | Nhận tài liệu | Upload sổ thuyền viên PDF/JPG/PNG; giữ bản gốc |
| 2 | AI đề xuất dữ liệu | Tên tàu, IMO, chức danh, ngày lên/xuống tàu…; trường không đọc được để thiếu |
| 3 | Duyệt cùng bằng chứng | Xem dữ liệu cạnh trang nguồn, sửa/chấp nhận |
| 4 | Hồ sơ chuẩn | Có revision, lịch sử sửa và nguồn |
| 5 | Kiểm tra | Đối chiếu tàu/IMO, ngày, overlap, trường bắt buộc |
| 6 | Tạo bộ hồ sơ | Chọn mẫu chủ tàu + chính sách liên lạc → preview → duyệt → xuất XLSX |
| 7 | Mở rộng | Chứng chỉ (Phase 3), visa (Phase 4), điều động (Phase 5): ngoài MVP |

### 1.3 Sales cần gì để demo (tài liệu Sales, mục 10)

- Một hồ sơ đọc rõ và một hồ sơ có vấn đề: upload → dữ liệu cạnh bằng chứng → sửa → kết quả kiểm tra → **xuất 2 mẫu**.
- Cố ý cho thấy **một trường giữ UNKNOWN** và **một thay đổi hồ sơ làm bản export cũ phải duyệt lại**.
- Chỉ demo tính năng chạy thật; dùng **dữ liệu synthetic**. Màn hình ghi "Sẵn sàng hồ sơ trong phạm vi MVP", không ghi "Đủ điều kiện lên tàu" hay "Verified crew".

### 1.4 MVP Pilot theo SRS thêm gì so với MVP Demo

Pilot là bước sau, chỉ làm khi có đối tác. So với Demo, Pilot thêm: hợp đồng xử lý dữ liệu thật; multi-tenant có test cách ly; SSO/MFA và tách quyền nhạy cảm; quét mã độc, object storage, idempotency; bbox bằng chứng; gold set ≥ 200 trang với mục tiêu ≥ 95% đúng cho trường trọng yếu; yêu cầu riêng theo từng chủ tàu và quy trình ngoại lệ; mẫu thật của đối tác; backup/restore có diễn tập, monitoring, load test; đo baseline và đạt đủ AT-01 đến AT-14. Ước lượng thêm 6–8 tuần công.

---

## 2. Hiện trạng code (nhánh `dev`)

### 2.1 Tổng quan

| Hạng mục | Hiện trạng |
|---|---|
| Repo | Repo cũ `axlthanhptp/Crew-Manning`, 6 nhánh. `dev` là bản đầy đủ nhất; `master` là bản đã copy sang `seasmart` |
| Stack | Fastify 5 + MariaDB (`mysql2`), React 19 + Ant Design 6. AI: lớp `llm.service.js` hỗ trợ Anthropic và OpenAI-compatible; `tesseract.js` (OCR), `pdf-lib`, `pdf-parse` |
| Quy mô | 24 nhóm route đăng ký, 26 services, 89 migrations |
| Vai trò | `admin`, `operator`, `accountant`, `seafarer` (module trung tâm đào tạo đã bị gỡ trên `dev`) |
| Kiểm thử | 3 file test (auth, deployment, 1 file ví dụ ở frontend) |
| Triển khai | `deploy.sh` (git pull nhánh `dev`, build, `pm2 restart sis-fe sis-be`). Server dev có dữ liệu thật (hồ sơ id ~4929) |
| DB | Migrations dùng cú pháp chỉ có ở MariaDB (`ADD COLUMN IF NOT EXISTS` xuất hiện 81 lần) |

### 2.2 Module và mức liên quan đến MCAH

| Module trên `dev` | Liên quan MCAH | Ghi chú |
|---|---|---|
| Hồ sơ thuyền viên, người thân, học vấn, sổ thuyền viên (`seaman_book`) | **Cao** | Bảng phẳng, chưa có revision/audit |
| **Quét sổ thuyền viên PDF bằng AI** (`pdf_scan.service.js` + `SeamanBookScanDrawer.jsx`) | **Rất cao** (bước 1–3) | Xem mục 2.3 |
| Quét chứng chỉ, giấy tờ tùy thân bằng AI (`ai.service.js`), quét QR CCCD | Trung bình (Phase 3) | Tái dùng lớp LLM |
| Lịch sử điều động (`seafarer_deployment`: tàu, chức danh, join_date, sign_off_date, trạng thái, snapshot tàu) | **Cao** (sea service) | Thiếu `date_precision`, trạng thái duyệt, nguồn |
| Tàu, danh mục tàu `ship_catalog`, tra cứu tàu theo IMO qua API ngoài | **Cao** (bước 5) | Chưa kiểm tra checksum IMO, chưa lưu nguồn/thời điểm xác minh |
| Đối tác/chủ tàu, đơn tuyển (jobs) | Trung bình | Dùng làm owner |
| **Xuất CV tiếng Trung và tiếng Anh** (`cv_export.service.js`, `cv_eng_export.service.js`) | **Rất cao** (bước 6) | Mapping viết cứng trong code; ghi thẳng SĐT thuyền viên và người thân, không có chính sách liên lạc |
| 12+ biểu mẫu hành chính, quyết định điều động, quản lý mẫu (`FormTemplatePage`) | Thấp | Ngoài MVP |
| Lương, doanh thu, tài chính, nhật ký gọi điện, tin nhắn | **Không** | Thuộc vận hành của công ty; ẩn ở bản demo |
| Cổng thuyền viên tự phục vụ | **Không** | Ẩn ở bản demo |

### 2.3 Chi tiết luồng quét sổ thuyền viên (gần MCAH nhất)

- **Đang làm được:** upload PDF → job trong bộ nhớ → SSE báo tiến độ từng trang → mỗi trang gửi ảnh cho Vision LLM với prompt lấy lịch sử đi tàu, hoặc số/ngày cấp/hạn sổ → giao diện hiện bảng kết quả để sửa và chọn dòng → tạo tàu mới (nếu chưa có), tạo `seafarer_deployment`, tạo `seaman_book`.
- **Hạn chế so với MCAH:**
  - Chỉ đọc PDF scan có ảnh JPEG nhúng; **trang không có ảnh JPEG bị bỏ qua**; không nhận file JPG/PNG trực tiếp.
  - File PDF bị xóa sau khi quét: **không giữ bản gốc**, không có hash chống trùng.
  - Kết quả không lưu số trang nguồn vào DB; giao diện không hiện ảnh trang cạnh bảng.
  - JSON lấy bằng regex, không validate schema; không có `missing_reason`; không ghi model, chi phí, số lần chạy.
  - Không bắt buộc duyệt trường trọng yếu; không ghi audit ai đã duyệt/sửa gì.

### 2.4 Gap so với MVP Demo

| Năng lực | Hiện có trên `dev` | Ước tính |
|---|---|---|
| Tiếp nhận tài liệu, giữ bản gốc, hash, trạng thái | Upload PDF tạm, không giữ | ~30% |
| AI extraction theo schema | Có prompt và gọi Vision theo trang; thiếu validate, missing_reason, log chi phí | ~60% |
| Duyệt cạnh bằng chứng | Bảng sửa kết quả; thiếu ảnh trang, bằng chứng, bắt buộc duyệt | ~40% |
| Hồ sơ canonical + revision + audit | Không có revision/audit | ~15% |
| Sea service | `seafarer_deployment` dùng được | ~60% |
| Kiểm tra tàu/IMO | Tra cứu theo IMO; chưa checksum, chưa ghi xác minh | ~40% |
| Sea time, overlap, rules, trạng thái sẵn sàng | Chưa có | ~5% |
| 2 mẫu chủ tàu | CV tiếng Trung + tiếng Anh đã chạy | ~70% |
| Chính sách liên lạc, duyệt phát hành, STALE | Chưa có | 0% |
| Phân quyền | 4 role; route đọc hồ sơ chỉ kiểm tra đăng nhập | ~40% |
| Triển khai | `deploy.sh` + PM2 | ~60% |

**Tổng thể:** khoảng **40–45%**. Phần còn lại tập trung vào "bằng chứng, duyệt, kiểm tra, chính sách xuất" là những điểm khác biệt chính của MCAH.

### 2.5 Lỗi và rủi ro kỹ thuật phát hiện khi đọc code

| # | Vấn đề | Vị trí | Mức |
|---|---|---|---|
| S1 | Route migration **không xác thực**, chạy SQL thay đổi/xóa bảng | `backend/src/routes/migration.routes.js`, `controllers/migration.controller.js` (handler kiểu Express `res.json`, lệnh SQL vẫn chạy trước khi lỗi) | **Nghiêm trọng** |
| S2 | `ENC_KEY` của API tàu viết cứng và đã commit | `decrypt.js` (gốc repo) | **Cao**: cần đổi khóa |
| S3 | Mật khẩu DB viết cứng | `run_migration.js`, `quick_migration.js` (2 script đã vô hiệu) | Trung bình |
| S4 | Dữ liệu gửi AI qua proxy bên thứ ba | `ANTHROPIC_BASE_URL=https://fallback.viber.vn` trong `backend/.env.example` | **Cao** (dữ liệu cá nhân) |
| S5 | Tài khoản role `seafarer` đọc và xuất được mọi hồ sơ, CV, biểu mẫu (route chỉ kiểm tra đăng nhập). Trên `dev` đã bỏ đăng ký công khai nên rủi ro thấp hơn `master` | `backend/src/routes/v1/seafarer.routes.js` | Cao |
| S6 | API tàu ngoài gọi qua HTTP thường tới IP `157.180.60.155:8888`; chưa rõ chủ sở hữu và quyền dùng dữ liệu | `vessel_external.service.js` | Trung bình |
| S7 | Migrations chỉ chạy trên MariaDB | `backend/migrations/` | Thấp nếu chốt MariaDB |
| S8 | Ít test (3 file) | — | Trung bình |

---

## 3. Phạm vi MVP Demo cho Sales (1 tháng)

**Nguyên tắc:** chạy thật luồng 1→6 trên dữ liệu synthetic; xây tiếp trên `dev`, giữ stack Fastify + React + MariaDB; một instance demo **tách khỏi server dev** (không dùng dữ liệu thật).

**Trong phạm vi:**
1. Lưu bản gốc tài liệu (hash, trạng thái); quét sổ nhận cả PDF và JPG/PNG; mỗi dòng kết quả nhớ số trang nguồn.
2. Validate output AI theo schema; `missing_reason` cho trường không đọc được; ghi model và chi phí mỗi lần chạy.
3. Nâng cấp màn hình kết quả quét: ảnh trang bên cạnh, click dòng thì mở đúng trang; tô màu UNKNOWN/ngày mơ hồ; bắt buộc duyệt tên tàu, chức danh, ngày lên/xuống tàu.
4. Lưu hồ sơ thành revision (snapshot) + audit log (ai, trước/sau, lý do, tài liệu và trang nguồn).
5. Checksum IMO + ghi kết quả xác minh tàu (nguồn, thời điểm, trạng thái); tính sea time (khoảng đóng +1, ongoing, union overlap); 4 rule: thiếu trường bắt buộc, ngày ngược, overlap, tàu chưa xác minh; trạng thái `BLOCKED` / `NEEDS_REVIEW` / `READY_IN_SCOPE`.
6. Xuất 2 CV hiện có kèm chính sách liên lạc (hiện/ẩn/thay bằng liên lạc agency, áp cả cho người thân); chống formula injection; preview → duyệt → phát hành; bản cũ STALE khi hồ sơ đổi.
7. Bộ dữ liệu synthetic (2–3 sổ PDF scan giả, tàu và chủ tàu giả) + script reset demo.

**Ngoài phạm vi:** multi-tenant, bbox, gold set, quy trình ngoại lệ, mapping mẫu cấu hình qua UI, assignment draft, Phase 3–5.

**Kịch bản demo (~10 phút):** upload sổ A (rõ) → duyệt nhanh → hồ sơ revision 1; upload sổ B (có ngày mờ, overlap, IMO sai) → `BLOCKED` kèm lý do → sửa có bằng chứng; xuất A theo CV tiếng Anh (ẩn SĐT, thay bằng SĐT agency) và CV tiếng Trung; sửa một dòng sea service → bản cũ STALE; mở audit log.

---

## 4. Kế hoạch 4 tuần (1 người + Claude Code)

### Tuần 0 (1–2 ngày): đồng bộ code và xử lý bảo mật gấp

| Việc | Ai |
|---|---|
| **Trên server dev:** gỡ hoặc chặn route `/api/v1/migration/*` (S1) | HuyLD |
| Đổi `ENC_KEY` của API tàu (S2); xác nhận `fallback.viber.vn` là gì, chuyển sang API key Anthropic trực tiếp (S4) | HuyLD |
| **Đồng bộ nhánh `dev` vào `seasmart`**, bỏ `decrypt.js`, `run_migration.js`, `quick_migration.js`; giữ 3 tài liệu MCAH, báo cáo này và skill `.claude/skills/ui-ux` | HuyLD hoặc Claude Code (cần cấp quyền, xem B1) |
| Dựng môi trường local MariaDB + seed admin; chạy lint, test, build | Claude Code |

### Tuần 1: nền và tiếp nhận tài liệu

- Sửa phân quyền route đọc/xuất hồ sơ (S5); xóa route migration trong code (S1).
- Ẩn các module ngoài phạm vi demo (lương, doanh thu, tài chính, nhật ký gọi, tin nhắn, cổng thuyền viên) bằng feature flag; đổi tên hiển thị sang MCAH.
- Bảng mới `source_document`, `extraction_run`; lưu bản gốc + hash; quét sổ nhận JPG/PNG và PDF không có ảnh JPEG nhúng (render trang thành ảnh).
- Validate JSON schema, `missing_reason`, ghi model/chi phí; `FakeProvider` để test không tốn phí.
- Thêm `source_document_id`, `page_no`, `review_state` cho `seafarer_deployment`.

### Tuần 2: duyệt và hồ sơ có lịch sử → **M1 demo nội bộ**

- Màn hình duyệt: ảnh trang cạnh bảng, click dòng mở đúng trang, tô màu UNKNOWN/ngày mơ hồ, bắt buộc duyệt trường trọng yếu, sửa phải có lý do.
- Bảng `crew_profile_revision` (snapshot), `audit_event`; optimistic lock khi lưu.
- **M1:** upload sổ → AI → duyệt cạnh trang nguồn → hồ sơ revision → xuất CV hiện có.

### Tuần 3: kiểm tra

- Checksum IMO (pure function + unit test); bảng `verification` (nguồn: API tàu / bằng chứng thủ công, thời điểm, người xác minh, trạng thái).
- Sea time và overlap (pure function, unit test theo ví dụ SRS: D0..D0 = 1 ngày; D0..D0+9 = 10; union D0..D0+9 và D0+5..D0+14 = 15).
- 4 rule + trạng thái hồ sơ + panel "Kết quả kiểm tra", ghi rõ lĩnh vực chưa đánh giá (chứng chỉ, visa).

### Tuần 4: xuất mẫu và hoàn thiện demo → **M2 MVP Demo**

- Tách mapping 2 CV ra cấu hình có version; chính sách liên lạc; chống formula injection; preview → duyệt (người duyệt khác người tạo) → phát hành; lưu hash; STALE.
- Dữ liệu synthetic + script reset; deploy instance demo riêng (HTTPS); tập dượt kịch bản với Sales.

**Nếu trễ, cắt theo thứ tự:** (1) bằng chứng thủ công cho tàu (giữ checksum + API tàu); (2) bước duyệt trước phát hành (giữ STALE); (3) optimistic lock.

### 4.1 Làm giao diện bằng skill `ui-ux`

Repo đã có skill `.claude/skills/ui-ux` (nguồn evondevKit, xem `SOURCE.md`). Mọi màn mới hoặc làm lại của MCAH đi qua skill này. Các điểm của skill ảnh hưởng đến kế hoạch:

- **Cách làm mặc định như designer (nhánh `U`):** brief và việc chính của từng màn → 2–3 wireframe → HuyLD chọn → mới dựng code. Có **2 cổng chờ HuyLD**: duyệt brief, chọn wireframe. Muốn bỏ wireframe cho màn đơn giản thì trả lời `dựng luôn`.
- **Bám theo codebase:** dự án dùng Ant Design 6 nên skill **dùng component của antd**, chỉ chi phối token (màu, chữ, khoảng cách), bố cục và trạng thái (rỗng, đang tải, lỗi, khóa). Token của skill (`references/tokens.css`) được dịch sang `theme.token` của `ConfigProvider` thay vì CSS Tailwind.
- **Skill chỉ lo giao diện**, để handler rỗng. Phần gọi API, logic duyệt, rule do Claude Code viết tiếp sau khi màn đã dựng.
- **Wireframe được gửi qua file đính kèm** (skill mặc định để ở thư mục tạm, HuyLD không mở được từ app).
- Dùng `ui-ux` thay cho các skill thiết kế của gstack (`/design-consultation`, `/design-review`) cho màn MCAH, để không có hai bộ luật thiết kế chồng nhau.

**Các màn cần làm (6 màn):**

| # | Màn | Lối của skill | Tuần dựng |
|---|---|---|---|
| 0 | Nền: token màu/chữ cho MCAH, khung app (sidebar, header), đăng nhập | Design system trước (`D9`) + logo đơn giản | 1 |
| 1 | Tiếp nhận tài liệu: upload, danh sách tài liệu và trạng thái | `U` (wireframe) | 1 |
| 2 | **Duyệt kết quả AI cạnh trang nguồn** | `U` (wireframe), màn quan trọng nhất của demo | 2 |
| 3 | Hồ sơ thuyền viên: lịch sử đi tàu, revision/audit, panel kết quả kiểm tra | `U` (wireframe) | 3 |
| 4 | Xuất mẫu: chọn mẫu + chính sách liên lạc → preview → duyệt → phát hành, danh sách bản xuất (STALE) | `U` (wireframe) | 4 |
| 5 | Hàng chờ công việc (trang chủ): tài liệu chờ duyệt, hồ sơ bị chặn, bản xuất chờ duyệt | `dựng luôn` | 4 |

Các màn cũ giữ lại (danh sách thuyền viên, tàu, đối tác) **không làm lại** trong 1 tháng; chỉ nhận token mới qua `ConfigProvider`. Nếu còn thời gian thì soi bằng lối review của skill.

**Lịch thiết kế đi trước code một nhịp:**

| Tuần | Thiết kế (cổng HuyLD) | Code |
|---|---|---|
| 1 (đầu tuần) | Design system + logo → duyệt. Brief + việc chính của 6 màn → duyệt (cổng 1). Wireframe màn 1, 2 → chọn (cổng 2) | Màn 0, 1 |
| 2 | Wireframe màn 3 → chọn | Màn 2 + logic duyệt |
| 3 | Wireframe màn 4 → chọn | Màn 3 + rule/kiểm tra |
| 4 | — | Màn 4, 5 + tập dượt demo |

**Ảnh hưởng tiến độ:** mỗi cổng cần HuyLD phản hồi trong ngày; tổng thời gian thiết kế ước khoảng 2–3 ngày công trên 4 tuần. Nếu trễ, màn 3 và 4 chuyển sang `dựng luôn` (bỏ wireframe).

---

## 5. Blockers và rủi ro

### 5.1 Blockers

| # | Blocker | Ảnh hưởng | Ai gỡ | Hạn |
|---|---|---|---|---|
| **B1** | **`seasmart` chưa có code `dev`.** Phiên Claude Code này bị chặn quyền khi thay toàn bộ cây thư mục và khi chạy code từ repo cũ | Chưa bắt đầu code được | HuyLD: tự đồng bộ, hoặc cấp quyền cho Claude Code | Tuần 0 |
| **B2** | **Route migration không xác thực trên server dev** (S1) | Ai biết URL đều chạy được lệnh SQL trên DB có dữ liệu thật | HuyLD | **Ngay** |
| **B3** | **`ENC_KEY` lộ trong lịch sử git** (S2) | Khóa API tàu không còn bí mật | HuyLD + chủ API tàu | Tuần 0 |
| **B4** | **AI đi qua `fallback.viber.vn`** (S4) | Dữ liệu cá nhân qua bên thứ ba chưa rõ thỏa thuận | HuyLD | Tuần 0 |
| **B5** | **API key Anthropic** cho app (gói Claude dùng cho Claude Code không thay được API key) | Tuần 1 phải dùng `FakeProvider` | HuyLD | Tuần 1 |
| **B6** | **Nguồn dữ liệu tàu** `157.180.60.155:8888`: của ai, có quyền dùng/lưu không | Không được ghi "đã xác minh" nếu chưa rõ nguồn | HuyLD (domain lead) | Tuần 3 |
| **B7** | **Dữ liệu demo synthetic:** cần 2–3 sổ thuyền viên giả dạng PDF scan | Không demo được bằng dữ liệu thật | HuyLD + Claude Code | Tuần 2 |
| **B8** | **Chỗ chạy demo:** server riêng, không dùng chung server dev có dữ liệu thật | Sales không có link | HuyLD | Tuần 4 |

### 5.2 Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | 1 người, 4 tuần, không có dự phòng | Thứ tự cắt giảm ở mục 4; M1 cuối tuần 2 để Sales góp ý sớm |
| R2 | AI đọc kém sổ viết tay/mờ | Bắt buộc duyệt + UNKNOWN; đo trên vài mẫu ở tuần 1 |
| R3 | Sales hứa tính năng phase sau hoặc "đã xác minh IMO" | Bám bảng claim mục 12 tài liệu Sales |
| R4 | Sửa trên `seasmart` làm lệch với server dev đang chạy `dev` của repo cũ | Chốt repo nào là nguồn chính; deploy demo từ `seasmart` |
| R5 | Chi phí AI chưa biết | Ghi chi phí từng lần chạy từ tuần 1 |
| R6 | Cổng duyệt của skill `ui-ux` chờ lâu, hoặc token của skill lệch với Ant Design | Phản hồi cổng trong ngày; màn phụ dùng `dựng luôn`; chốt bảng ánh xạ token → `ConfigProvider` ngay ở màn 0 |

---

## 6. Quyết định đã chốt (2026-10-05)

| # | Quyết định |
|---|---|
| Q1 | Làm **MVP Demo cho Sales** (synthetic, 1 agency). Pilot làm sau khi có đối tác |
| Q2 | Giữ stack **Fastify + React + MariaDB**. PostgreSQL chỉ là đề xuất trong SRS (mục 14, NFR-SEC-01, NFR-OPS-02), không áp dụng |
| Q3 | Đóng băng module Marineport. Trên `dev`, module đào tạo đã bị gỡ; đề xuất ẩn thêm lương, doanh thu, tài chính, nhật ký gọi, tin nhắn, cổng thuyền viên ở bản demo (**cần xác nhận**) |
| Q4 | 1 tháng, HuyLD làm cùng Claude Code |
| Q5 | Cần API key Anthropic Console riêng cho app |
| Q6 | Domain lead: HuyLD |
| Q7 | Tên hiển thị: **MCAH** |
| Q8 | File mẫu có trên nhánh `dev` (`backend/forms/`); lỗi xuất biểu mẫu ở bản 1 là do copy nhầm nhánh `master` |

**Còn cần trả lời:** danh sách module ẩn ở Q3; repo nào là nguồn chính sau khi đồng bộ (R4); `fallback.viber.vn` là gì (B4); chủ của API tàu (B6).

---

## Phụ lục A: các nhánh của repo cũ

| Nhánh | Commit cuối | Ghi chú |
|---|---|---|
| `main` | 30/3/2026 | Chỉ README |
| `master` | 31/3/2026 | Bản đã copy sang `seasmart` |
| `feature/gen_data_certificate_by_ai_minhnd` | 14/5/2026 | Đã merge vào `dev` |
| `feature/scan_qr_CCCD_gen_data_seefarers_minhnd` | 20/5/2026 | Đã merge vào `dev` (PR#2) |
| `feedback/extract_certificate_data_from_pdf_minhnd` | 22/5/2026 | Đã merge vào `dev` (PR#3) |
| **`dev`** | **8/7/2026** | Bản đầy đủ nhất, đang chạy trên server dev |

## Phụ lục B: file tham chiếu trên nhánh `dev`

| Nội dung | Vị trí |
|---|---|
| Lớp gọi LLM | `backend/src/services/llm.service.js` |
| Quét sổ thuyền viên PDF | `backend/src/services/pdf_scan.service.js`, `frontend/src/components/seafarer/SeamanBookScanDrawer.jsx` |
| Quét chứng chỉ, giấy tờ | `backend/src/services/ai.service.js` |
| Xuất CV | `backend/src/services/cv_export.service.js`, `cv_eng_export.service.js`, `backend/forms/CV china.xlsx`, `CV eng.xlsx` |
| Lịch sử điều động | `backend/src/services/deployment.service.js`, bảng `seafarer_deployment` |
| Tàu | `vessel_db.service.js`, `vessel_external.service.js`, migration `082_create_ship_catalog.sql` |
| Route migration không xác thực | `backend/src/routes/migration.routes.js` |
