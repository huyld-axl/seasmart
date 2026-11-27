# Catoro — Quy trình phát hành app máy tính

Theo `docs/catoro-ke-hoach-desktop-gd6.md`. Người phát hành làm theo đúng thứ tự.

## Ai giữ gì

| Thứ | Ở đâu | Ghi chú |
|---|---|---|
| Khoá riêng ký bản phát hành | Máy phát hành (máy dev của chủ dự án): `desktop/.release/release-key.pem` | **Không commit, không gửi qua chat / email.** Cất thêm một bản sao ngoài máy (USB, két). Mất khoá này: app đã cài không nhận bản cập nhật mới, khách phải cài lại tay |
| Khoá công khai | `desktop/build/release-public-key.pem` (trong repo) | Mọi máy build dùng; không bí mật |
| Đích đẩy bộ cài | `CATORO_RELEASE_TARGET=mcah-release@mcah.axalize.vn:/srv/mcah/releases` (tên cũ `MCAH_RELEASE_TARGET` vẫn nhận, có dòng nhắc) | Server làm theo `docs/catoro-huong-dan-server-may-chu-dich-vu.md`, mục "Chỗ phát bộ cài" |

Lần đầu trên máy phát hành mới (chưa từng có khoá): `node desktop/scripts/release-key.js --init`, commit `desktop/build/release-public-key.pem`. Không chạy lại khi đã có khoá.

## Luật phiên bản (đọc trước mỗi lần build)

Máy Ubuntu ở văn phòng là máy phát hành (giữ khoá ký). Bộ cài do CI build (`.github/workflows/desktop-build.yml`, bốn job song song trên đúng một commit): Ubuntu `.deb`, Windows `.exe`, macOS chip Apple `Catoro-<phiên bản>-arm64.dmg`, macOS chip Intel `Catoro-<phiên bản>-x64.dmg`. Không build tay nữa.

1. **Một phiên bản = một commit.** CI build cả bốn từ cùng commit nên luôn đúng. Script phát hành vẫn chặn nếu các bản khác commit.
2. **Sửa code thì nâng phiên bản trong cùng đợt:** nâng `desktop/package.json`, viết `release-notes/<phiên bản>.md`, chạy `npm run notes:page`, commit, **push `dev`**.
3. **Không dùng lại số đã phát hành cho code khác.** Trước khi nâng, xem số đang phát: https://mcah.axalize.vn/download/files/beta/latest.json. Số đó đã có trên trang mà code đã đổi thì lên số kế tiếp.
4. **Không đổi tên bộ cài.** Số phiên bản nằm bên trong tệp lúc build; đổi tên tệp không đổi được phiên bản. (Từ 0.9.14 bộ cài do build ra mang tên mới `catoro-desktop_<phiên bản>_amd64.deb` và `Catoro Setup <phiên bản>.exe` vì sản phẩm đổi tên MCAH → Catoro; đó là tên build, không phải đổi tay.)
5. Số phiên bản không giới hạn: sau 0.9.9 là 0.9.10.

### Luồng thường

1. Sửa, test, nâng phiên bản, ghi chú, `notes:page`, commit, push `dev`.
2. Push `dev` có đổi `desktop/` thì CI tự chạy (hoặc GitHub > Actions > "Desktop build" > Run workflow, khi workflow đã có ở nhánh mặc định). Đợi cả bốn job xanh.
3. Cài thử từ artifact (phần này vẫn là người làm). Bản macOS: theo `docs/catoro-testcase-desktop-macos.md`.
4. Máy phát hành, trong `desktop/`: tải bốn artifact `catoro-installer-linux`, `-win`, `-mac-arm64`, `-mac-x64` về `dist/installer/` (một thư mục phẳng, gồm `.deb`, `.exe`, hai `.dmg`, bốn `build-info-*.json`), rồi `npm run release -- --channel beta`. Mở trang tải kiểm các nút.

Sửa lỗi sau khi cài thử: nâng số kế tiếp, push, chạy lại CI. Không cần phối hợp giữa hai máy.

### Hotfix một hệ điều hành

Vẫn nâng số chung và chạy CI cả bốn job; bản của hệ điều hành khác chỉ khác số phiên bản. Chỉ khi cần phát gấp một bản trước mới dùng `npm run release -- --channel beta --allow-missing win` (hoặc `linux`, `mac` = cả hai bản macOS, `mac-x64`…; nhiều thứ cách nhau dấu phẩy), rồi phát lại không cờ khi có đủ.

Lưu ý: hiện chỉ có kênh `beta`, mọi máy đã cài đều nhận hotfix. Khi có khách thật, đưa khách sang `stable` (`--promote`) và chỉ phát hotfix trên `beta`.

## Mỗi lần phát hành

