# MCAH — Kế hoạch app máy tính, giai đoạn 6: đóng gói và phát hành

- **Ngày lập:** 2026-11-13
- **Trạng thái:** đã duyệt 2026-11-13 (Q-F1, Q-F2 theo đề xuất); code bước 1–7 và 9. Chờ: người lo server tạo chỗ phát (bước 3), máy Windows (build `.exe`, gỡ cài đặt, F1–F3), máy Ubuntu sạch (F1), phát thử hai bản liên tiếp (bước 8).
- **Kế hoạch tổng:** `docs/mcah-ke-hoach-ung-dung-may-tinh.md` (mục 4.2 M3 / M4, 9 phát hành và cập nhật, 10 giai đoạn 6, 11 nhóm F).
- **Wireframe:** `docs/design/wireframes/desktop-gd6.html` (5 màn).
- **Testcase chạy tay:** `docs/mcah-testcase-desktop-gd6.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/mcah-huong-dan-desktop-gd6.html`, chép vào trang hướng dẫn ở bước 9.
- **Mục tiêu:** từ một lệnh phát hành ra được bộ cài Windows `.exe` và Ubuntu `.deb` cùng phiên bản, đã ký bằng khoá của bên mình, đặt lên `https://mcah.axalize.dev/download`; app ở văn phòng tự nhận bản mới theo kênh (ổn định / thử nghiệm), có ghi chú thay đổi tiếng Việt; gỡ cài đặt không mất dữ liệu nếu không chọn xoá.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng và Nhật ký của `docs/mcah-ke-hoach-desktop-gd5.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả giai đoạn trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`. **Khoá riêng ký bản phát hành không bao giờ vào repo, chat hay bộ cài.**
5. Bản web giữ nguyên. Test hiện có phải qua sau mỗi bước.

## 1. Đã có (không làm lại)

| Có rồi | Ở đâu |
|---|---|
| Đóng gói `.deb` / `.exe` (NSIS) bằng electron-builder, bộ cài theo người dùng | `desktop/package.json` `build` |
| Cập nhật có chữ ký Ed25519 (`latest.json` + `signature`), kiểm trước khi cài, cả hai hệ điều hành | `desktop/src/updater.js`, `scripts/release.js`, `scripts/release-key.js` |
| Bản có đổi dữ liệu: dừng ghi, chép DB, lỗi thì quay về (`last_migration`) | `desktop/src/update-guard.js` (giai đoạn 4) |
| Máy chính giữ bộ cài cả hai hệ điều hành cho máy nhân viên; phiên bản giao tiếp | `updater.js` `mirrorInstallers`, `lan.js` `PROTOCOL` (giai đoạn 3) |
| Bytecode, cầu chì, quét bí mật | giai đoạn 5 |
| Trang Tải về đọc `files/latest.json` | `frontend/public/download/index.html` (M3) |
| Luật tường lửa Windows lúc cài | `desktop/build/installer.nsh` |

## 2. Phạm vi

### 2.1 Làm

1. **Một khoá ký cho mọi máy build** (3.1): khoá công khai nằm trong repo; khoá riêng chỉ ở máy phát hành. Bỏ việc máy build tự sinh khoá.
2. **Quy trình phát hành** (3.2): đổi số phiên bản, ghi chú thay đổi, build Ubuntu (máy Linux) + build Windows (máy Windows, vì bytecode), gom về máy phát hành, script phát hành **chặn nếu thiếu một hệ điều hành** hoặc thiếu ghi chú, ký, đẩy lên chỗ phát.
3. **Chỗ phát trên `mcah.axalize.dev`** (3.3): `/download/files/` (ổn định) và `/download/files/beta/` (thử nghiệm); nginx phục vụ từ thư mục ngoài repo (bộ cài không vào git).
4. **Kênh ổn định / thử nghiệm** (3.4, W3): đặt ở máy chính, máy nhân viên theo máy chính.
5. **Ghi chú thay đổi trong app** (3.5, W1, W2).
6. **Gỡ cài đặt** (3.6, W4): Windows hỏi có xoá dữ liệu không (mặc định giữ, hỏi lại lần hai); Ubuntu không đụng dữ liệu.
7. **Trang Tải về hoàn chỉnh** (3.7, W5): phiên bản, ngày, yêu cầu máy, ghi chú, SHA-256, cảnh báo SmartScreen khi chưa ký.
8. **Bộ cài `.deb` khai đủ phụ thuộc** (3.8): LibreOffice là gói gợi ý / phụ thuộc theo kế hoạch tổng mục 9 ý 3.

