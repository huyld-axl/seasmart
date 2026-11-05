# MCAH — Testcase tay: màn Tổng quan

- **Plan:** `docs/mcah-ke-hoach-tong-quan.md` (bước 9).
- **Wireframe:** `docs/design/wireframes/tong-quan.html` (lần 4).
- **Chuẩn bị:** DB dev có ít nhất 3 tài khoản:
  - **QL**: có `kpi.view_all`, `kpi.manage`, phạm vi Toàn bộ.
  - **MG1**, **MG2**: không có `kpi.view_all`, phạm vi Của mình.

  Ngày máy chủ ghi ở cột "Hôm nay" khi case cần.
- **Ghi kết quả:** cột Kết quả điền Đạt / Không đạt + ghi chú ngắn.
- **Lần chạy 04/11/2026:** case dữ liệu chạy trên DB dev trong một transaction rồi rollback (không đổi dữ liệu); case giao diện chạy trên trình duyệt bằng tài khoản demo (quản trị viên). 58 Đạt, 5 Chưa chạy (A2, C10, E3, E4 cần tài khoản khác; D5 không chạy riêng), 0 Không đạt (A3 đã sửa).

## A. Bố cục và vừa màn hình

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| A1 | QL mở Tổng quan ở cửa sổ 1440×900 | Thấy lời chào, thẻ Doanh thu, thẻ Hợp đồng mới ký, khối Cần chú ý; **trang không có thanh cuộn dọc** || Đạt (1440×900, không cuộn, lưới 788px) |
| A2 | MG1 mở Tổng quan ở 1440×900 | Thẻ đầu là "Hợp đồng bạn ký", thẻ hai "Doanh thu của bạn"; không cuộn || Chưa chạy: DB dev chỉ có tài khoản quản trị. Có test tự động cho màn môi giới |
| A3 | Thu cửa sổ còn 1280×720 | Vẫn không cuộn; danh sách Cần chú ý hiện ít dòng hơn, link góc ghi "còn n ẩn" đúng số || Đạt sau khi sửa (lần đầu cuộn 12px do chiều cao tối thiểu 620px; hạ còn 520px). 3 dòng, "còn 7 ẩn" |
| A4 | Kéo cửa sổ cao 1440×1200 | Danh sách hiện thêm dòng, số "còn n ẩn" giảm || Đạt (7 dòng, "còn 3 ẩn") |
| A5 | Thu hẹp dưới 1024px | Các khối xếp dọc, trang cuộn, mỗi tab hiện 5 dòng || Đạt (900px: 1 cột, 5 dòng) |
| A6 | Mở trên điện thoại (375px) | Không tràn ngang; tab thành nút "Mục:"; số KPI vẫn đọc rõ || Đạt (375px không tràn, ô "Mục:") |

## B. Thẻ Doanh thu

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| B1 | Tạo hợp đồng 1.000 USD/tháng phải thu, 0 phải chi, 16/11 → 15/05, duyệt | Tháng 11 cộng thêm 500 USD (15/30 ngày) vào số dự kiến || Đạt (DB dev, transaction rollback): 500 |
| B2 | Hợp đồng phải thu 1.500, phải chi 1.200 / tháng, trọn tháng 12 | Tháng 12 cộng 300 USD || Đạt (DB dev, transaction rollback): 300 |
| B3 | Hợp đồng có khoản một lần phải thu 200, phải chi 50, bắt đầu 20/11 | Tháng 11 cộng thêm 150 USD (ngoài phần hằng tháng) || Đạt (DB dev, transaction rollback): 150 |
| B4 | Hợp đồng `DRAFT`, `PENDING`, `REJECTED` | Không tính vào doanh thu || Đạt (DB dev, transaction rollback) |
| B5 | Hợp đồng `ENDED` sau khi Ghi rời tàu sớm (kết thúc 10/11) | Tháng 11 chỉ tính tới 10/11 || Đạt (DB dev, transaction rollback): 1.000 |
| B6 | Xem cột "Tháng này" | Cột gạch chéo, nhãn trục "Tháng này", dòng nhỏ "đã ghi nhận … USD tới hôm nay" nhỏ hơn số dự kiến || Đạt (DB dev, transaction rollback) |
| B7 | Đặt mục tiêu công ty cao hơn dự kiến | Nhãn vàng "Thiếu {n} USD", đường nét đứt trên biểu đồ, chú thích "Mục tiêu …" || Đạt (DB dev, transaction rollback): Thiếu 4.000 |
| B8 | Đặt mục tiêu thấp hơn dự kiến | Nhãn xanh "Đạt mục tiêu" || Đạt (DB dev, transaction rollback) |
| B9 | Xoá hết mục tiêu tháng | Không nhãn, không đường nét đứt, dòng phụ không nhắc mục tiêu || Đạt (DB dev, transaction rollback) |
| B10 | MG1 xem thẻ | Chỉ cộng hợp đồng tính cho MG1 (mục 1.4 của plan) || Đạt (DB dev, transaction rollback) |
| B11 | Tắt API KPI (dừng backend giữa chừng hoặc chặn route) | Thẻ báo "Không tải được doanh thu" + Thử lại; khối Cần chú ý vẫn hiện || Đạt (test tự động) (thẻ lỗi + Thử lại) |

