# MCAH-01 — data và API contract v2

Chốt ngày 09/10/2026, kế hoạch phiên bản 2; baseline HEAD `6745e8f`. Migration mới `022_mcah_data_contract.sql`, MariaDB 11.8.6/InnoDB/utf8mb4. Đây là schema và contract cho MCAH-02…10; các endpoint `/api/v1/mcah/*` dưới đây **chưa được mount** ở MCAH-01. Không nhận là đã có worker, extraction, review/publish v2, rules hay owner export hoạt động. API kế thừa vẫn chạy, tài liệu schema v2 bị chặn mutation qua API field-key v1 bằng 409 để tránh mất proposal. Không thay auth, không bypass và không gọi provider trong task này.

## Quyết định mô hình

| Thực thể | Bảng và quyết định |
|---|---|
| Hồ sơ canonical | Tái dùng `seafarer`; thêm `aggregate_revision` và `lock_version`. Chưa tạo hồ sơ canonical khi chưa xác nhận danh tính/critical; proposal có thể UNKNOWN dù canonical còn NOT NULL. Không điền ngày/quốc tịch giả để vượt NOT NULL. |
| Nguồn | Tái dùng `seafarer_document`; source_type DOCUMENT/EXCEL/MANUAL, hash SHA-256, page_count, schema_version, lock_version. File bất biến/private; sha256 NULL cho nguồn cũ chưa hash và MANUAL. seafarer_id nullable cho intake chưa xác nhận người; v2 unbound bắt buộc created_by, chỉ creator/admin truy cập. UNIQUE generated `(unbound_creator_id,sha256)` dedup trong intake của cùng creator, không lộ tài liệu người khác. Không hash/đọc/di chuyển file cũ trong migration. UNIQUE `(seafarer_id,sha256)` áp cả nguồn soft-deleted; upload lại khôi phục/tham chiếu có kiểm quyền, không tạo job trùng. |
| Trang | `document_page`; file page_index 1…50, UNIQUE `(document_id,page_index)`; printed_page_label độc lập (ví dụ “12–13”). Ảnh chụp đôi là một file page, không tách theo số in. page_type chỉ phân loại, không quyết định số record. Excel dùng page_index làm số sheet ổn định, locator giữ sheet/row/column; MANUAL có một trang logic không có file. |
| Worker | `extraction_job`: job_key, queue state, available_at, lease token/until, tối đa 3 attempt, lock. Index `(state,available_at,lease_until,id)` cho claim. Retry thủ công tạo job_key mới; không hồi sinh job terminal. |
| Provider run | `extraction_run`: UNIQUE `(job_id,attempt_no)`, model/provider/prompt/schema version, request ID, latency/usage/error và timestamps. Mỗi lần gọi tạo run mới; không xóa lần trước. Metadata test ghi `not-called` không phải provider nghiệm thu. |
| Proposal | **Tái dùng `document_field`**, không tạo bảng proposal cùng nghĩa. `raw_json/value_json` giữ JSON typed; raw_text/ai_value/value cũ giữ nguyên cho v1. `ai_state` là trạng thái extraction gốc, `state` là trạng thái review hiện tại. Giữ missing_reason, critical, locator, schema version, page/run, lock. |
| Review | `review_decision` append-only, actor/action/value/reason/time, UNIQUE `(proposal_id,proposal_version)`; version là version sau quyết định. Không bulk accept. EDIT/REJECT cần lý do; undo thêm quyết định mới, không xóa lịch sử. |
| Chuyến | `sea_service` riêng, không dùng employment_contract/payroll. Giữ raw vessel/rank/ports/date, FK danh mục nullable, date precision, ongoing có người/thời điểm xác nhận, nguồn document/page/record và `field_values` theo envelope ở dưới. Xóa mềm không giải phóng khóa nguồn. |
| Đối chiếu tàu | `vessel_verification` append-only theo service_version; trạng thái, vessel/version, evidence type/reference/document/json, actor/time/reason. FK vessel không có nghĩa VERIFIED. VERIFIED cần tàu và nguồn, checksum IMO chỉ là kiểm định dạng. |
| Revision | **Tái dùng `seafarer_revision`**: v2 có revision_no, schema_version, snapshot aggregate; changes giữ diff phục vụ UI. UNIQUE `(seafarer_id,revision_no)`. v1 log cũ giữ nguyên, revision_no/snapshot NULL; không giả lập historical snapshot. |
| Audit | `mcah_audit`: actor (NULL chỉ system migration), action/entity, before/after JSON, reason/request/time. Append-only tại service; không log PII vào log vận hành. |
| Chủ tàu/mẫu/policy | Tái dùng `ship_owner`, `vessel` (thêm lock_version); `owner_template` version chứa mapping_version/hash/private path/mapping; `owner_policy` version chứa contact mode/config. Phiên bản append-only, thay đổi tạo row mới. |
| Xuất owner | `owner_export` + `owner_export_profile` + `owner_export_vessel`; snapshot, as_of/valid_until, template/policy version qua immutable row ID, creator/approver, artifact/hash, state/lock. Crew List tham chiếu revision từng người. `export_pack`/signatures giữ nguyên vì là workflow giấy nội bộ cần ký khác nghĩa. |
| Gửi lại mutation | `mcah_idempotency`: PK actor/scope/key, hash request, HTTP response JSON/status. Ghi cùng transaction nghiệp vụ; không chỉ cache trong process. |

