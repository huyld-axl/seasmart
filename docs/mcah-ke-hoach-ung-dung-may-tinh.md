# MCAH — Kế hoạch chuyển sang ứng dụng cài trên máy tính

- **Ngày lập:** 2026-11-09 · **Sửa lớn:** 2026-11-11 (chốt Q1–Q13; sửa theo review: khoá dữ liệu, sao lưu, xác thực thiết bị, ghi đè khi sửa đồng thời, kho tệp, cập nhật; đăng nhập qua trình duyệt)
- **Yêu cầu của sếp:** người dùng tải bộ cài từ website, cài lên máy như một phần mềm bình thường. Dữ liệu nghiệp vụ lưu trong máy của khách (không lưu trên máy chủ của bên mình). Một vài tính năng dùng mạng (tìm tàu, quét giấy tờ). Tài khoản đăng ký và đăng nhập qua mạng, trên trình duyệt (như app Codex, Claude Code).
- **Hai điều phải đảm bảo:** (1) dữ liệu của người dùng an toàn, (2) sản phẩm của bên mình không dễ bị bẻ khoá (crack).
- **Trạng thái:** kế hoạch, **chưa có code**. Q1–Q13 đã chốt (mục 4.1). Việc còn mở không chặn giai đoạn 0: mục 4.2.
- **Người làm:** một agent lập trình. Đọc mục "Cách làm việc với file này" ngay dưới trước tiên.

## Cách làm việc với file này

1. Đọc `CLAUDE.md` ở gốc repo trước. Mọi quy ước vẫn áp dụng (CommonJS không chấm phẩy ở backend, SQL tham số hoá, `pickAllowed`, lỗi dạng `{ statusCode, message }`, xoá tệp qua `trashFiles()`, chữ giao diện tiếng Việt). Riêng quy định 375px ở mục 3.5 chờ M6 (mục 4.2).
2. Mục 0–9 là **hướng thiết kế đã chốt**: dùng để biết "làm cái gì". Không tự đổi quyết định ở mục 4.1; thấy cần đổi thì ⛔ DỪNG và hỏi. Chi tiết kỹ thuật (thư viện, cách chạy) được xác nhận ở giai đoạn 0 và ghi lại ở mục 13.
3. Làm đúng thứ tự giai đoạn ở mục 10. **Chỉ giai đoạn 0 đã có bước chi tiết.** Giai đoạn 0 là thử nghiệm, kết quả của nó quyết định cách làm các giai đoạn sau. Vì vậy:
   - Trước khi bắt đầu **mỗi giai đoạn từ 1 trở đi**: viết kế hoạch chi tiết riêng `docs/mcah-ke-hoach-desktop-gd<N>.md` theo mẫu các kế hoạch khác trong `docs/` (các bước nhỏ, file sẽ sửa, "Xong khi" từng bước, testcase lấy từ mục 11). Giai đoạn có màn mới thì kèm wireframe (danh sách màn ở cuối mục 10), dựng trên trang và control `components/ds/` sẵn có.
   - ⛔ **DỪNG** chờ người dùng duyệt kế hoạch chi tiết và wireframe rồi mới code.
4. Mỗi bước có "Xong khi"; chỉ sang bước sau khi mọi ý đều đúng. **Phần nào chưa thử thật thì chưa xong**, kể cả phần Windows.
5. Commit trên nhánh `dev` (không tạo nhánh khác), một commit cho một giai đoạn, message tiếng Việt thể mệnh lệnh. Không push nếu chưa được bảo.
6. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ trả lời.
7. Ghi tiến độ vào mục 15 "Nhật ký" sau mỗi giai đoạn.
8. Không đọc, không grep tệp `.env`; cần biết biến nào thì xem `.env.example` hoặc hỏi.

---

## 0. Tóm tắt một trang (để trình sếp)

1. **Giữ phần lớn code, nhưng không phải "gần như nguyên vẹn".** Giao diện React và phần xử lý Fastify được bọc trong **Electron** (cùng công nghệ với Claude, Slack, VS Code); PostgreSQL được **đóng gói chạy ngầm**. Phải sửa thật ở các chỗ: đăng nhập, kho tệp (mã hoá), sao lưu, chống ghi đè khi hai người cùng sửa, cấu hình địa chỉ máy chính.
2. **Một văn phòng dùng chung một kho dữ liệu.** Một máy trong văn phòng là **máy chính**: giữ cơ sở dữ liệu và tài liệu. Các máy nhân viên cài cùng app, **nối vào máy chính qua mạng nội bộ** (cùng Wi-Fi / mạng dây văn phòng).
3. **Tài khoản đăng ký và đăng nhập trên web.** Bấm "Đăng nhập" trong app → trình duyệt mở trang SeaSmart → đăng ký / đăng nhập bằng email hoặc Google → quay về app là xong. Quản trị mời nhân viên qua email ngay trong app. Đã đăng nhập thì **mất internet vẫn làm việc tới 7 ngày**.
4. **Máy chủ dịch vụ của bên mình** trên internet làm: **tài khoản và đăng nhập**, **AI quét giấy tờ**, **danh mục tàu / tra IMO**, phát bản cập nhật. Máy chủ giữ thông tin tài khoản (email, tên, thuộc văn phòng nào), **không giữ dữ liệu nghiệp vụ** (thuyền viên, hợp đồng, giấy tờ…). Khoá AI, khoá nguồn tàu không bao giờ nằm trong bộ cài.
5. **Chống crack — nói thật:** không phần mềm cài trên máy nào chống crack được 100%. Bền nhất là để **phần giá trị nhất chạy trên máy chủ của mình** (đăng nhập, AI, danh mục tàu, cập nhật), cộng làm rối code và ký số. **Bản quyền (cách tính tiền) để sau**; tài khoản văn phòng trên máy chủ là nền sẵn cho nó. Bản đầu chưa có bản quyền: người có kỹ thuật cao vẫn có thể sửa app để dùng phần offline mà không qua đăng nhập; đây là đánh đổi chấp nhận ở bản đầu.
6. **Bảo mật cho người dùng:** đăng nhập qua web, tự khoá màn hình (mở bằng mã PIN); đường truyền giữa các máy được mã hoá và mỗi máy phải được xác thực; tài liệu giấy tờ được mã hoá trên ổ đĩa; sao lưu tự động có mã hoá, khôi phục được sang máy mới (kể cả Windows ↔ Ubuntu); app không gửi dữ liệu nghiệp vụ ra internet ngoài lúc người dùng chủ động quét giấy tờ / tìm tàu.
7. **Hệ điều hành:** Windows và Ubuntu. Không macOS, không điện thoại (code giao diện điện thoại hiện có vẫn giữ).
8. **Thời gian ước tính:** sau giai đoạn 0 (Ubuntu) còn 15–18 tuần tới bản chạy thử với vài văn phòng (làm bằng AI, một người); xem cuối mục 10.
9. **Chi phí cố định thêm (tham khảo):** chứng thư ký số cho Windows ~200–600 USD/năm (không có vẫn cài được nhưng Windows hiện cảnh báo; nên mua trước khi bán rộng), máy chủ dịch vụ ~10–40 USD/tháng. Ubuntu không tốn khoản nào.
10. **Điều sếp cần biết đánh đổi:** **máy chính phải bật** thì máy nhân viên mới làm việc được; **không làm việc từ ngoài văn phòng** ở bản đầu; **không dùng trên điện thoại**; **đăng nhập lần đầu và mời người mới cần internet**; máy chủ của bên mình sập lâu hơn 7 ngày thì người dùng phải chờ mới đăng nhập lại được.

---

## 1. Từ điển nhanh

| Từ | Nghĩa đơn giản |
|---|---|
| **Electron** | Bộ khung biến một trang web thành phần mềm cài trên máy. App là một cửa sổ Chrome thu nhỏ chạy giao diện của mình, cộng với Node.js chạy phần xử lý. |
| **Máy chính** | Máy trong văn phòng giữ toàn bộ dữ liệu nghiệp vụ. Nên là máy bàn luôn bật. |
| **Máy nhân viên** | Máy cài cùng app, không giữ cơ sở dữ liệu, nối vào máy chính để làm việc. |
| **Mạng nội bộ (LAN)** | Mạng Wi-Fi / mạng dây trong văn phòng. Các máy nói chuyện với nhau không cần ra internet. |
| **Máy chủ dịch vụ** (cloud) | Máy chủ của bên mình trên internet: tài khoản, quét AI, tìm tàu, phát bản cập nhật. |
| **Tài khoản SeaSmart** | Tài khoản đăng ký trên web của bên mình (email + mật khẩu hoặc Google). Một người một tài khoản, thuộc một văn phòng. |
| **Đăng nhập qua trình duyệt** | App mở trình duyệt để người dùng đăng nhập trên web; xong thì trình duyệt trả "vé" về app. App không bao giờ thấy mật khẩu. |
| **Phiên** | Khoảng thời gian app nhớ là bạn đã đăng nhập. Ở đây tối đa 7 ngày không có internet. |
| **Ghép máy** | Bước một lần để máy nhân viên được máy chính tin, và máy nhân viên chắc chắn nối đúng máy chính. |
| **Khoá dữ liệu** | Khoá dùng để mã hoá tài liệu trên máy chính. Mất khoá là mất tài liệu, nên được giữ trong bản sao lưu (đã khoá bằng mật khẩu sao lưu). |
| **Mã hoá** | Biến dữ liệu thành chuỗi vô nghĩa, chỉ ai có khoá mới đọc lại được. |
| **Két của hệ điều hành** | Nơi Windows / Ubuntu cất mật khẩu và khoá an toàn, gắn với tài khoản đăng nhập máy (Windows DPAPI, Ubuntu Keyring). |
| **Ký số** | "Đóng dấu" bộ cài / bản cập nhật để máy biết nó đến từ công ty mình và chưa bị sửa. |
| **Bytecode / làm rối code** | Biến code dễ đọc thành dạng máy hiểu nhưng người rất khó đọc. |

---

## 2. Hiện trạng và những gì phải đổi

App hiện là web: một máy chủ chạy Fastify + PostgreSQL (Docker), người dùng mở bằng trình duyệt, đăng nhập JWT. Bản web chưa có khách thật (Q7), nên không cần chuyển dữ liệu. Đã kiểm trong code:

| Phần | Hiện tại | Khi thành app máy tính |
|---|---|---|
| Giao diện | React 19 + Ant Design. Địa chỉ API cố định lúc build (`VITE_API_URL` trong `frontend/src/api/client.js`), router `createBrowserRouter` | Chạy trong cửa sổ Electron ở mọi máy. **Phải đổi:** địa chỉ máy chính lấy lúc chạy (do app cấp), cách phục vụ trang và định tuyến khi mở bằng tệp đóng gói (mục 10, bước 0.3) |
| Phần xử lý | Fastify, ~12.900 dòng, 20 nhóm API | Chạy trên **máy chính**, nghe trong mạng nội bộ qua HTTPS, chỉ nhận máy đã ghép (mục 3.2) |
| Cơ sở dữ liệu | PostgreSQL 17, 42 migration, dùng nhiều tính năng riêng của Postgres (`unaccent` 23 chỗ, trigger 29, `ILIKE` 25, `ON CONFLICT` 25, `FOR UPDATE` 28, `jsonb` 16) | **Đóng gói PostgreSQL vào app**, chỉ chạy trên máy chính (Q4) |
| Đăng nhập | Email + mật khẩu băm trong DB; tạo user thì gửi thư mời đặt mật khẩu với link `APP_URL/dat-mat-khau` (`user.service.js`, `email.service.js`) | **Đổi hẳn:** đăng ký / đăng nhập trên web của bên mình, app nhận vé qua trình duyệt (mục 3.3). Mật khẩu không còn lưu ở máy chính. Thư mời do máy chủ dịch vụ gửi |
| Vai trò, quyền | Đọc từ DB mỗi request (`fastify.can`) | **Giữ nguyên**, vẫn nằm trên máy chính. Mỗi user cục bộ gắn với một tài khoản SeaSmart |
| Phiên đăng nhập ở giao diện | JWT + thông tin user lưu `localStorage` (`frontend/src/stores/authStore.js`) | Cất trong két hệ điều hành qua app, không để `localStorage` (mục 5.2) |
| Sửa hồ sơ | Form gửi toàn bộ trường (`SeafarerFormPage.jsx`); backend khoá dòng `FOR UPDATE` nhưng **không kiểm hồ sơ đã bị người khác sửa sau lúc mở form** (`seafarer.service.js` `applyUpdate`) | **Phải sửa:** kiểm phiên bản khi lưu, báo xung đột (mục 3.4) |
| Tệp (gốc, ảnh trang, ảnh thu nhỏ, chân dung, chứng chỉ, logo, ZIP hồ sơ đã gửi, thùng rác) | Nhiều service tự ghi thẳng vào `UPLOAD_DIR`, DB lưu **đường dẫn tuyệt đối** (vd. `document_upload.storage_path`) | Một **lớp kho tệp** dùng chung cho mọi lần đọc / ghi, mã hoá tất cả; DB lưu mã tệp / đường dẫn tương đối (mục 5.5) |
| Tệp tạm | Xuất PDF ghi Excel/PDF vào thư mục tạm hệ thống (`xlsx_pdf.js`) | Mọi tệp tạm nằm trong thư mục tạm riêng của app, dọn cả lúc khởi động (mục 5.5) |
| Migration | Mỗi tệp một transaction riêng (`backend/scripts/migrate.js`): lỗi ở tệp thứ ba thì hai tệp trước đã áp dụng | Cập nhật lỗi thì khôi phục từ bản sao lưu chụp ngay trước khi cập nhật (mục 5.4) |
| AI đọc giấy tờ | Gọi OpenAI / Anthropic bằng khoá trong `.env` | **Chuyển lên máy chủ dịch vụ.** Máy chính gửi ảnh lên, nhận kết quả; máy chủ không lưu ảnh |
| Tra tàu theo IMO | Gọi máy chủ trung gian bằng `VESSEL_API_ENC_KEY` | **Chuyển lên máy chủ dịch vụ** |
| Danh mục tàu thế giới | Bảng `ship_catalog` (~30 MB) nạp vào Postgres | **Để trên máy chủ dịch vụ**, không đóng gói vào bộ cài |
| Gửi email nghiệp vụ | SMTP cấu hình chung trong `.env` | **Mở thư mới trong app mail của máy đang dùng**, tự đính kèm tệp. SMTP là cách phụ. Mục 8.1 |
| SMS | Webhook trong `.env` | **Tạm bỏ.** Code `sms.service.js` để nguyên, không nối vào app |
| Việc chạy theo giờ (`jobs.js`) | 2h, 3h, 7h sáng và mỗi 5 phút | Chạy trên máy chính khi app mở; **chạy bù** việc bị lỡ lúc mở app |
| Xuất Excel sang PDF | LibreOffice (`soffice`) trên máy chủ | Chạy trên máy chính; cài LibreOffice bằng một nút (Q6) |
| `JWT_SECRET` | Đặt tay trong `.env` | Máy chính tự sinh lần cài đầu, cất trong két hệ điều hành |
| Giao diện điện thoại | Đã làm responsive 375px | **Không phát triển tiếp** (Q2). Code giữ nguyên, không xoá |

