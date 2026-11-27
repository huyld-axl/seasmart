# Catoro — Kế hoạch đổi tên hệ thống từ MCAH

- **Ngày lập:** 2026-11-26
- **Trạng thái:** đã chốt mục 2.3 (2026-11-26). Chưa viết code, chờ người dùng cho bắt đầu Bước 1.
- **Tên mới:** **Catoro** — *Crew Agency Tools for Onboarding, Records & Operations*. Viết hoa chữ đầu (`Catoro`) trong câu; `catoro` cho tên kỹ thuật.
- **Logo:** designer đang làm. Đợt này dùng **logo tạm** (mục 3.1); khi có logo thật chỉ thay một tệp nguồn rồi chạy lại script.
- **Testcase chạy tay:** `docs/catoro-testcase-doi-ten.md`.
- **Mục tiêu:** người dùng, khách và tài liệu chỉ còn thấy tên Catoro. Máy đang chạy MCAH 0.9.x cập nhật lên bản mới mà **không mất dữ liệu, không phải đăng nhập lại, không phải ghép lại máy nhân viên, không cài thành hai app song song**.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` và "Luật phiên bản" trong `docs/catoro-quy-trinh-phat-hanh.md` trước.
2. Làm đúng thứ tự bước ở mục 7, mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả việc trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. Test hiện có (`cloud/`, `backend/`, `desktop/`, `frontend/`) phải qua sau mỗi bước. Việc chạm `desktop/` chỉ xong khi `npm run dist:linux` chạy được.
6. **Không sửa migration đã chạy** (`backend/migrations/postgres/*.sql`, `cloud/migrations/*.sql`), kể cả comment nhắc tên tệp `docs/mcah-*.md`.

## 1. Nguyên tắc: tách "tên người thấy" và "tên máy dùng"

MCAH xuất hiện ở khoảng 330 tệp, chia ba lớp:

| Lớp | Ví dụ | Cách làm |
|---|---|---|
| **A. Người thấy** | Chữ trên màn, tiêu đề cửa sổ, splash, email, trang hướng dẫn, điều khoản, bộ cài, tên app trong menu Start / Ubuntu, thư mục hồ sơ mới, tài liệu | **Đổi hết** sang Catoro |
| **B. Tên kỹ thuật nội bộ, đổi được** | Biến môi trường `MCAH_*`, `window.mcah`, kênh IPC `mcah:*`, cookie trình duyệt của máy chủ dịch vụ, khoá localStorage, tên gói, tên tệp docs | **Đổi**, có lớp tương thích nếu bản cũ / cấu hình cũ còn dùng tên cũ |
| **C. Tên kỹ thuật phải giữ** | Thứ mà máy bản cũ và máy bản mới cùng phải hiểu, hoặc thứ gắn với dữ liệu đã có (mục 3.6) | **Giữ nguyên**, người dùng không thấy |

Đây là cách đã làm khi đổi SeaSmart → MCAH: database vẫn tên `seasmart`, gói Ubuntu có `--replaces=seasmart-desktop`.

## 2. Phạm vi

### 2.1 Làm

1. Logo tạm và bộ icon sinh từ một tệp nguồn (3.1).
2. Mọi chữ MCAH (và tàn dư Marineport / SeaSmart **chỉ ở chữ người thấy**) trong web, app máy tính, máy chủ dịch vụ, email, PDF, trang hướng dẫn, điều khoản, ghi chú phát hành **từ bản mới trở đi** (3.2).
3. Biến môi trường `CATORO_*`, đọc dự phòng `MCAH_*` (3.3).
4. App máy tính: tên hiển thị, bộ cài, tên gói, cập nhật từ 0.9.x không mất gì (3.4).
5. Máy chủ dịch vụ: cookie, tên trong email / mã 2FA (3.5).
6. Tài liệu: đổi tên tệp `docs/mcah-*` → `docs/catoro-*`, sửa mọi chỗ trỏ tới, `CLAUDE.md`, `README.md`, 3 tệp `.docx` (3.7).
7. Phát hành **0.9.14** có ghi chú "MCAH nay là Catoro" (3.8).

### 2.2 Không làm

- Không đổi tên miền `mcah.axalize.vn` trong đợt này. Khi có tên miền Catoro làm đợt riêng (3.9).
- Không đổi tên database (`seasmart`, `mcah_cloud`), thư mục server `/srv/mcah`, volume Docker.
- Không sửa migration đã chạy, không sửa ghi chú phát hành đã phát (`release-notes/0.9.*.md`).
- Không đổi giao thức giữa các máy (mục 3.6).
- Không làm logo thật.

### 2.3 Đã chốt (2026-11-26)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Viết tên trong câu | `Catoro` |
| Q2 | Email gửi đi | Tên người gửi "Catoro"; **địa chỉ** `no-reply@mcah.vn` giữ tới khi có tên miền mới |
| Q3 | Đổi tên tệp `docs/mcah-*.md` → `docs/catoro-*.md` | Có. Comment trong migration cũ giữ tên cũ, bù bằng bảng đối chiếu trong `docs/README.md` |
| Q4 | 3 tệp `.docx` cho Sales / Marketing | Có: đổi tên tệp và chữ MCAH bên trong |
| Q5 | Số phiên bản | **0.9.14** |
| Q6 | Dòng "trước đây là MCAH" trong app | **Không**. Không có dòng nào trong app nhắc tên cũ; việc đổi tên chỉ báo trong ghi chú phát hành 0.9.14 |

## 3. Thiết kế

### 3.1 Logo tạm

- Tệp nguồn duy nhất: `docs/branding/catoro-mark.svg`: dấu một màu `currentColor`, viewBox 24, vẽ trong vùng 4–20. Dấu tạm là **mèo thủy thủ** (ý người dùng, 2026-11-26: "Cat" trong Catoro): đầu mèo hai tai nhọn, mắt khoét rỗng, mũ thủy thủ có vành giữa hai tai. Rõ là tạm, chờ logo thật.
- `node scripts/brand-icons.js` (chạy tay ở gốc repo, dùng `sharp` của `backend/`) sinh ra: `frontend/src/components/common/ProductMark.jsx` (tệp sinh, ghi rõ đừng sửa tay), `frontend/public/favicon.svg`, `frontend/public/icons-app/*.png` (192, 512, maskable có lề an toàn, apple-touch 180), `desktop/src/pages/logo.svg`, `desktop/build/icon.png`, `desktop/build/icon.ico` (16–256), `docs/branding/catoro-logo-{120,512}.png`. Ô nền `#003366` như logo cũ. Tệp không đổi nội dung thì không ghi lại.
- Logo trong giao diện lấy từ các tệp trên: `ProductBrand` (sidebar, đăng nhập, trang lỗi) dùng `ProductMark`; trang tải, điều khoản, splash app dùng `favicon.svg` / `logo.svg`. Trang của máy chủ dịch vụ và email không có logo.
- Có logo thật: thay hình trong `catoro-mark.svg` (giữ viewBox 24, một màu `currentColor`), chạy script, build bản mới. Logo nhiều màu thì cần sửa script (nền / màu dấu), làm khi có.

### 3.2 Chữ người thấy (lớp A)

- Thay `MCAH` → `Catoro` trong chữ hiển thị: `frontend/src` (trang, component, `index.html`, `manifest.webmanifest`), `frontend/public/guide/*.html` (~40 chỗ), `frontend/public/legal/*`, trang tải và trang ghi chú phát hành sinh từ script, `backend/src` (email, PDF, thông báo lỗi), `cloud/src` (trang đăng nhập, trang quản trị, email), `desktop/src` (splash, error, updating, moved, hộp thoại, thông báo cập nhật), `desktop/build/installer.nsh` (chữ trong bộ cài Windows).
- Dữ liệu mẫu: email `@mcah.demo` → `@catoro.demo` (DesignSystemPage, test, wireframe).
- Tàn dư **Marineport / SeaSmart** ở chữ người thấy và đầu `CLAUDE.md` / `README.md` cũng đổi. Tên kỹ thuật `seasmart` (database, user DB, `--replaces=seasmart-desktop`) giữ.
- Không thay máy móc bằng một lệnh `sed` cho cả repo: đi từng nhóm tệp, đọc lại câu sau khi thay (ví dụ "của MCAH" → "của Catoro" đọc vẫn đúng; câu nói về lịch sử đổi tên thì giữ MCAH).
- Xong thì: `grep -rIi "mcah"` ngoài node_modules / dist chỉ còn các mục ở 3.6, docs lịch sử và migration cũ (ghi danh sách vào Nhật ký).

### 3.3 Biến môi trường (lớp B)

- 26 biến `MCAH_*` (danh sách lấy bằng `grep -rhoE "MCAH_[A-Z_]+"`) đổi thành `CATORO_*`.
- Thêm một hàm đọc chung ở mỗi gói (`backend`, `cloud`, `desktop`): đọc `CATORO_X`, không có thì đọc `MCAH_X`. Như vậy `.env` trên server và lệnh phát hành quen tay (`MCAH_RELEASE_TARGET=… npm run release`) vẫn chạy; script in một dòng nhắc "đang dùng tên cũ MCAH_X".
- App máy tính tự đặt biến cho backend nó chạy kèm (`desktop/src/backend.js`, `main.js`) thì đặt thẳng tên mới.
- Sửa `.env.example` (cloud, backend, frontend), `compose.yaml`, `deploy.sh`, `docker/README.md`, CI, `docs/*server*`. Server thật: người dùng tự đổi `.env` sau khi bản mới chạy ổn (ghi vào hướng dẫn server, không bắt buộc).

### 3.4 App máy tính

**Đổi:**

| Chỗ | Cũ | Mới |
|---|---|---|
| `build.productName` | `MCAH` | `Catoro` → tên trong menu Start, thư mục cài Windows, `Catoro Setup x.y.z.exe`, tên trong Ubuntu |
| `build.linux.executableName` | `mcah` | `catoro` |
| `name` (tên gói `.deb`) | `mcah-desktop` | `catoro-desktop`, thêm `--replaces=mcah-desktop --conflicts=mcah-desktop` (giữ cả `seasmart-desktop`) |
| `description` | App máy tính MCAH | App máy tính Catoro |
| Tiêu đề cửa sổ, splash, thông báo cập nhật, hộp thoại | MCAH | Catoro |
| `window.mcah`, kênh IPC `mcah:*` | | `window.catoro`, `catoro:*` (giao diện và preload đóng gói cùng một bản nên đổi một lần) |
| Thư mục hồ sơ mặc định **cho máy cài mới** | `Tài liệu/MCAH - Hồ sơ` | `Tài liệu/Catoro - Hồ sơ` |
| Thư mục tệp gửi thư, thư mục xuất bản sao, tệp báo lỗi **tạo mới** | `MCAH…`, `mcah-bao-loi-*` | `Catoro…`, `catoro-bao-loi-*` (vẫn nhận ra tệp báo lỗi tên cũ khi mở thư mục) |
| Luật tường lửa Windows | `MCAH may chinh` trỏ `MCAH.exe` | `Catoro may chinh` trỏ `Catoro.exe`; bộ cài xoá luật cũ |
| CI và release | `MCAH Setup *.exe`, `mcah-installer-*` | `Catoro Setup *.exe`, `catoro-installer-*` |

**Giữ, vì gắn với dữ liệu đã có trên máy khách:**

- `app.setName('MCAH')`: tên này quyết định thư mục dữ liệu (`~/.config/MCAH`, `%APPDATA%\MCAH`: database, tệp tải lên, khoá, cài đặt) và tên két bí mật của hệ điều hành mà `safeStorage` dùng (mã PIN, mật khẩu SMTP). Đổi tên này là máy khách mất dữ liệu hoặc mất PIN. Giữ nguyên, kèm comment giải thích. Người dùng không thấy tên này: tên trong menu và tiêu đề lấy từ `productName` và tiêu đề cửa sổ. Bước 4 kiểm chỗ nào trên Ubuntu / Windows còn lộ chữ MCAH vì tên này (WM_CLASS, tên trong thông báo hệ thống); lộ thì báo ⛔, không tự đổi.
- `appId: vn.mcah.desktop`: Windows nhận ra bản mới là **nâng cấp** của bản cũ (cùng khoá gỡ cài đặt) chứ không cài song song. Giữ nguyên.
- Giao diện nạp ở `app://mcah/`: localStorage / IndexedDB của app gắn với địa chỉ này. Giữ host `mcah`.
- Thư mục hồ sơ của máy đang dùng: `settings.filesDir` để trống nghĩa là dùng mặc định. Lần mở đầu tiên của bản mới: nếu `filesDir` trống và `Tài liệu/MCAH - Hồ sơ` đã có thì **ghi đường dẫn đó vào settings**, không chuyển tệp, không đổi tên thư mục. Người dùng muốn đổi thì dùng chức năng đổi thư mục hồ sơ đang có.

**Cập nhật từ 0.9.x:**

- Ubuntu: updater cài `catoro-desktop_0.9.14_amd64.deb`; `Replaces/Conflicts` gỡ `mcah-desktop` trong cùng lần cài. Lối tắt cũ `mcah.desktop` do gói cũ sở hữu nên bị gỡ cùng gói; kiểm lại lối tắt mới và mục tự mở khi khởi động máy (nếu có).
- Windows: updater chạy `Catoro Setup 0.9.14.exe`; cùng `appId` nên bộ cài gỡ bản cũ (thư mục `…\Programs\MCAH`) rồi cài `…\Programs\Catoro`. Kiểm lối tắt Desktop / Start cũ bị gỡ, luật tường lửa mới có, luật cũ hết.
- Updater của bản cũ đọc tên tệp từ `latest.json` đã ký nên không phụ thuộc tên cũ. Máy nhân viên lấy bộ cài từ máy chính theo tên trong `latest.json` của máy chính: cũng không phụ thuộc tên.
- Luật "Không đổi tên bộ cài" trong quy trình phát hành nói về việc đổi tên **tệp** bằng tay để đổi phiên bản, không cấm tên build mới. Ghi thêm một câu: từ 0.9.14 tên build là `catoro-desktop_…deb` / `Catoro Setup ….exe`.

### 3.5 Máy chủ dịch vụ (`cloud/`)

- Cookie `mcah_s`, `mcah_oauth`, `mcah_otp`, `mcah_last` → `catoro_*`. Hệ quả: người đang đăng nhập trang tài khoản / quản trị trên trình duyệt phải đăng nhập lại một lần, app không bị ảnh hưởng. Chấp nhận; không cần đọc cookie cũ.
- Mã 2FA trang nội bộ: issuer `MCAH internal` → `Catoro internal`. Mã cũ trong app Authenticator vẫn đúng, chỉ nhãn cũ; ghi vào hướng dẫn khu nội bộ.
- `SMTP_FROM_NAME`, chữ trong trang và email → Catoro (Q2).
- `package.json` name `mcah-cloud` → `catoro-cloud`.

### 3.6 Giữ nguyên (lớp C), có comment tại chỗ

| Tên | Ở đâu | Vì sao giữ |
|---|---|---|
| `x-mcah-protocol`, `x-mcah-device`, `x-mcah-lan`, `x-mcah-lan-ip` | LAN máy chính ↔ máy nhân viên | Trong lúc cập nhật, máy chính và máy nhân viên có thể khác phiên bản |
| Dịch vụ mDNS `mcah`, `app: 'mcah'` ở `/lan/hello` | `desktop/src/lan.js`, `backend/.../lan_device.routes.js` | Như trên: máy bản cũ tìm máy chính theo tên này |
| `x-mcah-office`, `x-mcah-time`, `x-mcah-signature`, `x-mcah-smtp` | App ↔ máy chủ dịch vụ, app ↔ backend kèm | Máy chủ phải hiểu cả app chưa cập nhật |
| `client_id=mcah-desktop`, audience `mcah-office`, `/.well-known/mcah-keys` | Đăng nhập app qua máy chủ dịch vụ | App bản cũ dùng các giá trị này |
| `O=MCAH` trong chứng chỉ LAN | `desktop/src/lan-cert.js` | Chứng chỉ đã cấp và vân tay đã ghép; tạo lại là phải ghép lại máy |
| `app.setName('MCAH')`, `appId`, `app://mcah` | 3.4 | Dữ liệu trên máy |
| Database `seasmart`, `mcah_cloud`, `/srv/mcah`, `mcah.job.*` (khoá advisory) | Server, compose | Không có lợi khi đổi, rủi ro mất dữ liệu |

Khi mọi máy đã lên ≥ 0.9.14 một thời gian có thể làm đợt sau đổi nốt nhóm giao thức (nhận cả hai tên trước, bỏ tên cũ sau). Không làm trong đợt này.

### 3.7 Tài liệu

- `git mv docs/mcah-*` → `docs/catoro-*` (kế hoạch, testcase, hướng dẫn, quy trình phát hành, build Windows). Sửa mọi chỗ trỏ tới trong code comment, docs, `CLAUDE.md`, wireframe. Migration cũ giữ nguyên comment.
- Thêm vào `docs/README.md` (tạo nếu chưa có) một dòng: "Trước 2026-11 hệ thống tên MCAH; tệp `docs/mcah-X.md` nay là `docs/catoro-X.md`."
- `docs/branding/mcah-logo-*.png` chuyển vào `docs/branding/cu/` (giữ để tra), logo tạm thay chỗ.
- `docs/design/ui-kit/mcah-ui.html` → `catoro-ui.html`; chữ trong wireframe đổi theo nhóm (wireframe đã duyệt chỉ đổi tên, không đổi bố cục).
- `README.md` tiêu đề `# Catoro`, một câu giải thích tên đầy đủ.
- 3 tệp `.docx` (Q4): đổi tên tệp `Catoro …docx`, thay chữ MCAH bên trong bằng skill docx, giữ định dạng. Chỉ thay tên, không đổi nội dung khác.
- Trí nhớ của Claude (memory) có tên tệp `docs/mcah-*`: cập nhật sau bước 6.

### 3.8 Phát hành 0.9.14

- Ghi chú phát hành viết cho môi giới viên: "MCAH nay có tên mới là **Catoro**. Dữ liệu, tài khoản, mã PIN, máy nhân viên giữ nguyên. Biểu tượng app trên máy đổi theo." Kèm dòng logo hiện là tạm (nếu chưa có logo thật).
- Trang tải (`/download`) đổi chữ và tên nút; đường dẫn giữ nguyên.
- Phát **beta trước**, chạy testcase nâng cấp trên máy thật, rồi mới stable.

### 3.9 Tên miền (đợt sau, không làm bây giờ)

Ghi lại để khỏi quên: khi có tên miền Catoro, trỏ cả hai tên miền về cùng server, sửa `desktop/endpoints.json` và phát bản mới. App tự học địa chỉ mới từ `latest.json` đã ký (đã có, commit `69b621d`). Giữ `mcah.axalize.vn` chạy ít nhất 6 tháng cho máy chưa cập nhật.

## 4. File sẽ sửa / thêm (chính)

| Nhóm | File |
|---|---|
| Logo | `docs/branding/catoro-mark.svg` (mới), `scripts/brand-icons.js` (mới), icon trong `frontend/public`, `desktop/build`, `desktop/src/pages/logo.svg` |
| Web | `frontend/index.html`, `manifest.webmanifest`, `src/**` (~70 tệp có chữ), `public/guide/*`, `public/legal/*`, `NotificationBell.jsx` (khoá localStorage, đọc khoá cũ một lần) |
| Backend | `src/**` (~70 tệp), `utils/tmp_dir.js`, hàm đọc biến môi trường, `.env.example` |
| Cloud | `src/routes/web.js` (cookie), `admin.js`, trang, email, `totp`, `package.json`, `.env.example` |
| Desktop | `package.json`, `src/main.js`, `preload.js`, `ipc.js`, `updater.js`, `settings.js`/`main.js` (ghim thư mục hồ sơ), `pages/*`, `build/installer.nsh`, `scripts/release.js`, `.github/workflows/desktop-build.yml`, `release-notes/0.9.14.md` |
| Hạ tầng | `compose.yaml`, `deploy.sh`, `docker/README.md` |
| Docs | đổi tên ~60 tệp `docs/mcah-*`, `CLAUDE.md`, `README.md`, `docs/README.md`, 3 `.docx` |

## 5. Rủi ro riêng

| Rủi ro | Chặn bằng |
|---|---|
| Máy khách mất dữ liệu / PIN vì thư mục dữ liệu hoặc két bí mật đổi theo tên app | Giữ `app.setName('MCAH')`; testcase N2, N3 trên cả hai hệ điều hành |
| Windows cài Catoro **bên cạnh** MCAH (hai app, hai biểu tượng, hai backend tranh cổng) | Giữ `appId`; testcase N4 |
| Ubuntu báo xung đột gói khi cài `.deb` mới | `--replaces/--conflicts=mcah-desktop`; testcase N5 |
| Máy nhân viên bản cũ không thấy máy chính bản mới | Giữ giao thức LAN (3.6); testcase N7 |
| Thư mục hồ sơ "biến mất" vì mặc định đổi tên | Ghim đường dẫn cũ (3.4); testcase N6 |
| Thay chữ máy móc làm hỏng code (đổi nhầm tên kỹ thuật lớp C, chuỗi trong test) | Đổi theo nhóm, chạy toàn bộ test sau mỗi bước, grep cuối ở 3.2 |
| Server thật vẫn dùng `MCAH_*` | Đọc dự phòng tên cũ (3.3) |

## 6. Test tự động

- `desktop`: test hàm ghim thư mục hồ sơ (trống + có thư mục cũ → ghim; trống + không có → mặc định mới; đã đặt → không đụng); test `release.js` với tên bộ cài mới; test `package.json` có `replaces mcah-desktop`.
- `backend`, `cloud`: test hàm đọc biến môi trường (tên mới thắng, tên cũ dự phòng); test cookie mới ở luồng đăng nhập.
- Một test "không còn chữ MCAH người thấy": quét `frontend/src`, `frontend/public/guide`, `desktop/src/pages`, chữ trong `cloud/src/views` (hoặc nơi giữ trang), cho phép danh sách ngoại lệ ở 3.6.

## 7. Các bước

### Bước 0 — Duyệt
Đã trả lời Q1–Q6 (2026-11-26). ⛔ DỪNG: người dùng duyệt mục 3.6 "Giữ nguyên" và cho bắt đầu Bước 1.

### Bước 1 — Logo tạm và icon (3.1)
Xong khi: script sinh đủ icon từ một tệp nguồn; web, app dev, trang tải hiện logo tạm; chạy lại script không đổi gì (ổn định).

### Bước 2 — Chữ người thấy: web, backend, cloud (3.2, 3.5)
Xong khi: test các gói qua; mở web ở 1440px và 375px các trang chính, trang hướng dẫn, trang đăng nhập / quản trị máy chủ dịch vụ không còn chữ MCAH; email thử (đăng nhập bằng mã) ghi người gửi Catoro.

### Bước 3 — Biến môi trường (3.3)
Xong khi: chạy dev bằng `.env` cũ (tên `MCAH_*`) vẫn lên, có dòng nhắc; chạy bằng tên mới cũng lên; `deploy.sh` chạy trên máy dev Docker.

### Bước 4 — App máy tính (3.4)
Xong khi: `npm run dist:linux` ra `catoro-desktop_0.9.14_amd64.deb`; cài đè lên máy Ubuntu đang chạy 0.9.13 có dữ liệu thật thử (testcase N1–N7 cột Ubuntu đạt).
⛔ DỪNG nếu còn chỗ hiện chữ MCAH vì `app.setName` (WM_CLASS, thông báo hệ thống…): báo người dùng kèm ảnh, chờ quyết.

### Bước 5 — Bộ cài Windows qua CI
Xong khi: CI ra `Catoro Setup 0.9.14.exe`; cài lên máy Windows đang chạy 0.9.13 (testcase N1–N7 cột Windows). Chưa có máy Windows thì ghi "Chờ máy", không phát stable.

### Bước 6 — Tài liệu (3.7)
Xong khi: không còn đường dẫn `docs/mcah-` trỏ tới tệp không tồn tại (trừ migration cũ); `CLAUDE.md`, `README.md`, `.docx` đổi xong; memory cập nhật.

### Bước 7 — Chạy hết testcase tay
`docs/catoro-testcase-doi-ten.md`, ghi kết quả vào tệp đó.

### Bước 8 — Phát hành (3.8)
⛔ DỪNG trước khi phát beta: báo kết quả testcase, chờ người dùng cho phát. Phát beta → dùng thật vài ngày → người dùng cho phép thì stable.

## 8. Nhật ký

- 2026-11-26 — Bước 0: người dùng chốt Q1–Q6, cho bắt đầu Bước 1.
- 2026-11-26 — Bước 1 xong: `docs/branding/catoro-mark.svg` (mèo thủy thủ) + `scripts/brand-icons.js` sinh 11 tệp; chạy lần hai "Không có tệp nào đổi". Web `localhost:5173/login` hiện dấu mới (chữ "MCAH" cạnh dấu đổi ở Bước 2). Test frontend 520/520, desktop 28/28. `mcah-logo-*.png` cũ chưa chuyển vào `docs/branding/cu/` (Bước 6). Chưa build app máy tính: icon bộ cài được kiểm khi build ở Bước 4.
- 2026-11-26 — Bước 2 xong (web, backend, cloud; chữ của app máy tính để Bước 4):
  - Chữ `MCAH` đứng riêng → `Catoro` (296 chỗ) bằng script có loại trừ: tên biến `MCAH_*`, dòng có `X-MCAH-`, phần tự sinh của trang ghi chú phát hành (nội dung bản 0.9.x cũ giữ nguyên). Có cả `desktop/scripts/license-page.js` (trang điều khoản trong bộ cài).
  - Ô logo chữ "MC" trên trang tĩnh (tải về, điều khoản, quyền riêng tư, hướng dẫn, ghi chú phát hành) → ảnh `/favicon.svg`. Trang máy chủ dịch vụ dùng `cloud/src/views/brand_mark.js`, tệp mới do `scripts/brand-icons.js` sinh (cloud đóng gói riêng, không đọc được tệp của frontend).
  - Cookie máy chủ dịch vụ `mcah_*` → `catoro_*` (cả khu nội bộ); 2FA issuer `Catoro internal`; tệp báo lỗi tải về `catoro-bao-loi-*.txt`; `cloud/package.json` tên `catoro-cloud`; `SMTP_FROM_NAME` mặc định và trong `.env.example` = Catoro, địa chỉ gửi giữ (Q2).
  - Khoá localStorage `catoro.lastNotifiedId` (đọc khoá cũ `mcah.lastNotifiedId` nếu chưa có, để app không báo lại thông báo cũ) và `catoro-guide-job` (đọc khoá cũ). `dataset.catoroTokens`, thư mục tạm bản web `catoro`, email mẫu `@catoro.demo`.
  - Hướng dẫn: tên gói `catoro-desktop_….deb`, `sudo apt remove catoro-desktop`; đường dẫn dữ liệu vẫn ghi `~/.config/MCAH` vì thư mục dữ liệu giữ tên (3.4), thư mục hồ sơ ghi "xem ở Cài đặt trên máy này". Neo `id` cũ trong trang hướng dẫn (`#mo-mcah`, `#khi-mcah-tu-khoa`…) giữ để link từ app không gãy.
  - Còn lại có chủ đích: lớp C (3.6), tên database, tên miền `mcah.axalize.vn`, comment trỏ `docs/mcah-*` (Bước 6), `MCAH_*` (Bước 3), `window.mcah` (Bước 4).
  - Test: frontend 520/520, backend 655 qua (16 bỏ qua như cũ), cloud 52/52 (sửa 3 test kiểm chữ cũ). Lint frontend còn 1 lỗi có sẵn từ trước ở `OwnershipFields.jsx` (không thuộc đợt này).
  - Kiểm trên trình duyệt: đăng nhập web, tải về, hướng dẫn, ghi chú phát hành, điều khoản, quyền riêng tư (dấu mèo tải được, không còn chữ MCAH ngoài nội dung bản cũ); đăng nhập máy chủ dịch vụ và khu nội bộ ghi Catoro, dấu mèo hiện. Chưa gửi email thật, chưa xuất PDF (W3).
- 2026-11-26 — Bước 3 xong:
  - Hàm `productEnv(name)` ở `backend/src/utils/env.js` và `desktop/src/env.js`: đọc `CATORO_X`, không có thì đọc `MCAH_X` và nhắc một lần; không đặt trả `undefined`, đặt rỗng trả `''` (giữ nghĩa `??` ở `stage.js`). Máy chủ dịch vụ (`cloud/`) không dùng biến `MCAH_*` nào (chỉ `CLOUD_*`, `SMTP_*`…) nên không cần.
  - Backend đọc qua `productEnv`: DESKTOP, PDF_URL/PDF_TOKEN, SIGNER_URL/SIGNER_TOKEN, LAN_FINGERPRINT/LAN_NAME/LAN_PORT/LAN_SECRET, BACKEND_ROOT, FILES_DIR, MAINTENANCE_FILE, TMP_DIR. App máy tính **đặt** cho backend chạy kèm bằng tên mới `CATORO_*` (`backend.js`, `main.js`); chỗ app tự đọc (CLOUD_URL, UPDATE_URL, NODE, FILES_DIR, OPEN_URL_WITH, CLOUD_PUBLIC_KEY_FILE, FAKE_NOW, LOCK_AFTER_SECONDS, LAN_PORT) và script `stage.js` / `release.js` (RELEASE_TARGET, TEST_MIGRATION) dùng `productEnv`.
  - Sót ở Bước 2, sửa ở đây: tên tệp báo cáo tải về `MCAH_Bao-cao_….xlsx` → `Catoro_Bao-cao_….xlsx` (backend + frontend + testcase báo cáo). Script Bước 2 không bắt chữ MCAH dính `_`.
  - Tài liệu đang dùng: quy trình phát hành, build Windows, hướng dẫn server, testcase tài khoản / báo cáo đổi sang `CATORO_*` (ghi tên cũ vẫn nhận). Kế hoạch cũ (`mcah-ke-hoach-desktop-gd*`…) để nguyên như lịch sử. `.env.example`, `compose.yaml`, `deploy.sh`, CI không có biến `MCAH_*` nên không đổi; vì vậy không chạy lại `deploy.sh`.
  - Test: backend 658 qua (thêm `utils/__tests__/env.test.js`: tên mới thắng, tên cũ nhận + nhắc một lần, rỗng không rơi về tên cũ); desktop 28/28 (`endpoints.test.js` thêm kiểm tên cũ / tên mới thắng); frontend báo cáo 6/6; lint backend sạch.
  - Chạy thử module thật của backend (config, tmp_dir, paths) với `MCAH_*`: nhận đúng, in 3 dòng nhắc; với `CATORO_*`: nhận đúng, không nhắc; không đặt: mặc định (`/tmp/catoro`). Chưa bật server thật bằng `.env` (không đọc `.env`; bản web hiện không dùng biến `MCAH_*` nào) và chưa chạy app máy tính dev: kiểm cùng Bước 4.
- 2026-11-26 — Bước 4, phần code và build xong; chờ cài thử (⛔):
  - `desktop/package.json`: `name` catoro-desktop, `productName` Catoro, `executableName` catoro, `desktopName` catoro.desktop (StartupWMClass khớp), `author.name` Catoro (email giữ), fpm thêm `--replaces/--conflicts=mcah-desktop` (giữ seasmart-desktop). `appId` giữ `vn.mcah.desktop`. Phiên bản **0.9.14**, `release-notes/0.9.14.md`, `notes:page` đã chạy.
  - Bộ cài Windows (`installer.nsh`): chữ Catoro; một lần xin quyền thì xoá luật tường lửa cũ "MCAH may chinh" và thêm "Catoro may chinh" trỏ `Catoro.exe`; gỡ cài đặt xoá cả hai luật; xoá dữ liệu thì xoá `%APPDATA%\MCAH`, `Tài liệu\Catoro - Hồ sơ` và `Tài liệu\MCAH - Hồ sơ`.
  - CI: artifact `catoro-installer-*`, mẫu `Catoro Setup *.exe`; quy trình phát hành và hướng dẫn build Windows ghi tên mới. Luật "Không đổi tên bộ cài" là về đổi tên tệp bằng tay; ghi thêm câu về tên build mới.
  - Chữ người thấy trong `desktop/src` (55 chỗ: splash, lỗi, cập nhật, hộp thoại, thông báo, bản chụp, xuất hồ sơ). Cầu nối `window.mcah` → `window.catoro`, kênh IPC `mcah:*` → `catoro:*` (preload, ipc, main, trang khởi động, frontend `lib/desktop.js`, `App.jsx`, 2 test).
  - Giữ và ghi comment tại chỗ: `app.setName('MCAH')`, `O=MCAH`, tên mDNS `MCAH …` và dịch vụ `mcah`, `CLIENT_ID mcah-desktop`, dự phòng tên máy `'MCAH'`.
  - Thư mục hồ sơ: `desktop/src/files-dir.js`; lúc khởi động máy chính, cài đặt chưa có `filesDir` mà có `Tài liệu/MCAH - Hồ sơ` thì ghim thư mục đó (`saveSettings` nhận thêm `filesDir`; IPC từ giao diện vẫn lọc bỏ trường này). Máy mới: `Catoro - Hồ sơ`. Thư mục tệp gửi thư `~/Catoro/Tệp gửi thư` (thư mục `~/MCAH` cũ chỉ chứa tệp tạm, để nguyên). Tệp báo lỗi `catoro-bao-loi-*.txt` (vẫn nhận tên cũ khi mở thư mục).
  - Test: desktop 31/31 (thêm `files-dir.test.js`, `release.test.js` dùng tên mới); frontend 519/520 khi chạy cả bộ, test hỏng `BillFormPage` chạy riêng 3 lần đều qua (chập chờn khi máy bận, tệp không đổi).
  - `npm run dist:linux` thành công: `catoro-desktop_0.9.14_amd64.deb` (Package catoro-desktop, Replaces/Conflicts seasmart-desktop + mcah-desktop, `/opt/Catoro/catoro`, `catoro.desktop` Name=Catoro, StartupWMClass=catoro, icon mèo), quét bí mật sạch, build-info `dirty: true` (chưa commit nên chưa phát được, đúng).
  - Chưa làm: cài đè lên máy Ubuntu đang chạy MCAH (máy dev đang có 0.9.12 với dữ liệu ở `~/.config/MCAH`; cài cần sudo, người dùng làm). Chưa kiểm chỗ còn lộ chữ MCAH vì `app.setName` (thông báo hệ thống, tên tiến trình). Bản Windows cần CI, tức là cần commit + push `dev`.
- 2026-11-26 — Bước 6 xong (làm trước Bước 5, theo ý người dùng):
  - `git mv` 58 tệp `docs/mcah-*` → `docs/catoro-*` (kế hoạch, testcase, hướng dẫn nháp, quy trình phát hành, build Windows, xlsx testcase), `docs/design/ui-kit/mcah-ui.html` → `catoro-ui.html` (kèm `build.py`: tiêu đề và tệp ra), logo cũ → `docs/branding/cu/`.
  - Sửa 321 chỗ trỏ tới trong 183 tệp (code comment, docs, wireframe, `CLAUDE.md`, `.env.example`, `compose.yaml`…); **không** sửa migration đã chạy (16 tệp còn ghi `docs/mcah-X`, ghi chú đọc thành `docs/catoro-X` trong `docs/README.md` mới). Kiểm: mọi tên `catoro-*.md/html/xlsx` được nhắc đều có tệp. Còn 3 tên `mcah-*` trỏ tới tệp chưa từng có trong repo từ trước (`mcah-huong-dan-khu-noi-bo.md`, `mcah-ke-hoach-demo-sales.md`, `mcah-ui-ux-design-plan.md`), để nguyên.
  - Chữ `MCAH` trong nội dung docs → `Catoro` (82 tệp, 468 chỗ), bỏ qua dòng nói về tên kỹ thuật giữ lại (`MCAH_`, `X-MCAH`, `~/.config/MCAH`, `MCAH - Hồ sơ`, `MCAH Setup`, `/opt/MCAH`…) và hai tệp của đợt đổi tên; email mẫu `@catoro.demo` trong wireframe.
  - `CLAUDE.md`: tiêu đề Catoro, tên đầy đủ, quy tắc chữ người thấy / tên kỹ thuật giữ (trỏ mục 3.6) / biến `CATORO_*`. `README.md` tiêu đề Catoro. `package.json` gốc tên `catoro`. Comment `.claude/skills/ui-ux/references/tokens.css`.
  - 3 tệp `.docx`: bản mới `Catoro …docx` (thay 28 chữ MCAH; phụ đề "Maritime Crewing Agency Harness" → "Crew Agency Tools for Onboarding, Records & Operations"; câu "Tên Maritime Crewing Agency Harness có thể giữ làm tên dự án" → "Tên Catoro là viết tắt của …"). Định dạng giữ (chỉ đổi chữ trong run sẵn có), XML hợp lệ, trang đầu bản Sales dựng lại bằng LibreOffice đúng. Bản MCAH gốc chuyển vào `cu/` (không xoá).
  - Memory: 13 tệp trỏ tên tài liệu mới.
  - Test: frontend 520/520, backend 658, desktop 31/31, cloud 52/52.
- 2026-11-26 — Commit cả đợt (Bước 1–4, 6) thành một commit trên `dev`, chưa push. Test sau hook commit: frontend 520/520, backend 658, desktop 31/31. Còn: build lại `.deb` từ commit sạch và cài thử (Bước 4), push để CI build bản Windows (Bước 5), testcase tay (Bước 7), phát beta (Bước 8).
