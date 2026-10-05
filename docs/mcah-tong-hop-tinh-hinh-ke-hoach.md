# MCAH — Tổng hợp tình hình, kế hoạch triển khai MVP và blockers

- **Ngày lập:** 2026-10-05
- **Nguồn:** 3 tài liệu MCAH trong repo (Ý tưởng sản phẩm, Nền tảng cho Sales & Marketing, Đặc tả SRS & MVP) + rà soát code nhánh `main` (commit `40a369e`) + chạy thử thực tế (cài DB, chạy migrations, khởi động backend, gọi API).
- **Phạm vi:** đánh giá hiện trạng, so với mục tiêu MVP của MCAH, đề xuất kế hoạch và các điểm đang chặn.

> ⚠️ **Cập nhật 2026-10-05 (sau khi lập báo cáo):** code trong repo này là bản copy nhánh `master` của repo cũ `axlthanhptp/Crew-Manning` (commit 31/3/2026). Nhánh `dev` của repo cũ mới hơn nhiều (144 commit, đến 8/7/2026) và đã có: thư mục `backend/forms/` (gồm `CV china.xlsx`, `CV eng.xlsx`), lớp LLM (Anthropic/OpenAI) và quét chứng chỉ, giấy tờ tùy thân bằng AI, lịch sử điều động (`seafarer_deployment`) dùng để xuất CV có service record, danh mục tàu (`ship_catalog`) và tra cứu tàu qua API ngoài, `deploy.sh`. Vì vậy **mục 2 (hiện trạng, gap) và mục 7.3 (lịch 4 tuần) đánh giá thấp mức có sẵn** và cần làm lại dựa trên nhánh `dev`. Nguyên nhân lỗi xuất biểu mẫu (B4) là do copy nhầm nhánh, không phải do đường dẫn.

---

## 0. Tóm tắt nhanh (đọc 1 phút)

1. **Code hiện có chưa phải MCAH.** Repo `seasmart` chứa ứng dụng **Marineport**: phần mềm quản lý thuyền viên, trung tâm đào tạo, khóa học, đăng ký học, cổng tự phục vụ cho thuyền viên, viết cho một công ty manning Việt Nam (dữ liệu mẫu lấy từ file `HD - Hong.xlsx` của V-ISEA). Phần đó chạy được. Tuy nhiên **luồng lõi của MCAH chưa có dòng code nào**: tải tài liệu → AI trích xuất → duyệt cạnh bằng chứng → hồ sơ chuẩn có lịch sử → kiểm tra tàu/IMO và sea service → xuất mẫu chủ tàu theo chính sách liên lạc.
2. **Phần dùng lại được chiếm khoảng 20–25% nền móng:** khung app (Fastify + React + Ant Design), đăng nhập JWT và phân quyền, upload file có kiểm tra định dạng, bảng hồ sơ thuyền viên, danh mục chức danh, loại tàu, quốc gia và chứng chỉ, bộ điền Excel bằng `exceljs`, import Excel.
3. **Khi chạy thử, phát hiện 4 lỗi phải sửa trước khi demo:**
   - **Lộ dữ liệu cá nhân.** Bất kỳ ai tự đăng ký tài khoản thuyền viên (endpoint công khai) đều xem và xuất Excel được toàn bộ hồ sơ (CCCD, ngày sinh, SĐT, hộ chiếu).
   - **Không tạo được lịch sử đi tàu.** API tạo hợp đồng/lịch sử đi tàu trả lỗi 500.
   - **Không xuất được biểu mẫu.** Chức năng xuất 12 biểu mẫu trả lỗi 500 vì thư mục mẫu `forms/` không có trong repo.
   - **Migrations chỉ chạy trên MariaDB.** Với MySQL 8, 6/17 file lỗi, trong khi kế hoạch deploy (TASK-13) lại ghi MySQL 8.
4. **Đề xuất:** làm **"MVP Demo cho Sales"** ngay trên stack hiện có, dùng dữ liệu tổng hợp (synthetic) và triển khai cho một agency.
   - **Mốc M1 (tuần 4):** demo nội bộ luồng tài liệu → AI → duyệt → hồ sơ → xuất 1 mẫu.
   - **Mốc M2 (tuần 8):** bản demo Sales hoàn chỉnh với 2 mẫu chủ tàu, kiểm tra tàu/sea time, chính sách liên lạc, duyệt phát hành.
   - Ước lượng trên giả định **2 dev full-time + 1 domain lead bán thời gian**. Nếu chỉ có 1 dev thì cần khoảng 3–3,5 tháng.
   - "MVP Pilot" theo đầy đủ SRS (AT-01 đến AT-14, multi-tenant, gold set) là bước sau, **chỉ làm khi đã có đối tác pilot**.
5. **Các blockers lớn nhất:**
   - Chưa có nhân sự.
   - Chưa có domain lead.
   - Chưa có 2 mẫu Excel chủ tàu và bộ sổ thuyền viên mẫu.
   - Chưa chọn nhà cung cấp AI, chưa có API key và ngân sách.
   - Thiếu các file mẫu và dữ liệu nằm trên máy của team cũ.
   - Chưa chốt hướng sản phẩm: giữ hay đóng băng các module Marineport, giữ stack hiện tại hay chuyển sang stack SRS đề xuất.

---

## 1. MCAH cần gì: tóm tắt 3 tài liệu

### 1.1 Sản phẩm

MCAH (Maritime Crewing Agency Harness) là nền tảng giúp crewing/manning agency **biến tài liệu rời rạc (ảnh, PDF, Excel) thành hồ sơ thuyền viên chuẩn hóa, có bằng chứng, có người duyệt và dùng lại được cho nhiều mẫu chủ tàu**.

- **Vấn đề cần giải quyết:** nhân viên crewing phải nhập lại dữ liệu, đối chiếu lịch sử đi tàu và sửa hồ sơ theo từng mẫu của chủ tàu.
- **Đo giá trị bằng:** thời gian thao tác, số lần sửa, tỷ lệ tái sử dụng hồ sơ.
- **Mục tiêu nội bộ** (chưa phải claim): giảm ít nhất 50% median active handling time mà không tăng tỷ lệ sửa lại.

**4 nguyên tắc bất biến:** *AI trích xuất → Quy tắc quyết định → Nguồn bên ngoài xác minh → Con người duyệt ngoại lệ.* Dữ liệu chưa rõ phải hiện là UNKNOWN, không được đoán.

