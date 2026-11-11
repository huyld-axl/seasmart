# MCAH — Kế hoạch app máy tính, giai đoạn 1: vỏ ứng dụng, một máy

- **Ngày lập:** 2026-11-11
- **Trạng thái:** chờ duyệt, chưa viết code.
- **Kế hoạch tổng:** `docs/mcah-ke-hoach-ung-dung-may-tinh.md`. Giai đoạn 1 ở mục 10; kết quả giai đoạn 0 ở mục 13.
- **Wireframe:** `docs/design/wireframes/desktop-gd1.html` (7 màn).
- **Testcase chạy tay:** `docs/mcah-testcase-desktop-gd1.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/mcah-huong-dan-desktop-gd1.html`. Chép vào `frontend/public/huong-dan/index.html` ở bước 10, khi phát hành bản máy tính.
- **Mục tiêu:** mọi màn hiện có chạy trong app trên **một máy** như bản web; gửi email qua app mail của máy; xuất PDF khi máy có hoặc cài thêm LibreOffice; việc theo giờ chạy đúng khi app chỉ mở trong giờ làm.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` và mục "Cách làm việc" của kế hoạch tổng trước. Quy ước code giữ nguyên.
2. Làm đúng thứ tự bước ở mục 6. Mỗi bước có "Xong khi"; chỉ sang bước sau khi mọi ý đều đúng.
3. **Phần nào chưa thử thật thì chưa xong, kể cả Windows.** Bước nào cần máy Windows mà chưa có: làm và thử phần Ubuntu, ghi "Windows: chờ máy" vào Nhật ký, đi tiếp; giai đoạn 1 chỉ xong khi các dòng đó đã thử.
4. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
5. Một commit cho cả giai đoạn, trên nhánh `dev`, message tiếng Việt. Không push nếu chưa được bảo.
6. Không đọc, không grep tệp `.env`.
7. **Bản web vẫn chạy như cũ.** Mọi khác biệt chỉ bật trong app máy tính (mục 3.1). Test hiện có của `backend/` và `frontend/` phải qua sau mỗi bước.

## 1. Đã có từ giai đoạn 0 (không làm lại)

| Có rồi | Ở đâu |
|---|---|
| Electron mở giao diện qua `app://`, API qua đường dẫn tương đối, chuyển tiếp sang Fastify | `desktop/src/main.js`, `desktop/vite.frontend.config.mjs` |
| Postgres nhúng: tạo, mở, tắt, dọn tiến trình mồ côi | `desktop/src/db.js` |
| Backend chạy bằng Node riêng, tự thoát khi app chết | `desktop/src/backend.js`, `backend-guard.js` |
| Đóng gói `.deb` / `.exe`, Node + Postgres + backend trong `resources/` | `desktop/scripts/stage.js`, `package.json` (`build`) |
| Tự cập nhật có chữ ký Ed25519 | `desktop/src/updater.js`, `scripts/release.js` |
| Mở thư kèm tệp (Thunderbird Ubuntu đạt; MAPI Windows chưa thử) | `desktop/src/mail.js` |
| Sao lưu / khôi phục bằng lệnh | `desktop/src/backup.js` (màn ở giai đoạn 4) |
| Đăng nhập qua trình duyệt bản thử | `desktop/src/browser-login.js`, `cloud/` (giai đoạn 2 làm thật) |

## 2. Phạm vi

### 2.1 Làm trong giai đoạn 1

