# MCAH — Kế hoạch app máy tính, giai đoạn 4: thư mục hồ sơ, cập nhật an toàn, bảo mật

- **Ngày lập:** 2026-11-13 (viết lại cùng ngày theo Q14: không mã hoá)
- **Trạng thái:** đã duyệt 2026-11-13 (Q-B1, Q-B2 theo đề xuất); code bước 1–10 trên Ubuntu máy dev. Chờ: Windows (đường dẫn, BitLocker, fuses), bộ cài thật để thử quay về bản cũ (B9), đăng nhập thật để thử chuyển máy chính qua app (B5, B19), hai máy (B12 trên máy nhân viên).
- **Kế hoạch tổng:** `docs/mcah-ke-hoach-ung-dung-may-tinh.md` (mục 4.1 Q14, 5.2, 5.4, 5.5, 10 giai đoạn 4, 11 nhóm B).
- **Wireframe:** `docs/design/wireframes/desktop-gd4.html` (6 màn; màn Sao lưu, dải nhắc, Khôi phục đã bỏ theo Q15).
- **Testcase chạy tay:** `docs/mcah-testcase-desktop-gd4.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/mcah-huong-dan-desktop-gd4.html`, chép vào trang hướng dẫn ở bước 10.
- **Mục tiêu:** tài liệu trên máy chính nằm trong **một cây thư mục dễ đọc** (như văn phòng đang tự sắp xếp), app tự đặt tên, tự xếp, tự đổi tên khi hồ sơ đổi; **không có tính năng sao lưu cho người dùng** (Q15); cập nhật có đổi dữ liệu thì app tự chụp dữ liệu trước, lỗi thì tự quay về; chuyển máy chính do hỗ trợ MCAH làm bằng lệnh; đóng các lỗ bảo mật còn lại của app.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng và Nhật ký của `docs/mcah-ke-hoach-desktop-gd3.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả giai đoạn trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. **Bản web giữ nguyên cách lưu tệp** (tên ngẫu nhiên trong `UPLOAD_DIR`). Lớp kho tệp dùng chung, chỉ app máy tính bật cây thư mục dễ đọc. Test hiện có phải qua sau mỗi bước.
6. Quy tắc xoá tệp (`CLAUDE.md` mục 6.1) giữ nguyên: xoá / thay tệp vào thùng rác, 180 ngày mới rời ổ đĩa. Thùng rác nằm **ngoài** cây thư mục hồ sơ để người dùng không thấy tệp đã xoá.

## 1. Đã có / bỏ

| | Ở đâu | Giai đoạn này |
|---|---|---|
| Khoá dữ liệu, mật khẩu sao lưu, mã khôi phục lúc tạo văn phòng (giai đoạn 2) | `desktop/src/office.js`, `backup.js`, `FirstRunPage.jsx` | **Bỏ** (Q14). Tạo văn phòng chỉ còn đặt tên |
| Gói `.ssbak` mã hoá, lệnh `--backup` / `--restore` | `desktop/src/backup.js`, `main.js` | **Viết lại** thành tệp `.zip` thường, nhất quán (3.3); chỉ dùng nội bộ (trước cập nhật) và cho hỗ trợ MCAH chuyển máy, không có nút cho người dùng |
| Thùng rác tệp, job xoá sau 180 ngày | `backend/src/utils/file_trash.js`, `jobs.js` | Giữ, chuyển qua lớp kho tệp |
| Máy nhân viên, mã thiết bị, bộ cài qua mạng văn phòng | giai đoạn 3 | Giữ |
| Electron `contextIsolation`, `sandbox`, tắt `nodeIntegration` | `desktop/src/main.js` | Giữ, thêm 3.7 |

## 2. Phạm vi

### 2.1 Làm

1. **Lớp kho tệp + cây thư mục hồ sơ** (3.1, 3.2): mọi đọc / ghi / xoá tệp của backend qua một module; app máy tính lưu tệp vào cây thư mục dễ đọc; tự đổi tên / chuyển khi hồ sơ đổi; chịu được người dùng lỡ tay xoá / di chuyển tệp; thư mục tạm riêng.
2. **Bỏ mã hoá đã làm ở giai đoạn 2** (3.6): màn tạo văn phòng, khoá dữ liệu, mật khẩu sao lưu.
3. **Bản chụp nhất quán** (3.3): `.zip` thường, chỉ tạo tự động ngay trước khi cập nhật có đổi DB, và bằng lệnh `--backup` cho hỗ trợ MCAH. Không màn, không nút (Q15).
4. **Chuyển máy chính bằng lệnh** (3.4): hỗ trợ MCAH chạy `--backup` trên máy cũ, `--restore` trên máy mới; huỷ thiết bị và phiên cũ; đổi máy chính trên máy chủ dịch vụ; máy chính cũ ngừng phục vụ (W9).
5. **Cập nhật có đổi DB** (3.5, W8): chặn ghi → sao lưu → migration; lỗi thì khôi phục DB và quay về bản cũ.
6. **Mở thư mục hồ sơ, xuất ra thư mục** (3.2, W4, W5); quyền xuất hàng loạt.
7. **Kiểm mã hoá ổ đĩa máy chính** (3.7, W6) — giờ là lớp bảo vệ chính của tài liệu.
8. **Siết app** (3.7): CSP, tắt DevTools và cờ gỡ lỗi ở bản phát hành, kiểm nguồn gọi ở các cổng nội bộ, log không có dữ liệu cá nhân.
9. **Đồng ý lần đầu quét AI** (3.8, W7).

### 2.2 Không làm

- Mã hoá tài liệu, mã hoá cơ sở dữ liệu, mã hoá bản sao lưu (Q14).
- Đọc ngược thay đổi người dùng tự làm trong cây thư mục vào app (thêm tệp bằng tay không vào hồ sơ; sửa tên tay bị app đặt lại).
- Sao lưu lên máy chủ của bên mình.
- Mọi tính năng sao lưu cho người dùng: lịch tự động, nút "Sao lưu ngay", màn Sao lưu, dải nhắc, khôi phục từ app (Q15, 2026-11-13). Hệ quả, ghi rõ trong hướng dẫn: máy chính hỏng ổ / mất / dính mã độc là **mất dữ liệu**, trừ khi văn phòng tự chép thư mục hồ sơ và tự có cách sao lưu riêng (thư mục hồ sơ chép được, nhưng cơ sở dữ liệu thì không).

### 2.3 Cần người dùng / sếp trước khi xong giai đoạn

- **⛔ Q-B1:** quay về bản app cũ khi cập nhật lỗi cần bộ cài bản cũ. Đề xuất: máy chính giữ bộ cài của bản đang chạy (thư mục `lan-installers/current`) và cài lại nó. Ubuntu hỏi mật khẩu quản trị thêm một lần lúc quay về.
- **⛔ Q-B2:** thư mục hồ sơ đặt ở đâu trên máy chính. Đề xuất: `Tài liệu/MCAH - Hồ sơ` (Windows `Documents`, Ubuntu `~/Documents` hoặc thư mục Tài liệu theo XDG), đổi được trong Cài đặt (app chuyển cả cây).
- **Lưu ý cho khách (ghi vào hướng dẫn):** không có sao lưu trong app — văn phòng tự chịu việc giữ máy chính an toàn. Ai đăng nhập được tài khoản hệ điều hành của máy chính là mở được toàn bộ giấy tờ. Máy chính phải có mật khẩu đăng nhập và nên mã hoá ổ đĩa (W6).
- Máy Windows (đường dẫn dài, ký tự tiếng Việt trong tên tệp, BitLocker) và hai máy khác hệ điều hành cho B5.

## 3. Thiết kế

### 3.1 Lớp kho tệp (`backend/src/utils/file_store.js`)

- Bảng `stored_file` (migration `047_stored_file.sql`): `id`, `rel_path` (tương đối với gốc kho, dấu `/`), `kind`, `owner_type` + `owner_id` (thuyền viên / tàu / đối tác / lần gửi), `size`, `sha256`, `created_at`, `trashed_at`. Các cột đường dẫn cũ (`document_upload.storage_path`, ảnh trang, `seafarer_certificate.document_url`, `seafarer.photo_path`, `ship_owner.logo_path`, `opportunity_send_copy.storage_path`) đổi thành `stored_file_id`. Script `scripts/move-to-file-store.js` chuyển tệp sẵn có (máy dev, máy thử).
- API: `put(buffer | stream, { kind, owner, name }) → fileId`, `read(fileId)`, `stream(fileId)`, `trash(fileId, reason)`, `relocateOwner(owner)` (3.2). Gọi `put` xong mới ghi dòng nghiệp vụ; không sửa tệp tại chỗ (bản mới = tệp mới).
- **Hai cách xếp:** bản web — `flat` (như hiện nay: tên ngẫu nhiên trong `UPLOAD_DIR`); app máy tính — `readable` (cây ở 3.2). Service không biết đang dùng cách nào.
- **Tệp phát sinh** (ảnh từng trang, ảnh thu nhỏ, ảnh chân dung cỡ nhỏ) không phải giấy tờ của người dùng → để trong `<userData>/cache/` tên ngẫu nhiên, vẫn qua `stored_file`, vẫn vào bản chụp (3.3).
- **Chuyển các service:** `document.service`, `certificate.service`, `seafarer.service` (chân dung), `fleet.service` (logo), `seafarer_send.service`, `opportunity_mail.service`, `export_pack.service`, `form_export.service`, `import.routes`, `file_trash`.
- **Test chặn:** quét mã nguồn backend, báo lỗi khi thấy `fs.*` với `UPLOAD_DIR` / gốc kho ngoài `file_store.js` và `tmp_dir.js` (như test mốc CSS).
- **Thư mục tạm (`utils/tmp_dir.js`):** `<userData>/tmp` (web: `os.tmpdir()/mcah`); `xlsx_pdf.js`, bản xem tạm, tệp gửi thư dùng nó; xoá ngay sau việc; dọn toàn bộ lúc app khởi động.

### 3.2 Cây thư mục hồ sơ trên máy chính

- **Gốc:** theo Q-B2. Cấu trúc và quy tắc đặt tên đúng mục 5.5 kế hoạch tổng (`Thuyền viên/NGUYỄN VĂN AN - <mã>/01 Giấy tờ tuỳ thân/Hộ chiếu - C1234567 - hết hạn 2030-05-01.pdf`, `Bản cũ/`, `Tàu/`, `Đối tác/`, tên trùng thêm ` (2)`, bỏ ký tự cấm, đường dẫn < 200 ký tự). Logic đặt tên thuần trong `utils/readable_tree.js`, có test.
- **`Đọc tôi.txt` ở gốc:** "Thư mục này do MCAH quản lý. Xem và copy thoải mái. Muốn thêm, sửa, xoá giấy tờ thì làm trong app; đổi tên hoặc xoá tệp ở đây có thể làm app không tìm thấy tệp."
- **Tự đổi tên / chuyển** khi đổi họ tên hoặc mã thuyền viên, loại giấy, số giấy, ngày hết hạn, tên tàu / IMO, tên đối tác, hoặc có bản mới (bản cũ vào `Bản cũ/`): DB đổi `rel_path` trong cùng transaction với thay đổi hồ sơ và ghi một dòng `file_move` (từ → tới); sau khi commit thì chuyển trên đĩa (đổi tên thư mục một lần cho cả người); lỗi (tệp đang mở trên Windows, mất điện) thì job thử lại mỗi phút và lúc khởi động. Đọc tệp: không thấy ở `rel_path` thì thử đường cũ trong `file_move` chưa xong.
- **Người dùng lỡ tay xoá / di chuyển:** đọc không thấy tệp → tìm trong cây theo `sha256` + cỡ (chỉ khi cần, có giới hạn thời gian); thấy thì cập nhật `rel_path`; không thấy thì trang hồ sơ hiện "Tệp không còn trong thư mục hồ sơ" và cho tải lại tệp. Job hằng ngày đếm tệp thiếu, báo quản trị trong chuông.
- **Thùng rác:** `<userData>/trash/` (ngoài cây), giữ 180 ngày như cũ.
- **Mở thư mục hồ sơ (W4):** máy chính mở thẳng thư mục thật của người đó bằng `shell.openPath`. Máy nhân viên không với tới ổ máy chính: tải danh sách `GET /api/v1/files/tree?scope=…` + từng tệp qua HTTPS, dựng bản xem tạm chỉ đọc trong `tmp/xem/`, xoá khi đóng app / đăng xuất / sau 24 giờ.
- **Xuất ra thư mục (W5):** cả hai loại máy dùng cùng danh sách, chép vào nơi người dùng chọn. Quyền mới `seafarer.export_bulk`; mở thư mục một người theo `seafarer.view` / `seafarer.docs`.

### 3.3 Bản chụp nhất quán (nội bộ)

- Tệp `MCAH sao lưu <văn phòng> <năm-tháng-ngày giờ>.zip` (zip64, ghi theo luồng): `manifest.json` (văn phòng, bản app, bản DB, danh sách tệp + `sha256`), `db.dump` (`pg_dump`), `Hồ sơ/…` (cây thư mục y nguyên — mở zip ra là đọc được), `cache/…`, `trash/…`.
- Thứ tự: khoá tư vấn `backup` (job xoá tệp 180 ngày và job chuyển tệp `file_move` đều lấy khoá này nên chờ) → `pg_dump` → đọc danh sách `stored_file` **từ chính bản dump** → chép từng tệp (đường trong dump; không thấy thì đường hiện tại theo `id`) → nhả khoá.
- Ghi ra `.zip.part`, đọc lại kiểm `sha256` từng tệp, rồi đổi tên. Lỗi (đầy ổ, tắt điện): xoá `.part`, không cập nhật (3.5).
- Chỉ tạo ở hai chỗ (Q15): trước khi cập nhật có đổi DB (`<userData>/before-update.zip`, chỉ giữ một bản, xoá sau khi bản mới chạy ổn 7 ngày) và lệnh `--backup=<tệp>` (hỗ trợ MCAH). Không màn, không nút, không lịch, không bảng `backup_run`.
- Cần chỗ trống ≈ cỡ thư mục hồ sơ + DB; thiếu thì không cập nhật và báo quản trị.

### 3.4 Chuyển máy chính bằng lệnh (hỗ trợ MCAH)

1. Trên máy mới, sau khi quản trị đăng nhập: `mcah --restore=<tệp>` → đọc `manifest.json` (văn phòng, ngày, bản app). Màn Lần đầu **không** có lựa chọn khôi phục (giữ ẩn như giai đoạn 2).
2. Kiểm: tài khoản đăng nhập là quản trị của văn phòng trong gói (theo vé); bản app trong gói ≤ bản đang chạy; đủ chỗ trống trên ổ.
3. Nạp DB (`pg_restore`), giải nén cây hồ sơ vào gốc kho của máy mới (Q-B2), `cache`, `trash`; kiểm `sha256`. Đường dẫn tương đối nên khác hệ điều hành vẫn đúng; tên quá dài trên Windows thì cắt theo quy tắc đặt tên và cập nhật `rel_path`.
4. **Trước khi mở cổng 7443:** đánh `removed` mọi `office_device`, đổi `jwt-secret`, đối chiếu thành viên với máy chủ dịch vụ (ai đã bị gỡ thì khoá ở máy này).
5. Đổi máy chính trên máy chủ dịch vụ: API mới `POST /api/offices/:id/machine` bằng vé quản trị **có `auth_time` trong 10 phút** (đăng nhập lại trên trình duyệt), gửi khoá máy mới; máy chủ thu hồi khoá cũ, ghi audit, gửi thư cho mọi quản trị. Rồi báo chứng chỉ mới như giai đoạn 3.
6. Máy chính cũ: lần gọi máy chủ dịch vụ kế tiếp bị từ chối `machine_replaced` → W9, đóng cổng 7443.
7. Lỗi giữa chừng: xoá những gì vừa nạp, máy về trống, thử lại được.

### 3.5 Cập nhật có đổi DB

- `latest.json` thêm `has_migrations`. Có thì máy chính: cờ bảo trì (backend trả 503 `MAINTENANCE` cho lệnh ghi; đọc vẫn được) → chờ request và job đang chạy (tối đa 60 giây) → sao lưu đầy đủ vào `<userData>/before-update.zip` → cài bản mới → bản mới chạy migration.
- Migration lỗi: khôi phục DB từ `before-update.zip` (tệp không bị migration đụng), ghi mã lỗi, cài lại bộ cài bản cũ (Q-B1), mở lại và hiện W8.
- Máy nhân viên khi máy chính bảo trì: dải "Máy chính đang cập nhật", lưu báo lỗi và giữ form.

### 3.6 Bỏ mã hoá của giai đoạn 2

- `FirstRunPage`: tạo văn phòng chỉ còn bước đặt tên (bỏ mật khẩu sao lưu, mã khôi phục, kiểm nhóm 2 và 5).
- `office.js`: bỏ `prepare`, `dataKey`, `unwrapDataKey`; giữ `machineKey`. `backup.js`: bỏ `setupKeys`, `wrap`, `unwrap`, mã hoá gói; lệnh `--backup-setup` bỏ, `--backup` / `--restore` dùng `.zip` mới.
- Máy đã tạo văn phòng ở bản thử: xoá `data-key.bin`, `data-key-wraps.json`, tệp khoá sao lưu lúc khởi động.

### 3.7 Mã hoá ổ đĩa và siết app

- **Mã hoá ổ đĩa:** Windows — PowerShell không cần quyền quản trị, đọc `System.Volume.BitLockerProtection` của ổ chứa thư mục hồ sơ và thư mục dữ liệu. Ubuntu — `lsblk -J -o NAME,TYPE,MOUNTPOINT`, tìm cha có `TYPE=crypt`. Kết quả `on` / `off` / `unknown`, kiểm lúc mở app và mỗi ngày; `off` hiện ở W6 và dải nhắc quản trị (một lần mỗi ngày, đóng được).
- **CSP** cho `app://mcah`: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'`. Chạy chế độ chỉ ghi log một bước trước khi chặn thật.
- **Bản phát hành:** chặn mở DevTools; Electron fuses (`@electron/fuses`) tắt `--inspect`, `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`.
- **Cổng nội bộ:** cổng nhận vé và cổng ký từ chối request có `Origin` hoặc `Host` lạ; cổng nhận vé chỉ mở lúc chờ đăng nhập.
- **Log:** lọc trước khi ghi — email, số điện thoại, số hộ chiếu / CCCD, họ tên → `[đã ẩn]`; không log body request; **không log đường dẫn tệp trong cây hồ sơ** (có tên thuyền viên), chỉ log `fileId`.

