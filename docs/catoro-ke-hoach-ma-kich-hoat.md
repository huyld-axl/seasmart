# Catoro — Kế hoạch mã kích hoạt và trang quản trị Axalize

- **Ngày lập:** 2026-11-17
- **Trạng thái:** **đã thay** bằng `docs/catoro-ke-hoach-tai-khoan-tu-tren-xuong.md` (2026-11-17): bỏ mã kích hoạt, Axalize tạo tài khoản kèm văn phòng. Giữ phần khoá văn phòng chặn app, trang quản trị, nhật ký. Code ở commit `05ead6a` (chưa push).
- **Kế hoạch tổng:** `docs/catoro-ke-hoach-ung-dung-may-tinh.md` (mục 6.1 chống crack, M8 bản quyền). Kế hoạch này làm **phần cấp quyền dùng** của M8: chỉ khách Axalize đã cấp mã mới tạo được văn phòng. Cách tính tiền, gói, số máy vẫn để sau.
- **Wireframe:** `docs/design/wireframes/ma-kich-hoat.html` (7 màn).
- **Testcase chạy tay:** `docs/catoro-testcase-ma-kich-hoat.md`.
- **Hướng dẫn sử dụng (nháp):** `docs/catoro-huong-dan-ma-kich-hoat.html`, chép vào trang hướng dẫn ở bước 7.
- **Mục tiêu:** Axalize tạo mã kích hoạt trên trang quản trị và gửi cho khách đã mua; trong app, tạo văn phòng mới phải nhập mã (một mã cho một văn phòng). Trang quản trị cho xem văn phòng nào dùng mã nào, huỷ mã chưa dùng, khoá / mở khoá văn phòng có lý do, và xem nhật ký thao tác.

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md`, mục "Cách làm việc" của kế hoạch tổng và `docs/catoro-quy-trinh-phat-hanh.md` trước.
2. Làm đúng thứ tự bước ở mục 7; mỗi bước có "Xong khi". Phần nào chưa thử thật thì chưa xong.
3. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ.
4. Một commit cho cả việc trên `dev`. Không push nếu chưa được bảo. Không đọc / grep `.env`.
5. Bản web giữ nguyên. Test hiện có (`cloud/`, `backend/`, `desktop/`, `frontend/`) phải qua sau mỗi bước.

## 1. Đã có (không làm lại)

| Có rồi | Ở đâu |
|---|---|
| Trang quản trị `/tai-khoan/quan-tri`: danh sách văn phòng, thành viên, quét AI / tra tàu tháng này, cảnh báo dùng bất thường, Khoá / Mở khoá | `cloud/src/routes/admin.js` |
| Vào trang quản trị: phiên trình duyệt `mcah_s` + email nằm trong `CLOUD_ADMIN_EMAILS` | `admin.js` `adminAccount` |
| Cột `office.locked_at`; văn phòng khoá thì API qua chữ ký máy chính (AI, tra tàu, mời, LAN) trả 403 `office_locked`; lời mời không dùng được | `cloud/src/routes/api.js` `byMachine`, `offices.findInvite` |
| Vé mang `office_locked` | `cloud/src/services/oauth.js` `buildTicket` |
| Bảng `audit` (ai, việc gì, IP, văn phòng) | `cloud/migrations/001_accounts.sql`, `accounts.audit` |
| Tạo văn phòng: `POST /api/offices` bằng vé, gọi lại cùng máy thì trả văn phòng cũ | `api.js`, `offices.create` |
| Màn tạo văn phòng trong app (bước "Tên văn phòng") | `frontend/src/pages/desktop/FirstRunPage.jsx`, `desktop/src/session.js` `createOffice` |

**Chưa có:** khoá văn phòng **không** chặn dùng app. Backend máy chính (`desktop-ticket`, làm mới phiên) không kiểm `office_locked`, nên văn phòng bị khoá vẫn mở app và làm việc với dữ liệu trên máy, chỉ mất AI / tra tàu / mời người. Xem Q-L1.

## 2. Phạm vi

### 2.1 Làm

1. **Mã kích hoạt** (3.1, 3.2): bảng mới, tạo / huỷ / kiểm / dùng mã ở máy chủ dịch vụ.
2. **Tạo văn phòng phải có mã** (3.3, W6): API và màn trong app.
3. **Trang quản trị** (3.4, W1–W5): thêm tab Mã kích hoạt và Nhật ký; tab Văn phòng thêm ô tìm, cột Khách / mã và Quản trị, hộp xác nhận khoá có lý do.
4. **Khoá là chặn dùng app** (3.5, W7; Q-L1 = A).

### 2.2 Không làm

- **Subdomain riêng `admin.mcah.axalize.vn` + basic auth:** người dùng bảo chưa làm (2026-11-17). Cách làm đã bàn: khối `server` riêng trong `frontend/nginx.conf` có `auth_basic`, chặn `/tai-khoan/quan-tri` trên tên miền chính; cần người giữ DNS thêm bản ghi và người giữ server cấp HTTPS + tạo tệp `htpasswd`. Trang quản trị viết sao cho sau này chỉ cần thêm lớp này ở nginx, không đổi code.
- Hạn sử dụng văn phòng, gia hạn (đã chốt: không hạn, chỉ bật / tắt).
- Gói, giới hạn số tài khoản / số máy, giá (để bên kinh doanh quyết sau).
- Khách tự mua / thanh toán trên web.
- Gửi mã cho khách từ trang quản trị (Axalize tự gửi qua email / Zalo).

### 2.3 Cần người dùng / sếp trước khi code

- **Q-L1 — Khoá văn phòng thì app ra sao. Đã chốt A (2026-11-17).**
  - **A (đã chọn):** khoá là **chặn dùng app**. Máy chính và máy nhân viên không vào được (máy đang mở bị đưa ra ở lần làm mới phiên, tối đa 1 giờ khi có mạng; máy mất mạng dùng tới hết mốc offline 7 ngày). Dữ liệu trên máy khách giữ nguyên, sao lưu tự động vẫn chạy; mở khoá là đăng nhập dùng tiếp.
  - **B:** giữ như hiện nay: chỉ tắt quét AI, tra tàu, mời người; app vẫn dùng được với dữ liệu trên máy.
- **⛔ Q-L2 — Liên hệ hiện trong app** ở màn tạo văn phòng ("Chưa có mã? Liên hệ…") và màn bị khoá: số điện thoại / email / Zalo nào? (Hỏi bên kinh doanh.)
- **Q-L3 — Dạng mã** (đề xuất, đổi được lúc duyệt): `Catoro-XXXX-XXXX-XXXX`, 12 ký tự Crockford base32 (không có I, L, O, U), mã chưa dùng không hết hạn, Axalize huỷ được.
- **Q-L4 — Văn phòng đã tạo trước khi có mã** (đang thử nội bộ): đề xuất coi như đã kích hoạt, hiện "Tạo trước khi có mã", không phải nhập lại.

## 3. Thiết kế

### 3.1 Bảng `activation_code` (`cloud/migrations/004_activation_code.sql`)

| Cột | Ghi chú |
|---|---|
| `id UUID PK` | |
| `code_hash TEXT UNIQUE NOT NULL` | SHA-256 của mã đã chuẩn hoá (3.2); không lưu mã gốc |
| `code_tail TEXT NOT NULL` | 4 ký tự cuối, để nhận diện trong danh sách |
| `customer TEXT NOT NULL` | Tên khách (bắt buộc, ≤ 200) |
| `note TEXT` | Số hợp đồng, người liên hệ… (≤ 500) |
| `created_by UUID → account`, `created_at` | |
| `office_id UUID → office UNIQUE`, `used_by UUID → account`, `used_at` | Đã dùng cho văn phòng nào, ai nhập, lúc nào |
| `revoked_at`, `revoked_by UUID → account` | Đã huỷ |

- `CHECK (NOT (office_id IS NOT NULL AND revoked_at IS NOT NULL))`: mã đã dùng không huỷ được.
- Văn phòng cũ không có mã (Q-L4): không cần cột mới ở `office`; "Khách · mã" lấy qua `activation_code.office_id`, không có thì hiện "Tạo trước khi có mã".
- `audit.action` thêm: `code_create`, `code_revoke`, `office_activate`, `activation_fail`; khoá / mở khoá đã có (`office_lock`, `office_unlock`) — thêm cột `audit.detail TEXT` để ghi lý do khoá và đuôi mã / tên khách (`audit.action` là chữ tự do, không có `CHECK`).

### 3.2 Mã

- Sinh: 60 bit ngẫu nhiên (`crypto.randomBytes`) → 12 ký tự Crockford base32 → `Catoro-XXXX-XXXX-XXXX`.
- Chuẩn hoá khi nhập (máy chủ và app làm giống nhau): viết hoa; bỏ tiền tố `Catoro`, gạch, khoảng trắng; `O→0`, `I/L→1`. Sai độ dài hoặc ký tự lạ → "Mã kích hoạt không đúng".
- Mã đầy đủ **chỉ hiện một lần** ngay sau khi tạo (W3). Danh sách chỉ thấy `…XXXX`. Khách làm mất mã chưa dùng → Huỷ, tạo mã mới.
- Đặt trong `cloud/src/services/activation.js`: `create({ customer, note, adminId })`, `revoke({ id, adminId })`, `list({ status })`, `consume({ code, accountId, db })` (dùng trong transaction tạo văn phòng).

### 3.3 Tạo văn phòng cần mã (W6)

- `POST /api/offices` thêm `activation_code` (bắt buộc). Trong **cùng transaction** với `offices.create`: `SELECT … FOR UPDATE` theo `code_hash`, kiểm chưa dùng / chưa huỷ → tạo văn phòng → ghi `office_id, used_by, used_at` → audit `office_activate`.
- Gọi lại cùng máy khi tài khoản đã thuộc văn phòng (đang có): trả văn phòng cũ, **không** kiểm mã (để app thử lại sau lỗi mạng không bị "mã đã dùng").
- Lỗi (mã máy / thông báo):
  - thiếu: 400 `activation_required` "Nhập mã kích hoạt"
  - sai: 400 `activation_invalid` "Mã kích hoạt không đúng. Kiểm lại mã Catoro đã gửi cho bạn."
  - đã dùng: 409 `activation_used` "Mã này đã dùng cho một văn phòng khác. Liên hệ Catoro."
  - đã huỷ: 409 `activation_revoked` "Mã đã bị huỷ. Liên hệ Catoro."
  - quá 5 lần sai / tài khoản / giờ (đếm `activation_fail` trong `audit`): 429 "Nhập sai quá nhiều lần, thử lại sau 1 giờ." (ngoài giới hạn 10 lần / phút / IP đang có).
- Không cần mã: được mời vào văn phòng, chuyển máy chính, máy nhân viên.
- App: `FirstRunPage` bước "Tên văn phòng" thêm ô **Mã kích hoạt** ở trên (antd `Input`, tự viết hoa và chèn gạch khi gõ); nút Tạo văn phòng luôn bấm được, báo lỗi bằng `Banner` như hiện có. `desktop.createOffice({ name, code })` → IPC `create-office` kiểm kiểu → `session.createOffice` gửi `activation_code`. Dòng "Chưa có mã? Liên hệ Catoro: …" theo Q-L2.

### 3.4 Trang quản trị (W1–W5)

Vẫn là trang web do `cloud/src/routes/admin.js` dựng sẵn (HTML phía máy chủ, cùng CSS), cùng lối vào hiện có. Mọi trang và mọi POST kiểm `adminAccount`; POST kiểm thêm `Origin` / `Referer` cùng tên miền (chống gửi form từ trang khác).

| Đường dẫn | Việc |
|---|---|
| `GET /quan-tri` | Tab Văn phòng (W1): thêm cột Khách · mã (`…XXXX`) và email quản trị văn phòng; ô tìm lọc ngay trên trang (JS nhỏ, không validate) |
| `POST /quan-tri/khoa` | Đã có; thêm `reason` (bắt buộc khi khoá), hộp xác nhận (W4) dựng bằng `<dialog>`, ghi `audit.detail` |
| `GET /quan-tri/ma` | Tab Mã kích hoạt (W2): form tạo + bộ lọc Tất cả / Chưa dùng / Đã dùng / Đã huỷ + bảng |
| `POST /quan-tri/ma` | Tạo mã → trả trang W3 (mã đầy đủ + nút Chép). Thiếu tên khách: trả lại form có lỗi, giữ chữ đã nhập |
| `POST /quan-tri/ma/huy` | Huỷ mã chưa dùng (hỏi bằng `confirm()` của trình duyệt) |
| `GET /quan-tri/nhat-ky` | Tab Nhật ký (W5): 200 dòng `audit` gần nhất có action thuộc nhóm quản trị và kích hoạt |
| `GET /quan-tri/dang-xuat` | Không cần: dùng `/dang-xuat` có sẵn |

- Trang W3 đặt `Cache-Control: no-store` (mã đầy đủ không nằm trong bộ nhớ đệm trình duyệt). Không có GET nào trả lại mã đầy đủ.
- Dòng người đang vào (email) + Đăng xuất ở góc phải thanh tab.

### 3.5 Khoá là chặn dùng app (W7, Q-L1 = A)

- Backend máy chính, `POST /api/v1/auth/desktop-ticket` (`backend/src/routes/v1/desktop_ticket.routes.js`) và lối máy nhân viên (`lan_device.routes.js`): vé có `office_locked: true` → 403 `OFFICE_LOCKED` "Văn phòng … đang bị khoá…". Lối làm mới phiên dùng cùng đường nên máy đang mở bị đưa ra ở lần làm mới tiếp theo (mỗi giờ).
- `desktop/src/session.js`: nhận `OFFICE_LOCKED` khi đăng nhập / làm mới → `clear('locked')`; màn đăng nhập hiện dải lỗi W7 (`lastReason` đã có cơ chế hiện lý do).
- Không chặn: sao lưu tự động trên máy chính, xuất dữ liệu ra ngoài khi đã vào (không vào được thì thôi). Dữ liệu không bị xoá hay mã hoá thêm.
- Máy chủ dịch vụ không đổi: vé vẫn được cấp (có cờ), để app biết lý do.

### 3.6 Phát hành

- Phần `cloud/` deploy bằng `./deploy.sh` như mọi lần (không đổi DNS, server hay `.env`).
- Phần app (`desktop/`, `frontend/`, `backend/`) đổi → tăng phiên bản và phát theo `docs/catoro-quy-trinh-phat-hanh.md`. Thứ tự: deploy `cloud/` **trước** (máy chủ bắt mã) rồi phát app. App cũ chưa có ô mã sẽ nhận lỗi "Nhập mã kích hoạt" khi tạo văn phòng mới — chấp nhận vì chưa có khách thật (Q7 kế hoạch tổng).

## 4. File sẽ sửa / thêm

| Phần | File |
|---|---|
| cloud | `migrations/004_activation_code.sql` (mới), `src/services/activation.js` (mới), `src/services/offices.js` (`create` nhận mã), `src/routes/api.js`, `src/routes/admin.js` (tab, mã, nhật ký, xác nhận khoá), `src/services/accounts.js` (`audit` nhận `detail`), `test/activation.test.js` (mới), `test/admin_warnings.test.js` |
| backend | `src/routes/v1/desktop_ticket.routes.js`, `src/routes/v1/lan_device.routes.js`, test tương ứng |
| desktop | `src/session.js` (`createOffice` nhận mã, lý do `locked`), `src/ipc.js` |
| frontend | `src/pages/desktop/FirstRunPage.jsx`, `src/lib/desktop.js`, màn đăng nhập app (dải lỗi khoá), trang hướng dẫn |
| tài liệu | `docs/catoro-huong-dan-server-may-chu-dich-vu.md` (mục quản trị: tạo mã, khoá), kế hoạch tổng (M8: phần cấp quyền đã làm) |

## 5. Rủi ro riêng

| Rủi ro | Cách xử lý |
|---|---|
| Dò mã | 60 bit ngẫu nhiên; 5 lần sai / tài khoản / giờ + 10 lần / phút / IP; mã chỉ dùng được khi đã có tài khoản xác minh email |
| Hai người nhập cùng mã cùng lúc | `SELECT … FOR UPDATE` + `office_id UNIQUE`; người sau nhận "đã dùng" |
| Lộ mã qua trang quản trị | Chỉ lưu băm; mã đầy đủ hiện một lần, `no-store` |
| Ai đó trong Axalize khoá nhầm | Hộp xác nhận + lý do bắt buộc + nhật ký; mở khoá là dùng tiếp, không mất dữ liệu |
| Khoá không có tác dụng với máy mất mạng | Đã chấp nhận ở kế hoạch tổng (mốc offline 7 ngày) |
| App bị sửa để bỏ kiểm vé | Đã chấp nhận ở kế hoạch tổng 6.1; khoá vẫn tắt AI, tra tàu, mời, cập nhật danh mục |
| Trang quản trị chỉ có một lớp đăng nhập | Email nội bộ + mật khẩu / Google như hiện nay; subdomain + basic auth để sau (2.2) |

## 6. Test tự động

- cloud: sinh / chuẩn hoá mã (hoa thường, gạch, O/0, I/L/1, sai độ dài); tạo văn phòng thiếu / sai / đã dùng / đã huỷ / đúng; gọi lại cùng máy không cần mã; hai yêu cầu cùng mã song song chỉ một thành công; giới hạn 5 lần sai; trang quản trị: không phải admin → về đăng nhập / 403, tạo mã thiếu tên khách, huỷ mã đã dùng bị từ chối, khoá thiếu lý do bị từ chối, POST khác `Origin` bị từ chối, trang mã vừa tạo `no-store`, danh sách không chứa mã đầy đủ.
- backend: `desktop-ticket` và lối máy nhân viên trả `OFFICE_LOCKED` khi vé có cờ.
- desktop: `createOffice` gửi mã; lý do `locked` hiện ra ở `session.info()`.

## 7. Các bước

### Bước 0 — Duyệt
**⛔ DỪNG** người dùng duyệt wireframe + kế hoạch, trả lời Q-L2 (Q-L1 đã chốt A; Q-L3, Q-L4 theo đề xuất nếu không có ý khác).

### Bước 1 — Mã kích hoạt ở máy chủ dịch vụ (3.1, 3.2)
Migration, `activation.js`, `audit.detail`. **Xong khi:** test sinh / chuẩn hoá / tạo / huỷ qua; migration chạy trên DB dev có sẵn dữ liệu.

### Bước 2 — Tạo văn phòng cần mã (3.3, phần máy chủ)
**Xong khi:** test tạo văn phòng các trường hợp, chạy song song, giới hạn sai qua; văn phòng cũ không bị ảnh hưởng.

### Bước 3 — Trang quản trị (3.4, W1–W5)
**Xong khi:** trên máy dev mở `http://localhost:4100/quan-tri` bằng tài khoản admin: tạo mã, thấy mã một lần, huỷ, khoá có lý do, nhật ký đủ dòng; test trang quản trị qua; xem ở khung 375px không vỡ (bảng cuộn ngang).

