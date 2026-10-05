# MCAH - Tổng hợp tình hình, kế hoạch triển khai MVP và blockers

- **Phiên bản:** 2 (2026-10-05). Bản 1 đánh giá nhầm trên code nhánh `master` cũ; bản này đánh giá lại trên nhánh `dev`.
- **Nguồn:**
  - 3 tài liệu MCAH trong repo (Ý tưởng sản phẩm, Nền tảng cho Sales & Marketing, Đặc tả SRS & MVP).
  - Code nhánh `dev` của repo cũ `axlthanhptp/Crew-Manning` (commit `cbdf00e`, 8/7/2026): **đọc code, chưa chạy thử** (phiên làm việc không được phép chạy code từ repo cũ).
  - Kết quả chạy thử nhánh `master` (31/3/2026) trên MariaDB/MySQL, cho các phần không thay đổi.
- **Quyết định đã chốt:** xem mục 6.

---

## 0. Tóm tắt nhanh

1. **Đã đồng bộ (2026-10-05):** `seasmart` giờ chứa code nhánh `dev` của repo cũ (commit `cbdf00e`, 8/7/2026, chỉ lấy ảnh chụp code, không lấy lịch sử vì lịch sử có khóa bí mật). Đã bỏ `decrypt.js`, `run_migration.js`, `quick_migration.js`. Lint, test, build chạy được; còn 2 test cũ của `deployment.service` đang fail sẵn trên `dev`.
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
5. **Kế hoạch (1 người + Claude Code): thiết kế trước, code sau.** Tổng 5 tuần: tuần 1 chỉ làm flow và design (5 cổng duyệt, cổng cuối là "Duyệt design"); tuần 2–5 code, cuối tuần 3 có demo nội bộ (M1), cuối tuần 5 có MVP Demo cho Sales (M2) với đủ phạm vi mục 3 (mục 4).

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
| S8 | Ít test (3 file) | - | Trung bình |

---

## 3. Phạm vi MVP Demo cho Sales (5 tuần)

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

## 4. Kế hoạch (1 người + Claude Code): thiết kế trước, code sau

**Nguyên tắc (Q10):** **duyệt xong design và flow mới bắt đầu code.** Tuần 1 chỉ làm thiết kế; không sửa code ứng dụng (backend, frontend, DB) cho đến khi HuyLD duyệt ở cổng cuối của giai đoạn thiết kế.

Ngoại lệ duy nhất là các việc vận hành bảo mật trên **server dev** (chặn route migration, đổi khóa), vì không phải code mới và đang để lộ dữ liệu thật.

### Giai đoạn 0 (ngay): bảo mật trên server dev

| Việc | Ai |
|---|---|
| **Trên server dev:** gỡ hoặc chặn route `/api/v1/migration/*` (S1) | HuyLD |
| Đổi `ENC_KEY` của API tàu (S2); xác nhận `fallback.viber.vn` là gì, chuyển sang API key Anthropic trực tiếp (S4) | HuyLD |
| ~~Đồng bộ nhánh `dev` vào `seasmart`~~ **Xong 2026-10-05** | Claude Code |

### Giai đoạn 1 (tuần 1): thiết kế hệ thống và flow → **cổng "Duyệt design"**

Mọi sản phẩm thiết kế lưu trong `docs/design/` của repo và được gửi file đính kèm cho HuyLD xem (kể cả trên điện thoại).

| Ngày | Sản phẩm | Nội dung | Cổng HuyLD |
|---|---|---|---|
| 1 | **Flow nghiệp vụ** (`docs/design/01-flows.md`) | Luồng end-to-end từ upload sổ đến phát hành bản xuất, theo vai trò (Crewing Officer, Reviewer, Admin); sơ đồ trạng thái: tài liệu (RECEIVED → PROCESSING → REVIEW_REQUIRED → COMPLETED/FAILED), dòng sea service (đề xuất → đã duyệt/đã sửa/từ chối, UNKNOWN), hồ sơ (DRAFT → REVIEWED, revision), kết quả kiểm tra (BLOCKED/NEEDS_REVIEW/READY_IN_SCOPE), bản xuất (DRAFT → chờ duyệt → đã phát hành → STALE); các nhánh lỗi (AI lỗi, trang mờ, tàu không tìm thấy, quá sức chứa mẫu) | **A: duyệt flow** |
| 1 | **Sơ đồ màn hình và điều hướng** (`02-sitemap.md`) | Danh sách màn, menu, màn nào dẫn tới màn nào, quyền xem theo vai trò | Gộp cổng A |
| 2 | **Brief + việc chính từng màn** (`03-screen-briefs.md`, bước `U1`/`U2` của skill) | Với mỗi màn: người dùng đến để làm gì, so sánh bằng gì, hành động cuối | **B: duyệt brief** (cổng 1 của skill) |
| 2–3 | **Design system** (`04-design-system.html`, lối `D9` của skill) | Token màu/chữ/khoảng cách cho MCAH, logo đơn giản, các component cơ bản (nút, ô nhập, select, bảng, badge trạng thái, modal, panel, toast, upload, trạng thái rỗng/đang tải/lỗi), khung app | **C: duyệt design system** |
| 3–4 | **Wireframe** (`05-wireframes/`, bước `U3`) | 2–3 phương án cho mỗi màn 1–4; 1 phương án cho màn 0 (đăng nhập, khung) và màn 5 | **D: chọn phương án** từng màn (cổng 2 của skill) |
| 5 | **Prototype hi-fi tĩnh** (`06-prototype/`) | Các phương án đã chọn, dựng bằng design system, dữ liệu synthetic, bấm qua được theo kịch bản demo mục 3 (upload → duyệt → hồ sơ BLOCKED → sửa → xuất 2 mẫu → STALE → audit). HTML tĩnh, không nối backend, không nằm trong code app | **E: "Duyệt design"** |