## C. Thẻ Hợp đồng mới ký

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| C1 | Duyệt một hợp đồng mới trong tháng | Số đã ký tăng 1 || Đạt (DB dev, transaction rollback) |
| C2 | Đưa hợp đồng đó về Nháp rồi duyệt lại | Số **không** tăng thêm || Đạt (DB dev, transaction rollback) |
| C3 | Hợp đồng duyệt lần đầu tháng 10, sửa ngày rồi duyệt lại tháng 11 | Tính cho tháng 10, không cho tháng 11 || Đạt (DB dev, transaction rollback) |
| C4 | Hợp đồng từ cơ hội do MG1 phụ trách, MG2 tạo hợp đồng | Tính cho MG1 || Đạt (DB dev, transaction rollback) |
| C5 | Hợp đồng chuyến tạo tay (không có cơ hội), MG2 tạo | Tính cho MG2 || Đạt (DB dev, transaction rollback) |
| C6 | Hôm nay ngày 4, mục tiêu MG1 = 3, đã ký 1 | Dòng MG1 không đỏ (1 ≥ 0,4); thẻ của MG1 ghi "Đúng tiến độ" || Đạt (test tự động) (1/3 ngày 4 → Đúng tiến độ) |
| C7 | Hôm nay ngày 20, mục tiêu MG2 = 3, đã ký 1 | Dòng MG2 **tên và số màu đỏ**; thẻ của MG2 ghi "Chậm tiến độ" đỏ || Đạt (DB dev, transaction rollback) (0/3 ngày 4 → Chậm) |
| C8 | Đã ký ≥ mục tiêu | "Đạt mục tiêu" xanh || Đạt (test tự động) |
| C9 | QL xem danh sách người | Có người có mục tiêu hoặc có hợp đồng tháng này; tài khoản đã khoá không hiện; xếp theo tên || Đạt (DB dev, transaction rollback) |
| C10 | Có hơn 6 môi giới viên | Thẻ cuộn bên trong, trang vẫn không cuộn || Chưa chạy: DB dev chỉ có 2 tài khoản |
| C11 | MG1 có 1 HĐ chờ duyệt, 1 HĐ nháp, 1 cơ hội chủ tàu đã chọn | Thanh có phần gạch chéo dài 3; dòng chữ "+3 sắp vào (1 chờ duyệt, 1 nháp, 1 chủ tàu đã chọn)" || Đạt (test tự động) |
| C12 | Vạch đứng tiến độ | Nằm đúng vị trí ngày hôm nay / số ngày tháng × mục tiêu || Đạt (test tự động) (vạch 20% khi pace 0,6/3) |

## D. Khối Cần chú ý

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| D1 | Mở trang khi tab Hạn chốt cơ hội không có việc quá hạn, tab Chứng chỉ có | Tab Chứng chỉ được chọn sẵn || Đạt (test tự động) |
| D2 | Không tab nào có việc quá hạn | Tab đầu tiên được chọn || Đạt (test tự động) |
| D3 | Cơ hội OPEN hạn chốt hôm qua, cơ hội hạn chốt 5 ngày nữa, cơ hội hạn chốt 10 ngày nữa | Có 2 dòng: "Quá 1 ngày" đỏ đứng trước, "Còn 5 ngày" chữ thường; cơ hội 10 ngày không có || Đạt (DB dev, transaction rollback) |
| D4 | Cơ hội WON / LOST có hạn chốt đã qua | Không hiện || Đạt (DB dev, transaction rollback) |
| D5 | Chứng chỉ hết hạn 5 ngày trước và đã có bản mới còn hạn | Không hiện || Chưa chạy riêng (truy vấn giữ nguyên bản cũ) |
| D6 | Chứng chỉ sắp hết của người đang trên tàu | Dòng phụ ghi "đang trên {tàu}" màu xám || Đạt (DB dev, transaction rollback) |
| D7 | Chứng chỉ của người có chuyến ngày xuống tàu sau hôm nay | "sắp lên {tàu}" || Đạt (test tự động) (chữ "sắp lên") |
| D8 | Chuyến chưa rời, rời dự kiến đã qua 3 ngày | Tab Xuống / rời tàu: "Quá 3 ngày" đỏ, có chấm đỏ trên tab || Đạt (DB dev, transaction rollback) |
| D9 | Chuyến có ngày xuống tàu 10 ngày nữa | Dòng "Xuống tàu dd/mm", "Còn 10 ngày" || Đạt (DB dev, transaction rollback) |
| D10 | QL, tab Chờ xử lý, có 2 YCTT quá hạn | Dòng "Yêu cầu thanh toán quá hạn" kèm tổng USD, "2 việc" đỏ || Đạt (DB dev, transaction rollback): 1.900 USD |
| D11 | Loại việc có số 0 | Dòng đó ẩn || Đạt (DB dev, transaction rollback) |
| D12 | MG1, tab Việc của bạn | Có dòng "Hợp đồng nháp chưa xin duyệt"; **không** có dòng "YCTT cần duyệt" || Đạt (DB dev, transaction rollback) |
| D13 | Bấm một dòng cơ hội / chứng chỉ / chuyến | Mở đúng trang chi tiết (chứng chỉ mở tab Chứng chỉ của thuyền viên) || Đạt (mở /opportunities/15; chứng chỉ mở tab Giấy tờ) |
| D14 | Bấm dòng "Hợp đồng chờ duyệt" | Mở danh sách hợp đồng, đã lọc Chờ duyệt || Đạt (/contracts?tab=PENDING, tab Chờ duyệt chọn sẵn) |
| D15 | Đếm số trên tab | Khớp với lọc tay ở trang danh sách tương ứng || Đạt (khớp SQL tay ở bước 4) |
| D16 | Màu trong khối | Chỉ có đỏ (viên quá hạn, chấm tab); không có vàng; việc sắp tới chữ thường || Đạt (khối chỉ có đỏ, xám, màu link) |
| D17 | Tắt API Cần chú ý | Khối báo lỗi + Thử lại; hai thẻ KPI vẫn hiện || Đạt (test tự động) |