---

## 3. Kiến trúc

### 3.1 Sơ đồ

```
┌──────────────────────── VĂN PHÒNG KHÁCH (mạng nội bộ) ─────────────────────────┐
│                                                                                │
│  MÁY CHÍNH (Windows / Ubuntu, luôn bật)                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ App SeaSmart (Electron)                                                  │  │
│  │  Cửa sổ giao diện (React)                                                │  │
│  │  Phần xử lý (Fastify) ── HTTPS trong mạng nội bộ, chỉ thiết bị đã ghép   │  │
│  │  PostgreSQL nhúng · Kho tệp (mã hoá) · Việc theo giờ · Xuất PDF          │  │
│  │  Sao lưu tự động (.ssbak, mã hoá, kèm khoá dữ liệu đã khoá bằng mật khẩu)│  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│        ▲  HTTPS · máy nhân viên kiểm đúng máy chính · máy chính kiểm đúng thiết bị │
│        │                                                                       │
│  ┌─────┴──────────────────┐   ┌────────────────────────┐                       │
│  │ MÁY NHÂN VIÊN 1         │   │ MÁY NHÂN VIÊN 2 …       │                       │
│  │ App SeaSmart (cùng bộ   │   │                        │                       │
│  │ cài), không có cơ sở    │   │                        │                       │
│  │ dữ liệu                 │   │                        │                       │
│  └────────────────────────┘   └────────────────────────┘                       │
└──────────────┬───────────────────────────────┬─────────────────────────────────┘
               │ đăng nhập qua trình duyệt     │ HTTPS từ máy chính, chỉ khi cần
               │ (mọi máy)                     │ (quét AI, tìm tàu, gửi lời mời)
┌──────────────▼───────────────────────────────▼─────────────────────────────────┐
│               MÁY CHỦ DỊCH VỤ CỦA BÊN MÌNH (cloud)                              │
│   • Tài khoản: trang web đăng ký / đăng nhập / quên mật khẩu, Google           │
│   • Văn phòng: thành viên, lời mời, máy chính đã đăng ký (dấu vân tay)         │
│   • AI quét giấy tờ (giữ khoá OpenAI / Anthropic)                              │
│   • Danh mục tàu thế giới + tra IMO (giữ khoá nguồn tàu)                       │
│   • Nơi phát bản cập nhật đã ký                                                │
│   • Trang quản trị nội bộ: văn phòng, khoá văn phòng, lượng dùng AI            │
│   • (Sau) Bản quyền                                                            │
│   Không lưu dữ liệu nghiệp vụ. Giữ: email, tên, thuộc văn phòng nào, nhật ký dùng │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Vì sao Electron:** phần xử lý hiện viết bằng Node.js (Fastify, `sharp`, `@napi-rs/canvas`, `pdfjs`, `exceljs`, `docxtemplater`). Electron có sẵn Node.js nên chạy được code này, và build được cả Windows lẫn Ubuntu. Tauri nhẹ hơn nhưng lõi là Rust, phải kèm Node riêng hoặc viết lại.

### 3.2 Máy chính và máy nhân viên (Q1 = B)

**Một bộ cài cho mọi máy.** Lần đầu mở app: đăng nhập qua trình duyệt (mục 3.3), rồi:

- Tài khoản **chưa thuộc văn phòng nào** → "Tạo văn phòng mới, máy này là máy chính" → đặt tên văn phòng, đặt mật khẩu sao lưu và in **mã khôi phục dữ liệu** (mục 5.4), chọn nơi sao lưu. Người tạo là quản trị.
- Tài khoản **đã thuộc văn phòng** (được mời) → app hỏi máy chủ dịch vụ máy chính của văn phòng là máy nào → tìm trong mạng nội bộ → ghép máy.

**Ghép máy: hai chiều, qua tài khoản**

1. Khi tạo văn phòng, máy chính tự tạo **chứng chỉ HTTPS** riêng và gửi **dấu vân tay** của chứng chỉ lên máy chủ dịch vụ, gắn với văn phòng.
2. Máy nhân viên tìm máy chính trong mạng (tự tìm theo tên; không thấy thì gõ tên hoặc địa chỉ). Khi nối, **so dấu vân tay chứng chỉ với dấu vân tay máy chủ dịch vụ trả về**. Không khớp thì từ chối và báo "Máy này không phải máy chính của văn phòng". → Chống máy giả làm máy chính, kể cả khi kẻ gian giả được tên máy trong mạng.
3. Máy nhân viên đưa vé đăng nhập (do máy chủ dịch vụ ký) cho máy chính. Máy chính kiểm chữ ký, kiểm người đó thuộc văn phòng và còn hoạt động trên máy chính, rồi **cấp cho thiết bị đó một mã thiết bị riêng** (khoá bí mật của thiết bị). Máy nhân viên cất mã thiết bị trong két hệ điều hành.
4. **Mọi API** trên máy chính kiểm **hai lớp**: mã thiết bị còn hiệu lực + phiên đăng nhập của người dùng (JWT + quyền như hiện nay).
5. Quản trị thấy danh sách thiết bị (tên máy, ai dùng, lần cuối nối) ở Cài đặt → Máy trong văn phòng; có thông báo khi có thiết bị mới. Bấm **"Gỡ"** → mã thiết bị bị thu hồi, **phiên đang mở trên máy đó bị cắt ngay**. Máy đã bị gỡ xin ghép lại → **chờ quản trị duyệt**, không tự cấp mã mới.

**Những gì chạy ở đâu:**

| Việc | Máy chính | Máy nhân viên |
|---|---|---|
| Giao diện, đăng nhập, tự khoá | Có | Có |
| Cơ sở dữ liệu, kho tệp, sao lưu | Có | Không |
| Việc theo giờ, thông báo hạn chứng chỉ | Chạy | Nhận thông báo khi mở app |
| Xuất PDF, quét AI, tìm tàu | Chạy (quét AI / tìm tàu cần internet ở máy chính) | Gửi yêu cầu sang máy chính |
| Gửi email (mở app mail) | Có | Có, dùng app mail của máy mình |
| "Mở thư mục hồ sơ" | Có | Có: lấy bản giải mã từ máy chính về thư mục tạm của máy mình |

**Máy chính:**

- Nên là **máy bàn luôn bật**. Khi app chạy, app xin hệ điều hành **không cho máy ngủ**.
- Cài máy chính cần **quyền quản trị một lần** để mở cổng trên tường lửa Windows (bộ cài làm tự động, chỉ hỏi Yes/No).
- Máy chính tắt hoặc mất mạng nội bộ → máy nhân viên hiện **"Không nối được máy chính 'TEN-MAY'. Đang thử lại…"** kèm hướng dẫn kiểm. Form đang gõ dở được giữ nguyên.
- Địa chỉ máy chính đổi → máy nhân viên tự tìm lại theo tên máy, rồi vẫn so dấu vân tay.
- **Chuyển máy chính** sang máy khác: sao lưu → cài máy mới, đăng nhập tài khoản quản trị → "Khôi phục từ bản sao lưu" → máy mới gửi dấu vân tay mới lên máy chủ dịch vụ → máy nhân viên ghép lại.

**Không làm ở bản đầu:** làm việc từ ngoài văn phòng (có thể làm sau qua VPN mà không đổi kiến trúc).

### 3.3 Tài khoản và đăng nhập qua trình duyệt (Q11–Q13)

**Đăng nhập** (giống app Claude Code, Codex):

```
App: bấm "Đăng nhập"
  │  mở trình duyệt mặc định tới trang đăng nhập SeaSmart,
  │  kèm mã dùng một lần (chuẩn OAuth cho app cài trên máy: PKCE + chuyển về 127.0.0.1)
  ▼
Trình duyệt: đăng ký / đăng nhập bằng email + mật khẩu hoặc "Tiếp tục với Google"
  │  (xác minh email khi đăng ký; quên mật khẩu làm trên web)
  ▼
Trình duyệt chuyển về http://127.0.0.1:<cổng tạm>/… ──► app nhận mã ──► đổi lấy vé tại máy chủ dịch vụ
  │  Trình duyệt hiện: "Đã đăng nhập. Quay lại app SeaSmart."
  ▼
App đưa vé cho máy chính ──► máy chính kiểm chữ ký vé (bằng khoá công khai của máy chủ dịch vụ, lưu sẵn)
  ──► tìm user cục bộ gắn với tài khoản đó ──► cấp phiên như hiện nay, quyền đọc từ DB máy chính