**Cổng E là điểm bắt đầu code.** Nếu cổng E cần sửa nhiều, giai đoạn thiết kế kéo dài và toàn bộ lịch code lùi theo.

### Giai đoạn 2 (tuần 2–5): code theo design đã duyệt

**Q11 đã chốt: kéo thành 5 tuần, giữ đủ phạm vi mục 3.**

**Tuần 2: nền + tiếp nhận tài liệu**
- Bảo mật trong code: sửa phân quyền route đọc/xuất hồ sơ (S5), xóa route migration (S1). Ẩn module ngoài phạm vi demo bằng feature flag.
- DB local MariaDB + seed admin; bảng `source_document`, `extraction_run`; thêm `source_document_id`, `page_no`, `review_state` cho `seafarer_deployment`.
- Lưu bản gốc + hash; render trang thành ảnh; quét nhận JPG/PNG; validate JSON schema, `missing_reason`, ghi model/chi phí; `FakeProvider`.
- `frontend-mcah/`: design system đã duyệt, màn 0 (khung app, đăng nhập), màn 1 (tiếp nhận tài liệu).

**Tuần 3: duyệt + hồ sơ có lịch sử → M1 demo nội bộ**
- Màn 2: duyệt kết quả AI cạnh ảnh trang nguồn, bắt buộc duyệt trường trọng yếu, sửa phải có lý do.
- `crew_profile_revision`, `audit_event`; optimistic lock khi lưu.
- **M1:** upload sổ → AI → duyệt cạnh trang nguồn → hồ sơ revision.

**Tuần 4: kiểm tra + hồ sơ**
- Checksum IMO, bảng `verification`, bằng chứng thủ công cho tàu; sea time và overlap (unit test theo ví dụ SRS); 4 rule + trạng thái hồ sơ.
- Màn 3: danh sách và hồ sơ thuyền viên, lịch sử sửa, kết quả kiểm tra.

**Tuần 5: xuất mẫu + hoàn thiện demo → M2 MVP Demo**
- Mapping 2 CV có version, chính sách liên lạc, chống formula injection, preview → duyệt (người duyệt khác người tạo) → phát hành, STALE. Màn 4.
- Màn 5: hàng chờ công việc.
- Dữ liệu synthetic + script reset; deploy instance demo riêng; tập dượt kịch bản với Sales.

**Nếu trễ, cắt theo thứ tự:** (1) màn 5 hàng chờ (dùng danh sách ở màn 1); (2) bằng chứng thủ công cho tàu (giữ checksum + API tàu); (3) bước duyệt trước phát hành (giữ STALE).

### 4.1 Giao diện: không dùng Ant Design, chỉ dùng skill `ui-ux`

**Quyết định (Q9):** các màn MCAH dựng **không dùng Ant Design**, chỉ dựa trên skill `.claude/skills/ui-ux` (nguồn evondevKit), một phần để đánh giá skill làm được đến đâu.

**Cách tổ chức code:**
- Tạo **app frontend mới `frontend-mcah/`**: Vite + React 19 + **Tailwind v4** (mặc định của skill) + React Query + React Router. Dùng chung backend Fastify hiện có.
- Chép `references/tokens.css` của skill làm token gốc, đặt màu nhấn và font cho MCAH theo `references/brand-tokens.md`. Đọc `references/tailwind-v4-traps.md` trước khi cấu hình.
- **App `frontend/` cũ (antd) đóng băng**, vẫn chạy cho vận hành nội bộ trên server dev. Bản demo cho Sales chỉ dùng `frontend-mcah/`. Không trộn antd và Tailwind trong cùng một app.
- Logic phía client tái dùng được từ app cũ (client axios, lưu token đăng nhập, gọi API quét sổ) được chép sang, phần giao diện viết lại.

