# MCAH — Kế hoạch AI tách và đọc giấy tờ

- **Ngày lập:** 2026-10-12
- **Thay cho:** bản kế hoạch lập sáng 12/10 (đã xoá). Phần backend của bản đó đã làm xong; các quyết định và mô hình dữ liệu còn dùng được chép lại ở phụ lục A và B.
- **Nhánh:** `feature/ai-tach-doc-giay-to`, chưa push.
- **Cách làm đã chốt:** đi qua wireframe trước, dựng theo design system đang có (UI Kit và `frontend/src/components/ds/`).

## 0. Tóm tắt

1. Backend đã xong và đã đo bằng AI thật trên 21 tệp mẫu: tách đúng loại 21/21, ô đúng 98%.
2. Giao diện chưa làm. UI Kit hiện có (lập 07/10) chưa có năm màn của tính năng này.
3. Việc còn lại đi theo thứ tự: brief → wireframe → anh chọn → bổ sung design system → dựng thật → kiểm trên trình duyệt → tài liệu.
4. Có hai chỗ phải dừng chờ anh: duyệt brief (cổng 1) và chọn phương án wireframe (cổng 2). Ngoài hai chỗ đó không hỏi.
5. Khối lượng: khoảng **8 ngày làm việc**.

## 1. Đã xong

| Bước | Commit | Kết quả |
|---|---|---|
| G1 | `1d60ae3` | Lớp nhà cung cấp AI, cấu hình, bảng `ai_call` |
| G2 | `a323bf2` | Tệp tải lên, cắt trang, chống trùng, khôi phục khi khởi động lại |
| G3 | `1fbf2f6` | Tầng tách, đổi loại, gom lại trang |
| G4 | `d1b1806` | Khuôn đọc mới, lời nhắc theo việc, chuẩn hoá ngày, chức danh, tên |
| G5 | `2211a02` | `sea_service`, chứng chỉ từ giấy, `publish()` mới, API đi tàu và duyệt |
| G0 | (không có code) | Key chạy qua máy chủ trung gian, đã chọn model |
| G8 | `08b6791` | Vòng đo thử, chỉnh lời nhắc, `scripts/eval_reader.js` |
| — | `ed3dd88` | `docs/samples/` vào `.gitignore` |

Migration 021–024 đã chạy trên DB `marineport` ngày 12/10. Backend: lint không lỗi, 120 test qua (13 test tích hợp chạy khi đặt `INTEGRATION_DB_NAME`).

### Số liệu đo (21 tệp mẫu thật, 12/10)

| Chỉ số | Kết quả |
|---|---|
| Tách đúng loại | 21/21 |
| Ô đúng hoàn toàn | 167/171 (98%) ở lượt chạy đủ; 5 tệp sửa sau cùng đạt 100% |
| Sổ thuyền viên: tàu, chức danh, ngày xuống, ngày rời | Đúng hết, trừ một lần đọc lệch tháng ở chữ viết tay |
| Số chứng chỉ | 8/9 sau khi chuyển sang model mạnh (model nhỏ: 1/9) |
| Số GCNKNCM trong sổ | 7/9 (nhầm 0 và O, 6 và G) |
| Bịa chữ vào ô trống | 0 |
| Thời gian | 25–40 giây mỗi giấy; 21 tệp hết khoảng 4 phút |
| Token | Khoảng 78 nghìn vào, 15 nghìn ra cho 21 tệp |

Chưa quy ra tiền vì chưa có bảng giá của bên trung gian.

## 2. Quyết định đã chốt thêm (12/10)

