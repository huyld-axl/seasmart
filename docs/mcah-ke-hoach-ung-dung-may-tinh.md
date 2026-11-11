# MCAH — Kế hoạch chuyển sang ứng dụng cài trên máy tính

- **Ngày lập:** 2026-11-09 · **Sửa lớn:** 2026-11-11 (chốt Q1–Q10, mục 4)
- **Yêu cầu của sếp:** người dùng tải bộ cài từ website, cài lên máy như một phần mềm bình thường. Dữ liệu lưu trong máy của khách (không lưu trên máy chủ của bên mình). Một vài tính năng dùng mạng (tìm tàu, quét giấy tờ).
- **Hai điều phải đảm bảo:** (1) dữ liệu của người dùng an toàn, (2) sản phẩm của bên mình không dễ bị bẻ khoá (crack).
- **Trạng thái:** kế hoạch, **chưa có code**. Q1–Q10 đã chốt (mục 4.1). Việc còn mở không chặn giai đoạn 0: mục 4.2.
- **Người làm:** một agent lập trình. Đọc mục "Cách làm việc với file này" ngay dưới trước tiên.

## Cách làm việc với file này

1. Đọc `CLAUDE.md` ở gốc repo trước. Mọi quy ước vẫn áp dụng (CommonJS không chấm phẩy ở backend, SQL tham số hoá, `pickAllowed`, lỗi dạng `{ statusCode, message }`, xoá tệp qua `trashFiles()`, chữ giao diện tiếng Việt). Riêng quy định 375px ở mục 3.5 chờ M6 (mục 4.2).
2. Mục 0–9 là **thiết kế đã chốt**: dùng để biết "làm cái gì". Không tự đổi quyết định ở mục 4.1; thấy cần đổi thì ⛔ DỪNG và hỏi.
3. Làm đúng thứ tự giai đoạn ở mục 10. **Chỉ giai đoạn 0 đã có bước chi tiết.** Giai đoạn 0 là thử nghiệm, kết quả của nó quyết định cách làm các giai đoạn sau (thư viện nào chạy được, chạy ở tiến trình nào…). Vì vậy:
   - Trước khi bắt đầu **mỗi giai đoạn từ 1 trở đi**: viết kế hoạch chi tiết riêng `docs/mcah-ke-hoach-desktop-gd<N>.md` theo mẫu các kế hoạch khác trong `docs/` (các bước nhỏ, file sẽ sửa, "Xong khi" từng bước, testcase lấy từ mục 11). Giai đoạn có màn mới thì kèm wireframe (danh sách màn ở cuối mục 10), dựng trên trang và control `components/ds/` sẵn có.
   - ⛔ **DỪNG** chờ người dùng duyệt kế hoạch chi tiết và wireframe rồi mới code.
4. Mỗi bước có "Xong khi"; chỉ sang bước sau khi mọi ý đều đúng.
5. Commit trên nhánh `dev` (không tạo nhánh khác), một commit cho một giai đoạn, message tiếng Việt thể mệnh lệnh. Không push nếu chưa được bảo.
6. Gặp **⛔ DỪNG** thì dừng, báo người dùng đúng điều được hỏi và chờ trả lời.
7. Ghi tiến độ vào mục 15 "Nhật ký" sau mỗi giai đoạn.
8. Không đọc, không grep tệp `.env`; cần biết biến nào thì xem `.env.example` hoặc hỏi.

---

## 0. Tóm tắt một trang (để trình sếp)

1. **Không viết lại app.** Giao diện React và phần xử lý Fastify đang có được giữ gần như nguyên vẹn, bọc trong một "vỏ" ứng dụng máy tính tên **Electron** (cùng công nghệ với Claude, Slack, VS Code). Cơ sở dữ liệu PostgreSQL được **đóng gói chạy ngầm bên trong app**, người dùng không phải cài gì thêm.
2. **Một văn phòng dùng chung một kho dữ liệu.** Một máy trong văn phòng là **máy chính**: giữ cơ sở dữ liệu và tài liệu. Các máy nhân viên khác cài cùng app, **nối vào máy chính qua mạng nội bộ** (cùng Wi-Fi / mạng dây văn phòng). Văn phòng một người thì máy chính là máy duy nhất.
3. **Dựng thêm một "máy chủ dịch vụ" nhỏ của bên mình** trên internet, chỉ cho hai việc: **AI quét giấy tờ** và **danh mục tàu / tra IMO**, cộng chỗ phát bản cập nhật. Khoá AI, khoá nguồn dữ liệu tàu nằm trên máy chủ này, **không bao giờ nằm trong bộ cài**. Máy chủ không lưu dữ liệu thuyền viên.
4. **Chống crack — nói thật:** không phần mềm cài trên máy nào chống crack được 100%. Cách bền nhất là để **phần giá trị nhất chạy trên máy chủ của mình** (AI, danh mục tàu, cập nhật). Bản đầu làm lớp này cùng làm rối code và ký số. **Bản quyền (giấy phép, kích hoạt) để sau**, khi sales chốt cách tính tiền; kiến trúc đã chừa chỗ.
5. **Bảo mật cho người dùng:** mỗi nhân viên một tài khoản, tự khoá khi rời máy; đường truyền giữa các máy trong văn phòng được mã hoá; tài liệu giấy tờ được mã hoá trên ổ đĩa (xem tay qua nút "Mở thư mục hồ sơ"); gửi email bằng app mail sẵn có trên máy; sao lưu tự động có mã hoá; app không gửi dữ liệu ra internet ngoài lúc người dùng chủ động quét giấy tờ / tìm tàu.
6. **Hệ điều hành:** Windows và Ubuntu. Không làm macOS, không làm điện thoại (code giao diện điện thoại hiện có vẫn giữ).
7. **Thời gian ước tính:** 14–17 tuần tới bản chạy thử với vài văn phòng (làm bằng AI, một người).
8. **Chi phí cố định thêm (tham khảo):** chứng thư ký số cho Windows ~200–600 USD/năm (không có vẫn cài được nhưng Windows hiện cảnh báo "Windows protected your PC"; nên mua trước khi bán rộng), máy chủ dịch vụ ~10–40 USD/tháng (cho quét AI và tìm tàu, không liên quan việc cài). Ubuntu không tốn khoản nào.
9. **Điều sếp cần biết đánh đổi:** **máy chính phải bật** thì máy nhân viên mới làm việc được; **không làm việc từ ngoài văn phòng** ở bản đầu; **không dùng trên điện thoại**.

---

## 1. Từ điển nhanh

| Từ | Nghĩa đơn giản |
|---|---|
| **Electron** | Bộ khung biến một trang web thành phần mềm cài trên máy. App là một cửa sổ Chrome thu nhỏ chạy giao diện của mình, cộng với Node.js chạy phần xử lý. |
| **Máy chính** | Máy trong văn phòng giữ toàn bộ dữ liệu. Nên là máy bàn luôn bật. |
| **Máy nhân viên** | Máy cài cùng app nhưng không giữ dữ liệu, chỉ nối vào máy chính để làm việc. |
| **Mạng nội bộ (LAN)** | Mạng Wi-Fi / mạng dây trong văn phòng. Các máy nói chuyện với nhau không cần ra internet. |
| **Ghép máy** | Bước một lần: máy chính hiện mã 6 số, máy nhân viên nhập mã đó để được phép nối vào. |
| **Máy chủ dịch vụ** (cloud) | Máy chủ của bên mình trên internet, chỉ cho quét AI, tìm tàu, phát bản cập nhật. |
| **Mã hoá** | Biến dữ liệu thành chuỗi vô nghĩa, chỉ ai có khoá mới đọc lại được. |
| **Két của hệ điều hành** | Nơi Windows / Ubuntu cất mật khẩu và khoá an toàn, gắn với tài khoản đăng nhập máy (Windows Credential Manager / DPAPI, Ubuntu Keyring). |
| **Ký số bộ cài** | "Đóng dấu" tệp `.exe` để Windows biết nó đến từ công ty mình và chưa bị sửa. |
| **Tự cập nhật** | App tự kiểm bản mới, tải về, cài khi người dùng đồng ý. |
| **Bytecode / làm rối code** | Biến code dễ đọc thành dạng máy hiểu nhưng người rất khó đọc. |
| **Offline / online** | Không có mạng internet / có mạng internet. |

---

## 2. Hiện trạng và những gì phải đổi

App hiện là web: một máy chủ chạy Fastify + PostgreSQL (Docker), người dùng mở bằng trình duyệt, đăng nhập JWT. Bản web chưa có khách thật (Q7), nên không cần chuyển dữ liệu. Đã kiểm trong code:

