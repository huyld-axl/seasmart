# MCAH implementation status

Cập nhật 09/10/2026 — theo kế hoạch phiên bản 2.

## MCAH-00 — DONE (triển khai và nghiệm thu local độc lập)

Baseline commit: `f559c8e0d4c62acd303b936a9a9463742a614c7c`. Commit triển khai: tra bằng `git log --oneline -- docs/mcah-implementation-status.md`. Chưa deploy; bằng chứng bên dưới là nghiệm thu local. Trước sửa: Git chỉ có ba tài liệu kế hoạch untracked; không có code diff. Không có AGENTS.md áp dụng. Workspace cha không phải repo, repo là `seasmart/`.

Đã hoàn thành:

- Ma trận quyền admin/operator/reviewer, chặn vai legacy ở API; operator không được duyệt/trả lại, người tạo không tự duyệt kể cả admin. Auth kiểm role/active/deleted từ DB mỗi request. UI cập nhật quyền vào app và nút duyệt; chặn public signup kế thừa.
- Cấu hình không còn DB marineport mặc định: bắt buộc DB_NAME `mcah_*`, xác nhận MCAH_INSTANCE, JWT đủ dài, upload private trong backend/storage; không theo symlink hoặc đường dẫn nguồn ra ngoài kho. Không dùng DB/user/upload legacy trong kiểm thử.
- Engine chạy thật **MariaDB 11.8.6**, cài sạch 000–021, lịch sử/checksum/advisory lock, bỏ seed hồ sơ cá nhân 011. Bootstrap admin env thật qua bcrypt, chạy lại không đổi password hash. Chế độ nhận baseline kiểm cột/kiểu/index/FK trước khi ghi history; không replay SQL seed/update cũ.
- `/health`, `/ready`: kiểm DB marker, migration/checksum, ghi storage thật; AI có trạng thái thiếu cấu hình/configured_unverified, không báo provider đã chạy. Job legacy không chạy mặc định.
- Vitest chỉ nhận `*.test`, không nhận `demoDocs.js` là suite; không thay assertion cũ để che lỗi. Thêm test config/quyền và script tích hợp DB/API/file/XLSX thật.
- CI lint/test/build và job MariaDB 11.8 migrate/bootstrap/smoke. Hướng dẫn cài/nâng cấp/khôi phục migration chạy dở và ma trận quyền tại [mcah-00-baseline.md](mcah-00-baseline.md).

### Schema/API/file thay đổi

- Schema mới duy nhất: `021_mcah_instance.sql` (marker), bảng `mcah_migration_history` do runner quản lý. Không sửa SQL 000–020, không thêm sea_service hoặc đổi hợp đồng/payroll.
- API mới `/ready`; `/health` thêm product. API cũ giữ contract, siết quyền tập trung và quyền approve/reject. `/auth/register*` trả 403. `/documents/status` phản ánh cả key và model. Document/source từ chối path ngoài kho.
- Backend: `src/config/{environment,index,db,migrations}.js`, `src/constants/mcah_permissions.js`, `src/plugins/index.js`, `server.js`, auth/export routes, document/document_reader/export_pack/email services, `utils/private_storage.js`, migration 021; `scripts/{migrate,bootstrap-admin,capture-baseline-schema,install-smoke,upgrade-smoke,integration-smoke}.js` và hai manifest schema baseline.
- Frontend: `App.jsx`, `pages/admin/exports/PackSignPage.jsx`. Cấu hình: hai Vitest config, env example, package scripts, gitignore, `.github/workflows/ci.yml`.

### Kiểm thử thực tế

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Cài DB trống | PASS; 22 history entries, seed 011 bỏ qua; 0 hồ sơ/0 user trước bootstrap | [install](verification/mcah-00-install.txt) |
| Migrate lại | PASS; history/timestamp/checksum không đổi, không replay | [install](verification/mcah-00-install.txt), [API](verification/mcah-00-live-api.txt) |
| Nâng cấp baseline có dữ liệu | PASS; chỉ áp 021, toàn bộ dữ liệu bảng cũ giữ nguyên byte-for-byte trong ordered dumps; rerun PASS | [upgrade](verification/mcah-00-upgrade.txt) |
| API/DB/file thực | **61 assertion PASS**; HTTP health, login bootstrap, JWT/bcrypt, 401/403, 3 legacy roles, reviewer, upload PNG, thiếu AI → FAILED, nguồn đúng byte, path ngoài kho 403, XLSX danh sách thật, maker/checker, khóa tài khoản, bootstrap/rerun, readiness lỗi history | [API](verification/mcah-00-live-api.txt) |
| Backend unit | **38/38 PASS** (34 cũ + 4 mới) | [tests](verification/mcah-00-tests.txt) |
| Frontend unit | **34/34 PASS**; fixture không còn bị nhận là suite | [tests](verification/mcah-00-tests.txt) |
| Lint | PASS, 0 lỗi; 15 warning kế thừa (13 backend + 2 frontend) | [lint](verification/mcah-00-lint.txt) |
| Build | PASS; còn warning bundle >500 KB | [build](verification/mcah-00-build.txt) |
| Crew-Manning | Git status sạch, diff rỗng; HEAD `40a369e5aea7b309b155f81c1e2caab1d606b278`; không chạy migration/kết nối DB/upload legacy | Đối chiếu Git sau triển khai |