```

- **Vé ghi rõ:** tài khoản, văn phòng, máy chính nhận vé, thiết bị, và **mốc hết hạn offline** (= lần làm mới cuối với máy chủ dịch vụ + 7 ngày). JWT nội bộ **không bao giờ sống quá mốc này**; máy chính kiểm mốc trên **mọi request**. Đóng mở app hay xin JWT mới **không đặt lại** mốc; chỉ làm mới vé với máy chủ dịch vụ mới đẩy mốc đi.

- Trình duyệt không chuyển về app được (hiếm: phần mềm chặn cổng nội bộ) → trang web hiện một mã ngắn để dán vào app.
- **App không bao giờ thấy mật khẩu.** Máy chính không lưu mật khẩu (cột `password_hash` để nguyên, không dùng).

**Phiên và mất internet (Q11: 7 ngày):**

- Có internet: app tự làm mới vé ngầm, người dùng không thấy gì.
- Mất internet: người đã đăng nhập **làm việc bình thường tới 7 ngày** kể từ lần làm mới cuối. Dải vàng khi còn ≤ 2 ngày: "Kết nối internet để giữ đăng nhập". Quá 7 ngày → phải đăng nhập lại (cần internet).
- Cần internet: đăng nhập lần đầu / đăng nhập lại, đăng ký, mời người mới, ghép máy mới, tạo văn phòng.
- **Tự khoá màn hình** sau 15 phút (chỉnh được 5–60): mở bằng **mã PIN 6 số** đặt sau lần đăng nhập đầu trên máy đó, không cần internet. Sai 5 lần → phải đăng nhập lại qua trình duyệt, **bắt nhập lại mật khẩu / xác thực Google thật** (OIDC `max_age=0`, app kiểm `auth_time`), không chấp nhận phiên trình duyệt có sẵn.
- **Đăng xuất**: xoá phiên, mã PIN và bản tạm trên máy đó.

**Mời nhân viên (Q13: quản trị mời qua email trong app):**

1. Quản trị vào màn **Người dùng** hiện có → "Mời" → nhập email + vai trò.
2. Máy chính tạo user cục bộ (chờ kích hoạt) với vai trò đã chọn, gọi máy chủ dịch vụ tạo lời mời. **Máy chủ dịch vụ gửi thư mời** (thư hệ thống của bên mình, không liên quan SMTP của khách).
3. Nhân viên bấm link → đăng ký trên web (hoặc đăng nhập nếu đã có tài khoản) → vào văn phòng.
4. Nhân viên cài app trên máy mình → đăng nhập → ghép máy (mục 3.2) → user cục bộ được gắn với tài khoản, chuyển "đang hoạt động".

- **Khoá nhân viên:** quản trị tắt user trên máy chính → hiệu lực ngay (máy chính kiểm mỗi request như hiện nay), đồng thời báo máy chủ dịch vụ bỏ người đó khỏi văn phòng.
- Thay luồng hiện có trong `user.service.js` (`createUser` tạo `password_hash = NULL` + `sendInvite` dùng `APP_URL`). Màn `/dat-mat-khau` không còn dùng trong bản desktop (giữ code).

**Máy chủ dịch vụ giữ gì về người dùng:** email, tên, mật khẩu băm (nếu không dùng Google), văn phòng, vai trò "quản trị / thành viên" ở mức văn phòng, dấu vân tay máy chính, nhật ký đăng nhập. **Quyền chi tiết** (xem bill, duyệt hợp đồng…) vẫn chỉ nằm ở máy chính.

### 3.4 Hai người cùng sửa một hồ sơ

Hiện nay A và B cùng mở hồ sơ, A đổi số điện thoại rồi lưu, B đổi địa chỉ rồi lưu thì **thay đổi của A bị ghi đè** (form B gửi kèm số điện thoại cũ). Bản web cũng đang có lỗi này; nhiều máy trong văn phòng làm nó hay xảy ra hơn. Phải sửa:

- Mỗi bản ghi sửa được qua form (thuyền viên, tàu, đối tác, cơ hội, chuyến, hợp đồng, bill, chứng chỉ, giấy tờ) có **số phiên bản**. Form gửi kèm số phiên bản lúc mở. Lưu mà số phiên bản đã đổi → trả lỗi 409, giao diện báo **"Hồ sơ vừa được {người} sửa lúc {giờ}. Xem thay đổi của họ"**, **giữ nguyên nội dung đang nhập**, cho chọn: tải bản mới rồi nhập lại phần của mình, hoặc huỷ.
- **Bấm lại không tạo trùng:** mỗi lần **mở form** "Thêm…" sinh một mã yêu cầu; bấm lại / thử lại dùng **đúng mã đó**. Máy chính lưu mã + kết quả **trong cùng transaction** với bản ghi. Máy chính đã lưu xong nhưng máy nhân viên mất kết nối trước khi nhận phản hồi → bấm lại thì máy chính nhận ra mã cũ và trả lại kết quả lần trước, không tạo bản ghi thứ hai.

### 3.5 Cấu trúc thư mục trong repo

```
seasmart/
├── frontend/     # thêm: địa chỉ máy chính lúc chạy, đăng nhập qua app, màn thiết lập / ghép máy / khoá PIN / sao lưu, xử lý 409
├── backend/      # thêm: chế độ desktop (cấu hình từ app), HTTPS nội bộ + mã thiết bị, kiểm vé đăng nhập, lớp kho tệp, số phiên bản, sao lưu
├── desktop/      # MỚI: vỏ Electron, khởi động Postgres, đăng nhập qua trình duyệt, ghép máy, đóng gói, tự cập nhật
└── cloud/        # MỚI: máy chủ dịch vụ (Fastify riêng, Postgres riêng) + trang web đăng ký / đăng nhập
```

---

## 4. Quyết định

### 4.1 Đã chốt (2026-11-11)

| # | Câu hỏi | Chốt | Ảnh hưởng tới kế hoạch |
|---|---|---|---|
| **Q1** | Nhân viên có xem chung dữ liệu không? | **B.** Một máy chính trong văn phòng, máy khác nối vào qua mạng nội bộ | Mục 3.2. Vai trò / quyền dùng thật |
| **Q2** | Có dùng trên điện thoại không? | **Không.** Code giao diện điện thoại hiện có **giữ nguyên, không xoá** | Màn mới chỉ cần chạy tốt trên màn máy tính |
| **Q3** | Hệ điều hành nào? | **Windows và Ubuntu** | Bộ cài `.exe` + `.deb` |
| **Q4** | PostgreSQL hay SQLite? | **PostgreSQL** | Mục 4.3 |
| **Q5** | Bán theo kiểu nào? | **Việc của sales**, chưa chốt | Không đưa vào kế hoạch kỹ thuật |
| **Q6** | LibreOffice để xuất PDF | **Không đóng gói.** Máy chính cài bằng một nút; Ubuntu `.deb` tự kéo theo. Không đóng gói Thunderbird, chỉ có nút "Cài Thunderbird" | Mục 4.4, 8.1 |
| **Q7** | Bản web có khách thật không? | **Không** | Không chuyển dữ liệu từ web |
| **Q8** | Bản quyền | **Chưa làm** | Mục 7 |
| **Q9** | Dùng offline tối đa bao lâu (cho bản quyền) | **Bỏ** | — |
| **Q10** | Một mã dùng mấy máy? | **Chưa cần**, theo cách tính tiền | Mục 7 |
| **Q11** | Mất internet, người đã đăng nhập có làm tiếp được không? | **Có, tới 7 ngày** | Mục 3.3 |
| **Q12** | Đăng ký / đăng nhập bằng gì? | **Email + mật khẩu và Google** | Mục 3.3 |
| **Q13** | Nhân viên vào văn phòng thế nào? | **Quản trị mời qua email trong app** | Mục 3.3 |
| **Q14** | Có mã hoá tài liệu trên máy và bản sao lưu không? (chốt 2026-11-13) | **Không.** Tài liệu lưu thẳng vào cây thư mục dễ đọc trên máy chính, như cách văn phòng đang làm; bản sao lưu là tệp nén thường; bỏ mật khẩu sao lưu, mã khôi phục dữ liệu, khoá dữ liệu | Mục 5.1, 5.4, 5.5 cũ về mã hoá **không còn hiệu lực**; thiết kế mới ở `docs/mcah-ke-hoach-desktop-gd4.md`. Bảo vệ tài liệu dựa vào mật khẩu hệ điều hành và mã hoá ổ đĩa máy chính |
| **Q15** | Có tính năng sao lưu cho người dùng không? (chốt 2026-11-13) | **Không.** Không lịch, không nút, không màn Sao lưu / Khôi phục. App chỉ tự chụp dữ liệu ngay trước khi cập nhật có đổi dữ liệu (để quay về khi lỗi); chuyển máy chính do hỗ trợ MCAH làm bằng lệnh | Mục 5.4 phần lịch, nơi để, dải nhắc, khôi phục từ app **bỏ**. Máy chính hỏng / mất là mất dữ liệu — ghi rõ trong hướng dẫn |

### 4.2 Việc còn mở (không chặn giai đoạn 0)

| # | Việc | Ai quyết | Cần trước |
|---|---|---|---|
| **M1** | Tên sản phẩm | **Chốt 2026-11-13: MCAH** ở mọi chỗ người dùng thấy (app, bộ cài, trang web, thư mục) | Đã làm |
| **M2** | Máy chủ dịch vụ: dùng lại máy chủ đang chạy bản web hay thuê máy mới; tên miền cho trang đăng nhập | Sếp / bạn | Giai đoạn 2 |
| **M3** | Trang "Tải về" | **Chốt 2026-11-13:** `https://mcah.axalize.dev/download` (trang tĩnh trong frontend, đọc `latest.json`) | Dựng trang; tệp bộ cài đặt lên ở giai đoạn 6 |
| **M4** | Mua chứng thư ký số Windows | **Chưa vội** (2026-11-13) | Phát hành rộng |
| **M5** | Điều khoản sử dụng, Chính sách quyền riêng tư | **2026-11-13:** dựng trang với nội dung "TBC" trước (`/tai-khoan/dieu-khoan`, `/tai-khoan/quyen-rieng-tu`), luật sư viết sau | Trước khi mở bán |
| **M6** | Quy định 375px | **Chốt 2026-11-13:** bản web vẫn giữ giao diện điện thoại; màn chỉ có trong app máy tính không cần | Đã sửa `CLAUDE.md` 3.5 |
| **M7** | Sếp đã biết các đánh đổi | **Đã chốt** 2026-11-13 (gồm Q14 không mã hoá, Q15 không sao lưu) | — |
| **M8** | Cách tính tiền, bản quyền, số máy | **Không làm trong kế hoạch này** (2026-11-13) | — |
| **M9** | Đăng ký app với Google (Google Cloud Console) để có nút "Tiếp tục với Google"; cần tên miền và trang quyền riêng tư | Bạn / sếp | Giai đoạn 2 |

### 4.3 Q4: vì sao không chuyển sang SQLite

SQLite là cơ sở dữ liệu nằm gọn trong **một tệp**. Điểm tốt: **mã hoá được cả cơ sở dữ liệu** (SQLCipher), sao lưu bằng cách copy một tệp. Điểm dở nặng hơn: phải **sửa gần hết câu SQL** và viết lại 42 migration (+4–6 tuần, nguy cơ lỗi cao), và **nhiều máy cùng ghi một lúc thì kém**, không được thiết kế cho máy khác nối vào qua mạng. Với Q1 = B, đây là điểm loại.

→ **PostgreSQL.** Cơ sở dữ liệu **không tự mã hoá**: tài liệu giấy tờ thì mã hoá (mục 5.5), còn dữ liệu chữ trong DB được bảo vệ bằng **mã hoá ổ đĩa máy chính** (BitLocker trên Windows; Ubuntu chọn "mã hoá ổ đĩa" lúc cài hệ điều hành) và quyền tài khoản hệ điều hành.

### 4.4 Q6: vì sao không đóng gói LibreOffice và Thunderbird

| | Nhét LibreOffice vào bộ cài | Máy chính tự tải bằng một nút **(đã chốt)** |
|---|---|---|
| Khách phải làm | Không gì | Bấm "Cài thành phần xuất PDF" một lần |
| Bộ cài | **Nặng thêm ~350 MB**, cho cả máy nhân viên vốn không cần | Nhẹ |
| Lỗ bảo mật của LibreOffice | **Bên mình phải tự theo dõi và phát bản vá** | LibreOffice tự cập nhật như phần mềm thường |

Windows: tải bộ cài chính thức từ trang LibreOffice rồi cài im lặng (có thanh tiến trình). Ubuntu: LibreOffice là gói phụ thuộc của `.deb`. Chưa cài thì vẫn xuất Excel được; nút xuất PDF hiện "Cần cài thành phần xuất PDF — [Cài ngay]".

**Thunderbird không đóng gói:** tự cập nhật bảo mật thường xuyên (đóng gói = khách dùng bản cũ có lỗ hổng); khách vẫn phải tự đăng nhập email vào đó; nhiều khách đã có Outlook; Mozilla có quy định về việc dùng tên Thunderbird khi phân phối kèm. Thay vào đó: nút **"Cài Thunderbird"** khi máy chưa có app mail (mục 8.1).

---

## 5. Bảo mật cho người dùng

Mỗi lớp trả lời câu "chống được chuyện gì".

### 5.1 Khi máy bị người khác mở / bị mất

| Làm gì | Chống được |
|---|---|
| Đăng nhập qua web, mỗi nhân viên **một tài khoản**, quyền theo vai trò như hiện nay | Nhân viên xem / sửa thứ không phải việc mình |
| **Tự khoá** sau 15 phút, mở bằng mã PIN; sai 5 lần phải đăng nhập lại | Rời bàn quên tắt |
| **Tài liệu và mọi bản phát sinh** (ảnh trang, ảnh thu nhỏ, chân dung, ZIP hồ sơ đã gửi, thùng rác) **được mã hoá** trên máy chính. Muốn xem tay thì dùng "Mở thư mục hồ sơ" / "Xuất hồ sơ" (mục 5.5) | Ai đó copy thư mục dữ liệu sang máy khác: tài liệu chỉ thấy chuỗi vô nghĩa |
| Máy chính: **kiểm ổ đĩa có mã hoá không**, chưa bật thì hiện hướng dẫn và dải nhắc cho quản trị | Mất / bị trộm máy chính: kẻ trộm tháo ổ đĩa đọc cơ sở dữ liệu |
| PostgreSQL nhúng chỉ nghe trong máy chính, mật khẩu ngẫu nhiên, thư mục dữ liệu chỉ tài khoản hệ điều hành chạy app đọc được | Máy khác trong mạng vào thẳng cơ sở dữ liệu |
| Mất laptop nhân viên: quản trị bấm "Gỡ" thiết bị; tài khoản đổi mật khẩu trên web | Kẻ nhặt được laptop vào dữ liệu văn phòng |

> **Giới hạn cần nói rõ:**
> - Cơ sở dữ liệu **không mã hoá**. Nếu máy chính **không bật mã hoá ổ đĩa** và bị trộm, kẻ trộm có kỹ thuật đọc được dữ liệu chữ (tên, số hộ chiếu…). Có bật thì an toàn khi ổ đĩa bị tháo ra đọc; nhưng ai **đã đăng nhập được vào tài khoản hệ điều hành của máy chính** thì vẫn đọc được thư mục cơ sở dữ liệu. Vì vậy: máy chính phải có mật khẩu đăng nhập hệ điều hành và mã hoá ổ đĩa.
> - **Gỡ thiết bị** chặn được truy cập về sau, **không xoá được** bản đã xuất ra thư mục, bản trong app mail hay thư đã gửi.

### 5.2 Trong mạng văn phòng và khi app chạy

| Làm gì | Chống được |
|---|---|
| Máy nhân viên so dấu vân tay chứng chỉ máy chính với dấu vân tay trên máy chủ dịch vụ (mục 3.2) | Máy giả làm máy chính, kể cả giả tên máy trong mạng |
| Máy chính chỉ nhận **HTTPS** từ thiết bị có **mã thiết bị còn hiệu lực**; mọi API kiểm cả mã thiết bị lẫn phiên người dùng; gỡ thiết bị cắt phiên ngay | Laptop lạ cắm vào Wi-Fi văn phòng; máy bị mất / nhân viên nghỉ việc |
| Phiên, mã thiết bị, mã PIN băm cất trong **két hệ điều hành qua app**, không ở `localStorage` của trang. Ubuntu không có kho bí mật an toàn (`safeStorage` rơi về `basic_text`) → **chặn thiết lập**, hướng dẫn cài; không âm thầm dùng cách yếu | Ai copy tệp của app sang máy khác / đọc ổ đĩa. **Không** chống được phần mềm độc đang chạy dưới cùng tài khoản hệ điều hành |
| Máy nhân viên **không có cơ sở dữ liệu văn phòng**. Chỉ giữ: phiên (≤ 7 ngày), dữ liệu đang xem trong bộ nhớ (mất khi đóng app), bản tạm của tài liệu đã mở / đính kèm (xoá khi đóng app, khi đăng xuất, khi mở app lần sau, hoặc sau 24 giờ). Bản xuất ra thư mục và bản trong app mail là trách nhiệm người dùng | Lộ dữ liệu từ máy nhân viên |
| Cấu hình Electron an toàn: `contextIsolation`, `sandbox`, tắt `nodeIntegration`, CSP chặn script lạ, link ngoài mở bằng trình duyệt hệ thống, tắt DevTools ở bản phát hành | Một đoạn chữ độc trong dữ liệu (vd. tên thuyền viên chứa mã) chiếm quyền máy |
| Chặn trang web lạ trong trình duyệt gọi vào phần xử lý (kiểm nguồn gọi + `Host`), cổng nhận vé đăng nhập chỉ mở trong lúc chờ đăng nhập | Trang web độc gọi lén vào máy chính / chiếm vé đăng nhập |
| Giữ các quy tắc hiện có: SQL tham số hoá, `pickAllowed`, kiểm loại và cỡ tệp tải lên, giới hạn tần suất | Dữ liệu nhập vào phá cơ sở dữ liệu |
| Nhật ký (log) **không ghi** dữ liệu cá nhân, xoay vòng 10 MB × 3 tệp | Log lộ thông tin khi gửi cho bộ phận hỗ trợ |

### 5.3 Khi dùng internet

| Làm gì | Chống được |
|---|---|
| App chỉ gọi **máy chủ dịch vụ của mình** qua HTTPS | Bị nghe lén / giả máy chủ |
| Dữ liệu nghiệp vụ chỉ rời văn phòng khi **người dùng chủ động** bấm quét giấy tờ hoặc tìm tàu. Lần đầu quét hiện thông báo "ảnh sẽ được gửi lên máy chủ để AI đọc, không được lưu lại" và xin đồng ý | Khách lo dữ liệu bị gửi ngầm |
| Máy chủ **xử lý ảnh trong bộ nhớ rồi xoá**, chỉ ghi: văn phòng, người dùng, thời gian, số trang, chi phí | Rò rỉ từ phía máy chủ của mình |
| Máy chủ giữ thông tin tài khoản (mục 3.3) ở mức tối thiểu, mật khẩu băm, đăng nhập Google không lưu mật khẩu | Lộ thông tin người dùng từ máy chủ |
| Không có theo dõi hành vi (analytics). Báo lỗi (crash report) **chỉ khi người dùng đồng ý**, đã lọc dữ liệu cá nhân | Khách hỏi "app gửi gì về công ty?" |

