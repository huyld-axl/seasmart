# MCAH — Testcase tay: màn Tổng quan

- **Plan:** `docs/mcah-ke-hoach-tong-quan.md` (bước 9).
- **Wireframe:** `docs/design/wireframes/tong-quan.html` (lần 4).
- **Chuẩn bị:** DB dev có ít nhất 3 tài khoản:
  - **QL**: có `kpi.view_all`, `kpi.manage`, phạm vi Toàn bộ.
  - **MG1**, **MG2**: không có `kpi.view_all`, phạm vi Của mình.

  Ngày máy chủ ghi ở cột "Hôm nay" khi case cần.
- **Ghi kết quả:** cột Kết quả điền Đạt / Không đạt + ghi chú ngắn.

## A. Bố cục và vừa màn hình

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| A1 | QL mở Tổng quan ở cửa sổ 1440×900 | Thấy lời chào, thẻ Doanh thu, thẻ Hợp đồng mới ký, khối Cần chú ý; **trang không có thanh cuộn dọc** | |
| A2 | MG1 mở Tổng quan ở 1440×900 | Thẻ đầu là "Hợp đồng bạn ký", thẻ hai "Doanh thu của bạn"; không cuộn | |
| A3 | Thu cửa sổ còn 1280×720 | Vẫn không cuộn; danh sách Cần chú ý hiện ít dòng hơn, link góc ghi "còn n ẩn" đúng số | |
| A4 | Kéo cửa sổ cao 1440×1200 | Danh sách hiện thêm dòng, số "còn n ẩn" giảm | |
| A5 | Thu hẹp dưới 1024px | Các khối xếp dọc, trang cuộn, mỗi tab hiện 5 dòng | |
| A6 | Mở trên điện thoại (375px) | Không tràn ngang; tab thành nút "Mục:"; số KPI vẫn đọc rõ | |

## B. Thẻ Doanh thu

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| B1 | Tạo hợp đồng 1.000 USD/tháng phải thu, 0 phải chi, 16/11 → 15/05, duyệt | Tháng 11 cộng thêm 500 USD (15/30 ngày) vào số dự kiến | |
| B2 | Hợp đồng phải thu 1.500, phải chi 1.200 / tháng, trọn tháng 12 | Tháng 12 cộng 300 USD | |
| B3 | Hợp đồng có khoản một lần phải thu 200, phải chi 50, bắt đầu 20/11 | Tháng 11 cộng thêm 150 USD (ngoài phần hằng tháng) | |
| B4 | Hợp đồng `DRAFT`, `PENDING`, `REJECTED` | Không tính vào doanh thu | |
| B5 | Hợp đồng `ENDED` sau khi Ghi rời tàu sớm (kết thúc 10/11) | Tháng 11 chỉ tính tới 10/11 | |
| B6 | Xem cột "Tháng này" | Cột gạch chéo, nhãn trục "Tháng này", dòng nhỏ "đã ghi nhận … USD tới hôm nay" nhỏ hơn số dự kiến | |
| B7 | Đặt mục tiêu công ty cao hơn dự kiến | Nhãn vàng "Thiếu {n} USD", đường nét đứt trên biểu đồ, chú thích "Mục tiêu …" | |
| B8 | Đặt mục tiêu thấp hơn dự kiến | Nhãn xanh "Đạt mục tiêu" | |
| B9 | Xoá hết mục tiêu tháng | Không nhãn, không đường nét đứt, dòng phụ không nhắc mục tiêu | |
| B10 | MG1 xem thẻ | Chỉ cộng hợp đồng tính cho MG1 (mục 1.4 của plan) | |
| B11 | Tắt API KPI (dừng backend giữa chừng hoặc chặn route) | Thẻ báo "Không tải được doanh thu" + Thử lại; khối Cần chú ý vẫn hiện | |

## C. Thẻ Hợp đồng mới ký

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| C1 | Duyệt một hợp đồng mới trong tháng | Số đã ký tăng 1 | |
| C2 | Đưa hợp đồng đó về Nháp rồi duyệt lại | Số **không** tăng thêm | |
| C3 | Hợp đồng duyệt lần đầu tháng 10, sửa ngày rồi duyệt lại tháng 11 | Tính cho tháng 10, không cho tháng 11 | |
| C4 | Hợp đồng từ cơ hội do MG1 phụ trách, MG2 tạo hợp đồng | Tính cho MG1 | |
| C5 | Hợp đồng chuyến tạo tay (không có cơ hội), MG2 tạo | Tính cho MG2 | |
| C6 | Hôm nay ngày 4, mục tiêu MG1 = 3, đã ký 1 | Dòng MG1 không đỏ (1 ≥ 0,4); thẻ của MG1 ghi "Đúng tiến độ" | |
| C7 | Hôm nay ngày 20, mục tiêu MG2 = 3, đã ký 1 | Dòng MG2 **tên và số màu đỏ**; thẻ của MG2 ghi "Chậm tiến độ" đỏ | |
| C8 | Đã ký ≥ mục tiêu | "Đạt mục tiêu" xanh | |
| C9 | QL xem danh sách người | Có người có mục tiêu hoặc có hợp đồng tháng này; tài khoản đã khoá không hiện; xếp theo tên | |
| C10 | Có hơn 6 môi giới viên | Thẻ cuộn bên trong, trang vẫn không cuộn | |
| C11 | MG1 có 1 HĐ chờ duyệt, 1 HĐ nháp, 1 cơ hội chủ tàu đã chọn | Thanh có phần gạch chéo dài 3; dòng chữ "+3 sắp vào (1 chờ duyệt, 1 nháp, 1 chủ tàu đã chọn)" | |
| C12 | Vạch đứng tiến độ | Nằm đúng vị trí ngày hôm nay / số ngày tháng × mục tiêu | |