| Phần | Hiện tại | Khi thành app máy tính |
|---|---|---|
| Giao diện | React 19 + Ant Design, chạy trong trình duyệt | **Giữ nguyên**, chạy trong cửa sổ Electron ở mọi máy |
| Phần xử lý | Fastify, ~12.900 dòng, 20 nhóm API | **Giữ nguyên**, chạy trên **máy chính**, nghe trong mạng nội bộ qua HTTPS (mục 3.2) |
| Cơ sở dữ liệu | PostgreSQL 17, 42 migration, dùng nhiều tính năng riêng của Postgres (`unaccent` 23 chỗ, trigger 29, `ILIKE` 25, `ON CONFLICT` 25, `FOR UPDATE` 28, `jsonb` 16) | **Đóng gói PostgreSQL vào app**, chỉ chạy trên máy chính (Q4) |
| Tệp tải lên (ảnh, PDF giấy tờ) | Thư mục `UPLOAD_DIR` trên máy chủ | Trên máy chính, **được mã hoá** (mục 5.5) |
| Đăng nhập, vai trò, quyền | Nhiều nhân viên, quyền đọc từ DB | **Giữ nguyên và dùng thật**: mỗi nhân viên một tài khoản, quyền như hiện nay |
| AI đọc giấy tờ | Gọi OpenAI / Anthropic bằng khoá trong `.env` | **Chuyển lên máy chủ dịch vụ.** Máy chính gửi ảnh lên, nhận kết quả; máy chủ không lưu ảnh |
| Tra tàu theo IMO | Gọi máy chủ trung gian bằng `VESSEL_API_ENC_KEY` | **Chuyển lên máy chủ dịch vụ.** Khoá không nằm trong app |
| Danh mục tàu thế giới | Bảng `ship_catalog` (~30 MB) nạp vào Postgres | **Để trên máy chủ dịch vụ**, tìm qua mạng. Không đóng gói vào bộ cài (đây là tài sản dữ liệu, đóng gói là cho không) |
| Gửi email | SMTP cấu hình chung trong `.env` | **Mở thư mới trong app mail của máy đang dùng**, điền sẵn và tự đính kèm tệp. SMTP là cách phụ. Mục 8.1 |
| SMS | Webhook trong `.env` | **Tạm bỏ.** Code `sms.service.js` để nguyên, không nối vào app |
| Việc chạy theo giờ (`jobs.js`) | 2h, 3h, 7h sáng và mỗi 5 phút | Chạy trên máy chính khi app mở. Lúc mở app thì **chạy bù** việc bị lỡ |
| Xuất Excel sang PDF | Gọi LibreOffice (`soffice`) cài trên máy chủ | Chạy trên máy chính, có LibreOffice theo Q6 |
| `JWT_SECRET` | Đặt tay trong `.env` | Máy chính tự sinh ngẫu nhiên lần cài đầu, cất trong két hệ điều hành |
| Giao diện điện thoại | Đã làm responsive 375px | **Không phát triển tiếp** (Q2). Code hiện có giữ nguyên, không xoá; vẫn có ích khi thu nhỏ cửa sổ |

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
│  │  Phần xử lý (Fastify hiện có) ── HTTPS trong mạng nội bộ, chỉ máy đã ghép│  │
│  │  PostgreSQL nhúng (chỉ phần xử lý vào được)                              │  │
│  │  Kho tài liệu (đã mã hoá) · Việc theo giờ · Xuất PDF (LibreOffice)       │  │
│  │  Sao lưu tự động (.ssbak, mã hoá) ──► USB / ổ mạng / thư mục Drive       │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│        ▲  HTTPS mã hoá, chứng chỉ được "ghim" lúc ghép máy                      │
│        │                                                                       │
│  ┌─────┴──────────────────┐   ┌────────────────────────┐                       │
│  │ MÁY NHÂN VIÊN 1         │   │ MÁY NHÂN VIÊN 2 …       │                       │
│  │ App SeaSmart (cùng bộ   │   │                        │                       │
│  │ cài), chỉ có giao diện, │   │                        │                       │
│  │ không giữ dữ liệu       │   │                        │                       │
│  │ App mail của máy        │   │                        │                       │
│  └────────────────────────┘   └────────────────────────┘                       │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │ HTTPS, chỉ khi cần (từ máy chính)
┌──────────────────────────────────────▼─────────────────────────────────────────┐
│               MÁY CHỦ DỊCH VỤ CỦA BÊN MÌNH (cloud)                              │
│   • AI quét giấy tờ (giữ khoá OpenAI / Anthropic)                              │
│   • Danh mục tàu thế giới + tra IMO (giữ khoá nguồn tàu)                       │
│   • Nơi phát bản cập nhật đã ký                                                │
│   • Trang quản trị nội bộ: cấp mã văn phòng, khoá mã, xem lượng dùng           │
│   • (Sau) Bản quyền                                                            │
│   Không lưu dữ liệu thuyền viên. Chỉ ghi nhật ký: văn phòng nào, lúc nào, bao nhiêu │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Vì sao Electron:** phần xử lý hiện viết bằng Node.js (Fastify, `sharp`, `@napi-rs/canvas`, `pdfjs`, `exceljs`, `docxtemplater`). Electron có sẵn Node.js nên chạy nguyên code này, và build được cả Windows lẫn Ubuntu. Tauri nhẹ hơn nhưng lõi là Rust, phải kèm Node riêng hoặc viết lại.

### 3.2 Máy chính và máy nhân viên (Q1 = B)

**Một bộ cài cho mọi máy.** Lần đầu mở app hỏi:

- **"Đây là máy chính của văn phòng"** → tạo kho dữ liệu, tạo tài khoản quản trị, in mã khôi phục, đặt sao lưu.
- **"Nối vào máy chính đã có"** → tìm máy chính trong mạng, ghép máy, đăng nhập bằng tài khoản quản trị cấp.

**Ghép máy:**

1. Trên máy chính: Cài đặt → Máy trong văn phòng → **"Thêm máy"** → hiện mã 6 số, hết hạn sau 10 phút.
2. Trên máy nhân viên: app **tự tìm** máy chính trong mạng (hiện tên máy để chọn); không tìm thấy thì gõ tên hoặc địa chỉ máy chính.
3. Nhập mã 6 số → máy nhân viên nhận và **ghim chứng chỉ** của máy chính. Từ đây mọi đường truyền giữa hai máy được mã hoá, và máy nhân viên chỉ tin đúng máy chính đó.
4. Máy chính có danh sách máy đã ghép (tên máy, lần cuối nối, ai đăng nhập); bấm **"Gỡ"** là máy đó không nối được nữa.

**Những gì chạy ở đâu:**

| Việc | Máy chính | Máy nhân viên |
|---|---|---|
| Giao diện, đăng nhập, tự khoá | Có | Có |
| Cơ sở dữ liệu, kho tài liệu | Có | Không |
| Việc theo giờ, thông báo hạn chứng chỉ | Chạy | Nhận thông báo khi mở app |
| Xuất PDF (LibreOffice) | Chạy | Gửi yêu cầu sang máy chính |
| Quét AI, tìm tàu (gọi máy chủ dịch vụ) | Máy chính gọi (cần internet ở máy chính) | Gửi yêu cầu sang máy chính |
| Sao lưu, khôi phục | Có | Không |
| Gửi email (mở app mail) | Có | Có, dùng app mail của máy mình |
| "Mở thư mục hồ sơ" | Có | Có: tải bản giải mã từ máy chính về thư mục tạm của máy mình |

**Máy chính:**

- Nên là **máy bàn luôn bật**, không phải laptop mang đi. Khi app chạy, app xin hệ điều hành **không cho máy ngủ**.
- Cài máy chính cần **quyền quản trị một lần** để mở cổng trên tường lửa Windows (bộ cài làm tự động, chỉ hỏi Yes/No). Máy nhân viên không cần.
- Máy chính tắt hoặc mất mạng nội bộ → máy nhân viên hiện màn **"Không nối được máy chính 'TEN-MAY'. Đang thử lại…"**, kèm hướng dẫn kiểm (máy chính có bật không, cùng mạng không). Không mất dữ liệu đang gõ dở trong form: form giữ nguyên, nối lại thì bấm lưu tiếp.
- Địa chỉ máy chính đổi (router cấp địa chỉ mới) → máy nhân viên tự tìm lại theo tên máy.
- **Chuyển máy chính** sang máy khác: sao lưu trên máy cũ → cài máy mới chọn "máy chính" → "Khôi phục từ bản sao lưu" → ghép lại các máy nhân viên.

**Không làm ở bản đầu:** làm việc từ ngoài văn phòng (ở nhà, đi công tác). Sau này có thể làm qua mạng riêng ảo (VPN) mà không đổi kiến trúc.

### 3.3 Cấu trúc thư mục trong repo

```
seasmart/
├── frontend/     # giữ nguyên, thêm vài màn: thiết lập lần đầu, ghép máy, khoá, cài đặt sao lưu / máy trong văn phòng
├── backend/      # giữ nguyên, thêm chế độ "desktop": đọc cấu hình từ app thay vì .env, nghe HTTPS trong mạng nội bộ
├── desktop/      # MỚI: vỏ Electron, khởi động Postgres, ghép máy, đóng gói, tự cập nhật
└── cloud/        # MỚI: máy chủ dịch vụ (Fastify riêng, Postgres riêng)
```

