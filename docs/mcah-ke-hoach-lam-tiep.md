# Kế hoạch triển khai tiếp MCAH bằng chức năng thật

Phiên bản 2 — cập nhật 09/10/2026.
Baseline đã rà soát: thư mục `seasmart/`, commit `f559c8e`. Khi nhận việc phải kiểm tra HEAD và thay đổi hiện tại trước khi áp dụng.

## 1. Mục tiêu và nguyên tắc bắt buộc

Hoàn thành MVP MCAH có thể sử dụng thực tế cho một agency: nhận tài liệu bất kỳ trong phạm vi hỗ trợ → gọi AI thật → duyệt cùng trang nguồn → lưu hồ sơ chuẩn và lịch sử đi tàu → kiểm tra dữ liệu/IMO/sea time → chọn chủ tàu và mẫu → người có quyền duyệt → xuất XLSX thật.

Yêu cầu của chủ dự án: toàn bộ chức năng trong phạm vi phải hoạt động thật. Bản kế hoạch này thay thế các đề xuất dựng demo, AI giả và luồng trình diễn trong kế hoạch trước.

- Không triển khai FakeProvider, bộ đọc fixture, nhận diện file để trả kết quả soạn sẵn, DEMO_MODE thay nghiệp vụ, trạng thái thành công giả, tài khoản bỏ qua xác thực hoặc nút bấm chỉ đổi UI.
- Không giới hạn chức năng vào một hồ sơ, một bộ sổ, 9 chuyến hoặc tên file cụ thể. Phải xử lý được tài liệu mới thuộc loại hỗ trợ, nhiều hồ sơ và số chuyến thay đổi.
- Không coi seed dữ liệu, screenshot, prototype hay unit test dùng mock là bằng chứng chức năng đã chạy thật.
- Dữ liệu synthetic được phép dùng làm đầu vào kiểm thử; vẫn phải đi qua upload, AI, DB, rules, duyệt và export thật. Mock chỉ được dùng trong automated test để kiểm tra lỗi/nhánh logic, không có đường chạy mock trong ứng dụng.
- Thiếu key, model không dùng được, provider lỗi, thiếu mẫu hoặc thiếu dữ liệu phải báo đúng lỗi. Không fallback sang dữ liệu giả.
- “Chức năng thật 100%” là yêu cầu về triển khai và luồng vận hành. AI có thể đọc sai hoặc không đọc được; phải giữ UNKNOWN, truy nguồn và để con người duyệt. Không cam kết AI chính xác 100%.
- Không tự cắt yêu cầu để kịp lịch. Hạng mục thiếu đầu vào ghi BLOCKED với đầu vào cụ thể; tiếp tục phần độc lập. Chỉ đánh dấu DONE khi đủ bằng chứng nghiệm thu.

## 2. Ranh giới hệ thống

1. `Crew-Manning/` là legacy và giữ nguyên. Không sửa code, schema, dữ liệu, cấu hình, menu, chức năng hoặc deployment của hệ thống đó.
2. Tất cả thay đổi MCAH nằm trong `seasmart/`. Có thể thay đổi mã kế thừa trong bản sao này khi phục vụ MCAH; phải kiểm tra phần liên quan và không đồng bộ ngược sang legacy.
3. MCAH có DB, upload, tài khoản ứng dụng và cấu hình riêng. Trước mọi migration/import phải xác nhận đích là MCAH. Không dùng reset phá dữ liệu cho quy trình cài đặt.
4. Lịch sử đi tàu dùng `sea_service` riêng. Không sửa hợp đồng/payroll legacy để giải quyết nghiệp vụ này.
5. Tái dùng Fastify, React, Ant Design/UI Kit, auth và tiện ích Excel. Không đổi stack trong đợt này.
6. Menu MCAH tập trung vào hồ sơ, tài liệu/duyệt, lịch sử đi tàu, bản xuất, danh mục và quản trị. Các module đào tạo/QR/waitlist/tin nhắn kế thừa không nằm trong luồng MCAH.

## 3. Phạm vi bàn giao

### 3.1 Bắt buộc trong đợt này

- Một agency trên một instance, nhiều người dùng có vai trò và quyền API rõ ràng.
- PDF/JPG/PNG; PDF nhiều trang có nhiều loại trang và nhiều chuyến đi tàu. Giới hạn đầu vào ban đầu: 25 MB/tệp, 50 trang/PDF, kiểm tra ở backend.
- AI thật cho trang thông tin sổ thuyền viên và trang ghi lịch sử đi tàu. Các bộ đọc giấy tờ khác đã có phải giữ hoạt động, nhưng chưa mở rộng thành compliance engine.
- Import Excel hồ sơ/lịch sử đi tàu theo schema chuẩn có preview, validation và xác nhận; dữ liệu import cũng có nguồn và revision.
- Review từng trường, UNKNOWN/ngày mơ hồ, lý do sửa, truy trang nguồn và xử lý xung đột.
- Hồ sơ canonical, revision tăng đơn điệu, audit, optimistic lock, sea service và đối chiếu tàu có lưu bằng chứng.
- Sea time, bốn rule dữ liệu/tàu và readiness trong phạm vi.
- Hai loại đầu ra: CV có service records và Crew List nhiều người. Mẫu/mapping version hóa; contact policy; preview, duyệt, phát hành và STALE.
- Cài mới, nâng cấp DB MCAH, kiểm thử tích hợp thật, backup/restore và tài liệu vận hành.