1. Tên app, biểu tượng, một cửa sổ duy nhất, màn chờ và màn lỗi khởi động (wireframe 7).
2. Cầu nối an toàn giữa giao diện và app (`preload`): giao diện biết đang chạy trong app máy tính và gọi được vài việc của máy (mở thư, mở thư mục, cài thành phần, đọc / lưu cài đặt máy).
3. Chế độ máy tính trong backend: biến `MCAH_DESKTOP=1`, endpoint báo khả năng của máy, nhật ký ghi ra tệp xoay vòng.
4. Việc theo giờ chạy bù khi app mở muộn; thông báo hệ điều hành cho hạn chứng chỉ.
5. Xuất PDF: dò LibreOffice, hộp "Cần cài thành phần xuất PDF" (wireframe 5).
6. Gửi chủ tàu qua app mail (wireframe 1, 2, 3); cách phụ gửi thẳng SMTP theo từng người (wireframe 4).
7. Cài đặt trên máy này (wireframe 4) trong menu tài khoản.
8. Tạo tài khoản tạm: đặt mật khẩu ngay trên máy (wireframe 6).
9. Ẩn SMS (giữ code). Các tính năng cần internet (AI đọc giấy, tìm tàu) tắt vì bộ cài không có khoá, giao diện đã xử lý trạng thái "chưa cấu hình".

### 2.2 Không làm (ghi lại để khỏi làm nhầm)

- Đăng nhập qua trình duyệt, mời qua máy chủ dịch vụ, PIN, phiên 7 ngày: giai đoạn 2. Giai đoạn 1 đăng nhập kiểu cũ (email + mật khẩu trong app).
- Máy nhân viên, mạng nội bộ, chống ghi đè: giai đoạn 3.
- Mã hoá kho tệp, màn sao lưu, đường dẫn tệp tương đối: giai đoạn 4.
- Bảo vệ code, cầu chì Electron: giai đoạn 5.
- Không xoá code SMS, code responsive / mobile, code SMTP chung.
- Không sửa màn nào khác ngoài các chỗ ở mục 4.

## 3. Thiết kế kỹ thuật

### 3.1 Biết đang chạy trong app máy tính

- **Backend:** `desktop/src/backend.js` thêm `MCAH_DESKTOP=1` vào môi trường. `backend/src/config/index.js` thêm `desktop: process.env.MCAH_DESKTOP === '1'`.
- **Frontend:** `desktop/src/preload.js` (mới) dùng `contextBridge.exposeInMainWorld('mcah', { … })`. Giao diện kiểm `window.mcah` để biết. Gom vào một chỗ: `frontend/src/lib/desktop.js` (mới) xuất `isDesktop`, `desktop.openMail()`, … Màn nào cần thì gọi qua đây, không gọi `window.mcah` rải rác.
- `BrowserWindow` thêm `preload`, giữ `contextIsolation: true`, `sandbox: true`.
- Mỗi kênh IPC (`ipcMain.handle`) **kiểm dữ liệu vào**: kiểu, độ dài; đường dẫn tệp chỉ nhận tên tệp nằm trong thư mục app tự tạo, không nhận đường dẫn tuỳ ý từ giao diện.

| Kênh `window.mcah.*` | Làm gì |
|---|---|
| `openMail({ to, cc, bcc, subject, body, files })` | `files` là tên tệp trong thư mục gửi thư (3.5). Gọi `mail.openMail` |
| `mailStatus()` | `{ app: 'thunderbird' \| 'outlook' \| null }` |
| `openMailFolder()` | Mở thư mục gửi thư |
| `openExternal(kind)` | Chỉ hai địa chỉ cố định: `thunderbird`, `libreoffice` (trang tải chính thức) |
| `pdfComponent()` / `installPdfComponent()` | Trạng thái / cài LibreOffice (3.4), báo tiến độ qua sự kiện `pdf-install-progress` |
| `getSettings()` / `saveSettings(s)` | Cài đặt máy (3.6) |
| `smtpTest()` | Gửi thư thử bằng cấu hình SMTP đang lưu |
| `checkUpdate()` | Như menu "Kiểm tra bản mới" của giai đoạn 0 |

### 3.2 Khởi động, tên app, màn lỗi