| # | Nội dung |
|---|---|
| Q8 | Gọi AI qua máy chủ trung gian (`OPENAI_BASE_URL`). Ảnh giấy tờ đi qua máy chủ đó; anh đã chấp nhận |
| Q9 | Không xin Zero Data Retention |
| Q10 | Model nhỏ `gpt-6-luna` cho tách; model mạnh `gpt-6.1-sol` cho sổ **và** chứng chỉ |
| Q11 | Chứng chỉ là giấy ghi nhận thuyền viên đã đạt chứng chỉ, bằng cấp. Mọi thứ không phải chứng chỉ hoặc sổ thuyền viên Việt Nam là "Khác" (tiêm chủng, hộ chiếu, sổ thuyền viên nước ngoài) |
| Q12 | Giấy có nhiều số (Panama): lấy "CT No" |
| Q13 | Giao diện: wireframe trước, theo design system đang có |

## 3. Điều đã biết, giao diện phải tính tới

Những điều này rút ra từ vòng đo, khác với giả định ban đầu:

- **Một ảnh sổ là hai trang mở ra và là một chuyến đi tàu.** Trang trái ghi tàu và chức danh, trang phải ghi cảng và ngày. Khung xem bản gốc phải đủ rộng cho ảnh ngang.
- **Đọc chậm: 25–40 giây mỗi giấy.** Một sổ 10 trang mất vài phút. Tiến độ "đang đọc n/m" là bắt buộc, không phải trang trí.
- **Ô số và chữ dài hay sai một ký tự** (số chứng chỉ, số GCNKNCM). Màn duyệt phải làm cho việc so số với bản gốc thật dễ: phóng to đúng chỗ, chữ số đơn cách.
- **Ngày viết tay có thể đọc lệch.** Ô ngày ở trạng thái "chưa chắc" phải nổi bật và không được chấp nhận hàng loạt.
- **Giấy "Khác" là chuyện thường**, không phải lỗi: tiêm chủng, sổ Panama. Chúng cần hiện rõ nhưng không gây cảm giác có vấn đề.
- **Tên trên giấy nước ngoài đảo thứ tự** (tên trước, họ sau, không dấu). Hệ thống đã coi là cùng người; giao diện không cần cảnh báo.

### API đã có cho giao diện

| Việc | API |
|---|---|
| Tải tệp, trạng thái | `POST` và `GET /documents/seafarer/:id` (trả `ai`, `uploads`, `data`) |
| Ảnh trang | `GET /documents/uploads/:id/pages/:pageNo/image?size=thumb\|full` |
| Tệp gốc, bỏ tệp | `GET /documents/uploads/:id/file`, `DELETE /documents/uploads/:id` |
| Đổi loại, gom trang | `PUT /documents/:id/type`, `POST /documents/uploads/:id/regroup` |
| Duyệt ô | `PUT /documents/:id/fields/:key`, `POST /documents/:id/accept-clear` |
| Đối chiếu tàu, khác người | `PUT /documents/:id/vessel`, `POST /documents/:id/confirm-owner` |
| Chứng chỉ | `POST /documents/certificates/confirm` (trả dòng xác nhận và dòng bị chặn kèm lý do) |
| Đưa vào hồ sơ | `POST /documents/seafarer/:id/publish` |
| Đi tàu | `GET`, `POST /seafarers/:id/sea-services`; `PUT`, `DELETE /sea-services/:id` (bắt buộc lý do) |

## 4. Phạm vi thiết kế: năm màn

| Mã | Màn | Tệp frontend | Việc chính của người dùng |
|---|---|---|---|
| T1 | Khung thả tệp | `seafarers/CrewDropzone.jsx` | Thả tệp và biết nó đang ở bước nào |
| T2 | Kết quả tách | `review/ReviewPage.jsx` (mục 1) | Kiểm AI chia giấy đúng chưa, sửa loại hoặc gom trang |
| T3 | Duyệt sổ thuyền viên | `review/ReviewPage.jsx` (mục 2) | So từng ô với bản gốc, quyết định từng chuyến |
| T4 | Xác nhận chứng chỉ | `review/ReviewPage.jsx` (mục 3) | Xác nhận nhanh loại và hạn của nhiều chứng chỉ |
| T5 | Hồ sơ: Giấy tờ và Đi tàu | `SeafarerDetailPage.jsx` | Xem tệp đã tải, chuyến đi tàu; nhập tay, sửa, xoá kèm lý do |

