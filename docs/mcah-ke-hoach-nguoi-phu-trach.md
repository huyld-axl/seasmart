# MCAH — Kế hoạch Người phụ trách (PIC)

- **Ngày lập:** 2026-11-20
- **Trạng thái:** đã dựng (2026-11-23), chưa nâng phiên bản app máy tính, chờ chạy tay testcase.
- **Mục tiêu:** mỗi việc biết rõ ai phụ trách. Thêm trường **Người phụ trách** vào Thuyền viên, Hợp đồng, Yêu cầu thanh toán (bill). Người phụ trách được kế thừa theo chuỗi **Thuyền viên → Hợp đồng → Bill** khi tạo, và đổi được ở từng bản ghi mà không lan sang bản ghi khác.
- **Wireframe:** `docs/design/wireframes/nguoi-phu-trach.html`. **Testcase:** `docs/mcah-testcase-nguoi-phu-trach.md`. **Hướng dẫn (bản nháp):** `docs/mcah-huong-dan-nguoi-phu-trach.html`.
- **Nhánh:** `dev`. Một commit cho cả tính năng.

---

## 1. Quyết định đã chốt (2026-11-20)

| # | Quyết định |
|---|---|
| P1 | Thuyền viên, Hợp đồng, Yêu cầu thanh toán có **Người phụ trách**. **Đối tác không có** (người dùng đổi ý, 2026-11-20). |
| P2 | Mặc định: PIC thuyền viên → PIC hợp đồng của thuyền viên đó; PIC hợp đồng → PIC bill. |
| P3 | Đổi PIC được ở từng bản ghi. **Không đổi kép**: đổi PIC ở đâu chỉ đổi đúng bản ghi đó, không cập nhật ngược lên, không cập nhật xuôi xuống (đổi PIC thuyền viên không đổi hợp đồng, bill đã có). |

## 2. Quy ước tự chọn (không hỏi, sửa được khi duyệt plan)

| # | Quy ước | Lý do |
|---|---|---|
| D1 | **Kế thừa chỉ xảy ra lúc tạo bản ghi.** Sau khi tạo, PIC là của riêng bản ghi đó. | Đúng P3; dễ giải thích: "lấy theo cha lúc tạo, sau đó độc lập". |
| D2 | **Cơ hội giữ nguyên** trường Người phụ trách sẵn có (mặc định là người tạo), **không nằm trong chuỗi**: chốt người ở cơ hội thì hợp đồng nháp lấy PIC **thuyền viên được chốt**, không lấy PIC cơ hội. | P2 mới lấy thuyền viên làm gốc. |
| D3 | **Thuyền viên mới:** PIC mặc định là người thêm (form) hoặc người nhập (nhập Excel). | Người đưa hồ sơ vào là người nắm thuyền viên. |
| D4 | **Nguồn trống thì lùi một bậc:** hợp đồng ← PIC thuyền viên ← người tạo hợp đồng. Bill ← PIC hợp đồng ← người tạo hợp đồng. Nguồn là tài khoản **đã khoá** cũng bị bỏ qua, lùi tiếp. | Không sinh bản ghi mới thiếu PIC, không giao việc cho người đã nghỉ. |
| D5 | **Bill sinh lại** khi sửa ngày hợp đồng / duyệt lại (`applyPlan`): bill giữ lại hoặc bị cắt kỳ **giữ PIC của nó**; bill mới lấy **PIC hợp đồng lúc đó**. | Không đổi kép; bill mới vẫn theo P2. |
| D6 | **Ai đổi được:** người có quyền sửa của mục đó (`seafarer.update`, `contract.update`, `bill.update`). Không cần quyền xem tài khoản: ô chọn lấy từ API mới `GET /api/v1/users/options` (tài khoản đang hoạt động: id, tên, email). | Ô PIC hiện có ở cơ hội bị khoá với ai không có `account.view`; với các mục mới thì phải mở ra. |
| D7 | **Đổi ở mọi trạng thái**: thuyền viên tạm ngưng, hợp đồng Hiệu lực / Kết thúc, bill đã duyệt / đã gửi / đã thu vẫn đổi PIC được, không cần đưa về nháp hay bỏ duyệt. Đổi PIC **không tính là "sửa"** với luật "người duyệt phải khác người sửa" của bill. | PIC không đụng tiền; khoá tiền vẫn giữ nguyên. |
| D8 | (Sửa 2026-11-23) **Không bắt buộc** ở thuyền viên: ô nằm trong mục **Thông tin chung**, điền sẵn người thêm, xoá được (Chưa giao), không có dòng ghi chú. Form hợp đồng vẫn bắt buộc (điền sẵn theo D4). Form sửa bill có ô Người phụ trách; chỉ đổi người phụ trách thì lưu qua đường đổi PIC, không ghi "Sửa số tiền". | Theo yêu cầu người dùng. |
| D9 | **Phạm vi "chỉ của mình"** (thuyền viên, hợp đồng, bill, trả lương): thấy bản ghi **mình tạo hoặc mình phụ trách**. Giấy tờ, chứng chỉ… của thuyền viên đi theo thuyền viên như hiện tại. | Giao việc cho người có phạm vi hẹp thì họ phải thấy được việc đó. |
| D10 | Đổi PIC ghi **lịch sử** ở chỗ sẵn có: thuyền viên (`seafarer_revision`, như mọi lần sửa hồ sơ), hợp đồng (`contract_approval_log`), bill (`contract_bill_log`). | Truy được ai giao việc cho ai. |
| D11 | Đổi PIC thuyền viên **không** đẩy bộ giấy đang ký sang "Cần làm lại". | PIC không in ra giấy tờ. (Lúc dựng: code hiện không còn chỗ nào chuyển bộ giấy sang Cần làm lại khi sửa hồ sơ, nên không cần làm gì.) |
| D12 | Hiển thị **tên** (`full_name`), không có thì email. Tài khoản đã khoá vẫn hiện tên kèm nhãn "Đã khoá", không có trong ô chọn. | Dễ đọc; thấy ngay việc đang treo ở người đã nghỉ. |
| D13 | **Danh sách** Thuyền viên, Hợp đồng, Yêu cầu thanh toán: cột **Phụ trách** (máy tính) và bộ lọc **Người phụ trách** có hai mục đầu "Tôi", "Chưa giao". Thẻ điện thoại chỉ thêm ô Phụ trách khi thẻ còn dưới 4 ô; bộ lọc có ở cả điện thoại. | Trả lời nhanh "việc của tôi" và "việc chưa ai nhận". |
| D14 | Đổi PIC trên **chi tiết** bằng chữ "Đổi" cạnh tên ở đầu trang → hộp nhỏ một ô chọn người (`Modal` + `SearchSelect` sẵn có). Thuyền viên và hợp đồng nháp còn có ô trong form sửa. | Hợp đồng đã duyệt, bill đã duyệt không mở form sửa được; một chỗ đổi chung cho mọi trạng thái. |
| D15 | KPI / Tổng quan **không đổi**: vẫn ghi công theo PIC cơ hội. | Không thuộc yêu cầu này. |
| D16 | Không làm **đổi hàng loạt** (vd. nhân viên nghỉ, chuyển hết việc). Lọc theo người rồi đổi từng bản ghi. | Chưa được yêu cầu. |

