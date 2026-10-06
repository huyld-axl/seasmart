# Ảnh "trước" và bảng soi UI Marineport (giai đoạn 1)

- **Ngày soi:** 2026-10-06. Lối **soi** của skill `ui-ux` (`references/review.md`, chế độ soi), probe `--sweep` 1440 → 375px.
- **Route:** `/login`, `/seafarers`, `/seafarers/2` (hồ sơ DEMO-0002, tên dài hai dòng).
- **Dữ liệu:** synthetic (`backend/scripts/seed_demo_synthetic.sql`). Không dùng seed `011`.
- **Mục đích:** ảnh "trước" cho trang Figma "03 · Demo & Flow" và cho Sales. **Không sửa theo bảng này**: ba màn sẽ thiết kế lại theo nhánh `U` (kế hoạch `docs/mcah-ui-ux-design-plan.md`, giai đoạn 1). Vì vậy không chụp ảnh "sau".

> Audit: React 19 + Vite, Ant Design 6, không Tailwind. Token ở `ConfigProvider` (`App.jsx`) và `index.css`. Phong cách flat (0 file glass, 0 gradient, bóng ở 5 file CSS/JSX). Dark mode: không có.
> Chưa soi được: nút Zalo cạnh SĐT (ảnh logo Zalo bị chặn mạng trong máy cloud, cần kiểm lại ở máy có mạng thường).

| Ảnh | 1280 | 375 | Khác |
| --- | --- | --- | --- |
| Đăng nhập | [1280](login/1280.png) | [375](login/375.png) | |
| Danh sách thuyền viên | [1280](seafarers/1280.png) | [375](seafarers/375.png) | [800](seafarers/800.png) (bảng bị ép) |
| Hồ sơ thuyền viên | [1280](seafarer-detail/1280.png) | [375](seafarer-detail/375.png) | [375, hộp "Thêm chứng chỉ"](seafarer-detail/375-modal.png) |

## Bảng soi