## E. Quyền và phạm vi

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| E1 | Tài khoản không có `opportunity.view` | Không có tab Hạn chốt cơ hội; các tab khác vẫn đủ || Đạt (DB dev, transaction rollback) |
| E2 | Không có `bill.view` | Tab Chờ xử lý không có dòng YCTT || Đạt (DB dev, transaction rollback) |
| E3 | Không có `contract.view` | Không có hai thẻ KPI; khối Cần chú ý chiếm cả màn || Chưa chạy trên giao diện (không có tài khoản thiếu quyền) |
| E4 | Không có quyền xem gì ở trên | Lời chào + "Bạn chưa có quyền xem số liệu nào trên Tổng quan." || Chưa chạy trên giao diện (không có tài khoản thiếu quyền) |
| E5 | MG1 phạm vi Của mình | Chỉ thấy cơ hội mình phụ trách, chứng chỉ thuyền viên mình tạo, chuyến mình tạo || Đạt (DB dev, transaction rollback) |
| E6 | MG1 gọi `GET /dashboard/kpi` | `view: 'own'`, không có `people` || Đạt (test tự động) |
| E7 | MG1 gọi `GET /kpi-targets` | 403 || Đạt (test tự động) |
| E8 | Vai trò đang có `contract.approve` sau migration | Có sẵn `kpi.view_all`, `kpi.manage` || Đạt (DB dev, transaction rollback) (câu cấp quyền của migration) |

## F. Quản trị → Mục tiêu tháng

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| F1 | QL mở Quản trị | Có tab "Mục tiêu tháng" || Đạt |
| F2 | Chọn tháng 11, nhập MG1: 3 HĐ, 7.500 USD; lưu | Lưu được; Tổng quan của MG1 đổi theo; tổng công ty cộng thêm || Đạt (bước 8, đã xoá mục tiêu thử) |
| F3 | Sửa một ô | Ô có viền nhấn và chip "Đã sửa"; nút lưu bật; chưa sửa thì nút tắt || Đạt |
| F4 | Nhập số âm, chữ, USD 3 số lẻ | Báo lỗi dưới ô, không lưu || Đạt (USD 3 số lẻ báo "Tối đa 2 số lẻ"; ô số không cho nhập âm) |
| F5 | Tháng 12 đang trống một nửa, bấm Chép từ tháng trước | Chỉ điền ô trống, ô đã có giữ nguyên || Đạt (DB dev, transaction rollback) |
| F6 | Xoá trắng mục tiêu một người, lưu | Tổng quan của người đó hiện "Chưa đặt mục tiêu tháng" || Đạt (DB dev, transaction rollback) |
| F7 | Sửa mục tiêu tháng đã qua | Cho sửa; biểu đồ tháng đó không đổi (đường mục tiêu chỉ vẽ cho tháng này) || Đạt (DB dev, transaction rollback) |

## G. Hướng dẫn trong app

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| G1 | Bấm Hướng dẫn trên trang Tổng quan | Mở `huong-dan/tong-quan.html` ở tab mới || Đạt (link mở /huong-dan/tong-quan.html) |
| G2 | Đọc trang hướng dẫn | Chữ và nhãn khớp màn đã dựng (Chậm tiến độ, Quá n ngày, Chờ xử lý…) || Đạt |