### Khóa proposal, nguồn và chống mất dữ liệu

Khóa cũ `(document_id,field_key)` được thay bằng `(document_id,generation,record_key,field_key)`. v1 dùng generation=0/record_key rỗng/schema_version=1 nên hành vi cũ vẫn giữ. v2 bắt buộc page_id, record_key không rỗng và record_type IDENTITY/SEA_SERVICE/CERTIFICATE. Run AI dùng generation=run_id; MANUAL/EXCEL generation=0 và run_id NULL. API chỉ cho nguồn MANUAL/EXCEL dùng nhánh không run (service phải kiểm source_type).

record_key là ID ổn định cho một record trong nguồn (không dùng tên tàu làm khóa); một chuyến có thể tham chiếu nhiều trang qua các field khác nhau. Một PDF có identity-1, trip-1, trip-2 cùng trang, trip-3 trang khác đều lưu độc lập. Retry giữ generation khác; người duyệt đối chiếu run mới với record_key cũ trước publish, không tự nhân đôi chuyến. Nếu chưa đối chiếu được record, trả RECORD_IDENTITY_CONFLICT. UNIQUE nguồn chuyến `(source_document_id,source_record_key)` chặn publish lặp dù run đổi.

FK ghép bắt buộc: page/document của proposal; run/document của proposal; job/document của run; source document/profile và source page/document của chuyến; revision/profile của export; template/owner và policy/owner của export. Không nhận ID hợp lệ riêng lẻ làm bằng chứng quan hệ hợp lệ. NULL page/run chỉ được phép cho proposal v1 hoặc run NULL của nguồn không AI theo điều kiện trên. Không CASCADE xóa nguồn, run, proposal, chuyến, revision hoặc bản xuất.

`field_values` của sea_service giữ tất cả field theo envelope, gồm nguồn khác trang nếu có, raw tên và normalized ID riêng. FK typed columns phục vụ query; dịch vụ phải validate chúng khớp field_values trong cùng transaction. Schema hỗ trợ lưu, không thay logic validation task05 bằng JSON tự do.

### Envelope field v2

```json
{"schema_version":2,"record_type":"SEA_SERVICE","field_key":"sign_off","source":{"document_id":17,"page_id":32,"record_key":"trip-2","locator":{"bbox":[0.1,0.2,0.4,0.3]}},"raw":"không rõ","value":null,"state":"UNKNOWN","missing_reason":"ILLEGIBLE","critical":true}
```

raw và value luôn có key, có thể JSON null; không biến UNKNOWN thành chuỗi rỗng hoặc ngày giả. missing_reason dùng NOT_ON_SOURCE/ILLEGIBLE/DATE_AMBIGUOUS/UNSUPPORTED/NOT_PROVIDED hoặc code được schema version sau đăng ký. DATE_AMBIGUOUS giữ raw/candidates trong raw JSON; không ghi một ngày chắc chắn. Field chuẩn: full_name, birth_date, birth_place, nationality, identity_document_type/number (phân loại NATIONAL_ID/PASSPORT/UNKNOWN), seaman_book_number; sea service: vessel_name/imo/rank, embark_port/disembark_port, sign_on/sign_off, ongoing. Không map “ID hoặc passport” thẳng national_id. Critical do backend schema registry quyết định, không tin cờ từ client/provider; danh sách domain cuối cần domain lead xác nhận trước 04/07.