### 2.2 Không làm

- Ký số bộ cài Windows (M4 chưa vội): bộ cài chưa ký, Windows hiện cảnh báo SmartScreen — ghi rõ trên trang Tải về và hướng dẫn.
- Kênh phát qua kho Microsoft Store / Snap / PPA.
- Lối cài từ USB cho máy nhân viên (kế hoạch tổng 9 ý 8): đã có lối qua máy chính; USB để sau nếu khách cần.
- Bản quyền (M8).

### 2.3 Cần người dùng / sếp trước khi xong giai đoạn

- **⛔ Q-F1 — đẩy bộ cài lên server thế nào.** Đề xuất: script phát hành chép (rsync qua SSH) vào thư mục `/srv/mcah/releases` trên server `mcah.axalize.dev`; nginx của frontend có `location /download/files/` trỏ thư mục đó (gắn volume chỉ đọc). Cần người lo server: tạo thư mục, tài khoản SSH chỉ ghi được thư mục đó, gắn volume. Cách khác: GitHub Releases (cần quyền repo, trang Tải về trỏ sang GitHub).
- **⛔ Q-F2 — máy giữ khoá riêng ký bản phát hành.** Đề xuất: máy của bạn (máy dev Ubuntu), có bản sao khoá cất ngoại tuyến (USB, két). Mất khoá này là mọi app đã cài không nhận bản cập nhật mới nữa (phải cài lại tay).
- **Máy Windows** để build bản Windows (bytecode phải dịch trên Windows) và thử F1–F3.
- Số phiên bản đầu tiên phát cho khách: đề xuất `1.0.0` khi vào giai đoạn 7, kênh thử nghiệm; trước đó `0.9.x`.

## 3. Thiết kế

### 3.1 Khoá ký bản phát hành

- `desktop/build/release-public-key.pem` **trong repo** (khoá công khai, không bí mật). `stage.js` chép tệp này vào bộ cài thay vì tự suy từ khoá riêng.
- `scripts/release-key.js`: **không tự sinh khoá nữa**; thiếu khoá riêng thì báo lỗi rõ ràng. Lệnh riêng `node scripts/release-key.js --init` sinh cặp khoá lần đầu (ghi khoá riêng vào `desktop/.release/`, in khoá công khai để commit) — chạy một lần trên máy phát hành.
- `release.js` kiểm khoá riêng khớp khoá công khai trong repo trước khi ký.
- Bản thử trên máy dev hiện có khoá tự sinh: sau bước 1 phải cài lại app thử (khoá công khai đổi).

### 3.2 Quy trình phát hành

1. Đổi `version` trong `desktop/package.json` (`npm version x.y.z --no-git-tag-version`), viết `desktop/release-notes/x.y.z.md` (tiếng Việt, gạch đầu dòng, người dùng đọc được).
2. Máy Linux: `npm run dist:linux` → `.deb`. Máy Windows: `npm run dist:win` → `.exe` (cùng commit; script ghi commit vào tên tệp kèm `build-info.json`).
3. Chép `.exe` + `build-info.json` của Windows về máy phát hành (`desktop/dist/installer/`).
4. `npm run release -- --channel stable|beta`:
   - Chặn nếu thiếu `.deb` hoặc `.exe` của đúng phiên bản (F4), nếu hai bản khác commit, nếu thiếu ghi chú, nếu quét bí mật chưa chạy / không sạch.
   - `latest.json` = `{ version, files, last_migration, notes, released_at, channel }` + chữ ký.
   - Đẩy lên chỗ phát (3.3): bộ cài trước, `latest.json` sau cùng (app không bao giờ thấy `latest.json` trỏ tệp chưa có).
5. Lên ổn định từ thử nghiệm: `npm run release -- --promote x.y.z` chép bản beta đã phát sang kênh ổn định (không build lại).

### 3.3 Chỗ phát

- Ổn định: `https://mcah.axalize.dev/download/files/latest.json` + bộ cài. Thử nghiệm: `…/download/files/beta/`.
- `update-url.txt` gói trong bộ cài = `https://mcah.axalize.dev/download/files` (biến `MCAH_UPDATE_URL` lúc build); app thêm `/beta` khi đang ở kênh thử nghiệm.
- Giữ 3 phiên bản gần nhất mỗi kênh trên server (bộ cài cũ cho máy cần quay về, giai đoạn 4).
- `frontend/nginx.conf`: `location /download/files/ { alias /srv/releases/; autoindex off; }` + `compose.yaml` gắn volume chỉ đọc (theo Q-F1).

### 3.4 Kênh cập nhật