### 3.2 Ngoài đợt này

Multi-tenant, assignment draft, onboarding mẫu tùy ý qua UI, dashboard riêng, chứng nhận compliance STCW/MLC, visa, payroll, quản lý điều động và mở rộng ký/SMS. Không tích hợp registry bên ngoài trong đợt này; đối chiếu bằng danh mục có nguồn và bằng chứng thủ công thật.

Đây là phạm vi MVP vận hành một agency. Các mục SRS ngoài phạm vi trên vẫn là công việc còn lại, không được báo là đã hoàn thành toàn bộ SRS. Hai mẫu cấu hình sẵn vẫn là chức năng xuất thật; không hứa hỗ trợ mọi file Excel.

## 4. Baseline và điểm cần xác minh

| Phần | Bằng chứng trong code | Thiếu hoặc cần xác minh |
|---|---|---|
| Upload/AI | `document.service.js`, `document_reader.service.js` | AI SDK/model hiện tại chưa được kiểm chứng bằng request thật; chưa có xử lý đầy đủ nhiều trang/chuyến |
| Review | `ReviewPage.jsx`, `document_field` | Lý do sửa từng ô, nguồn theo trang có cấu trúc, version và xung đột |
| Mapping danh tính | `document_types.js` | Một số ô tên/nơi sinh/quốc tịch chưa có target; ô “ID hoặc passport” đang đẩy vào national_id, cần phân loại đúng |
| Đi tàu | Khuôn `seaman_book_duty` | `publish()` chưa tạo sea service; “cảng + ngày” đang chung chuỗi, cần tách dữ liệu có cấu trúc |
| Tàu | `fleet.service.js`, `VesselMatchPanel.jsx`, `imo.js` | Lưu lựa chọn/bằng chứng/trạng thái vào DB; không tự coi ứng viên đầu là đã xác nhận |
| Revision | Migration `020`, `seafarer.service.js` | Hiện là log changes; cần snapshot aggregate và version cho hồ sơ + sea service |
| Xuất | `export_pack.service.js`, `pack_templates.js` | CV có formKey null; luồng đang gắn giấy nội bộ/ký; download đang đọc hồ sơ hiện tại; STALE chưa áp bản DONE |
| Import | `import.service.js` | Import hiện gắn schema legacy, cần intake MCAH có preview và nguồn |
| Test | Backend 34 test pass; frontend 34 test pass nhưng lệnh tổng fail do `demoDocs.js` | Thiếu integration DB, E2E nghiệp vụ và request AI thật |
| Build/lint | Build pass, lint 0 lỗi/15 cảnh báo ở lần rà soát | Cần kiểm lại sau thay đổi; chưa nghiệm thu vận hành |

Các kết quả test là tại thời điểm rà soát 09/10/2026. Không coi bảng này là xác nhận API/DB/UI đã chạy hết luồng.

## 5. Quy ước triển khai để các LLM dùng chung

- Đọc hướng dẫn repo áp dụng, `git status`, diff và source liên quan trước mỗi task; giữ nguyên thay đổi của người khác.
- Chỉ triển khai task được giao và dependency đã được cho phép. Nếu toàn bộ kế hoạch được giao, làm theo thứ tự mục 7.
- Mỗi task đi hết migration/model → service → API/validation/quyền → UI → kiểm thử → tài liệu. Không đánh dấu xong khi mới dựng UI.
- Tên file dưới đây là điểm bắt đầu/đề xuất. Tái dùng tương đương đã có, không tạo service/bảng song song cùng nghĩa. Ghi quyết định trước khi đổi contract dùng chung.
- Thêm migrations mới sau phiên bản hiện tại; không sửa migration đã áp để cập nhật schema. Có kiểm thử đường cài sạch và nâng cấp, không mất dữ liệu.
- Backend là nơi quyết định validation, quyền, rules, policy, version và phát hành. Frontend chỉ thể hiện và gửi yêu cầu; không được bypass bằng gọi API trực tiếp.
- Task chưa xong giữ TODO/IN_PROGRESS/BLOCKED. Ghi kết quả trong file `docs/mcah-implementation-status.md` khi bắt đầu triển khai: task, trạng thái, commit, kiểm thử, giới hạn và đầu vào còn thiếu.
- Khi bàn giao mỗi task: liệt kê file/schema/API đổi, cách chạy, test thực hiện và kết quả. Kiểm thử chưa chạy phải ghi rõ lý do; không dùng kết quả mock để nhận là integration thật.

## 6. Danh sách task thực thi

### MCAH-00 Baseline và môi trường độc lập