### 3.8 Đồng ý lần đầu quét AI

- Cột `user.ai_consent_at` (migration `048_ai_consent.sql`). `ScanButton` hỏi W7 khi chưa có; đồng ý thì `POST /api/v1/me/ai-consent`. Backend từ chối gọi AI khi chưa đồng ý (409 `AI_CONSENT_REQUIRED`). Bản web hỏi như nhau.

## 4. File sẽ sửa / thêm

| Phần | File |
|---|---|
| backend mới | `utils/file_store.js`, `utils/readable_tree.js`, `utils/tmp_dir.js`, `routes/v1/files.routes.js`, `plugins/maintenance.js`, migration `047_stored_file.sql`, `048_ai_consent.sql`, `scripts/move-to-file-store.js` |
| backend sửa | các service ở 3.1, `file_trash.js`, `xlsx_pdf.js`, `jobs.js` (chuyển tệp, đếm tệp thiếu), `constants/permissions.js`, logger |
| desktop | `backup.js` (viết lại: zip, dump-trước-chép, `.part`, khoá), `disk-encryption.js`, `readable-view.js` (bản xem tạm, xuất), `office.js` (bỏ khoá dữ liệu), `main.js`, `backend.js` (gốc kho), `updater.js` (bảo trì, quay về), `logs.js`, `ipc.js`, `preload.js`, `browser-login.js`, `signer.js`, cấu hình build (fuses) |
| cloud | `POST /api/offices/:id/machine`, từ chối máy cũ `machine_replaced`, thư báo quản trị, test |
| frontend | `FirstRunPage.jsx` (bỏ bước mật khẩu), nút Mở thư mục ở chi tiết thuyền viên / tàu / đối tác, hộp Xuất ở danh sách, "Tệp không còn trong thư mục hồ sơ", `ScanButton` (đồng ý), trang hướng dẫn |