### 1.2 Luồng nghiệp vụ lõi (7 bước)

| # | Bước | Kết quả |
|---|---|---|
| 1 | Nhận tài liệu | Upload sổ thuyền viên (discharge book), PDF/JPG/PNG; giữ bản gốc |
| 2 | AI đề xuất dữ liệu | Tên tàu, IMO, chức danh, ngày lên/xuống tàu…; trường không đọc được để thiếu |
| 3 | Duyệt cùng bằng chứng | Nhân viên xem dữ liệu cạnh trang nguồn, sửa/chấp nhận; xung đột thành task |
| 4 | Hồ sơ chuẩn | Hồ sơ canonical có revision, lịch sử sửa và nguồn |
| 5 | Kiểm tra theo bối cảnh | Đối chiếu tàu/IMO, quy tắc ngày, overlap, trường bắt buộc |
| 6 | Tạo bộ hồ sơ | Chọn mẫu chủ tàu + chính sách thông tin liên lạc → preview → duyệt → xuất XLSX |
| 7 | Mở rộng | Chứng chỉ (Phase 3), visa/hành trình (Phase 4), điều động (Phase 5): **ngoài MVP** |

### 1.3 Phạm vi MVP theo SRS (Phase 1 + lõi Phase 2)

- **Có trong MVP:**
  - Tiếp nhận PDF/JPG/PNG và import Excel theo mẫu chuẩn.
  - AI extraction có schema chặt.
  - Bắt buộc người duyệt các trường trọng yếu: họ tên, ngày sinh, chức danh, tàu, sign on, sign off.
  - Bằng chứng đến trang (và vùng ảnh nếu có).
  - Hồ sơ có revision và audit.
  - Kiểm tra định dạng IMO, đối chiếu tàu qua registry hoặc bằng chứng thủ công.
  - Tính sea time và phát hiện overlap.
  - Rule engine tối thiểu.
  - **2 mẫu XLSX chủ tàu** có mapping theo version, kèm export policy.
  - Assignment draft.
  - Phân quyền theo tenant, audit, backup, dashboard công việc.
- **Ngoài MVP:**
  - OCR mọi loại giấy tờ.
  - Tự động duyệt dựa trên confidence.
  - Cam kết API GISIS.
  - Tự điền mọi file Excel.
  - Bộ quy tắc STCW/MLC toàn cầu.
  - Visa, payroll.
  - Tự gửi email ra ngoài.
- **Release gate của SRS:** đạt 14 bài nghiệm thu AT-01 đến AT-14, có gold set ≥ 200 trang, đo được chi phí và độ chính xác. Đây là chuẩn **pilot với khách thật**, khối lượng lớn hơn nhiều so với "MVP đơn giản để Sales đi hút khách".

### 1.4 Sales cần gì để đi demo (theo tài liệu Sales & Marketing, mục 10)

- Demo gồm **một hồ sơ đọc rõ và một hồ sơ có vấn đề**, theo thứ tự: upload → trường dữ liệu cạnh bằng chứng → người dùng sửa → kết quả kiểm tra → **xuất 2 mẫu**.
- Cố ý cho thấy **một trường không rõ được giữ UNKNOWN**, và **một thay đổi hồ sơ làm bản export cũ phải duyệt lại**.
- **Chỉ demo tính năng đã chạy thật.** Phần chưa có thì dùng ảnh minh họa gắn nhãn "Định hướng".
- **Dùng dữ liệu synthetic**, không dùng hồ sơ thuyền viên thật.
- Màn hình ghi "Sẵn sàng hồ sơ trong phạm vi MVP", không ghi "Đủ điều kiện lên tàu" hay "Verified crew".

> Kết luận: mục tiêu của sếp ("MVP đơn giản để Sales đem đi hút khách") tương ứng với **một bản demo chạy thật toàn bộ luồng 1→6 trên dữ liệu synthetic**. Bản này không cần đạt toàn bộ release gate pilot của SRS.

---

## 2. Hiện trạng code

### 2.1 Tổng quan

| Hạng mục | Hiện trạng |
|---|---|
| Tên gọi | Repo `seasmart`, code và tài liệu ghi **Marineport**, sản phẩm mục tiêu là **MCAH**. Ba tên khác nhau, cần thống nhất tên hiển thị khi demo |
| Stack | Backend Fastify 5 + MariaDB/MySQL (`mysql2`), Frontend React 19 + Ant Design 6 + React Query + Zustand + Vite |
| Quy mô | 16 module route, 14 services, 29 bảng DB (migration gốc 23 bảng + 17 migrations), khoảng 5.600 dòng code trang/API ở frontend |
| Lịch sử | Toàn bộ source được upload vào repo trong 1 commit ngày 2026-10-05. Ghi chú công việc cuối cùng của team cũ là khoảng tháng 3/2026 (`TASKS.md`, `tasks/README.md`) |
| Task cũ còn dở | TASK-13 Deploy VPS, TASK-17 Merge TC portal, TASK-18 Notification bell (thực tế đã có trong code, README chưa cập nhật), TASK-19, 20, 21, TASK-D1 export HD-Hong |
| Kiểm thử | Backend: 1 file test (auth, 8 test). Frontend: 1 file test ví dụ. Không có CI |
| Triển khai | Chưa deploy (TASK-13 vẫn TODO). Chưa có môi trường demo |

### 2.2 Kết quả chạy thử thực tế (2026-10-05)

