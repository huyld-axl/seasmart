# MCAH — Testcase chạy tay: Báo cáo tháng

- Kế hoạch: `docs/mcah-ke-hoach-bao-cao.md`. Wireframe: `docs/design/wireframes/bao-cao.html`.
- Chạy trên app dev (web, 1440px) trừ nhóm Đ (375px) và nhóm Z (app máy tính). Cột Kết quả ghi: Đạt / Không đạt (kèm mô tả) / Chưa thử.

## Lần chạy tự động 23/11/2026

Đã kiểm bằng test và trên app dev (chưa phải lần chạy tay): bộ số mẫu dưới đây ra đúng số ở B2–B5, C1–C2, L1–L3, L5–L6, G2–G6, G11 (test `report.test.js`); file Excel X2–X6 (đọc lại file bằng exceljs: sheet, tiêu đề, gộp ô, cố định cột, dòng tổng 0); quyền A8–A9, Q3–Q4, Q6 (test route). Trên app dev, tháng 10/2026 dữ liệu thật: 4 báo cáo khớp tổng bảng Trả lương (C3); tên nhóm Dữ liệu tổng hợp dính đúng khi cuộn (G7); 375px không tràn ngang, thẻ đúng (Đ1–Đ4). Cột Kết quả để "Chưa thử" cho lần chạy tay.

## Chuẩn bị

Dựng đúng bộ số mẫu của wireframe (tháng **10/2026**, 6 bill phải thu, kỳ kết thúc trong tháng 10):

| Bill | Đối tác | Thuyền viên | Kỳ | Hạn thu | Trạng thái bill | Thu (HT / ML) | Trả (HT / ML) | Trả lương |
|---|---|---|---|---|---|---|---|---|
| CH2609-02/HĐ/T1 | Hải Âu Shipping | Nguyễn Hữu Phước | 15/10–31/10 | 10/11 | Đã gửi | 1,750 / 500 | 1,380 / 500 | Chưa trả |
| CH2607-01/HĐ/T4 | Hải Âu Shipping | Trần Văn Bình | 01/10–31/10 | 10/11 | Đã thu | 2,300 / 0 | 1,900 / 0 | Đã trả 05/11 |
| CH2605-02/HĐ/T6 | Hải Âu Shipping | Vũ Đức Anh | 01/10–31/10 | 10/11 | Đã gửi | 4,200 / 0 | 3,500 / 0 | Chưa trả |
| CH2607-03/HĐ/T4 | Đông Á Marine | Lê Minh Tâm | 26/09–25/10 | 05/11 | Chưa duyệt | 1,550 / 0 | 1,150 / 0 | Chưa trả |
| CH2608-04/HĐ/T3 | Đông Á Marine | Phạm Quốc Huy | 26/09–25/10 | 05/11 | Đã duyệt | 1,200 / 0 | 950 / 0 | Đã trả 06/11 |
| CH2610-01/HĐ/T1 | Biển Xanh Co. | Đỗ Thành Long | 20/10–31/10 | 20/11 | Đã gửi, quá hạn | 2,800 / 400 | 2,300 / 400 | Chưa trả |

- Kỳ thanh toán hợp đồng: phải thu chốt cuối tháng, trả ngày 10 tháng sau (Hải Âu), chốt ngày 25, trả ngày 5 tháng sau (Đông Á), chốt cuối tháng, trả ngày 20 tháng sau (Biển Xanh), gặp ngày nghỉ làm sau. Phải chi: chốt cuối tháng, trả ngày 15 tháng sau, làm trước; riêng Đỗ Thành Long trả cuối tháng sau, làm trước.
- Tổng tháng 10: **Thu 14,700 · Trả 12,080 · Lãi gộp 2,620**.
- Thêm một bill **ngoài tháng**: kỳ 01/11–30/11 của hợp đồng CH2607-01 (không được có trong báo cáo 10/2026).
- Thêm một bill **đã xoá mềm** có kỳ kết thúc 31/10 (không được có).
- Tài khoản: **KT** có `report.view`, `report.export`, `payout.*`, `bill.*`; **XEM** chỉ có `report.view`; **NGOÀI** có `report.view` phạm vi "chỉ của mình" và chỉ tạo bill của Biển Xanh Co.; **KHÔNG** không có quyền báo cáo nào.

