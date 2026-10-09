# MCAH-00 — baseline, môi trường độc lập và cách chạy

Ngày nghiệm thu local: 09/10/2026. Baseline source `f559c8e0d4c62acd303b936a9a9463742a614c7c`.

## Quyết định và ranh giới

- DB đã chạy thực tế: **MariaDB 11.8.6**, InnoDB, utf8mb4. Dùng MariaDB 11.8.x cho triển khai mới. Runner chấp nhận MariaDB 10.6+ và 11.x; các phiên bản khác 11.8.6 chưa được kiểm thử ở đợt này. Không nhận MySQL làm engine đã nghiệm thu: SQL kế thừa dùng `ADD COLUMN/INDEX IF NOT EXISTS` của MariaDB.
- Mọi target phải có `DB_NAME=mcah_<instance>` và `MCAH_INSTANCE` bằng chính DB_NAME. Không có fallback `marineport`. DBA tạo DB và user riêng, cấp quyền chỉ DB MCAH; không dùng user legacy trong vận hành. Runner không tạo/drop/reset DB.
- `UPLOAD_DIR` bắt buộc nằm dưới `seasmart/backend/storage/`, tính tương đối từ `backend/`, không theo cwd. Kiểm tra cả symlink. Nguồn document đọc lại phải thuộc kho đã cấu hình; đường dẫn kế thừa nằm ngoài kho nhận 403, không đọc file legacy. Storage không được mount ra public web.
- Không sửa migration lịch sử 000–020. Migration mới: `021_mcah_instance.sql`. Không chạy `011_seed_seafarer.sql`; ghi lịch sử với note bỏ qua seed cá nhân. Catalog seeds vẫn chạy trong cài sạch.
- Không đổi schema nghiệp vụ hồ sơ/revision trong task này. MCAH-01 trở đi phụ trách contract mới.
- Job đào tạo/notification/payroll kế thừa không chạy mặc định; chỉ bật khi chủ động đặt `ENABLE_LEGACY_JOBS=true` trong bản seasmart. Không có worker MCAH bền vững trước MCAH-02.

## Ma trận quyền API

| Khả năng | admin | operator | reviewer | training_center / manning_agent / seafarer |
|---|---|---|---|---|
| Hồ sơ, danh sách/XLSX, chi tiết, revisions, document/source, export detail | Có | Có | Có | 403 |
| Tạo/sửa hồ sơ, upload/retry/xóa/publish, import, tạo bản xuất/gửi duyệt | Có | Có | 403 | 403 |
| Review từng trường document | Có | Có | Có | 403 |
| Duyệt/trả lại bản xuất | Có, khác người tạo | 403 | Có, khác người tạo | 403 |
| Quản trị tài khoản | Có | 403 | 403 | 403 |

Không đăng nhập/token sai/tài khoản đã khóa hoặc xóa: 401. Role được đọc lại từ DB mỗi request; JWT cũ không giữ quyền sau khi đổi role. Kiểm tra maker/checker nằm cả service và route; so sánh ID chuẩn hóa string để không vượt bằng khác kiểu số/chuỗi. Public đăng ký legacy bị chặn 403. UI MCAH chỉ cho admin/operator/reviewer vào layout; trang duyệt chỉ hiện nút duyệt cho admin/reviewer khác người tạo. API quyết định quyền độc lập UI.

Ma trận trên áp dụng vào API bản sao seasmart; không thay đổi quyền hoặc tài khoản ở Crew-Manning. Workflow tạo pack hiện có tự vào PENDING_APPROVAL, chưa có DRAFT/submit riêng (MCAH-10).

## Cài mới

1. Cài Node.js 22 và MariaDB 11.8.x. DBA tạo DB trống tên `mcah_<agency>` (utf8mb4) và tài khoản DB riêng; không trỏ tới DB cũ MarinePort/Crew-Manning.
2. Cài dependency: `npm ci --prefix backend` và `npm ci --prefix frontend` tại `seasmart/`.
3. Cấu hình `backend/.env` theo `.env.example`; giữ bí mật và không ghi đè cấu hình đang dùng khi chưa kiểm tra. Bắt buộc: DB_HOST, DB_USER, DB_NAME, MCAH_INSTANCE, JWT_SECRET ngẫu nhiên >=32 ký tự, UPLOAD_DIR. DB_PASSWORD theo tài khoản DBA. JWT_SECRET không dùng các giá trị test trong CI.
4. Đặt `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` >=12 ký tự. Không có admin mặc định. Email trùng tài khoản khác hoặc tài khoản đã khóa/xóa sẽ báo lỗi; không tự nâng quyền hay đổi mật khẩu.
5. Chạy từ `backend/`:

```sh
npm run db:migrate
npm run db:bootstrap
npm start
```

6. Chạy `npm run dev --prefix frontend` từ `seasmart/`; đăng nhập bằng admin bootstrap. Admin tạo operator/reviewer qua màn hình Tài khoản/API `/api/v1/users`. Xóa bootstrap password khỏi env sau khi tạo admin và dùng quy trình quản trị secret của agency.
7. `GET /health` kiểm tra process. `GET /ready` trả 200 khi DB có marker MCAH, checksum/lịch sử migration đầy đủ và kho ghi/xóa probe thực tế được; thiếu một điều kiện trả 503. Probe là file rỗng ngẫu nhiên được xóa ngay.