**Skill có sẵn gì, thiếu gì:**

| Cần cho MCAH | Skill có mẫu | Cách xử lý |
|---|---|---|
| Nút, ô nhập, select, checkbox, tab, badge, tag | Có (`components/button`, `input`, `choice-controls`, `small-controls`, `tag-input`) | Dựng theo mẫu |
| Upload file kèm danh sách tệp, toast | Có (`components/file-upload`) | Dựng theo mẫu |
| Bảng dữ liệu, sắp xếp, bảng theo trạng thái, trạng thái rỗng/đang tải | Có (`layouts/app` "Bảng dữ liệu", `components/sortable-header`, `empty-state`, `loading`) | Dựng theo mẫu |
| Sửa trực tiếp trong bảng (màn duyệt) | Có (`components/inline-edit`) | Dựng theo mẫu |
| Modal, panel trượt, dropdown, toast, chuyển động mở/đóng | Có (`layouts/overlay`) | Dựng theo mẫu |
| Danh sách thông tin hồ sơ, lịch sử sửa | Có (`components/description-list`, `timeline`) | Dựng theo mẫu |
| Form đăng nhập, form nhiều trường, báo lỗi | Có (`layouts/form`, `rules-form`) | Dựng theo mẫu |
| **Chọn ngày** | Không có mẫu; skill gợi ý thư viện (`react-day-picker`…) và để người dùng quyết | Bản demo dùng ô nhập ngày `dd/mm/yyyy` có kiểm tra, **không cài thư viện**. Nếu thấy thiếu thì quyết thêm `react-day-picker` |
| **Xem trang tài liệu (zoom, lật trang)** | Không có | Backend render mỗi trang thành ảnh (việc này đã cần cho AI), frontend chỉ hiện `<img>` có phóng to; **không cần thư viện PDF** |
| Truy cập bàn phím, bẫy focus trong modal | Có luật trong skill, phải tự viết | Kiểm bằng checklist của skill; nếu tốn thời gian thì đề xuất Radix primitives (quyết riêng) |

**Quy trình với skill (trong giai đoạn thiết kế):**
- Màn 0 theo lối design system trước (`D9`) → cổng C.
- Màn 1–5 theo nhánh `U`: brief (cổng B) → wireframe (cổng D). Bước `U4` "dựng thật" của skill được làm ở dạng prototype tĩnh trong `docs/design/06-prototype/` để duyệt ở cổng E, rồi mới chuyển vào `frontend-mcah/` ở giai đoạn code.
- Skill để wireframe ở thư mục tạm; Claude Code chép sang `docs/design/` và gửi file đính kèm.
- Skill chỉ dựng giao diện, để handler rỗng; Claude Code nối API và logic ở giai đoạn code.
- Không dùng các skill thiết kế của gstack cho màn MCAH.

**Các màn:**

| # | Màn | Thiết kế (tuần 1) | Code |
|---|---|---|---|
| 0 | Design system, khung app, đăng nhập, logo | `D9` → cổng C | Tuần 2 |
| 1 | Tiếp nhận tài liệu + danh sách tài liệu/trạng thái | `U` → cổng B, D | Tuần 2 |
| 2 | **Duyệt kết quả AI cạnh ảnh trang nguồn** | `U` → cổng B, D | Tuần 3 |
| 3 | Danh sách + hồ sơ thuyền viên: lịch sử đi tàu, lịch sử sửa, kết quả kiểm tra | `U` → cổng B, D | Tuần 4 |
| 4 | Xuất mẫu: chính sách liên lạc → preview → duyệt → phát hành, bản xuất STALE | `U` → cổng B, D | Tuần 5 |
| 5 | Hàng chờ công việc | 1 phương án | Tuần 5 |

**Đánh giá skill (để trả lời "skill làm được đến đâu"):**

| Tiêu chí | Cách ghi nhận |
|---|---|
| Thời gian | Số giờ thiết kế + dựng cho mỗi màn; số vòng sửa sau khi duyệt |
| Độ phủ | Component phải tự viết ngoài mẫu của skill, thư viện phải thêm |
| Chất lượng | Chạy `checklist.md` và `scripts/probe.mjs` của skill; lỗi giao diện phát hiện khi tập dượt; so ảnh chụp với màn antd cũ cùng chức năng |
| Kỹ thuật | Kích thước bundle so với app antd (hiện 1,58 MB), lỗi truy cập bàn phím |

**Điểm kiểm tra cuối tuần 3 (M1):** nếu màn 2 code bằng skill chưa dùng được cho demo (thiếu chức năng, lỗi nhiều, chậm hơn kế hoạch > 3 ngày), HuyLD quyết: tiếp tục, hoặc quay về antd cho màn 3–5. Kết quả đánh giá ghi vào `docs/` sau M2.