Phụ thuộc: không. Effort dự kiến: 2–3 ngày.

Điểm bắt đầu: `backend/src/config/`, `backend/server.js`, `migration.sql`, `backend/migrations/`, package scripts, Vitest config.

Việc phải làm:
- Lập ma trận quyền: admin quản trị; operator nhập/review/tạo và gửi duyệt; reviewer đọc/review/duyệt hoặc trả lại; người tạo không tự duyệt. Vai kế thừa không mặc nhiên có quyền MCAH.
- Chốt DB engine/version bằng chạy thực tế, tạo migration runner có bảng lịch sử và bootstrap admin từ env. Không seed hồ sơ cá nhân trong cài đặt mặc định.
- Kiểm tra cấu hình DB/upload riêng MCAH, validate env, health/readiness; thiếu cấu hình AI hiển thị đúng trạng thái.
- Sửa Vitest nhận nhầm fixture `demoDocs.js`; CI chạy lint/test/build. Không sửa assertion để che lỗi.
- Smoke test các route hiện có, ghi chỗ gãy và baseline. Kiểm tra API đọc/xuất danh sách, chi tiết, nguồn, link tải và quyền reviewer.

Nghiệm thu:
- DB trống cài được; chạy migrate lại không chạy lặp migration đã áp; nâng cấp DB MCAH hiện có không mất dữ liệu.
- Tài khoản bootstrap đăng nhập thật; test quyền API trả 401/403 đúng; toàn bộ test/lint/build chạy thành công.
- Không có file hoặc kết nối DB/upload Crew Manning bị thay đổi.

### MCAH-01 Mô hình dữ liệu và API contract

Phụ thuộc: 00. Effort: 2–3 ngày.

Đầu ra: `docs/mcah-data-api-contract.md`, migrations mới và schema validation thống nhất.

Việc phải làm:
- Định nghĩa thực thể nguồn tài liệu/trang, extraction run và job, proposal, review decision, sea_service, vessel verification, profile revision, audit, owner template/policy và export.
- Dùng lại `seafarer_document`, `document_field`, `seafarer_revision` khi phù hợp; giải quyết khóa field để PDF có thể có nhiều trang/cùng loại/nhiều bản ghi.
- Proposal phải giữ raw/value, trạng thái, missing_reason, source document/page, field critical và phiên bản schema. Trang ảnh đôi là một trang tệp; nhãn số trang in trên sổ lưu riêng.
- Sea service giữ raw tên tàu/chức danh, FK đã đối chiếu, cảng lên/xuống, ngày chuẩn/độ chắc chắn, ongoing, nguồn và version.
- Revision là snapshot aggregate hồ sơ + sea service + tham chiếu nguồn liên quan. Audit có actor, action, before/after, reason và timestamp.
- Chốt request/response, error code, pagination, lock_version/expected_revision và idempotency cho mutation.
- Chốt state machine tài liệu/job, review, verification và export; migration dữ liệu cũ sang cấu trúc mới nếu cần.

Nghiệm thu:
- Schema hỗ trợ cùng PDF chứa trang thông tin và nhiều chuyến mà không ghi đè field.
- Contract mô tả đủ API cho các task sau, unique/FK/index và transaction boundary.
- Migrations chạy trên DB mục tiêu; test constraint chống bản ghi trùng và quan hệ nguồn không hợp lệ.

### MCAH-02 Tiếp nhận tài liệu và worker bền vững

Phụ thuộc: 01. Effort: 3–4 ngày.

Điểm bắt đầu: `document.service.js`, `document.routes.js`, `CrewDropzone.jsx`, `DocumentViewer.jsx`. Worker DB đề xuất trong `backend/src/jobs/`.

Việc phải làm:
- Kiểm nội dung tệp, kích thước, PDF hợp lệ, số trang; từ chối PDF mã hóa/không đọc được với lỗi rõ.
- Lưu bản gốc private bất biến và sha256; tách/render trang phục vụ bằng chứng, không làm mất liên kết về PDF gốc.
- Deduplicate theo nội dung trong cùng hồ sơ; upload lại trả tham chiếu đã có. Không tiết lộ tài liệu của hồ sơ khác.
- Lưu job trong DB, claim job bằng lock/lease, giới hạn concurrency; sau restart không để READING treo vĩnh viễn. Không chỉ dùng setImmediate làm nguồn trạng thái duy nhất.
- API list/detail/source/retry và UI tiến trình lấy trạng thái thật. Chỉ báo bước đang chạy; không dùng animation giả như bằng chứng AI đã đối chiếu.
- File lỗi phải được dọn/ghi nhận nhất quán nếu DB insert thất bại; không nhận đường dẫn tùy ý từ client.

Nghiệm thu:
- JPG/PNG/PDF nhiều trang upload thật, viewer tới đúng trang.
- Upload trùng không tạo job/chuyến trùng; tệp quá giới hạn/hỏng được từ chối.
- Restart giữa xử lý có thể tiếp tục/retry đúng chính sách; API nguồn từ chối người không có quyền.

