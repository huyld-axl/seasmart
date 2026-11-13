# MCAH — Quy trình phát hành app máy tính

Theo `docs/mcah-ke-hoach-desktop-gd6.md`. Người phát hành làm theo đúng thứ tự.

## Ai giữ gì

| Thứ | Ở đâu | Ghi chú |
|---|---|---|
| Khoá riêng ký bản phát hành | Máy phát hành (máy dev của chủ dự án): `desktop/.release/release-key.pem` | **Không commit, không gửi qua chat / email.** Cất thêm một bản sao ngoài máy (USB, két). Mất khoá này: app đã cài không nhận bản cập nhật mới, khách phải cài lại tay |
| Khoá công khai | `desktop/build/release-public-key.pem` (trong repo) | Mọi máy build dùng; không bí mật |
| Đích đẩy bộ cài | `MCAH_RELEASE_TARGET=mcah-release@mcah.axalize.vn:/srv/mcah/releases` | Server làm theo `docs/mcah-huong-dan-server-may-chu-dich-vu.md`, mục "Chỗ phát bộ cài" |

Lần đầu trên máy phát hành mới (chưa từng có khoá): `node desktop/scripts/release-key.js --init`, commit `desktop/build/release-public-key.pem`. Không chạy lại khi đã có khoá.

## Mỗi lần phát hành

1. Commit hết thay đổi. Đổi phiên bản: trong `desktop/`, `npm version 1.2.0 --no-git-tag-version`.
2. Viết `desktop/release-notes/1.2.0.md`: gạch đầu dòng tiếng Việt, người dùng đọc được (không thuật ngữ code). Commit.
3. Máy Ubuntu, trong `desktop/`:

   ```bash
   npm run dist:linux
   ```

   Địa chỉ máy chủ và chỗ phát lấy từ `desktop/endpoints.json` (không đặt biến môi trường khi build bản phát hành).
4. Máy Windows, cùng commit: `npm run dist:win`. Chép `dist/installer/MCAH Setup 1.2.0.exe` và `dist/installer/build-info-win.json` về `desktop/dist/installer/` của máy phát hành.
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
