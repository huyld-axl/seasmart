# MCAH — Kế hoạch app máy tính, giai đoạn 5: bảo vệ code

- **Ngày lập:** 2026-11-13
- **Trạng thái:** đã duyệt 2026-11-13; code bước 0–6 và 8 trên Ubuntu. Chờ máy Windows cho bước 7 (C1, C6 Windows, Defender, dịch bytecode bản Windows).
- **Kế hoạch tổng:** `docs/mcah-ke-hoach-ung-dung-may-tinh.md` (mục 6 bảo vệ sản phẩm, 10 giai đoạn 5, 11 nhóm C).
- **Wireframe:** không có — giai đoạn này không thêm hay đổi màn nào.
- **Hướng dẫn sử dụng:** không có — người dùng không thấy gì khác.
- **Testcase chạy tay:** `docs/mcah-testcase-desktop-gd5.md`.
- **Mục tiêu:** người mở thư mục cài đặt không đọc được code như mã nguồn; sửa gói app trên Windows thì app không chạy; không gắn được trình gỡ lỗi vào bản phát hành; bộ cài không chứa bí mật nào. App vẫn chạy như cũ và không bị Windows Defender báo nhầm.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng và Nhật ký của `docs/mcah-ke-hoach-desktop-gd4.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả giai đoạn trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. **Chỉ đổi cách đóng gói**, không đổi code nghiệp vụ (trừ chỗ đường dẫn ở 3.2). Bản web, chạy dev (`npm start`) và mọi test hiện có giữ nguyên.
6. Nói thật về mức độ (kế hoạch tổng 6.1): đây là làm **khó** đọc, khó sửa, không phải không thể. Lớp quan trọng nhất (L1) đã có: giá trị nằm trên máy chủ dịch vụ.

## 1. Hiện trạng (đo trên bản đóng gói Ubuntu hiện tại)

| Phần | Nằm ở đâu trong bộ cài | Đọc được không |
|---|---|---|
| Backend (phần xử lý nghiệp vụ) | `resources/backend/` — mã JS nguyên văn + `node_modules` | **Đọc được như mã nguồn** (lỗ lớn nhất) |
| Vỏ app (tiến trình chính Electron) | `resources/app.asar` — `src/*.js` nguyên văn | Đọc được (asar giải nén bằng một lệnh) |
| Giao diện (frontend) | `app.asar/dist/frontend` — đã nén bởi Vite | Khó đọc; cần kiểm không kèm source map |
| Postgres, Node riêng, module biên dịch sẵn | `resources/postgres`, `resources/node`, `node_modules` | Không phải code của mình |
| Cầu chì Electron (tắt `--inspect`, chạy như Node, chỉ nạp từ asar, kiểm toàn vẹn asar) | `package.json` `electronFuses` (giai đoạn 4) | Đã bật, chưa thử trên bản đóng gói |
| Chặn mở DevTools ở bản phát hành | `main.js` (giai đoạn 4) | Đã có, chưa thử trên bản đóng gói |
| Quét bí mật trong bộ cài | `desktop/scripts/scan-secrets.js` (giai đoạn 2) | Có; thiếu vài mẫu ở mục 6.3 |

## 2. Phạm vi

### 2.1 Làm

1. **Backend thành một khối bytecode** (3.1, 3.2): gom `server.js` và `scripts/migrate.js` bằng esbuild (nén), rồi dịch sang bytecode V8 (`bytenode`) bằng **chính bản Node đi kèm bộ cài**; bộ cài chỉ còn tệp `.jsc` + một tệp nạp vài dòng.
2. **Vỏ app thành bytecode** (3.3): gom `src/main.js` (và các module) thành một khối, dịch bytecode bằng Electron cùng bản; `preload.js` giữ JS nhưng nén (preload chạy trong sandbox không nạp được bytecode).
3. **Frontend không kèm source map** (3.4).
4. **Cầu chì và toàn vẹn gói** (3.5): kiểm `electronFuses` trên bản đóng gói; Windows bật kiểm toàn vẹn `app.asar`.
5. **Quét bí mật đủ mục 6.3** (3.6): thêm mẫu thiếu, quét cả `.jsc`.
6. **Máy chủ dịch vụ: cảnh báo dùng bất thường** (3.7, lớp L6): trang quản trị nội bộ đánh dấu văn phòng dùng AI / tra tàu tăng vọt hoặc đổi máy chính nhiều lần.
7. **Kiểm Windows Defender** (3.8) với bộ cài mới.

### 2.2 Không làm

- Giấy phép, bản quyền (L2–L4, kế hoạch tổng mục 7; M8 không làm).
- Chống gỡ lỗi kiểu hung hăng, trình điều khiển cấp nhân, khoá USB (kế hoạch tổng 6.2).
- Ký bộ cài Windows (M4 chưa vội; giai đoạn 6).
- Làm rối tên biến / luồng (obfuscator): dễ bị Defender báo nhầm và làm chậm; bytecode đã đủ cho mục tiêu "không đọc được như mã nguồn".

### 2.3 Cần trước khi xong giai đoạn

- **⛔ Máy Windows** cho C1 (sửa gói → không chạy), C6 trên Windows và Windows Defender. Không có thì ghi "Chờ máy", các phần Ubuntu vẫn làm.

## 3. Thiết kế

### 3.1 Backend: esbuild + bytenode

- Script mới `desktop/scripts/build-backend.js` chạy trong `stage.js` thay cho chép mã nguồn:
  1. esbuild gom `backend/server.js` → `server.bundle.js`, `backend/scripts/migrate.js` → `migrate.bundle.js` (CommonJS, `platform: node`, `minify`, không source map).
  2. **Để ngoài khối** (vẫn nằm trong `node_modules` của bộ cài): module có phần biên dịch sẵn hoặc nạp động — `sharp`, `bcrypt`, `pdfjs-dist` (nạp bằng `import()` trong `document_pages.service.js`), `pg-native` nếu có. Danh sách chốt ở bước 1 bằng cách chạy thử.
  3. Dịch `*.bundle.js` → `*.jsc` bằng `bytenode` **chạy bằng tệp Node đi kèm bộ cài** (`dist/stage/<os>/node/node`): bytecode chỉ chạy được trên đúng bản V8 đã dịch. Bản Windows phải dịch bằng Node Windows → chạy `stage:win` trên Windows (hoặc Wine); **⛔** nếu không dịch chéo được thì bản Windows dịch trên máy Windows ở giai đoạn 6.
  4. Bộ cài chỉ còn: `server.js` (3 dòng: nạp `bytenode`, nạp `server.jsc`), `migrate.js` tương tự, `*.jsc`, `migrations/` (SQL), `src/templates/`, mẫu biểu, `node_modules` phần chạy. **Không còn thư mục `src/` mã nguồn.**
- Kiểm bytecode: `bytenode` không giữ được `Function.prototype.toString()`; tìm trong backend chỗ dùng (`fastify` không dùng cho route; kiểm ở bước 1 bằng toàn bộ test chạy trên bản bytecode).

### 3.2 Đường dẫn trong backend khi đã gom khối

- Gom khối làm `__dirname` của mọi module thành thư mục chứa khối → 9 chỗ dùng `__dirname` trong backend (mẫu thư, mẫu biểu, migration, public…) đọc sai chỗ.
- Sửa: một module `src/config/paths.js` trả `BACKEND_ROOT` (= biến môi trường do app đặt, hoặc thư mục gốc backend khi chạy dev / bản web) và các thư mục con; 9 chỗ đổi sang dùng nó. Bản web và test chạy như cũ.

### 3.3 Vỏ app: bytecode Electron

- esbuild gom `src/main.js` + các module (`session`, `lan-*`, `backup`, `updater`…) → `main.bundle.js` (để ngoài: `electron`, `pg`, `bonjour-service`, `yazl`, `yauzl`, `@peculiar/x509`, `pdf-lib` không dùng ở vỏ…), dịch `main.jsc` bằng `bytenode` chạy **bằng Electron** (`ELECTRON_RUN_AS_NODE=1` lúc build, máy build; cầu chì chỉ tắt cờ này trong bản phát hành).
- `package.json` `main` của bản đóng gói trỏ tệp nạp `main.js` 2 dòng; `src/` không vào asar (chỉ `main.jsc`, `preload.js` đã nén, `pages/`).
- `npm start` (dev) vẫn chạy `src/main.js` như cũ.

### 3.4 Frontend

- `vite.frontend.config.mjs`: `build.sourcemap = false` (mặc định đã tắt; ghi rõ và có kiểm trong `scan-secrets`: bộ cài không có tệp `.map`).

### 3.5 Cầu chì và toàn vẹn gói

- Đọc lại cầu chì trên bản đóng gói bằng `npx @electron/fuses read --app <tệp chạy>`; phải khớp `electronFuses`.
- Windows: `enableEmbeddedAsarIntegrityValidation` + `onlyLoadAppFromAsar` → sửa một byte trong `app.asar` thì app không mở (C1). Ubuntu: Electron chưa hỗ trợ, ghi nhận (C2).
- Chặn DevTools: thử phím tắt trên bản đóng gói (C6). Cờ `--inspect`, `--remote-debugging-port`: cầu chì tắt `--inspect`; `--remote-debugging-port` là cờ Chromium, chặn trong `main.js` bằng cách thoát nếu thấy cờ này ở bản đóng gói.

### 3.6 Quét bí mật

- Thêm mẫu: `VESSEL_API_BASE_URL`, `SMS_WEBHOOK_TOKEN` có giá trị, tên tệp `ships_plain.db`, khoá riêng Ed25519 dạng PEM (đã có mẫu PEM chung), tệp `.map`.
- Quét cả nội dung `.jsc` (chuỗi trong bytecode vẫn ở dạng đọc được — đây đúng là chỗ cần quét).
- `npm run dist:*` dừng nếu quét thấy (đã có).

### 3.7 Máy chủ dịch vụ: dùng bất thường (L6)

- Trang `/quan-tri` (giai đoạn 2) thêm cột "Cảnh báo": văn phòng có số trang AI hoặc lượt tra tàu trong 24 giờ gấp 5 lần trung bình 30 ngày của chính văn phòng đó (và > 50), hoặc đổi máy chính quá 2 lần trong 30 ngày (từ `audit` `office_machine_replace`). Chỉ hiển thị, không tự khoá.

### 3.8 Windows Defender

- Quét bộ cài và thư mục cài bằng Microsoft Defender (quét theo yêu cầu) trên máy Windows sạch; bytecode `.jsc` từng bị một số phần mềm diệt virus báo nhầm. Bị báo thì **⛔ DỪNG**, báo người dùng, cân nhắc bỏ bytecode cho vỏ app và chỉ giữ cho backend.

## 4. File sẽ sửa / thêm

| Phần | File |
|---|---|
| desktop | `scripts/build-backend.js`, `scripts/build-main.js` (mới); `scripts/stage.js`, `scripts/scan-secrets.js`, `package.json` (`main`, `files`, script `dist:*`, devDependencies `esbuild`, `bytenode`), `src/main.js` (chặn `--remote-debugging-port`) |
| backend | `src/config/paths.js` (mới), 9 chỗ dùng `__dirname`, `server.js` / `scripts/migrate.js` không đổi hành vi |
| frontend | `desktop/vite.frontend.config.mjs` (`sourcemap: false`) |
| cloud | `src/routes/admin.js` (cột cảnh báo), test |

## 5. Rủi ro riêng

| Rủi ro | Cách xử lý |
|---|---|
| Bytecode lệch bản V8 → app không mở | Dịch bằng đúng tệp Node / Electron đi kèm bộ cài; bộ cài có bước tự kiểm (`node server.js --check`) trước khi đóng gói |
| esbuild gom sai module nạp động | Chạy toàn bộ test backend trên khối đã gom (bước 1) và thử tay các luồng tệp (tải giấy, AI, PDF, gửi thư) trên bản đóng gói |
| Dịch bytecode Windows trên máy Linux không được | Dịch trên máy Windows ở giai đoạn 6 (⛔ 3.1) |
| Defender báo nhầm `.jsc` | 3.8 |
| Lỗi chỉ xảy ra trên bản đóng gói khó tìm | Log lỗi kèm tên hàm vẫn còn trong bytecode (esbuild giữ tên khi `keepNames`) |

## 6. Test tự động

- desktop: `scan-secrets` bắt được mẫu mới (thư mục thử có `.map`, `ships_plain.db`, `SMS_WEBHOOK_TOKEN=…`); khối backend gom xong nạp được và trả `/health`.
- backend: test hiện có chạy thêm một lần trên khối đã gom (script `test:bundle`), không cần bytecode.
- cloud: cột cảnh báo đúng với dữ liệu thử (tăng vọt / đổi máy nhiều lần / bình thường).

## 7. Các bước

### Bước 0 — Đo hiện trạng
Đóng gói Ubuntu hiện tại, ghi lại cỡ bộ cài, thời gian mở app, danh sách thư mục mã nguồn đọc được. **Xong khi:** có số đo để so ở bước 6.

### Bước 1 — Đường dẫn backend, gom khối backend (3.1 bước 1–2, 3.2)
**Xong khi:** test backend qua cả trên mã nguồn lẫn trên khối đã gom; bản web chạy như cũ.

### Bước 2 — Bytecode backend trong bộ cài Ubuntu (3.1 bước 3–4)
**Xong khi:** bộ cài Ubuntu không còn `resources/backend/src`; app mở, đăng nhập, tải giấy tờ, quét AI, xuất PDF, gửi thư, thư mục hồ sơ chạy như trước; C4 (phần backend) qua.

### Bước 3 — Bytecode vỏ app, nén preload (3.3)
**Xong khi:** `app.asar` không còn `src/*.js` nguyên văn; mọi luồng giai đoạn 1–4 thử nhanh qua (đăng nhập, PIN, máy nhân viên, mở thư mục hồ sơ, cập nhật); C4 qua.

### Bước 4 — Frontend, cầu chì, DevTools, cờ gỡ lỗi (3.4, 3.5)
**Xong khi:** C2 (ghi nhận), C6 qua trên Ubuntu; đọc cầu chì khớp cấu hình.

### Bước 5 — Quét bí mật đủ mục 6.3 (3.6)
**Xong khi:** C3 qua; test `scan-secrets` qua.

### Bước 6 — Máy chủ dịch vụ: cảnh báo dùng bất thường (3.7)
**Xong khi:** test cloud qua; trang `/quan-tri` hiện cột cảnh báo; C5 thử lại (không vé, vé hết hạn, văn phòng bị khoá) qua.

### Bước 7 — Windows (3.1 bước 3, 3.5, 3.8)
**⛔ DỪNG** nếu chưa có máy Windows: báo người dùng, để C1, C6 (Windows), Defender "Chờ máy". **Xong khi:** C1, C6 qua trên Windows, Defender không báo.

### Bước 8 — Nhật ký
So số đo với bước 0 (cỡ bộ cài, thời gian mở app), ghi Nhật ký, cập nhật kế hoạch tổng §15. **Xong khi:** người dùng duyệt.

## 8. Nhật ký

- 2026-11-13: lập kế hoạch, testcase. Chờ duyệt.
- 2026-11-13: duyệt, code.
  - Số đo bản Ubuntu (`linux-unpacked`): **trước** 696 MB, 91 tệp mã nguồn backend + 20 tệp vỏ app đọc được nguyên văn, 3.272 tệp `.map`, mở tới màn đăng nhập 2,5–3,8 giây. **Sau** 658 MB, backend chỉ còn `server.jsc` / `scripts/migrate.jsc` + tệp nạp, vỏ app chỉ còn `app-build/main.jsc` + `preload.js` đã nén, 0 tệp `.map`, mở 2,9–3,0 giây.
  - **Khác thiết kế 3.1:** esbuild chỉ gom code của MCAH (`packages: 'external'`); toàn bộ thư viện trong `node_modules` để ngoài khối như cũ (không phải code của mình, tránh hỏng module nạp động). `src/config/paths.js` + `MCAH_BACKEND_ROOT` thay 5 chỗ `__dirname` chạy lúc dùng (4 chỗ còn lại là script dev).
  - Vỏ app dựng ra `desktop/app-build/` (cùng cấp `src/`, đường dẫn tương đối giữ nguyên), bộ cài dùng `extraMetadata.main`; `npm start` vẫn chạy `src/`.
  - Đã thử trên bản đóng gói: mở app, migration chạy; backend bytecode trả danh sách, ảnh nhỏ, thư mục hồ sơ, tải cả bộ giấy tờ, xuất biểu mẫu Excel và PDF. Cầu chì đọc lại khớp cấu hình. `--remote-debugging-port`, `--inspect` → app thoát, không mở cổng. Quét bí mật sạch.
  - Lỗi phát hiện khi đóng gói: chữ `<ngày>` trong hộp Xuất hồ sơ (commit M1) làm frontend không dựng được — đã sửa.
  - Bản Windows: build chéo từ Linux chỉ gom + nén backend, **chưa dịch bytecode** (script in cảnh báo); phải build trên Windows trước khi phát hành.
  - Chưa thử: bấm phím tắt DevTools trên bản đóng gói (menu app chỉ có Sửa, và có chặn khi DevTools mở); luồng đăng nhập thật + máy nhân viên trên bản bytecode.