## 5. Rủi ro riêng

| Rủi ro | Cách xử lý |
|---|---|
| Người dùng sửa / xoá / di chuyển tệp trong cây hồ sơ | `Đọc tôi.txt`; tự tìm lại theo `sha256`; báo tệp thiếu. Không có bản sao lưu để lấy lại tệp đã xoá tay |
| Máy chính hỏng / mất là mất dữ liệu (Q15) | Ghi rõ trong hướng dẫn và lúc tạo văn phòng; hỗ trợ MCAH có lệnh `--backup` khi khách cần |
| Đổi tên thư mục lỗi trên Windows khi tệp đang mở trong Word / trình xem PDF | Hàng đợi `file_move`, thử lại mỗi phút; đọc tệp theo cả đường cũ |
| Đường dẫn dài / ký tự tiếng Việt trên Windows | Giới hạn 200 ký tự, chuẩn hoá Unicode NFC, test trên Windows trước khi xong bước 2 |
| Chuyển 10 service sang kho tệp làm hỏng bản web | Bản web dùng cách `flat`; làm từng service, mỗi cái có test; thử lại tải lên, xem, xuất CV, gửi hồ sơ trên bản web |
| Bản xuất không mã hoá bị lộ | Cảnh báo ở hộp Xuất; hướng dẫn nói rõ |
| CSP chặn thứ antd / thư viện cần | Chế độ chỉ ghi log trước |