Ngày ISO date-only YYYY-MM-DD không timezone. Precision EXACT có DATE; MONTH/YEAR/AMBIGUOUS/UNKNOWN giữ DATE=NULL và raw/missing_reason tương ứng. Không lấy ngày đầu tháng/năm làm ngày thật. ongoing=false mặc định; ongoing=true cần người duyệt/time, sign_off=NULL; thiếu ngày rời tàu không tự ongoing. DB chặn ngày off trước on; overlap là rules ở task07. Kiểm lịch đúng, không tương lai và độ dài field canonical do service thực hiện.

### Aggregate snapshot

```json
{"schema_version":2,"revision_no":8,"profile":{"id":5,"full_name":"…"},"sea_service":[{"id":11,"lock_version":2,"field_values":{}}],"sources":[{"id":17,"sha256":"…","pages":[{"id":32,"page_index":2}],"proposals":[{"id":40,"run_id":9,"decision_id":7}]}],"certificates":[],"contacts":[]}
```

Lưu **toàn bộ giá trị** profile, sea_service active, contacts/certificates và nguồn liên quan, không chỉ ID/diff. Sources giữ document/page/record/proposal/decision IDs, hashes và locator để truy bằng chứng bất biến. Thông số vessel/evidence cần thiết cho export được copy vào snapshot export cùng phiên bản; không query dữ liệu hiện tại khi tải file lịch sử.

Migration tạo revision_no=1/schema_version=2 cho **mỗi hồ sơ hiện có**, snapshot hiện trạng đầy đủ profile/nguồn/chứng chỉ/liên hệ và sea_service=[] vì baseline không có bảng chuyến. Ghi audit system BASELINE_SNAPSHOT và aggregate_revision=1, giữ updated_at. Tất cả cột/row cũ giữ nguyên; không tạo lịch sử chuyến từ chuỗi contract hoặc log diff. DB mới không có hồ sơ nên không seed snapshot cá nhân. Revision v1 vẫn đọc được như log, không dùng để export snapshot. Route mutation v1 vẫn ghi log v1; đến 05 tất cả mutation aggregate phải dùng writer v2 và tăng revision. Không dùng counter/snapshot baseline như current revision đã kiểm chứng sau mutation v1.

## Contract HTTP dùng chung

Base `/api/v1/mcah`, bearer JWT hiện có; API mới chỉ mount ở task phụ trách với RBAC mới tương ứng, không tự được phép từ wildcard quyền v1. Mọi ID JSON là integer dương (INT hiện có). Thời gian trả UTC ISO8601; DATE giữ date-only. Không trả storage_path, secret hoặc payload provider trong response. Version 2 là schema payload độc lập `/api/v1` transport.

Success detail `{ "data": { "id": 17, "schema_version": 2, "lock_version": 0, "…": "…" } }`. Create 201 + Location; async 202 kèm job; mutation 200 trả object mới gồm version và aggregate_revision. Delete là soft delete, 200 data với deleted_at/version. Read không có tác dụng phụ.

List request `?after_id=0&limit=25` (1…100), filter exact resource state/profile/owner đã whitelist; ID ASC ổn định, `WHERE id > after_id`. Response `{data:[],pagination:{limit:25,next_after_id:null,has_more:false}}`; lấy limit+1, không tính total mặc định. Danh sách pages sắp theo page_index; collection phụ vẫn dùng id cursor, không đổi thứ tự khi polling. Filter lạ trả 400. `/revisions` có cả v1/v2 và phân biệt schema_version.

Error `{ "error": { "code": "VERSION_CONFLICT", "message": "…", "details": [{"path":"lock_version","current":3}], "request_id":"…" } }`. Không trả SQL/path/provider secret; conflict không trả PII chưa được phép.