Ngoài phạm vi: mọi màn khác trong UI Kit, khung app, đăng nhập.

## 5. Thứ tự làm

Mỗi bước một commit riêng. Bước nào có "Cổng" thì dừng chờ anh.

| Bước | Việc | Ngày | Đầu ra | Kiểm bằng gì |
|---|---|---|---|---|
| **W1** | Brief và việc chính của từng màn (skill `ui-ux`, `U1`–`U2`): audit lại `ds/`, liệt kê thành phần dùng lại và thành phần phải thêm | 0,5 | Brief trong tin nhắn | **Cổng 1: anh duyệt brief** |
| **W2** | Wireframe 2–3 phương án khác nhau thật cho T1–T5 (`U3`), nấc xám, đủ trạng thái: đang tải, đang tách, đang đọc n/m, rỗng, lỗi, chưa cấu hình AI | 1,5 | `docs/design/wireframes/nhom-d.html` | **Cổng 2: anh chọn phương án từng màn** |
| **W3** | Bổ sung design system: thành phần mới vào `components/ds/` và `ds.css`; thêm năm màn đã chọn vào UI Kit | 1 | `components/ds/*`, `docs/design/ui-kit/mcah-ui.html` | UI Kit mở được, thành phần mới có đủ trạng thái |
| **B1** | Bù backend cho giao diện (mục 6) | 0,5 | API, test | `npm test` backend |
| **G6a** | Nền frontend: `documentApi.js`, `seaServiceApi.js`, `reviewModel.js`, `statusMap.js`; sửa `vitest.config.js` để `demoDocs.js` không bị coi là bộ test | 0,5 | Code, test | `npm test`, `npm run lint` frontend |
| **G6b** | T1 khung thả tệp | 0,5 | `CrewDropzone.jsx` | Thả tệp thật, thấy tiến độ, tải lại trang không mất |
| **G6c** | T2, T3, T4: màn duyệt ba mục | 2 | `ReviewPage.jsx` tách thành `SplitResult`, `BookReview`, `CertificateTable` | Đi hết luồng với bộ mẫu trên trình duyệt |
| **G7** | T5 hồ sơ: tab Giấy tờ và Đi tàu | 1 | `ProfileUploads.jsx`, `ProfileSeaService.jsx` | Hồ sơ hiện chuyến đi tàu và tệp gốc |
| **K1** | Kiểm cuối: chạy `probe.mjs --sweep` theo wireframe đã chọn, đi hết luồng với 21 tệp mẫu, ghi lỗi còn thấy | 0,5 | Danh sách lỗi và ảnh chụp | Danh sách trống hoặc đã ghi rõ |
| **G9** | README, ghi số liệu cuối vào tài liệu này, hướng dẫn cài và `.env` | 0,5 | Tài liệu | Người khác cài và chạy được |

Tổng khoảng 8 ngày.

### Quy ước cho các bước giao diện

- **Wireframe không dùng dữ liệu cá nhân thật.** Dữ liệu mẫu bịa nhưng giống thật: tên tàu, chức danh viết tắt (OLR, 2/E), ngày kiểu `27.03.18`, số chứng chỉ kiểu `A2949.AF/BNHP`.
- **Dùng lại trước, thêm sau.** `FileDropzone`, `DocumentViewer`, `ReviewField`, `SlidePanel`, `StatusBadge`, `Banner` đã có. Chỉ thêm thành phần khi `ds/` chưa có.
- **Token và class lấy từ `frontend/src/theme/tokens.js` và `ds.css`.** Không thêm mã màu mới.
- **Skill lo hình và trạng thái; việc nối API làm ở G6.**
- **Màn duyệt cũ phải còn chạy** cho đến khi G6c thay nó.