---

## 4. Quyết định

### 4.1 Đã chốt (2026-11-11)

| # | Câu hỏi | Chốt | Ảnh hưởng tới kế hoạch |
|---|---|---|---|
| **Q1** | Nhân viên có xem chung dữ liệu không? | **B.** Một máy chính trong văn phòng, máy khác nối vào qua mạng nội bộ | Mục 3.2. Thêm giai đoạn 2. Vai trò / quyền dùng thật |
| **Q2** | Có dùng trên điện thoại không? | **Không.** Code giao diện điện thoại hiện có **giữ nguyên, không xoá** | Màn mới chỉ cần chạy tốt trên màn máy tính |
| **Q3** | Hệ điều hành nào? | **Windows và Ubuntu** | Bỏ mọi phần macOS. Bộ cài `.exe` + `.deb` |
| **Q4** | PostgreSQL hay SQLite? | **PostgreSQL** (không chuyển) | Không sửa SQL. Bù việc DB không tự mã hoá: mã hoá tài liệu + yêu cầu mã hoá ổ đĩa máy chính. Lý do: mục 4.3 |
| **Q6** | LibreOffice để xuất PDF | **Không đóng gói.** Máy chính cài bằng một nút "Cài thành phần xuất PDF"; Ubuntu `.deb` tự kéo theo. Không đóng gói Thunderbird, chỉ có nút "Cài Thunderbird" | Mục 4.4, 8.1 |
| **Q5** | Bán theo kiểu nào? | **Việc của sales**, chưa chốt | Không đưa vào kế hoạch kỹ thuật |
| **Q7** | Bản web có khách thật không? | **Không** | Bỏ công cụ chuyển dữ liệu từ web |
| **Q8** | Bản quyền | **Chưa làm.** Xây bản đầu trước, thuê bao hay bán đứt chưa chốt | Bản quyền thành giai đoạn sau (mục 7). Bản đầu chỉ có "mã văn phòng" để mở quét AI / tìm tàu |
| **Q9** | Dùng offline tối đa bao lâu? | **Bỏ câu hỏi.** Câu này chỉ dành cho bản quyền (giấy phép có hạn phải gia hạn qua mạng). Không tính năng nào cần mạng liên tục | Không giới hạn. Mất internet chỉ mất quét AI và tìm tàu |
| **Q10** | Một mã dùng mấy máy? | **Chưa cần**, theo cách tính tiền | Để cùng bản quyền |

### 4.2 Việc còn mở (không chặn giai đoạn 0)

| # | Việc | Ai quyết | Cần trước |
|---|---|---|---|
| **M1** | Tên sản phẩm và biểu tượng trên bộ cài, lối tắt, cửa sổ app (code đang dùng cả "Marineport", "MCAH", "SeaSmart") | Sếp | Giai đoạn 1 |
| **M2** | Máy chủ dịch vụ: dùng lại máy chủ đang chạy bản web hay thuê máy mới | Sếp / bạn | Giai đoạn 3 |
| **M3** | Trang "Tải về" đặt trên website nào, ai làm | Sếp / marketing | Giai đoạn 6 |
| **M4** | Mua chứng thư ký số Windows | Sếp duyệt chi | Phát hành rộng (sau giai đoạn 7) |
| **M5** | Điều khoản sử dụng, Chính sách quyền riêng tư (mục 5.6) | Luật sư | Giai đoạn 4 |
| **M6** | Bỏ quy định 375px trong `CLAUDE.md` mục 3.5 theo Q2 | Bạn | Màn mới đầu tiên |
| **M7** | Sếp đã biết hai đánh đổi: máy chính phải luôn bật; không làm việc từ ngoài văn phòng ở bản đầu | Sếp | Giai đoạn 2 |
| **M8** | Cách tính tiền, bản quyền, số máy (Q5, Q8, Q10) | Sales | Sau bản đầu |

### 4.3 Q4: vì sao từng nhắc tới SQLite

SQLite là cơ sở dữ liệu nằm gọn trong **một tệp**, không cần chạy ngầm. Điểm tốt:

- **Mã hoá được cả cơ sở dữ liệu** (bản SQLCipher): mất máy không bật BitLocker vẫn an toàn. Đây là lý do duy nhất từng nêu.
- Sao lưu = copy một tệp; bộ cài nhẹ hơn chút; không có tiến trình Postgres chạy ngầm.

Điểm dở, nặng hơn nhiều:

- Phải **sửa gần hết câu SQL** (không có `unaccent`, `FOR UPDATE`, `jsonb`, trigger viết khác…), viết lại 42 migration: +4–6 tuần, nguy cơ lỗi cao.
- **Nhiều máy cùng ghi một lúc thì kém.** SQLite chỉ cho một người ghi tại một thời điểm và không được thiết kế để máy khác nối vào qua mạng. Với Q1 = B, đây là điểm loại.

→ **Giữ PostgreSQL.** Để bù việc cơ sở dữ liệu không tự mã hoá: tài liệu giấy tờ vẫn mã hoá (mục 5.5), và app **yêu cầu bật mã hoá ổ đĩa trên máy chính** (BitLocker trên Windows; Ubuntu chọn "mã hoá ổ đĩa" lúc cài hệ điều hành).

### 4.4 Q6: đóng gói LibreOffice vào bộ cài thì bất lợi gì

Ba cách:

| | Nhét LibreOffice vào bộ cài | Máy chính tự tải bằng một nút **(đề xuất)** | Khách tự đi cài |
|---|---|---|---|
| Khách phải làm | Không gì | Bấm "Cài thành phần xuất PDF" một lần lúc thiết lập máy chính (hoặc lần đầu xuất PDF) | Tự tìm, tải, cài |
| Bộ cài | **Nặng thêm ~350 MB**, cho cả máy nhân viên vốn không cần | Nhẹ | Nhẹ |
| Mỗi lần cập nhật app | Nặng theo, hoặc phải tách riêng | Không ảnh hưởng | Không ảnh hưởng |
| Lỗ bảo mật của LibreOffice | **Bên mình phải tự theo dõi và phát bản vá** | LibreOffice tự cập nhật như phần mềm thường | Như cột giữa |
| Giấy phép | LibreOffice cho phép phân phối lại (MPL), phải kèm thông báo bản quyền | Không vấn đề | Không vấn đề |

Cách làm "một nút": Windows tải bộ cài chính thức từ trang LibreOffice rồi cài im lặng (có thanh tiến trình, ~5 phút); Ubuntu khai LibreOffice là gói phụ thuộc của `.deb` nên `apt` tự cài cùng lúc (Ubuntu Desktop thường đã có sẵn). Chưa cài thì vẫn xuất Excel được, nút xuất PDF hiện "Cần cài thành phần xuất PDF — [Cài ngay]".

**Thunderbird: không nên đóng gói**:

- Thunderbird là phần mềm riêng, tự cập nhật bảo mật rất thường xuyên. Đóng gói một bản cố định là để khách dùng bản cũ có lỗ hổng.
- Có Thunderbird rồi khách **vẫn phải tự đăng nhập email** vào đó. Bước khó nhất không biến mất.
- Nhiều khách đã có Outlook. Cài thêm Thunderbird làm họ rối.
- Mozilla có quy định về việc dùng tên Thunderbird khi phân phối kèm.

Thay vào đó: máy chưa có app mail nào thì hiện nút **"Cài Thunderbird"**. Windows: app chạy bộ cài chính thức (qua `winget` của Windows nếu có, không thì mở trang tải). Ubuntu Desktop đã có sẵn Thunderbird. Kèm hướng dẫn đăng nhập Gmail 3 bước.

---

## 5. Bảo mật cho người dùng

Mỗi lớp trả lời câu "chống được chuyện gì".

### 5.1 Khi máy bị người khác mở / bị mất

| Làm gì | Chống được |
|---|---|
| Mỗi nhân viên **một tài khoản**, quyền theo vai trò như hiện nay | Nhân viên xem / sửa thứ không phải việc mình |
| Màn **đăng nhập** khi mở app (mật khẩu bcrypt như hiện tại) | Người dùng chung máy mở app xem trộm |
| **Tự khoá** sau 15 phút không thao tác (chỉnh được 5–60 phút), mở lại bằng mật khẩu | Rời bàn quên tắt |
| **Ảnh và PDF giấy tờ được mã hoá** (AES-256) trên máy chính. Khoá cất trong két hệ điều hành. Muốn xem tay thì dùng nút "Mở thư mục hồ sơ" / "Xuất hồ sơ" (mục 5.5) | Ai đó copy thư mục dữ liệu sang máy khác: mở ra chỉ thấy chuỗi vô nghĩa |
| Máy nhân viên **không giữ dữ liệu** | Mất laptop nhân viên không mất dữ liệu văn phòng; quản trị gỡ máy đó trên máy chính |
| Máy chính: **kiểm ổ đĩa có mã hoá không** (BitLocker / mã hoá ổ đĩa Ubuntu), chưa bật thì hiện hướng dẫn và dải nhắc trong Cài đặt | Mất / bị trộm máy chính: kẻ trộm tháo ổ đĩa đọc cơ sở dữ liệu |
| PostgreSQL nhúng chỉ nghe trong máy chính, mật khẩu ngẫu nhiên, thư mục dữ liệu chỉ tài khoản hệ điều hành chạy app đọc được | Máy khác trong mạng vào thẳng cơ sở dữ liệu |
| Quản trị quên mật khẩu: dùng **mã khôi phục** in ra lúc thiết lập máy chính (12 từ). Nhân viên quên mật khẩu: quản trị đặt lại như hiện nay | Kẻ gian chiếm email rồi đặt lại mật khẩu |

