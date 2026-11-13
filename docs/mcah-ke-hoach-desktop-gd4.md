# MCAH — Kế hoạch app máy tính, giai đoạn 4: kho tệp, sao lưu, bảo mật

- **Ngày lập:** 2026-11-13
- **Trạng thái:** chờ duyệt. Chưa code.
- **Kế hoạch tổng:** `docs/mcah-ke-hoach-ung-dung-may-tinh.md` (mục 5.1–5.5, 10 giai đoạn 4, 11 nhóm B).
- **Wireframe:** `docs/design/wireframes/desktop-gd4.html` (9 màn).
- **Testcase chạy tay:** `docs/mcah-testcase-desktop-gd4.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/mcah-huong-dan-desktop-gd4.html`, chép vào trang hướng dẫn ở bước 11.
- **Mục tiêu:** tài liệu trên máy chính luôn mã hoá; sao lưu tự động mỗi ngày ra ngoài máy chính và khôi phục được sang máy khác (kể cả khác hệ điều hành); cập nhật có đổi dữ liệu mà lỗi thì tự quay về; người dùng vẫn xem / xuất được tài liệu dạng thư mục thường khi cần; đóng các lỗ bảo mật còn lại của app.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng và Nhật ký của `docs/mcah-ke-hoach-desktop-gd3.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả giai đoạn trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. **Bản web giữ nguyên hành vi.** Lớp kho tệp dùng chung cho cả hai bản; bản web không có khoá dữ liệu nên tệp không mã hoá (như hiện nay), chỉ đổi cách đặt tên và nơi gọi. Test hiện có phải qua sau mỗi bước.
6. Quy tắc xoá tệp (`CLAUDE.md` mục 6.1) giữ nguyên: xoá / thay tệp vẫn qua thùng rác, 180 ngày mới rời ổ đĩa.

## 1. Đã có (không làm lại)

| Có rồi | Ở đâu |
|---|---|
| Khoá dữ liệu 32 byte (két hệ điều hành), bọc bằng mật khẩu sao lưu và mã khôi phục lúc tạo văn phòng | `desktop/src/office.js`, `backup.js` (`setupKeys`, `wrap`, `unwrap`) |
| Gói `.ssbak` mã hoá (khoá gói bọc hai cách), sao lưu / khôi phục bằng lệnh `--backup`, `--restore` | `desktop/src/backup.js`, `main.js` (`runCli`) |
| Thùng rác tệp, job xoá sau 180 ngày | `backend/src/utils/file_trash.js`, `jobs.js` |
| Máy nhân viên, mã thiết bị, dấu vân tay máy chính trên máy chủ dịch vụ | giai đoạn 3 |
| Electron: `contextIsolation`, `sandbox`, tắt `nodeIntegration`, link ngoài mở bằng trình duyệt | `desktop/src/main.js` |
| Cập nhật có chữ ký, bộ cài cho máy nhân viên qua mạng văn phòng | `desktop/src/updater.js` |

## 2. Phạm vi

### 2.1 Làm

1. **Lớp kho tệp** (3.1): mọi đọc / ghi / xoá tệp của backend qua một module; tệp mã hoá trên app máy tính; DB lưu mã tệp tương đối; test chặn `fs` thẳng vào kho; thư mục tạm riêng, dọn lúc khởi động.
2. **Sao lưu nhất quán** (3.3): chép đúng các tệp mà ảnh DB trỏ tới, khoá job xoá tệp suốt lúc sao lưu, kiểm toàn vẹn, ghi tạm rồi đổi tên; lịch hằng ngày, giữ 7 ngày + 4 tuần; màn Sao lưu (W1), dải nhắc (W2).
3. **Khôi phục từ app** (3.4, W3): khác máy, khác hệ điều hành; huỷ thiết bị và phiên cũ; đổi máy chính trên máy chủ dịch vụ; máy chính cũ ngừng phục vụ (W9).
4. **Đổi mật khẩu sao lưu, tạo mã khôi phục mới** (W1).
5. **Cập nhật có đổi DB** (3.5, W8): chặn ghi → sao lưu → migration; lỗi thì khôi phục DB và quay về bản cũ.
6. **Mở thư mục hồ sơ, xuất hồ sơ ra thư mục** (3.6, W4, W5); quyền xuất hàng loạt.
7. **Kiểm mã hoá ổ đĩa máy chính** (3.7, W6).
8. **Siết app** (3.8): CSP, tắt DevTools và cờ gỡ lỗi ở bản phát hành, kiểm nguồn gọi ở các cổng nội bộ, log không có dữ liệu cá nhân.
9. **Đồng ý lần đầu quét AI** (3.9, W7).

### 2.2 Không làm

- Mã hoá cơ sở dữ liệu (kế hoạch tổng 5.1: dựa vào mã hoá ổ đĩa).
- Sao lưu lên máy chủ của bên mình (khách tự chọn nơi để; Drive / OneDrive dùng được vì gói đã mã hoá).
- Chống crack, bytecode: giai đoạn 5.

### 2.3 Cần người dùng / sếp trước khi xong giai đoạn

- **⛔ Q-B1:** quay về bản app cũ khi cập nhật lỗi cần bộ cài bản cũ. Đề xuất: máy chính giữ bộ cài của bản đang chạy (đã có thư mục `lan-installers`) và cài lại nó. Cần duyệt vì Ubuntu sẽ hỏi mật khẩu quản trị thêm một lần lúc quay về.
- Máy Windows (BitLocker / Mã hoá thiết bị, đường dẫn tệp) và hai máy khác hệ điều hành cho B5.
- Một ổ USB để thử rút giữa chừng (B18).

## 3. Thiết kế

### 3.1 Lớp kho tệp (`backend/src/utils/file_store.js`)

- API: `put(buffer | stream, { kind, ext }) → fileId`, `read(fileId) → Buffer`, `stream(fileId) → Readable`, `trash(fileId, reason)`, `exists(fileId)`. `fileId` = `<kind>/<2 ký tự>/<32 hex ngẫu nhiên>` (vd. `doc/a3/a3f…`), không chứa tên người.
- `kind`: `doc` (tệp gốc), `page` (ảnh trang), `thumb`, `cert`, `photo`, `logo`, `send` (ZIP đã gửi), `import`, `export`.
- **Mã hoá (app máy tính):** AES-256-GCM theo khối 64 KB, mỗi khối nonce riêng + tag; đầu tệp `MCAHF1` + mã khoá. Đọc theo luồng để PDF lớn không nạp hết vào bộ nhớ. Khoá dữ liệu do tiến trình chính gửi cho backend qua **stdin** lúc khởi động (không qua biến môi trường, vì biến môi trường đọc được ở `/proc`). Bản web: không khoá → tệp thường, cùng cách đặt tên.
- **Quy tắc:** ghi tệp xong mới ghi dòng DB; tệp không bao giờ sửa tại chỗ (bản mới = mã mới); xoá chỉ qua `trash`.
- **DB:** các cột đường dẫn (`document_upload.storage_path`, ảnh trang, `seafarer_certificate.document_url`, `seafarer.photo_path`, `ship_owner.logo_path`, `opportunity_send_copy.storage_path`) lưu `fileId`. Migration `047_file_store.sql` + script `scripts/move-to-file-store.js` chuyển tệp cũ (máy dev, máy thử) sang kho mới, mã hoá nếu có khoá.
- **Chuyển các service:** `document.service`, `certificate.service`, `seafarer.service` (chân dung), `fleet.service` (logo), `seafarer_send.service`, `opportunity_mail.service`, `export_pack.service`, `form_export.service`, `import.routes`, `file_trash`.
- **Test chặn:** quét mã nguồn backend, báo lỗi khi thấy `fs.*` với `UPLOAD_DIR` / `config.upload` ngoài `file_store.js` và `tmp_dir.js` (như test mốc CSS).
- **Thư mục tạm (`utils/tmp_dir.js`):** `<userData>/tmp` (web: `os.tmpdir()/mcah`); `xlsx_pdf.js`, bản xem tạm, tệp gửi thư dùng nó; xoá ngay sau việc; tiến trình chính xoá toàn bộ lúc khởi động và lúc thoát.

### 3.2 Khoá dữ liệu khi chạy

- Tiến trình chính đọc khoá dữ liệu từ két (`office.dataKey()`), ghi vào stdin của backend một dòng JSON rồi đóng. Backend giữ trong bộ nhớ; chưa nhận được khoá thì mọi API tệp trả 503.
- Máy nhân viên không có khoá: tệp luôn đọc qua máy chính (HTTPS), không ghi ra đĩa ngoài thư mục tạm.

### 3.3 Sao lưu nhất quán và lịch

- Viết lại `createBackup`: `pg_dump` → đọc danh sách `fileId` **từ chính bản dump** (bảng có cột tệp) → chép đúng các tệp đó (vẫn mã hoá) + thùng rác còn hạn → gói. Khoá tư vấn Postgres `backup_files` giữ từ đầu tới cuối; `purgeExpired` lấy cùng khoá nên không xoá tệp giữa lúc chép.
- Ghi ra `<tên>.ssbak.part`, đọc lại toàn bộ kiểm mã băm, rồi đổi tên. Lỗi (ENOSPC, rút USB, tắt điện): xoá `.part`, ghi lần thất bại, báo ở W1.
- Lịch: job `runDaily('backup', 12:00)` của tiến trình chính (không phải backend, vì cần két và nơi để của máy); mở app sau 12:00 mà hôm đó chưa có thì chạy bù. Giữ 7 bản ngày + 4 bản tuần (bản Chủ nhật), xoá bản cũ hơn **chỉ trong thư mục sao lưu của MCAH**.
- Nơi để: thư mục người dùng chọn (USB, ổ mạng, thư mục Drive / OneDrive). Cùng ổ với dữ liệu thì cảnh báo vàng.
- `backup_run` (bảng ở máy chính): lúc, cỡ, nơi để, ra ngoài ổ máy chính hay không, kết quả. Backend trả `last_external_backup_at` để giao diện hiện dải W2 cho quản trị (> 7 ngày).

### 3.4 Khôi phục từ app

1. Màn Lần đầu (giai đoạn 2) bật "Khôi phục từ bản sao lưu" → W3. Chọn tệp → đọc đầu gói (tên văn phòng, ngày, bản app) → mật khẩu hoặc mã khôi phục.
2. Kiểm: tài khoản đang đăng nhập là quản trị của văn phòng trong gói (theo vé); bản app trong gói ≤ bản đang chạy.
3. Nạp DB, chép tệp, bọc lại khoá dữ liệu bằng két máy mới (dùng lại `restoreBackup`).
4. Sau nạp, **trước khi mở cổng 7443:** xoá mọi `office_device` (đánh `removed`), đổi `jwt-secret`, đối chiếu thành viên với máy chủ dịch vụ (ai đã bị gỡ thì khoá ở máy này).
5. Đổi máy chính trên máy chủ dịch vụ: API mới `POST /api/offices/:id/machine` bằng vé quản trị **có `auth_time` trong 10 phút** (đăng nhập lại trên trình duyệt), gửi khoá máy mới; máy chủ thu hồi khoá cũ, ghi audit, gửi thư cho mọi quản trị. Rồi báo chứng chỉ mới như giai đoạn 3.
6. Máy chính cũ: lần gọi máy chủ dịch vụ kế tiếp bị từ chối `machine_replaced` → W9, đóng cổng 7443, không phục vụ máy nhân viên nữa.

### 3.5 Cập nhật có đổi DB

- `latest.json` thêm `has_migrations`. Có thì tiến trình chính máy chính: đặt cờ bảo trì (backend trả 503 `MAINTENANCE` cho mọi lệnh ghi; đọc vẫn được) → chờ request đang chạy và job xong (tối đa 60 giây) → sao lưu đầy đủ vào `<userData>/before-update.ssbak` → cài bản mới → bản mới khởi động chạy migration.
- Migration lỗi: bản mới khôi phục DB từ `before-update.ssbak` (tệp không bị migration đụng), ghi mã lỗi, rồi cài lại bộ cài bản cũ đã giữ (⛔ Q-B1), mở lại và hiện W8 phải.
- Máy nhân viên khi máy chính bảo trì: dải "Máy chính đang cập nhật", lưu báo lỗi và giữ form (như mất nối).

### 3.6 Mở thư mục hồ sơ, xuất ra thư mục

- Backend: `GET /api/v1/files/tree?scope=seafarer:<id>|vessel:<id>|partner:<id>|seafarers:<ids>|all` trả danh sách `{ path, fileId, size }` theo cấu trúc và quy tắc đặt tên mục 5.5 kế hoạch tổng (logic thuần trong `utils/readable_tree.js`, có test). `GET /api/v1/files/:fileId` trả tệp đã giải mã (kiểm quyền theo bản ghi chứa tệp).
- Tiến trình chính (cả máy chính lẫn máy nhân viên): tải danh sách + từng tệp, ghi vào `tmp/xem/<mã>` (mở thư mục) hoặc thư mục người dùng chọn (xuất), đặt chỉ đọc, kèm `Đọc tôi.txt`, mở bằng `shell.openPath`.
- Quyền mới `seafarer.export_bulk` ("Xuất hồ sơ hàng loạt ra thư mục") trong `permissions.js`; mở thư mục một người theo `seafarer.view` / `seafarer.docs`.

### 3.7 Kiểm mã hoá ổ đĩa

- Windows: PowerShell không cần quyền quản trị, đọc thuộc tính `System.Volume.BitLockerProtection` của ổ chứa dữ liệu (1 = bật). Ubuntu: `lsblk -J -o NAME,TYPE,MOUNTPOINT` tìm cha của điểm gắn thư mục dữ liệu có `TYPE=crypt`.
- Kết quả: `on` / `off` / `unknown`, kiểm lúc mở app và mỗi ngày; `off` hiện ở W6 và dải nhắc quản trị (một lần mỗi ngày, đóng được).

### 3.8 Siết app

- CSP cho mọi trang `app://mcah`: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'`. Kiểm antd chạy được (inline style), Google Fonts gói kèm.
- Bản phát hành: chặn mở DevTools (`devtools-opened` → đóng), Electron fuses tắt `--inspect` / `ELECTRON_RUN_AS_NODE` / `NODE_OPTIONS` (`@electron/fuses` lúc build).
- Cổng nội bộ: cổng nhận vé (`browser-login`) và cổng ký (`signer`) từ chối request có `Origin` hoặc `Host` lạ; cổng nhận vé chỉ mở lúc chờ đăng nhập (kiểm lại).
- Log: lọc trước khi ghi (`logs.js` + logger backend) — email, số điện thoại, số hộ chiếu / CCCD, họ tên trong body thay bằng `[đã ẩn]`; không log body request.