| Kiểm tra | Kết quả |
|---|---|
| `npm ci` backend + frontend | ✅ OK (Node 22) |
| Lint | ✅ 0 lỗi; 13 cảnh báo ở backend (biến không dùng, ví dụ `COL_MAP` và `SPECIAL_COLS` trong `import.service.js`) và 2 cảnh báo ở frontend |
| Test | ✅ Backend 8/8, frontend 2/2 (rất mỏng) |
| Build frontend | ✅ OK, nhưng bundle là 1 chunk 1,58 MB (chưa code-split) |
| Migrations trên **MySQL 8.0** | ❌ 6/17 file lỗi (`002`, `004`, `010`, `012`, `015`, `017`) do dùng cú pháp chỉ có ở MariaDB (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) |
| Migrations trên **MariaDB 10.11** | ✅ Chạy hết, tạo 29 bảng; seed 10 thuyền viên, 23 chức danh, 61 loại chứng chỉ; **0 tàu, 0 chủ tàu** |
| Font tiếng Việt khi seed | ⚠️ 6 file migration thiếu `SET NAMES utf8mb4`. Nếu client mặc định không phải utf8 thì tên chức danh bị lỗi font (đã gặp: "Báº¿p trÆ°á»Ÿng") |
| Tài khoản admin ban đầu | ⚠️ Không có seed và không có script. Phải tự INSERT bằng tay vào bảng `user` |
| Khởi động backend + đăng nhập + danh sách thuyền viên | ✅ OK |
| Import Excel (file template) | ✅ OK |
| Xuất biểu mẫu HĐ (`/seafarers/:id/export-form/hd1`) | ❌ 500: `File not found: .../forms/HĐ1.xlsx` (thư mục `forms/` nằm ngoài repo) |
| Tạo hợp đồng/lịch sử đi tàu (`POST /employment-contracts`) | ❌ 500: `Field 'contract_number' doesn't have a default value`. API chỉ insert vài cột trong khi bảng có nhiều cột NOT NULL (`contract_number`, `ship_owner_id`, `rank_id`, `sign_date`, `basic_wage_usd`, `vessel_id`). Lỗi DB còn bị trả nguyên văn về client |
| **Tài khoản thuyền viên tự đăng ký** gọi `GET /seafarers`, `GET /seafarers/:id`, `GET /seafarers/export` | ❌ **200: đọc và xuất được toàn bộ hồ sơ cá nhân** của mọi thuyền viên |

### 2.3 Danh mục module hiện có và mức liên quan đến MCAH

| Module | Trạng thái | Liên quan MCAH | Ghi chú |
|---|---|---|---|
| Auth (JWT, bcrypt, rate limit), quản lý user, 5 role | Chạy | **Cao** (tái dùng) | Cần thêm role Reviewer; sửa lỗ hổng phân quyền |
| Hồ sơ thuyền viên (CRUD, ~60 cột) + người liên lạc/bảo lãnh | Chạy | **Cao** (nền cho hồ sơ crew) | Bảng phẳng, sửa trực tiếp, chưa có revision và audit |
| Import Excel 44 cột (file HD-Hong) | Chạy | Trung bình | Gắn cứng với cột của 1 công ty; SRS cần intake schema có preview |
| Xuất danh sách thuyền viên ra Excel | Chạy | Thấp | Đang lộ cho mọi role |
| Chứng chỉ thuyền viên (CRUD + upload PDF/JPG/PNG, kiểm tra magic bytes) | Chạy một phần | Trung bình (Phase 3) | **Tái dùng phần kiểm tra file cho intake**. File đã upload không tải lại được (không có route phục vụ `/uploads`) |
| Hợp đồng lao động (`employment_contract`, payroll) | **Lỗi khi tạo** | Trung bình | Thiết kế cho hợp đồng/lương, không phải sea service của MCAH |
| Tàu (`vessel`), chủ tàu (`ship_owner`) | Chỉ có bảng và API đọc | **Cao** | **Không có màn hình hay API tạo/sửa**, dropdown chọn tàu luôn rỗng |
| Danh mục: chức danh, loại tàu, quốc gia, cảng, loại chứng chỉ, loại HĐ | Chạy | **Cao** | Tái dùng làm taxonomy; cần thêm alias và raw label |
| Xuất 12 biểu mẫu HĐ (điền placeholder bằng `exceljs`) | **Lỗi (thiếu file mẫu)** | Trung bình | Tái dùng kỹ thuật điền Excel cho owner templates. Có **thông tin chủ tàu thật bị hard-code** (SINOSTAR…) do query sai cột `ship_owner.vessel_name` |
| Trung tâm đào tạo, khóa học, đăng ký học, QR enroll, waitlist, email nhắc lịch (SendGrid), tin nhắn, thông báo | Chạy | **Không** | Thuộc hướng Marineport, ngoài phạm vi MCAH MVP |
| Cổng thuyền viên tự phục vụ (đăng ký + OTP, xem hồ sơ, chứng chỉ, khóa học) | Chạy | **Không** (MVP) | Có thể dùng sau này nhưng hiện là nguồn rủi ro bảo mật (xem B5) |
| DashboardPage | Có file, không gắn route | Thấp | |

### 2.4 Gap so với MVP của MCAH

| Năng lực MVP (theo SRS) | Hiện có | Mức hoàn thành ước tính |
|---|---|---|
| Tiếp nhận tài liệu PDF/JPG/PNG, hash chống trùng, trạng thái xử lý (FR-ING-01/02) | Chỉ có kiểm tra định dạng file khi upload chứng chỉ | ~15% |
| Nhập Excel theo intake schema có preview (FR-ING-03) | Import 44 cột cố định, có báo lỗi và cảnh báo | ~40% |
| AI extraction theo schema, missing_reason, retry, chi phí (FR-EXT-01..05) | Không có | 0% |
| Màn hình duyệt cạnh bằng chứng, bắt buộc duyệt trường trọng yếu (FR-REV-01..04) | Không có | 0% |
| Hồ sơ canonical + revision + optimistic lock + audit | Bảng `seafarer` phẳng; có `created_by`/`updated_by`, không revision và audit | ~15% |
| Sea service (lịch sử đi tàu) | `employment_contract` (lỗi khi tạo), cột raw `vessel_name_raw` | ~10% |
| Kiểm tra IMO checksum, đối chiếu tàu, trạng thái verification (FR-VES-01..04) | Bảng `vessel` có `imo_number`, không có logic | ~5% |
| Tính sea time, union overlap, ngày không chắc chắn, ongoing (FR-SEA-01..04) | Không có | 0% |
| Rule engine tối thiểu + tổng hợp trạng thái sẵn sàng (§11) | Không có (chỉ có badge "sắp hết hạn" chứng chỉ ở UI) | 0% |
| 2 mẫu chủ tàu, mapping theo version, export policy, preview, duyệt phát hành, stale (FR-EXP-01..06) | Kỹ thuật điền Excel; thiếu mapping, policy, duyệt | ~15% |
| Assignment draft | Không có | 0% |
| Phân quyền (Officer / Reviewer / Approver, maker ≠ checker) | 5 role cũ, kiểm tra role không đồng đều | ~30% |
| Multi-tenant | Không có (1 công ty) | 0% |
| Dashboard công việc, backup, monitoring, CI, deploy | Không có | 0% |

**Tổng thể:** khoảng **20–25%** khối lượng MVP Demo đã có dưới dạng nền móng tái dùng được. Toàn bộ phần tạo khác biệt cho MCAH (AI, bằng chứng, duyệt, rules, owner template) phải làm mới.