| # | Hạng | Chỗ | Lỗi | Sửa (nếu sửa theo hệ hiện tại) | Nguồn |
| --- | --- | --- | --- | --- | --- |
| 1 | Hỏng | Cả 3 route, mọi khổ: placeholder ô nhập, ô chọn | Chữ gợi ý `#c4c4c4` trên trắng, 1.74:1, gần như không đọc được | Thêm `colorTextPlaceholder` (≥ 4.5:1) vào `antTheme`, `App.jsx:34` | đo `/login P1`, `/seafarers P1, P2` |
| 2 | Hỏng | `/seafarers`, mọi khổ: tên thuyền viên | Link dùng xanh mặc định AntD `#1677ff` (4.10:1), không phải màu nhấn navy; bản mobile viết cứng `#1677ff` | Thêm `colorLink: '#003366'` vào `antTheme`; bỏ mã viết cứng `SeafarerListPage.jsx:123` | đo `/seafarers P6, P11`, đọc code |
| 3 | Hỏng | `/seafarers`, mọi khổ: badge "Sẵn sàng", "Nghỉ phép" | Chữ trên nền nhạt 3.37:1 và 3.34:1 | Đậm chữ tag xanh lá, cam (bảng `STATUS_COLOR`, `SeafarerListPage.jsx:32`) | đo `/seafarers P3, P5` |
| 4 | Hỏng | `/seafarers` 375 (dòng mã · chức danh), `/seafarers/2` mọi khổ ("No data") | Chữ phụ xám `#8c8c8c` / `#949494` trên trắng, khoảng 3:1 | Mã viết cứng `SeafarerListPage.jsx:207` và token chữ phụ của AntD lên ≥ 4.5:1 | đo `/seafarers P4`, `/seafarers/2 P5` |
| 5 | Hỏng | `/login`, mọi khổ: "Đăng nhập để tiếp tục" | `#6b7280` trên `#f5f5f5`, 4.43:1, hụt ngưỡng | Đậm hơn một bậc, `LoginPage.jsx:42` | đo `/login P2` |
| 6 | Hỏng | `/seafarers/2`, mọi khổ: nút "Xóa" | Chữ đỏ `#e74c3c` trên trắng, 3.82:1 | `colorError` đậm hơn, hoặc nút nguy hiểm nền mờ chữ đỏ đậm | đo `/seafarers/2 P9` |
| 7 | Hỏng | `/seafarers`, 768–1024px | Sidebar 240px còn mở, bảng 7 cột bị ép: "Mã TV", "Họ và tên", "Chức danh" xuống 2–5 dòng, cột "Trạng thái" bị cắt | Chuyển sang dạng thẻ từ `lg` thay vì `md`, hoặc thu sidebar dưới `lg` | đo `/seafarers P12, P13, P14`, ảnh 800 |
| 8 | Hỏng | `/seafarers/2` 375: hộp "Thêm liên hệ", "Thêm chứng chỉ", "Thêm hợp đồng", "Thêm đăng ký" | Hộp rộng 383px, lòi 8px khỏi mép màn | Giới hạn bề rộng hộp theo màn (`SeafarerDetailPage.jsx:440, 646`…) | đo `/seafarers/2 P1–P4` |
| 9 | Hỏng | Khung app, ≥ 768px: đường dưới logo sidebar và dưới header | Một đường thẳng mà nửa trái trắng mờ, nửa phải xám | Cùng một màu đường kẻ, `AdminLayout.css` | đo `/seafarers P15`, `/seafarers/2 P10` |
| 10 | Hỏng | `/seafarers` 375, `/seafarers/2` 375: nút Zalo cạnh SĐT | Vùng bấm 18×18px; Tab tới không thấy gì | Nút tối thiểu 24px (`ZaloButton.jsx:18`) | đo `/seafarers P10`, `/seafarers/2 P8` |
| 11 | Lệch hệ | Mọi màn: chữ của AntD | App đặt `locale={viVN}` nhưng hiện "No data", "20 / page", "Select date": Vite nạp `antd/locale/vi_VN` (CommonJS) thành `{ default: … }`, `ConfigProvider` nhận sai đối tượng nên rơi về tiếng Anh | `import viVN from 'antd/es/locale/vi_VN'`, `App.jsx:4` | đọc code, thấy trong ảnh |
| 12 | Lệch hệ | `/seafarers/2`, hộp "Thêm chứng chỉ" | Ô chọn tệp gốc của trình duyệt ("Choose File No file chosen") giữa form AntD | Dùng `Upload` của AntD, `SeafarerDetailPage.jsx:678` | đo, thấy trong ảnh |
| 13 | Lệch hệ | Khung app, mọi khổ: chuông thông báo | Header dàn đều 3 khối nên chuông trôi giữa header, tách khỏi menu user | Gom chuông và menu user thành một nhóm bên phải, `AdminLayout.jsx` | thấy trong ảnh, đọc code |
| 14 | Lệch hệ | `/seafarers` 375–460px: hàng nút; 580–640, 820–880px: hàng lọc | "Thêm mới" rớt xuống một mình; ô "Chức danh" rớt một mình | Cho hàng tự xuống đủ dòng hoặc gom nút phụ vào menu | đo `/seafarers P7, P17` |
| 15 | Lệch hệ | `AdminLayout.jsx:133, 150`, `SeafarerDetailPage.jsx:73, 74, 224` | Mã màu viết cứng trùng token (`#003366`, `#001529`, `#fafafa`) | Lấy từ token theme | đọc code |
| 16 | Gu | Nút, menu (mọi màn) | Tab tới vẽ vòng focus; viền nút đổi sang xanh khi rê. Gu, tuỳ bạn | Theo `I13`: bỏ vòng focus; rê chỉ đổi nền | đo |
| 17 | Gu | Khung app, nút chính | Header có bóng, nút chính có vạch bóng dưới đáy. Gu, tuỳ bạn | Bỏ bóng, tách header bằng viền | thấy trong ảnh |
| 18 | Gu | `/seafarers/2` | Trang dài 8 khối, phần lớn ô là "-"; người xem phải cuộn qua nhiều ô trống. Gu, tuỳ bạn | Ẩn ô trống, gom khối | thấy trong ảnh |
| 19 | Gu | `/seafarers/2` 375 | Nút chỉ icon 24×24, nút "Thêm…" cao 24px; mục mô tả dày tới 5 dòng chữ. Gu, tuỳ bạn | Nút ≥ 32px trên mobile | đo |
| 20 | Gu | Nhận diện: sidebar, màn đăng nhập | Chưa có logo, chỉ chữ "MarinePort"; favicon của Vite. Gu, tuỳ bạn | Làm ở giai đoạn 2 (logo MCAH) | thấy trong ảnh |

> Đối chiếu probe: 29 mã, 25 lên bảng, 4 loại: `/seafarers P8, P9` (phần chữ trong ô cao 22px, nhưng cả khung ô 32px nhận bấm), `/seafarers/2 P6, P7` (chữ tab cao 22px, cả ô tab có padding nhận bấm). `/seafarers P16` (nền rê nút Zalo gần như không thấy) gộp vào dòng 10.
>
> Lỗi console (không vào bảng): `dropdownRender` đã cũ (`NotificationBell.jsx:143`); `Drawer` `width` đã cũ (`AdminLayout.jsx`); một lời gọi API trả 400 khi probe mở các hộp ở 375; ảnh Zalo bị chặn mạng trong máy cloud.