## 6. Test tự động

- backend: `file_store` (cả `flat` lẫn `readable`: ghi / đọc / luồng / thùng rác), test chặn `fs`, `readable_tree` (cấu trúc, tên trùng, ký tự cấm, bản cũ, đường dẫn < 200, NFC), đổi tên thuyền viên → tệp chuyển đúng, tệp bị di chuyển tay → tìm lại theo `sha256`, bảo trì 503, đồng ý AI.
- desktop: sao lưu dump-trước-chép (tệp tạo sau dump không vào gói; tệp xoá / chuyển giữa lúc chép vẫn có), `.part` khi lỗi, khôi phục gói hỏng không đụng máy, lọc log.
- cloud: đổi máy chính cần vé quản trị mới đăng nhập, máy cũ bị từ chối.

## 7. Các bước

### Bước 0 — Chuẩn bị
**⛔ DỪNG** hỏi Q-B1, Q-B2 nếu chưa được trả lời lúc duyệt.

### Bước 1 — Bỏ mã hoá của giai đoạn 2 (3.6)
**Xong khi:** tạo văn phòng chỉ hỏi tên; máy thử cũ mở lên không lỗi và đã xoá tệp khoá; test qua.

### Bước 2 — Lớp kho tệp, cây thư mục hồ sơ (3.1, 3.2)
**Xong khi:** test qua; bản web tải lên, xem, xuất CV, gửi hồ sơ, logo, chân dung chạy như cũ; trên app, cây thư mục đúng mục 5.5; đổi tên thuyền viên / thêm bản mới thì tệp chuyển đúng; B13, B15, B17 qua.