---

## 3. Đề xuất phạm vi "MVP Demo cho Sales"

### 3.1 Nguyên tắc

- **Chạy thật đúng luồng 1→6.** Không làm mockup cho các bước này. Màn hình của phase sau, nếu có, phải gắn nhãn "Định hướng".
- **Dữ liệu synthetic:** tự tạo 2–3 bộ sổ thuyền viên giả, danh sách tàu giả có IMO hợp lệ về checksum, chủ tàu giả.
- **Một agency, một instance demo.** Các bảng mới vẫn có cột `tenant_id` để sau này mở multi-tenant không phải đập đi làm lại.
- **Giữ stack hiện tại** (Fastify + React + MariaDB). SRS đề xuất FastAPI + PostgreSQL, nhưng chính SRS ghi đó là "lựa chọn đề xuất". Viết lại từ đầu sẽ mất thêm khoảng 3–4 tuần mà không thêm giá trị cho demo. Sẽ đánh giá lại khi chuẩn bị pilot (xem Q2).
- **Đơn giản hóa có kiểm soát so với SRS:**
  - Bằng chứng ở **mức trang**; bbox làm sau.
  - Hàng đợi job dùng bảng DB + worker trong tiến trình, chưa cần Redis hay queue riêng.
  - Lưu file trên disk private, chưa cần S3.
  - Kiểm tra tàu dùng **checksum IMO + danh mục tàu nội bộ + bằng chứng thủ công**, không gọi GISIS.
  - Chưa làm rule pack pháp lý.
  - Mỗi điểm đơn giản hóa đều không làm sai nguyên tắc bất biến của SRS.

### 3.2 Trong phạm vi Demo

1. **Upload tài liệu:** PDF/JPG/PNG ≤ 25 MB, ≤ 50 trang. Có hash chống trùng, trạng thái `RECEIVED → PROCESSING → REVIEW_REQUIRED → COMPLETED / FAILED`, file gốc bất biến và chỉ tải được khi có quyền.
2. **AI extraction:**
   - Interface `VisionProvider`, gồm 1 provider thật và 1 `FakeProvider` chạy bằng fixtures để test và demo offline.
   - Schema JSON chặt cho thông tin cá nhân và các dòng sea service (tên tàu theo tài liệu, IMO, chức danh raw, sign on, sign off).
   - Có `missing_reason` (ví dụ ILLEGIBLE) và số trang làm bằng chứng.
   - Retry tối đa 3 lần, ghi chi phí mỗi lần chạy.
   - Nội dung tài liệu được coi là dữ liệu, không phải chỉ dẫn cho model.
3. **Màn hình duyệt:**
   - Bên trái xem tài liệu gốc (phóng to, lật trang), bên phải là form. Click vào trường thì nhảy đến đúng trang.
   - Tô màu trường UNKNOWN, ngày mơ hồ, IMO chưa đối chiếu.
   - Các thao tác: chấp nhận, sửa (bắt buộc ghi lý do), từ chối, đánh dấu ONGOING. Lưu nháp được.
4. **Công bố hồ sơ:**
   - Tạo `crew_profile_revision` (snapshot), tăng số revision, dùng optimistic lock (trả 409 khi xung đột).
   - Audit log ghi người sửa, giá trị trước/sau, lý do.
   - Gợi ý trùng người theo tên + ngày sinh, không tự merge.
5. **Kiểm tra:**
   - Checksum IMO. Đối chiếu tàu với danh mục nội bộ: ưu tiên IMO, tên chỉ dùng để tạo danh sách ứng viên.
   - Bằng chứng thủ công do reviewer cung cấp.
   - Trạng thái verification gồm `NOT_CHECKED`, `VERIFIED`, `CONFLICT`, `NOT_FOUND`, `UNAVAILABLE`.
   - Dịch vụ tính sea time: khoảng đóng +1 ngày, contract ongoing tính tạm đến ngày as_of, ngày không đầy đủ không được tính, gộp union khi overlap.
   - 4–5 rule tối thiểu: `DQ_REQUIRED_CRITICAL`, `DQ_DATE_ORDER`, `DQ_OVERLAP`, `VES_EVIDENCE`, và tùy chọn `OWNER_EXPERIENCE`.
   - Tổng hợp ra trạng thái `BLOCKED` / `NEEDS_REVIEW` / `READY_IN_SCOPE`, kèm danh sách lĩnh vực **chưa đánh giá** (chứng chỉ, visa).
6. **Xuất 2 mẫu chủ tàu:**
   - (A) CV thuyền viên, (B) bảng kinh nghiệm/sea service matrix.
   - Mapping dạng JSON có version (ô, dòng lặp, sức chứa). Vượt sức chứa thì báo `TEMPLATE_CAPACITY_EXCEEDED`, không cắt bớt.
   - Export policy cho thông tin liên lạc: hiện, ẩn, hoặc thay bằng liên lạc của agency.
   - Chống formula injection.
   - Luồng preview → reviewer duyệt (người duyệt khác người tạo) → phát hành. Lưu hash của file.
   - **Bản export cũ chuyển STALE khi hồ sơ đổi.**
7. **Dashboard công việc:** tài liệu chờ duyệt, hồ sơ bị chặn và lý do, export chờ duyệt.
8. **Đo thời gian thao tác:** ghi thời điểm mở và đóng màn hình duyệt cho mỗi hồ sơ, phục vụ đo baseline và so sánh trước/sau khi đi pilot.

### 3.3 Ngoài phạm vi Demo (để sau, hoặc chỉ minh họa có nhãn)

Multi-tenant đầy đủ; SSO/MFA; GISIS/Equasis; bbox; chứng chỉ, medical, passport readiness (Phase 3); visa và hành trình (Phase 4); điều động (Phase 5); MCP; email ra ngoài; gold set 200 trang; load test; RLS.

### 3.4 Kịch bản demo đề xuất (khoảng 10 phút, khớp tài liệu Sales mục 10)