## A. Mở trang, chọn tháng

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| A1 | KT xem menu | Có mục **Báo cáo** trong nhóm Vận hành, ngay sau Trả lương | Chưa thử |
| A2 | Mở Báo cáo lần đầu trong phiên | Thứ tự chọn báo cáo: Dữ liệu tổng hợp, Phải thu theo đối tác, Phải chi theo đối tác, Lịch thu chi. Mở vào Dữ liệu tổng hợp, chưa chọn tháng, "Chọn tháng để xem báo cáo."; nút Xuất Excel tắt | Chưa thử |
| A3 | Chọn 10/2026 | Bảng hiện; URL có `?r=sales&month=2026-10` | Chưa thử |
| A4 | Bấm ›, rồi ‹ | Sang 11/2026 rồi về 10/2026, bảng đổi theo | Chưa thử |
| A5 | Đổi sang Lịch thu chi, sang trang Hợp đồng, quay lại Báo cáo | Vẫn Lịch thu chi, tháng 10/2026 | Chưa thử |
| A6 | Mở link `/reports?r=cost&month=2026-10` | Mở thẳng Phải chi theo đối tác tháng 10/2026 | Chưa thử |
| A7 | Chọn 02/2026 (không có bill) | "Tháng 02/2026 không có yêu cầu thanh toán nào."; nút Xuất Excel bật | Chưa thử |
| A8 | Gọi API `GET /api/v1/reports/sales?month=2026-13` và không có `month` | 200, `rows` rỗng, tổng 0 (không 400) | Chưa thử |
| A9 | Gọi API `GET /api/v1/reports/abc?month=2026-10` | 404 | Chưa thử |

## B. Phải thu theo đối tác

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| B1 | Xem 10/2026 | Đúng 8 cột: STT, Tháng, Đối tác, Khoản hằng tháng, Khoản một lần, Tổng, Số thuyền viên, Tỷ lệ số người. 3 dòng theo thứ tự: Hải Âu Shipping, Biển Xanh Co., Đông Á Marine (Tổng giảm dần) | Chưa thử |
| B2 | Dòng Hải Âu Shipping | Hằng tháng 8,250.00 · Một lần 500.00 · Tổng 8,750.00 · 3 người · 50.00% | Chưa thử |
| B3 | Dòng Đông Á Marine | 2,750.00 · 0.00 · 2,750.00 · 2 người · 33.33% (bill chưa duyệt vẫn được tính) | Chưa thử |
| B4 | Dòng Biển Xanh Co. | 2,800.00 · 400.00 · 3,200.00 · 1 người · 16.67% | Chưa thử |
| B5 | Dòng Tổng cộng | 13,800.00 · 900.00 · 14,700.00 · 6 · 100.00% | Chưa thử |
| B6 | Bill ngoài tháng và bill đã xoá | Không cộng vào dòng nào | Chưa thử |
| B7 | Sửa số Lương cơ bản của bill Lê Minh Tâm 1,400 → 1,300 ở Yêu cầu thanh toán, quay lại | Đông Á Marine 2,650.00; Tổng cộng 14,600.00 (trả lại 1,400 sau khi thử) | Chưa thử |
| B8 | Bấm tên đối tác | Sang chi tiết đối tác | Chưa thử |