---

## 5. Blockers và rủi ro

### 5.1 Blockers

| # | Blocker | Ảnh hưởng | Ai gỡ | Hạn |
|---|---|---|---|---|
| ~~B1~~ | ~~`seasmart` chưa có code `dev`~~ **Đã xong 2026-10-05** | - | - | - |
| **B2** | **Route migration không xác thực trên server dev** (S1) | Ai biết URL đều chạy được lệnh SQL trên DB có dữ liệu thật | HuyLD | **Ngay** |
| **B3** | **`ENC_KEY` lộ trong lịch sử git** (S2) | Khóa API tàu không còn bí mật | HuyLD + chủ API tàu | Tuần 0 |
| **B4** | **AI đi qua `fallback.viber.vn`** (S4) | Dữ liệu cá nhân qua bên thứ ba chưa rõ thỏa thuận | HuyLD | Tuần 0 |
| **B5** | **API key Anthropic** cho app (gói Claude dùng cho Claude Code không thay được API key) | Tuần 1 phải dùng `FakeProvider` | HuyLD | Tuần 1 |
| **B6** | **Nguồn dữ liệu tàu** `157.180.60.155:8888`: của ai, có quyền dùng/lưu không | Không được ghi "đã xác minh" nếu chưa rõ nguồn | HuyLD (domain lead) | Tuần 3 |
| **B7** | **Dữ liệu demo synthetic:** cần 2–3 sổ thuyền viên giả dạng PDF scan | Không demo được bằng dữ liệu thật | HuyLD + Claude Code | Tuần 2 |
| **B8** | **Chỗ chạy demo:** server riêng, không dùng chung server dev có dữ liệu thật | Sales không có link | HuyLD | Tuần 5 |

### 5.2 Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | 1 người, 5 tuần, ít dự phòng | Thứ tự cắt giảm ở mục 4; M1 cuối tuần 3 để Sales góp ý sớm |
| R2 | AI đọc kém sổ viết tay/mờ | Bắt buộc duyệt + UNKNOWN; đo trên vài mẫu ở tuần 1 |
| R3 | Sales hứa tính năng phase sau hoặc "đã xác minh IMO" | Bám bảng claim mục 12 tài liệu Sales |
| R4 | Sửa trên `seasmart` làm lệch với server dev đang chạy `dev` của repo cũ | Chốt repo nào là nguồn chính; deploy demo từ `seasmart` |
| R5 | Chi phí AI chưa biết | Ghi chi phí từng lần chạy từ tuần 1 |
| R6 | Dựng giao diện không có antd tốn hơn dự kiến (bảng, form, modal, chọn ngày, truy cập bàn phím); cổng duyệt của skill chờ lâu | Điểm kiểm tra cuối tuần 2 (mục 4.1); phản hồi cổng trong ngày; màn phụ dùng `dựng luôn` |

---

## 6. Quyết định đã chốt (2026-10-05)

| # | Quyết định |
|---|---|
| Q1 | Làm **MVP Demo cho Sales** (synthetic, 1 agency). Pilot làm sau khi có đối tác |
| Q2 | Giữ stack **Fastify + React + MariaDB**. PostgreSQL chỉ là đề xuất trong SRS (mục 14, NFR-SEC-01, NFR-OPS-02), không áp dụng |
| Q3 | Đóng băng module Marineport. Trên `dev`, module đào tạo đã bị gỡ; đề xuất ẩn thêm lương, doanh thu, tài chính, nhật ký gọi, tin nhắn, cổng thuyền viên ở bản demo (**cần xác nhận**) |
| Q4 | HuyLD làm cùng Claude Code; thời gian **5 tuần** (Q11) |
| Q5 | Cần API key Anthropic Console riêng cho app |
| Q6 | Domain lead: HuyLD |
| Q7 | Tên hiển thị: **MCAH** |
| Q8 | File mẫu có trên nhánh `dev` (`backend/forms/`); lỗi xuất biểu mẫu ở bản 1 là do copy nhầm nhánh `master` |
| Q9 | Màn MCAH **không dùng Ant Design**, chỉ dùng skill `ui-ux` (Tailwind v4) trong app mới `frontend-mcah/`; app antd cũ đóng băng (mục 4.1) |
| Q10 | **Thiết kế trước, code sau:** tuần 1 làm flow + design (6 sản phẩm, 5 cổng duyệt), chỉ code sau cổng "Duyệt design" (mục 4) |
| Q11 | **Kéo thành 5 tuần**, giữ đủ phạm vi mục 3: M1 cuối tuần 3, M2 cuối tuần 5 |

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