1. Upload sổ thuyền viên **A** (rõ nét). AI điền dữ liệu, reviewer duyệt nhanh, công bố hồ sơ revision 1.
2. Upload sổ **B** (có vấn đề). Một ngày ký xuống tàu bị mờ nên giữ UNKNOWN, hai hợp đồng bị overlap, một IMO sai checksum. Hệ thống báo `BLOCKED` kèm lý do cụ thể.
3. Reviewer sửa IMO (kèm bằng chứng), xác nhận overlap là bàn giao, giữ trường UNKNOWN. Trạng thái chuyển sang `NEEDS_REVIEW` hoặc `READY_IN_SCOPE` tùy rule.
4. Xuất hồ sơ A theo **mẫu Owner A** (ẩn SĐT thuyền viên, thay bằng SĐT agency) và **mẫu Owner B** (hiện đầy đủ): cùng một hồ sơ, dùng cho hai mẫu.
5. Sửa một dòng sea service của A. Bản export cũ chuyển STALE, phải tạo và duyệt lại.
6. Mở audit log: ai sửa gì, khi nào, dựa trên trang nào của tài liệu nào.

---

## 4. Kế hoạch triển khai

**Giả định nhân sự:** 2 dev full-time (1 lead nghiêng backend, 1 nghiêng frontend), 1 domain lead hoặc chuyên gia crewing khoảng 20% thời gian, 1 người phía Sales/PO chốt yêu cầu và nghiệm thu demo. Nếu chỉ có 1 dev thì nhân thời gian khoảng ×1,7.

### Tuần 0 (2–3 ngày): chốt quyết định và thu thập đầu vào

- Sếp và tech lead trả lời các câu hỏi ở mục 6 (mục tiêu, stack, module Marineport, nhân sự, AI provider).
- Domain lead và Sales thu thập: **2 mẫu Excel chủ tàu** (hoặc chốt tự thiết kế mẫu generic), **danh sách trường trọng yếu**, quy ước tính sea time, 2–3 mẫu sổ thuyền viên (thật nhưng chỉ dùng nội bộ để thiết kế, hoặc tự tạo bản synthetic).
- Liên hệ team cũ xin lại các tài sản bị thiếu (xem B4).

### Sprint 0 (tuần 1): ổn định nền

| Việc | Lý do |
|---|---|
| Sửa phân quyền: `/seafarers/*`, `/import/*`, chứng chỉ, export-form chỉ cho role nội bộ; seafarer chỉ thấy hồ sơ của chính mình | Lỗ hổng lộ dữ liệu cá nhân (B5) |
| Không trả lỗi DB nguyên văn; bỏ thông tin chủ tàu hard-code trong `form_export.service.js` | Bảo mật, và SRS cấm hard-code chủ tàu |
| Chốt DB: **pin MariaDB 10.11** (khuyến nghị, vì migrations đã chạy trên đó) hoặc viết lại migrations cho MySQL 8. Thêm `SET NAMES utf8mb4`, thêm script `npm run migrate` và `npm run seed:admin`. Cập nhật TASK-13 cho khớp | B6 |
| CRUD Tàu và Chủ tàu (API + màn hình danh mục) | Nền cho kiểm tra tàu và owner template |
| Ẩn module đào tạo, khóa học, QR, tin nhắn khỏi menu bản MCAH (dùng feature flag, không xóa code) | Bản demo gọn, đúng câu chuyện MCAH |
| CI GitHub Actions (lint, test, build); README hướng dẫn chạy local | Chống hỏng ngầm khi làm nhanh |
| ADR ngắn: stack, tenancy, lưu trữ file, AI provider | Theo yêu cầu Sprint A của SRS |

### Sprint 1 (tuần 2–3): tiếp nhận tài liệu và AI extraction

- **Bảng mới:** `source_document`, `document_page`, `extraction_run`, `field_proposal` (có `evidence` dạng JSON), `job`. Đều có cột `tenant_id`.
- **Upload:**
  - Tái dùng phần kiểm tra magic bytes của `certificate.service.js`.
  - Thêm sha256 chống trùng, lưu vào thư mục private.
  - Endpoint tải file có kiểm tra quyền.
  - Render trang PDF thành ảnh để hiển thị và gửi cho model.
- **Worker:**
  - Bảng job + vòng lặp worker, retry 3 lần có backoff, lỗi rõ ràng có cho phép nhập tay.
  - Khóa idempotency gồm hash tài liệu, pipeline version và cấu hình.
- **AI:**
  - `VisionProvider`, `FakeProvider` chạy bằng fixtures, 1 provider thật.
  - Validate output theo JSON schema; output sai schema không được ghi vào hồ sơ.
  - Ghi số token và chi phí mỗi lần chạy.
- **Kiểm chứng sớm:** chạy thử trên 2–3 mẫu sổ để đo độ chính xác sơ bộ. Đây là rủi ro lớn nhất (R1), cần biết sớm.
- **Nghiệm thu:** AT-01 (upload lại không chạy extraction lại), AT-02 (bằng chứng mức trang).

### Sprint 2 (tuần 3–4): màn hình duyệt và hồ sơ canonical

- **Bảng mới:** `sea_service` (tách khỏi `employment_contract`; có `date_precision`, `service_status` ONGOING, `review_state`), `crew_profile_revision`, `review_decision`, `audit_event` (chỉ ghi thêm).
- **Màn hình Review:** xem tài liệu cạnh form, đánh dấu UNKNOWN và ngày mơ hồ, sửa có lý do, lưu nháp, bulk accept cho trường ít rủi ro.
- **Công bố hồ sơ:** transaction, optimistic lock (409); bắt buộc đã duyệt các trường trọng yếu (thiếu thì trả 422); xem so sánh giữa các revision.
- **Role:** thêm `reviewer`. Ánh xạ `operator` thành Crewing Officer và `admin` thành Tenant Admin/Template Manager.
- **Nghiệm thu:** AT-03, AT-04.
- **🎯 Mốc M1 (cuối tuần 4): demo nội bộ** upload → AI → duyệt → hồ sơ revision → xuất 1 mẫu CV đơn giản. Sales xem và góp ý sớm.

### Sprint 3 (tuần 5–6): kiểm tra tàu, sea time, rules

- **Tàu:**
  - Checksum IMO (pure function, có unit test).
  - Đối chiếu tàu: ưu tiên IMO, tên chỉ tạo danh sách ứng viên, có nhiều ứng viên thì phải review.
  - Bảng `verification` lưu nguồn, thời điểm, người xác minh, trạng thái.
  - Adapter bằng chứng thủ công.
- **Sea time:**
  - Pure function, có unit test theo đúng ví dụ nghiệm thu của SRS: D0..D0 = 1 ngày; D0..D0+9 = 10 ngày; union của D0..D0+9 và D0+5..D0+14 = 15 ngày.
  - Test thêm năm nhuận, contract ongoing, ngày không đầy đủ.