| HTTP | Codes |
|---|---|
| 400 | INVALID_REQUEST, SCHEMA_INVALID, REASON_REQUIRED, DATE_INVALID |
| 401/403 | UNAUTHENTICATED / FORBIDDEN; maker-checker FORBIDDEN_SELF_APPROVAL |
| 404 | NOT_FOUND (cả nguồn không thuộc scope để tránh lộ danh tính) |
| 409 | VERSION_CONFLICT, REVISION_CONFLICT, INVALID_STATE, IDEMPOTENCY_MISMATCH, RECORD_IDENTITY_CONFLICT, SOURCE_CONFLICT, DUPLICATE_SOURCE, SCHEMA_VERSION_UNSUPPORTED, READINESS_BLOCKED, STALE_DEPENDENCY |
| 413/415/422 | FILE_TOO_LARGE / UNSUPPORTED_MEDIA / PDF_INVALID, PDF_ENCRYPTED, PAGE_LIMIT_EXCEEDED, SOURCE_RELATION_INVALID, CRITICAL_UNRESOLVED, DATE_AMBIGUOUS |
| 429 | RATE_LIMITED, PROVIDER_QUOTA (Retry-After nếu có) |
| 503/502/504 | AI_NOT_CONFIGURED, PROVIDER_UNAVAILABLE / PROVIDER_SCHEMA_INVALID / PROVIDER_TIMEOUT |
| 500 | INTERNAL_ERROR; transaction rollback, request_id an toàn |

### Lock và idempotency

Mutation cập nhật entity bắt buộc body `lock_version` (phiên bản hiện tại), `expected_revision` cho mọi thay đổi aggregate và quyết định nguồn liên quan, `reason` theo action. Server lock profile `FOR UPDATE`, kiểm aggregate_revision; rồi entity `UPDATE … WHERE id=? AND lock_version=?`, tăng lock_version đúng một lần. 0 affected →409. Revision tăng đơn điệu một lần mỗi transaction aggregate thành công; request no-op trả object hiện tại, không tăng version, vẫn lưu idempotency response. Không để frontend tự tăng revision. Transaction lock theo profile ID tăng dần, rồi document/page/proposal/service/vessel/export IDs tăng dần để giảm deadlock; deadlock rollback/retry transaction hữu hạn cùng key.

Mọi POST/PUT/DELETE yêu cầu header `Idempotency-Key` ASCII 1…100 ký tự, scope=`METHOD:normalized-resource-path`. Hash SHA-256 canonical JSON đã validate + actor/scope, upload bao gồm content hash/metadata. `mcah_idempotency` insert khóa trong **cùng transaction**; request đồng thời unique key đợi transaction trước. Cùng hash trả nguyên status/body đã lưu, không replay side effect; khác hash→409. Auth/quyền được kiểm lại trước replay. Không commit row response NULL; lỗi rollback cả key và business. Giữ key ít nhất tuổi thọ nguồn/export; MVP không tự purge. Không replay 4xx auth/validation hoặc 5xx rollback. Artifact pending là response 202 thật; chỉ báo SUCCEEDED/RELEASED sau khi file thực tồn tại/hash đúng.

## API đã chốt cho các task sau

Tất cả response theo envelope trên. Read trả đủ entity ở bảng mô hình; nguồn/proposal trả raw/value/missing_reason/critical/source/state/version; list trả summary cùng IDs/version. Payload không nhận actor, state terminal, version mới, storage path, audit hoặc revision từ client. `source` dùng schema `mcah.schema.js`. Các body mutation mở rộng schema chung bằng whitelist; không cho additionalProperties. Các body chi tiết ở bảng là required trừ dấu `?`.

