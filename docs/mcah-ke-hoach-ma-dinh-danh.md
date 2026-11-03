# MCAH — Kế hoạch đổi cách đánh mã (cơ hội · chuyến · hợp đồng · bill)

- **Ngày lập:** 2026-11-02
- **Trạng thái:** chờ duyệt, chưa viết code.
- **Mục tiêu:** nhìn mã là biết nguồn: bill thuộc hợp đồng nào, hợp đồng thuộc chuyến nào, chuyến từ cơ hội nào hay tạo tay. Mã ngắn.

## 1. Quy tắc mã mới

Mã con = mã cha + đuôi. Không có bộ đếm riêng cho chuyến, hợp đồng, bill.

| Loại | Dạng | Ví dụ | Đuôi lấy từ đâu |
|---|---|---|---|
| Cơ hội | `CH` + năm 2 số + số thứ tự | `CH2601`, `CH2699`, `CH26100` | Bộ đếm theo năm (đang có), đệm tối thiểu **2 số**, quá 99 thì tự dài ra |
| Chuyến từ cơ hội | `{mã cơ hội}-{nn}` | `CH2601-01` | Số chuyến đã sinh ra từ cơ hội đó + 1, tối thiểu 2 số |
| Chuyến tạo tay | `CT` + năm 2 số + số thứ tự | `CT2601` | Bộ đếm theo năm, cùng cách đệm như cơ hội. Mã gốc `CT` thay `CH` nên thấy ngay là tạo tay |
| Hợp đồng | `{mã chuyến}/HĐ` | `CH2601-01/HĐ`, `CT2601/HĐ` | Mỗi chuyến chỉ có một hợp đồng (code đã chặn: "Chuyến … đã có hợp đồng …") |
| Bill | `{mã hợp đồng}/{T\|C}{kỳ}` | `CH2601-01/HĐ/T1`, `CH2601-01/HĐ/C2` | `T` = bên thu, `C` = bên chi; kỳ = `seq` đã có trong `contract_bill` |

Năm của mã gốc: cơ hội và chuyến tạo tay lấy năm lúc tạo (cơ hội theo năm tạo; chuyến tạo tay hiện lấy năm của ngày lên tàu, đổi sang năm lúc tạo cho khớp cơ hội).

### Quyết định đã chốt

1. Giữ `/HĐ` đủ ở mọi mã bill để mã không đổi dạng.
2. **Mã cũ giữ nguyên.** Chỉ bản ghi tạo từ nay dùng dạng mới, vì mã cũ đã in vào hợp đồng, bill, hồ sơ gửi đối tác.
3. Bill mới của hợp đồng cũ (`HĐ-2026-0001`): nối đuôi vào mã hợp đồng cũ: `HĐ-2026-0001/T3`. Chuyến cũ không có mã cha thì hợp đồng cũ giữ nguyên.
4. Hợp đồng gia hạn (`/HĐ2`) chưa cần vì một chuyến một hợp đồng. Nếu sau này cho nhiều hợp đồng một chuyến thì thêm đuôi số, các mã đã có không phải đổi.

## 2. Sắp xếp

Mã dài ngắn khác nhau (`CH2699` < `CH26100` về số nhưng đứng sau về chữ) nên **không sắp theo chuỗi mã**.

- Hiện không có danh sách nào sắp theo cột mã: chuyến theo `planned_leave_date, id`, hợp đồng theo `created_at DESC, id DESC`, bill theo `due_date, id`, cơ hội theo `deadline, id`. Giữ nguyên các thứ tự này.
- Bảng nào có cột mã mà thêm sorter theo cột đó sau này thì sorter phải dùng khoá số: `(năm, số thứ tự, đuôi)`, không so chuỗi. Viết một hàm `compareCode(a, b)` ở `frontend/src/utils/` tách mã thành các phần số rồi so từng phần; dùng chung cho mọi bảng.
- Backend: nếu cần `ORDER BY` theo mã thì sắp theo `created_at, id`, không theo cột `code`.
- Ô tìm kiếm: tìm theo mã dùng `ILIKE '%…%'` (đang có ở bill, thêm cho chuyến và hợp đồng nếu chưa có). Gõ `CH2601` ra cơ hội, các chuyến, hợp đồng và bill của nó.

## 3. Phần việc

