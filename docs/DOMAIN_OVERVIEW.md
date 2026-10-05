# Domain Overview

## Mục tiêu hệ thống

Crew Manning là hệ thống quản lý hồ sơ thuyền viên và vận hành nhu cầu tuyển người đi tàu.

Hệ thống hiện tập trung vào 3 bài toán:

- quản lý hồ sơ thuyền viên,
- quản lý nhu cầu tuyển người theo job/deployment,
- quản lý đối tác, tàu, chứng chỉ và biểu mẫu phục vụ điều động.

## Thực thể chính

### 1. `seafarer`

Hồ sơ trung tâm của hệ thống.

Một thuyền viên thường có:

- thông tin cá nhân,
- liên hệ,
- chứng chỉ,
- lịch sử công tác / hợp đồng,
- deployment đang hoặc sẽ đi,
- trạng thái sẵn sàng đi tàu.

Nếu cần hiểu dự án từ đầu, hãy đọc module này trước.

### 2. `certificate`

Chứng chỉ gắn với từng thuyền viên.

Dùng để:

- kiểm tra đủ điều kiện lên tàu,
- cảnh báo sắp hết hạn,
- làm dữ liệu đầu vào cho soft warning khi đổi trạng thái deployment.

### 3. `partner`

Đối tác trung gian hoặc công ty liên quan đến nhu cầu tuyển dụng.

Hiện domain này là phần thay thế cho tên cũ `ship_owner` trong nhiều luồng.
Code vẫn giữ compatibility ở một số route/payload cũ, nhưng về nghiệp vụ nên hiểu là `partner`.

### 4. `vessel`

Thông tin tàu.

Tàu có thể:

- được quản lý nội bộ,
- được đồng bộ từ nguồn ngoài theo IMO,
- được link vào deployment để chốt hồ sơ đi tàu.

### 5. `job`

Nhu cầu tuyển người hoặc vị trí cần đi tàu.

Job thường gắn với:

- đối tác,
- tàu,
- vị trí/rank,
- kỳ thanh toán,
- các điều kiện tuyển chọn.

### 6. `deployment`

Đây là luồng vận hành quan trọng nhất.

Deployment biểu diễn việc một thuyền viên đang được điều động cho một job/tàu cụ thể, đi qua các trạng thái như chuẩn bị hồ sơ, xác nhận, pre-boarding, onboard, signed off.

Khi làm feature liên quan vận hành, thường sẽ chạm vào:

- `job`,
- `deployment`,
- `certificate`,
- checklist / soft warnings.

### 7. `user`

Tài khoản đăng nhập backend/frontend admin.

Role hiện thấy trong code:

- `admin`,
- `operator`,
- `accountant`,
- `seafarer`,

Về UI hiện tại, các role vận hành chính là:

- Chủ doanh nghiệp,
- Chuyên viên,
- Kế toán.

## Luồng nghiệp vụ chính

### Luồng 1: Quản lý hồ sơ thuyền viên

1. Tạo hoặc import thuyền viên.
2. Bổ sung liên hệ, chứng chỉ, lịch sử công tác.
3. Theo dõi trạng thái sẵn sàng và dữ liệu hồ sơ.

### Luồng 2: Quản lý nhu cầu tuyển và đối tác

1. Tạo/cập nhật đối tác.
2. Quản lý tàu thuộc đối tác hoặc liên quan đối tác.
3. Tạo job để mô tả nhu cầu tuyển.

### Luồng 3: Điều động thuyền viên

1. Chọn thuyền viên phù hợp cho job.
2. Tạo deployment.
3. Chuyển trạng thái deployment theo tiến độ hồ sơ.
4. Hệ thống kiểm tra warning về passport, certificate, checklist và dữ liệu hồ sơ.
5. Khi hoàn tất, deployment chuyển sang onboard hoặc signed off.

## Các phần đã bị loại khỏi sản phẩm

Các khái niệm sau còn dấu vết trong code/docs cũ nhưng không còn là hướng chính của hệ thống hiện tại:

- training center,
- training course,
- enrollment flow,
- một phần notification/waitlist cũ.

Nếu gặp route/file cũ liên quan các phần này, cần xem đó là legacy hoặc backlog cũ, không phải luồng nghiệp vụ chính hiện tại.

## Nguồn sự thật nên đọc khi onboarding

Theo thứ tự ưu tiên:

1. `frontend/src/App.jsx`
2. `backend/src/routes/v1/index.js`
3. `migration.sql`
4. `docs/ARCHITECTURE.md`
5. `tasks/README.md`