> Giới hạn cần nói rõ: nếu máy chính **không bật mã hoá ổ đĩa** và bị trộm, kẻ trộm có kỹ thuật vẫn đọc được dữ liệu chữ trong cơ sở dữ liệu (tên, số hộ chiếu…). Ảnh giấy tờ thì vẫn an toàn. Vì vậy app phải nhắc bật mã hoá ổ đĩa trên máy chính.

### 5.2 Trong mạng văn phòng và khi app chạy

| Làm gì | Chống được |
|---|---|
| Máy chính chỉ nhận kết nối **HTTPS** từ **máy đã ghép**; chứng chỉ do máy chính tự tạo, máy nhân viên ghim lúc ghép | Người cắm laptop lạ vào Wi-Fi văn phòng để nghe lén hay vào dữ liệu; máy giả làm máy chính |
| Ghép máy bằng mã 6 số hết hạn 10 phút, sai 5 lần thì khoá ghép 15 phút | Đoán mã |
| Mỗi yêu cầu vẫn qua đăng nhập JWT + kiểm quyền như hiện nay | Máy đã ghép nhưng người không có tài khoản |
| Cấu hình Electron an toàn: tách giao diện khỏi Node (`contextIsolation`, `sandbox`, tắt `nodeIntegration`), chính sách nội dung (CSP) chặn script lạ, link ngoài mở bằng trình duyệt hệ thống, tắt DevTools ở bản phát hành | Một đoạn chữ độc trong dữ liệu (vd. tên thuyền viên chứa mã) chiếm quyền máy |
| Chặn trang web lạ trong trình duyệt gọi vào phần xử lý (kiểm nguồn gọi + `Host`) | Trang web độc mở trong trình duyệt của nhân viên gọi lén vào máy chính |
| Giữ các quy tắc hiện có: SQL tham số hoá, `pickAllowed`, kiểm loại và cỡ tệp tải lên, giới hạn tần suất đăng nhập | Dữ liệu nhập vào phá cơ sở dữ liệu; dò mật khẩu |
| Nhật ký (log) **không ghi** dữ liệu cá nhân, xoay vòng 10 MB × 3 tệp | Log lộ thông tin khi gửi cho bộ phận hỗ trợ |

### 5.3 Khi dùng internet

| Làm gì | Chống được |
|---|---|
| Chỉ máy chính gọi ra internet, và chỉ gọi **máy chủ dịch vụ của mình** qua HTTPS | Bị nghe lén / giả máy chủ |
| Chỉ gửi dữ liệu khi **người dùng chủ động** bấm quét giấy tờ hoặc tìm tàu. Lần đầu quét hiện thông báo "ảnh sẽ được gửi lên máy chủ để AI đọc, không được lưu lại" và xin đồng ý | Khách lo dữ liệu bị gửi ngầm |
| Máy chủ **xử lý ảnh trong bộ nhớ rồi xoá**, chỉ ghi: mã văn phòng, thời gian, số trang, chi phí | Rò rỉ từ phía máy chủ của mình |
| Không có theo dõi hành vi (analytics). Báo lỗi (crash report) **chỉ khi người dùng đồng ý**, đã lọc dữ liệu cá nhân | Khách hỏi "app gửi gì về công ty?" |

### 5.4 Không mất dữ liệu (cũng là bảo mật)

Toàn bộ dữ liệu văn phòng nằm trên **một máy chính**: hỏng ổ / mất máy là mất hết. Đây là rủi ro lớn nhất, phải có ngay từ bản đầu:

1. **Sao lưu tự động** trên máy chính mỗi ngày (mặc định 12h trưa, và khi mở app nếu hôm đó chưa sao lưu), ra tệp `.ssbak` đã mã hoá bằng **mật khẩu sao lưu** riêng. Giữ 7 bản theo ngày + 4 bản theo tuần.
2. Quản trị chọn nơi để: ổ USB, ổ mạng công ty, hay một thư mục được Google Drive / OneDrive đồng bộ. Vì tệp đã mã hoá nên để trên Drive vẫn an toàn.
3. Quá 7 ngày chưa có bản sao lưu **ra ngoài ổ đĩa của máy chính** → dải vàng trên đầu app **ở mọi máy** cho tài khoản quản trị.
4. **Khôi phục** trên máy mới: cài app → "Đây là máy chính" → "Khôi phục từ bản sao lưu" → chọn tệp → nhập mật khẩu sao lưu.
5. Trước mỗi lần cập nhật app có đổi cơ sở dữ liệu: tự sao lưu trước, cập nhật lỗi thì tự quay về.
6. Nói rõ trên màn đặt mật khẩu sao lưu: **mất mật khẩu sao lưu là không mở được bản sao lưu**, bên mình cũng không mở được.

### 5.5 Thư mục tài liệu: mã hoá bên trong, xem tay qua thư mục dễ đọc (đã chốt 2026-11-11)

Người dùng muốn tự mở thư mục để tìm, xem, copy tệp như thư mục thường. Nhưng tệp đọc được bằng tay thì không mã hoá được. Cách đã chốt: **kho trong máy chính mã hoá, khi cần xem tay thì app dựng ra một thư mục dễ đọc** trên máy đang dùng.

**Hai lớp:**

| | Kho trong (app dùng) | Thư mục dễ đọc (người xem) |
|---|---|---|
| Ở đâu | Thư mục dữ liệu của app trên máy chính | Bản xem tạm: thư mục tạm của app trên máy đang dùng. Bản xuất: nơi người dùng chọn |
| Mở tay | Không đọc được: tên tệp là mã, nội dung mã hoá, không lộ cả tên thuyền viên | Đọc được, cấu trúc như dưới |
| Ai sửa | Chỉ app | **Chỉ xem và copy.** Sửa, thêm, xoá ở đây không vào app |
| Giữ bao lâu | Mãi (theo quy tắc xoá tệp 180 ngày hiện có) | Bản xem tạm: xoá khi đóng app hoặc sau 24 giờ. Bản xuất: người dùng tự giữ |

**Nút trong app:**

- **"Mở thư mục hồ sơ"** ở trang chi tiết thuyền viên (và tàu, đối tác): app lấy tệp của người đó (từ máy chính, qua đường mã hoá), dựng thư mục xem tạm, đặt chỉ đọc, rồi mở bằng File Explorer / Files.
- **"Xuất hồ sơ ra thư mục"** ở danh sách thuyền viên (chọn nhiều hoặc tất cả) và ở Cài đặt → Sao lưu ("Xuất toàn bộ tài liệu", chỉ quản trị): chọn nơi lưu, app dựng đúng cấu trúc dưới. Trước khi xuất hiện cảnh báo: "Bản xuất **không được mã hoá**. Ai mở được thư mục này là đọc được giấy tờ."
- Hai nút theo quyền xem thuyền viên hiện có; xuất hàng loạt cần quyền riêng (thêm vào `permissions.js`).
- Tệp đính kèm khi gửi mail (mục 8.1) dùng chung cách lấy ra bản tạm này.

**Cấu trúc thư mục dễ đọc:**

```
SeaSmart - Hồ sơ/
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
- Tên tệp = **loại giấy + số giấy (nếu có) + hạn (nếu có)**, ngày dạng `năm-tháng-ngày` để sắp xếp đúng.
- Giữ dấu tiếng Việt. Bỏ ký tự Windows cấm (`\ / : * ? " < > |`). Cắt ngắn để cả đường dẫn dưới 200 ký tự.
- Thư mục thuyền viên luôn kèm mã nên không trùng dù trùng tên. Hai tệp cùng tên trong một thư mục thì thêm ` (2)`, ` (3)`.
- Giấy tờ không ghi đè (quy tắc hiện có): bản mới ở ngoài, bản cũ vào `Bản cũ/`.
- Tệp đã xoá mềm không xuất ra.

**Kho trong** đổi từ `uploads/certificates/<id>/<id>_<giờ>.pdf` hiện nay sang tên mã ngẫu nhiên, mã hoá; vị trí và tên dễ đọc của từng tệp do cơ sở dữ liệu giữ.