- Cài đặt `updateChannel` (`stable` | `beta`) ở `settings.js`; W3 chỉ quản trị đổi được trên máy chính.
- Máy chính báo kênh qua `/lan/hello`; máy nhân viên theo kênh máy chính (và vẫn tải bộ cài từ máy chính như giai đoạn 3).
- Đổi từ beta về ổn định khi bản ổn định cũ hơn bản đang chạy: không hạ bản, chờ tới khi ổn định có bản mới hơn.

### 3.5 Ghi chú thay đổi

- `latest.json.notes` (chuỗi Markdown đơn giản) hiện trong hộp có bản mới (W1, thay `dialog.showMessageBox` bằng hộp trong giao diện, gửi qua IPC).
- Sau khi cập nhật: lần mở đầu tiên ở bản mới hiện dải "Đã cập nhật lên x.y.z — Xem có gì mới" (W2); ghi chú lưu sẵn trong bộ cài (`release-notes/x.y.z.md` gói kèm), không cần mạng.

### 3.6 Gỡ cài đặt

- Windows: `installer.nsh` `customUnInstall` thêm trang có ô "Xoá cả dữ liệu trên máy này" (mặc định bỏ trống); tích thì hỏi lại lần hai rồi xoá `%APPDATA%\MCAH` và `Tài liệu\MCAH - Hồ sơ`. Không tích: giữ nguyên, cài lại là dùng tiếp.
- Ubuntu: `apt remove` không đụng `~/.config/MCAH` hay thư mục hồ sơ (mặc định của dpkg); hướng dẫn ghi lệnh xoá tay.
- Gỡ trên máy chính đang có máy nhân viên: không chặn (người dùng tự chịu), hướng dẫn nhắc chuyển máy chính trước.

### 3.7 Trang Tải về

- Đọc `files/latest.json` (đã có) và hiện thêm: ngày phát hành, ghi chú, SHA-256 từng tệp (để tham khảo, kế hoạch tổng 9 ý 6), yêu cầu máy, dòng SmartScreen khi chưa ký (cờ `windows_signed: false` trong `latest.json`).
- Đường `/download` (không có dấu `/` cuối) chuyển sang `/download/`.

### 3.8 Gói `.deb`

- `depends` giữ như hiện có; thêm `recommends: libreoffice-calc` (xuất PDF; kế hoạch tổng Q6: không đóng gói LibreOffice). Kiểm cài trên Ubuntu 22.04 và 24.04 sạch (F1).

## 4. File sẽ sửa / thêm

| Phần | File |
|---|---|
| desktop | `build/release-public-key.pem` (mới), `release-notes/` (mới), `scripts/release-key.js`, `scripts/release.js`, `scripts/stage.js`, `scripts/build-info.js` (mới), `src/updater.js` (kênh, ghi chú, hộp trong giao diện), `src/settings.js`, `src/ipc.js`, `src/preload.js`, `src/lan-server.js` / backend `/lan/hello` (kênh), `build/installer.nsh`, `package.json` (`deb.recommends`, `extraResources` ghi chú) |
| frontend | hộp có bản mới, dải "Đã cập nhật", thẻ Cập nhật trong `DeviceSettingsPage.jsx`, `public/download/index.html`, trang hướng dẫn |
| server | `frontend/nginx.conf`, `compose.yaml`, `docs/mcah-huong-dan-server-may-chu-dich-vu.md` (thêm mục chỗ phát) |

## 5. Rủi ro riêng

| Rủi ro | Cách xử lý |
|---|---|
| Mất khoá riêng ký bản phát hành | Q-F2: bản sao ngoại tuyến; hướng dẫn ghi rõ |
| Phát nhầm bản lỗi cho mọi văn phòng | Phát kênh thử nghiệm trước, `--promote` sau khi chạy ổn |
| Bản Windows và Ubuntu khác commit | `build-info.json` + script phát hành chặn |
| `latest.json` trỏ tệp chưa lên xong | Đẩy bộ cài trước, `latest.json` sau cùng |
| SmartScreen làm khách sợ | Dòng hướng dẫn trên trang Tải về; mua chứng thư khi phát hành rộng (M4) |

## 6. Test tự động

- desktop: `release.js` chặn khi thiếu một hệ điều hành / khác commit / thiếu ghi chú / khoá không khớp; `latest.json` có đủ trường và chữ ký kiểm được; updater chọn đúng kênh, không hạ bản khi đổi kênh; đọc ghi chú.

## 7. Các bước

### Bước 0 — Chuẩn bị
**⛔ DỪNG** hỏi Q-F1, Q-F2 nếu chưa được trả lời lúc duyệt.