### MCAH-03 Trích xuất AI thật

Phụ thuộc: 01, 02. Effort: 3–5 ngày. Đầu vào bắt buộc: API key hợp lệ và quyền dùng model.

Điểm bắt đầu: `document_reader.service.js`, `document_types.js`, worker của 02.

Việc phải làm:
- Dùng Anthropic thật hiện có; kiểm chứng SDK/model/options với provider trước khi chốt config. Không mặc định model ghi trong code là đang tồn tại/được cấp quyền.
- Tách system instruction khỏi nội dung tài liệu; tài liệu là dữ liệu, không phải chỉ dẫn. JSON schema chặt và validate lại ở backend.
- Hỗ trợ nhiều trang/nhiều loại/nhiều chuyến: xử lý theo trang hoặc batch có page ID ổn định. Tách ship/rank/sign_on/sign_off/port thay vì giữ “cảng + ngày” làm dữ liệu canonical.
- Giữ chữ gốc và nguồn, chuẩn hóa ngày/chức danh có giải thích; thiếu/khó đọc trả UNKNOWN hoặc DATE_AMBIGUOUS và missing_reason. Không tự bổ sung IMO khi giấy không có.
- Phân loại đúng số CMND/CCCD và hộ chiếu; không đổ mọi giá trị vào national_id. Map đủ field danh tính đã hỗ trợ.
- Lưu request/run ID, model/schema/prompt version, latency, usage provider trả về và lỗi; không ghi key hoặc toàn bộ PII vào log vận hành.
- Timeout, tối đa 3 lần thử cho lỗi transient; không retry vô hạn lỗi quyền/đầu vào. Retry tạo run mới và giữ lịch sử/decision cũ.

Nghiệm thu:
- Upload tài liệu mới không nằm trong test data, AI trả đề xuất thật và lưu được vào DB. Có request/run metadata làm bằng chứng.
- Một PDF có trang thông tin và nhiều chuyến trả đúng cấu trúc số bản ghi thực tế; không hard-code số chuyến.
- Thiếu key/provider lỗi/schema sai báo lỗi thật. Không có đường fallback fixture.
- Ghi nhận lỗi đọc/UNKNOWN trên tài liệu khó để xử lý ở review; AI sai không tự lọt vào dữ liệu đã duyệt.

### MCAH-04 Review có bằng chứng và chống xung đột

Phụ thuộc: 03. Effort: 3–4 ngày.

Điểm bắt đầu: `ReviewPage.jsx`, `ReviewField.jsx`, `document.service.js`, `document.routes.js`.

Việc phải làm:
- Hiển thị raw/đề xuất/giá trị đang duyệt cạnh nguồn; click field mở đúng trang. Nháp và quyết định lưu thật, tải lại không mất.
- Cho accept/edit/reject/keepUnknown; edit bắt buộc reason. Trường trọng yếu phải có quyết định của người dùng, confidence không thay thế duyệt.
- Chặn chấp nhận ngày mơ hồ thành ngày chắc chắn mà chưa sửa/xác nhận rõ. Thiếu sign off không tự thành ongoing.
- Nhiều nguồn cùng đề xuất một field khác nhau phải hiện conflict và yêu cầu chọn giá trị kèm lý do; không Object.assign để nguồn cuối thắng.
- Optimistic lock ở API; hai người sửa cùng version thì một người nhận 409. Tài liệu đã publish không bị sửa ngầm; thay đổi tạo lượt/revision có truy vết.
- Không thêm bulk accept trong đợt này.

Nghiệm thu:
- Field đã duyệt truy được người/thời điểm/lý do/nguồn; UNKNOWN còn rõ sau reload.
- Có test conflict giữa hai tài liệu và giữa hai người; không mất bản nháp hoặc ghi đè im lặng.
- API trực tiếp cũng không vượt qua yêu cầu reason/critical review.

### MCAH-05 Sea service và công bố hồ sơ chuẩn

Phụ thuộc: 01, 04. Effort: 3–4 ngày.

Điểm bắt đầu: `document.service.js:publish`, `seafarer.service.js`, `SeafarerDetailPage.jsx`; thêm `sea_service.service.js` và routes tương ứng.

Việc phải làm:
- Ánh xạ trang đi tàu đã duyệt vào sea_service; ngày bố trí khác ngày xuống tàu. Chuẩn hóa raw rank qua taxonomy, không tự đoán chức danh chưa biết.
- Công bố dữ liệu cá nhân/chuyến/nguồn/revision/audit/trạng thái tài liệu trong transaction.
- Version check cùng transaction; publish lặp hoặc request gửi lại không tạo trùng nhờ unique/idempotency.
- CRUD chuyến có reason, nguồn và version. Nhập tay là chức năng thật có source_type MANUAL và audit, không giả là dữ liệu AI.
- Hồ sơ mới có thể được tạo từ trang thông tin đã duyệt hoặc gắn vào hồ sơ đang có; luôn xác nhận danh tính trước khi ghi. Không tự merge người.
- Tab Đi tàu đọc sea_service; lịch sử hiển thị revision tổng thể và link nguồn.