- `package.json`: `name` → `mcah-desktop`, `productName` `MCAH`, `desktopName`, biểu tượng `desktop/build/icon.png` (512 px) và `icon.ico`. Thư mục dữ liệu thành `MCAH` (`app.setName('MCAH')` trước `whenReady`). Máy đã có `seasmart-desktop` từ giai đoạn 0 thì **không chuyển** (chỉ là dữ liệu thử).
- `app.requestSingleInstanceLock()`: mở app lần hai thì đưa cửa sổ cũ lên trước.
- Màn chờ: cửa sổ hiện ngay với `desktop/src/splash.html` (logo + "Đang mở…"), xong khởi động thì `loadURL('app://mcah/')`.
- Lỗi khởi động: `desktop/src/error.html` (wireframe 7), nhận mã lỗi qua query: `DB_START`, `DB_MIGRATE`, `BACKEND_START`, `DISK_FULL`. Nút Thử lại (`app.relaunch()`), Mở thư mục nhật ký, Thoát.
- **Trang hướng dẫn:** `HelpLink` mở `/huong-dan/…` bằng `target="_blank"`; `setWindowOpenHandler` của giai đoạn 0 chỉ cho `http(s)` ra trình duyệt ngoài nên trang hướng dẫn không mở được. Cho phép `app://mcah/huong-dan/*` mở trong một cửa sổ app riêng (không preload, chỉ đọc); mọi địa chỉ khác vẫn chặn.
- Bỏ menu Tài khoản trên thanh tiêu đề của giai đoạn 0 (chuyển vào menu tài khoản của giao diện, wireframe 4). Giữ menu Sửa (cắt / dán). Bỏ `MCAH_LOGIN_ON_START`.

### 3.3 Việc theo giờ và thông báo

- Hiện có 4 job (`backend/src/jobs.js`): 2h chứng chỉ hết hạn, 3h xoá tệp quá 180 ngày, 7h tạo thông báo hạn, 5 phút chạy lại giấy AI kẹt. Máy văn phòng thường tắt đêm nên 2h, 3h, 7h hay bị lỡ.
- Migration `043_job_run.sql`: bảng `job_run (name TEXT PRIMARY KEY, last_run_on DATE NOT NULL)`.
- Tách thân 3 job ngày ra hàm có tên (`expireCertificates`, `purgeTrash`, `notifyExpiry`). Hàm `runDaily(name, fn)`: chạy nếu `last_run_on < CURRENT_DATE` rồi ghi ngày; dùng `pg_try_advisory_lock` để không chạy chồng.
- Khi `config.desktop`: lúc khởi động gọi `runDaily` cho cả 3 (chạy bù), sau đó mỗi giờ gọi lại (`cron '0 * * * *'`). Bản web giữ lịch cũ.
- Thông báo hệ điều hành: `NotificationBell` đang hỏi thông báo định kỳ; khi `isDesktop` và có thông báo **mới** (id lớn hơn id lớn nhất đã thấy, lưu trong `localStorage`) thì hiện `new Notification(title, { body })`. Bấm thông báo → đưa cửa sổ lên và mở trang của thông báo (đường dẫn như khi bấm trong chuông). Không cần IPC: Electron cho phép Notification của web.

### 3.4 Xuất PDF và LibreOffice

- `backend/src/utils/xlsx_pdf.js` đọc `SOFFICE_PATH`. Desktop dò và đặt biến này trước khi mở backend:
  - Windows: `%ProgramFiles%\LibreOffice\program\soffice.exe`, `%ProgramFiles(x86)%\…`.
  - Ubuntu: `soffice` trên PATH, `/usr/bin/soffice`, `/snap/bin/libreoffice`, `/var/lib/flatpak/exports/bin/org.libreoffice.LibreOffice`.