### 3.9 Đồng ý lần đầu quét AI

- Cột `user.ai_consent_at`. `ScanButton` (dùng chung) hỏi W7 khi chưa có; đồng ý thì `POST /api/v1/me/ai-consent`. Backend từ chối gọi AI khi chưa đồng ý (409 `AI_CONSENT_REQUIRED`). Bản web: hỏi như nhau.

## 4. File sẽ sửa / thêm

| Phần | File |
|---|---|
| backend mới | `utils/file_store.js`, `utils/tmp_dir.js`, `utils/readable_tree.js`, `routes/v1/files.routes.js`, `routes/v1/backup.routes.js` (trạng thái sao lưu cho giao diện), `plugins/maintenance.js`, migration `047_file_store.sql`, `048_backup_run.sql`, `049_ai_consent.sql`, `scripts/move-to-file-store.js` |
| backend sửa | các service ở 3.1, `file_trash.js`, `xlsx_pdf.js`, `jobs.js`, `constants/permissions.js`, logger |
| desktop | `backup.js` (dump-trước-chép, `.part`, khoá), `backup-schedule.js` mới, `disk-encryption.js` mới, `readable-export.js` mới, `main.js`, `backend.js` (khoá qua stdin), `updater.js` (bảo trì, quay về), `logs.js`, `ipc.js`, `preload.js`, `browser-login.js`, `signer.js`, cấu hình build (fuses) |
| cloud | `POST /api/offices/:id/machine` (đổi máy chính), từ chối máy cũ `machine_replaced`, thư báo quản trị, test |
| frontend | `pages/admin/settings/BackupSettingsPage.jsx`, `FirstRunPage.jsx` (khôi phục), dải nhắc (gộp với `MainLinkRibbon`), nút Mở thư mục ở chi tiết thuyền viên / tàu / đối tác, hộp Xuất ở danh sách, `ScanButton` (đồng ý), trang hướng dẫn |