| Task / request | Body/query và response cụ thể |
|---|---|
| 02 POST `/documents` hoặc `/profiles/:id/documents` | multipart file; reason; expected_revision bắt buộc nếu đã gắn profile; backend MIME magic, <=25MiB, <=50 pages; 202 data `{document,job,deduplicated:false}` hoặc 200 tham chiếu cùng profile `{document,job:null,deduplicated:true}`. Schema_version=2 do server. |
| 02 GET `/profiles/:id/documents`, `/documents/:id`, `/documents/:id/pages`, `/documents/:id/jobs` | Cursor; detail `{id,profile_id,mime_type,file_name,sha256,page_count,status,lock_version,schema_version,pages,jobs}`; pages có index/printed_label/type. |
| 02 GET `/documents/:id/source`, `/pages/:id/source` | Bytes inline private, Content-Type/Disposition an toàn, ETag=hash, auth/scope mỗi lần. Không nhận filesystem path. |
| 02 POST `/documents/:id/retry`; DELETE `/documents/:id` | lock_version, expected_revision, reason; retry chỉ FAILED, 202 `{document,job}`; xóa chỉ chưa publish và không có canonical/evidence dependency. |
| 03 GET `/jobs/:id`, `/runs/:id`; GET `/documents/:id/proposals?run_id=` | Job/run metadata thực; proposal list có run/generation/record/source, raw/value, ai_state/state/critical/missing_reason/lock. Run filter phải thuộc document. Không có HTTP endpoint tự ghi run từ browser. |
| 04 POST `/proposals/:id/decisions` | lock_version, expected_revision, action accept/edit/reject/keepUnknown/undo, reason (nullable trừ edit/reject/conflict), value?; 200 `{proposal,decision,document_status,aggregate_revision}`. Critical cần explicit decision; accept DATE_AMBIGUOUS bị 422, edit thành ngày EXACT cần reason. |
| 04 GET `/proposals/:id/decisions`; GET `/profiles/:id/conflicts` | Cursor decision history; conflicts `{id,target,proposal_ids,current_value,source_values,status}` được tính từ sources, không last-write-wins. Resolve bằng decision có reason + selected proposal IDs, lưu selection trong audit/decision value_json. |
| 05 POST `/profiles/:id/publish` | lock_version (profile), expected_revision, reason, document_versions:[{id,lock_version}], identity_confirmation:{confirmed:true,proposal_ids:[]}; 200 `{profile,sea_service_ids,revision,documents}`. Không tự merge người/tự chọn nguồn mâu thuẫn. |
| 05 POST `/profiles/from-review` | reason, document_versions, identity_confirmation, confirmed_proposal_ids; 201 `{profile,revision}`; hồ sơ canonical chỉ tạo khi đủ required identity và explicit review. Nguồn unbound phải thuộc creator hoặc admin; tạo canonical rồi bind document.seafarer_id trong cùng transaction trước khi ghi sea_service/FK. Tài liệu đã bind không tự đổi người; identity conflict trả 409. |
| 05 GET `/profiles/:id`, `/profiles/:id/sea-services`, `/profiles/:id/revisions`, `/revisions/:id` | Snapshot detail với schema version; sea service trả raw/typed/date_precision/ongoing/source/lock/evidence; không dùng employment_contract. |
| 05 PUT `/profiles/:id`; DELETE `/profiles/:id` | lock_version, expected_revision, reason, fields (whitelist canonical); xóa mềm tăng revision, audit và stale phụ thuộc. |
| 05 POST `/profiles/:id/sea-services`; PUT/DELETE `/sea-services/:id` | expected_revision, reason, fields theo sea_service (raw, normalized IDs, date/precision/missing_reason, ports, ongoing), source; PUT/DELETE thêm lock_version. Manual tạo nguồn MANUAL server-side với page/record ID, không nhận file path. CRUD→`{sea_service,revision}`. |
| 06 GET `/vessels?imo=&name=`; POST/PUT `/vessels[/id]` | Read candidates `{id,lock_version,imo,name,parameters,evidence}`; write admin/operator reason, lock_version cho PUT, fields whitelist. Không tự xác nhận từ candidate list. |
| 06 POST `/sea-services/:id/verifications` | lock_version (service), expected_revision, reason, state, vessel_id?, vessel_version?, evidence:{type,reference,document_id?,data?}; 200 `{verification,sea_service,revision}`. VERIFIED cần evidence được người dùng xác nhận, nguồn được phép truy cập. |
| 07 GET `/profiles/:id/checks?as_of=YYYY-MM-DD&expected_revision=` | `{revision_no,as_of,valid_until,rule_version,readiness,total_days,provisional_days,excluded,by_rank,issues:[{code,severity,source,action}]}`. Rules DQ_REQUIRED_CRITICAL/DQ_DATE_ORDER/DQ_OVERLAP/VES_EVIDENCE. Không cam kết compliance ngoài MVP. |
| 08 POST `/imports/preview`; GET `/imports/:id` | multipart xlsx + target profile IDs/expected revisions/reason; 202/200 preview `{source_document,rows,errors:[{sheet,row,column,code}],proposals,lock_version}`. Bảng nguồn/proposals lưu preview; 08 thêm bảng import job riêng nếu cần, không dùng extraction AI run giả. |
| 08 POST `/imports/:id/confirm` | lock_version, expected_revisions:[{profile_id,revision}], reason, row_decisions; 200 `{profiles,revisions,created_service_ids}`. Không ghi canonical trước confirm, không match chỉ theo tên. |
| 09 GET `/owners/:id/templates`, `/owners/:id/policies`; POST tương ứng | Create admin: template_key/export_type/version/mapping_version/file/mapping/reason hoặc contact_mode/config/version/reason. Return immutable version row; thiếu file/mapping không tạo export thành công. |
| 09 POST `/owner-exports` | owner_id,template_id,policy_id,profiles:[{id,expected_revision}],as_of,reason; 201 `{export:{id,state:DRAFT,lock_version,snapshot,dependencies,valid_until}}`. CV đúng một người, Crew List >=1. |
| 09 GET `/owner-exports`, `/owner-exports/:id`, `/owner-exports/:id/preview` | Cursor/detail; preview cùng mô hình đã áp contact policy với artifact, không chứa giá trị bị HIDE. |
| 10 POST `/owner-exports/:id/submit`, `/approve`, `/reject` | lock_version, reason (reject bắt buộc), expected_revisions:[{profile_id,revision}], expected_vessels:[{id,lock_version}]; submit→PENDING_APPROVAL, approve→RELEASED sau checks/file thật; reject→REJECTED. |
| 10 GET `/owner-exports/:id/download?historical=true` | artifact byte/hash bất biến, stale hiện hành→409, historical chỉ quyền truy vết có nhãn STALE. Không tạo lại XLSX từ profile hiện tại. |

