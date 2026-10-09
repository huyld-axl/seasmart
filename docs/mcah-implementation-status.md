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

## Các task tiếp theo

MCAH-01…12: **TODO**, chưa được triển khai trong yêu cầu này. Các đầu vào blocked ở trên cần được giải quyết đúng dependency; không thay bằng dữ liệu giả.