- Backend: endpoint `GET /api/v1/system/capabilities` → `{ desktop, pdf: boolean, ai: boolean, vessel_lookup: boolean }`. `pdf` thử chạy `soffice --version` một lần, nhớ kết quả, xoá nhớ khi gọi `POST /system/capabilities/refresh`.
- Xuất PDF khi không có LibreOffice: hiện trả lỗi 500 chung. Đổi thành lỗi `{ statusCode: 424, message: 'Cần cài thành phần xuất PDF', code: 'PDF_COMPONENT_MISSING' }` ở `xlsx_pdf.js` (bắt `ENOENT` khi chạy `soffice`). `server.js` đã trả `message` cho mã < 500; thêm trả `code`.
- Giao diện: `frontend/src/api/client.js` bắt lỗi có `code === 'PDF_COMPONENT_MISSING'` → mở hộp wireframe 5 (component `PdfComponentModal`, đặt ở layout chung, mở bằng store nhỏ). Bản web không có `window.mcah` thì hộp chỉ hiện thông báo "liên hệ quản trị" như cũ.
- Cài: `desktop/src/pdf-component.js` (mới)
  - Ubuntu: `pkexec apt-get install -y --no-install-recommends libreoffice-calc-nogui` (đủ để chuyển xlsx → pdf, nhỏ hơn bản đủ). Tiến độ: đọc dòng ra của apt.
  - Windows: tải bộ cài MSI bản "Still" từ `download.documentfoundation.org`, kiểm SHA-256 lấy từ tệp `.sha256` cùng chỗ, chạy `msiexec /i … /passive` (Windows hỏi quyền quản trị). Tiến độ: phần trăm đã tải.
  - Xong thì dò lại, gọi `capabilities/refresh`, hộp tự làm lại việc xuất vừa bấm.

### 3.5 Gửi chủ tàu qua app mail

- Endpoint mới (backend, chỉ bật khi `config.desktop`), trong `opportunity.routes.js` + `opportunity_mail.service.js`:
  - `POST /opportunities/:id/mail/prepare` `{ candidate_ids }` → dùng lại phần tạo .zip của `send()` (tách hàm `buildAttachments`), ghi các .zip vào `MAIL_DIR` (biến môi trường do desktop đặt = thư mục gửi thư), trả `{ files: [{ name, size }] }`. Giữ giới hạn 20 MB.
  - `POST /opportunities/:id/mail/record` `{ candidate_ids, ship_owner_contact_id, to, cc, bcc, subject, body }` → `recordSend` như hiện nay.
- Thư mục gửi thư: `~/MCAH/Tệp gửi thư` (Ubuntu, vì Thunderbird snap không đọc thư mục ẩn; kết quả 0.10) và `%LOCALAPPDATA%\MCAH\Tệp gửi thư` (Windows). Dọn tệp cũ hơn 24 giờ mỗi lần mở app.
- `ComposeMailModal.jsx`: khi `isDesktop` và cài đặt là "app mail" → ẩn nút đính kèm thêm, nút chính "Mở trong app mail": `prepare` → `desktop.openMail` → đóng hộp → hộp hỏi "Đã gửi thư cho chủ tàu chưa?" (wireframe 2) → Đã gửi gọi `record`. `openMail` trả `{ opened: false }` (máy không có app mail) → hộp wireframe 3 trước, rồi vẫn hỏi.
- Windows: thử MAPI với Outlook bản Office, Outlook bản mới, Thunderbird. Outlook bản mới không nhận MAPI thì coi như không có app mail (hộp 3). Ghi kết quả vào kế hoạch tổng mục 13.

### 3.6 Cài đặt trên máy này, SMTP từng người