Đây là kiểm thử local với MariaDB thật, không phải mock. Dữ liệu synthetic đi qua API/upload thật trong phạm vi task00. Các thay đổi DB trực tiếp trong negative test chỉ gây lỗi path/history/active để kiểm bảo vệ. **Không có request AI thật**, không có FakeProvider hay fallback extraction. Không dùng test này để nhận hoàn thành MCAH-03/11.

### Đầu vào còn thiếu và giới hạn nghiệm thu

| Đầu vào/trạng thái | Ảnh hưởng |
|---|---|
| DB MCAH nghiệp vụ đích, tài khoản DB riêng, xác nhận schema/backup và kho nguồn hiện có | **Chưa chạy nâng cấp trên DB nghiệp vụ đích**. Đã nghiệm thu nâng cấp trên bản baseline có dữ liệu synthetic; schema thực tế lệch manifest sẽ bị chặn, cần migration được review. Không dùng `.env` cũ để đoán đích. |
| Agency/instance, admin email/password thật, danh sách vai người dùng | Chưa cấu hình tài khoản nghiệp vụ; chỉ bootstrap và quản trị tài khoản synthetic đã kiểm thử. Cần cấu hình env riêng theo runbook trước vận hành. |
| Anthropic key hợp lệ, model được cấp quyền, quota | **BLOCKED live extraction MCAH-03/11**, không chặn nghiệm thu nền MCAH-00. Đã kiểm nhánh thiếu cấu hình thật. |
| CV/Crew List được phép dùng và mapping, owner/contact policy | **BLOCKED nghiệm thu MCAH-09**. CV hiện chưa có mẫu; pack hiện bị gate chữ ký, download 409. Không coi ZIP báo thiếu mẫu là output owner thành công. |
| Tài liệu có quyền dùng/bản đọc chuẩn, nguồn tàu, quyết định critical/date/month/trip và người nghiệm thu | Chưa nghiệm thu extraction/rules/CV, thuộc MCAH-03…11. |
| Môi trường deployment/HTTPS/storage persistent/quyền CI | Chưa deploy, chưa chạy GitHub workflow, chưa browser E2E, chưa restore môi trường đích. Thuộc MCAH-11/12. |

Các chỗ gãy route/source/export kế thừa được ghi trong runbook. Nghiệm thu DONE ở đây chỉ cho **MCAH-00 trên môi trường local độc lập**; không nhận hoàn thành các task sau, toàn bộ SRS, triển khai hay nâng cấp dữ liệu nghiệp vụ chưa được cung cấp.

## MCAH-01 — DONE (schema/contract và nghiệm thu MariaDB local độc lập)

HEAD trước/sau triển khai vẫn `6745e8f`. Chưa commit/push/deploy. Đọc toàn bộ kế hoạch v2, baseline/status, CLAUDE.md và naming conventions; không có AGENTS.md áp dụng. Giữ nguyên LoginPage.jsx/CSS, frontend/.env.local, frontend/.env.example và hai tài liệu demo untracked. Crew-Manning Git sạch, HEAD vẫn `40a369e5aea7b309b155f81c1e2caab1d606b278`; không kết nối DB/upload legacy.

### Đã bàn giao

- [Contract v2](mcah-data-api-contract.md): entity/field/source/snapshot, request/response/error/pagination, lock/idempotency, RBAC và state machines, transaction boundaries cho task02…10. Endpoint `/api/v1/mcah/*` chưa mount; đây là contract, không nhận API nghiệp vụ task sau đã hoạt động.
- `backend/migrations/022_mcah_data_contract.sql`: tái dùng document/field/revision và seafarer/vessel/ship_owner; thêm document_page, extraction_job/run, review_decision, sea_service, vessel_verification, mcah_audit, owner_template/policy/export + profile/vessel dependencies và mcah_idempotency. Giữ nguyên 000…021.
- Khóa field theo document/generation/record/field, nguồn document/page/run có FK ghép; một PDF có identity và nhiều chuyến không ghi đè. UNKNOWN giữ raw/value/missing_reason/critical/schema_version. Nguồn intake chưa biết người nullable, creator-scoped hash unique, không tạo hồ sơ giả.
- Revision v2 là snapshot aggregate, thêm baseline revision 1 cho hồ sơ hiện có và audit system; log revision v1 giữ nguyên. Migration không suy diễn sea_service từ hợp đồng/chuỗi cũ, không hash hoặc chuyển file cũ.
- `backend/src/schemas/mcah.schema.js` và 4 unit tests dùng Fastify/Ajv: source/proposal/decision/mutation/pagination/snapshot và transition guards. Validation chi tiết task sau mở rộng trước khi mount routes.
- Guard API document v1 từ chối detail/source/mutation schema v2 bằng 409; list v1 chỉ đọc schema v1, tránh mất dữ liệu nhiều trang qua field-key legacy. Regression script bổ sung 6 assertions bảo vệ này.
- `backend/scripts/mcah-contract-smoke.js`, npm `test:contract`; kiểm schema bằng MariaDB thật, không mock/provider/extraction. Dữ liệu synthetic được ghi SQL chỉ để nghiệm thu khả năng lưu schema.