1. Commit hết thay đổi. Đổi phiên bản: trong `desktop/`, `npm version 1.2.0 --no-git-tag-version`.
2. Viết `desktop/release-notes/1.2.0.md`: gạch đầu dòng tiếng Việt, người dùng đọc được (không thuật ngữ code), không cần chi tiết. Trong `desktop/` chạy `npm run notes:page` để thêm bản vào trang ghi chú phát hành trên web (`frontend/public/release-notes/index.html`, `/release-notes/index.html`; test chặn nếu quên). Commit.
3. Push `dev`, chạy workflow "Desktop build" trên GitHub (xem "Luồng thường"), tải bốn artifact về `desktop/dist/installer/` của máy phát hành. Địa chỉ máy chủ và chỗ phát lấy từ `desktop/endpoints.json`.
4. Cài thử các bản.
5. Phát kênh thử nghiệm: `npm run release -- --channel beta`. Script dừng nếu thiếu một hệ điều hành, hai bản khác commit, còn thay đổi chưa commit, thiếu ghi chú, chưa quét bí mật, hoặc khoá không khớp.
6. Chạy thử với văn phòng thử nghiệm. Ổn thì đưa sang kênh ổn định (không build lại): `npm run release -- --promote 1.2.0`.

Không có `CATORO_RELEASE_TARGET` thì bản phát chỉ nằm ở `desktop/dist/updates/<kênh>/` (thử trên máy).

## Thứ tự trên server

Script đẩy bộ cài trước, `releases.json` và `latest.json` sau cùng; giữ 3 phiên bản gần nhất mỗi kênh (máy cần quay về bản cũ dùng). `releases.json` liệt kê các bản còn giữ (tên tệp, SHA-256, cỡ, ngày phát); trang tải đọc nó để hiện mục "Bản cũ hơn" (kênh ổn định, `/download/files/releases.json`). Lần phát đầu sau khi có tính năng này mới sinh ra tệp; trước đó trang tải ẩn mục này. Kiểm: `https://mcah.axalize.vn/download` hiện đúng bản mới.

## Đổi tên miền

1. Dựng tên mới trên server (tài khoản `/tai-khoan`, `/download/files/`), giữ tên cũ chạy song song.
2. Sửa `desktop/endpoints.json`, commit, phát một bản như thường. Đẩy `latest.json` lên **cả chỗ phát cũ lẫn mới** (chạy `npm run release` hai lần với hai `CATORO_RELEASE_TARGET`, hoặc chép tay `latest.json` sang chỗ cũ).
3. App đang chạy kiểm bản mới ở chỗ cũ, thấy địa chỉ mới trong bản tin đã ký thì tự chuyển sang, không cần cài lại.
4. Giữ tên cũ chuyển hướng 308 vài tháng cho máy lâu không mở. Thêm Redirect URI Google cho tên mới, đổi `CLOUD_PUBLIC_URL` trong `cloud/.env` trên server.

## Phát thiếu một bản

Cần phát một bản trước khi bản kia xong: thêm `--allow-missing win` (hoặc `mac`; bản có mặt vẫn kiểm đủ). Khi có bản còn thiếu cùng commit, chạy lại lệnh phát hành cùng phiên bản không có cờ này, `latest.json` sẽ có đủ các bản.

## macOS: chưa có chữ ký Apple

Bản macOS ký ad-hoc (`build.mac.identity: "-"` trong `desktop/package.json`), chưa có Apple Developer ID nên chưa notarize; `latest.json` ghi `mac_signed: false` và trang tải hiện hướng dẫn "Quyền riêng tư & Bảo mật → Vẫn mở". Khi có tài khoản Apple Developer: thêm chứng chỉ vào secret CI (`CSC_LINK`, `CSC_KEY_PASSWORD`) và thông tin notarize (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), bỏ `identity: "-"`, bật `hardenedRuntime` + `notarize`, đổi `mac_signed` trong `desktop/scripts/release.js`.

Tự cập nhật trên Mac thay Catoro.app ngay chỗ đang nằm, không hỏi mật khẩu; app phải nằm trong thư mục Ứng dụng (mở thẳng từ .dmg hoặc Tải về thì báo lỗi, hướng dẫn kéo vào Ứng dụng).

## Trang hướng dẫn và ghi chú phát hành

Chỉ có bản trên web: `/guide/` và `/release-notes/` (thư mục `frontend/public/`; tên cũ `/huong-dan/`, `/phat-hanh/` chuyển 301). App máy tính không gói hai trang này; bấm link trong app thì mở bản web bằng trình duyệt, tên miền lấy theo máy chủ dịch vụ (`desktop/src/main.js`, `webPageUrl`). Sửa trang chỉ cần triển khai web, không cần phát bản app.