- Lưu ở `userData/settings.json`: `{ mailMode: 'app' | 'smtp', smtp: { provider, host, port, secure, user } }`. Mật khẩu SMTP mã hoá bằng `safeStorage` (két hệ điều hành), lưu riêng `userData/smtp.secret`. **Ubuntu không có kho bí mật an toàn** (`safeStorage.getSelectedStorageBackend() === 'basic_text'`) → không cho lưu mật khẩu, hiện "Máy chưa có kho mật khẩu an toàn, chỉ dùng được cách app mail" (theo review lần 2, mục 5.2 kế hoạch tổng).
- Trang mới `frontend/src/pages/admin/settings/DeviceSettingsPage.jsx`, đường dẫn `/cai-dat-may`, chỉ có khi `isDesktop`. Vào từ menu tài khoản (góc phải). Dựng bằng `Card`, `Radio`, `Form` của antd như các trang hiện có.
- Gửi thẳng SMTP: `email.service.js` thêm `sendWith(transportConfig, message)` tạo kết nối theo cấu hình truyền vào (không cache); `send()` cũ giữ nguyên cho bản web. `opportunity_mail.service.send()` nhận thêm `smtp` (từ giao diện, giao diện lấy từ `window.mcah` ngay lúc gửi). Mật khẩu chỉ đi trong body request tới máy chính (cùng máy, 127.0.0.1), không ghi log, không lưu DB.
- `smtpTest()`: gửi thư thử cho chính địa chỉ gửi.

### 3.7 Tạo tài khoản tạm

- `user.service.createUser` khi `config.desktop`: không gọi `sendInvite`, trả kèm `invite_token`. Màn Tài khoản hiện hộp wireframe 6; nút mở `/dat-mat-khau?token=…` trong app sau khi đăng xuất quản trị.
- "Gửi lại thư mời" → "Đặt mật khẩu" (tạo token mới, mở như trên). Endpoint hiện có `resend-invite` trả token khi `config.desktop`.

### 3.8 Ẩn SMS

- `ContactActions.jsx`: bỏ nút SMS khi `isDesktop` (hai chỗ). Không xoá code.

### 3.9 Nhật ký

- Desktop chuyển stdout / stderr của backend vào `userData/logs/backend.log`, xoay vòng 10 MB × 3 tệp (tự viết, không thêm thư viện). Log của tiến trình chính vào `main.log`.
- Pino của backend đang ghi `req.url` có thể chứa tên, số hộ chiếu trong query tìm kiếm: khi `config.desktop` đặt `logger: { level: 'warn' }` (bỏ log từng request). Lọc dữ liệu cá nhân kỹ hơn: giai đoạn 4.

## 4. File sẽ sửa / thêm

| File | Việc |
|---|---|
| `desktop/package.json` | Tên, biểu tượng, `desktopName`, thêm `build/` vào files |
| `desktop/src/main.js` | Khoá một cửa sổ, màn chờ, màn lỗi, preload, IPC, bỏ menu Tài khoản |
| `desktop/src/preload.js` (mới) | `contextBridge` |
| `desktop/src/ipc.js` (mới) | `ipcMain.handle` + kiểm dữ liệu vào |
| `desktop/src/settings.js` (mới) | Cài đặt máy, mật khẩu SMTP qua `safeStorage` |
| `desktop/src/pdf-component.js` (mới) | Dò, cài LibreOffice |
| `desktop/src/logs.js` (mới) | Ghi nhật ký xoay vòng |
| `desktop/src/mail.js` | Thư mục gửi thư theo hệ điều hành, dọn tệp cũ |
| `desktop/src/backend.js` | `MCAH_DESKTOP`, `SOFFICE_PATH`, `MAIL_DIR`, ống log |
| `desktop/src/splash.html`, `error.html`, `build/icon.*` (mới) | |
| `backend/src/config/index.js` | `desktop` |
| `backend/server.js` | Logger theo chế độ, trả `code` trong lỗi 4xx |
| `backend/src/jobs.js` + migration `043_job_run.sql` | Chạy bù |
| `backend/src/utils/xlsx_pdf.js` | Lỗi 424 `PDF_COMPONENT_MISSING` |
| `backend/src/routes/v1/system.routes.js` (mới) + `index.js` | `capabilities` |
| `backend/src/services/opportunity_mail.service.js`, `routes/v1/opportunity.routes.js` | `prepare`, `record`, SMTP từng người |
| `backend/src/services/email.service.js` | `sendWith` |
| `backend/src/services/user.service.js`, `routes/v1/users.js` | Token đặt mật khẩu khi desktop |
| `frontend/src/lib/desktop.js` (mới) | |
| `frontend/src/pages/admin/opportunities/ComposeMailModal.jsx` + hộp hỏi đã gửi | |
| `frontend/src/components/common/PdfComponentModal.jsx` (mới), `api/client.js` | |
| `frontend/src/pages/admin/settings/DeviceSettingsPage.jsx` (mới), `App.jsx`, menu tài khoản trong `layouts/AdminLayout.jsx` | |
| `frontend/src/components/common/NotificationBell.jsx` | Thông báo hệ điều hành |
| `frontend/src/pages/admin/users/UserListPage.jsx` | Hộp wireframe 6 |
| `frontend/src/components/ds/ContactActions.jsx` | Ẩn SMS khi desktop |