## 5. Rủi ro riêng

| Rủi ro | Cách xử lý |
|---|---|
| Chuyển 10 service sang kho tệp làm hỏng tải / xem tệp ở bản web | Làm từng service, mỗi cái có test đọc–ghi; thử lại tải lên, xem, xuất CV, gửi hồ sơ trên bản web sau bước 2 |
| Mã hoá theo luồng làm chậm xem PDF / ảnh trang | Đo xem 1 PDF 20 MB và trang danh sách giấy tờ trước / sau; chậm hơn 30% thì xem lại cỡ khối |
| Mất khoá dữ liệu do lỗi code | Viết khoá chỉ ở một chỗ (`office.js`); test khôi phục bằng mã khôi phục trên máy trống sau mỗi thay đổi khoá |
| CSP chặn thứ antd / thư viện cần | Bật CSP ở chế độ báo cáo (log) một bước trước khi chặn thật |
| Quay về bản cũ trên Windows khi bộ cài cũ không còn | Giữ bộ cài bản đang chạy trong `lan-installers/current` trước khi cập nhật |

## 6. Test tự động

- backend: `file_store` (ghi / đọc / luồng / sai khoá / tệp hỏng), test chặn `fs`, `readable_tree` (cấu trúc, tên trùng, ký tự cấm, bản cũ, đường dẫn < 200), bảo trì 503, đồng ý AI.
- desktop: sao lưu dump-trước-chép (tệp tạo sau dump không vào gói, tệp xoá giữa lúc chép vẫn có), `.part` khi lỗi, giữ 7 + 4, khôi phục sai mật khẩu không đụng máy, lọc log.
- cloud: đổi máy chính cần vé quản trị mới đăng nhập, máy cũ bị từ chối.