Nghiệm thu:
- N trang/chuyến đã duyệt tạo đúng N chuyến của đúng người; không phụ thuộc employment_contract.
- Gây lỗi giữa transaction không để hồ sơ/chuyến/tài liệu ở trạng thái ghi dở.
- Sửa/xóa chuyến tăng revision; publish lặp không nhân đôi; conflict danh tính không ghi đè tự động.

### MCAH-06 Danh mục và đối chiếu tàu có bằng chứng

Phụ thuộc: 01, 05. Effort: 2–3 ngày.

Điểm bắt đầu: `fleet.service.js`, `fleet.routes.js`, `VesselMatchPanel.jsx`, `imo.js`.

Việc phải làm:
- Bổ sung field CV cần: IMO, tên/alias, GT, DWT, năm đóng, loại tàu, cờ, chủ tàu, máy chính, công suất, vùng hoạt động khi có nguồn.
- Tìm IMO trước; tên/GT/cờ chỉ xếp ứng viên. Người dùng phải chọn/xác nhận, không lưu ứng viên mặc định như quyết định.
- Lưu trạng thái NOT_CHECKED/VERIFIED/CONFLICT/NOT_FOUND/UNAVAILABLE, evidence type/source/reference, người/thời điểm và phiên bản dữ liệu đối chiếu.
- VERIFIED cần nguồn/bằng chứng; checksum đúng chỉ chứng minh định dạng số IMO.
- Cho đính nguồn thủ công thật; file evidence private, có quyền truy cập. Thiếu nguồn giữ NOT_CHECKED/NEEDS_REVIEW.
- Không bịa thông số thiếu từ fixture. Sửa danh mục liên quan phải được nhận biết bởi kiểm tra và bản xuất.

Nghiệm thu:
- Reload giữ đúng tàu đã chọn, evidence và raw tên trong sổ.
- Test IMO sai, tên trùng, không tìm thấy, mâu thuẫn thông số; trạng thái và lý do đúng.
- Mọi thông số được đưa vào CV có nguồn hoặc để trống với lý do.

### MCAH-07 Sea time và rules backend

Phụ thuộc: 05, 06. Effort: 2–3 ngày.

Điểm bắt đầu đề xuất: `utils/sea_time.js`, `services/profile_check.service.js`; thay logic readiness tự tính ở frontend bằng API.

Việc phải làm:
- Đơn vị chuẩn là ngày theo date-only. Khoảng đóng = sign_off − sign_on + 1; union overlap không cộng trùng; ongoing chỉ khi người duyệt xác nhận và tính tới as_of.
- Ngày mơ hồ/thiếu không tính vào tổng xác định; trả danh sách bị loại, phần tạm tính và tổng theo chức danh.
- Khi khoảng khác chức danh chồng nhau, tổng toàn bộ vẫn union; tổng từng chức danh tính riêng và ghi không được cộng chúng thành tổng toàn bộ.
- Chốt quy ước tháng với domain lead trước nghiệm thu CV; không tự lấy days/30 làm quy tắc nghiệp vụ.
- Chạy DQ_REQUIRED_CRITICAL, DQ_DATE_ORDER, DQ_OVERLAP, VES_EVIDENCE với code, severity, source và action cần sửa.
- BLOCKED khi thiếu trọng yếu/ngày không hợp lệ/chưa duyệt trọng yếu; NEEDS_REVIEW khi còn overlap hoặc thiếu evidence; READY_IN_SCOPE khi không còn lỗi/cảnh báo chưa xử lý trong scope.
- Đợt này chỉ cho phát hành khi READY_IN_SCOPE; không có nút bỏ qua kiểm tra. Tái kiểm tại gửi duyệt/phát hành với revision/as_of cụ thể.
- UI dùng nhãn “Sẵn sàng hồ sơ trong phạm vi MVP”, ghi các lĩnh vực chưa đánh giá.

Nghiệm thu:
- Unit test ngày một ngày, năm nhuận, khoảng lồng/chồng, ongoing, ngày tương lai, ngày thiếu/mơ hồ và thứ tự sai.
- API rules nhất quán với UI và gate export; sửa dữ liệu tính lại.
- Không dùng chứng chỉ hết hạn để tự kết luận compliance toàn diện.

### MCAH-08 Import Excel MCAH có preview

Phụ thuộc: 01, 05, 07. Effort: 2–3 ngày.

Điểm bắt đầu: `import.service.js`, `SeafarerImportPage.jsx`; thêm schema/template intake MCAH riêng.

Việc phải làm:
- Cung cấp template chuẩn cho hồ sơ và sea service; cột bắt buộc/kiểu dữ liệu/định danh người rõ ràng.
- Upload lưu file nguồn; preview báo lỗi theo sheet/row/column, parse ngày Excel đúng, không thực thi formula từ đầu vào.
- Chưa commit trước khi người dùng xác nhận. Không tự tạo/merge người chỉ vì tên giống.
- Chống import lặp; ghi source_type EXCEL và tọa độ ô/dòng; mọi update đi qua revision/audit/rules như nhập tay.
- Các giá trị critical chưa xác nhận được đưa vào review; không mặc nhiên thành approved vì đến từ Excel.

