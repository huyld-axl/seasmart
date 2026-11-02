# Quy tắc validate dữ liệu nhập

Nơi duy nhất ghi quy tắc để đối chiếu. Khi đổi quy tắc: sửa bảng dưới, rồi sửa **cả hai** file code (hai bản phải khớp nhau), rồi sửa test.

| Phía | File |
|---|---|
| Máy chủ (chặn cả khi gọi API trực tiếp, trả 400) | `backend/src/utils/field_rules.js` |
| Giao diện (báo lỗi ngay dưới ô, chặn ký tự lạ khi gõ) | `frontend/src/utils/fieldRules.js` |
| Test | `backend/src/utils/__tests__/field_rules.test.js` |

Nguyên tắc chung
- Ô trống luôn hợp lệ (trừ ô bắt buộc, có rule `required` riêng ở form). Chỉ kiểm khi có giá trị.
- Số không bao giờ âm. Ô chỉ nhận số thì giao diện loại ký tự khác ngay khi gõ (`normalize`).
- Giao diện báo lỗi từng ô; máy chủ trả lỗi đầu tiên kèm số lỗi còn lại.
- Giá trị 0 ở chiều cao, cân nặng coi là chưa nhập (dữ liệu cũ).

## Hồ sơ thuyền viên (đã làm)

| Trường | Quy tắc | Thông báo |
|---|---|---|
| Họ và tên, họ tên người thân, tên chủ tài khoản | Không chứa chữ số | Không chứa chữ số |
| Số CCCD, số CCCD người thân | Chỉ chữ số; 12 số (CMND cũ 9 số) | Số CCCD gồm 12 chữ số (CMND cũ 9 chữ số) |
| Số hộ chiếu | 6–20 chữ và số; tự viết hoa | Số hộ chiếu gồm 6–20 chữ và số |
| Số sổ thuyền viên | 3–30 ký tự: chữ, số, `-`, `/`, cách | Số sổ thuyền viên gồm 3–30 chữ, số hoặc dấu - / |
| Size giày | Số 30–55, cho phép `.5` (42, 42.5) | Size giày là số từ 30 đến 55 |
| Size quần | 1–10 ký tự: chữ, số, `/`, `.`, cách (VD 30 / 32) | Size quần chỉ gồm số, chữ, dấu / và dấu chấm |
| Chiều cao | Số nguyên 50–300 cm | Chiều cao từ 50 đến 300 cm |
| Cân nặng | Số nguyên 20–500 kg | Cân nặng từ 20 đến 500 kg |
| Số con | 0–30 | Số con từ 0 đến 30 |
| Số điện thoại (thuyền viên, người thân) | Ký tự `+ 0-9 . - ( )` và cách; 8–15 chữ số | Số điện thoại gồm 8–15 chữ số |
| Email | Dạng `a@b.c` | Email chưa đúng dạng |
| Số BHXH | Đúng 10 chữ số | Số BHXH gồm 10 chữ số |
| Số tài khoản ngân hàng | 6–30 chữ số | Số tài khoản gồm 6–30 chữ số |
| Ngày sinh, ngày cấp hộ chiếu, ngày cấp CCCD (kể cả người thân) | Không sau hôm nay | … không được sau hôm nay |
| Ngày hết hạn hộ chiếu | Không trước ngày cấp | Ngày hết hạn phải sau ngày cấp |
| Ngày cấp CCCD | Không trước ngày sinh | Ngày cấp không được trước ngày sinh |

Chưa chặn: nhập từ giấy tờ đã duyệt (`applyUpdate`), import Excel. Hồ sơ cũ có dữ liệu sai sẽ bị báo lỗi khi sửa và lưu.

Giá trị em tự chọn khi chưa có yêu cầu rõ (cần xác nhận): BHXH đúng 10 số; size giày 30–55; chiều cao 50–300; cân nặng 20–500.

## Đối tác (đã làm)

| Trường | Quy tắc | Thông báo |
|---|---|---|
| Tên công ty | Không chỉ toàn khoảng trắng (bắt buộc đã có sẵn) | Tên công ty không được để trống |
| Mã số thuế | 5–50 ký tự: chữ, số, `- .`, cách (đối tác nước ngoài có thể có chữ) | Mã số thuế gồm 5–50 chữ, số hoặc dấu - . |
| Điện thoại, Fax, điện thoại người liên hệ | `+ 0-9 . - ( )` và cách; 8–15 chữ số | Số điện thoại gồm 8–15 chữ số |
| Email, email người liên hệ | Dạng `a@b.c` | Email phải có dạng ten@congty.com |
| Website | Bắt đầu `http://` hoặc `https://` | Website phải bắt đầu bằng http:// hoặc https:// |

## Tàu (đã làm; IMO, MMSI, số không âm, tối đa độ dài đã có từ trước)

| Trường | Quy tắc | Thông báo |
|---|---|---|
| Tên tàu | Không chỉ toàn khoảng trắng | Tên tàu không được để trống |
| Call Sign | 3–10 chữ và số, tự viết hoa | Call Sign gồm 3–10 chữ và số |
| Năm đóng | 1900 đến năm nay + 10 | Năm đóng không quá … |
| GRT, NT | Số dương, tối đa 1,000,000; NT không lớn hơn GRT | … phải là số dương, không quá … / NT không được lớn hơn GRT |
| DWT | Số dương, tối đa 1,000,000 | như trên |
| LOA | Số dương, tối đa 600 m | như trên |
| Công suất máy | Số dương, tối đa 500,000 kW | như trên |
| Sức chứa hành khách | Nguyên, 0–20,000 | … không quá 20,000 |
| Định biên thuyền viên | Nguyên, 0–10,000 | … không quá 10,000 |

Giá trị 0 ở các ô số của tàu coi là chưa nhập.

## Danh mục: cert, vessel, contract, port, country (đã làm)

| Trường | Quy tắc | Thông báo |
|---|---|---|
| Mã (cert, vessel type, contract type) | 1–30 ký tự: chữ, số, `_ . -`; tự viết hoa | Mã gồm 1–30 chữ, số hoặc dấu _ . - |
| Mã ISO quốc gia | 2 chữ cái (đã có từ trước) | Mã ISO phải gồm 2 chữ cái |
| Tên (VI, EN) | Không toàn khoảng trắng; tối đa 100 ký tự (cert: 200) | Tên không quá … ký tự |
| Cơ quan cấp (cert) | Tối đa 200 ký tự | |
| Hiệu lực (cert) | Số năm nguyên 1–99, trống = vĩnh viễn | Hiệu lực là số năm nguyên từ 1 đến 99 |
| Tên cảng | Bắt buộc, không toàn khoảng trắng, tối đa 150 | Nhập tên cảng |
| UN/LOCODE | 5 ký tự: 2 chữ rồi 3 chữ hoặc số; trống được | UN/LOCODE gồm 5 ký tự: 2 chữ rồi 3 chữ hoặc số |

## Đã có sẵn từ trước (rà soát, không đổi)

Hợp đồng, yêu cầu thanh toán, cơ hội, chuyến tàu, tài khoản, vai trò đã có giới hạn ở backend (JSON schema và kiểm tra trong service) và ở giao diện: tiền không âm trừ dòng điều chỉnh, tối đa 9,999,999,999; ngày bắt đầu không sau ngày kết thúc; ngày lên tàu và ngày thu không sau hôm nay; giới hạn độ dài ghi chú; mật khẩu 8–128 ký tự có chữ và số; email hợp lệ; tên không trống.