1. **Migration:** nới `code` / `contract_number` từ `varchar(20)` lên `varchar(32)` cho `opportunity`, `seafarer_voyage`, `seafarer_contract`, `contract_bill` (mã bill dài nhất khoảng 22 ký tự). Không động tới dữ liệu cũ.
2. **`utils/code_counter.js`:** thêm cách đệm "tối thiểu N số, tự dài ra" (đã đúng với `padStart`) và hàm dựng mã con. Gọi thay các chỗ sau:
   - `opportunity.service.js:278, 313` → `CH` + năm 2 số + `padStart(2)`.
   - `voyage.service.js:210` (tạo tay) → `CT` + năm 2 số + `padStart(2)`, năm lúc tạo, kind `VOYAGE_MANUAL`.
   - `opportunity.service.js:468` (chốt) → `{mã cơ hội}-{nn}`; tính nn trong transaction, khoá dòng cơ hội (`FOR UPDATE`) rồi lấy `MAX` đuôi + 1 để hai lần chốt cùng lúc không trùng.
   - `seafarer_contract.service.js:311` → `{voyage.code}/HĐ`.
   - `contract_bill.service.js:85` → `{contract_number}/{T|C}{seq}`. Hàm `insertBill` đã có `side`, `seq`; cần truyền thêm `contractNumber`.
3. **Giao diện:** không đổi bố cục. Mã đã hiện ở cột mã; kiểm chỗ nào cắt chữ ở độ rộng hiện tại (bill dài nhất). Thêm liên kết bấm được từ mã bill → hợp đồng → chuyến → cơ hội nếu trang chi tiết chưa có.
4. **Hướng dẫn trong app:** cập nhật `frontend/public/huong-dan/hop-dong-va-chuyen.html` thêm mục "Cách đọc mã" kèm ví dụ ở bảng mục 1.
5. **Xuất / in:** rà `export_pack.service.js` và mẫu hợp đồng/bill xem có chỗ nào cắt, ép dạng, hoặc tách mã bằng regex (đã grep `src`: không thấy regex đọc mã cũ).

## 4. Testcase

| # | Tình huống | Kết quả mong đợi |
|---|---|---|
| 1 | Tạo cơ hội đầu năm | `CH2601` |
| 2 | Tạo cơ hội thứ 100 trong năm | `CH26100`; cơ hội 99 là `CH2699` |
| 3 | Chốt ứng viên đầu tiên của `CH2601` | chuyến `CH2601-01` |
| 4 | Chốt ứng viên thứ hai (vd thay người) | `CH2601-02` |
| 5 | Hai người chốt cùng lúc trên một cơ hội | hai mã khác nhau, không lỗi trùng |
| 6 | Tạo chuyến tay | `CT2601`, bộ đếm riêng với cơ hội |
| 7 | Tạo hợp đồng cho chuyến `CH2601-01` | `CH2601-01/HĐ` |
| 8 | Tạo hợp đồng cho chuyến tạo tay | `CT2601/HĐ` |
| 9 | Hợp đồng sinh bill thu kỳ 1, bill chi kỳ 1 | `…/HĐ/T1`, `…/HĐ/C1` |
| 10 | Cắt ngắn hợp đồng rồi sinh lại bill | đuôi kỳ theo `seq`, không lặp mã |
| 11 | Hợp đồng cũ `HĐ-2026-0001` sinh bill mới | `HĐ-2026-0001/T3` |
| 12 | Mã cũ trong dữ liệu có sẵn | không bị đổi, vẫn tra cứu được |
| 13 | Tìm `CH2601` ở ô tìm kiếm bill / hợp đồng / chuyến | ra đúng các bản ghi thuộc cơ hội đó |
| 14 | Danh sách có lẫn mã `CH2699`, `CH26100` | thứ tự vẫn theo ngày như cũ, không nhảy theo chữ |
| 15 | `compareCode('CH2699','CH26100')` | `< 0` |
| 16 | Mã dài nhất (`CH26100-100/HĐ/C12`) | vừa cột `varchar(32)`, không bị cắt trên giao diện |

## 5. Thứ tự làm đề xuất

Migration → `code_counter` + 5 chỗ sinh mã kèm test backend → `compareCode` + rà cột mã trên giao diện → trang hướng dẫn. Một commit cho mỗi bước.

## 6. Việc cần bạn duyệt

- Dạng mã ở mục 1 (nhất là dấu `-` cho chuyến, `/` cho hợp đồng và bill).
- Chuyến tạo tay dùng `CT2601` (không có đuôi `-01`).
- Mã cũ giữ nguyên, chỉ bản ghi mới dùng dạng mới.