Nguồn chưa gắn người dùng seafarer_id=NULL, không tạo canonical giả để đáp ứng NOT NULL. Tạo profile từ review khóa document, xác nhận nguồn/actor/identity, insert canonical đủ required, bind nguồn và ghi snapshot trong cùng transaction. Khi bind, UNIQUE hash đích có thể xung đột: trả DUPLICATE_SOURCE, không tự merge. Sau bind nguồn immutable về profile_id; đổi người cần workflow riêng có audit ở task05.

## State machines và transaction boundary

| Entity | Chuyển trạng thái hợp lệ |
|---|---|
| Document v2 | RECEIVED→QUEUED→READING→REVIEW_REQUIRED→COMPLETED→PUBLISHED. RECEIVED/QUEUED/READING→FAILED; FAILED→QUEUED tạo job mới; COMPLETED→REVIEW_REQUIRED khi undo trước publish. PUBLISHED bất biến; sửa tạo nguồn/run/revision mới. |
| Job/run | QUEUED→RUNNING→SUCCEEDED/FAILED; QUEUED→CANCELLED. Lease hết: RUNNING→QUEUED nếu còn attempt, ghi run trước FAILED/LEASE_EXPIRED; không còn attempt→FAILED. Run chỉ RUNNING→SUCCEEDED/FAILED. Không coi process restart là provider thành công. |
| Proposal/review | AI state PROPOSED/UNKNOWN/DATE_AMBIGUOUS; accept→ACCEPTED (chỉ có value hợp lệ), edit→EDITED, reject→REJECTED, keepUnknown→UNKNOWN_KEPT. Undo về ai_state từ dữ liệu gốc, giữ decision history. Không cho mutate proposal thuộc document published. |
| Verification | NOT_CHECKED→VERIFIED/CONFLICT/NOT_FOUND/UNAVAILABLE bằng quyết định người dùng. Kiểm lại từ trạng thái nào cũng tạo verification mới sau tăng service version; sửa source/vessel làm verification trước hết hiệu lực. Không update row history. |
| Export | DRAFT→PENDING_APPROVAL→RELEASED; PENDING_APPROVAL→REJECTED; DRAFT/PENDING_APPROVAL/RELEASED→STALE khi dependency/validity đổi. REJECTED/STALE tạo export mới, không hồi sinh hoặc sửa snapshot cũ. Maker khác checker kể cả admin. |

DB CHECK chặn enum/một số invariant và unique/FK; **transition, immutable policy/template/revision/audit, schema field registry, scoped auth và semantic validation là trách nhiệm service ở task sau**, không nhận SQL CHECK thay thế workflow API. Migration không thêm trigger phá workflow v1.

