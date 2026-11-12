# MCAH — Kế hoạch app máy tính, giai đoạn 3: máy chính và máy nhân viên

- **Ngày lập:** 2026-11-12
- **Trạng thái:** chờ duyệt. Chưa code.
- **Kế hoạch tổng:** `docs/mcah-ke-hoach-ung-dung-may-tinh.md` (mục 3.2 ghép máy, 3.4 chống ghi đè, 9 ý 8 phiên bản giao tiếp, 10 giai đoạn 3, 11 nhóm D và E7).
- **Wireframe:** `docs/design/wireframes/desktop-gd3.html` (7 màn).
- **Testcase chạy tay:** `docs/mcah-testcase-desktop-gd3.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/mcah-huong-dan-desktop-gd3.html`, chép vào mục "Ứng dụng trên máy tính" của trang hướng dẫn ở bước 10.
- **Mục tiêu:** nhiều máy trong một văn phòng. Máy chính giữ dữ liệu và mở cổng HTTPS trong mạng văn phòng; máy nhân viên tự tìm, kiểm đúng máy chính, ghép, rồi làm việc qua mạng như đang ngồi ở máy chính. Hai người sửa cùng một hồ sơ không ghi đè nhau. Máy nhân viên cập nhật theo máy chính không cần internet.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng và Nhật ký của `docs/mcah-ke-hoach-desktop-gd2.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả giai đoạn trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. **Bản web giữ nguyên.** Riêng chống ghi đè (mục 3.4) chạy cho cả bản web vì có lợi như nhau; mọi phần LAN chỉ bật khi `config.desktop`.
6. **Cần 2 máy** (tốt nhất 1 Ubuntu + 1 Windows) cho bước 2 trở đi. Trên một máy dev chỉ thử được bằng hai bản app khác thư mục dữ liệu; ghi rõ khi chỉ thử kiểu đó.

## 1. Đã có (không làm lại)

| Có rồi | Ở đâu |
|---|---|
| Tài khoản, vé đăng nhập Ed25519, văn phòng, thành viên, mời / khoá nhân viên | `cloud/`, `backend/src/routes/v1/desktop_ticket.routes.js`, `user.service.js` |
| Khoá máy chính (Ed25519) ký mọi lệnh gửi máy chủ dịch vụ; cột `office_machine.cert_fingerprint` đã có, chưa dùng | `desktop/src/signer.js`, `cloud/migrations/001_accounts.sql` |
| Phiên giữ ở tiến trình chính, giao diện không cầm token; `/api` chuyển tiếp qua tiến trình chính | `desktop/src/session.js`, `main.js` |
| PIN, tự khoá, mốc offline 7 ngày | `desktop/src/pin.js`, `backend/src/plugins/index.js` |
| Cập nhật có chữ ký Ed25519 | `desktop/src/updater.js` |
| AI, tra tàu, danh mục tàu qua máy chủ dịch vụ (backend gọi) | `backend/src/utils/desktop_cloud.js` |

## 2. Phạm vi

### 2.1 Làm

1. Máy chính mở HTTPS trong mạng văn phòng (cổng 7443), chứng chỉ tự tạo, gửi dấu vân tay lên máy chủ dịch vụ; quảng bá tên trong mạng (mDNS); giữ máy không ngủ; mở tường lửa.
2. Máy nhân viên tìm máy chính (mDNS, hoặc gõ tên / IP), kiểm dấu vân tay với máy chủ dịch vụ, ghép, nhận mã thiết bị.
3. Mọi lệnh từ máy nhân viên kèm mã thiết bị; gỡ thiết bị cắt phiên ngay. Màn "Máy trong văn phòng" (W2).
4. Máy nhân viên: dải "Không nối được máy chính", tự nối lại, giữ form đang gõ, tự tìm lại khi máy chính đổi IP (W3).
5. Chống ghi đè: cột `version` trên các bảng sửa qua form, lỗi 409, hộp xung đột (W4). Mã yêu cầu chống tạo trùng.
6. Phiên bản giao tiếp; máy chính phát bộ cài cho máy nhân viên (W5).
7. PDF, quét AI, tìm tàu, soạn thư có tệp đính kèm từ máy nhân viên đi qua máy chính.

### 2.2 Không làm

- Lớp kho tệp mã hoá, nhắc mã hoá ổ đĩa, sao lưu khác máy: giai đoạn 4.
- Máy nhân viên làm việc khi máy chính tắt (chế độ offline riêng): không có trong thiết kế.
- Nhiều máy chính cho một văn phòng.

### 2.3 Cần người dùng / sếp trước khi xong giai đoạn

- **M6:** quy tắc 375px trong `CLAUDE.md` (mục 3.5) còn áp cho màn mới không? Màn giai đoạn 3 chỉ dựng cho máy tính. Cần câu trả lời trước khi sửa `CLAUDE.md`.
- Hai máy thật trong cùng mạng (một Windows) cho bước 2–9.
- Mạng văn phòng thật có chặn mDNS / cô lập máy trong Wi-Fi không (nhiều router khách bật "AP isolation").

## 3. Thiết kế

### 3.1 Máy chính: cổng HTTPS trong mạng

- Tiến trình chính mở `https.createServer` ở `0.0.0.0:7443` và chuyển tiếp vào Fastify (đang chỉ nghe `127.0.0.1`), như cách `/api` đang đi. Backend **không** nghe ra ngoài.
- Chứng chỉ: ECDSA P-256 tự tạo lúc tạo văn phòng, hạn 10 năm, CN = tên máy. Tạo bằng thư viện `@peculiar/x509` (Node không tự tạo được X.509). Khoá riêng lưu như khoá máy chính (két hệ điều hành).
- Dấu vân tay SHA-256 của chứng chỉ gửi lên máy chủ dịch vụ bằng lệnh ký sẵn có: `PUT /api/office/machine/cert`. Máy chủ dịch vụ trả dấu vân tay cho thành viên đang hoạt động trong `/api/me` (trường `office.machine_fingerprint`, `office.machine_name`).
- Chỉ các đường sau mở ra mạng: `/lan/hello` (không cần mã: tên văn phòng, phiên bản giao tiếp), `/lan/pair`, `/lan/installer/*` (cần mã thiết bị), `/api/*` (cần mã thiết bị + JWT). Mọi đường khác 404.
- mDNS: `bonjour-service`, dịch vụ `_mcah._tcp`, TXT `office=<id>`, `proto=<n>`. Không có tên văn phòng hay email trong TXT.
- Không cho ngủ: `powerSaveBlocker.start('prevent-app-suspension')` khi là máy chính.
- Tường lửa: bộ cài Windows (NSIS) thêm luật cho cổng 7443 mạng Private. Ubuntu: nếu `ufw` đang bật thì thẻ máy chính (W6) báo câu lệnh cần chạy.

### 3.2 Ghép máy

1. Máy nhân viên đăng nhập trình duyệt như giai đoạn 2. `/api/me` cho biết đã thuộc văn phòng và dấu vân tay máy chính → vào màn W1.
2. Tìm qua mDNS theo `office=<id>`; không thấy trong 5 giây thì hiện ô gõ tên / IP.
3. Mở TLS tới máy tìm được, **so dấu vân tay chứng chỉ** với dấu vân tay từ máy chủ dịch vụ (ghim chứng chỉ, không dùng kho CA). Khác → W7, không gửi gì.
4. Máy nhân viên gửi `/lan/pair`: vé đăng nhập (vé của máy chủ dịch vụ, máy chính kiểm như đang kiểm), tên máy, hệ điều hành, phiên bản.
5. Máy chính: thành viên đang hoạt động, máy chưa từng bị gỡ → cấp ngay mã thiết bị (32 byte ngẫu nhiên, DB chỉ giữ SHA-256). Máy đã bị gỡ xin lại → trạng thái `pending`, báo chuông cho quản trị, máy nhân viên chờ (W1 phải).
6. Máy nhân viên cất mã thiết bị + dấu vân tay + tên máy chính trong `settings` (két hệ điều hành).

Bảng mới ở máy chính: `office_device (id, name, os, app_version, token_hash, status active|pending|removed, last_user_id, last_seen_at, created_at, removed_at)` — migration `045_office_device.sql`.

### 3.3 Mỗi lệnh từ máy nhân viên

- Tiến trình chính máy nhân viên chuyển tiếp `/api` sang `https://<máy chính>:7443/api` (thay cho `127.0.0.1`), header `X-MCAH-Device`, `X-MCAH-Protocol`. Giao diện không biết gì khác.
- Máy chính kiểm mã thiết bị trước JWT; `removed` hoặc không có → 401 `device_removed` → máy nhân viên xoá mã, về W1.
- JWT của máy nhân viên do máy chính cấp (như máy chính tự cấp), giữ ở tiến trình chính máy nhân viên. PIN và tự khoá chạy ở máy nhân viên như giai đoạn 2.
- Mất nối (lỗi mạng / hết giờ 8 giây): trả cho giao diện 503 `main_unreachable`; giao diện hiện dải đỏ (W3), chặn nút lưu, giữ form. Thử lại mỗi 5 giây; quá 3 lần thì tìm lại qua mDNS theo `office=<id>` (máy chính đổi IP) — vẫn kiểm dấu vân tay.
- Tệp: tải về (PDF, ảnh, tệp đính kèm thư) đi qua chuyển tiếp như thường. Soạn thư có tệp: máy nhân viên tải tệp về thư mục tạm của mình rồi mở trình thư (`mail.js`). PDF tạo trên máy chính (backend), chỉ chuyển tệp về.

### 3.4 Chống ghi đè

- Thêm `version INT NOT NULL DEFAULT 1` (migration `046_row_version.sql`) cho: `seafarer`, `vessel` (fleet), `partner` và bảng danh mục sửa qua form ở `master_data`, `opportunity`, `seafarer_contract`, `contract_bill`, `export_pack`, `certificate`, `voyage`, `document`, `app_user`. Danh sách chính xác chốt ở bước 6 theo các route PUT/PATCH đã liệt kê.
- GET chi tiết trả `version`. PUT/PATCH nhận `version`; câu UPDATE thêm `AND version = $n` và `version = version + 1`. Không khớp → 409 `{ error: 'conflict', current, changed_by, changed_at }`. Thiếu `version` → vẫn cho lưu (giữ tương thích bản cũ trong lúc chuyển), ghi cảnh báo log; bỏ ở giai đoạn 7.
- Giao diện: `ConflictDialog` mới ở `components/ds/`, minh hoạ ở `/design-system`. Hook dùng chung trong `FormFrame`: nhận 409 → so bản mới với bản lúc mở và phần mình đã đổi → hiện W4. "Lấy bản mới, giữ phần tôi đã đổi" nạp bản mới và đặt lại các ô mình đổi (chip "Đã sửa" như hiện nay). Cùng một ô hai bên đổi → ô đó hiện cả hai giá trị để chọn.
- Mã yêu cầu: form thêm mới tạo `Idempotency-Key` (UUID) mỗi lần mở form; POST tạo mới gửi kèm. Máy chính giữ `idempotency_key (key, user_id, path, status, body, created_at)` 24 giờ; trùng → trả lại đúng kết quả lần trước. Bảng trong `046`.

### 3.5 Phiên bản giao tiếp và bộ cài qua mạng

- `PROTOCOL = 1` trong `desktop/src/manifest.js`; tăng khi API giữa hai máy đổi kiểu không tương thích.
- Khác phiên bản → máy chính trả 426 `{ protocol, version }` → máy nhân viên hiện W5, tải `/lan/installer/<win|linux>` kèm tệp chữ ký, kiểm bằng khoá cập nhật Ed25519 sẵn có (`updater.js`), chạy cài như cập nhật thường.
- Máy chính khi tự cập nhật tải về **cả hai** bộ cài (Windows và Ubuntu) cùng chữ ký, giữ bản mới nhất trong thư mục dữ liệu (~250 MB).

## 4. File sẽ sửa / thêm

| Phần | File |
|---|---|
| desktop mới | `src/lan-server.js` (HTTPS 7443, chuyển tiếp, kiểm thiết bị), `src/lan-cert.js`, `src/discovery.js` (mDNS), `src/lan-client.js` (ghép, ghim chứng chỉ, chuyển tiếp, nối lại), `pages/pair.html` hoặc màn React W1 |
| desktop sửa | `main.js`, `ipc.js`, `preload.js`, `session.js`, `office.js`, `updater.js`, `manifest.js`, `electron-builder` cấu hình NSIS (tường lửa) |
| cloud | `src/routes/api.js` (`PUT /api/office/machine/cert`, `/api/me` thêm dấu vân tay), test |
| backend | migration `045_office_device.sql`, `046_row_version.sql`; `routes/v1/lan_device.routes.js`; `plugins/index.js` (kiểm thiết bị, mã yêu cầu); service + route của các bảng ở 3.4 |
| frontend | `components/ds/ConflictDialog.jsx`, `/design-system`, `FormFrame` (hook xung đột + mã yêu cầu), các form sửa, `pages/desktop/PairPage.jsx`, `pages/admin/DevicesPage.jsx`, `OfflineRibbon` (dải đỏ), `DeviceSettingsPage.jsx` (thẻ máy chính), trang hướng dẫn |

## 5. Rủi ro riêng

| Rủi ro | Cách xử lý |
|---|---|
| Router chặn mDNS / cô lập Wi-Fi | Ô gõ tên / IP; hướng dẫn tắt "AP isolation"; ghi vào hướng dẫn |
| Tường lửa Windows hỏi lần đầu, người dùng bấm "Huỷ" | Luật tường lửa thêm lúc cài; thẻ W6 có nút "Mở cổng" |
| Thêm `version` làm vỡ form đang chạy ở bản web | Thiếu `version` vẫn lưu được (3.4); test backend mỗi route |
| Bộ cài hai nền tảng làm máy chính tốn ổ | Chỉ giữ bản mới nhất |
| Máy chính ngủ dù đã chặn (laptop gập nắp) | Hướng dẫn nói rõ máy chính nên là máy bàn; thẻ W6 báo |

## 6. Test tự động

- desktop: ghim chứng chỉ (đúng / sai dấu vân tay), ghép (cấp ngay / chờ duyệt / bị gỡ), chuyển tiếp từ chối thiếu mã thiết bị, 426 khi khác phiên bản, nối lại sau khi máy chính đổi cổng.
- backend: mỗi route ở 3.4 trả 409 khi `version` cũ, lưu được khi đúng / thiếu; mã yêu cầu trùng trả kết quả cũ, chỉ tạo một bản ghi.
- cloud: lưu và trả dấu vân tay, chỉ cho máy chính đúng chữ ký.
- frontend: `ConflictDialog` gộp ô đúng (ô mình đổi giữ lại, ô người kia đổi lấy mới, cùng ô thì hỏi).

## 7. Các bước

### Bước 0 — Chuẩn bị
Cài `@peculiar/x509`, `bonjour-service` (kiểm giấy phép, kích thước, chạy được trong Electron trên cả hai hệ điều hành). **Xong khi:** hai thư viện chạy ở bản đóng gói Ubuntu.

### Bước 1 — Chống ghi đè ở backend + giao diện (3.4, W4)
Làm trước vì không cần hai máy và có lợi cả bản web. **Xong khi:** test backend qua; mở hai tab bản web cùng sửa một thuyền viên thì ra W4, số điện thoại của A không bị ghi đè (D8 trên một máy); D9 qua bằng cách gửi lại cùng mã yêu cầu.

### Bước 2 — Chứng chỉ, cổng 7443, dấu vân tay lên máy chủ dịch vụ (3.1, W6)
**Xong khi:** từ máy khác `curl -k https://<máy chính>:7443/lan/hello` trả tên văn phòng; `/api` không có mã thiết bị bị từ chối (D3); máy chủ dịch vụ giữ đúng dấu vân tay.

### Bước 3 — Tìm máy chính, ghép (3.2, W1, W7)
**Xong khi:** D1 (phần tìm và ghép), D2 qua; nhân viên mới được mời ghép xong và vào đúng vai trò (E7 phần ghép máy).

### Bước 4 — Chuyển tiếp mọi lệnh, máy trong văn phòng, gỡ (3.3, W2)
**Xong khi:** máy nhân viên làm được mọi việc như máy chính; D5 qua; máy bị gỡ xin lại phải chờ duyệt.

### Bước 5 — Mất nối, nối lại, đổi IP (3.3, W3)
**Xong khi:** D6, D7 qua.

### Bước 6 — Chống ghi đè cho mọi form còn lại (3.4)
Bước 1 làm thuyền viên làm mẫu; bước này phủ mọi bảng ở 3.4. **Xong khi:** D8 qua giữa hai máy thật, với ít nhất thuyền viên, tàu, hợp đồng, bill.

### Bước 7 — PDF, AI, tra tàu, thư từ máy nhân viên (2.1 ý 7)
**Xong khi:** D12 qua; soạn thư có tệp đính kèm mở được trình thư của máy nhân viên.

### Bước 8 — Phiên bản giao tiếp, bộ cài qua mạng (3.5, W5)
**Xong khi:** D10, D11 qua (máy nhân viên rút cáp internet, chỉ còn mạng văn phòng).

### Bước 9 — Bảo mật đường truyền, trộn hệ điều hành
**⛔ DỪNG** nếu chưa có máy Windows: báo người dùng, làm tiếp phần còn lại, để D13 "Chờ máy". **Xong khi:** D4 (Wireshark không thấy nội dung), D13 qua.

### Bước 10 — Hướng dẫn, Nhật ký
Chép nháp `docs/mcah-huong-dan-desktop-gd3.html` vào trang hướng dẫn (mục app), cập nhật kế hoạch tổng §15, ghi Nhật ký dưới đây. **Xong khi:** người dùng duyệt.

## 8. Nhật ký

- 2026-11-12: lập kế hoạch, wireframe, testcase, nháp hướng dẫn. Chờ duyệt.