Nghiệm thu:
- File hợp lệ import thật, file lỗi có preview và không ghi dở; gửi confirm lặp không tạo trùng.
- Sau import người dùng truy được ô nguồn; sea time/rules/export dùng được dữ liệu đã duyệt.

### MCAH-09 Hai mẫu XLSX và chính sách liên lạc

Phụ thuộc: 06, 07. Effort: 4–5 ngày. Đầu vào bắt buộc: hai mẫu được phép dùng và mapping nghiệp vụ.

Điểm bắt đầu: `form_export.service.js`, `pack_templates.js`, `PackCreatePage.jsx`, `A4Preview.jsx`; đề xuất `backend/templates/owner/` và service owner export riêng.

Việc phải làm:
- Triển khai hai loại mẫu: CV chứa service records và Crew List nhiều người. Mẫu là file thật trong repo/deployment; thiếu mẫu báo lỗi, không trả XLSX trống.
- Làm sạch mẫu tham khảo; mapping version gồm field/ô, vùng lặp, kiểu số/ngày, chứng chỉ, giới hạn chuyến, contact fields.
- Quy tắc chọn chuyến cấu hình: mặc định đề xuất 5 chuyến gần nhất nếu mẫu có 5 cột, nhưng phải xác nhận domain lead trước bàn giao. Preview ghi phần bị loại, không mất dữ liệu hồ sơ.
- Tạo policy theo chủ tàu: CREW_CONTACT / HIDE / AGENCY_CONTACT. Áp tại backend cho toàn bộ vùng/field đã phân loại, gồm người liên hệ khẩn cấp nếu nằm trong scope policy.
- Đảm bảo dữ liệu bị ẩn không còn trong sheet ẩn, comment, ô ngoài vùng, metadata hoặc ảnh nguồn nhúng.
- Preview và XLSX dùng chung mô hình export đã áp policy, cùng snapshot/version. Giữ ô gộp, kiểu số/ngày và chặn formula injection.
- Chứng chỉ hiện có có thể map vào CV; thiếu thông tin hiển thị thiếu, không bịa ngày/số.

Nghiệm thu:
- Tải CV/Crew List thật, điền đúng hồ sơ mới và nhiều người, mở được bằng Excel/WPS.
- Đổi chủ tàu/policy làm đầu ra đúng; kiểm nội dung workbook xác nhận không còn dữ liệu bị ẩn.
- Test vượt số chuyến, thiếu thông số, Unicode, dữ liệu bắt đầu bằng ký tự công thức và lỗi mẫu.

### MCAH-10 Duyệt phát hành từ snapshot và STALE

Phụ thuộc: 09. Effort: 3–4 ngày.

Điểm bắt đầu: `export_pack.service.js`, `export_pack.routes.js`, `ExportListPage.jsx`, `PackSignPage.jsx`.

Việc phải làm:
- Tách workflow owner export khỏi giấy nội bộ cần ký: DRAFT → PENDING_APPROVAL → RELEASED; nhánh REJECTED/STALE. Ký/SMS không là điều kiện tải CV/Crew List.
- Tạo snapshot gồm profile revision, sea service, kết quả checks/as_of, thông số tàu, template/mapping/policy versions. Crew List giữ revision từng người.
- Chỉ reviewer/admin đúng quyền và khác người tạo được duyệt; reject bắt buộc reason. Phê duyệt gắn đúng snapshot, không cho thay payload sau duyệt.
- Trước release kiểm version và readiness trong transaction/lock; sửa đồng thời không lọt bản cũ thành hiện hành.
- Tạo file từ snapshot, lưu artifact/hash bất biến; không sinh download bằng query hồ sơ hiện tại.
- Hồ sơ/chuyến/danh mục liên quan/mapping/policy đổi làm bản phụ thuộc thành STALE, kể cả RELEASED. Quy định ảnh hưởng theo dependency, không đánh stale mọi bản không liên quan.
- as_of/ongoing phải có hạn hiệu lực kiểm tra rõ; tái tính trước release và khi xác định bản hiện hành.
- Bản cũ được lưu lịch sử và tải ở quyền truy vết với nhãn stale; không sửa file đã phát hành và không tự gửi ra ngoài.

Nghiệm thu:
- Gọi API trực tiếp không tự duyệt/đổi snapshot/bypass rules được.
- Preview đã duyệt khớp file; sửa hồ sơ sau release không đổi byte của artifact cũ, nhưng trạng thái thành STALE.
- Crew List stale khi một người liên quan đổi; thay hồ sơ không liên quan không tác động.
- Test race giữa cập nhật và release, reject/tạo lại và snapshot không phụ thuộc dữ liệu hiện tại.

### MCAH-11 Kiểm thử tích hợp thật và chất lượng extraction