1. Intake transaction: dedup hash + source/pages + job + audit + idempotency. Ghi file staging trước; atomic rename/hash trước commit nguồn, lỗi DB dọn staging; khi crash quét orphan theo job/outbox ở 02. Không giữ DB transaction mở trong PDF render/provider request.
2. Worker claim transaction: chọn job `FOR UPDATE SKIP LOCKED`, CAS lease/attempt + tạo run, commit. Gọi provider ngoài transaction. Completion transaction kiểm lease token còn sở hữu và document lock, ghi proposals theo generation + run usage/state + job/document state/audit; worker cũ hết lease không được publish kết quả.
3. Review transaction: lock profile/document/proposal, kiểm versions/sources/critical/action, append decision, CAS proposal/document, audit/idempotency. Draft review không tăng canonical aggregate_revision, nhưng tăng entity lock; publish recheck toàn bộ document_versions và decisions.
4. Publish/CRUD/import confirm: lock các profile và dependency, kiểm expected_revision + identity/conflicts + decisions, ghi canonical fields/sea_service/certificates, snapshot revision đầy đủ + counter + audit + stale exports + document states + idempotency **một transaction**. Rollback tất cả nếu lỗi. Import nhiều hồ sơ toàn batch atomic với kích thước giới hạn ở 08.
5. Verification/catalog: lưu evidence được scope auth kiểm tra, CAS service/vessel, append verification, tăng aggregate revision cho service change; mark chỉ export liên quan stale trong cùng transaction. Vessel catalog change tăng vessel version và stale export_vessel, không sửa snapshot cũ.
6. Export create: lock profiles/vessels/template/policy, checks as_of, lấy full immutable snapshot + dependencies + policy-applied preview model, insert export + idempotency. Đổi version template/policy đánh stale đúng owner/template key/policy và exports liên quan, gồm RELEASED.
7. Release: generate artifact staging từ snapshot ngoài transaction, kiểm hash, transaction lock/recheck export/dependencies/current revisions/versions/readiness/valid_until + maker/checker; atomically lưu path/hash/released/approval/audit/idempotency. Nếu dependency đổi, rollback/reject STALE và dọn staging. Không trả RELEASED trước khi artifact private tồn tại; crash orphan reconciliation thuộc 10. Download kiểm state/validity, chỉ đọc file đã lưu/hash, không query PII current để dựng lại.

## Validation và nghiệm thu

`backend/src/schemas/mcah.schema.js` cung cấp JSON Schema dùng chung cho source, proposal, decision, mutation lock/revision/reason, pagination và aggregate snapshot; constants/state transition guard. Test compile bằng Fastify/Ajv thực. Không mount schema vào route v1 với ý nghĩa khác. Schema payload nested canonical chi tiết, import row, template mapping và rule registry được task chủ quản mở rộng theo contract này trước khi mount route.

Chạy migration: từ backend, cấu hình DB_USER riêng/DB_NAME=mcah_<instance>/MCAH_INSTANCE giống DB_NAME và UPLOAD_DIR private theo baseline, backup DB/storage trước, `npm run db:migrate`. Runner kiểm target/engine/checksum/advisory lock; không reset/drop DB. 022 additive nhưng DDL implicit commit: thất bại cần inspect/restore; không sửa history rồi chạy lại mù. Không rollback bằng DROP TABLE vì mất audit/source. Migrations 000…021 giữ nguyên.

Kiểm thử riêng: `npm run test:contract`, env DB_SOCKET private, MCAH_TEST_CONFIRM=DB_NAME, DB_NAME kết thúc test; script tạo DB `mcah_01_*_test` timestamp mới, không drop. Tạo baseline thật 000…021 với history rồi nâng 022, kiểm dữ liệu cũ theo từng cột/row và snapshot bổ sung. Script dùng SQL synthetic để nghiệm thu **khả năng lưu schema**, không upload/render/extraction PDF thật. Nghiệm thu đa trang end-to-end thuộc 02…05; không dùng kết quả SQL để nhận provider đã chạy.

Bằng chứng và số pass nằm ở `docs/verification/mcah-01-*` và implementation status. DB nghiệp vụ đích chưa được cấp/xác nhận; không nâng cấp DB đó. Không cần AI key cho task01; còn thiếu key/model, mẫu/policy thật và domain decisions cho task sau.