AI thiếu key/model không làm vô hiệu chức năng quản trị/đọc hồ sơ: `/ready.checks.ai=not_configured`, `/api/v1/documents/status.ai_configured=false`; upload thật đi vào FAILED với lỗi cấu hình. Khi đủ cả key và DOC_READER_MODEL, trạng thái là `configured_unverified`, chưa tuyên bố provider/model chạy được. Không có request AI thật trong nghiệm thu MCAH-00. Cần restart backend sau thay đổi env/model.

## Nâng cấp DB MCAH hiện có

- Xác minh DB/user/upload là MCAH; backup DB và storage trước nâng cấp. Không chạy runner trên DB Crew-Manning, không dùng reset.
- DB đã có `mcah_migration_history`: chạy `npm run db:migrate`. Runner dùng advisory lock, kiểm checksum, chỉ chạy migration chưa áp. Chạy lại không cập nhật timestamp của migration cũ.
- DB baseline 000–020 chưa có history: chỉ sau backup/xác nhận đích, chạy `npm run db:migrate -- --adopt-baseline`. Runner kiểm toàn bộ cột/kiểu, index và FK/unique theo hai manifest baseline trước khi ghi nhận lịch sử. Không chạy lại seed/update SQL cũ; chỉ chạy 021 trở đi. Giữ nguyên toàn bộ dữ liệu và người dùng hiện có, kể cả seed cũ nếu đã có.
- DB cũ chưa đủ baseline hoặc schema lệch: dừng và báo table/column/index/constraint; cần migration chuyển đổi được review cho schema thực tế, không tự nhận baseline hay tự sửa dữ liệu. Manifest được chụp từ cài sạch baseline đã chạy, không từ DB nghiệp vụ.
- DDL MariaDB có implicit commit: RUNNING/FAILED không tự retry; runner dừng khi gặp migration chạy dở. Khôi phục backup hoặc đối chiếu từng DDL với DBA, sửa phần còn thiếu và chỉ xác nhận history APPLIED sau kiểm chứng. Không xóa history để chạy lại tùy tiện.
- Nguồn document cũ ngoài kho mới cần kế hoạch copy/kiểm hash/cập nhật path có kiểm soát; runner không tự đọc hoặc di chuyển kho legacy.

## Kiểm thử và bằng chứng

```sh
# từ seasmart/
npm run lint
npm test
npm run build
# từ backend/, với env riêng của DB kiểm thử
npm run test:integration
npm run test:install
npm run test:upgrade
```

`test:integration` yêu cầu DB đã migrate/bootstrap, `MCAH_TEST_CONFIRM=DB_NAME`, tên DB kết thúc `test` hoặc `clean`, key AI trống; tạo dữ liệu synthetic qua API thật, kiểm bcrypt/JWT, HTTP listener, DB, file nguồn và XLSX. Vài cập nhật DB trực tiếp chỉ dùng gây lỗi quyền/path/history trong negative test, không làm giả extraction hay nghiệm thu luồng publish AI. Script không dùng mock service/provider. Dữ liệu test được giữ lại.

`test:install` và `test:upgrade` chỉ dùng private socket test và user DBA trên server test riêng. Chúng tạo DB test mới có timestamp, không drop DB; upgrade copy baseline với user/profile/document/export synthetic rồi so sánh ordered data dump trước/sau byte-for-byte. Không dùng các script này với DB nghiệp vụ. Các DB test local nằm trên `/tmp/mcah00-isolated-db`, socket `/tmp/mcah00.sock`, tắt TCP. Server kiểm thử đã dừng sau nghiệm thu; giữ nguyên datadir và log bằng chứng.

CI có hai job: lint/test/build và MariaDB 11.8 cài sạch/bootstrap/smoke API thật. Workflow đã thêm; chưa chạy trên GitHub vì chưa push.

Bằng chứng: `docs/verification/mcah-00-{install,upgrade,live-api,lint,tests,build}.txt`. Log chỉ chứa dữ liệu synthetic và lỗi an toàn, không secret/hồ sơ cá nhân.

## Các chỗ gãy baseline cần task sau

| Phần | Bằng chứng/trạng thái | Task tiếp |
|---|---|---|
| Đọc danh sách, detail, revisions, nguồn document, XLSX danh sách | Smoke API thật 200, nguồn đúng byte, workbook parse được | Giữ làm regression |
| AI thiếu cấu hình | Upload thật → FAILED; chưa chạy provider thật | 03, key/model/quota |
| Download bộ giấy | Sau reviewer approve vẫn SIGNING, download trả 409 do ký; chưa phải owner release | 09–10 |
| CV | `formKey=null`; chưa có CV owner thật, ZIP hiện có có thể chỉ chứa CHUA-CO.txt khi thiếu mẫu; không coi là xuất thành công | 09 |
| Form list | API liệt kê metadata, chưa chứng minh mọi file mẫu có trên máy đích | 09, cần mẫu/mapping |
| Certificate source kế thừa | upload lưu URL `/uploads/certificates/...`, backend hiện không mount kho private ở URL đó; link này cần endpoint auth riêng | 02/09 theo contract |
| Review/publish nhiều trang/chuyến, worker, lock, aggregate revision | Chưa thuộc MCAH-00, chưa nghiệm thu | 01–05 |
| Ký/SMS/public sign, import legacy, đào tạo/QR/waitlist/messages | Không nghiệm thu nghiệp vụ trong task00; legacy roles bị chặn API MCAH | Ngoài luồng MCAH hoặc task tương ứng |
| UI browser E2E | Chưa chạy; đã build và test model UI | 11 |

Không báo đạt toàn bộ SRS, luồng AI hay xuất CV/Crew List từ kết quả MCAH-00.