- **Rule engine tối thiểu:**
  - Hàm thuần trên snapshot của hồ sơ, rule config validate bằng schema, không `eval`.
  - Kết quả PASS / FAIL / UNKNOWN / NOT_APPLICABLE + severity, reason code, hướng xử lý.
  - Tổng hợp trạng thái kèm danh sách lĩnh vực chưa đánh giá.
- **UI:** panel "Kết quả kiểm tra" trên trang hồ sơ, ghi rõ "Sẵn sàng hồ sơ trong phạm vi MVP".
- **(Nếu kịp)** Assignment draft: gắn crew, chủ tàu, chức danh, tàu, ngày dự kiến.
- **Nghiệm thu:** AT-05, AT-06, AT-07 (phần dữ liệu).

### Sprint 4 (tuần 7–8): owner templates, export policy, hoàn thiện demo

- **Bảng mới:** `export_template` (owner, version, hash file, mapping JSON, trạng thái DRAFT → ACTIVE), `export_policy`, `export_artifact` (revision hồ sơ, version mẫu, version policy, hash, người tạo, người duyệt, trạng thái STALE).
- **Engine điền Excel:**
  - Tái dùng `exceljs`, giữ định dạng, ô merge, vùng in.
  - Dòng lặp có sức chứa; vượt sức chứa thì chặn.
  - Ghi dữ liệu người dùng dạng text an toàn (chống `=`, `+`, `-`, `@`).
  - Policy hide/replace áp dụng cho cả sheet ẩn, comment, hyperlink, metadata.
- **Luồng phát hành:** preview là chính file sẽ phát hành → duyệt (maker ≠ checker) → phát hành → link tải ngắn hạn. Hồ sơ đổi thì bản cũ chuyển STALE.
- **Dashboard công việc.**
- **Bộ dữ liệu demo:** 2–3 sổ synthetic (1 rõ, 1 có vấn đề), tàu và chủ tàu giả, 2 mẫu; script reset dữ liệu demo.
- **Deploy môi trường demo** (VPS + domain + HTTPS + backup DB hằng ngày). Diễn tập kịch bản mục 3.4 với Sales.
- **Nghiệm thu:** AT-08, AT-09, AT-10, AT-14 (Officer làm trọn từ upload đến xuất 2 mẫu bằng UI, không sửa DB tay).
- **🎯 Mốc M2 (cuối tuần 8): MVP Demo cho Sales.**

### Sau M2: MVP Pilot (chỉ khi đã có đối tác pilot), ước lượng 6–8 tuần

- **Bảo mật và multi-tenant:**
  - Tenant isolation có test (AT-11).
  - Đăng nhập tổ chức, MFA.
  - Mã hóa dữ liệu nhạy cảm, quy định retention, quy trình xóa dữ liệu.
- **Vận hành:** backup và restore (AT-12), monitoring, runbook.
- **Ngoại lệ:** ExceptionRequest (AT-13).
- **Chất lượng extraction:**
  - Gold set từ tài liệu được phép dùng, đo độ chính xác trên holdout.
  - Có thể thêm bbox.
- **Cấu hình theo đối tác:** 2 mẫu thật của đối tác pilot; quy ước sea time theo từng chủ tàu.
- **Pháp lý:** hợp đồng xử lý dữ liệu, chọn region, quyền dùng AI với dữ liệu thật.
- **Quyết định stack:** đánh giá lại có cần chuyển PostgreSQL để dùng RLS hay không.

### Tóm tắt mốc

| Mốc | Thời điểm (2 dev) | Thời điểm (1 dev) | Nội dung |
|---|---|---|---|
| M0: Nền ổn định | Cuối tuần 1 | Cuối tuần 2 | Sửa bảo mật, DB, CI, CRUD tàu và chủ tàu |
| M1: Demo nội bộ | Cuối tuần 4 | Tuần 7 | Upload → AI → duyệt → hồ sơ → xuất 1 mẫu |
| M2: MVP Demo cho Sales | Cuối tuần 8 | Tuần 13–14 | Luồng 1→6 hoàn chỉnh, 2 mẫu, chạy trên môi trường demo |
| M3: Pilot-ready | +6–8 tuần sau M2 | +10–12 tuần | Đạt release gate SRS với đối tác thật |

> Các mốc là **ước lượng** dựa trên khối lượng mô tả ở trên và giả định đầu vào (mẫu, dữ liệu, API key) có đúng hạn. Mỗi tuần trễ của đầu vào ở mục 5 sẽ đẩy mốc tương ứng.

### Xử lý phần Marineport hiện có

- **Không xóa.** Ẩn bằng feature flag ở bản demo MCAH.
- Các module đào tạo, khóa học, QR, waitlist, tin nhắn và cổng thuyền viên **đóng băng**: không phát triển thêm cho đến khi sếp quyết định (Q3).
- Riêng TASK-13 (deploy) được làm lại trong Sprint 4. TASK-D1 (12 biểu mẫu HĐ) chỉ tiếp tục nếu lấy lại được file mẫu và vẫn có khách cần.

---

## 5. Blockers và rủi ro

### 5.1 Blockers (cần xử lý để bắt đầu hoặc giữ tiến độ)