---

## 3. Dữ liệu — migration `054_person_in_charge.sql`

```sql
-- Người phụ trách (PIC) của thuyền viên, hợp đồng, bill. Cơ hội giữ cột owner_user_id sẵn có, không nối chuỗi.
ALTER TABLE "seafarer"          ADD COLUMN "pic_user_id" INTEGER REFERENCES "user" ("id");
ALTER TABLE "seafarer_contract" ADD COLUMN "pic_user_id" INTEGER REFERENCES "user" ("id");
ALTER TABLE "contract_bill"     ADD COLUMN "pic_user_id" INTEGER REFERENCES "user" ("id");
CREATE INDEX "seafarer_pic_idx"          ON "seafarer" ("pic_user_id")          WHERE "deleted_at" IS NULL;
CREATE INDEX "seafarer_contract_pic_idx" ON "seafarer_contract" ("pic_user_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "contract_bill_pic_idx"     ON "contract_bill" ("pic_user_id")     WHERE "deleted_at" IS NULL;

-- Bù dữ liệu cũ (theo thứ tự cha → con, cả bản ghi đã xoá mềm):
-- 1. Thuyền viên: created_by; không có thì NULL ("Chưa giao").
-- 2. Hợp đồng: PIC thuyền viên của hợp đồng → created_by của hợp đồng.
-- 3. Bill: PIC hợp đồng.
-- Cuối migration in số thuyền viên / hợp đồng / bill còn NULL.

-- Log: contract_approval_log.action và contract_bill_log.action thêm 'ASSIGN'; payload = { from, to }.
```

Cột nullable: dữ liệu cũ có thể thiếu (D8). Thử migration trên bản sao DB trước (luật Migration data safety), chạy lại trên DB đã có để chắc không ghi đè.

## 4. Backend

### 4.1 Chọn người

