# Tái hiện bằng chứng MCAH-01

Ngày local 09/10/2026. Source HEAD `6745e8f` + thay đổi chưa commit MCAH-01. Không commit/push/deploy, không sửa Crew-Manning hoặc thay đổi demo local. Đọc contract và baseline trước khi chạy trên DB đích.

MariaDB test 11.8.6 chạy thật, skip-networking, chỉ private socket `/tmp/mcah01-real.sock`; datadir `/tmp/mcah01-real-db`. Test dùng tài khoản DBA chỉ trên server test riêng để tạo DB mới; **không dùng root/DBA cho runtime nghiệp vụ**. Các DB lỗi trong quá trình sửa SQL/harness được giữ, không sửa history hoặc reset. Bản cuối log `mcah-01-db.txt` PASS 38 checks trên DB mới; lỗi ban đầu cú pháp SQL/reserved `rank` và giả định ID/mã CHECK trong harness đã sửa trước nghiệm thu cuối. MariaDB CHECK errno 4025; mysql2 tên symbolic khác, test kiểm errno thực.

Từ `seasmart/backend/`:

```sh
export DB_HOST=localhost DB_USER=root DB_SOCKET=/tmp/mcah01-real.sock
export DB_NAME=mcah_01_test MCAH_INSTANCE=mcah_01_test MCAH_TEST_CONFIRM=mcah_01_test
export JWT_SECRET=local-schema-test-only-secret-32-characters
export UPLOAD_DIR=./storage/mcah01-test ANTHROPIC_API_KEY= DOC_READER_MODEL=
npm run test:contract
```

Script dùng database=undefined chỉ khi tạo hai DB timestamp mới. Tên target whitelist `mcah_01_*_test`; migration subprocess luôn có DB_NAME=MCAH_INSTANCE target. Không drop/reset; target phải là server test riêng. Nó dựng baseline 000…021 qua migrations gốc và checksum history, thêm dữ liệu synthetic, rồi gọi **runner thật** cho 022. Compare toàn bộ cột/row đã tồn tại; không so schema bổ sung như dữ liệu bị mất. Test snapshot/revision/audit mới riêng.

Sau schema test, dùng tên DB clean mới in trong log thay `<clean-test-db>`; script sau có upload PNG thật, nguồn private, JWT và XLSX thật, không gọi AI:

```sh
export DB_NAME=<clean-test-db> MCAH_INSTANCE=<clean-test-db> MCAH_TEST_CONFIRM=<clean-test-db>
export BOOTSTRAP_ADMIN_EMAIL=mcah01-regression@invalid.test
export BOOTSTRAP_ADMIN_PASSWORD=local-integration-test-only-123
npm run db:bootstrap
npm run test:integration
```

Đây là credential synthetic cho server test riêng, không dùng vận hành. Regression bổ sung kiểm API v1 từ chối tài liệu schema_version=2; restore schema version sau negative test. Test readiness tạm đổi state history 021 sang RUNNING rồi trả APPLIED. Không đổi checksum/schema để che lỗi migration.

Từ `seasmart/`:

```sh
npm run lint
npm test
npm run build
```

Bằng chứng: `mcah-01-db.txt`, `mcah-01-regression.txt`, `mcah-01-tests.txt`, `mcah-01-lint.txt`, `mcah-01-build.txt`. Artifact đầu vào schema là SQL synthetic, không phải kết quả provider hoặc parsing PDF. Test chứng minh mô hình chứa được identity + nhiều chuyến, không chứng minh pipeline extraction PDF. API nghiệp vụ v2 theo contract sẽ được triển khai trong task02…10.

Dừng test server chỉ bằng PID của `/tmp/mcah01-real.pid`, giữ datadir/DB. Không tác động server DB khác. Lần tái hiện sau khởi động datadir đó bằng mariadbd với đúng socket/skip-networking hoặc tạo datadir test mới; không reuse DB timestamp cũ để replay 022. Runner sẽ dừng migration incomplete; không sửa SQL đã áp ở môi trường đích.

Sau nghiệm thu đã dừng server bằng `mariadb-admin --socket=/tmp/mcah01-real.sock -u root shutdown` thành công; datadir và DB giữ nguyên. `git diff --check` PASS; HEAD seasmart giữ `6745e8ffd317d8defb54212cfddd1671738314ed`, Crew-Manning status sạch/HEAD giữ nguyên. Diff frontend vẫn chỉ đúng 2 dòng CSS và 16 thêm/1 sửa LoginPage.jsx của người dùng trước task; frontend/.env.local vẫn tồn tại, không bị đọc/in nội dung hoặc ghi lại. Hai tài liệu demo và frontend/.env.example untracked giữ nguyên.
