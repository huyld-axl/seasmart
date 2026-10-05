# TASKS - MarinePort

## 2026-03-18
- [x] Backend review (Fastify + MySQL + JWT)
  - Note: `refactoring/backend-review-fastify-mysql-2026-03-18.md`
- [x] Frontend review (React + Vite + Ant Design)
  - Note: `refactoring/frontend-review-react-vite-antd-2026-03-18.md`

## 2026-03-21
- [x] Tạo tài liệu nội bộ OJS: quy trình Viết -> Phê duyệt -> Đăng bài (PPTX 10 trang)
  - Note: `D:\estimate\OJS\ojs-design\ojs-write-approve-publish-guide-vi-10slides.pptx`

## 2026-04-21
- [x] Seafarer Detail: block Hợp đồng đọc theo bảng `job` (map `seafarer_id`) thay vì `employment_contract`
  - Backend: thêm filter `seafarer_id` cho `GET /api/v1/jobs`
  - Frontend: bỏ thao tác CRUD employment contract tại `SeafarerDetailPage`, chỉ hiển thị danh sách job đã map

- [ ] Deployment flow phase 1 - soft gate warning (không chặn thao tác)
  - [x] Backend: thêm warning engine khi chuyển trạng thái (`PUT /deployments/:id/status`)
  - [x] Backend: warning checklist chưa đủ theo mốc trạng thái
  - [x] Backend: warning passport dưới 18 tháng
  - [x] Backend: warning chứng chỉ dưới 12 tháng, có tùy chọn scope
  - [x] Backend: warning hồ sơ địa phương quá 6 tháng từ ngày nhập tay
  - [x] Frontend: gửi gate options (cert scope + ngày hồ sơ địa phương) khi chuyển trạng thái
  - [x] Frontend: hiển thị modal cảnh báo soft gate sau khi chuyển trạng thái
  - [ ] Test API + UI flow chuyển trạng thái với warnings
  - [ ] Hoàn thiện cấu hình “cert bắt buộc theo rank” (mapping)
  - [x] Lưu bền vững ngày hồ sơ địa phương (SYLY/CMND/CAM_KET) vào checklist notes để cảnh báo lần sau

- [ ] Deployment flow phase 2 - hardening & test
  - [ ] Viết test backend cho `evaluateSoftWarnings` (checklist, passport, cert, hồ sơ 6 tháng)
  - [ ] Viết test frontend cho đổi trạng thái bằng dropdown + cảnh báo vàng
  - [ ] Thiết kế mapping chứng chỉ bắt buộc theo chức danh (rank_required)
  - [x] UI upload optional evidence theo từng checklist item (1 item/1 file, hỗ trợ PDF/Word/Excel/ảnh, có tải xuống/xóa)

## 2026-04-22
- [x] Refactor domain `ship_owner` -> `partner` (DB/API/UI) cho nghiệp vụ đối tác trung gian
  - Backend: thêm route `/partners`, cập nhật lookup + job/vessel dùng `partner_id`, giữ compatibility cho payload cũ
  - Frontend: `/partners` đổi thành danh sách công ty đối tác, CRUD + lưu kỳ thanh toán thực tế
  - DB: cập nhật `migration.sql`, thêm migration `025_rename_ship_owner_to_partner.sql`
- [x] Job form: thêm trường kỳ thanh toán, mặc định theo đối tác và cho phép chỉnh tay
  - Backend: lưu `job.payment_cycle`, fallback theo `partner.payment_cycle` nếu payload không gửi
  - Frontend: thêm/sửa job có chọn đối tác + kỳ thanh toán (bao gồm option `YEARLY`)
  - DB: thêm migration `027_add_job_payment_cycle.sql`

- [x] Deployment-vessel hybrid sync theo IMO (snapshot + link)
  - Backend: thêm endpoint `GET /api/v1/vessels/external/:imo` (proxy + decrypt + upsert vessel)
  - Backend: thêm service giải mã dùng `ENC_KEY` env, hỗ trợ `refresh=1`
  - Backend/DB: thêm `seafarer_deployment.vessel_id` qua migration `026_deployment_vessel_link.sql`
  - Frontend: thêm input IMO + nút “Lấy thông tin tàu” trong modal tạo/sửa Deployment, autofill + lưu `vessel_id`