- `GET /api/v1/users/options` (đăng nhập là gọi được): `[{ id, full_name, email }]` các tài khoản `is_active = 1`, chưa xoá, sắp theo tên.
- `utils/pic.js`: `resolvePic(conn, candidates)` lấy người đầu tiên còn hoạt động trong danh sách (D4); `assertAssignable(conn, userId)` → 400 "Tài khoản không tồn tại hoặc đã khoá".

### 4.2 Theo từng mục

| Mục | Tạo | Sửa / đổi | Trả về |
|---|---|---|---|
| Thuyền viên (`seafarer.service.js`, `import.service.js`) | `pic_user_id` trong form, bắt buộc; API thiếu thì người tạo. Nhập Excel: người nhập | Trong `PUT` cùng các trường khác (ghi `seafarer_revision`, không đẩy bộ giấy sang Cần làm lại — D11) và `PUT /seafarers/:id/pic` cho chữ Đổi | `pic: { id, name, is_active }` ở list + detail |
| Hợp đồng (`seafarer_contract.service.js`) | `createForVoyage` (dùng chung tạo tay và chốt cơ hội) nhận `pic_user_id`; thiếu thì D4 (PIC thuyền viên của chuyến) | `PUT /contracts/:id/pic` (`contract.update`, mọi trạng thái) + log `ASSIGN`. Form sửa nháp cũng nhận trường này | `pic` ở list + detail |
| Bill (`contract_bill.service.js`) | `insertBill` nhận `picUserId`; `generateForContract` và `applyPlan` truyền PIC hợp đồng (D5) | `PUT /bills/:id/pic` (`bill.update`, mọi trạng thái) + log `ASSIGN`; không đổi `updated_by` dùng cho luật duyệt (D7) | `pic` ở list + detail |
| Cơ hội | Không đổi | Không đổi | Không đổi |

- Lọc danh sách: `pic_user_id=<id>` hoặc `pic_user_id=none` (Chưa giao).
- Phạm vi own (D9): `plugins/access.js` `ownFilter` và `utils/scope.js` `assertRecordInScope` đổi thành `created_by = ? OR pic_user_id = ?` cho `seafarer`, `seafarer_contract`, `contract_bill`; trả lương đi theo bill.
- Mô tả quyền trong `constants/permissions.js`: `contract.update` thêm "đổi người phụ trách"; `bill.update` thêm "đổi người phụ trách (mọi trạng thái)".

## 5. Giao diện

Theo wireframe. Không có control mới: ô chọn người là `SearchSelect`, hộp đổi là `Modal` một ô.

- **Hook** `useUserOptions()` (React Query, khoá `['users', 'options']`), dùng chung.
- **Form thuyền viên:** ô Người phụ trách ở cuối mục **Thông tin chung** (sau Số con), không bắt buộc. Thêm mới điền sẵn là mình. Mục Ghi chú giữ nguyên.
- **Form sửa bill:** ô Người phụ trách cạnh Hạn thanh toán.
- **Bảng trả lương:** cột Đối tác, dòng Thu hiện tên người phụ trách bill ("—" khi chưa giao), dòng Chi là tên đối tác.
- **Hồ sơ thuyền viên** (`ProfileOverview`): đầu trang thêm "Phụ trách: Tên · Đổi".
- **Hộp chốt người (`PlaceModal`):** không thêm ô; hợp đồng nháp tạo ra theo PIC thuyền viên. Thông báo sau chốt ghi "Hợp đồng … · Phụ trách: …".
- **Form hợp đồng** (tạo tay / sửa nháp): ô "Người phụ trách" ở nhóm thông tin chung, điền sẵn theo D4.
- **Đầu trang chi tiết** hợp đồng, bill: cặp "Phụ trách: Tên · Đổi". Không có quyền sửa thì không có chữ Đổi. Hộp **Đổi người phụ trách**: ô chọn người, dòng nhắc "Chỉ đổi {bản ghi này}. {Hợp đồng / bill} đã có giữ người phụ trách của chúng." Lưu xong toast "Đã giao cho …".
- **Danh sách** Thuyền viên (`CrewFilters` sẵn có), Hợp đồng, Yêu cầu thanh toán: cột Phụ trách, bộ lọc Người phụ trách (D13).
- Nhãn "Đã khoá" dùng `Tag` xám sẵn có trong `statusMap.js` (nhóm `account`).

## 6. Các bước dựng

Mỗi bước chạy lint + test phần vừa sửa. Gộp thành một commit trước khi push.