Phụ thuộc: 02–10. Effort: 3–4 ngày; viết test theo từng task, không đợi đến cuối.

Việc phải làm:
- Bộ tài liệu nghiệm thu được phép dùng, có bản đọc chuẩn do người rà: ảnh rõ/khó, trang trống, PDF nhiều loại trang, nhiều hồ sơ, số chuyến thay đổi, ngày mơ hồ/overlap và tên tàu gần giống.
- Dành một tập chưa dùng điều chỉnh prompt để kiểm tài liệu mới. Ghi số trang/field, lỗi critical, coverage/UNKNOWN, correction, latency, usage/chi phí có căn cứ.
- Chạy live provider với key thật và DB thật; E2E browser review/publish/checks/owner preview/reviewer release/download/change/stale.
- Tách test CI dùng mock khỏi live integration cần key. Live test fail/không chạy phải hiện rõ, không đánh dấu pass.
- Báo cáo chất lượng thực đo; domain lead xác nhận ngưỡng chấp nhận trước release. Không tự nhận mức chính xác từ vài tài liệu đẹp.
- Đối chiếu SRS AT-01…AT-14 bằng bảng: đạt/còn thiếu/ngoài phạm vi, kèm bằng chứng. Không bỏ tiêu chí khỏi báo cáo để nhận là đạt SRS.

Nghiệm thu:
- Một hồ sơ/tài liệu mới đi trọn luồng thật, không sửa DB tay hoặc dựa tên file/fixture.
- Các ca E01–E12 mục 8 có kết quả; lỗi trọng yếu không còn lọt publish/release.
- Báo cáo có kết quả live provider và người nghiệm thu chất lượng. Thiếu key hoặc chưa chốt ngưỡng: task chưa DONE.

### MCAH-12 Đóng gói vận hành và bàn giao

Phụ thuộc: 11. Effort: 2–3 ngày.

Việc phải làm:
- README cài/chạy/nâng cấp, env example không có secret, model config, giới hạn tài liệu, worker, retry và xử lý sự cố.
- Health/readiness, log lỗi và số job thất bại/chờ; quota/concurrency và giới hạn chi phí cấu hình cho AI.
- Script backup/restore DB + nguồn + artifact có kiểm tra tính nhất quán; diễn tập restore trên môi trường MCAH riêng.
- Chuẩn bị triển khai môi trường mục tiêu, HTTPS khi truy cập qua mạng, upload private và persistent storage, restart worker có khôi phục.
- Tài liệu sử dụng theo vai: tạo hồ sơ, nhận giấy, review, nhập tay/Excel, kiểm tra, tạo/duyệt bản xuất, xử lý STALE.
- Trình bày hệ thống bằng cùng build và cùng chức năng vận hành. Không có bản demo nghiệp vụ riêng.

Nghiệm thu:
- Từ môi trường MCAH sạch cài được bằng tài liệu; sau restart/restore vẫn có nguồn, revision, quyết định và file.
- Smoke test sau triển khai đi trọn luồng với provider thật; biến môi trường thiếu báo đúng.
- Bàn giao danh sách giới hạn, SRS còn thiếu và đầu vào chưa giải quyết. Không ảnh hưởng Crew Manning.

## 7. Thứ tự và thời gian dự kiến

Thứ tự mặc định: 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12.

Có thể chuẩn bị mẫu/mapping của 09 và tập nghiệm thu của 11 ngay sau 01. Chỉ chạy song song tác vụ độc lập nếu thống nhất API/schema và không sửa trùng file. Mỗi task đóng lại bằng kiểm thử trước khi chuyển tiếp.

Tổng effort dự kiến 34–48 ngày làm việc cho một người full-time có trợ lý coding, khoảng 7–10 tuần. Đây là ước lượng lập kế hoạch, chưa bao gồm thời gian chờ key, mẫu, dữ liệu có quyền sử dụng và domain lead nghiệm thu.

| Mốc | Task | Điều kiện đạt |
|---|---|---|
| M0 Nền chạy thật | 00–03 | Cài độc lập, upload tài liệu mới, provider thật đọc/lưu kết quả |
| M1 Hồ sơ có nguồn | 04–06 | Review/publish có version; sea service và evidence lưu thật |
| M2 Kiểm tra và intake | 07–08 | Sea time/rules đúng; Excel preview/confirm có nguồn |
| M3 Phát hành hồ sơ | 09–10 | Hai mẫu, policy, reviewer, immutable artifact và STALE |
| M4 Bàn giao | 11–12 | Live E2E, báo cáo chất lượng, triển khai/restore và tài liệu đạt |

Nếu phát sinh, cập nhật effort và dependency; không thay AI bằng fixture hay cắt các bước kiểm soát để nhận mốc hoàn thành.

## 8. Ca nghiệm thu xuyên suốt