### Bước 1 — Khoá ký chung (3.1)
**Xong khi:** máy dev không tự sinh khoá; `--init` sinh một lần; bộ cài mang khoá công khai từ repo; release từ chối khoá lệch.

### Bước 2 — Quy trình phát hành, chặn thiếu (3.2)
**Xong khi:** F4 qua; phát thử kênh beta lên thư mục cục bộ đủ hai tệp.

### Bước 3 — Chỗ phát trên server (3.3)
**⛔** cần người lo server theo Q-F1. **Xong khi:** `https://mcah.axalize.dev/download/files/latest.json` trả bản thử; app cài từ bản đó tự thấy bản mới hơn.

### Bước 4 — Kênh cập nhật (3.4, W3)
**Xong khi:** máy chính đổi kênh, máy nhân viên theo; không hạ bản.

### Bước 5 — Ghi chú thay đổi (3.5, W1, W2)
**Xong khi:** hộp có bản mới hiện ghi chú; sau cập nhật thấy dải "Đã cập nhật" một lần.

### Bước 6 — Gỡ cài đặt (3.6, W4)
**Xong khi:** Windows gỡ không tích thì cài lại dùng tiếp đủ dữ liệu; tích và xác nhận hai lần thì sạch (⛔ cần máy Windows). Ubuntu gỡ không mất dữ liệu.

### Bước 7 — Trang Tải về, gói `.deb` (3.7, 3.8, W5)
**Xong khi:** trang hiện đủ thông tin từ `latest.json`; F1 trên Ubuntu 22.04 và 24.04 sạch.

### Bước 8 — Thử toàn bộ (nhóm F)
Phát `0.9.0` rồi `0.9.1` kênh beta: F1, F2 (văn phòng đang chạy bản cũ tự nhận bản mới, dữ liệu còn nguyên), F3 (bản sai chữ ký bị từ chối) trên cả hai hệ điều hành. **⛔** Windows chờ máy.

### Bước 9 — Hướng dẫn, Nhật ký
Chép hướng dẫn nháp vào trang Hướng dẫn, thêm mục "Phát hành" vào `docs/mcah-huong-dan-server-may-chu-dich-vu.md`, viết `docs/mcah-quy-trinh-phat-hanh.md` (các lệnh, ai giữ khoá), ghi Nhật ký. **Xong khi:** người dùng duyệt.

## 8. Nhật ký

- 2026-11-13: lập kế hoạch, wireframe, testcase, nháp hướng dẫn. Chờ duyệt.
- 2026-11-13: duyệt, code.
  - Khoá ký chung: `build/release-public-key.pem` trong repo, lấy từ khoá riêng sẵn có trên máy dev (khớp, đã kiểm). `release-key.js` không tự sinh khoá nữa; `--init` chỉ dùng lần đầu.
  - `release.js` viết lại: kênh `beta` / `stable`, `--promote`, chặn thiếu hệ điều hành / khác commit / còn thay đổi chưa commit / thiếu ghi chú / chưa quét / khoá lệch (test tự động), giữ 3 phiên bản, rsync bộ cài trước rồi `latest.json`. `build-info.js` ghi phiên bản + commit sau khi quét bí mật sạch.
  - Chỗ phát: `nginx.conf` `/download/files/` → `/srv/releases` (gắn chỉ đọc trong `compose.yaml`, `RELEASES_DIR`), `latest.json` không cache; hướng dẫn server thêm mục. **Chưa thử nginx** (máy dev không có Docker).
  - Kênh: cài đặt `updateChannel`, updater thêm `/beta`; máy nhân viên hỏi máy chính qua `/lan/channel`.
  - **Khác thiết kế 3.5:** hộp có bản mới vẫn là hộp thoại của hệ điều hành (thêm ghi chú, cỡ tải, dòng "tạm không lưu được"), không dựng hộp trong giao diện. Dải "Đã cập nhật" + thẻ Cập nhật trong Cài đặt trên máy này đã làm; ghi chú gói kèm bộ cài (`release-notes/`).
  - Gỡ trên Windows: `installer.nsh` hỏi hai lần (bỏ qua khi bộ cài bản mới gỡ bản cũ hoặc gỡ im lặng). Chưa thử (cần Windows). `.deb` thêm `recommends: libreoffice-calc`.
  - Trang Tải về: ngày, yêu cầu máy, ghi chú, SHA-256, dòng SmartScreen — thử với `latest.json` mẫu trên máy dev.
  - Thêm `docs/mcah-quy-trinh-phat-hanh.md`.