## 5. Test tự động thêm

- Backend (vitest): `runDaily` chạy một lần mỗi ngày, chạy bù khi `last_run_on` cũ; `xlsx_pdf` trả 424 khi `soffice` không có; `prepare` từ chối ứng viên không thuộc cơ hội và vượt 20 MB; `createUser` không gửi thư khi desktop.
- Frontend (vitest): `lib/desktop.js` khi có / không có `window.mcah`; `ComposeMailModal` hiện đúng nút theo chế độ; `client.js` mở hộp PDF khi gặp `PDF_COMPONENT_MISSING`.
- Desktop: `node --test desktop/test/*.test.js` cho phần thuần (kiểm dữ liệu IPC, chọn đường dẫn LibreOffice, xoay vòng log).

## 6. Các bước

### Bước 0 — Chuẩn bị

- Đọc lại mục 13 kế hoạch tổng. Chạy `npm test` của `backend/` và `frontend/`, ghi số test vào Nhật ký.
- **Xong khi:** test hiện có qua; `npm run dist:linux` trong `desktop/` vẫn ra `.deb` chạy được.

### Bước 1 — Tên app, một cửa sổ, màn chờ, màn lỗi (3.2)

- **Xong khi:** thư mục dữ liệu là `MCAH`; mở app lần hai chỉ đưa cửa sổ cũ lên; thấy màn chờ thay cửa sổ trắng; làm hỏng tạm thư mục `pgdata` (đổi tên `PG_VERSION`) thì hiện màn lỗi `DB_START`, Thử lại chạy lại app; bấm "Hướng dẫn" mở được trang hướng dẫn trong cửa sổ riêng; testcase G1, G2, G12.

### Bước 2 — Preload và `lib/desktop.js` (3.1)

- **Xong khi:** trong app `window.mcah` có đủ kênh ở bảng 3.1, trong trình duyệt thì không; gọi `openMail` với đường dẫn ngoài thư mục gửi thư bị từ chối (test desktop); test frontend qua.

### Bước 3 — Chế độ máy tính trong backend, nhật ký (3.1, 3.9)

- **Xong khi:** `GET /system/capabilities` trả đúng trong app và trả `desktop: false` ở bản web; có `logs/backend.log`, xoay vòng khi vượt 10 MB (test desktop); log không có dòng từng request.

### Bước 4 — Việc theo giờ chạy bù, thông báo hệ điều hành (3.3)

- **Xong khi:** test `runDaily` qua; đặt `last_run_on` về hôm qua, mở app → 3 job chạy một lần; có chứng chỉ hết hạn sau 7 ngày → mở app thấy thông báo của hệ điều hành, bấm vào mở đúng trang; testcase G3, G4.

### Bước 5 — Xuất PDF, cài LibreOffice (3.4)

- Gỡ LibreOffice trên máy thử Ubuntu trước khi thử (hoặc dùng máy ảo).
- **Xong khi:** máy chưa có LibreOffice bấm xuất PDF → hộp wireframe 5 → cài xong → tự xuất tiếp; xuất Excel luôn được; bản web vẫn báo lỗi như cũ; testcase A9 (kế hoạch tổng), G5. Windows: chờ máy.