## 6. Bù backend (bước B1)

Các việc nhỏ phát hiện trong lúc làm, cần trước khi dựng giao diện:

| Việc | Vì sao |
|---|---|
| Thêm tóm tắt vào mỗi `uploads[]`: số giấy theo loại, số giấy đang đọc, đã đọc | T1 hiện "Đang đọc 6/10" và "Xong: 5 chứng chỉ, 1 khác" mà không phải tự đếm |
| Cách lưu lựa chọn CMND hay hộ chiếu cho ô "Số GCMND hoặc hộ chiếu" của sổ | Ô này đã bỏ tự đẩy vào hồ sơ nhưng chưa có chỗ lưu lựa chọn của người duyệt. Đề xuất: thêm tham số đích khi chấp nhận ô đó |
| Trả kèm `page_count` và danh sách trang (loại, ghi chú tách) cho T2 | Lưới ảnh thu nhỏ cần biết trang nào thuộc giấy nào |
| Quét giấy kẹt định kỳ, không chỉ lúc khởi động | Hiện giấy kẹt dưới 5 phút phải chờ lần khởi động sau |

Phạm vi B1 chốt lại sau cổng 2, vì phương án wireframe quyết định cần dữ liệu gì.

## 7. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Wireframe đẹp nhưng không khớp dữ liệu thật | Đã có số liệu thật ở mục 1 và 3; dữ liệu mẫu trong wireframe bám theo đó |
| Đọc chậm làm người dùng tưởng treo | T1 hiện tiến độ từng tệp; trang tự hỏi lại 3 giây một lần |
| Người duyệt bấm chấp nhận hàng loạt, bỏ sót số sai | Ô số và ô ngày chưa chắc không nằm trong chấp nhận hàng loạt; quyết định cụ thể ở cổng 2 |
| Bên trung gian chập chờn (đã thấy 3 model hết giờ) | Lời gọi tự thử lại 3 lần; giấy lỗi có nút Đọc lại; cân nhắc key OpenAI trực tiếp cho bản thật |
| `SeafarerDetailPage.jsx` dài 1.168 dòng, sửa dễ vỡ | Tách phần mới ra tệp riêng, không tái cấu trúc phần cũ |
| Đợt thay đổi lớn từng bị revert (09/10) | Mỗi bước một commit; hai cổng duyệt trước khi viết code giao diện |

## 8. Cần anh

| Việc | Cần cho bước |
|---|---|
| Duyệt brief | Cổng 1, sau W1 |
| Chọn phương án wireframe cho từng màn | Cổng 2, sau W2 |
| Rà `docs/samples/ban_doc_chuan.json` (bản đọc chuẩn tôi lập từ ảnh) | K1 |
| Bảng giá của bên trung gian, nếu muốn có số tiền mỗi hồ sơ | G9 |
| Đặt `DB_PASSWORD` và `JWT_SECRET` riêng cho máy chủ thật | Trước khi triển khai |

## 9. Ngoài phạm vi

- Hai mẫu Excel chủ tàu, chính sách liên lạc khi xuất, tính tổng thời gian đi tàu.
- Model chạy tại chỗ.
- Đẩy sang Figma.
- Dọn CSS cũ và tái cấu trúc các màn không thuộc T1–T5.

## Phụ lục A. Quyết định chốt từ đầu (12/10)

| # | Nội dung |
|---|---|
| Q1 | Hai tầng: tách tài liệu rồi đọc theo loại |
| Q2 | Trước mắt hai loại: sổ thuyền viên (đọc từng ô) và chứng chỉ |
| Q3 | Mọi tệp, kể cả loại "Khác", lưu kèm thuyền viên |
| Q4 | Nhà cung cấp AI: GPT. Lớp nhà cung cấp cắm được, giữ Claude, để chỗ cho model chạy tại chỗ |
| Q5 | Chứng chỉ đọc thêm số, ngày cấp, nơi cấp, tên người; người duyệt chỉ bắt buộc xác nhận loại và hạn |
| Q6 | Chấp nhận gửi ảnh giấy tờ lên dịch vụ AI; ứng dụng gửi `store: false` và không ghi nội dung giấy vào nhật ký |
| Q7 | Đo thử bằng ảnh scan thật; bộ mẫu không đưa vào repo |