### 5.4 Khoá dữ liệu, sao lưu và khôi phục

> **Đổi 2026-11-13 (Q14):** bỏ khoá dữ liệu, mật khẩu sao lưu, mã khôi phục và mã hoá gói sao lưu. Phần sao lưu nhất quán, lịch, khôi phục khác máy, cập nhật có quay về vẫn giữ, chi tiết ở `docs/mcah-ke-hoach-desktop-gd4.md`.

Toàn bộ dữ liệu văn phòng nằm trên **một máy chính**: hỏng ổ / mất máy là mất hết nếu không sao lưu. Và tài liệu đã mã hoá thì **mất khoá là mất tài liệu**. Thiết kế:

**Khoá dữ liệu**

- Lúc tạo văn phòng, máy chính sinh ngẫu nhiên một **khoá dữ liệu** (dùng để mã hoá kho tệp). Trên máy chính, khoá này được két hệ điều hành bọc lại (chỉ tài khoản hệ điều hành đó mở được).
- Cùng lúc, khoá dữ liệu được bọc thêm hai lần, lưu cạnh dữ liệu:
  - bằng **mật khẩu sao lưu** (quản trị đặt);
  - bằng **mã khôi phục dữ liệu** (24 ký tự, app bắt in ra hoặc chép lại, kiểm bằng cách nhập lại 2 nhóm).
- Mất mật khẩu sao lưu thì dùng mã khôi phục dữ liệu, và ngược lại. **Mất cả hai là mất tài liệu**, bên mình cũng không mở được. Màn đặt có nói rõ điều này.
- Hai thứ này **khác hẳn** mật khẩu đăng nhập: đăng nhập do tài khoản trên web lo (quên thì đặt lại trên web), không mở được tài liệu.

**Đường dẫn tệp**

- DB không lưu đường dẫn tuyệt đối nữa (hiện `document_upload.storage_path` là tuyệt đối). Lưu **mã tệp** (tên ngẫu nhiên) tương đối với kho tệp. Chuyển máy, chuyển Windows ↔ Ubuntu, đổi tài khoản hệ điều hành đều không ảnh hưởng.

**Sao lưu nhất quán**

- Quy tắc kho tệp: **ghi tệp xong mới ghi dòng DB**; tệp **không bao giờ bị sửa tại chỗ** (bản mới = tệp mới); tệp bị xoá chỉ rời ổ đĩa sau 180 ngày (quy tắc hiện có). Lớp kho tệp (mục 5.5) buộc mọi service theo quy tắc này.
- Nhờ vậy sao lưu không cần dừng văn phòng: chụp DB bằng `pg_dump` (luôn cho một ảnh nhất quán, không copy thư mục DB đang chạy), rồi copy **đúng các tệp mà ảnh DB đó trỏ tới**. Mọi tệp đó chắc chắn đã có trên đĩa và không đổi.
- **Khoá chống xoá tệp** (job xoá tệp 180 ngày, `purgeExpired`) giữ **từ lúc bắt đầu tới lúc sao lưu xong**, không chỉ lúc chụp DB. Danh sách tệp cần chép lấy **từ chính ảnh DB vừa dump**, không hỏi DB đang chạy.
- Bản sao lưu chỉ được tính là có khi **chép xong và kiểm toàn vẹn** (đọc lại, so mã băm). Ghi ra tệp tạm, xong mới đổi tên; đầy ổ / rút USB / mất điện giữa chừng thì bỏ tệp dở, báo lỗi.

**Gói `.ssbak`**: ảnh DB + các tệp (vẫn ở dạng mã hoá) + khoá dữ liệu đã bọc bằng mật khẩu sao lưu và bằng mã khôi phục + phiên bản app và phiên bản DB. Cả gói (kể cả DB) được mã hoá bằng **một khoá gói ngẫu nhiên**; đầu gói lưu khoá gói bọc hai cách: bằng mật khẩu sao lưu **hoặc** mã khôi phục. Mỗi cách tự mở được toàn bộ gói.

**Lịch và nơi để**

1. Mỗi ngày (mặc định 12h trưa, và khi mở app nếu hôm đó chưa sao lưu). Giữ 7 bản theo ngày + 4 bản theo tuần.
2. Quản trị chọn nơi để: ổ USB, ổ mạng công ty, hay thư mục được Google Drive / OneDrive đồng bộ (gói đã mã hoá nên để trên Drive vẫn an toàn).
3. Quá 7 ngày chưa có bản **ra ngoài ổ đĩa của máy chính** → dải vàng cho quản trị ở mọi máy.

**Khôi phục** (máy mới, cùng hoặc khác hệ điều hành): cài app → đăng nhập tài khoản quản trị → "Khôi phục từ bản sao lưu" → chọn tệp → nhập mật khẩu sao lưu (hoặc mã khôi phục dữ liệu) → app nạp DB, chép tệp, **bọc lại khoá dữ liệu bằng két của máy mới** → gửi dấu vân tay chứng chỉ mới lên máy chủ dịch vụ → máy nhân viên ghép lại.

- **Không khôi phục quyền đã thu hồi:** sau khi nạp, mọi mã thiết bị và phiên cũ bị huỷ, sinh khoá ký phiên mới; đối chiếu thành viên với máy chủ dịch vụ (ai đã bị gỡ khỏi văn phòng thì khoá) **trước khi** mở cho máy nhân viên.
- Chỉ **quản trị** được thay dấu vân tay máy chính (máy chủ dịch vụ báo thư cho mọi quản trị). Máy chính cũ còn chạy → máy nhân viên từ chối nó vì dấu vân tay không khớp; máy cũ hiện "Văn phòng đã chuyển sang máy chính khác" và ngừng phục vụ.

**Cập nhật có đổi DB**

- Thứ tự: **chặn mọi thao tác ghi** ("Máy chính đang cập nhật") → chờ request và job đang chạy xong → **rồi mới** sao lưu đầy đủ → chạy migration. (Sao lưu thường ngày thì không chặn, theo cách ở trên.)
- Migration hiện chạy mỗi tệp một transaction, nên lỗi giữa chừng là DB đã đổi một phần. Lỗi thì: dừng, **khôi phục DB và khoá dữ liệu từ bản vừa chụp** (tệp không bị migration sửa), quay về bản app cũ, rồi mới cho máy nhân viên nối lại. Báo quản trị kèm mã lỗi.

### 5.5 Kho tệp và thư mục tài liệu

> **Đổi 2026-11-13 (Q14):** không mã hoá; cây thư mục dễ đọc dưới đây **chính là kho tệp** trên máy chính (không còn là bản xem dựng ra). Cấu trúc và quy tắc đặt tên giữ nguyên. Chi tiết ở `docs/mcah-ke-hoach-desktop-gd4.md`.

**Lớp kho tệp dùng chung (bắt buộc).** Hiện nhiều service tự ghi thẳng vào `UPLOAD_DIR`: tệp gốc + ảnh từng trang + ảnh thu nhỏ (`document.service.js`), chứng chỉ (`certificate.service.js`), chân dung (`seafarer.service.js`), logo (`fleet.service.js`), ZIP hồ sơ đã gửi (`seafarer_send.service.js`), tệp nhập (`import.routes.js`), thùng rác (`file_trash.js`), xuất hồ sơ (`export_pack.service.js`). Chỉ mã hoá lúc tải lên sẽ còn sót. Phải:

- Gom mọi đọc / ghi / xoá tệp qua **một module kho tệp**: ghi = mã hoá + đặt tên ngẫu nhiên + trả mã tệp; đọc = giải mã trong bộ nhớ; không service nào được gọi `fs` thẳng vào kho. Có test chặn (như test mốc CSS hiện có).
- **Tệp tạm** (Excel/PDF khi chuyển đổi trong `xlsx_pdf.js`, bản xem tạm, bản đính kèm) chỉ được nằm trong **thư mục tạm riêng của app**, xoá ngay khi xong việc, và **dọn toàn bộ mỗi lần app khởi động** (để không sót sau mất điện / crash).
- Chuyển dữ liệu cũ: không có (Q7), nhưng vẫn viết sẵn bước chuyển tệp chưa mã hoá sang kho mới cho máy dev / máy thử.

**Thư mục dễ đọc cho người xem (đã chốt).** Người dùng muốn tự mở thư mục để tìm, xem, copy như thư mục thường. Tệp đọc được bằng tay thì không mã hoá được, nên: **kho trong máy chính mã hoá, khi cần xem tay thì app dựng một thư mục dễ đọc** trên máy đang dùng.

| | Kho trong (app dùng) | Thư mục dễ đọc (người xem) |
|---|---|---|
| Ở đâu | Thư mục dữ liệu của app trên máy chính | Bản xem tạm: thư mục tạm của app trên máy đang dùng. Bản xuất: nơi người dùng chọn |
| Mở tay | Tệp không đọc được, tên tệp là mã ngẫu nhiên | Đọc được, cấu trúc như dưới |
| Ai sửa | Chỉ app | **Chỉ xem và copy.** Sửa, thêm, xoá ở đây không vào app |
| Giữ bao lâu | Theo quy tắc xoá tệp 180 ngày hiện có | Bản xem tạm: xem mục 5.2. Bản xuất: người dùng tự giữ |

**Nút trong app:**

- **"Mở thư mục hồ sơ"** ở trang chi tiết thuyền viên (và tàu, đối tác): app lấy tệp của người đó (từ máy chính, qua đường mã hoá), dựng thư mục xem tạm, đặt chỉ đọc, mở bằng File Explorer / Files.
- **"Xuất hồ sơ ra thư mục"** ở danh sách thuyền viên (chọn nhiều hoặc tất cả) và ở Cài đặt → Sao lưu ("Xuất toàn bộ tài liệu", chỉ quản trị). Trước khi xuất: "Bản xuất **không được mã hoá**. Ai mở được thư mục này là đọc được giấy tờ."
- Hai nút theo quyền xem thuyền viên hiện có; xuất hàng loạt cần quyền riêng (thêm vào `permissions.js`).
- Tệp đính kèm khi gửi mail (mục 8.1) dùng chung cách lấy bản tạm này.

**Cấu trúc thư mục dễ đọc:**

```
MCAH - Hồ sơ/
├── Đọc tôi.txt                     ← "Đây là bản sao. Sửa ở đây không vào app."
├── Thuyền viên/
│   └── NGUYỄN VĂN AN - <mã thuyền viên>/
│       ├── 01 Giấy tờ tuỳ thân/
│       │   ├── Hộ chiếu - C1234567 - hết hạn 2030-05-01.pdf
│       │   └── CCCD - 079123456789.pdf
│       ├── 02 Chứng chỉ/
│       │   ├── GCN Huấn luyện cơ bản - hết hạn 2027-03-01.pdf
│       │   └── Bản cũ/
│       │       └── GCN Huấn luyện cơ bản - hết hạn 2022-03-01.pdf
│       ├── 03 Đi tàu/
│       ├── 04 Ảnh/
│       │   └── Chân dung.jpg
│       └── 05 Hồ sơ đã gửi/
│           └── 2026-11-05 - gửi <tên đối tác>/
├── Tàu/
│   └── <TÊN TÀU> - IMO <số>/
└── Đối tác/
    └── <Tên đối tác>/
        └── Logo.png
```

**Quy tắc đặt tên:**

- Nhóm con đánh số `01`, `02`… để luôn đứng đúng thứ tự; tên nhóm lấy đúng tên nhóm trong tab Chứng chỉ / Giấy tờ của hồ sơ.
- Tên tệp = **loại giấy + số giấy (nếu có) + hạn (nếu có)**, ngày dạng `năm-tháng-ngày`.
- Giữ dấu tiếng Việt. Bỏ ký tự Windows cấm (`\ / : * ? " < > |`). Cắt ngắn để cả đường dẫn dưới 200 ký tự.
- Thư mục thuyền viên luôn kèm mã nên không trùng dù trùng tên. Hai tệp cùng tên trong một thư mục thì thêm ` (2)`, ` (3)`.
- Giấy tờ không ghi đè (quy tắc hiện có): bản mới ở ngoài, bản cũ vào `Bản cũ/`.
- Tệp đã xoá mềm không xuất ra.

### 5.6 Pháp lý (cần hỏi luật sư, không phải việc của code)

- App xử lý dữ liệu cá nhân nhạy cảm (hộ chiếu, CCCD, sức khoẻ, tài khoản ngân hàng thuyền viên). Cần kiểm nghĩa vụ theo Luật Bảo vệ dữ liệu cá nhân và các nghị định hướng dẫn đang hiệu lực.
- Dữ liệu nghiệp vụ nằm máy khách thì **khách là bên kiểm soát dữ liệu**; bên mình xử lý khi khách bấm quét AI. Gửi ảnh qua nhà cung cấp AI nước ngoài có thể bị coi là **chuyển dữ liệu ra nước ngoài**.
- Bên mình **trực tiếp giữ dữ liệu tài khoản** (email, tên nhân viên môi giới) trên máy chủ dịch vụ: bên mình là bên kiểm soát phần này.
- Cần có: Điều khoản sử dụng, Chính sách quyền riêng tư, ô đồng ý ở trang đăng ký.

---

## 6. Bảo vệ sản phẩm (chống crack)

### 6.1 Nói thật về mức độ

App máy tính nào (kể cả Photoshop, Windows) cũng có người crack được. Mục tiêu thực tế:

- **Người dùng phổ thông** không dùng được nếu không có tài khoản trong một văn phòng do bên mình quản lý.
- **Dân crack chuyên nghiệp** tốn nhiều công, và **bản crack mất phần giá trị nhất** (AI, danh mục tàu, cập nhật) nên không đáng bỏ công.
- **Bản đầu chưa có bản quyền:** người có kỹ thuật cao có thể sửa app máy chính để bỏ bước kiểm vé đăng nhập và dùng phần nghiệp vụ offline. Đây là **đánh đổi kinh doanh chấp nhận ở bản đầu**.