### 5.6 Pháp lý (cần hỏi luật sư, không phải việc của code)

- App xử lý dữ liệu cá nhân nhạy cảm (hộ chiếu, CCCD, sức khoẻ, tài khoản ngân hàng thuyền viên). Cần kiểm nghĩa vụ theo Luật Bảo vệ dữ liệu cá nhân và các nghị định hướng dẫn đang hiệu lực.
- Dữ liệu nằm máy khách thì **khách là bên kiểm soát dữ liệu**; bên mình chỉ xử lý khi khách bấm quét AI. Việc gửi ảnh qua nhà cung cấp AI nước ngoài có thể bị coi là **chuyển dữ liệu ra nước ngoài**, cần điều khoản và hồ sơ phù hợp.
- Cần có: Điều khoản sử dụng, Chính sách quyền riêng tư, nút đồng ý lúc thiết lập máy chính.

---

## 6. Bảo vệ sản phẩm (chống crack)

### 6.1 Nói thật về mức độ

App máy tính nào (kể cả Photoshop, Windows) cũng có người crack được. Mục tiêu thực tế:

- **Người dùng phổ thông** không thể dùng các phần có giá trị mà không qua bên mình.
- **Dân crack chuyên nghiệp** tốn nhiều công, và **bản crack mất phần giá trị nhất** nên không đáng bỏ công.

### 6.2 Các lớp và lớp nào làm ở bản đầu

| Lớp | Làm gì | Bản đầu? |
|---|---|---|
| **L1. Giá trị nằm trên máy chủ** | Quét AI, danh mục tàu thế giới, tra IMO, bản cập nhật chỉ phục vụ máy chính có **mã văn phòng** hợp lệ, **do máy chủ tự kiểm**. Danh mục tàu không đóng gói vào bộ cài. Lớp này **không thể bẻ từ phía khách** | **Có** |
| **L5. Khó đọc, khó sửa code** | Gom code thành một khối và nén; chuyển phần xử lý sang **bytecode V8**; bật các "cầu chì" của Electron (cấm chạy như Node thường, cấm gắn trình gỡ lỗi, chỉ nạp code từ gói của app, **kiểm toàn vẹn gói** để sửa một byte là app không chạy); tắt DevTools | **Có** |
| **L6. Ký số + theo dõi** | Ký bộ cài và mọi bản cập nhật; app chỉ nhận bản cập nhật có chữ ký của mình. Máy chủ cảnh báo khi một mã văn phòng dùng bất thường (nhiều nơi, quá dồn dập) | **Có** (ký số Windows khi đã mua chứng thư) |
| **L2. Giấy phép ký số** | Máy chủ ký giấy phép bằng khoá bí mật (Ed25519), app chỉ có khoá công khai để kiểm; gắn với máy chính | Sau (mục 7) |
| **L3. Giấy phép có hạn, tự gia hạn** | Thu hồi được khi không trả tiền / mã bị chia sẻ | Sau (mục 7) |
| **L4. Kiểm ở nhiều chỗ** | Kiểm giấy phép ở vỏ Electron, phần xử lý và máy chủ | Sau (mục 7) |

**Mã văn phòng (bản đầu):** bên mình cấp tay cho từng văn phòng qua trang quản trị nội bộ; quản trị nhập vào máy chính một lần (Cài đặt → Kết nối dịch vụ). Không có mã thì app vẫn dùng đủ phần trong văn phòng, chỉ không quét AI và không tìm tàu. Mục đích: người ngoài không dùng chùa AI (tốn tiền của bên mình), bên mình khoá được văn phòng lạm dụng. Đây cũng là nền để làm bản quyền sau.

**Không làm** (tốn công, dễ bị phần mềm diệt virus báo nhầm, làm khổ khách thật): chống gỡ lỗi kiểu hung hăng, trình điều khiển cấp nhân hệ điều hành, khoá cứng USB.

### 6.3 Bí mật nào tuyệt đối không được nằm trong app

Lỗi phổ biến nhất của app máy tính. Kiểm trước mỗi lần phát hành (có script tự quét bộ cài):