### Bước 3 — Bản chụp nhất quán (3.3)
**Xong khi:** B8, B18, B20 qua bằng lệnh `--backup`; mở `.zip` bằng trình giải nén thấy đúng cây hồ sơ.

### Bước 4 — Chuyển máy chính bằng lệnh, đổi máy chính trên máy chủ dịch vụ (3.4, W9)
**Xong khi:** B5, B19 qua bằng lệnh; gói hỏng / gói văn phòng khác bị từ chối, máy vẫn trống (B5 khác hệ điều hành: ⛔ cần máy Windows, không có thì "Chờ máy").

### Bước 5 — Cập nhật có đổi DB, quay về (3.5, W8)
**Xong khi:** B9 qua với bản thử có migration cố ý lỗi.

### Bước 6 — Mở thư mục hồ sơ, xuất ra thư mục (3.2, W4, W5)
**Xong khi:** B12, B14, B16 qua, trên máy chính và máy nhân viên.

### Bước 7 — Kiểm mã hoá ổ đĩa (3.7, W6)
**Xong khi:** Ubuntu có / không LUKS báo đúng; Windows chờ máy.

### Bước 8 — Siết app (3.7)
**Xong khi:** B3, B4, B10 qua; C6 (DevTools, `--inspect`) qua trên bản đóng gói.

