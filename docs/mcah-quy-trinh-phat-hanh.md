# MCAH — Quy trình phát hành app máy tính

Theo `docs/mcah-ke-hoach-desktop-gd6.md`. Người phát hành làm theo đúng thứ tự.

## Ai giữ gì

| Thứ | Ở đâu | Ghi chú |
|---|---|---|
| Khoá riêng ký bản phát hành | Máy phát hành (máy dev của chủ dự án): `desktop/.release/release-key.pem` | **Không commit, không gửi qua chat / email.** Cất thêm một bản sao ngoài máy (USB, két). Mất khoá này: app đã cài không nhận bản cập nhật mới, khách phải cài lại tay |
| Khoá công khai | `desktop/build/release-public-key.pem` (trong repo) | Mọi máy build dùng; không bí mật |
| Đích đẩy bộ cài | `MCAH_RELEASE_TARGET=mcah-release@mcah.axalize.dev:/srv/mcah/releases` | Server làm theo `docs/mcah-huong-dan-server-may-chu-dich-vu.md`, mục "Chỗ phát bộ cài" |

Lần đầu trên máy phát hành mới (chưa từng có khoá): `node desktop/scripts/release-key.js --init`, commit `desktop/build/release-public-key.pem`. Không chạy lại khi đã có khoá.

## Mỗi lần phát hành

1. Commit hết thay đổi. Đổi phiên bản: trong `desktop/`, `npm version 1.2.0 --no-git-tag-version`.
2. Viết `desktop/release-notes/1.2.0.md`: gạch đầu dòng tiếng Việt, người dùng đọc được (không thuật ngữ code). Commit.
3. Máy Ubuntu, trong `desktop/`:

   ```bash
   MCAH_CLOUD_URL=https://mcah.axalize.dev/tai-khoan MCAH_UPDATE_URL=https://mcah.axalize.dev/download/files npm run dist:linux
   ```

4. Máy Windows, cùng commit, cùng biến môi trường: `npm run dist:win`. Chép `dist/installer/MCAH Setup 1.2.0.exe` và `dist/installer/build-info-win.json` về `desktop/dist/installer/` của máy phát hành.
5. Phát kênh thử nghiệm: `npm run release -- --channel beta`. Script dừng nếu thiếu một hệ điều hành, hai bản khác commit, còn thay đổi chưa commit, thiếu ghi chú, chưa quét bí mật, hoặc khoá không khớp.
6. Chạy thử với văn phòng thử nghiệm. Ổn thì đưa sang kênh ổn định (không build lại): `npm run release -- --promote 1.2.0`.

Không có `MCAH_RELEASE_TARGET` thì bản phát chỉ nằm ở `desktop/dist/updates/<kênh>/` (thử trên máy).

## Thứ tự trên server

Script đẩy bộ cài trước, `latest.json` sau cùng; giữ 3 phiên bản gần nhất mỗi kênh (máy cần quay về bản cũ dùng). Kiểm: `https://mcah.axalize.dev/download` hiện đúng bản mới.