- Khoá OpenAI / Anthropic (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- Khoá nguồn tàu (`VESSEL_API_ENC_KEY`, `VESSEL_API_BASE_URL`)
- Token SMS (`SMS_WEBHOOK_TOKEN`), dù SMS đã tạm bỏ
- Khoá ký bộ cài, (sau này) khoá bí mật ký giấy phép
- Danh mục tàu `ships_plain.db`
- Mọi tệp `.env`

---

## 7. Bản quyền (để sau)

Hoãn theo Q8: xây bản đầu trước; thuê bao hay bán đứt, một mã mấy máy (Q10) do sales chốt. Khi làm, ý đã có:

- Giấy phép gắn với **máy chính** (máy nhân viên không cần giấy phép riêng; giới hạn số máy nhân viên nếu sales muốn tính theo người dùng).
- Lớp L2–L4 ở mục 6.2. Mã văn phòng của bản đầu nâng thành mã kích hoạt.
- Hết hạn thì **chỉ xem và xuất dữ liệu**, không khoá dữ liệu của khách.
- Kiến trúc bản đầu chừa sẵn: một chỗ trong máy chính đọc "trạng thái sử dụng" (hiện luôn là "đầy đủ"), các API ghi dữ liệu đi qua chỗ này; trang quản trị nội bộ đã có danh sách văn phòng.

Ước lượng khi làm: 1–2 tuần.

---

## 8. Tính năng cần internet

| Tính năng | Đi qua máy chủ dịch vụ | Mất internet (ở máy chính) thì |
|---|---|---|
| AI tách và đọc giấy tờ, quét danh thiếp | Có | Vẫn **tải giấy tờ lên và lưu** được, đánh dấu "Chờ đọc"; có mạng lại thì bấm đọc |
| Tìm tàu trong danh mục thế giới, tra IMO | Có | Nút mờ; vẫn **nhập tàu bằng tay** được |
| Gửi email | Không (qua app mail của máy, hoặc SMTP) | App mail tự giữ thư trong Hộp thư đi, có mạng tự gửi. Cách SMTP: thư vào hàng chờ |
| Kiểm và tải bản cập nhật | Có | Bỏ qua |

Không tính năng nào cần internet liên tục. Giao diện: một chỉ báo nhỏ trên thanh trên cùng "Máy chính đang không có internet" khi mất mạng. Không chặn thao tác nào ngoài các nút trên. (Mất **mạng nội bộ** là chuyện khác: mục 3.2.)

### 8.1 Gửi email (đã chốt 2026-11-11)

**Cách chính: mở bằng app mail của máy đang dùng.** Bấm "Gửi mail" (vd. gửi hồ sơ thuyền viên cho chủ tàu ở Cơ hội) → app mở **thư mới trong app mail của máy**, đã điền người nhận, tiêu đề, nội dung và **tự đính kèm** tệp (CV, hồ sơ, giấy tờ; trên máy nhân viên thì lấy từ máy chính về bản tạm). Người dùng xem lại và bấm Gửi trong app mail. Không cần khai báo email hay mật khẩu trong app. Thư đi từ email của chính nhân viên đó.

| Máy | App mail đính kèm tự động được | Cách app mở thư |
|---|---|---|
| Windows | Outlook bản cài kèm Office, Thunderbird | Simple MAPI (cơ chế "Send to → Mail recipient" của Windows) |
| Ubuntu | Thunderbird (có sẵn trên Ubuntu Desktop), Evolution | Lệnh `xdg-email --attach` |

- **Gmail không có app cho máy tính.** Người dùng Gmail thêm tài khoản vào Thunderbird bằng "Đăng nhập bằng Google"; thư vẫn gửi từ địa chỉ Gmail.
- **Outlook bản mới trên Windows 11** có thể không nhận đính kèm từ app khác: kiểm trên máy thật ở giai đoạn 0.
- **Máy không có app mail nào:** app mở thư mới không kèm tệp, **mở sẵn thư mục chứa tệp cần gửi** để kéo thả, và hiện nút **"Cài Thunderbird"** (mục 4.4) kèm hướng dẫn đăng nhập Gmail. Không đóng gói Thunderbird vào bộ cài.
- **Tệp đã mã hoá** (giấy tờ): app giải mã ra bản tạm trong thư mục tạm riêng của app để đính kèm; bản tạm bị xoá khi đóng app hoặc sau 24 giờ.
- **App không biết thư đã gửi thật chưa** vì nút Gửi nằm trong app mail. Sau khi mở thư, app hỏi "Đã gửi thư này chưa?" (Đã gửi / Chưa) để ghi trạng thái ở Cơ hội như hiện nay.

**Cách phụ: gửi thẳng từ app qua SMTP.** Cho người muốn gửi hàng loạt không bấm từng thư. Mỗi nhân viên khai trong Cài đặt → Email gửi đi của mình (chọn Gmail / Outlook / Khác để app tự điền máy chủ, cổng; email; mật khẩu ứng dụng; nút "Gửi thử"). Mật khẩu cất trong két hệ điều hành của máy nhân viên đó, không lưu chữ thường, không gửi sang máy chính trừ lúc gửi thư. Dùng lại `email.service.js` hiện có.

**Cài đặt → Email gửi đi** (theo từng máy): chọn một lần "Mở bằng app mail trên máy" (mặc định khi dò thấy Outlook / Thunderbird) hoặc "Gửi thẳng từ app (SMTP)". Có nút "Thử mở thư" để kiểm.

---

## 9. Phát hành và cập nhật

1. **Website** có trang "Tải về": nút tải bản Windows và bản Ubuntu, số phiên bản, ngày, yêu cầu máy (Windows 10/11 64-bit hoặc Ubuntu 22.04 / 24.04 64-bit; máy chính 8 GB RAM, 10 GB trống; máy nhân viên 4 GB RAM), mã băm SHA-256 của tệp.
2. **Windows: bộ cài `.exe`** (NSIS), tạo lối tắt Desktop / Start Menu. Máy chính hỏi quyền quản trị một lần để mở tường lửa. **Ký số** khi đã mua chứng thư.
3. **Ubuntu: bộ cài `.deb`** (bấm đúp để cài, khai LibreOffice là gói phụ thuộc). Không cần ký số kiểu Windows.
4. Gỡ cài đặt **không xoá dữ liệu** trừ khi người dùng tích "Xoá cả dữ liệu" (có hỏi lại hai lần).
5. **Tự cập nhật** (electron-updater): kiểm khi mở app và mỗi 6 giờ, tải ngầm, hỏi "Khởi động lại để cập nhật?". Hai kênh: **beta** (nội bộ + khách thân) và **ổn định**.
6. **Cùng phiên bản trong văn phòng.** Máy chính cập nhật trước (gợi ý làm ngoài giờ, tự sao lưu trước). Máy nhân viên khác phiên bản với máy chính thì hiện "Máy chính đang ở bản 1.3.0 — Cập nhật để tiếp tục" và tự cập nhật theo.
7. Mỗi bản phát hành có ghi chú thay đổi bằng tiếng Việt hiện trong app.

---

## 10. Lộ trình

Ước lượng cho một người làm bằng AI. Mỗi giai đoạn có "Xong khi". Một commit cho mỗi giai đoạn, trên nhánh `dev`. Thử song song Windows và Ubuntu từ giai đoạn 0 (máy dev đang chạy Ubuntu).

### Lựa chọn kỹ thuật đề xuất (kiểm ở giai đoạn 0)

Đây là thư viện dự kiến, **chưa chắc chạy được**. Giai đoạn 0 kiểm từng cái; cái nào hỏng thì ghi lý do vào mục 13 và đề xuất thay thế.

| Việc | Đề xuất | Điểm phải kiểm |
|---|---|---|
| Vỏ app, đóng gói | Electron + `electron-builder` (NSIS cho Windows, `deb` cho Ubuntu) | Build `.exe` từ máy Ubuntu được không, hay cần máy Windows |
| PostgreSQL nhúng | Gói npm `embedded-postgres` (kèm sẵn bản Postgres cho từng hệ điều hành) | Có extension `unaccent` không; chạy được trong thư mục có dấu tiếng Việt / dấu cách |
| Chạy phần xử lý Fastify | `utilityProcess.fork()` của Electron (tiến trình riêng, không dùng `ELECTRON_RUN_AS_NODE` vì giai đoạn 5 sẽ tắt nó) | `backend/server.js` chạy được nguyên trạng với cấu hình truyền vào |
| Module có phần biên dịch sẵn (`sharp`, `@napi-rs/canvas`, `bcrypt`) | `electron-builder install-app-deps` để dựng lại cho Electron | Có bản dựng sẵn cho Windows x64 và Linux x64 |
| Tự cập nhật | `electron-updater` | — (giai đoạn 6) |
| Tìm máy chính trong mạng | mDNS, gói `bonjour-service` | Wi-Fi văn phòng có chặn mDNS không |
| Chứng chỉ HTTPS tự tạo | Module `crypto` của Node hoặc gói `selfsigned` | Máy nhân viên ghim được chứng chỉ |
| Két hệ điều hành | `safeStorage` có sẵn của Electron (DPAPI trên Windows, Keyring trên Ubuntu) | Ubuntu không có Keyring thì sao |
| Mở thư kèm tệp, Windows | Gọi `MAPISendMail` (Simple MAPI) qua gói `koffi` | Outlook bản Office, Outlook bản mới, Thunderbird |
| Mở thư kèm tệp, Ubuntu | Lệnh `xdg-email --attach` | Thunderbird có nhận tệp đính kèm không |
| Bytecode, cầu chì | `electron-vite` (bytecode plugin) hoặc `bytenode`; `@electron/fuses` | — (giai đoạn 5) |

### Giai đoạn 0 — Thử nhanh (1 tuần)

Code thử đặt trong thư mục mới `desktop/` (sẽ dùng tiếp làm nền cho giai đoạn 1). **Không sửa logic trong `backend/` và `frontend/`**; chỉ được thêm chỗ đọc cấu hình nếu bắt buộc, và ghi lại vào mục 13.

⛔ **DỪNG trước khi bắt đầu:** hỏi người dùng có **máy Windows thật** (hoặc máy ảo Windows) để thử không, và máy thứ hai cùng mạng cho bước 0.6. Không có thì làm các bước trên Ubuntu trước, ghi rõ phần Windows chưa thử.

| Bước | Làm gì | Xong khi |
|---|---|---|
| 0.1 | Dựng `desktop/` tối thiểu: Electron mở bản build của `frontend/` | Cửa sổ app hiện màn đăng nhập |
| 0.2 | Khởi động PostgreSQL nhúng trong thư mục dữ liệu của app (`app.getPath('userData')`), mật khẩu ngẫu nhiên, chỉ nghe `127.0.0.1`; chạy `backend/scripts/migrate.js` vào đó | Đủ 42 migration chạy qua; `SELECT unaccent('Nguyễn')` trả `Nguyen`; tắt app thì Postgres tắt theo, không còn tiến trình mồ côi |
| 0.3 | Chạy Fastify (`backend/server.js`) bằng `utilityProcess.fork()`, cấu hình (DB, `JWT_SECRET` tạm, thư mục tệp) truyền qua biến môi trường của tiến trình con; tạo tài khoản bằng `backend/scripts/seed_admin.js` | Đăng nhập được trong cửa sổ app; danh sách thuyền viên mở được |
| 0.4 | Dựng lại module biên dịch sẵn cho Electron; thử tải ảnh chân dung, tải PDF giấy tờ (cắt trang qua `pdfjs` + `canvas`), xuất Excel | Ba việc chạy không lỗi |
| 0.5 | Đóng gói: `.deb` trên Ubuntu, `.exe` (thử build từ Ubuntu, không được thì build trên máy Windows); cài lên máy sạch | Cài xong mở app, làm lại 0.3–0.4 được; tắt mở lại máy vẫn còn dữ liệu |
| 0.6 | Hai máy cùng mạng: máy 1 cho Fastify nghe thêm địa chỉ mạng nội bộ qua HTTPS (chứng chỉ tự tạo, tạm chấp nhận không ghim); máy 2 chạy app chỉ có giao diện, trỏ tới máy 1. Thử tìm máy 1 bằng mDNS | Máy 2 thấy thuyền viên vừa thêm ở máy 1; ghi mDNS có tìm được không |
| 0.7 | Mở thư kèm 2 tệp (một PDF, một ảnh): Windows qua `MAPISendMail`, Ubuntu qua `xdg-email --attach` | Ghi kết quả với Outlook bản Office, Outlook bản mới, Thunderbird (Windows) và Thunderbird (Ubuntu) |
| 0.8 | Đo và ghi vào bảng "Số đo giai đoạn 0" ở mục 13; ghi thư viện nào trong bảng lựa chọn kỹ thuật không chạy và vì sao | Bảng đủ số |

**Xong khi:** mọi bước trên qua trên cả hai hệ điều hành (hoặc ghi rõ phần chưa thử được); `npm test` của `backend/` và `frontend/` vẫn qua.
⛔ **DỪNG:** báo kết quả thử. Nếu Postgres nhúng có vấn đề nghiêm trọng thì quay lại Q4. Sau đó viết kế hoạch chi tiết giai đoạn 1 (mục "Cách làm việc", ý 3).

### Giai đoạn 1 — Vỏ ứng dụng, một máy (2–3 tuần)

- Thư mục `desktop/`: Electron, khởi động / tắt Postgres an toàn, nạp giao diện.
- `backend/` thêm chế độ desktop: cấu hình từ app (không `.env`), `JWT_SECRET` tự sinh, thư mục tệp trong dữ liệu app.
- Màn **Thiết lập lần đầu** cho máy chính (tạo tài khoản quản trị, mã khôi phục).
- Việc theo giờ: chạy khi app mở + chạy bù. Thông báo hệ điều hành cho hạn chứng chỉ.
- Xuất PDF theo Q6: dò LibreOffice, nút "Cài thành phần xuất PDF".
- Gửi email theo mục 8.1: mở app mail kèm tệp (Windows, Ubuntu), dò app mail, câu hỏi "Đã gửi chưa?", lối kéo thả + nút "Cài Thunderbird" khi không có app mail; giữ SMTP làm cách phụ.
- Ẩn tính năng SMS trong bản desktop (giữ code).
- Gỡ tạm các tính năng cần internet (nối lại ở giai đoạn 3).

**Xong khi:** mọi màn hiện có chạy trong app trên một máy như bản web; test backend và frontend hiện có vẫn qua.

### Giai đoạn 2 — Máy chính và máy nhân viên (3–4 tuần)

- Lựa chọn lúc mở lần đầu: "Đây là máy chính" / "Nối vào máy chính đã có".
- Máy chính: phần xử lý nghe HTTPS trong mạng nội bộ với chứng chỉ tự tạo; mở tường lửa lúc cài; giữ máy không ngủ khi app chạy.
- Ghép máy (mã 6 số, ghim chứng chỉ), tự tìm máy chính trong mạng, Cài đặt → Máy trong văn phòng (danh sách, gỡ máy).
- Máy nhân viên: chỉ giao diện; màn "Không nối được máy chính" và tự nối lại; giữ form đang gõ dở.
- Xuất PDF, quét AI, tìm tàu từ máy nhân viên đi qua máy chính.
- Kiểm cùng phiên bản giữa máy chính và máy nhân viên.
- Rà các chỗ trong code giả định "một người dùng" (vd. sửa cùng một bản ghi từ hai máy) theo cách bản web đang xử lý nhiều người dùng.

**Xong khi:** các testcase nhóm D ở mục 11 qua với 1 máy chính + 2 máy nhân viên (trộn Windows và Ubuntu).

### Giai đoạn 3 — Máy chủ dịch vụ (2 tuần)

- Thư mục `cloud/`: Fastify + Postgres riêng, HTTPS, giới hạn tần suất.
- Chuyển sang đây: AI đọc giấy tờ + quét danh thiếp, danh mục tàu + tra IMO.
- Mã văn phòng (mục 6.2) và trang quản trị nội bộ: cấp / khoá mã, xem lượng quét AI và chi phí theo văn phòng.
- Máy chính gọi các tính năng này qua máy chủ; xử lý mất internet theo mục 8.
- Script quét bộ cài tìm bí mật (mục 6.3), chạy trước mỗi lần phát hành.

**Xong khi:** quét giấy tờ và tìm tàu chạy trong app (cả từ máy nhân viên) qua máy chủ; bộ cài không chứa khoá nào trong mục 6.3; rút internet ở máy chính thì các nút mờ đúng chữ, không lỗi đỏ; mã văn phòng bị khoá thì quét AI bị từ chối.

### Giai đoạn 4 — Bảo mật người dùng (2 tuần)

- Tự khoá, mã khôi phục.
- Thư mục tài liệu theo mục 5.5: chuyển kho tệp sang tên mã + mã hoá, nút "Mở thư mục hồ sơ", "Xuất hồ sơ ra thư mục", quyền xuất hàng loạt, dọn bản xem tạm (cả bản tạm của tệp đính kèm).
- Két hệ điều hành cho khoá và mật khẩu SMTP (khi dùng cách phụ).
- Kiểm và nhắc bật mã hoá ổ đĩa trên máy chính.
- Sao lưu tự động, khôi phục, cảnh báo chưa sao lưu (mục 5.4).
- Cấu hình Electron an toàn, CSP, chặn trang web lạ gọi vào phần xử lý (mục 5.2).
- Màn đồng ý lần đầu quét AI; Điều khoản và Chính sách quyền riêng tư (nội dung do pháp lý soạn).

**Xong khi:** các testcase nhóm B ở mục 11 qua.

### Giai đoạn 5 — Bảo vệ code (1 tuần)

- Gom và nén code, bytecode V8 cho phần xử lý + vỏ, bật cầu chì Electron và kiểm toàn vẹn gói, tắt DevTools.

**Xong khi:** các testcase nhóm C qua; app vẫn chạy bình thường và không bị Windows Defender báo nhầm.

### Giai đoạn 6 — Đóng gói và phát hành (1–2 tuần)

- ⛔ **DỪNG:** xin sếp duyệt mua chứng thư ký số Windows (mục 12) trước bản phát hành rộng. Bản chạy thử ở giai đoạn 7 có thể chưa ký.
- Bộ cài `.exe` và `.deb`, tự cập nhật hai kênh, đồng bộ phiên bản trong văn phòng, trang Tải về trên website, ghi chú phiên bản.

**Xong khi:** tải từ website về máy Windows sạch và máy Ubuntu sạch, cài và chạy được; phát bản 1.0.1 thì văn phòng đang chạy 1.0.0 (máy chính + máy nhân viên) tự nhận và cập nhật, dữ liệu còn nguyên.

### Giai đoạn 7 — Chạy thử với khách (2 tuần)

- Chạy thử với 2–3 văn phòng thân, kênh beta, mỗi nơi ít nhất một máy nhân viên. Thu lỗi, sửa.

**Xong khi:** các văn phòng dùng 2 tuần không mất dữ liệu, không lỗi chặn việc.
⛔ **DỪNG:** báo sếp trước khi mở bán.

**Tổng:** khoảng 14–17 tuần. Bản quyền (mục 7) cộng 1–2 tuần khi sales chốt cách tính tiền.

### Màn giao diện mới cần vẽ wireframe trước khi code

Chọn "máy chính / nối vào máy chính" · Thiết lập lần đầu máy chính · Ghép máy (cả hai phía) · Cài đặt → Máy trong văn phòng · Màn "Không nối được máy chính" · Màn khoá · nút "Mở thư mục hồ sơ" và hộp "Xuất hồ sơ ra thư mục" · Cài đặt → Sao lưu & khôi phục · Cài đặt → Email gửi đi · Cài đặt → Kết nối dịch vụ (mã văn phòng) · Cài đặt → Cập nhật · "Cài thành phần xuất PDF" · dải thông báo (chưa sao lưu / máy chính không có internet / cần cập nhật theo máy chính) · hộp đồng ý lần đầu quét AI. Dựng trên trang Cài đặt và các control `components/ds/` đang có; chỉ cần chạy tốt trên màn máy tính (Q2).

---

## 11. Testcase chính

**Nhóm A — Cài và dùng**

| # | Bước | Kết quả đúng |
|---|---|---|
| A1 | Cài trên Windows 11 sạch và Ubuntu 24.04 sạch, không có Node / Postgres | Cài được, mở app được (Windows chưa ký thì có cảnh báo SmartScreen, bấm "Run anyway") |
| A2 | Rút internet ở máy chính, dùng hết các màn chính | Mọi việc chạy; nút quét / tìm tàu mờ, ghi "Cần kết nối internet" |
| A3 | Tắt app khi đang lưu form, mở lại | Không hỏng dữ liệu, form về trạng thái trước khi lưu |
| A4 | Tắt máy chính đột ngột (rút điện) khi app đang mở | Mở lại app chạy bình thường |
| A5 | Cập nhật lên bản có migration mới | Tự sao lưu trước; dữ liệu còn nguyên |
| A6 | Máy có Outlook (Office) / Thunderbird: bấm "Gửi mail" ở Cơ hội | Mở thư mới đủ người nhận, tiêu đề, nội dung, tệp đính kèm mở được (kể cả giấy tờ đã mã hoá) |
| A7 | Máy không có app mail, bấm "Gửi mail" | Mở thư mới không tệp + mở thư mục chứa tệp + nút "Cài Thunderbird" |
| A8 | Sau khi mở thư, chọn "Đã gửi" / "Chưa" | Cơ hội ghi đúng trạng thái; chọn "Chưa" thì không ghi |
| A9 | Đóng app, kiểm thư mục tạm | Không còn bản giải mã của tệp đính kèm |
| A10 | Chọn cách SMTP, khai Gmail + mật khẩu ứng dụng, bấm "Gửi thử" | Nhận được thư thử; mật khẩu không nằm trong tệp nào của app |
| A11 | Máy chính chưa có LibreOffice, bấm xuất PDF | Hiện "Cần cài thành phần xuất PDF — [Cài ngay]"; cài xong xuất được; xuất Excel luôn được |

**Nhóm B — Bảo mật người dùng**

| # | Bước | Kết quả đúng |
|---|---|---|
| B1 | Để yên 15 phút | App khoá, cần mật khẩu |
| B2 | Copy thư mục dữ liệu máy chính sang máy khác, mở ảnh giấy tờ | Không mở được (đã mã hoá) |
| B3 | Từ trình duyệt mở trang web gọi vào phần xử lý của máy chính | Bị từ chối |
| B4 | Tên thuyền viên chứa `<script>` | Hiện như chữ thường, không chạy |
| B5 | Sao lưu → cài máy mới làm máy chính → khôi phục | Đủ dữ liệu và ảnh |
| B6 | Khôi phục với sai mật khẩu sao lưu | Báo sai, không hỏng gì |
| B7 | Đọc log sau một ngày dùng | Không có tên, số hộ chiếu, số điện thoại |
| B8 | Mở thư mục dữ liệu của app bằng tay | Không thấy tên thuyền viên hay tệp đọc được nào |
| B9 | Bấm "Mở thư mục hồ sơ" của một thuyền viên (trên máy chính và trên máy nhân viên) | Mở đúng cấu trúc mục 5.5, tệp mở được, không sửa được |
| B10 | Đóng app, kiểm thư mục xem tạm | Đã bị xoá |
| B11 | Xuất toàn bộ hồ sơ ra USB | Có cảnh báo không mã hoá; cấu trúc đúng; bản cũ nằm trong `Bản cũ/`; tệp đã xoá không có |
| B12 | Thuyền viên trùng tên, tên có ký tự `/:?` | Hai thư mục khác nhau nhờ mã; ký tự cấm bị bỏ |
| B13 | Nhân viên không có quyền xuất hàng loạt | Không thấy nút xuất nhiều / xuất toàn bộ |

**Nhóm C — Bảo vệ code và máy chủ dịch vụ**

| # | Bước | Kết quả đúng |
|---|---|---|
| C1 | Sửa một byte trong gói app | App không khởi động |
| C2 | Chạy `strings` / tìm chữ trên toàn bộ thư mục cài | Không thấy khoá nào ở mục 6.3 |
| C3 | Mở thư mục cài đặt, tìm code phần xử lý | Không đọc được như mã nguồn |
| C4 | Gọi thẳng API quét AI của máy chủ không kèm mã văn phòng, hoặc mã đã khoá | Bị từ chối |
| C5 | Bấm tổ hợp phím mở DevTools ở bản phát hành | Không mở |

**Nhóm D — Máy chính và máy nhân viên**

| # | Bước | Kết quả đúng |
|---|---|---|
| D1 | Ghép máy nhân viên bằng mã 6 số đúng | Nối được, đăng nhập bằng tài khoản nhân viên |
| D2 | Nhập sai mã 5 lần / dùng mã quá 10 phút | Bị từ chối; sai 5 lần thì khoá ghép 15 phút |
| D3 | Laptop lạ cùng Wi-Fi, chưa ghép, gọi vào máy chính | Bị từ chối |
| D4 | Bắt gói tin trong mạng khi máy nhân viên đang làm việc | Không đọc được nội dung (đã mã hoá) |
| D5 | Gỡ máy nhân viên trên máy chính | Máy đó báo không còn quyền nối |
| D6 | Tắt máy chính khi máy nhân viên đang gõ form | Máy nhân viên báo không nối được, form giữ nguyên; bật lại máy chính thì lưu được |
| D7 | Đổi địa chỉ IP của máy chính | Máy nhân viên tự tìm lại theo tên máy |
| D8 | Hai máy cùng sửa một thuyền viên | Xử lý như bản web hiện nay khi hai người cùng sửa; không hỏng dữ liệu |
| D9 | Máy chính lên bản mới, máy nhân viên còn bản cũ | Máy nhân viên yêu cầu cập nhật rồi mới vào |
| D10 | Quét AI và xuất PDF từ máy nhân viên | Chạy qua máy chính, kết quả như làm trên máy chính |
| D11 | Máy chính Ubuntu, máy nhân viên Windows (và ngược lại) | Chạy như nhau |

---

## 12. Chi phí tham khảo (cần kiểm giá lúc mua)

| Khoản | Ước tính | Ghi chú |
|---|---|---|
| Chứng thư ký số Windows (OV hoặc EV) | ~200–600 USD/năm | Không bắt buộc về kỹ thuật, nhưng thiếu thì Windows cảnh báo khi cài và antivirus hay báo nhầm. Giai đoạn chạy thử với khách thân có thể chưa mua. Chọn loại dùng được trong quy trình build tự động (thiết bị bảo mật hoặc dịch vụ ký trên cloud) |
| Ubuntu | 0 | Không cần ký số kiểu Windows |
| Máy chủ dịch vụ | ~10–40 USD/tháng | Có thể dùng lại máy chủ đang chạy bản web |
| AI đọc giấy tờ | Theo lượt, như hiện nay | Giờ bên mình chịu; sales tính vào giá |
| Tư vấn pháp lý (điều khoản, quyền riêng tư) | Tuỳ | Một lần |

---

## 13. Rủi ro và cách giảm

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Máy chính hỏng ổ / bị mất, cả văn phòng mất dữ liệu | **Cao** | Sao lưu tự động có mã hoá ra ngoài máy + cảnh báo chưa sao lưu (mục 5.4), có ngay từ bản đầu |
| Máy chính tắt / ngủ, cả văn phòng không làm việc được | **Cao** | Khuyên dùng máy bàn luôn bật; app giữ máy không ngủ; màn báo rõ ràng ở máy nhân viên |
| Mạng văn phòng chặn các máy nói chuyện với nhau (Wi-Fi khách, router chặn), tường lửa / antivirus chặn cổng | Trung bình | Bộ cài mở tường lửa; cho gõ tay tên / địa chỉ máy chính; hướng dẫn xử lý; thử ở giai đoạn 0 và 7 |
| PostgreSQL nhúng gặp lỗi trên một số máy (antivirus chặn, đường dẫn có dấu tiếng Việt, tên người dùng có dấu cách) | Trung bình | Thử ở giai đoạn 0 trên nhiều máy; đặt thư mục dữ liệu ở đường dẫn không dấu; ký số giúp antivirus tin |
| Bị antivirus báo nhầm vì làm rối code | Trung bình | Ký số; không dùng kỹ thuật chống gỡ lỗi hung hăng; gửi mẫu cho Microsoft xét nếu bị báo |
| Không làm việc từ ngoài văn phòng được | Trung bình về kinh doanh | Báo rõ cho sales; làm sau qua VPN nếu khách cần |
| Máy chủ dịch vụ sập | Thấp | Chỉ mất quét AI và tìm tàu trong lúc sập; mọi việc khác chạy bình thường |
| Chi phí AI tăng vì bên mình chịu thay khách | Trung bình | Giới hạn tần suất theo mã văn phòng; khoá mã lạm dụng; sales tính vào giá |

### Số đo giai đoạn 0 (điền sau)

| Mục | Windows | Ubuntu |
|---|---|---|
| Dung lượng bộ cài | | |
| Dung lượng sau khi cài | | |
| Thời gian mở app (lần đầu / lần sau) | | |
| RAM máy chính lúc rảnh / lúc quét giấy tờ | | |
| RAM máy nhân viên | | |

---

## 14. Không nằm trong kế hoạch này

- Bản quyền, kích hoạt, cách tính tiền (mục 7; sales chốt).
- macOS, app điện thoại (Q2, Q3). Code giao diện điện thoại hiện có giữ nguyên, không xoá.
- Làm việc từ ngoài văn phòng (VPN).
- SMS: tạm bỏ. Code `sms.service.js` để nguyên, không nối vào app.
- Sao lưu lên máy chủ của bên mình (có thể làm sau, mã hoá đầu-cuối để bên mình cũng không đọc được).
- Mở khoá bằng Windows Hello.
- Chuyển cơ sở dữ liệu sang SQLite (mục 4.3).
- Chuyển dữ liệu từ bản web (Q7: không có khách thật).

## 15. Nhật ký

| Ngày | Giai đoạn | Việc | Ghi chú |
|---|---|---|---|
| 2026-11-09 | — | Lập kế hoạch | Chờ sếp chốt mục 4 |
| 2026-11-11 | — | Chốt cách gửi email | Mở app mail của máy, tự đính kèm; SMTP là cách phụ (mục 8.1) |
| 2026-11-11 | — | Bỏ SMS; chốt thư mục tài liệu | Kho trong mã hoá, xem tay qua "Mở thư mục hồ sơ" / "Xuất hồ sơ", chỉ xem và copy (mục 5.5) |
| 2026-11-11 | — | Chốt Q1–Q10 | Máy chính + máy nhân viên; Windows + Ubuntu; không điện thoại; hoãn bản quyền |
| 2026-11-11 | — | Chốt Q4, Q6 | PostgreSQL; không đóng gói LibreOffice / Thunderbird. Việc còn mở: mục 4.2 |
| 2026-11-11 | — | Bổ sung cách làm việc + bước chi tiết giai đoạn 0 | Các giai đoạn sau viết kế hoạch chi tiết riêng trước khi làm |