## 7. Các bước

### Bước 0 — Chuẩn bị
Đo tốc độ đọc PDF / ảnh trang hiện tại (mốc so sánh). **⛔ DỪNG** hỏi Q-B1 nếu chưa được trả lời lúc duyệt.

### Bước 1 — Lớp kho tệp, chưa mã hoá (3.1)
`file_store.js`, `tmp_dir.js`, migration + script chuyển, chuyển mọi service, test chặn `fs`. **Xong khi:** test qua; bản web tải lên, xem, xuất CV, gửi hồ sơ, logo, chân dung chạy như cũ; B17 qua.

### Bước 2 — Mã hoá kho tệp trên app máy tính (3.1, 3.2)
Khoá qua stdin, AES-GCM theo khối. **Xong khi:** B2, B11, B13 qua; tốc độ đạt mốc bước 0.

### Bước 3 — Sao lưu nhất quán, lịch, màn Sao lưu, dải nhắc (3.3, W1, W2)
**Xong khi:** B8, B18, B20 qua; sao lưu tự chạy lúc 12:00 và chạy bù khi mở app.

### Bước 4 — Đổi mật khẩu sao lưu, mã khôi phục mới (W1)
**Xong khi:** mật khẩu mới mở được bản sao lưu mới; mã khôi phục cũ không mở được bản mới.