### Kết quả kiểm thử

| Kiểm tra | Kết quả / bằng chứng |
|---|---|
| MariaDB độc lập | **11.8.6**, datadir `/tmp/mcah01-real-db`, socket `/tmp/mcah01-real.sock`, skip-networking; DB/user mục tiêu được xác nhận trước migration. Không dùng .env để đoán DB nghiệp vụ. |
| Cài sạch, nâng baseline 000…021 có dữ liệu, chạy lại | **PASS**; 23 history entries; dữ liệu/cột cũ giữ nguyên; snapshot/audit bổ sung; rerun không đổi history/checksum/timestamp. [DB](verification/mcah-01-db.txt) |
| Constraint/đa trang/snapshot/lock/rollback | **38 acceptance checks PASS** tổng gồm clean/upgrade: identity + ba chuyến trên ba trang, nhiều record cùng trang, retry giữ proposals cũ, hash dedup, unique/FK/check/index; chặn nguồn sai và owner/revision sai; hai kết nối thật chỉ một CAS thắng; rollback chuyến/revision/audit cùng nhau. [DB](verification/mcah-01-db.txt) |
| API hiện có sau 022 | **67 live assertions PASS**: HTTP listener, auth/bcrypt/JWT/RBAC, bootstrap/rerun, danh sách/detail/revision, upload PNG/source byte thật, XLSX parse được, thiếu AI→FAILED thật, maker/checker, guard v2 và readiness. [regression](verification/mcah-01-regression.txt) |
| Unit tests | **Backend 42/42, frontend 34/34 PASS**. [tests](verification/mcah-01-tests.txt) |
| Lint | **PASS**, 0 errors/15 warning kế thừa. [lint](verification/mcah-01-lint.txt) |
| Build | **PASS**, còn warning bundle >500KB. [build](verification/mcah-01-build.txt) |

### Cách chạy và giới hạn

Từ `seasmart/backend/`, cấu hình env MCAH riêng theo baseline, backup DB/storage rồi `npm run db:migrate`. Không chạy SQL thủ công trên DB legacy. Để tái hiện schema acceptance dùng DB_SOCKET server test riêng, DB_NAME kết thúc test, MCAH_INSTANCE và MCAH_TEST_CONFIRM bằng DB_NAME; `npm run test:contract` tự tạo hai DB timestamp mới, không drop/reset. Lệnh/env mẫu đầy đủ tại [verification runbook](verification/mcah-01-runbook.md). Từ `seasmart/`: `npm run lint`, `npm test`, `npm run build`.

- Nghiệm thu DONE chỉ cho **MCAH-01 schema/contract local**, đã có migration và kiểm thử DB thật. Không chỉ thiết kế. DB test cuối được giữ trong datadir ở trên; xem tên DB trong log.
- **Chưa chạy nâng cấp DB nghiệp vụ đích**, chưa được cấp DB/account riêng/backup và nguồn nghiệp vụ được xác nhận. Không ảnh hưởng nghiệm thu local schema; phải nghiệm thu nâng cấp đích trước vận hành.
- **Chưa chạy provider hoặc PDF end-to-end**; đa trang là bằng chứng SQL lưu schema, không nhận đã upload/render/AI/review/publish PDF thật. Không cần key để hoàn thành 01. Key/model/quota, tài liệu có quyền dùng, domain critical/date/ongoing/month/trip và mẫu/policy owner vẫn thiếu cho 03…11.
- Các endpoint/worker/review/publish v2/rules/export state transitions, immutable writer và policy enforcement chưa triển khai, thuộc 02…10. DB CHECK/FK hỗ trợ invariant, không thay auth/service validation. API v1 vẫn ghi log v1; baseline aggregate snapshot không được coi là current sau mutation v1 trước khi writer v2 ở 05 hoàn thành.
- Tải export_pack hiện có vẫn trả 409 sau approve do workflow ký; đây là baseline đã biết, không nhận đã có owner CV/Crew List. Chưa browser E2E, CI remote, deployment/backup-restore nghiệp vụ; thuộc 11/12.

## Các task tiếp theo

MCAH-02…12: **TODO**, chưa triển khai. Đầu vào còn thiếu giữ như bảng MCAH-00; không thay bằng dữ liệu giả.
