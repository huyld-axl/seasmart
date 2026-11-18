# MCAH — Quy trình phát hành app máy tính

Theo `docs/mcah-ke-hoach-desktop-gd6.md`. Người phát hành làm theo đúng thứ tự.

## Ai giữ gì

| Thứ | Ở đâu | Ghi chú |
|---|---|---|
| Khoá riêng ký bản phát hành | Máy phát hành (máy dev của chủ dự án): `desktop/.release/release-key.pem` | **Không commit, không gửi qua chat / email.** Cất thêm một bản sao ngoài máy (USB, két). Mất khoá này: app đã cài không nhận bản cập nhật mới, khách phải cài lại tay |
| Khoá công khai | `desktop/build/release-public-key.pem` (trong repo) | Mọi máy build dùng; không bí mật |
| Đích đẩy bộ cài | `MCAH_RELEASE_TARGET=mcah-release@mcah.axalize.vn:/srv/mcah/releases` | Server làm theo `docs/mcah-huong-dan-server-may-chu-dich-vu.md`, mục "Chỗ phát bộ cài" |

Lần đầu trên máy phát hành mới (chưa từng có khoá): `node desktop/scripts/release-key.js --init`, commit `desktop/build/release-public-key.pem`. Không chạy lại khi đã có khoá.

## Luật phiên bản (đọc trước mỗi lần build)

Máy Ubuntu ở văn phòng là máy phát hành (giữ khoá ký). Bộ cài Ubuntu và Windows do CI build (`.github/workflows/desktop-build.yml`, hai job song song trên đúng một commit); không build Windows tay nữa.

1. **Một phiên bản = một commit.** CI build cả hai từ cùng commit nên luôn đúng. Script phát hành vẫn chặn nếu hai bản khác commit.
2. **Sửa code thì nâng phiên bản trong cùng đợt:** nâng `desktop/package.json`, viết `release-notes/<phiên bản>.md`, chạy `npm run notes:page`, commit, **push `dev`**.
3. **Không dùng lại số đã phát hành cho code khác.** Trước khi nâng, xem số đang phát: https://mcah.axalize.vn/download/files/beta/latest.json. Số đó đã có trên trang mà code đã đổi thì lên số kế tiếp.
4. **Không đổi tên bộ cài.** Số phiên bản nằm bên trong tệp lúc build; đổi tên tệp không đổi được phiên bản.
5. Số phiên bản không giới hạn: sau 0.9.9 là 0.9.10.

### Luồng thường

1. Sửa, test, nâng phiên bản, ghi chú, `notes:page`, commit, push `dev`.
2. GitHub > Actions > "Desktop build" > Run workflow (nhánh `dev`). Đợi cả hai job xanh.
3. Cài thử bản Windows và Ubuntu từ artifact (phần này vẫn là người làm).
4. Máy phát hành, trong `desktop/`: tải artifact `mcah-installer-linux` và `mcah-installer-win` về `dist/installer/` (một thư mục phẳng, gồm `.deb`, `.exe`, hai `build-info-*.json`), rồi `npm run release -- --channel beta`. Mở trang tải kiểm hai nút.

Sửa lỗi sau khi cài thử: nâng số kế tiếp, push, chạy lại CI. Không cần phối hợp giữa hai máy.

### Hotfix một hệ điều hành

Vẫn nâng số chung và chạy CI cả hai job; bản của hệ điều hành kia chỉ khác số phiên bản. Chỉ khi cần phát gấp một bản trước mới dùng `npm run release -- --channel beta --allow-missing win` (hoặc `linux`), rồi phát lại không cờ khi có đủ.

Lưu ý: hiện chỉ có kênh `beta`, mọi máy đã cài đều nhận hotfix. Khi có khách thật, đưa khách sang `stable` (`--promote`) và chỉ phát hotfix trên `beta`.

## Mỗi lần phát hành

1. Commit hết thay đổi. Đổi phiên bản: trong `desktop/`, `npm version 1.2.0 --no-git-tag-version`.
2. Viết `desktop/release-notes/1.2.0.md`: gạch đầu dòng tiếng Việt, người dùng đọc được (không thuật ngữ code), không cần chi tiết. Trong `desktop/` chạy `npm run notes:page` để thêm bản vào trang ghi chú phát hành trên web (`frontend/public/release-notes/index.html`, `/release-notes/index.html`; test chặn nếu quên). Commit.
3. Push `dev`, chạy workflow "Desktop build" trên GitHub (xem "Luồng thường"), tải hai artifact về `desktop/dist/installer/` của máy phát hành. Địa chỉ máy chủ và chỗ phát lấy từ `desktop/endpoints.json`.
4. Cài thử cả hai bản.
5. Phát kênh thử nghiệm: `npm run release -- --channel beta`. Script dừng nếu thiếu một hệ điều hành, hai bản khác commit, còn thay đổi chưa commit, thiếu ghi chú, chưa quét bí mật, hoặc khoá không khớp.
6. Chạy thử với văn phòng thử nghiệm. Ổn thì đưa sang kênh ổn định (không build lại): `npm run release -- --promote 1.2.0`.

Không có `MCAH_RELEASE_TARGET` thì bản phát chỉ nằm ở `desktop/dist/updates/<kênh>/` (thử trên máy).

## Thứ tự trên server

Script đẩy bộ cài trước, `latest.json` sau cùng; giữ 3 phiên bản gần nhất mỗi kênh (máy cần quay về bản cũ dùng). Kiểm: `https://mcah.axalize.vn/download` hiện đúng bản mới.

## Đổi tên miền

1. Dựng tên mới trên server (tài khoản `/tai-khoan`, `/download/files/`), giữ tên cũ chạy song song.
2. Sửa `desktop/endpoints.json`, commit, phát một bản như thường. Đẩy `latest.json` lên **cả chỗ phát cũ lẫn mới** (chạy `npm run release` hai lần với hai `MCAH_RELEASE_TARGET`, hoặc chép tay `latest.json` sang chỗ cũ).
3. App đang chạy kiểm bản mới ở chỗ cũ, thấy địa chỉ mới trong bản tin đã ký thì tự chuyển sang, không cần cài lại.
4. Giữ tên cũ chuyển hướng 308 vài tháng cho máy lâu không mở. Thêm Redirect URI Google cho tên mới, đổi `CLOUD_PUBLIC_URL` trong `cloud/.env` trên server.

## Phát thiếu một bản

Cần phát một bản trước khi bản kia xong: thêm `--allow-missing win` (bản có mặt vẫn kiểm đủ). Khi có bản Windows cùng commit, chạy lại lệnh phát hành cùng phiên bản không có cờ này, `latest.json` sẽ có đủ hai bản.

## Trang hướng dẫn và ghi chú phát hành

Chỉ có bản trên web: `/guide/` và `/release-notes/` (thư mục `frontend/public/`; tên cũ `/huong-dan/`, `/phat-hanh/` chuyển 301). App máy tính không gói hai trang này; bấm link trong app thì mở bản web bằng trình duyệt, tên miền lấy theo máy chủ dịch vụ (`desktop/src/main.js`, `webPageUrl`). Sửa trang chỉ cần triển khai web, không cần phát bản app.