| # | Blocker | Ảnh hưởng | Ai gỡ | Cần chốt trước | Hướng xử lý / phương án tạm |
|---|---|---|---|---|---|
| **B1** | **Chưa có nhân sự dev** (lý do dự án từng dừng) | Không có tiến độ | Sếp | Tuần 0 | Tối thiểu 1 fullstack lead full-time. 2 dev thì đạt M2 ở tuần 8 |
| **B2** | **Chưa có domain lead / chuyên gia crewing** | Không chốt được trường trọng yếu, quy ước sea time, taxonomy chức danh/loại tàu; không ai làm dữ liệu demo cho sát thực tế | Sếp | Tuần 0 | Chỉ định 1 người trong mạng lưới, khoảng 1 ngày/tuần |
| **B3** | **Chưa có 2 mẫu Excel chủ tàu** và **bộ sổ thuyền viên mẫu** | Sprint 1 (đo AI) và Sprint 4 (xuất mẫu) không làm được cho sát | Sales + domain lead | Sổ mẫu: tuần 2. Mẫu chủ tàu: tuần 6 | Nếu chưa có đối tác: **tự thiết kế 2 mẫu generic** (CV + sea service matrix) theo định dạng phổ biến, và **tự tạo sổ synthetic**. Không dùng tên chủ tàu thật trong demo |
| **B4** | **File mẫu nằm ngoài repo.** Code đọc `forms/` tại `path.resolve(__dirname, '../../../../forms')` trong `form_export.service.js`, tức là **thư mục cha của repo**, không phải bên trong repo. `sample data/HD - Hong.xlsx` cũng không được commit. Trên server dev, file nằm cạnh thư mục code nên chức năng vẫn chạy; clone repo mới thì lỗi 500 | Ai clone repo hoặc deploy server mới sẽ không xuất được biểu mẫu | Anh Huy | Tuần 1 | **Đã xác định nguyên nhân (2026-10-05).** Chép `forms/` vào repo (kiểm tra không chứa dữ liệu cá nhân) và cho đường dẫn đọc từ biến môi trường |
| **B5** | **Lỗ hổng phân quyền lộ dữ liệu cá nhân:** tài khoản thuyền viên tự đăng ký đọc và xuất được mọi hồ sơ; ai đăng nhập cũng upload được chứng chỉ cho bất kỳ thuyền viên nào; lỗi DB trả nguyên văn. Seed `011` ghi nguồn là file thật của V-ISEA (CCCD/SĐT trông đã bị thay, nhưng tên có thể là thật) | **Không được đưa bất kỳ bản nào lên internet** trước khi sửa. Rủi ro uy tín nếu khách phát hiện khi demo | Dev | Sprint 0 | Sửa trong tuần 1. Xác nhận seed là synthetic hoặc thay bằng dữ liệu giả |
| **B6** | **DB không nhất quán:** migrations chỉ chạy trên MariaDB, kế hoạch deploy ghi MySQL 8; không có script migrate, không có seed admin; 6 file thiếu `SET NAMES utf8mb4` | Deploy lên MySQL 8 sẽ hỏng; dữ liệu tiếng Việt có thể lỗi font | Tech lead | Sprint 0 | Giữ MySQL/MariaDB (Q2). Kiểm tra server dev đang chạy MariaDB hay MySQL rồi chuẩn hóa migrations theo đúng loại đó, thêm script migrate/seed |
| **B7** | **Chưa chọn nhà cung cấp AI**, chưa có API key, ngân sách, chính sách gửi dữ liệu cá nhân ra dịch vụ ngoài | Sprint 1 không nối được AI thật | Sếp + tech lead | Tuần 1 | Làm trước với `FakeProvider`. Dữ liệu demo synthetic nên chưa vướng pháp lý; dữ liệu thật thì phải chốt trước pilot |
| **B8** | **Chưa chốt hướng sản phẩm:** MCAH mới hay tiếp tục Marineport (đào tạo/enrollment)? Stack hiện tại hay FastAPI/PostgreSQL theo SRS? | Dễ làm lan man, hoặc viết lại không cần thiết | Sếp + tech lead | Tuần 0 | **Đã chốt (2026-10-05):** tập trung MCAH, giữ stack hiện tại, đóng băng các module Marineport |
| **B9** | **Chưa có môi trường demo** (VPS, domain, HTTPS) | Sales không có link để demo | Sếp / IT | Tuần 7 | Một VPS nhỏ là đủ cho demo; cấu hình theo TASK-13 (sửa lại cho MariaDB) |

### 5.2 Rủi ro cần theo dõi

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | **AI đọc kém sổ thuyền viên VN** (viết tay, đóng dấu đè, ảnh chụp nghiêng), khiến thời gian duyệt còn lâu hơn nhập tay | Đo sớm ở Sprint 1 trên mẫu thật (chỉ dùng nội bộ). Trang nào khó thì cho nhập tay có audit. Không hứa độ chính xác |
| R2 | **Sales hứa tính năng phase sau** (chứng chỉ, visa, "verified by IMO", "tiết kiệm 50%") | Bám bảng claim ở mục 12 tài liệu Sales. Màn hình phase sau phải gắn nhãn "Định hướng" |
| R3 | **Mẫu chủ tàu quá đa dạng**, biến thành dịch vụ tùy biến không giới hạn | Mapping có version, giới hạn số mẫu; mẫu mới phải qua quy trình onboarding |
| R4 | **Scope creep từ Marineport cũ** (job board, ticket, Seaman Club… trong `tasks/README.md`) | Đóng băng theo quyết định Q3 |
| R5 | **Phụ thuộc 1 người** (lặp lại tình trạng cũ) | CI, README, ADR, task file theo lát cắt; mọi PR viện dẫn requirement/AT |
| R6 | **Chi phí AI theo trang** chưa biết | Ghi chi phí mỗi lần chạy từ Sprint 1, báo cáo theo tài liệu và theo hồ sơ |

---

## 6. Câu hỏi cần sếp / Product trả lời (tuần 0)

> Đã có câu trả lời ngày 2026-10-05, xem mục 7.

1. **Q1. Mục tiêu:** đồng ý làm **MVP Demo cho Sales** (synthetic, 1 agency, mốc M2) trước, còn **MVP Pilot theo SRS** làm sau khi có đối tác?
2. **Q2. Stack:** giữ Fastify + React + MariaDB như hiện tại (khuyến nghị), hay viết lại theo FastAPI + PostgreSQL như SRS đề xuất?
3. **Q3. Marineport:** các module đào tạo, khóa học, QR, waitlist, cổng thuyền viên, tin nhắn có khách nào đang dùng hoặc cần không (ví dụ V-ISEA)? Đóng băng hay tiếp tục song song?
4. **Q4. Nhân sự và hạn:** có bao nhiêu dev, từ ngày nào? Sales cần demo vào ngày nào?
5. **Q5. AI:** chọn nhà cung cấp nào, ngân sách thử nghiệm bao nhiêu, ai giữ API key?
6. **Q6. Domain lead:** ai? Có xin được 2 mẫu Excel chủ tàu và vài sổ thuyền viên (để thiết kế nội bộ) từ quan hệ trong ngành không?
7. **Q7. Tên hiển thị:** demo dùng tên **MCAH**, **Marineport** hay **SeaSmart**?
8. **Q8. Tài sản cũ:** còn liên lạc được với team cũ để lấy `forms/`, `sample data/`, các ghi chú `refactoring/` không?

---

## 7. Quyết định đã chốt (2026-10-05) và kế hoạch 4 tuần

### 7.1 Quyết định