## C. Phải chi theo đối tác

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| C1 | Xem 10/2026 | Cùng 8 cột như B1, cột thứ ba tên Đối tác. Hải Âu 6,780 / 500 / 7,280; Biển Xanh 2,300 / 400 / 2,700; Đông Á 2,100 / 0 / 2,100 | Chưa thử |
| C2 | Dòng Tổng cộng | 11,180.00 · 900.00 · 12,080.00 · 6 · 100.00% | Chưa thử |
| C3 | So với màn Trả lương tháng 10/2026, tab Tất cả | Tổng bằng tổng dòng Trả của bảng Trả lương | Chưa thử |
| C4 | Ở Trả lương, sửa ô Lương cơ bản của Vũ Đức Anh 3,500 → 3,400 **nhưng không chốt**, rồi mở Báo cáo (bỏ số sửa) | Báo cáo vẫn 3,500 (số chưa chốt không lưu) | Chưa thử |
| C5 | Chốt trả lương Vũ Đức Anh với 3,400 | Hải Âu Tổng 7,180.00 (huỷ chốt, trả lại 3,500 sau khi thử) | Chưa thử |
| C6 | Hợp đồng chưa nhập cột Phải chi, có bill trong tháng | Đối tác đó vẫn có dòng, tiền 0.00, người được đếm | Chưa thử |

## L. Lịch thu chi

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| L1 | Xem 10/2026 | Đúng 12 cột: STT, Hạn thu, Gộp thu, Đối tác, Thu theo đối tác, Hạn trả, Thuyền viên, Thu kỳ này, Trả kỳ này, Lãi gộp, Kỳ từ, Kỳ đến. **Không có cột trạng thái, mã bill** | Chưa thử |
| L2 | Thứ tự dòng | Lê Minh Tâm, Phạm Quốc Huy (05/11); Nguyễn Hữu Phước, Trần Văn Bình, Vũ Đức Anh (10/11); Đỗ Thành Long (20/11) | Chưa thử |
| L3 | Cột Gộp thu và Thu theo đối tác | Mỗi cột: một ô 2,750.00 gộp 2 dòng; một ô 8,750.00 gộp 3 dòng; 3,200.00 | Chưa thử |
| L4 | Tạm đổi hạn thu bill Đỗ Thành Long thành 10/11 (sửa bill khi chưa duyệt, hoặc dùng dữ liệu thử) | Ngày 10/11: Gộp thu 11,950.00 gộp 4 dòng; Thu theo đối tác tách 8,750.00 (Hải Âu) và 3,200.00 (Biển Xanh). Trả lại sau khi thử | Chưa thử |
| L5 | Cột Hạn trả | 13/11/2026 (15/11 là Chủ nhật, làm trước) cho 5 dòng; 30/11/2026 cho Đỗ Thành Long | Chưa thử |
| L6 | Lãi gộp | Mỗi dòng = Thu kỳ này − Trả kỳ này; dòng tổng 2,620.00 | Chưa thử |
| L7 | Một bill có Trả > Thu (sửa tạm số Trả ở Trả lương rồi chốt) | Lãi gộp âm, chữ đỏ (huỷ chốt sau khi thử) | Chưa thử |
| L8 | Hợp đồng không có kỳ thanh toán Phải chi | Hạn trả "—" | Chưa thử |
| L9 | Nhìn hai cột gộp | Số ở đầu nhóm; kẻ đậm đầu mỗi nhóm gộp từ hai dòng; đầu mỗi ngày kẻ đậm cả dòng; không tô nền, không vạch dọc, không chú thích số dòng | Chưa thử |
| L10 | Nhóm dài (vd. 24 dòng), cuộn xuống giữa nhóm | Số của nhóm vẫn hiện ở mép trên bảng cho tới khi hết nhóm | Chưa thử |