### 6.2 Các lớp và lớp nào làm ở bản đầu

| Lớp | Làm gì | Bản đầu? |
|---|---|---|
| **L1. Giá trị nằm trên máy chủ** | Đăng nhập, quét AI, danh mục tàu, tra IMO, bản cập nhật đều cần **tài khoản trong văn phòng còn hiệu lực**, **do máy chủ tự kiểm**. Danh mục tàu không đóng gói vào bộ cài. Lớp này **không bẻ được từ phía khách** | **Có** |
| **L5. Khó đọc, khó sửa code** | Gom code thành một khối và nén; chuyển phần xử lý sang **bytecode V8**; bật "cầu chì" Electron (cấm chạy như Node thường, cấm gắn trình gỡ lỗi, chỉ nạp code từ gói của app); tắt DevTools. **Kiểm toàn vẹn gói** (sửa gói là app không chạy) **chỉ có trên Windows**; Electron chưa hỗ trợ trên Linux. Tệp nằm ngoài gói (Postgres, module biên dịch sẵn) không được lớp này bảo vệ | **Có** |
| **L6. Ký số + theo dõi** | Ký bộ cài Windows (khi đã mua chứng thư). **Mọi bản cập nhật, cả Windows lẫn Ubuntu, được ký bằng khoá riêng của bên mình** và app kiểm trước khi cài (mục 9). Máy chủ cảnh báo khi một văn phòng dùng bất thường | **Có** |
| **L2. Giấy phép ký số** | Máy chủ ký giấy phép (Ed25519) gắn với văn phòng / máy chính | Sau (mục 7) |
| **L3. Giấy phép có hạn, tự gia hạn** | Thu hồi được khi không trả tiền | Sau (mục 7) |
| **L4. Kiểm ở nhiều chỗ** | Kiểm giấy phép ở vỏ Electron, phần xử lý và máy chủ | Sau (mục 7) |

**Không làm** (tốn công, dễ bị phần mềm diệt virus báo nhầm, làm khổ khách thật): chống gỡ lỗi kiểu hung hăng, trình điều khiển cấp nhân hệ điều hành, khoá cứng USB.

### 6.3 Bí mật nào tuyệt đối không được nằm trong app

Kiểm trước mỗi lần phát hành (script tự quét bộ cài):

