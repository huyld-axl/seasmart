# Deploy PostgreSQL + backend + frontend

```sh
./deploy.sh
```

Script tự build hai image, chờ PostgreSQL, chạy migration có transaction và
checksum, kiểm tra kết nối/schema, khởi động app và chờ health check. Yêu cầu Docker
Compose 2.30+, Bash, flock, openssl. Deploy thông thường không cần Node trên host.
Script không pull Git, không tự xoá volume hay reset dữ liệu.

| Dịch vụ | Địa chỉ mặc định |
| --- | --- |
| Frontend / Nginx | `http://localhost:8080` |
| Backend | `http://127.0.0.1:3000` |
| PostgreSQL | `127.0.0.1:5433` |

Frontend Docker mặc định gọi `/api/v1` qua Nginx tới backend. Dùng biến
`FRONTEND_API_URL` khi muốn endpoint khác. `backend/.env` cung cấp cấu hình AI,
email và JWT tuỳ chọn. Kết nối PostgreSQL trong Docker lấy từ `docker/postgres.env`;
script tạo mật khẩu ngẫu nhiên ở lần chạy đầu, quyền file 600. JWT được tạo riêng
trong `docker/jwt_secret` nếu chưa có. Các lần deploy sau dùng lại những file này.
Nếu đổi mật khẩu trong file sau khi đã có database, cần đổi mật khẩu trong
PostgreSQL tương ứng.

Hai file `.env` hiện tại không bị sửa hoặc đưa vào image. Frontend dùng BuildKit
secret mount và tắt thông tin đăng nhập demo trong bản build deploy. Backend nhận
secret lúc chạy và chạy Node bằng user không phải root. Không đưa key bí mật vào
biến `VITE_*`, vì biến dùng ở frontend được đưa vào JavaScript công khai.

Các lệnh:

```sh
./deploy.sh --build-only
./deploy.sh --postgres-only
./deploy.sh --status
./deploy.sh --stop
```

`--stop` chỉ dừng stack Compose, giữ PostgreSQL và upload volume.
`WEB_PORT`, `WEB_BIND`, `BACKEND_PORT`, `POSTGRES_PORT` đổi cổng/bind.
`CORS_ORIGINS` khai báo các origin khi dùng domain hoặc frontend khác.
`FORMS_HOST_DIR=/absolute/path/to/forms` mount thư mục mẫu Excel thật chỉ đọc;
Docker backend có LibreOffice để xuất PDF. Upload dùng volume riêng: muốn giữ file
cũ cần sao chép upload vào volume trước khi chuyển sang stack Docker.

Máy Linux chặn kết nối ra ngoài từ Docker bridge có thể build bằng:

```sh
BUILD_NETWORK=host ./deploy.sh
```

Tuỳ chọn chỉ đổi mạng lúc build; mạng runtime vẫn là Docker bridge.

## Chuyển dữ liệu MySQL cũ

Backend hiện dùng `pg` và SQL PostgreSQL. Migration mới nằm ở
`backend/migrations/postgres/`. Các file MySQL cũ được giữ để tham chiếu; không gửi
chúng vào PostgreSQL. Schema mới có đủ chức năng qua migration MySQL 027, gồm
`export_pack.ship_owner_id` và `edits`; seed chỉ có danh mục, không có tài khoản
hoặc dữ liệu cá nhân.

Với MySQL local đã được tạo trong container `seasmart-mysql`, có thể sao chép một
lần sau khi build image:

```sh
./deploy.sh --import-mysql
```

Cần Node và dependencies của backend trên host. Đổi container nguồn bằng
`MYSQL_SOURCE_CONTAINER`. Lệnh đọc dữ liệu qua Docker, không in mật khẩu/hash/nội
dung bản ghi, giữ ID, cập nhật sequence và dùng transaction. PostgreSQL đích phải
chưa có bản ghi nghiệp vụ; nếu đã có, script từ chối và không thay đổi dữ liệu.
Danh mục mặc định ở database mới được thay bằng danh mục nguồn để khớp các ID.
MySQL nguồn không bị sửa hoặc xoá. Các link ký online cũ không còn sử dụng được
sau khi chuyển, theo nghiệp vụ hiện tại. Backup database và các file secret trước
khi triển khai trên máy chủ.

MySQL reader luôn dùng `--default-character-set=utf8mb4` và kiểm tra UTF-8 trước
khi nhập dữ liệu. Với dữ liệu đã nhập bằng bản script cũ dùng latin1,
`node backend/scripts/repair_mysql_encoding.js` chỉ thống kê các ô có thể khôi
phục từ nguồn MySQL. Sau khi sao lưu PostgreSQL, thêm `--apply` để khôi phục các
giá trị còn khớp bản lỗi cũ; các giá trị đã sửa và bản ghi mới được giữ nguyên.
Khởi động lại backend sau đó để làm mới cache danh mục.

Nếu cài mới hoàn toàn, tạo admin bằng:

```sh
docker compose --env-file /dev/null run --rm --no-deps -it backend npm run seed:admin
```

Script hỏi email, mật khẩu và xác nhận; mật khẩu nhập không hiển thị.