### Bước 4 — Khoá chặn app (3.5, W7)
**Xong khi:** khoá văn phòng thử → máy chính đang mở bị đưa ra ở lần làm mới (thử bằng nút làm mới / chờ), đăng nhập lại thấy W7; mở khoá → đăng nhập dùng tiếp, dữ liệu đủ; máy nhân viên cũng vậy.

### Bước 5 — App: ô mã kích hoạt (3.3, W6)
**Xong khi:** app Ubuntu dev nối máy chủ dịch vụ dev: tạo văn phòng với mã đúng / sai / đã dùng / đã huỷ hiện đúng thông báo; mã gõ thường có khoảng trắng vẫn nhận.

### Bước 6 — Chạy testcase tay
Chạy `docs/catoro-testcase-ma-kich-hoat.md` trên máy dev (cloud dev + app Ubuntu). Windows chạy khi có máy. **Xong khi:** các dòng Ubuntu Đạt.

### Bước 7 — Hướng dẫn, Nhật ký, phát hành
Chép hướng dẫn nháp vào trang Hướng dẫn; thêm mục "Quản trị Axalize: mã kích hoạt, khoá văn phòng" vào `docs/catoro-huong-dan-server-may-chu-dich-vu.md`; ghi Nhật ký; cập nhật M8 ở kế hoạch tổng. **⛔ DỪNG** hỏi người dùng trước khi deploy `cloud/` và phát bản app (3.6). **Xong khi:** người dùng duyệt.