## G. Dữ liệu tổng hợp

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| G1 | Xem 10/2026 | 6 dòng sắp theo đối tác rồi thuyền viên; tiêu đề: Tháng, Số hợp đồng · Thông tin hợp đồng · Yêu cầu thanh toán · Trả lương · Lãi thực tế · Điều kiện phải thu · Điều kiện phải chi · Lãi gộp dự kiến | Chưa thử |
| G2 | Đếm cột, công tắc Hiện 14 khoản tắt | 30 cột. Điều kiện phải thu: Chốt sổ, Ngày thanh toán, Gặp ngày nghỉ, Phải thu hằng tháng, Phải thu một lần, Phải thu tổng; Điều kiện phải chi tương tự. **Không có** chức danh, mã bill, hạn thu, trạng thái | Chưa thử |
| G3 | Bật công tắc | 86 cột: 14 khoản cho Yêu cầu thanh toán, Trả lương, Điều kiện phải thu, Điều kiện phải chi, đúng thứ tự 14 khoản cố định | Chưa thử |
| G4 | Dòng Nguyễn Hữu Phước, bật 14 khoản | Yêu cầu thanh toán: Lương cơ bản 1.500, Phí dịch vụ 150, Khác (hằng tháng) 100, Vé máy bay đi 500; Trả lương: 1.300, Khác (hằng tháng) 80, Vé máy bay đi 500; Lãi thực tế 370 | Chưa thử |
| G5 | Ba cột kỳ thanh toán của Điều kiện phải thu, dòng Lê Minh Tâm | Ngày 25 · Ngày 5 tháng sau · Làm sau | Chưa thử |
| G6 | Điều kiện phải thu / phải chi dòng Nguyễn Hữu Phước (kỳ 1) | Khoản tiền theo hợp đồng: phải thu tổng 2.250 (có Vé máy bay đi 500), phải chi tổng 1.880; Lãi gộp dự kiến 370 | Chưa thử |
| G7 | Một bill kỳ 2 trở đi của hợp đồng có khoản một lần | Điều kiện phải thu / phải chi: khoản một lần là 0 (chỉ kỳ 1 có), Lãi gộp dự kiến chỉ tính khoản hằng tháng | Chưa thử |
| G8 | Sửa tay số bill hoặc số trả lương khác hợp đồng rồi xem lại | Lãi thực tế đổi theo; Điều kiện phải thu / phải chi và Lãi gộp dự kiến giữ theo hợp đồng | Chưa thử |
| G9 | Bật 14 khoản, cuộn ngang từ trái sang phải từ từ | Tháng và Số hợp đồng luôn dính bên trái; tên nhóm đang xem dính ngay sau hai cột đó, nhóm sau đẩy nhóm trước ra | Chưa thử |
| G10 | Cuộn hết sang phải | Cột Lãi gộp dự kiến thấy đủ, tiêu đề không bị cắt; số ở dòng tổng thẳng cột với số trong bảng | Chưa thử |
| G11 | Bấm số hợp đồng | Sang chi tiết hợp đồng | Chưa thử |
| G12 | Dòng tổng | Thu tổng 14.700, Trả tổng 12.080, Lãi thực tế 2.620, Phải thu tổng 14.700, Phải chi tổng 12.080, Lãi gộp dự kiến 2.620 | Chưa thử |
| G13 | Nhìn hai cột Lãi thực tế, Lãi gộp dự kiến | Nổi hơn các cột khác (khung màu nhấn hai bên, số to đậm màu xanh, lỗ đỏ, không tô nền), kể cả ở dòng tổng; kẻ đậm màu nhấn dưới tiêu đề liền với các cột bên cạnh | Chưa thử |