### Bước 5 — Khôi phục từ app, đổi máy chính (3.4, W3, W9)
**Xong khi:** B5, B6, B7, B19 qua (B5 khác hệ điều hành: ⛔ cần máy Windows, không có thì ghi "Chờ máy").

### Bước 6 — Cập nhật có đổi DB, quay về (3.5, W8)
**Xong khi:** B9 qua với bản thử có migration cố ý lỗi.

### Bước 7 — Mở thư mục hồ sơ, xuất ra thư mục (3.6, W4, W5)
**Xong khi:** B12, B14, B15, B16 qua, trên máy chính và máy nhân viên.

### Bước 8 — Kiểm mã hoá ổ đĩa (3.7, W6)
**Xong khi:** Ubuntu có / không LUKS báo đúng; Windows chờ máy.

### Bước 9 — Siết app (3.8)
**Xong khi:** B3, B4, B10 qua; C6 (DevTools, `--inspect`) qua trên bản đóng gói.

### Bước 10 — Đồng ý lần đầu quét AI (3.9, W7)
**Xong khi:** chưa đồng ý thì không gửi ảnh nào (kiểm bằng log máy chủ dịch vụ); đồng ý một lần dùng cho mọi máy.

### Bước 11 — Hướng dẫn, Nhật ký
Chép nháp hướng dẫn vào trang Hướng dẫn, cập nhật kế hoạch tổng §15, ghi Nhật ký. **Xong khi:** người dùng duyệt.

## 8. Nhật ký

- 2026-11-13: lập kế hoạch, wireframe, testcase, nháp hướng dẫn. Chờ duyệt.
