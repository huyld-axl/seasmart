# Tài Liệu Hướng Dẫn Sử Dụng - Marineport

**Hệ thống quản lý tuyển dụng & điều phối thuyền viên hàng hải**

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Đăng nhập & Phân quyền](#2-đăng-nhập--phân-quyền)
3. [Dashboard - Trang tổng quan](#3-dashboard---trang-tổng-quan)
4. [Quản lý thuyền viên](#4-quản-lý-thuyền-viên)
5. [Quản lý công ty đối tác (Partners)](#5-quản-lý-công-ty-đối-tác-partners)
6. [Quản lý việc làm (Jobs)](#6-quản-lý-việc-làm-jobs)
7. [Quản lý hợp đồng điều động (Deployments)](#7-quản-lý-hợp-đồng-điều-động-deployments)
8. [Tài chính](#8-tài-chính)
9. [Danh mục tàu](#9-danh-mục-tàu)
10. [Dữ liệu nền (Master Data)](#10-dữ-liệu-nền-master-data)
11. [Tin nhắn](#11-tin-nhắn)
12. [Quản lý người dùng hệ thống](#12-quản-lý-người-dùng-hệ-thống)
13. [Cổng thuyền viên (Seafarer Portal)](#13-cổng-thuyền-viên-seafarer-portal)

---

## 1. Tổng quan hệ thống

**Marineport** là hệ thống quản lý tuyển dụng và điều phối thuyền viên hàng hải, hỗ trợ toàn bộ quy trình từ hồ sơ thuyền viên, kết nối với công ty vận tải biển, quản lý hợp đồng điều động, đến tính toán tài chính hàng tháng.

### Các nhóm người dùng

| Vai trò | Quyền truy cập |
|---|---|
| **Admin** | Toàn quyền, bao gồm quản lý người dùng hệ thống |
| **Operator** | Quản lý thuyền viên, đối tác, việc làm, hợp đồng, danh mục tàu |
| **Accountant** | Quản lý tài chính, xem các module khác |
| **Seafarer** | Chỉ truy cập cổng thuyền viên (profile, chứng chỉ, lịch sử) |

### Cấu trúc menu chính

Thanh điều hướng bên trái (sidebar) gồm các mục:

- **Dashboard** - Trang tổng quan số liệu
- **Thuyền viên** - Quản lý hồ sơ thuyền viên
- **Đối tác** - Quản lý công ty vận tải biển
- **Việc làm** - Danh sách vị trí tuyển dụng
- **Điều động** - Hợp đồng điều động thuyền viên lên tàu
- **Tài chính** - Bảng lương và doanh thu
- **Danh sách tàu** - Danh mục tàu biển
- **Người dùng** *(chỉ Admin)* - Quản lý tài khoản hệ thống

---

## 2. Đăng nhập & Phân quyền

### Đăng nhập

Truy cập trang đăng nhập tại địa chỉ hệ thống được cung cấp. Nhập **email** và **mật khẩu** để vào hệ thống.

Sau khi đăng nhập thành công, hệ thống tự động chuyển đến trang Dashboard phù hợp với vai trò của bạn.

### Đăng xuất

Nhấp vào **avatar/email** ở góc trên phải → chọn **Đăng xuất**.

### Lưu ý phân quyền

- Một số nút hành động (Sửa, Xóa, Thêm) sẽ không xuất hiện nếu bạn không có quyền tương ứng.
- Tài khoản Admin (ID=1) được bảo vệ, không thể bị xóa hoặc khóa.
- Thuyền viên chỉ đăng nhập được vào Cổng thuyền viên tại `/portal`.

---

## 3. Dashboard - Trang tổng quan

**Đường dẫn:** `/dashboard`

Trang tổng quan hiển thị 4 thẻ số liệu nhanh:

| Thẻ | Mô tả |
|---|---|
| **Thuyền viên** | Tổng số thuyền viên trong hệ thống |
| **Trung tâm đào tạo** | Số trung tâm đào tạo đã đăng ký |
| **Khóa học** | Số khóa học hiện có |
| **Chứng chỉ sắp hết hạn** | Số chứng chỉ sẽ hết hạn trong thời gian tới |

Đây là trang chỉ xem, không có thao tác chỉnh sửa.

---

## 4. Quản lý thuyền viên

### 4.1 Danh sách thuyền viên

**Đường dẫn:** `/seafarers`

#### Thông tin hiển thị

Trang hiển thị bảng danh sách thuyền viên với các cột:
- **Chức danh** - Rank/chức danh trên tàu
- **Họ tên** - Tên đầy đủ
- **Trạng thái** - STANDBY (chờ việc) / ONBOARD (đang trên tàu) / SIGNOFF (đã xuống tàu)
- **Ngày sinh** - Ngày/tháng/năm sinh
- **Tỉnh thành** - Địa chỉ tỉnh thường trú
- **Điện thoại** - Số liên hệ
- **Số lần liên hệ** - Tổng số cuộc gọi đã ghi nhận, kèm ngày gọi gần nhất

Phía trên bảng có 4 thẻ thống kê nhanh: **Tổng thuyền viên**, **Đang trên tàu**, **Standby**, **Đã signoff**.

#### Bộ lọc và tìm kiếm

- **Tìm theo tên** - Nhập tên để lọc
- **Lọc theo trạng thái** - Dropdown chọn trạng thái
- **Lọc theo chức danh** - Chọn một hoặc nhiều chức danh (nút bấm nhiều lựa chọn)
- **Sắp xếp theo chức danh** - Tăng dần hoặc giảm dần

#### Các hành động chính

| Hành động | Mô tả |
|---|---|
| **Thêm thuyền viên** | Mở form tạo hồ sơ mới |
| **Import Excel** | Nhập hàng loạt thuyền viên từ file Excel |
| **Xuất Excel** | Tải danh sách thuyền viên ra file Excel |
| **Ghi chú cuộc gọi** | Click vào số lần liên hệ → mở modal ghi ngày giờ và nội dung cuộc gọi (tối đa 500 ký tự) |
| **Xóa** | Xóa thuyền viên khỏi hệ thống |

---

### 4.2 Nhập thuyền viên hàng loạt (Import Excel)

**Đường dẫn:** `/seafarers/import`

#### Quy trình thực hiện

1. **Tải file mẫu** - Nhấn nút **Tải file mẫu** để lấy file Excel chuẩn định dạng
2. **Điền thông tin** - Điền thông tin thuyền viên vào file theo đúng cột quy định
3. **Upload file** - Chọn file `.xlsx` hoặc `.xls` và nhấn **Import**
4. **Xem kết quả** - Hệ thống hiển thị:
   - Số thuyền viên import thành công
   - Danh sách dòng lỗi (nếu có) kèm mô tả lỗi cụ thể theo từng dòng

**Lưu ý:** Hệ thống tự động bỏ qua các dòng trùng số CCCD (Căn cước công dân).

---

### 4.3 Tạo / Chỉnh sửa hồ sơ thuyền viên

**Đường dẫn:** `/seafarers/new` (tạo mới) hoặc `/seafarers/:id/edit` (chỉnh sửa)

#### Phần 1: Thông tin cá nhân

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| Mã thuyền viên | | Mã định danh nội bộ |
| Chức danh | | Rank/vị trí trên tàu |
| Họ tên | Có | Tên đầy đủ |
| Ảnh đại diện | | Upload ảnh (có xem trước) |
| Ngày sinh | Có | Ngày tháng năm sinh |
| Điện thoại | | Số điện thoại liên hệ |
| Hôn nhân | | Tình trạng hôn nhân |
| Quốc tịch | Có | Quốc tịch (chọn từ danh sách) |
| CCCD | | Số căn cước công dân |
| Ngày cấp CCCD | | |
| Hộ chiếu | | Số hộ chiếu |
| Ngày cấp hộ chiếu | | |
| Quê quán | | Xã/Phường - Quận/Huyện - Tỉnh |
| Địa chỉ thường trú | | |
| Chiều cao | | Đơn vị: cm |
| Cân nặng | | Đơn vị: kg |
| Cỡ giày | | |
| Cỡ đồ bảo hộ | | |

#### Phần 2: Học vấn & Đào tạo

- **Bảng đào tạo**: Thêm nhiều hàng, mỗi hàng gồm: Tên trường, Ngành học, Năm vào học, Năm tốt nghiệp, Trình độ (dropdown), Xếp loại
- **Trình độ tiếng Anh tổng hợp**: Chọn A / B / C (dùng khi xuất CV)
- **Kỹ năng tiếng Anh chi tiết**: Nghe, Nói, Đọc, Viết

Sau khi điền đầy đủ, nhấn **Lưu** để lưu hồ sơ.

---

### 4.4 Chi tiết thuyền viên

**Đường dẫn:** `/seafarers/:id`

Trang chi tiết hiển thị toàn bộ thông tin thuyền viên và cho phép quản lý các mục liên quan.

#### Thông tin hiển thị

**Header**: Tên, trạng thái (dropdown cho phép đổi trạng thái), nút Sửa, nút Xóa

**Tab Thông tin cá nhân** gồm các mục:
- Thông tin cơ bản (mã, chức danh, ảnh, CCCD, hộ chiếu, chiều cao, cân nặng, cỡ giày/bảo hộ)
- Học vấn & đào tạo (bảng các chương trình học đã theo)
- Trình độ tiếng Anh
- Tài khoản ngân hàng (tài khoản cá nhân & tài khoản nhận lương)
- Lịch sử điều động (bảng các hợp đồng lên tàu)
- Danh sách người thân/thụ hưởng

**Tab Biểu mẫu**: Xuất hồ sơ ra file Word/Excel

#### Quản lý tài khoản ngân hàng

Nhấn **Sửa tài khoản** → modal nhập:
- Tài khoản cá nhân: Chủ TK, Tên ngân hàng, Chi nhánh, Số TK
- Tài khoản nhận lương: tương tự

#### Quản lý người thân / thụ hưởng

- **Thêm**: Nhấn nút Thêm → nhập Họ tên, Mối quan hệ, Năm sinh, Địa chỉ
- **Sửa / Xóa**: Thao tác trực tiếp trên từng hàng trong bảng

---

## 5. Quản lý công ty đối tác (Partners)

### 5.1 Danh sách đối tác

**Đường dẫn:** `/partners`

Hiển thị danh sách các công ty vận tải biển có hợp tác. Các cột:
- Mã công ty, Tên công ty, Người liên hệ, Điện thoại, Email, Tỷ lệ hoa hồng (%), Trạng thái (Hoạt động / Ngưng)

#### Bộ lọc

- Tìm theo tên công ty
- Tìm theo mã công ty
- Tìm theo người liên hệ
- Lọc theo trạng thái
- Lọc theo chu kỳ thanh toán

#### Thêm đối tác mới

Nhấn **Thêm đối tác** → modal nhập đầy đủ thông tin:

| Nhóm | Thông tin |
|---|---|
| **Thông tin chung** | Mã, Tên công ty, Người đại diện, Mã số thuế |
| **Liên hệ** | Người liên hệ, Điện thoại, Email, Địa chỉ |
| **Thanh toán** | Chu kỳ thanh toán, Phương thức thanh toán, Điều khoản |
| **Tài khoản ngân hàng** | Tên TK, Số TK, Ngân hàng, Chi nhánh |
| **Hoa hồng** | Tỷ lệ % hoa hồng |
| **Ghi chú** | Ghi chú tự do |
| **Trạng thái** | Bật/tắt hoạt động |

---

### 5.2 Chi tiết đối tác

**Đường dẫn:** `/partners/:id`

Hiển thị chi tiết công ty gồm các phần:
- **Thông tin công ty**: Mã, Tên, Đại diện, Mã số thuế, Địa chỉ
- **Liên hệ**: Người liên hệ, Điện thoại, Email
- **Thanh toán**: Chu kỳ, Phương thức, Thông tin tài khoản ngân hàng, Tỷ lệ hoa hồng, Điều khoản
- **Ghi chú**
- **Danh sách việc làm liên kết**: Bảng các job của công ty này (Chức danh, Tàu, Thuyền viên, Trạng thái)

Nhấn **Chỉnh sửa** để sửa thông tin trực tiếp. Công tắc trạng thái **Hoạt động/Ngưng** ở header.

---

## 6. Quản lý việc làm (Jobs)

### 6.1 Danh sách việc làm

**Đường dẫn:** `/jobs`

Mỗi job đại diện cho một vị trí tuyển dụng thuyền viên cho một con tàu cụ thể của một công ty đối tác.

Các cột hiển thị:
- Công ty đối tác, Tàu, Chức danh, Thuyền viên (đã điền / chưa), Giá trị hợp đồng, Trạng thái job, Trạng thái thanh toán

#### Trạng thái job

| Trạng thái | Ý nghĩa |
|---|---|
| **OPEN** | Vị trí đang tuyển, chưa có thuyền viên |
| **FILLED** | Đã có thuyền viên được chỉ định |
| **CANCELLED** | Job đã hủy |

#### Bộ lọc

- Lọc theo công ty (tìm kiếm)
- Lọc theo tàu (tên/IMO)
- Lọc theo trạng thái hợp đồng
- Lọc theo trạng thái thanh toán (Đã thanh toán / Chưa thanh toán)
- Lọc theo chức danh

#### Tạo job mới

Nhấn **Tạo việc làm** → modal nhập:

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| Công ty đối tác | Có | Chọn từ danh sách đối tác |
| Tàu | Có | Chọn tàu từ hệ thống |
| Chức danh | Có | Vị trí cần tuyển |
| Ngày ký hợp đồng | | |
| Ngày bắt đầu / Kết thúc | | Thời hạn hợp đồng |
| Giá trị hợp đồng | | Số tiền hoa hồng |
| Ngoại tệ | | USD hoặc VND |
| Chu kỳ thanh toán | | |
| Thuyền viên | | Nếu chọn ngay → job tự động FILLED |
| Lương thuyền viên | | Lương + đơn vị tiền |
| Ghi chú | | |

#### Ghi nhận thanh toán

Với mỗi job, nhấn **Thêm thanh toán** → nhập:
- Chu kỳ thanh toán (tên/mô tả)
- Số tiền
- Ngày thanh toán
- Ghi chú
- File đính kèm (tùy chọn)

---

### 6.2 Chi tiết việc làm

**Đường dẫn:** `/jobs/:id`

Trang chi tiết gồm các phần:

**Thông tin job**: Tàu, Chức danh, Ngày hợp đồng, Ngày bắt đầu/kết thúc, Giá trị, Ghi chú

**Thông tin tàu**: Loại tàu, Động cơ, Công suất (kW), Cờ quốc gia, Vùng hoạt động, GRT, DWT

**Thông tin đối tác**: Tên công ty, Người liên hệ, Điện thoại, Email

**Lịch sử thuyền viên**: Bảng các thuyền viên đã được chỉ định vào job này:
- Tên, Mã, Chức danh, Ngày sign-on/sign-off, Trạng thái, Lương, Lương thực nhận
- Nút **Chỉnh sửa chỉ định** và **Xem chi tiết** cho mỗi dòng

**Thông tin thanh toán**: Tỷ lệ hoa hồng, phương thức, tài khoản ngân hàng, điều khoản

**Lịch sử thanh toán**: Bảng các khoản đã thanh toán (Chu kỳ, Số tiền, Ngày, Ghi chú, File)

#### Gán thuyền viên vào job

Nhấn **Gán thuyền viên** → chọn thuyền viên, nhập ngày sign-on/off và lương.

#### Chỉnh sửa chỉ định

Sau khi gán, có thể sửa ngày và lương thực nhận (lương thực tế khác với lương hợp đồng).

---

## 7. Quản lý hợp đồng điều động (Deployments)

### 7.1 Danh sách hợp đồng

**Đường dẫn:** `/deployments`

Hợp đồng điều động ghi nhận việc một thuyền viên được đưa lên làm việc tại một con tàu cụ thể.

Các cột hiển thị:
- Chức danh, Tên thuyền viên, Tên tàu, Ngày tham gia, Nguồn (Job / Thủ công), Trạng thái

#### Bộ lọc

- Lọc theo tên tàu
- Lọc theo chức danh
- Lọc theo thuyền viên (tìm kiếm)
- Lọc theo khoảng thời gian
- Lọc theo trạng thái
- Ẩn hợp đồng đã hủy (checkbox)

#### Tạo hợp đồng thủ công

Nhấn **Tạo hợp đồng** → modal nhập:

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| Thuyền viên | Có | Chọn từ danh sách |
| Tàu | | Chọn tàu từ hệ thống |
| Chức danh | | |
| Ngày tham gia | | Ngày sign-on |
| Ngày kết thúc | | Ngày sign-off dự kiến |
| Lương | | Mức lương thỏa thuận |
| Đơn vị tiền | | USD / VND |
| Ghi chú | | |

---

### 7.2 Chi tiết hợp đồng

**Đường dẫn:** `/deployments/:id`

Đây là màn hình quản lý toàn diện vòng đời của một hợp đồng từ khi thu thập hồ sơ đến khi thuyền viên hoàn thành hợp đồng.

#### Thông tin chung

Header gồm: ID hợp đồng, Thuyền viên, Tàu, Chức danh, Liên kết job (nếu có), Ngày bắt đầu/kết thúc, Lương.

Các nút hành động ở header: **Sửa**, **Sao chép** (tạo hợp đồng mới tương tự), **Xóa**

#### Quản lý trạng thái

Dropdown đổi trạng thái với 6 bước tiến trình:

| Trạng thái | Ý nghĩa |
|---|---|
| **collecting_docs** | Đang thu thập hồ sơ giấy tờ |
| **confirmed** | Đã xác nhận, đang chờ xếp tàu |
| **pre_boarding** | Chuẩn bị lên tàu |
| **onboard** | Đang làm việc trên tàu |
| **signed_off** | Đã xuống tàu, hợp đồng hoàn thành |
| **cancelled** | Hợp đồng bị hủy |

Một số chuyển trạng thái yêu cầu nhập ngày tài liệu cụ thể.

#### Tab Lương

Quản lý thông tin lương chi tiết của hợp đồng.

#### Tab Checklist - Kiểm tra hồ sơ

Danh sách các hạng mục cần kiểm tra trước khi thuyền viên lên tàu:

- **Thanh toán phí** - Tích xác nhận đã hoàn thành
- **CHECK_ONLINE** - Kiểm tra online (có link ngoài)
- **VAX_COVID** - Xác nhận tiêm vaccine (có link ngoài)
- **SYLY** - Upload/tải file tài liệu
- **CMND** - Tải file CCCD
- **CAM_KET** - File cam kết

Thanh tiến độ hiển thị tỷ lệ hoàn thành (số mục đã xong / tổng số).

Với mỗi hạng mục có file:
- **Upload** - Đính kèm tài liệu
- **Tải xuống** - Tải file đã đính kèm
- **Nhập ngày** - Ngày cấp/hiệu lực của tài liệu

#### Tab Tài liệu

Tải xuống các mẫu tài liệu hợp đồng:
- **BB Giao Nhận** (Biên bản giao nhận)
- **Hợp Đồng Dân Sự**
- **Hợp Đồng MLC** (Maritime Labour Convention)
- **Quyết Định Điều Động**

---

## 8. Tài chính

**Đường dẫn:** `/finance`

Module tài chính quản lý lương thuyền viên theo tháng và theo dõi doanh thu/chi phí.

### 8.1 Tab Lương

#### Thẻ tóm tắt

- **Doanh thu từ hợp đồng** (VND) - Tổng tiền nhận từ đối tác
- **Chi phí thuyền viên** (VND) - Tổng lương đã trả
- **Hoa hồng** (VND) - Tổng hoa hồng
- **Lợi nhuận / Lỗ** (VND) - Doanh thu - Chi phí - Hoa hồng

#### Bảng lương tháng

Chọn **tháng** bằng bộ chọn tháng (YYYY-MM). Bảng gồm các cột:

| Cột | Mô tả |
|---|---|
| Thuyền viên | Tên, chức danh, tên tàu |
| Lương gốc (USD) | Lương hợp đồng USD - chỉnh sửa được |
| Số ngày công | Số ngày thực tế làm việc - chỉnh sửa được |
| Tỷ giá | Tỷ giá USD/VND áp dụng - chỉnh sửa được |
| Lương VND | = Lương USD × Tỷ giá × (Số ngày / Số ngày trong tháng) |
| Tạm ứng | Số tiền tạm ứng trước - chỉnh sửa được |
| Khấu trừ | Các khoản khấu trừ (nhấn để xem/sửa chi tiết) |
| Thực nhận (VND) | = Lương VND - Tạm ứng - Khấu trừ |
| Trạng thái | Đã thanh toán / Chưa thanh toán |

**Lưu ý:** Chỉ được chỉnh sửa khi chưa đánh dấu đã thanh toán.

#### Tỷ giá tháng

Nhập **tỷ giá USD/VND** áp dụng chung cho tháng → nhấn Lưu. Tỷ giá này được áp dụng tự động cho tất cả thuyền viên trong tháng.

#### Khấu trừ

Nhấn vào ô **Khấu trừ** của thuyền viên để mở danh sách khấu trừ:
- Xem/sửa từng khoản khấu trừ (nhãn + số tiền)
- Thêm khấu trừ mới (gợi ý tự động từ danh sách định sẵn)
- Xóa khoản khấu trừ

#### Tạo bảng lương hàng loạt

Nhấn **Tạo bảng lương** để tự động sinh bảng lương cho tất cả thuyền viên đang có hợp đồng trong tháng được chọn.

#### Đánh dấu đã thanh toán

- **Từng người**: Nhấn nút **Đã trả** trên hàng tương ứng
- **Toàn bộ**: Nhấn **Đánh dấu tất cả đã thanh toán**

---

### 8.2 Tab Doanh thu / Chi phí

Bảng phân tích chi tiết theo từng hợp đồng/job:

- Giá trị hợp đồng, Lương thuyền viên, Hoa hồng, Chi phí khác, Lợi nhuận/Lỗ

**Chi phí khác**: Nhấn để xem/thêm/sửa các chi phí phát sinh ngoài lương (nhãn + số tiền).

---

## 9. Danh mục tàu

**Đường dẫn:** `/vessels`

Danh mục tàu là cơ sở dữ liệu các con tàu biển trong hệ thống.

### Thông tin tàu

Mỗi tàu gồm hai nhóm thông tin:

**Nhận diện tàu:**
- Số IMO (mã quốc tế)
- Tên tàu
- Call Sign
- Loại tàu
- Cờ quốc gia
- Vùng hoạt động

**Thông số kỹ thuật:**
- GRT (Tổng dung tích đăng ký)
- NRT (Dung tích thuần)
- DWT (Trọng tải)
- Chiều dài (LOA) - mét
- Công suất máy - kW
- Loại động cơ

### Trạng thái tàu

| Trạng thái | Màu | Ý nghĩa |
|---|---|---|
| **IN_SERVICE** | Xanh lá | Đang hoạt động |
| **LAID_UP** | Cam | Tạm ngưng hoạt động |
| **SCRAPPED** | Đỏ | Đã phá dỡ |
| **UNDER_CONSTRUCTION** | Xanh dương | Đang đóng |

### Cập nhật thông tin từ internet

Với tàu có số IMO, nhấn **Lấy mới từ internet** để tự động cập nhật thông tin kỹ thuật từ cơ sở dữ liệu hàng hải quốc tế.

### Chỉnh sửa tàu

Nhấn **Chỉnh sửa** → chuyển sang form chỉnh sửa đầy đủ thông tin tàu.

---

## 10. Dữ liệu nền (Master Data)

**Đường dẫn:** `/master-data`

Trang Hub hiển thị các danh mục dữ liệu nền cần quản lý. Nhấn vào từng thẻ để vào trang quản lý tương ứng.

### 10.1 Chứng chỉ (`/master-data/cert`)

Quản lý các loại chứng chỉ thuyền viên.

**Thông tin mỗi loại chứng chỉ:**

| Trường | Mô tả |
|---|---|
| Mã | Mã định danh ngắn gọn |
| Tên tiếng Việt | Tên hiển thị trong hệ thống |
| Tên tiếng Anh | Tên trên chứng chỉ gốc |
| Cơ quan cấp | Tổ chức/cơ quan có thẩm quyền |
| Hiệu lực | Số năm hiệu lực (để trống = Vĩnh viễn) |
| Cảnh báo trước | Số tháng cảnh báo trước khi hết hạn (để hệ thống tự nhắc) |
| STCW | Phân loại: Theo tiêu chuẩn STCW hoặc không |

### 10.2 Chức danh (`/master-data/rank`)

Quản lý các chức danh/vị trí trên tàu.

| Trường | Mô tả |
|---|---|
| Mã | Mã ngắn gọn (VD: MASTER, CHIEF_OFFICER) |
| Tên tiếng Việt | VD: Thuyền trưởng, Đại phó |
| Tên tiếng Anh | VD: Master, Chief Officer |
| Bộ phận | DECK (Boong) / ENGINE (Máy) / CATERING (Phục vụ) |

### 10.3 Cảng biển (`/master-data/port`)

Danh sách cảng biển trên thế giới.

| Trường | Mô tả |
|---|---|
| UN/LOCODE | Mã cảng quốc tế (5 ký tự) |
| Tên cảng | Tên đầy đủ của cảng |
| Quốc gia | Chọn từ danh sách quốc gia |

### 10.4 Quốc gia (`/master-data/country`)

Danh sách quốc gia.

| Trường | Mô tả |
|---|---|
| Mã ISO | 2 ký tự viết hoa (VD: VN, SG, JP) |
| Tên tiếng Anh | Vietnam, Singapore, Japan... |
| Tên tiếng Việt | Việt Nam, Singapore, Nhật Bản... |

### 10.5 Biểu mẫu (`/master-data/admin/form-templates`)

*(Chỉ Admin)* Quản lý các file mẫu Excel/Word dùng để xuất hồ sơ thuyền viên và tài liệu hợp đồng.

---

## 11. Tin nhắn

**Đường dẫn:** `/messages`

Hệ thống nhắn tin nội bộ giữa các nhân viên.

### Giao diện

**Bảng bên trái** - Danh sách cuộc trò chuyện:
- Hiển thị danh sách các thread đang có
- Mỗi thread: Avatar, Tên (hoặc "Cuộc trò chuyện #ID"), Nội dung tin cuối, Thời gian
- Badge đỏ hiển thị số tin chưa đọc
- Nút **Mới** để bắt đầu cuộc trò chuyện mới

**Vùng bên phải** - Nội dung cuộc trò chuyện:
- Danh sách tin nhắn với tên người gửi và thời gian
- Ô nhập tin nhắn ở cuối
- Nhấn **Enter** để gửi, **Shift+Enter** để xuống dòng

### Bắt đầu cuộc trò chuyện mới

1. Nhấn nút **Mới**
2. Tìm kiếm người nhận (nhập ít nhất 2 ký tự) - tìm theo tên/email
3. Nhập nội dung tin nhắn đầu tiên
4. Nhấn **OK** để gửi

**Lưu ý:** Hệ thống tự động làm mới tin nhắn sau mỗi 8 giây, danh sách thread làm mới sau mỗi 15 giây.

---

## 12. Quản lý người dùng hệ thống

**Đường dẫn:** `/admin/users` *(Chỉ Admin)*

### Danh sách người dùng

Hiển thị tất cả tài khoản trong hệ thống. Có thể lọc và phân trang (20 user/trang).

### Tạo người dùng mới

Nhấn **Tạo người dùng** → form trong drawer (ngăn kéo bên phải) nhập:
- Email
- Vai trò (admin / operator / accountant / seafarer)
- Trạng thái kích hoạt

### Chi tiết người dùng

**Đường dẫn:** `/admin/users/:id`

Hiển thị: ID, Email, Vai trò, Trạng thái (Đang hoạt động / Đã khóa), Ngày tạo, Ngày cập nhật cuối

**Các hành động:**
- **Chỉnh sửa** - Sửa thông tin tài khoản (form trong drawer)
- **Khóa tài khoản** / **Kích hoạt tài khoản** - Bật/tắt quyền đăng nhập
- **Xóa** - Xóa vĩnh viễn tài khoản (không thể khôi phục)

**Lưu ý:** Tài khoản Admin gốc (ID=1) không thể bị khóa hoặc xóa để đảm bảo không mất quyền truy cập hệ thống.

---

## 13. Cổng thuyền viên (Seafarer Portal)

**Đường dẫn:** `/portal`

Khu vực riêng dành cho thuyền viên đăng nhập để xem và cập nhật thông tin cá nhân của mình.

### 13.1 Hồ sơ cá nhân (`/portal/profile`)

Thuyền viên có thể xem và cập nhật một số thông tin:

**Thông tin được phép sửa:**
- Giới tính
- Quốc tịch
- Số hộ chiếu + Ngày hết hạn hộ chiếu
- Số sổ thuyền viên + Ngày hết hạn sổ thuyền viên
- Điện thoại liên hệ
- Email
- Địa chỉ thường trú

**Thông tin chỉ xem (không sửa được):**
- Họ tên (do admin quản lý)
- Ngày sinh
- Số CCCD

Nhấn **Lưu** để cập nhật thông tin.

---

### 13.2 Chứng chỉ (`/portal/certificates`)

Thuyền viên quản lý danh sách chứng chỉ của mình.

#### Thông tin hiển thị

Bảng/thẻ chứng chỉ gồm: Loại chứng chỉ (tiếng Anh), Số hiệu, Ngày cấp, Ngày hết hạn, Trạng thái (VALID / EXPIRED / PENDING), File đính kèm

**Ngày hết hạn** hiển thị màu đỏ nếu đã quá hạn.

#### Thêm chứng chỉ mới

Nhấn **Thêm chứng chỉ** → modal nhập:
- **Loại chứng chỉ** *(bắt buộc)* - Chọn từ danh mục (có ô tìm kiếm)
- **Số hiệu chứng chỉ**
- **Ngày cấp**
- **Ngày hết hạn**
- **File đính kèm** - Hỗ trợ: PDF, JPG, PNG, WEBP, BMP, TIF, GIF

#### Xóa chứng chỉ

Chỉ có thể xóa chứng chỉ do chính mình thêm vào. Chứng chỉ do admin nhập không thể xóa từ portal.

---

### 13.3 Lịch sử hợp đồng (`/portal/history`)

Thuyền viên xem lại toàn bộ lịch sử các hợp đồng làm việc trên tàu.

Bảng hiển thị: Tên tàu, Loại tàu, Ngày bắt đầu, Ngày kết thúc, Trạng thái hợp đồng

Đây là trang chỉ xem, không có thao tác chỉnh sửa.

---

## Phụ lục: Quy trình nghiệp vụ thường dùng

### Quy trình tuyển dụng thuyền viên qua Job

```
1. Tạo Job (Partner + Tàu + Chức danh + Giá trị hợp đồng)
   ↓
2. Gán thuyền viên vào Job
   → Job chuyển sang trạng thái FILLED
   → Hệ thống tự tạo Deployment tương ứng
   ↓
3. Quản lý hợp đồng Deployment:
   collecting_docs → confirmed → pre_boarding → onboard → signed_off
   ↓
4. Ghi nhận thanh toán từ đối tác (trong trang Job)
   ↓
5. Tính lương thuyền viên (trong module Tài chính)
```

### Quy trình tính lương tháng

```
1. Vào module Tài chính → chọn tháng
   ↓
2. Nhập tỷ giá USD/VND cho tháng → Lưu
   ↓
3. Nhấn "Tạo bảng lương" (nếu chưa có)
   ↓
4. Kiểm tra và điều chỉnh: số ngày công, lương, tạm ứng, khấu trừ
   ↓
5. Đánh dấu đã thanh toán khi trả lương xong
```

### Thêm thuyền viên mới

```
1. /seafarers → Thêm thuyền viên (form tạo mới)
   - Hoặc Import Excel hàng loạt
   ↓
2. Điền đầy đủ thông tin cá nhân, học vấn
   ↓
3. Vào chi tiết → bổ sung: tài khoản ngân hàng, người thân
   ↓
4. Khi thuyền viên đăng nhập portal: tự cập nhật passport, sổ thuyền viên, chứng chỉ
```

---

*Tài liệu này mô tả hệ thống Marineport phiên bản hiện tại. Liên hệ quản trị viên nếu cần hỗ trợ thêm.*