## X. Xuất Excel

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| X1 | Phải thu theo đối tác 10/2026, bấm Xuất Excel | Tải `MCAH_Bao-cao_sales_2026-10.xlsx`; toast "Đã tải …" | Chưa thử |
| X2 | Mở file X1 bằng LibreOffice / Excel | Dòng 1 tên báo cáo, dòng 2 tháng + giờ xuất + người xuất; cột và số giống hệt màn hình; tiền dạng 8,750.00; dòng Tổng cộng đậm; hàng tiêu đề cố định khi cuộn; có nút lọc | Chưa thử |
| X3 | Dữ liệu tổng hợp, công tắc tắt, xuất | File vẫn có đủ 86 cột; tiêu đề nhóm gộp ô; Lãi thực tế, Lãi gộp dự kiến là ô tiêu đề cao hai dòng; cố định hàng tiêu đề và hai cột Tháng, Số hợp đồng | Chưa thử |
| X4 | Lịch thu chi, xuất | Hai cột Gộp thu, Thu theo đối tác gộp ô đúng 2 / 3 / 1 dòng; không có cột trạng thái | Chưa thử |
| X5 | Menu ▾ → Xuất cả 4 báo cáo | Một file `MCAH_Bao-cao_2026-10.xlsx`, 4 sheet theo thứ tự: Du lieu tong hop, Phai thu, Phai chi, Lich thu chi | Chưa thử |
| X6 | Xuất tháng 02/2026 (không có bill) | File có tiêu đề, dòng tổng 0 | Chưa thử |
| X7 | Tắt máy chủ rồi bấm Xuất | Toast đỏ có câu lỗi, không tải file | Chưa thử |
| X8 | Ngày trong file | Định dạng ngày dd/mm/yyyy, lọc / sắp theo ngày được | Chưa thử |

## Q. Quyền và phạm vi

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| Q1 | Sau migration 053 | Vai trò có `payout.view` có thêm `report.view`, `report.export`; phạm vi `report` giống `payout` | Chưa thử |
| Q2 | Ma trận vai trò | Có hàng "Báo cáo" nhóm Vận hành, hai quyền Xem / Xuất Excel | Chưa thử |
| Q3 | XEM mở Báo cáo | Xem được 4 bảng, **không có** nút Xuất Excel | Chưa thử |
| Q4 | XEM gọi thẳng `GET /api/v1/reports/sales/export?month=2026-10` | 403 | Chưa thử |
| Q5 | KHÔNG | Không có menu; mở `/reports` báo không có quyền; API 403 | Chưa thử |
| Q6 | NGOÀI xem Phải thu theo đối tác 10/2026 | Chỉ một dòng Biển Xanh Co. 3,200.00, 1 người, 100.00% | Chưa thử |
| Q7 | NGOÀI xuất cả 4 báo cáo | File chỉ có số của Biển Xanh Co. | Chưa thử |

## Đ. Điện thoại (375px, bản web)

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| Đ1 | Mở Báo cáo, chọn 10/2026 | Không cuộn ngang trang; hàng chọn báo cáo cuộn ngang được | Chưa thử |
| Đ2 | Phải thu theo đối tác | 3 thẻ đối tác (Khoản hằng tháng, Khoản một lần, Tổng, Thuyền viên · tỷ lệ); chân danh sách có Tổng cộng | Chưa thử |
| Đ3 | Lịch thu chi | Thẻ chia nhóm theo hạn thu, đầu nhóm có Gộp thu; thẻ có Thu kỳ này, Trả kỳ này, Hạn trả, Lãi gộp; không nhãn trạng thái | Chưa thử |
| Đ4 | Dữ liệu tổng hợp | Thẻ tổng (6 bill, Thu tổng, Trả tổng, Lãi gộp kỳ) + lời nhắc "Bảng này rộng…" + nút Xuất Excel; không có bảng | Chưa thử |
| Đ5 | Bấm Xuất Excel trên điện thoại | Tải file như máy tính | Chưa thử |
| Đ6 | Về 1440px | Bảng như cũ, không vỡ | Chưa thử |

## Z. App máy tính

| # | Bước | Kết quả đúng | Kết quả |
|---|---|---|---|
| Z1 | Bản `npm run dist:linux`, cài, mở Báo cáo | 4 bảng như bản web | Chưa thử |
| Z2 | Xuất Excel trên app | Hộp lưu file của máy, đúng tên file; mở được | Chưa thử |
| Z3 | Máy nhân viên nối máy chính qua LAN | Xem và xuất được, số như máy chính | Chưa thử |