| # | Quyết định |
|---|---|
| Q1 | Làm **MVP Demo cho Sales** (dữ liệu synthetic, 1 agency). Pilot làm sau khi có đối tác |
| Q2 | **Giữ stack hiện tại:** Fastify + React + MySQL/MariaDB. PostgreSQL chỉ xuất hiện trong SRS (mục 14 kiến trúc, NFR-SEC-01 và NFR-OPS-02), không áp dụng |
| Q3 | **Đóng băng** các module Marineport (đào tạo, khóa học, QR, waitlist, cổng thuyền viên, tin nhắn): ẩn khỏi menu, không xóa code |
| Q4 | **1 tháng, 1 người (HuyLD) làm cùng Claude Code** |
| Q5 | Gói Claude dùng cho Claude Code **không dùng làm API key cho app được**. Cần API key riêng từ Anthropic Console (tính phí theo lượng dùng). Trong lúc phát triển dùng `FakeProvider`, chỉ gọi API thật với dữ liệu synthetic |
| Q6 | Domain lead: **HuyLD** |
| Q7 | Tên hiển thị: **MCAH** |
| Q8 | Code đầy đủ; file mẫu `forms/` nằm ngoài repo (xem B4) |

### 7.2 Phạm vi rút gọn cho 1 tháng

Kế hoạch 8 tuần ở mục 4 giả định 2 dev. Với 1 người + Claude Code trong 4 tuần, vẫn giữ đủ câu chuyện demo ở mục 3.4 nhưng **cắt các phần sau**:

- Không làm màn hình upload/onboarding template: 2 mẫu và mapping cấu hình sẵn bằng file trong repo.
- Không làm dashboard riêng: dùng danh sách tài liệu và hồ sơ có lọc theo trạng thái.
- Không làm gợi ý trùng người, bulk accept, so sánh revision bằng UI, assignment draft, rule `OWNER_EXPERIENCE`.
- Hàng đợi job: xử lý bất đồng bộ trong tiến trình, frontend hỏi trạng thái định kỳ.
- Bằng chứng mức trang; không bbox.

### 7.3 Lịch 4 tuần

| Tuần | Việc | Kết quả cuối tuần |
|---|---|---|
| 1 | Sửa phân quyền (B5), chuẩn hóa migrations + script migrate/seed admin (B6), chép `forms/` vào repo (B4), CRUD tàu và chủ tàu, ẩn module Marineport, đổi tên hiển thị sang MCAH, CI. Bảng `source_document`/`extraction_run`/`field_proposal`, upload có hash, `VisionProvider` + `FakeProvider` | Upload tài liệu → có đề xuất dữ liệu (fake) |
| 2 | Provider AI thật + schema JSON chặt; bảng `sea_service`, `crew_profile_revision`, `audit_event`; màn hình duyệt (tài liệu cạnh form, UNKNOWN, sửa có lý do); công bố hồ sơ có revision + optimistic lock | **M1:** upload → AI → duyệt → hồ sơ revision |
| 3 | Checksum IMO + đối chiếu danh mục tàu + bằng chứng thủ công; tính sea time (unit test theo ví dụ SRS); 4 rule (`DQ_REQUIRED_CRITICAL`, `DQ_DATE_ORDER`, `DQ_OVERLAP`, `VES_EVIDENCE`); panel kết quả kiểm tra | Hồ sơ có trạng thái BLOCKED / NEEDS_REVIEW / READY_IN_SCOPE |
| 4 | 2 mẫu (CV + sea service matrix) + mapping JSON; export policy liên lạc; chống formula injection; preview → duyệt → phát hành; STALE khi hồ sơ đổi; 2–3 sổ synthetic + script reset demo; deploy; tập dượt kịch bản | **M2:** MVP Demo cho Sales |

**Nếu trễ**, cắt theo thứ tự: (1) bằng chứng thủ công cho tàu (giữ checksum), (2) bước duyệt trước khi phát hành (giữ STALE), (3) mẫu thứ hai.

### 7.4 Việc PO (HuyLD) cần chuẩn bị

- **Tuần 1:** kiểm tra server dev đang chạy MariaDB hay MySQL; chép thư mục `forms/` từ server dev vào repo; tạo API key Anthropic Console cho app.
- **Tuần 1–2:** danh sách trường trọng yếu và quy ước tính sea time; 1–2 mẫu sổ thuyền viên thật (chỉ dùng nội bộ để thiết kế schema và prompt).
- **Tuần 3:** thiết kế 2 mẫu Excel generic (CV + sea service matrix), không dùng tên chủ tàu thật.
- **Tuần 4:** VPS/domain demo.

---

## Phụ lục A: cách chạy local đã kiểm chứng (2026-10-05)

```bash
# 1. DB: dùng MariaDB 10.11 (MySQL 8 lỗi 6 migrations)
mysql -e "CREATE DATABASE marineport CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql --default-character-set=utf8mb4 marineport < migration.sql
for f in backend/migrations/*.sql; do mysql --default-character-set=utf8mb4 marineport < "$f"; done

# 2. Tạo admin thủ công (chưa có seed)
HASH=$(cd backend && node -e "console.log(require('bcrypt').hashSync('<mật-khẩu>',10))")
mysql marineport -e "INSERT INTO user (email,password_hash,role,verification_status) VALUES ('admin@example.com','$HASH','admin','verified')"

# 3. Backend: copy backend/.env.example → backend/.env, điền DB_* và JWT_SECRET (≥ 32 ký tự)
cd backend && npm ci && npm run dev

# 4. Frontend
cd frontend && npm ci && npm run dev   # http://localhost:5173
```

## Phụ lục B: file và vị trí code tham chiếu

| Nội dung | Vị trí |
|---|---|
| Schema gốc 23 bảng | `migration.sql` |
| Migrations bổ sung (MariaDB) | `backend/migrations/001…017` |
| Phân quyền theo route (không đồng đều) | `backend/src/routes/v1/seafarer.routes.js`, `import.routes.js`, `certificate.routes.js` |
| Kiểm tra file upload (tái dùng cho intake) | `backend/src/services/certificate.service.js` |
| Điền Excel theo placeholder (tái dùng cho owner template) | `backend/src/services/form_export.service.js` |
| Import Excel 44 cột | `backend/src/services/import.service.js` |
| API tạo hợp đồng bị lỗi | `backend/src/services/employment_contract.service.js` |
| Trang chi tiết thuyền viên (1.066 dòng) | `frontend/src/pages/admin/SeafarerDetailPage.jsx` |
| Danh sách task cũ | `tasks/README.md`, `TASKS.md` |