## D. Khối Cần chú ý

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| D1 | Mở trang khi tab Hạn chốt cơ hội không có việc quá hạn, tab Chứng chỉ có | Tab Chứng chỉ được chọn sẵn | |
| D2 | Không tab nào có việc quá hạn | Tab đầu tiên được chọn | |
| D3 | Cơ hội OPEN hạn chốt hôm qua, cơ hội hạn chốt 5 ngày nữa, cơ hội hạn chốt 10 ngày nữa | Có 2 dòng: "Quá 1 ngày" đỏ đứng trước, "Còn 5 ngày" chữ thường; cơ hội 10 ngày không có | |
| D4 | Cơ hội WON / LOST có hạn chốt đã qua | Không hiện | |
| D5 | Chứng chỉ hết hạn 5 ngày trước và đã có bản mới còn hạn | Không hiện | |
| D6 | Chứng chỉ sắp hết của người đang trên tàu | Dòng phụ ghi "đang trên {tàu}" màu xám | |
| D7 | Chứng chỉ của người có chuyến ngày xuống tàu sau hôm nay | "sắp lên {tàu}" | |
| D8 | Chuyến chưa rời, rời dự kiến đã qua 3 ngày | Tab Xuống / rời tàu: "Quá 3 ngày" đỏ, có chấm đỏ trên tab | |
| D9 | Chuyến có ngày xuống tàu 10 ngày nữa | Dòng "Xuống tàu dd/mm", "Còn 10 ngày" | |
| D10 | QL, tab Chờ xử lý, có 2 YCTT quá hạn | Dòng "Yêu cầu thanh toán quá hạn" kèm tổng USD, "2 việc" đỏ | |
| D11 | Loại việc có số 0 | Dòng đó ẩn | |
| D12 | MG1, tab Việc của bạn | Có dòng "Hợp đồng nháp chưa xin duyệt"; **không** có dòng "YCTT cần duyệt" | |
| D13 | Bấm một dòng cơ hội / chứng chỉ / chuyến | Mở đúng trang chi tiết (chứng chỉ mở tab Chứng chỉ của thuyền viên) | |
| D14 | Bấm dòng "Hợp đồng chờ duyệt" | Mở danh sách hợp đồng, đã lọc Chờ duyệt | |
| D15 | Đếm số trên tab | Khớp với lọc tay ở trang danh sách tương ứng | |
| D16 | Màu trong khối | Chỉ có đỏ (viên quá hạn, chấm tab); không có vàng; việc sắp tới chữ thường | |
| D17 | Tắt API Cần chú ý | Khối báo lỗi + Thử lại; hai thẻ KPI vẫn hiện | |

## E. Quyền và phạm vi

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| E1 | Tài khoản không có `opportunity.view` | Không có tab Hạn chốt cơ hội; các tab khác vẫn đủ | |
| E2 | Không có `bill.view` | Tab Chờ xử lý không có dòng YCTT | |
| E3 | Không có `contract.view` | Không có hai thẻ KPI; khối Cần chú ý chiếm cả màn | |
| E4 | Không có quyền xem gì ở trên | Lời chào + "Bạn chưa có quyền xem số liệu nào trên Tổng quan." | |
| E5 | MG1 phạm vi Của mình | Chỉ thấy cơ hội mình phụ trách, chứng chỉ thuyền viên mình tạo, chuyến mình tạo | |
| E6 | MG1 gọi `GET /dashboard/kpi` | `view: 'own'`, không có `people` | |
| E7 | MG1 gọi `GET /kpi-targets` | 403 | |
| E8 | Vai trò đang có `contract.approve` sau migration | Có sẵn `kpi.view_all`, `kpi.manage` | |

## F. Quản trị → Mục tiêu tháng

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| F1 | QL mở Quản trị | Có tab "Mục tiêu tháng" | |
| F2 | Chọn tháng 11, nhập MG1: 3 HĐ, 7.500 USD; lưu | Lưu được; Tổng quan của MG1 đổi theo; tổng công ty cộng thêm | |
| F3 | Sửa một ô | Ô có viền nhấn và chip "Đã sửa"; nút lưu bật; chưa sửa thì nút tắt | |
| F4 | Nhập số âm, chữ, USD 3 số lẻ | Báo lỗi dưới ô, không lưu | |
| F5 | Tháng 12 đang trống một nửa, bấm Chép từ tháng trước | Chỉ điền ô trống, ô đã có giữ nguyên | |
| F6 | Xoá trắng mục tiêu một người, lưu | Tổng quan của người đó hiện "Chưa đặt mục tiêu tháng" | |
| F7 | Sửa mục tiêu tháng đã qua | Cho sửa; biểu đồ tháng đó không đổi (đường mục tiêu chỉ vẽ cho tháng này) | |

## G. Hướng dẫn trong app

| # | Bước | Mong đợi | Kết quả |
|---|---|---|---|
| G1 | Bấm Hướng dẫn trên trang Tổng quan | Mở `huong-dan/tong-quan.html` ở tab mới | |
| G2 | Đọc trang hướng dẫn | Chữ và nhãn khớp màn đã dựng (Chậm tiến độ, Quá n ngày, Chờ xử lý…) | |