### Bước 6 — Gửi chủ tàu qua app mail (3.5)

- **Xong khi:** testcase A5, A6, A7 (kế hoạch tổng) và G6, G7 qua trên Ubuntu (Thunderbird). Windows với Outlook bản Office, Outlook bản mới, Thunderbird: chờ máy, ghi kết quả vào mục 13.
- ⛔ **DỪNG** nếu Outlook bản mới trên Windows không nhận tệp đính kèm: báo người dùng, hỏi có chấp nhận "Outlook mới = như máy không có app mail" không.

### Bước 7 — Cài đặt trên máy này, SMTP từng người (3.6)

- **Xong khi:** đổi qua lại hai cách gửi, hộp soạn thư đổi nút theo; "Gửi thử cho tôi" với Gmail + mật khẩu ứng dụng nhận được thư (testcase A8); tìm mật khẩu trong mọi tệp của `userData` không thấy dạng rõ; máy Ubuntu không có kho bí mật thì không cho lưu mật khẩu; testcase G8.

### Bước 8 — Tạo tài khoản tạm, ẩn SMS (3.7, 3.8)

- **Xong khi:** tạo tài khoản trong app → hộp wireframe 6 → đặt mật khẩu → người đó đăng nhập được; bản web vẫn gửi thư mời; không thấy nút SMS trong app, bản web vẫn thấy; testcase G9.

### Bước 9 — Chạy hết các màn trong app

- Đi lần lượt mọi mục trong thanh bên và mọi nút tải tệp (xuất Excel, tải .zip, tải tệp giấy tờ) trong bản đã đóng gói.
- **Xong khi:** testcase G10, G11, G13, G14 qua; mọi lần tải tệp đều hiện hộp lưu của hệ điều hành và tệp mở được; `npm test` của `backend/`, `frontend/`, `desktop/` qua.

### Bước 10 — Hướng dẫn, đóng gói, Nhật ký

- Chép nội dung `docs/mcah-huong-dan-desktop-gd1.html` vào `frontend/public/huong-dan/index.html` (mục mới "Ứng dụng trên máy tính"), chỉ hiện khi trang chạy trong app (`location.protocol === 'app:'`), bản web giữ nguyên.
- `npm run dist:linux`, `npm run dist:win`; cài bản `.deb` thật (`apt install`) và chạy lại G1–G10.
- Ghi Nhật ký ở đây và mục 15 kế hoạch tổng; cập nhật mục 13 (Outlook, LibreOffice).
- **Xong khi:** mọi testcase của `docs/mcah-testcase-desktop-gd1.md` có kết quả; dòng Windows nào chưa thử ghi rõ.
- ⛔ **DỪNG:** báo kết quả, hỏi người dùng có commit không và có viết kế hoạch giai đoạn 2 không.

## 7. Rủi ro riêng giai đoạn này

| Rủi ro | Cách giảm |
|---|---|
| Outlook bản mới (Windows 11) không nhận MAPI | Coi như không có app mail; nhắc cài Thunderbird hoặc dùng SMTP (bước 6 DỪNG hỏi) |
| Cài LibreOffice cần quyền quản trị, văn phòng không có | Hộp ghi rõ; liên kết cài tay; xuất Excel vẫn được |
| `safeStorage` trên Ubuntu rơi về `basic_text` | Không lưu mật khẩu SMTP, chỉ cho cách app mail |
| Tải tệp (blob) trong Electron khác trình duyệt | Bước 9 thử mọi nút tải |
| Máy tắt đêm nên job 2h–7h không chạy | Chạy bù lúc mở app + mỗi giờ (3.3) |

## 8. Nhật ký

| Ngày | Bước | Việc | Ghi chú |
|---|---|---|---|
| 2026-11-11 | — | Lập kế hoạch, wireframe, testcase, hướng dẫn nháp | Chờ duyệt |