- Khoá OpenAI / Anthropic (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- Khoá nguồn tàu (`VESSEL_API_ENC_KEY`, `VESSEL_API_BASE_URL`)
- Token SMS (`SMS_WEBHOOK_TOKEN`), dù SMS đã tạm bỏ
- Khoá ký vé đăng nhập, khoá bí mật Google OAuth, khoá ký bộ cài và bản cập nhật, (sau này) khoá ký giấy phép
- Danh mục tàu `ships_plain.db`
- Mọi tệp `.env`

App chỉ được chứa **khoá công khai** (để kiểm vé đăng nhập, kiểm bản cập nhật).

---

## 7. Bản quyền (để sau)

Hoãn theo Q8: thuê bao hay bán đứt, số máy (Q10) do sales chốt. Khi làm:

- Gắn vào **văn phòng** trên máy chủ dịch vụ (đã có từ giai đoạn 2). Tính theo văn phòng, theo số tài khoản, hay theo số thiết bị đều làm được vì máy chủ đã biết cả ba.
- Lớp L2–L4 ở mục 6.2.
- Hết hạn thì **chỉ xem và xuất dữ liệu**, không khoá dữ liệu của khách.
- Kiến trúc bản đầu chừa sẵn: máy chính có một chỗ đọc "trạng thái sử dụng" của văn phòng (hiện luôn là "đầy đủ"), các API ghi dữ liệu đi qua chỗ này.

Ước lượng khi làm: 1–2 tuần.

---

## 8. Tính năng cần internet

| Tính năng | Đi qua máy chủ dịch vụ | Mất internet thì |
|---|---|---|
| Đăng ký, đăng nhập, mời người, ghép máy mới, tạo văn phòng | Có | Không làm được. Người **đã đăng nhập** làm việc tiếp tới 7 ngày (mục 3.3) |
| AI tách và đọc giấy tờ, quét danh thiếp | Có | Vẫn **tải giấy tờ lên và lưu** được, đánh dấu "Chờ đọc"; có mạng lại thì bấm đọc |
| Tìm tàu trong danh mục thế giới, tra IMO | Có | Nút mờ; vẫn **nhập tàu bằng tay** được |
| Gửi email nghiệp vụ | Không (qua app mail của máy, hoặc SMTP) | App mail tự giữ thư trong Hộp thư đi, có mạng tự gửi |
| Kiểm và tải bản cập nhật | Có | Bỏ qua |

Chỉ báo trên thanh trên cùng khi mất internet. Mất **mạng nội bộ** là chuyện khác: mục 3.2.

### 8.1 Gửi email nghiệp vụ (đã chốt 2026-11-11)

**Cách chính: mở bằng app mail của máy đang dùng.** Bấm "Gửi mail" (vd. gửi hồ sơ thuyền viên cho chủ tàu ở Cơ hội) → app mở **thư mới trong app mail của máy**, đã điền người nhận, tiêu đề, nội dung và **tự đính kèm** tệp (trên máy nhân viên thì lấy từ máy chính về bản tạm). Người dùng xem lại và bấm Gửi trong app mail. Thư đi từ email của chính nhân viên đó.

| Máy | App mail đính kèm tự động được | Cách app mở thư |
|---|---|---|
| Windows | Outlook bản cài kèm Office, Thunderbird | Simple MAPI (cơ chế "Send to → Mail recipient" của Windows) |
| Ubuntu | Thunderbird (có sẵn trên Ubuntu Desktop), Evolution | Lệnh `xdg-email --attach` |

- **Gmail không có app cho máy tính.** Người dùng Gmail thêm tài khoản vào Thunderbird bằng "Đăng nhập bằng Google".
- **Outlook bản mới trên Windows 11** có thể không nhận đính kèm từ app khác: kiểm ở giai đoạn 0.
- **Máy không có app mail nào:** app mở thư mới không kèm tệp, **mở sẵn thư mục chứa tệp cần gửi** để kéo thả, và hiện nút **"Cài Thunderbird"** kèm hướng dẫn đăng nhập Gmail.
- **Tệp đã mã hoá:** app giải mã ra bản tạm trong thư mục tạm riêng của app (dọn theo mục 5.2). Bản app mail đã chép vào thư thì ngoài tầm của app.
- **App không biết thư đã gửi thật chưa.** Sau khi mở thư, app hỏi "Đã gửi thư này chưa?" (Đã gửi / Chưa) để ghi trạng thái ở Cơ hội như hiện nay.

**Cách phụ: gửi thẳng từ app qua SMTP.** Mỗi nhân viên khai trong Cài đặt → Email gửi đi (chọn Gmail / Outlook / Khác để app tự điền máy chủ, cổng; email; mật khẩu ứng dụng; nút "Gửi thử"). Mật khẩu cất trong két hệ điều hành của máy nhân viên, chỉ gửi sang máy chính lúc gửi thư. Phải sửa `email.service.js`: hiện giữ **một** kết nối SMTP chung từ cấu hình toàn cục → đổi thành tạo kết nối theo người gửi.

**Cài đặt → Email gửi đi** (theo từng máy): "Mở bằng app mail trên máy" (mặc định khi dò thấy Outlook / Thunderbird) hoặc "Gửi thẳng từ app (SMTP)". Có nút "Thử mở thư".

---

## 9. Phát hành và cập nhật

1. **Website** có trang "Tải về": bản Windows và bản Ubuntu, số phiên bản, ngày, yêu cầu máy (Windows 10/11 64-bit hoặc Ubuntu 22.04 / 24.04 64-bit; máy chính 8 GB RAM, 10 GB trống; máy nhân viên 4 GB RAM).
2. **Windows: bộ cài `.exe`** (NSIS). Máy chính hỏi quyền quản trị một lần để mở tường lửa. **Ký số** khi đã mua chứng thư.
3. **Ubuntu: bộ cài `.deb`** (khai LibreOffice là gói phụ thuộc).
4. Gỡ cài đặt **không xoá dữ liệu** trừ khi tích "Xoá cả dữ liệu" (hỏi lại hai lần).
5. **Tự cập nhật** (`electron-updater`, hỗ trợ cả NSIS và `.deb`): kiểm khi mở app và mỗi 6 giờ, tải ngầm, hỏi "Khởi động lại để cập nhật?". Hai kênh: **beta** và **ổn định**.
6. **Xác thực bản cập nhật:** `electron-updater` chỉ kiểm chữ ký mã trên Windows; trên Linux không kiểm. Vì vậy **mọi bản phát hành** kèm tệp chữ ký do khoá riêng của bên mình ký (Ed25519); app kiểm chữ ký bằng khoá công khai có sẵn **trước khi cài**, trên cả hai hệ điều hành. Mã băm SHA-256 trên website chỉ để tham khảo, không thay chữ ký.
7. **Một bản chỉ được phát hành khi đủ cả Windows lẫn Ubuntu** (script phát hành chặn nếu thiếu).
8. **Phiên bản trong văn phòng:**
   - Tách **phiên bản app** và **phiên bản giao tiếp** (giữa máy nhân viên và máy chính). Máy chính nhận máy nhân viên có cùng phiên bản giao tiếp, dù khác phiên bản app → cập nhật nhỏ không chặn ai.
   - Đổi phiên bản giao tiếp: máy chính chỉ cho cập nhật khi **đã tải sẵn bộ cài tương ứng cho mọi hệ điều hành có trong văn phòng**. Sau khi máy chính lên bản mới, máy nhân viên cũ **tải bộ cài từ chính máy chính qua mạng nội bộ** (không cần internet), kiểm chữ ký, cài, nối lại. Có thêm lối cài từ USB.
   - Cập nhật có đổi DB: sao lưu trước và quay về được (mục 5.4).
9. Mỗi bản phát hành có ghi chú thay đổi bằng tiếng Việt hiện trong app.

---

## 10. Lộ trình

Ước lượng **sơ bộ** cho một người làm bằng AI; cập nhật sau giai đoạn 0. Mỗi giai đoạn có "Xong khi". Một commit cho mỗi giai đoạn, trên nhánh `dev`. Thử song song Windows và Ubuntu từ giai đoạn 0 (máy dev đang chạy Ubuntu).

### Lựa chọn kỹ thuật đề xuất (kiểm ở giai đoạn 0)

Thư viện dự kiến, **chưa chắc chạy được**. Giai đoạn 0 kiểm từng cái; cái nào hỏng thì ghi lý do vào mục 13 và đề xuất thay thế.

| Việc | Đề xuất | Điểm phải kiểm |
|---|---|---|
| Vỏ app, đóng gói | Electron + `electron-builder` (NSIS cho Windows, `deb` cho Ubuntu) | Build `.exe` từ máy Ubuntu được không |
| PostgreSQL nhúng | Gói npm `embedded-postgres` | Có extension `unaccent` không; chạy trong thư mục có dấu tiếng Việt / dấu cách; có `pg_dump` / `pg_restore` đi kèm |
| Chạy Fastify | **Đã đổi ở 0.4:** chạy bằng **file Node chính thức kèm trong bộ cài** (tiến trình con thường), không dùng Node của Electron: trên Linux `sharp` đọc JPEG trong Electron bị segfault. Nhờ vậy giai đoạn 5 tắt được hẳn `RunAsNode`. Node kèm theo phải cùng bản lớn với Node dùng để cài `node_modules` của backend | `backend/server.js` chạy được với cấu hình truyền vào |
| Phục vụ giao diện | Giao thức riêng của app (vd. `app://`) phục vụ bản build `frontend/`, mọi đường dẫn không phải tệp trả `index.html`; địa chỉ máy chính đưa vào trang qua preload lúc chạy | `createBrowserRouter` chạy đúng khi tải lại trang ở một đường dẫn sâu; nếu không thì đổi sang `createHashRouter` |
| Module biên dịch sẵn (`sharp`, `@napi-rs/canvas`, `bcrypt`) | `electron-builder install-app-deps` | Có bản dựng sẵn cho Windows x64 và Linux x64 |
| Đăng nhập qua trình duyệt | OAuth 2.0 cho app cài trên máy (PKCE + chuyển về `127.0.0.1`, RFC 8252); thư viện OIDC phía máy chủ (vd. `oidc-provider`) hoặc tự viết tối thiểu; Google qua OpenID Connect | Trình duyệt mặc định trên Windows / Ubuntu trả được về cổng nội bộ |
| Tự cập nhật | `electron-updater` + kiểm chữ ký Ed25519 riêng | Chặn được bản không có / sai chữ ký trên cả hai hệ điều hành |
| Tìm máy chính trong mạng | mDNS, gói `bonjour-service` | Wi-Fi văn phòng có chặn mDNS không |
| Chứng chỉ HTTPS máy chính, mã thiết bị | `crypto` của Node (hoặc gói `selfsigned`); kiểm dấu vân tay bằng tuỳ chọn kiểm chứng chỉ của Node / Electron | Máy nhân viên từ chối chứng chỉ sai dấu vân tay |
| Két hệ điều hành | `safeStorage` của Electron (DPAPI trên Windows, Keyring trên Ubuntu) | Ubuntu không có Keyring thì sao |
| Bọc khoá bằng mật khẩu | `crypto.scrypt` của Node + AES-256-GCM | — |
| Mở thư kèm tệp | Windows: `MAPISendMail` qua gói `koffi`; Ubuntu: `xdg-email --attach` | Outlook bản Office, Outlook bản mới, Thunderbird |
| Bytecode, cầu chì | `electron-vite` (bytecode plugin) hoặc `bytenode`; `@electron/fuses` | — (giai đoạn 5) |

### Giai đoạn 0 — Thử nhanh (1,5–2 tuần)

Code thử đặt trong thư mục mới `desktop/` (dùng tiếp làm nền cho giai đoạn 1); máy chủ đăng nhập thử đặt trong `cloud/`. **Không sửa logic trong `backend/` và `frontend/`**; chỉ được thêm chỗ đọc cấu hình nếu bắt buộc, và **một bộ nhận vé thử** (route riêng, bật bằng cấu hình) cho bước 0.5; ghi lại vào mục 13.

⛔ **DỪNG trước khi bắt đầu:** hỏi người dùng có **máy Windows thật** (hoặc máy ảo Windows) và **máy thứ hai cùng mạng** không. Thiếu thì làm phần Ubuntu trước, nhưng giai đoạn 0 **chưa xong** cho tới khi thử thật đủ.

| Bước | Làm gì | Xong khi |
|---|---|---|
| 0.1 | Dựng `desktop/` tối thiểu: Electron mở bản build của `frontend/` | Cửa sổ app hiện màn đăng nhập |
| 0.2 | Khởi động PostgreSQL nhúng trong thư mục dữ liệu của app (`app.getPath('userData')`), mật khẩu ngẫu nhiên, chỉ nghe `127.0.0.1`; chạy `backend/scripts/migrate.js` vào đó | Đủ 42 migration chạy qua; `SELECT unaccent('Nguyễn')` trả `Nguyen`; tắt app thì Postgres tắt theo, không còn tiến trình mồ côi |
| 0.3 | Chạy Fastify trong tiến trình con (xem bảng thư viện: Node riêng), cấu hình truyền qua biến môi trường của tiến trình con; phục vụ giao diện qua giao thức riêng, địa chỉ API lấy lúc chạy; tạo tài khoản thử bằng `backend/scripts/seed_admin.js` | Đăng nhập (kiểu cũ, tạm) được; mở danh sách thuyền viên; tải lại trang ở `/admin/...` vẫn đúng màn |
| 0.4 | Dựng lại module biên dịch sẵn cho Electron; thử tải ảnh chân dung, tải PDF giấy tờ (cắt trang qua `pdfjs` + `canvas`), xuất Excel | Ba việc chạy không lỗi |
| 0.5 | Đăng nhập qua trình duyệt, bản tối thiểu: `cloud/` có một trang đăng nhập thử + cấp vé ký số; app mở trình duyệt, nhận vé qua `127.0.0.1`, đưa vé cho Fastify, Fastify kiểm chữ ký bằng khoá công khai | Đăng nhập trọn vòng trên cả Windows và Ubuntu; rút mạng sau khi đăng nhập vẫn dùng được |
| 0.6 | Đóng gói: `.deb` trên Ubuntu, `.exe` (thử build từ Ubuntu, không được thì build trên máy Windows); cài lên máy sạch | Cài xong mở app, làm lại 0.3–0.5 được; tắt mở lại máy vẫn còn dữ liệu |
| 0.7 | **Cập nhật bản đã đóng gói:** phát bản 0.0.1 rồi 0.0.2 (có thêm một migration thử) lên một chỗ phát thử; thêm kiểm chữ ký Ed25519 | Máy đang chạy 0.0.1 tự lên 0.0.2 trên cả hai hệ điều hành, dữ liệu còn; bản sai chữ ký bị từ chối |
| 0.8 | **Sao lưu → khôi phục khác máy:** `pg_dump` + chép kho tệp + khoá dữ liệu bọc bằng mật khẩu; khôi phục trên máy khác, **cả Windows → Ubuntu và Ubuntu → Windows** | Máy mới mở được thuyền viên và **mở được ảnh / PDF** đã có |
| 0.9 | Hai máy cùng mạng: máy 1 cho Fastify nghe địa chỉ mạng nội bộ qua HTTPS với chứng chỉ tự tạo; máy 2 chạy app chỉ có giao diện, **kiểm dấu vân tay** chứng chỉ máy 1. Thử tìm máy 1 bằng mDNS | Máy 2 thấy thuyền viên vừa thêm ở máy 1; đổi chứng chỉ máy 1 thì máy 2 từ chối; ghi mDNS có tìm được không |
| 0.10 | Mở thư kèm 2 tệp (PDF + ảnh): Windows qua `MAPISendMail`, Ubuntu qua `xdg-email --attach` | Ghi kết quả với Outlook bản Office, Outlook bản mới, Thunderbird (Windows) và Thunderbird (Ubuntu) |
| 0.11 | Đo và ghi vào mục 13; ghi thư viện nào trong bảng lựa chọn kỹ thuật không chạy và vì sao; ước lượng lại các giai đoạn sau | Bảng đủ số, có ước lượng mới |

**Xong khi:** mọi bước qua **trên cả hai hệ điều hành, thử thật**; `npm test` của `backend/` và `frontend/` vẫn qua.
⛔ **DỪNG:** báo kết quả thử và ước lượng mới. Nếu Postgres nhúng có vấn đề nghiêm trọng thì quay lại Q4. Sau đó viết kế hoạch chi tiết giai đoạn 1.

### Giai đoạn 1 — Vỏ ứng dụng, một máy (2–3 tuần)

- Thư mục `desktop/`: Electron, khởi động / tắt Postgres an toàn, phục vụ giao diện, địa chỉ API lúc chạy.
- `backend/` thêm chế độ desktop: cấu hình từ app (không `.env`), `JWT_SECRET` tự sinh, thư mục dữ liệu của app.
- Việc theo giờ: chạy khi app mở + chạy bù. Thông báo hệ điều hành cho hạn chứng chỉ.
- Xuất PDF theo Q6: dò LibreOffice, nút "Cài thành phần xuất PDF".
- Gửi email theo mục 8.1.
- Ẩn SMS (giữ code). Gỡ tạm các tính năng cần internet. Đăng nhập dùng tạm kiểu cũ (thay ở giai đoạn 2).

**Xong khi:** mọi màn hiện có chạy trong app trên một máy như bản web; test hiện có vẫn qua.

### Giai đoạn 2 — Máy chủ dịch vụ và tài khoản (3 tuần)

- Thư mục `cloud/`: Fastify + Postgres riêng, HTTPS, giới hạn tần suất, sao lưu riêng.
- **Tài khoản:** trang web đăng ký (xác minh email), đăng nhập, quên mật khẩu, "Tiếp tục với Google"; cấp vé ký số; làm mới vé; khoá công khai cho app.
- **Văn phòng:** tạo văn phòng, thành viên, lời mời qua email (thư hệ thống của bên mình), dấu vân tay máy chính.
- **App:** đăng nhập qua trình duyệt, phiên 7 ngày, mã PIN, đăng xuất; màn tạo văn phòng **kèm sinh khoá dữ liệu, mật khẩu sao lưu, mã khôi phục** (phần khoá của mục 5.4; sao lưu làm ở giai đoạn 4); màn Người dùng → "Mời" thay luồng `createUser` + `sendInvite` hiện tại; phiên cất trong két hệ điều hành thay `localStorage`.
- Chuyển sang đây: AI đọc giấy tờ + quét danh thiếp, danh mục tàu + tra IMO.
- Trang quản trị nội bộ: văn phòng, khoá văn phòng, lượng quét AI và chi phí.
- Script quét bộ cài tìm bí mật (mục 6.3).

**Xong khi:** các testcase nhóm E qua (E7 tới bước đăng nhập app; phần ghép máy kiểm ở giai đoạn 3); quét giấy tờ và tìm tàu chạy qua máy chủ; bộ cài không chứa khoá nào trong mục 6.3.

### Giai đoạn 3 — Máy chính và máy nhân viên (3–4 tuần)

- Máy chính: HTTPS trong mạng nội bộ, chứng chỉ tự tạo, gửi dấu vân tay lên máy chủ dịch vụ; mở tường lửa; giữ máy không ngủ.
- Ghép máy hai chiều (mục 3.2): kiểm dấu vân tay, cấp và kiểm mã thiết bị trên mọi API, danh sách thiết bị, gỡ thiết bị cắt phiên ngay.
- Máy nhân viên: màn "Không nối được máy chính", tự nối lại, giữ form đang gõ.
- Xuất PDF, quét AI, tìm tàu từ máy nhân viên đi qua máy chính.
- **Chống ghi đè** (mục 3.4): số phiên bản trên các bảng sửa qua form, lỗi 409 + giao diện xung đột giữ nội dung đang nhập; mã yêu cầu chống tạo trùng.
- Phiên bản giao tiếp, máy chính phát bộ cài cho máy nhân viên qua mạng nội bộ (mục 9, ý 8).

**Xong khi:** các testcase nhóm D và phần ghép máy của E7 qua với 1 máy chính + 2 máy nhân viên (trộn Windows và Ubuntu).

### Giai đoạn 4 — Kho tệp, sao lưu, bảo mật (2–3 tuần)

- **Lớp kho tệp** (mục 5.5): chuyển mọi service sang, mã hoá mọi bản phát sinh, DB lưu mã tệp tương đối, test chặn `fs` thẳng vào kho; thư mục tạm riêng, dọn lúc khởi động.
- **Khoá dữ liệu, mật khẩu sao lưu, mã khôi phục dữ liệu** (mục 5.4).
- **Sao lưu nhất quán, khôi phục khác máy / khác hệ điều hành, cập nhật có quay về.**
- Nút "Mở thư mục hồ sơ", "Xuất hồ sơ ra thư mục", quyền xuất hàng loạt.
- Kiểm và nhắc mã hoá ổ đĩa trên máy chính.
- Cấu hình Electron an toàn, CSP, chặn trang web lạ gọi vào phần xử lý (mục 5.2).
- Màn đồng ý lần đầu quét AI.

**Xong khi:** các testcase nhóm B qua.

### Giai đoạn 5 — Bảo vệ code (1 tuần)

- Gom và nén code, bytecode V8, cầu chì Electron, kiểm toàn vẹn gói (Windows), tắt DevTools.

**Xong khi:** các testcase nhóm C qua; app vẫn chạy bình thường và không bị Windows Defender báo nhầm.

### Giai đoạn 6 — Đóng gói và phát hành (1–2 tuần)

- Bộ cài `.exe` và `.deb`, ký bản cập nhật, hai kênh, chặn phát hành thiếu hệ điều hành, trang Tải về, ghi chú phiên bản.
- ⛔ **DỪNG:** xin sếp duyệt mua chứng thư ký số Windows (M4) trước phát hành rộng. Bản chạy thử ở giai đoạn 7 có thể chưa ký.

**Xong khi:** các testcase nhóm F qua.

### Giai đoạn 7 — Chạy thử với khách (2 tuần)

- 2–3 văn phòng thân, kênh beta, mỗi nơi ít nhất một máy nhân viên. Thu lỗi, sửa.

**Xong khi:** các văn phòng dùng 2 tuần không mất dữ liệu, không lỗi chặn việc; hỗ trợ MCAH chuyển máy chính thử một lần bằng lệnh `--backup` / `--restore` (Q15: app không có sao lưu cho người dùng).
⛔ **DỪNG:** báo sếp trước khi mở bán.

**Tổng sơ bộ:** 16–20 tuần. Bản quyền (mục 7) cộng 1–2 tuần khi sales chốt.

**Ước lượng lại sau giai đoạn 0 (2026-11-11): 15–18 tuần còn lại**, gồm: phần giai đoạn 0 còn thiếu (Windows + hai máy, ~1 tuần khi có máy); giai đoạn 1 còn 1,5–2 tuần (vỏ app, Postgres, backend, đóng gói đã chạy); giai đoạn 2 giữ 3 tuần (mới có bản đăng nhập thử, chưa Google, mời, trang web); giai đoạn 3 giữ 3–4 tuần (0.9 chưa thử, rủi ro lớn nhất còn lại); giai đoạn 4 tăng lên 3 tuần (định dạng sao lưu đã có, nhưng thêm đọc theo luồng, đường dẫn tương đối, lớp kho tệp, màn sao lưu); giai đoạn 5 giữ 1 tuần; giai đoạn 6 giảm còn 1 tuần (cập nhật có chữ ký đã chạy); giai đoạn 7 giữ 2 tuần.

### Màn giao diện mới cần vẽ wireframe trước khi code

Đăng nhập qua trình duyệt (màn chờ, màn dán mã dự phòng) · Trang web đăng ký / đăng nhập / quên mật khẩu · Tạo văn phòng (máy chính) · Đặt mật khẩu sao lưu + mã khôi phục dữ liệu · Ghép máy · Cài đặt → Máy trong văn phòng · Màn "Không nối được máy chính" · Đặt mã PIN, màn khoá · Người dùng → Mời · Hộp xung đột khi lưu (409) · nút "Mở thư mục hồ sơ" và hộp "Xuất hồ sơ ra thư mục" · Cài đặt → Sao lưu & khôi phục · Cài đặt → Email gửi đi · Cài đặt → Cập nhật · "Cài thành phần xuất PDF" · dải thông báo (chưa sao lưu / máy chính không có internet / sắp hết 7 ngày / cần cập nhật theo máy chính) · hộp đồng ý lần đầu quét AI. Dựng trên trang và control `components/ds/` sẵn có; chỉ cần chạy tốt trên màn máy tính (Q2).

---

## 11. Testcase chính

**Nhóm A — Cài và dùng**

| # | Bước | Kết quả đúng |
|---|---|---|
| A1 | Cài trên Windows 11 sạch và Ubuntu 24.04 sạch, không có Node / Postgres | Cài được, mở app được (Windows chưa ký thì có cảnh báo SmartScreen, bấm "Run anyway") |
| A2 | Rút internet ở máy chính, dùng hết các màn chính | Mọi việc chạy; nút quét / tìm tàu mờ, ghi "Cần kết nối internet" |
| A3 | Tắt app khi đang lưu form, mở lại | Không hỏng dữ liệu, form về trạng thái trước khi lưu |
| A4 | Tắt máy chính đột ngột (rút điện) khi app đang mở | Mở lại app chạy bình thường; thư mục tạm của app đã được dọn |
| A5 | Máy có Outlook (Office) / Thunderbird: bấm "Gửi mail" ở Cơ hội | Mở thư mới đủ người nhận, tiêu đề, nội dung, tệp đính kèm mở được (kể cả giấy tờ đã mã hoá) |
| A6 | Máy không có app mail, bấm "Gửi mail" | Mở thư mới không tệp + mở thư mục chứa tệp + nút "Cài Thunderbird" |
| A7 | Sau khi mở thư, chọn "Đã gửi" / "Chưa" | Cơ hội ghi đúng trạng thái; chọn "Chưa" thì không ghi |
| A8 | Chọn cách SMTP, khai Gmail + mật khẩu ứng dụng, bấm "Gửi thử" | Nhận được thư thử; mật khẩu không nằm trong tệp nào của app |
| A9 | Máy chính chưa có LibreOffice, bấm xuất PDF | Hiện "Cần cài thành phần xuất PDF — [Cài ngay]"; cài xong xuất được; xuất Excel luôn được |

**Nhóm B — Kho tệp, sao lưu, bảo mật người dùng**

| # | Bước | Kết quả đúng |
|---|---|---|
| B1 | Để yên 15 phút | App khoá, mở bằng mã PIN; sai 5 lần phải đăng nhập lại |
| B2 | Copy thư mục dữ liệu máy chính sang máy khác, mở các tệp trong kho | Không tệp nào đọc được: tệp gốc, ảnh trang, ảnh thu nhỏ, chân dung, ZIP đã gửi, thùng rác |
| B3 | Từ trình duyệt mở trang web gọi vào phần xử lý của máy chính | Bị từ chối |
| B4 | Tên thuyền viên chứa `<script>` | Hiện như chữ thường, không chạy |
| B5 | Sao lưu → cài máy mới (khác hệ điều hành) làm máy chính → khôi phục bằng mật khẩu sao lưu | Đủ dữ liệu; **mở được ảnh / PDF** |
| B6 | Như B5 nhưng dùng mã khôi phục dữ liệu thay mật khẩu sao lưu | Như B5 |
| B7 | Khôi phục với sai mật khẩu sao lưu | Báo sai, không hỏng gì |
| B8 | Sao lưu trong lúc hai máy nhân viên đang tải giấy tờ và sửa hồ sơ; khôi phục bản đó | Mọi dòng trong DB khôi phục đều có tệp tương ứng mở được |
| B9 | Cập nhật lên bản có migration cố ý lỗi ở tệp thứ hai | Máy chính tự khôi phục DB và khoá về trước cập nhật, quay về bản cũ, máy nhân viên nối lại được |
| B10 | Đọc log sau một ngày dùng | Không có tên, số hộ chiếu, số điện thoại |
| B11 | Mở tay thư mục kho tệp | Không thấy tên thuyền viên trong tên tệp, không tệp nào đọc được. (DB **không** thuộc phạm vi test này: nó không mã hoá, xem mục 5.1) |
| B12 | Bấm "Mở thư mục hồ sơ" của một thuyền viên (trên máy chính và trên máy nhân viên) | Mở đúng cấu trúc mục 5.5, tệp mở được, không sửa được |
| B13 | Đóng app / đăng xuất / tắt điện đột ngột rồi mở lại; kiểm thư mục tạm | Không còn bản giải mã nào |
| B14 | Xuất toàn bộ hồ sơ ra USB | Có cảnh báo không mã hoá; cấu trúc đúng; bản cũ trong `Bản cũ/`; tệp đã xoá không có |
| B15 | Thuyền viên trùng tên, tên có ký tự `/:?` | Hai thư mục khác nhau nhờ mã; ký tự cấm bị bỏ |
| B16 | Nhân viên không có quyền xuất hàng loạt | Không thấy nút xuất nhiều / xuất toàn bộ |
| B18 | Đang sao lưu thì: đầy ổ / rút USB / tắt điện | Không có bản sao lưu dở được tính là xong; lần sau sao lưu lại bình thường |
| B19 | Sao lưu thứ Hai → gỡ nhân viên X thứ Ba → khôi phục bản thứ Hai | X không vào được; mọi máy nhân viên phải ghép lại |
| B20 | Job xoá tệp tới hạn chạy giữa lúc sao lưu đang chép tệp | Bản sao lưu đủ tệp |
| B17 | Tìm trong mã nguồn backend lệnh `fs` ghi thẳng vào kho tệp ngoài lớp kho tệp | Test tự động báo lỗi |

**Nhóm C — Bảo vệ code**

| # | Bước | Kết quả đúng |
|---|---|---|
| C1 | **Windows:** sửa một byte trong gói `app.asar` | App không khởi động |
| C2 | **Ubuntu:** như C1 | Ghi nhận là **không chặn được** (Electron chưa hỗ trợ kiểm toàn vẹn gói trên Linux); code vẫn ở dạng bytecode, không đọc được như mã nguồn |
| C3 | Chạy `strings` / tìm chữ trên toàn bộ thư mục cài (cả hai hệ điều hành) | Không thấy khoá nào ở mục 6.3 |
| C4 | Mở thư mục cài đặt, tìm code phần xử lý | Không đọc được như mã nguồn |
| C5 | Gọi thẳng API quét AI của máy chủ không kèm vé, vé hết hạn, hoặc văn phòng bị khoá | Bị từ chối |
| C6 | Bấm tổ hợp phím mở DevTools ở bản phát hành; chạy app với cờ gỡ lỗi (`--inspect`) | Không mở / bị bỏ qua |

**Nhóm D — Máy chính và máy nhân viên**

| # | Bước | Kết quả đúng |
|---|---|---|
| D1 | Nhân viên được mời, đăng nhập trên máy mình | Tự tìm và ghép đúng máy chính, vào được với đúng vai trò |
| D2 | Dựng một máy giả cùng tên, cùng quảng bá mDNS với máy chính | Máy nhân viên từ chối vì sai dấu vân tay |
| D3 | Laptop lạ cùng Wi-Fi, chưa ghép, gọi vào máy chính (có hoặc không có vé đăng nhập hợp lệ của văn phòng khác) | Bị từ chối |
| D4 | Bắt gói tin trong mạng khi máy nhân viên đang làm việc | Không đọc được nội dung |
| D5 | Gỡ một máy nhân viên **đang có phiên mở** | Thao tác kế tiếp trên máy đó bị từ chối, app về màn đăng nhập |
| D6 | Tắt máy chính khi máy nhân viên đang gõ form | Báo không nối được, form giữ nguyên; bật lại thì lưu được |
| D7 | Đổi địa chỉ IP của máy chính | Máy nhân viên tự tìm lại theo tên máy |
| D8 | A và B cùng mở một thuyền viên; A đổi điện thoại, lưu; B đổi địa chỉ, lưu | B nhận báo xung đột, nội dung B đang nhập còn nguyên; số điện thoại của A **không** bị ghi đè |
| D9 | Bấm "Thêm thuyền viên", cắt mạng nội bộ ngay sau khi máy chính lưu xong, nối lại và bấm lần nữa | Chỉ có một thuyền viên |
| D10 | Máy chính lên bản mới **cùng** phiên bản giao tiếp | Máy nhân viên bản cũ vẫn làm việc |
| D11 | Máy chính lên bản mới **khác** phiên bản giao tiếp; máy nhân viên **không có internet** | Máy nhân viên tải bộ cài từ máy chính, kiểm chữ ký, cài, nối lại |
| D12 | Quét AI và xuất PDF từ máy nhân viên | Chạy qua máy chính, kết quả như làm trên máy chính |
| D13 | Máy chính Ubuntu, máy nhân viên Windows (và ngược lại) | Chạy như nhau |

**Nhóm E — Tài khoản và đăng nhập**

| # | Bước | Kết quả đúng |
|---|---|---|
| E1 | Bấm "Đăng nhập" trong app (Windows và Ubuntu) | Trình duyệt mặc định mở trang đăng nhập; xong thì app tự vào, trình duyệt hiện "Quay lại app" |
| E2 | Đăng ký bằng email (có xác minh) và bằng Google | Cả hai vào được |
| E3 | Quên mật khẩu trên web | Đặt lại được; đăng nhập app bằng mật khẩu mới |
| E4 | Phần mềm chặn chuyển về `127.0.0.1` | Trang web hiện mã để dán; dán vào app thì vào được |
| E5 | Đã đăng nhập, rút internet 6 ngày (chỉnh đồng hồ máy chủ thử) | Vẫn làm việc; ngày thứ 6 có dải vàng |
| E6 | Rút internet quá 7 ngày | Phải đăng nhập lại; không có internet thì không vào được |
| E7 | Quản trị mời email mới với vai trò X | Thư mời tới từ máy chủ dịch vụ; người đó đăng ký, đăng nhập app, vào văn phòng với vai trò X |
| E8 | Quản trị tắt một nhân viên | Phiên của người đó bị chặn ngay ở thao tác kế tiếp |
| E9 | Đăng xuất | Lần mở sau phải đăng nhập qua trình duyệt; mã PIN cũ không dùng được |
| E11 | Vé còn 1 ngày offline, đóng mở app / xin phiên mới nhiều lần khi mất mạng | Hết đúng mốc cũ, không được kéo dài |
| E12 | Sai PIN 5 lần khi trình duyệt vẫn đang đăng nhập Google | Vẫn bắt nhập lại mật khẩu / xác thực Google |
| E13 | Gỡ máy nhân viên rồi máy đó xin ghép lại ngay | Chờ quản trị duyệt |
| E10 | Tìm mật khẩu / vé trong `localStorage` và các tệp của app | Không có vé / mật khẩu **dạng rõ** (bản đã mã hoá trong két được phép) |

**Nhóm F — Phát hành và cập nhật**

| # | Bước | Kết quả đúng |
|---|---|---|
| F1 | Tải từ website về máy Windows sạch và máy Ubuntu sạch | Cài và chạy được |
| F2 | Phát bản 1.0.1, văn phòng đang chạy 1.0.0 | Tự nhận và cập nhật, dữ liệu còn nguyên |
| F3 | Đặt một bản cập nhật sai chữ ký lên chỗ phát (Windows và Ubuntu) | App từ chối cài |
| F4 | Chạy script phát hành khi thiếu bản Ubuntu | Script dừng, không phát hành |

---

## 12. Chi phí tham khảo (cần kiểm giá lúc mua)

| Khoản | Ước tính | Ghi chú |
|---|---|---|
| Chứng thư ký số Windows (OV hoặc EV) | ~200–600 USD/năm | Thiếu thì Windows cảnh báo khi cài và antivirus hay báo nhầm. Chạy thử có thể chưa mua. Chọn loại dùng được trong quy trình build tự động |
| Ubuntu | 0 | Bản cập nhật vẫn ký bằng khoá riêng của bên mình (miễn phí) |
| Máy chủ dịch vụ | ~10–40 USD/tháng | Giờ gánh cả đăng nhập nên cần ổn định hơn; có thể dùng lại máy chủ bản web |
| Gửi thư hệ thống (mời, xác minh, quên mật khẩu) | 0–15 USD/tháng | Dịch vụ gửi thư có gói miễn phí cho lượng nhỏ |
| Tên miền cho trang đăng nhập | ~10–20 USD/năm | Nếu chưa có |
| AI đọc giấy tờ | Theo lượt | Bên mình chịu; sales tính vào giá |
| Tư vấn pháp lý | Tuỳ | Một lần |

---

## 13. Rủi ro và cách giảm

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Máy chính hỏng ổ / bị mất, cả văn phòng mất dữ liệu | **Cao** | Sao lưu tự động ra ngoài máy + cảnh báo; khôi phục thử ở giai đoạn 0 và 7 |
| Mất khoá dữ liệu (máy chính hỏng, quên cả mật khẩu sao lưu lẫn mã khôi phục) | **Cao** | Hai đường mở khoá; bắt in / chép mã khôi phục lúc tạo văn phòng; nhắc định kỳ quản trị kiểm còn giữ mã |
| Máy chính tắt / ngủ, cả văn phòng không làm việc được | **Cao** | Khuyên dùng máy bàn luôn bật; app giữ máy không ngủ; màn báo rõ ở máy nhân viên |
| Máy chủ dịch vụ sập | Trung bình | Người đã đăng nhập làm tiếp tới 7 ngày; chỉ mất đăng nhập mới, mời, quét AI, tìm tàu trong lúc sập. Theo dõi máy chủ, sao lưu máy chủ |
| Mạng văn phòng chặn các máy nói chuyện với nhau, tường lửa / antivirus chặn cổng | Trung bình | Bộ cài mở tường lửa; gõ tay tên / địa chỉ máy chính; thử ở giai đoạn 0 và 7 |
| PostgreSQL nhúng lỗi trên một số máy (antivirus, đường dẫn có dấu, tên người dùng có dấu cách) | Trung bình | Thử ở giai đoạn 0 trên nhiều máy; thư mục dữ liệu ở đường dẫn không dấu |
| Khối lượng sửa code lớn hơn dự kiến (kho tệp, chống ghi đè, đăng nhập) | Trung bình | Ước lượng lại sau giai đoạn 0; mỗi giai đoạn có kế hoạch chi tiết riêng |
| Bị antivirus báo nhầm vì làm rối code | Trung bình | Ký số; không chống gỡ lỗi hung hăng; gửi mẫu cho Microsoft xét |
| Bản đầu chưa có bản quyền, có thể bị sửa để dùng phần offline | Đã chấp nhận | Mục 6.1; làm bản quyền khi sales chốt |
| Không làm việc từ ngoài văn phòng được | Trung bình về kinh doanh | Báo rõ cho sales; làm sau qua VPN |
| Chi phí AI tăng vì bên mình chịu | Trung bình | Giới hạn tần suất theo văn phòng; khoá văn phòng lạm dụng |

### Số đo giai đoạn 0 (đo trên Ubuntu 2026-11-11; cột Windows chờ máy Windows)

| Mục | Windows | Ubuntu |
|---|---|---|
| Dung lượng bộ cài | `.exe` 202 MB (build được từ Ubuntu, **chưa chạy thử**) | `.deb` 181 MB |
| Dung lượng sau khi cài | | 693 MB (`/opt/MCAH`): Electron ~280, backend ~225, Node 121, Postgres 60 |
| Thời gian mở app (lần đầu / lần sau) | | 4,7 giây (tạo DB + 42 migration) / 1,5 giây, tính tới màn đăng nhập |
| RAM máy chính lúc rảnh / lúc quét giấy tờ | | ~490 MB (Electron 278, backend 177, Postgres 11; đo PSS) / đỉnh ~650 MB khi cắt PDF + xuất Excel (chưa gọi AI) |
| RAM máy nhân viên | | Chưa đo (cần 0.9). Ước ~280 MB (chỉ phần Electron) |
| Thời gian sao lưu / khôi phục (với dữ liệu mẫu) | | 0,6 giây / 1,7 giây (4 thuyền viên, 18 tệp, gói 3 MB). Chưa đo dữ liệu lớn: hiện cả gói nằm trong bộ nhớ, giai đoạn 4 phải đọc theo luồng |
| Thư viện không chạy được và thay bằng gì | | `utilityProcess` (sharp segfault khi đọc JPEG + pdfjs tưởng là trình duyệt) → Node riêng. Thư viện `embedded-postgres` lúc chạy (đường dẫn trong `app.asar`) → gọi thẳng `initdb` / `postgres`. `pg_dump` (không có) → chụp JSON trong `REPEATABLE READ`. `electron-updater` → tự viết, ký Ed25519. `xdg-email --attach` với Thunderbird snap → `thunderbird -compose`. Chưa thử: `bonjour-service` (0.9), `koffi` + MAPI (Windows) |
| Postgres nhúng (0.2) | | `embedded-postgres@17.11.0-beta.19` (= PostgreSQL 17.11, cùng đời bản server); có `unaccent`; 42 migration qua; chỉ nghe 127.0.0.1. **Gói không có `pg_dump` / `pg_restore`** → 0.8 dùng cách khác (xem dòng sao lưu) |
| Fastify + giao diện trong app (0.3) | | Chạy được, **không sửa dòng nào** trong `backend/` và `frontend/`. Giao diện build riêng (`desktop/vite.frontend.config.mjs`, không lấy `frontend/.env`), gọi `/api/v1` tương đối qua `app://` (axios từ chối URL `app:`), tiến trình chính chuyển tiếp sang Fastify cổng ngẫu nhiên. Backend chạy với thư mục làm việc là userData để không đọc `backend/.env`. `migrate.js` cũng cần `JWT_SECRET`. `sharp` cảnh báo khác bản trên Electron Linux → xem ở 0.4 |
| Module biên dịch sẵn (0.4) | | `bcrypt`, `sharp`, `@napi-rs/canvas` đều N-API, **không cần dựng lại**. Nhưng trong Node của Electron trên Linux, **`sharp` đọc JPEG là segfault** (PNG, WebP không sao) → backend chạy bằng Node riêng (bộ cài nặng thêm ~30 MB). Trong `utilityProcess`, pdfjs còn tưởng là trình duyệt (`process.type`) → cũng hết khi dùng Node riêng. Ảnh chân dung, cắt PDF thành ảnh trang, xuất Excel: chạy được |
| Đăng nhập qua trình duyệt (0.5) | | Chạy trọn vòng với trình duyệt thật (Chromium): trang đăng nhập `cloud/` → chuyển về `127.0.0.1:<cổng tạm>` → vé Ed25519 → Fastify kiểm bằng khoá công khai → phiên. Phiên hết đúng mốc vé (7 ngày), không dài hơn. Bị chặn: vé ký khoá lạ, vé rác, mã sai, `redirect_uri` không phải 127.0.0.1, `state` sai. Tắt máy chủ dịch vụ rồi mở lại app: vẫn làm việc. `cloud/server.js` không thư viện ngoài; chưa có Google. Route nhận vé: `backend/src/routes/v1/desktop_ticket.routes.js`, chỉ bật khi có `DESKTOP_TICKET_PUBLIC_KEY`. Giao diện chưa có nút: đăng nhập ở menu Tài khoản của app. **Chưa thử rút dây mạng thật** (máy chủ dịch vụ đang chạy cùng máy) |
| Đóng gói (0.6) | Build được, chưa thử | `npm run dist:linux` / `dist:win` trong `desktop/`. Bộ cài gồm: Electron, giao diện, `resources/backend` (chỉ phần chạy, không `.env`/test/uploads), `resources/node` (Node chính thức, kiểm SHA-256), `resources/postgres`, `resources/forms`, khoá công khai máy chủ dịch vụ. Bỏ thư viện `embedded-postgres` lúc chạy (đường dẫn trong `app.asar` không chạy được): app tự gọi `initdb` / `postgres`. Chạy bản đóng gói với HOME trống, không có `node` trên máy, máy chủ dịch vụ tắt: lần đầu mở được, 42 migration; đăng nhập qua trình duyệt, ảnh, PDF, Excel chạy; tắt mở lại còn dữ liệu và phiên. Thêm: backend tự thoát khi app chết (kể cả `kill -9`). **Chưa cài bằng `dpkg -i` lên máy sạch thật** (cần quyền quản trị / máy khác). Backend ~225 MB, phần lớn là thư viện AI + pdfjs + canvas → giảm khi AI chuyển lên máy chủ (giai đoạn 2). Thư mục dữ liệu đang tên `seasmart-desktop` → đổi ở giai đoạn 1 |
| Cập nhật (0.7) | Chưa thử (cần máy Windows) | Tự viết (`desktop/src/updater.js`), không dùng electron-updater: `latest.json` ký Ed25519 (khoá riêng ở `desktop/.release/`, không commit), bộ cài kiểm SHA-256. Ubuntu cài bằng `pkexec dpkg -i` → **hỏi mật khẩu quản trị mỗi lần cập nhật** (người dùng chốt 2026-11-11). Windows chạy bộ cài im lặng, không hỏi. Đã thử: bản thật nhận và tải đúng; sửa `latest.json`, ký bằng khoá lạ, thay bộ cài → đều bị từ chối. **Đã thử cài thật trên Ubuntu:** cài 0.0.1 bằng apt → app hỏi bản mới → `pkexec` xin mật khẩu → lên 0.0.2, tự mở lại; migration thử chạy (43), dữ liệu có trước cập nhật còn nguyên. Việc sau: xoá bộ cài đã tải (`userData/updates`, ~180 MB) sau khi cập nhật xong; sao lưu trước cập nhật làm ở 0.8 / giai đoạn 4 |
| Sao lưu / khôi phục (0.8) | Chưa thử (cần máy Windows: Ubuntu → Windows và ngược lại) | `desktop/src/backup.js`. **Không có `pg_dump`** → đọc mọi bảng trong một giao dịch `REPEATABLE READ` ra JSON; khôi phục = chạy migration của app rồi nạp dữ liệu (`json_populate_recordset`, bỏ cột sinh tự động, đặt lại sequence) → **chỉ khôi phục vào app có đúng bộ migration**, app kiểm và báo. Gói `.ssbak`: khoá gói ngẫu nhiên bọc bằng mật khẩu sao lưu **và** mã khôi phục (mỗi cách tự mở cả gói), AES-256-GCM, phần đầu là AAD; ghi tệp tạm, tự giải mã kiểm lại rồi mới đổi tên. Đã thử (sang thư mục dữ liệu khác trên cùng máy): mở bằng mật khẩu, bằng mã khôi phục (gõ thường, bỏ gạch vẫn nhận) → đủ thuyền viên, **mở được ảnh chân dung và ảnh trang PDF**, thêm bản ghi mới không trùng số; sai mật khẩu, sai mã, gói bị sửa 1 byte → từ chối, máy vẫn trống, thử lại được; không khôi phục đè lên máy có dữ liệu. Tạm: lệnh dòng lệnh (`--backup-setup`, `--backup=`, `--restore=`), chưa có màn; DB còn đường dẫn tuyệt đối nên lúc khôi phục đổi tiền tố kho tệp (giai đoạn 4 bỏ, dùng mã tệp tương đối); cả gói nằm trong bộ nhớ khi mở (giai đoạn 4 đọc theo luồng); khoá bọc trên máy chính nằm trong tệp 0600 (giai đoạn 4 vào két); phần đầu gói lộ đường dẫn kho tệp cũ (bỏ khi dùng đường dẫn tương đối) |
| Mở thư kèm tệp (0.10) | Đã viết (`MAPISendMail` qua `koffi`), **chưa thử** Outlook bản Office / Outlook mới / Thunderbird | `desktop/src/mail.js`. Thunderbird (snap, Ubuntu 25): **đạt**, thư mới có người nhận, tiêu đề, nội dung, đủ PDF + ảnh. **`xdg-email --attach` không dùng được với Thunderbird bản snap**: xdg-email không nhận ra nó, rơi về `gio open mailto:...&attach=`, Thunderbird bỏ qua đính kèm trong mailto → app gọi thẳng `thunderbird -compose`. Bản tạm để đính kèm đặt ở `~/MCAH/Tệp gửi thư` (thư mục thường, bản snap đọc được), không để trong `~/.config` hay `/tmp`. Evolution: vẫn qua xdg-email, chưa thử. Máy không có app mail: mở thư mục chứa tệp (chưa có nút "Cài Thunderbird") |
| Tắt app có còn Postgres mồ côi | | Đóng cửa sổ, Ctrl+C, SIGTERM: không còn. `kill -9` app: Postgres còn, **lần mở sau tự tắt nó** rồi chạy tiếp |

---

## 14. Không nằm trong kế hoạch này

- Bản quyền, cách tính tiền (mục 7; sales chốt).
- macOS, app điện thoại (Q2, Q3). Code giao diện điện thoại hiện có giữ nguyên.
- Làm việc từ ngoài văn phòng (VPN).
- SMS: tạm bỏ. Code `sms.service.js` để nguyên.
- Sao lưu lên máy chủ của bên mình (có thể làm sau, mã hoá đầu-cuối).
- Mở khoá bằng Windows Hello.
- Mã hoá cơ sở dữ liệu (cần SQLite / SQLCipher, mục 4.3).
- Chuyển dữ liệu từ bản web (Q7).
- Tạo tài khoản khi không có internet (Q12–Q13: tài khoản do máy chủ dịch vụ quản lý).

## 15. Nhật ký

| Ngày | Giai đoạn | Việc | Ghi chú |
|---|---|---|---|
| 2026-11-09 | — | Lập kế hoạch | Chờ sếp chốt mục 4 |
| 2026-11-11 | — | Chốt cách gửi email | Mở app mail của máy, tự đính kèm; SMTP là cách phụ (mục 8.1) |
| 2026-11-11 | — | Bỏ SMS; chốt thư mục tài liệu | Kho trong mã hoá, xem tay qua "Mở thư mục hồ sơ" / "Xuất hồ sơ", chỉ xem và copy (mục 5.5) |
| 2026-11-11 | — | Chốt Q1–Q10 | Máy chính + máy nhân viên; Windows + Ubuntu; không điện thoại; hoãn bản quyền |
| 2026-11-11 | — | Chốt Q4, Q6 | PostgreSQL; không đóng gói LibreOffice / Thunderbird |
| 2026-11-11 | — | Bổ sung cách làm việc + bước chi tiết giai đoạn 0 | Các giai đoạn sau viết kế hoạch chi tiết riêng trước khi làm |
| 2026-11-11 | — | Sửa theo review + đăng nhập qua trình duyệt (Q11–Q13) | Khoá dữ liệu trong bản sao lưu; sao lưu nhất quán; ghép máy hai chiều + mã thiết bị; chống ghi đè; lớp kho tệp; cập nhật đủ hai hệ điều hành + ký riêng; tiêu chí chống crack theo nền tảng; giai đoạn 0 thêm cập nhật, sao lưu khác máy, đăng nhập; ước lượng 16–20 tuần |
| 2026-11-11 | — | Sửa theo review lần 2 | Khoá gói sao lưu mở được bằng mã khôi phục; khoá chống xoá tệp suốt lúc sao lưu; chặn ghi trước khi sao lưu cập nhật; mốc offline 7 ngày gắn vào JWT; PIN sai bắt xác thực lại thật; ghép lại sau khi gỡ cần duyệt; khôi phục không trả quyền đã thu hồi; giới hạn két hệ điều hành; sắp lại thứ tự giai đoạn 0/2/3 |
| 2026-11-11 | — | Giai đoạn 0 trên Ubuntu | 0.1–0.8, 0.10, 0.11 đạt trên Ubuntu (số đo mục 13); 0.9 và phần Windows chờ máy; ước lượng còn 15–18 tuần; cập nhật trên Ubuntu hỏi mật khẩu quản trị (người dùng chốt) |
| 2026-11-11 | 1 | Viết kế hoạch chi tiết giai đoạn 1 | `docs/mcah-ke-hoach-desktop-gd1.md`, wireframe `docs/design/wireframes/desktop-gd1.html`, testcase, hướng dẫn nháp; chờ duyệt |
| 2026-11-11 | 1 | Code giai đoạn 1 trên Ubuntu | Chi tiết ở Nhật ký `docs/mcah-ke-hoach-desktop-gd1.md`; chờ Windows, testcase tay còn lại, quyết định về thông báo nhắc hạn |
| 2026-11-12 | 2 | Viết kế hoạch chi tiết giai đoạn 2 | `docs/mcah-ke-hoach-desktop-gd2.md`, wireframe `docs/design/wireframes/desktop-gd2.html`, testcase, hướng dẫn nháp; chờ duyệt |
| 2026-11-12 | 2 | Code giai đoạn 2 trên Ubuntu (máy chủ dịch vụ chạy ở máy dev) | Chi tiết ở Nhật ký `docs/mcah-ke-hoach-desktop-gd2.md`; chờ Google (M9), máy chủ thật + tên miền (M2), khoá AI / nguồn tàu ở máy chủ, Windows |
| 2026-11-13 | 4 | Chốt Q14: không mã hoá tài liệu, không mã hoá sao lưu | Tài liệu lưu thẳng cây thư mục dễ đọc; viết lại kế hoạch giai đoạn 4 |
| 2026-11-13 | 4 | Chốt Q15: bỏ tính năng sao lưu cho người dùng | Chỉ còn bản chụp trước khi cập nhật và lệnh cho hỗ trợ MCAH |
| 2026-11-13 | 4 | Code giai đoạn 4 trên Ubuntu | Chi tiết ở Nhật ký `docs/mcah-ke-hoach-desktop-gd4.md`; chờ Windows, bộ cài thật (B9), đăng nhập thật để thử chuyển máy (B5, B19) |
| 2026-11-13 | — | Chốt M1, M3–M8 | MCAH; /download; ký số chưa vội; trang điều khoản TBC; 375px chỉ cho bản web; không làm bản quyền |