### Quy tắc xử lý

- Kết quả tách hiện ra cho người dùng, đổi loại được, đổi xong thì đọc lại.
- Chứng chỉ không khớp danh mục: lưu tên như trên giấy, loại để trống, người duyệt chọn tay.
- Chứng chỉ không ghi hạn: hạn rỗng, đánh dấu "không thời hạn".
- Tên hoặc số sổ trên giấy khác hồ sơ đang mở: cảnh báo, chặn đưa vào hồ sơ cho đến khi người duyệt xác nhận.
- Chứng chỉ hai mặt: gom thành một giấy.
- AI không được nhìn danh mục tàu và chức danh khi đọc sổ; khớp danh mục do code làm sau.
- Thiếu key hoặc mã model: báo "AI chưa được cấu hình", không giả kết quả.
- Nút "Đưa vào hồ sơ" chỉ bật khi: không còn giấy đang đọc, mọi ô sổ đã quyết, mọi dòng chứng chỉ đã xác nhận hoặc bỏ, không còn cảnh báo khác người chưa xử lý.

## Phụ lục B. Dữ liệu và trạng thái (đã có trong DB)

| Bảng | Vai trò | Trạng thái |
|---|---|---|
| `document_upload` | Một tệp người dùng thả vào (sha256 chống trùng) | `RECEIVED`, `SPLITTING`, `READING`, `DONE`, `FAILED` |
| `document_upload_page` | Ảnh từng trang, loại AI gán (`split_type`) | — |
| `seafarer_document` | Một giấy sau khi tách (khoảng trang, loại, nguồn loại `AI`/`USER`, cảnh báo khác người, đối chiếu tàu) | `READING`, `REVIEW_REQUIRED`, `COMPLETED`, `FAILED`, `PUBLISHED`, `SKIPPED` |
| `document_field` | Từng ô AI đọc và quyết định của người duyệt | `PROPOSED`, `UNKNOWN`, `DATE_AMBIGUOUS` → `ACCEPTED`, `EDITED`, `UNKNOWN_KEPT`, `REJECTED` |
| `sea_service` | Một chuyến đi tàu (từ giấy hoặc nhập tay) | Đối chiếu tàu: `NOT_CHECKED`, `MATCHED`, `NOT_FOUND` |
| `seafarer_certificate` | Chứng chỉ; thêm `no_expiry`, `certificate_name_raw`, `holder_name_raw`, `source_document_id` | `VALID`, `EXPIRED` |
| `ai_call` | Nhật ký mỗi lần gọi AI (token, thời gian), không có nội dung giấy | `OK`, `ERROR` |

Loại giấy: `seaman_book_info` (8 ô), `seaman_book_duty` (12 ô: tàu, loại, cờ, GT, kW, chủ tàu, chức danh, số GCNKNCM, cảng và ngày xuống, cảng và ngày rời), `certificate` (loại, tên trên giấy, hạn, không thời hạn, số, ngày cấp, nơi cấp, tên người), `other`. Khuôn đầy đủ: `backend/src/constants/document_types.js`.

Giấy "chưa tách" (tệp lỗi khi cắt trang hoặc tách): upload `FAILED` kèm một giấy `FAILED` không có loại; bấm Đọc lại ở giấy đó thì tách lại cả tệp.

Đo lại bất cứ lúc nào (gọi AI thật, tốn tiền): `DB_NAME=marineport_g15 node scripts/eval_reader.js --truth ../docs/samples/ban_doc_chuan.json`