| ID | Thao tác | Kết quả phải chứng minh |
|---|---|---|
| E01 | Upload tài liệu mới | AI thật gọi provider, đề xuất/lần chạy/trang nguồn lưu DB |
| E02 | PDF nhiều trang/nhiều loại | Đúng nguồn từng field, không mất/chồng bản ghi |
| E03 | Thiếu key, AI lỗi, restart worker | Trạng thái/lỗi thật; retry/khôi phục không nhân bản dữ liệu |
| E04 | Ô mờ, ngày mơ hồ, thiếu ngày rời | UNKNOWN cần xử lý; không tự đoán hoặc tự gắn ongoing |
| E05 | Hai nguồn mâu thuẫn/hai người sửa | Chọn giá trị có reason; version sai trả 409 |
| E06 | Publish lặp và lỗi giữa transaction | Không trùng chuyến, không ghi dở; revision đúng |
| E07 | Tên tàu gần giống/IMO sai/evidence thiếu | Không tự verified; người dùng sửa hoặc bổ sung nguồn |
| E08 | Sea time và rules | Tổng union đúng, ngày sai bị chặn, unresolved review không release |
| E09 | Excel preview/confirm | Lỗi theo ô, không ghi trước confirm, source/review/audit đầy đủ |
| E10 | CV + Crew List, ba policy | XLSX đúng mẫu/kiểu; không rò field bị ẩn |
| E11 | Reviewer release rồi sửa dữ liệu | Maker khác checker; file bất biến; bản phụ thuộc STALE |
| E12 | Cài mới, nâng cấp và restore | Hệ thống MCAH độc lập hoạt động; legacy không bị thay đổi |

Lưu bằng chứng trong `docs/verification/`: lệnh và kết quả, API/status, report live provider, ảnh màn hình cần thiết và kiểm tra XLSX. Không commit key hoặc hồ sơ cá nhân chưa được phép.

## 9. Đầu vào cần cung cấp và xử lý khi thiếu

| Đầu vào | Dùng ở đâu | Nếu thiếu |
|---|---|---|
| Anthropic key, quyền model, hạn mức chi phí | 03, 11, 12 | Ghi BLOCKED cho live extraction; tiếp tục schema/UI/test độc lập, không tạo fake provider |
| Tài liệu sổ có quyền dùng và bản đọc chuẩn | 03, 11 | Có thể dùng tài liệu synthetic làm input thật; chưa nghiệm thu chất lượng tài liệu thực tế |
| CV và Crew List được phép dùng | 09 | Tiếp tục engine/API độc lập; mapping và nghiệm thu mẫu vẫn BLOCKED |
| Quy tắc field critical, ngày ongoing, tháng CV, chọn chuyến | 04, 07, 09 | Ghi lựa chọn cần domain lead xác nhận; không tự tạo ngày/giá trị để xuất |
| Nguồn thông số tàu và người xác nhận | 06 | Cho nhập/đính bằng chứng; dữ liệu thiếu ở NOT_CHECKED, không tự verified |
| Chủ tàu, agency contact, quyền người dùng | 00, 09, 10 | Tạo cấu hình quản trị thật; không hard-code thông tin công ty tham khảo |
| Môi trường triển khai và quyền truy cập | 12 | Hoàn thiện gói local và hướng dẫn; chưa nhận đã triển khai môi trường đích |
| Ngưỡng chất lượng extraction và người nghiệm thu | 11 | Báo cáo số liệu đo được, giữ trạng thái chưa nghiệm thu |

Việc có đầu vào thiếu không cho phép bỏ kiểm soát hoặc báo hoàn tất. Khi cần quyết định nghiệp vụ, nêu lựa chọn và tác động cụ thể; tiếp tục các việc không phụ thuộc.

## 10. Prompt giao cho Codex hoặc Claude Code

Sao chép đoạn dưới, thay TASK_ID hoặc giao “toàn bộ kế hoạch”.

> Triển khai TASK_ID theo docs/mcah-ke-hoach-lam-tiep.md trong seasmart. Đọc toàn bộ kế hoạch, hướng dẫn repo và git status trước khi sửa. Crew-Manning là legacy giữ nguyên; DB/upload MCAH phải riêng. Chỉ dùng chức năng thật: không FakeProvider, DEMO_MODE thay nghiệp vụ, fixture trả extraction hay thành công giả. Đọc source và kiểm tra dependency task trước, rồi hoàn thành migration/service/API/quyền/UI/kiểm thử/tài liệu theo tiêu chí nghiệm thu. Mock chỉ trong automated test, không chứng minh live integration. Không tự sửa thay đổi người khác, không xóa dữ liệu và không push/deploy khi chưa được yêu cầu. Nếu thiếu key/mẫu/quyết định nghiệp vụ, ghi rõ BLOCKED và tiếp tục phần độc lập. Cập nhật docs/mcah-implementation-status.md với kết quả và bằng chứng thật. Kết thúc báo file đổi, cách chạy, test pass/fail/chưa chạy và phần còn thiếu. Không nhận DONE khi mới có code hoặc screenshot.

Nếu giao toàn bộ kế hoạch, LLM làm theo dependency tới khi các task hoàn thành hoặc có đầu vào thật sự đang chặn; không tự thu hẹp phạm vi thành bản trình diễn.