## 8. Nhật ký

- 2026-11-17: lập kế hoạch, wireframe, testcase, nháp hướng dẫn. Đã chốt với người dùng: cấp quyền bằng mã kích hoạt; không hạn dùng (chỉ bật / tắt); chưa có gói; subdomain + basic auth để sau. Chờ duyệt và Q-L2.
- 2026-11-17: chốt Q-L1 = A: khoá văn phòng là chặn dùng app (máy chính và máy nhân viên), dữ liệu giữ nguyên.
- 2026-11-17: duyệt, code.
  - Máy chủ dịch vụ: `004_activation_code.sql` (bảng mã, `audit.detail`), `services/activation.js` (sinh / chuẩn hoá / tạo / huỷ / dùng mã, chặn 5 lần sai / giờ), `POST /api/offices` bắt mã trong cùng transaction. Test tự động `test/activation.test.js` (chuẩn hoá, đủ trường hợp mã, hai yêu cầu song song, giới hạn sai, trang quản trị) — 33/33 test cloud qua.
  - **Khác thiết kế 3.4 (CSP của máy chủ dịch vụ cấm mọi script):** ô tìm là form GET lọc phía máy chủ; hộp xác nhận khoá / huỷ mã là trang xác nhận riêng (`GET /quan-tri/khoa`, `GET /quan-tri/ma/huy`); không có nút Chép mã — bấm vào mã là chọn hết (`user-select: all`). Kiểm form cùng trang bằng `Sec-Fetch-Site` + cookie SameSite=Lax thay cho `Origin` (Referrer-Policy no-referrer làm trình duyệt gửi `Origin: null`). `Cache-Control: no-store` đã có cho mọi trang.
  - Khoá chặn app: backend máy chính `desktop-ticket` và `desktop-machine` trả 403 `OFFICE_LOCKED` khi vé có cờ (máy nhân viên đăng nhập qua cùng đường); `session.js` về màn đăng nhập với lý do `locked`. Không thêm nút "Đăng xuất tài khoản này" ở W7: khi bị khoá app đã bỏ phiên, không còn gì để đăng xuất.
  - App: ô Mã kích hoạt ở màn tạo văn phòng (tự viết hoa, nhóm gạch), IPC `create-office` nhận `{ name, code }`; test giao diện `FirstRunPage.test.jsx`. Dòng liên hệ tạm ghi "Liên hệ Catoro." chờ Q-L2.
  - Thử trên máy dev: trang quản trị trên máy chủ dịch vụ dev (DB riêng `mcah_cloud_ui`): tạo mã (thiếu tên khách báo lỗi giữ ghi chú), mã hiện một lần, gọi API tạo văn phòng bằng mã sai rồi mã gõ thường có khoảng trắng, danh sách văn phòng hiện khách · mã, khoá có lý do, nhật ký đủ dòng, 375px không cuộn ngang trang. **Chưa thử app Electron trọn luồng** (đăng nhập qua trình duyệt với máy chủ dev, tạo văn phòng, bị đưa ra khi khoá).
  - Hướng dẫn: thêm vào mục "Tài khoản và đăng nhập (ứng dụng trên máy tính)" của trang Hướng dẫn; mục quản trị trong `docs/catoro-huong-dan-server-may-chu-dich-vu.md`; M8 ở kế hoạch tổng.