### Bước 9 — Đồng ý lần đầu quét AI (3.8, W7)
**Xong khi:** chưa đồng ý thì không gửi ảnh nào (kiểm bằng log máy chủ dịch vụ); đồng ý một lần dùng cho mọi máy.

### Bước 10 — Hướng dẫn, Nhật ký
Chép nháp hướng dẫn vào trang Hướng dẫn (và bỏ đoạn mật khẩu sao lưu / mã khôi phục của giai đoạn 2), cập nhật kế hoạch tổng §15, ghi Nhật ký. **Xong khi:** người dùng duyệt.

## 8. Nhật ký

- 2026-11-13: lập kế hoạch (bản có mã hoá), rồi viết lại cùng ngày theo Q14: không mã hoá tài liệu và bản sao lưu, tài liệu lưu thẳng cây thư mục dễ đọc. Q15 cùng ngày: bỏ mọi tính năng sao lưu cho người dùng (lịch, nút "Sao lưu ngay", màn Sao lưu, dải nhắc, khôi phục từ app); chỉ còn bản chụp tự động trước khi cập nhật và lệnh `--backup` / `--restore` cho hỗ trợ MCAH chuyển máy. Chờ duyệt.
- 2026-11-13: duyệt, code.
  - Lúc code phát hiện giấy AI đọc không có tệp riêng (một PDF tải lên chứa nhiều giấy). Hỏi lại, người dùng chọn giữ kế hoạch: thư mục hồ sơ là nơi chứa tệp thật, giấy AI đọc được cắt thành tệp riêng (`file_layout.service` `cutDocument`, pdf-lib; ảnh nhiều trang ghép PDF) vào cột mới `seafarer_certificate.tree_file`. Bản tải lên nhiều giấy và ảnh trang vẫn ở kho nội bộ.
  - **Khác thiết kế 3.1:** không đổi cột đường dẫn sang `stored_file_id`; các cột cũ giữ tên, lưu mã tệp `hs:` / `u:` (`file_store.abs` vẫn đọc đường dẫn cũ). `stored_file` chỉ giữ sha256 + cỡ để tìm lại tệp bị di chuyển tay. Sắp thư mục bằng hàng đợi `file_relayout` (worker 5 giây, chỉ app máy tính), chuyển tệp ghi `file_move` trước, khác ổ thì chép rồi xoá.
  - **Khác thiết kế 3.5:** quay về khi cập nhật lỗi dùng bản chép nguyên thư mục DB (`pgdata-truoc-cap-nhat`, chép lúc Postgres đã tắt) thay vì `.zip`, vì bản mới không có migration cũ để nạp lại. Bản mới có đổi DB hay không: so `last_migration` trong `latest.json` (script phát hành tự ghi) với migration cuối của bản đang chạy.
  - Đã thử trên máy dev: tạo thư mục hồ sơ đúng nhóm, bản cũ vào `Bản cũ/`, đổi tên thuyền viên thì thư mục đổi theo, tệp bị di chuyển tay vẫn đọc được, xoá giấy thì tệp ra thùng rác ngoài cây; cắt giấy AI đọc 2/3 trang đúng; bản web vẫn lưu tên ngẫu nhiên. Chụp `.zip` từ DB dev và `--restore` sang máy trống (đủ DB + thư mục hồ sơ), tệp hỏng bị từ chối, máy vẫn trống. Migration cố ý lỗi → DB được trả về. API danh sách / tải tệp thư mục hồ sơ, mã tệp lạ bị từ chối. CSP: giao diện chạy, mã chèn trong dữ liệu không chạy. Kiểm mã hoá ổ đĩa báo đúng `off` trên máy dev. Đồng ý AI: chưa đồng ý 409, đồng ý một lần thì qua.
  - Chưa làm: dải nhắc mã hoá ổ đĩa ở mọi trang (chỉ hiện trong thẻ máy chính); job hằng ngày đếm tệp thiếu báo quản trị; đổi chỗ thư mục hồ sơ trong Cài đặt (mới đọc `filesDir` từ cài đặt / biến môi trường); thuyền viên bị xoá mềm thì thư mục vẫn còn trong cây; ảnh nhỏ (thumbnail) của tệp đã xoá không vào thùng rác (tệp phát sinh, tạo lại được).