| Bước | Việc | Xong khi |
|---|---|---|
| 1 | Migration `054_person_in_charge.sql` | Chạy sạch trên DB trống và bản sao DB; đúng thứ tự bù mục 3; chạy lại không đổi gì |
| 2 | `users/options`, `utils/pic.js` + test | Tài khoản khoá không có trong danh sách; gán người khoá → 400 |
| 3 | Thuyền viên: tạo / sửa / nhập Excel / đổi / lọc + test | Thêm không gửi PIC → người tạo; đổi PIC ghi lịch sử hồ sơ, bộ giấy đang ký không chuyển Cần làm lại |
| 4 | Hợp đồng: `createForVoyage`, `PUT /pic`, log, lọc + test | Chốt cơ hội → hợp đồng nháp theo PIC thuyền viên (không theo PIC cơ hội); đổi PIC hợp đồng Hiệu lực được; thuyền viên, bill không đổi |
| 5 | Bill: `insertBill`, `applyPlan`, `PUT /pic`, log, lọc + test | Duyệt hợp đồng → mọi bill theo PIC hợp đồng; sửa ngày → bill cũ giữ PIC, bill mới theo PIC hợp đồng; đổi PIC rồi duyệt bill bởi chính người đó vẫn được |
| 6 | Phạm vi own (D9) + test route | Tài khoản "chỉ của mình" thấy và mở được thuyền viên / hợp đồng / bill mình phụ trách nhưng không tạo; bản ghi khác vẫn 404 |
| 7 | Frontend: hook, form thuyền viên / hợp đồng, hộp Đổi, đầu trang hồ sơ / chi tiết, cột + lọc 3 danh sách | Chạy thử với dữ liệu mẫu wireframe; 375px không cuộn ngang; 1440px đúng |
| 8 | Hướng dẫn: chép `docs/mcah-huong-dan-nguoi-phu-trach.html` vào `frontend/public/guide/index.html`, sửa mục Thuyền viên, Hợp đồng, Yêu cầu thanh toán | Mục lục thấy mục mới |
| ⛔ | **DỪNG** — chạy tay `docs/mcah-testcase-nguoi-phu-trach.md`, ghi kết quả | Mọi ca Đạt hoặc có ghi chú |
| Z | Build app máy tính `npm run dist:linux` (luật phiên bản trong `docs/mcah-quy-trinh-phat-hanh.md`) | Build thành công |

## 7. Không làm lần này

- Người phụ trách cho **Đối tác** (bỏ theo yêu cầu 2026-11-20), **Chuyến tàu**, **Trả lương** (trả lương đi theo bill, chuyến đi theo hợp đồng).
- Nối PIC cơ hội vào chuỗi (D2).
- Đổi hàng loạt / chuyển hết việc của một người (D16).
- Thông báo cho người được giao (email, chuông).
- Nhiều người phụ trách cho một bản ghi.

## 8. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-11-20 | — | — | Lập kế hoạch, wireframe, testcase, bản nháp hướng dẫn với chuỗi Đối tác → Cơ hội → Hợp đồng → Bill. |
| 2026-11-20 | — | — | Người dùng đổi chuỗi thành **Thuyền viên → Hợp đồng → Bill**, bỏ PIC đối tác. Cơ hội giữ trường sẵn có, ngoài chuỗi. Sửa lại cả 4 tài liệu. D1–D16 chờ duyệt. |
| 2026-11-23 | 1–8 | xem git log | Người dùng duyệt D1–D16. Dựng xong; migration đổi số thành `054` (053 đã dùng cho quyền báo cáo). Thêm: chuyến trả `seafarer_pic_user_id` để form hợp đồng điền sẵn; Tổng quan (việc cần làm, chứng chỉ sắp hết hạn) cũng tính phạm vi "tạo hoặc phụ trách". Migration chạy thử trên DB dev (rollback) rồi áp: 56/63 thuyền viên Chưa giao (nhập cũ không có người tạo). Backend 655 test, frontend 519 test. Kiểm trên app dev: lọc Tôi, đổi PIC hợp đồng Hiệu lực (bill giữ người cũ), đổi PIC thuyền viên (lịch sử hồ sơ ghi tên), form 375px, bộ lọc bill trên điện thoại. Chưa chạy tay testcase. |
| 2026-11-23 | Z | — | Đã build thử Ubuntu 0.9.12 (thành công) nhưng người dùng bảo dừng và trả về 0.9.11: bỏ ghi chú phát hành và bộ cài 0.9.12. Khi phát hành, nâng phiên bản theo `docs/mcah-quy-trinh-phat-hanh.md`. |
| 2026-11-23 | — | — | Theo góp ý: ô người phụ trách thuyền viên chuyển lên Thông tin chung, bỏ bắt buộc và dòng ghi chú; thêm ô vào form sửa bill; bảng trả lương hiện người phụ trách ở dòng trên cột Đối tác. |
