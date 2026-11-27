---
name: phat-hanh
description: Phát hành bản mới app máy tính Catoro từ đầu tới cuối - nâng phiên bản, viết ghi chú phát hành, commit và push dev, tạo PR dev → main đủ tiêu đề và mô tả, chờ CI build đủ Ubuntu / Windows / Mac, tải bộ cài về rồi đẩy lên trang tải (beta rồi stable). Dùng khi người dùng nói "phát hành", "ra bản mới", "release", "đẩy bản mới lên trang tải", "publish bản mới".
---

# Phát hành bản mới Catoro

Người dùng nói "phát hành" là chạy hết các bước dưới, **không hỏi lại** (chủ dự án chọn). Chỉ dừng khi một kiểm tra
không qua: báo rõ bước nào, vì sao, cần người dùng làm gì, rồi chờ.

Luật gốc ở `docs/catoro-quy-trinh-phat-hanh.md` ("Luật phiên bản"). Skill này là cách làm từng bước; hai chỗ vênh nhau thì
theo tài liệu đó và sửa skill.

Thứ tự khác với cách người dùng kể ("đẩy dev → PR → build → ghi chú → trang tải"): ghi chú phát hành phải viết **trước**
khi commit, vì CI build từ commit và script phát hành chặn khi thiếu `desktop/release-notes/<phiên bản>.md`.

Giữ danh sách việc (task list) theo đúng 8 bước dưới.

## 0. Kiểm đầu vào

Chạy trong `seasmart/` (repo git). Không qua mục nào thì dừng.

```bash
git branch --show-current          # phải là dev
gh auth status                     # phải đăng nhập github.com
test -f desktop/.release/release-key.pem && echo "có khoá ký"   # chỉ kiểm có tệp, KHÔNG đọc nội dung
git fetch origin && git status -sb # dev không được tụt sau origin/dev
```

- Chưa có `gh` hoặc chưa đăng nhập: dừng, đưa người dùng hai lệnh `sudo apt install gh` và `gh auth login`
  (chọn GitHub.com, HTTPS, đăng nhập qua trình duyệt), mỗi lệnh một khối `bash`.
- Không có khoá ký: máy này không phải máy phát hành, dừng.
- Không đọc, không grep tệp `.env` nào.

## 1. Chọn số phiên bản

```bash
curl -s https://mcah.axalize.vn/download/files/latest.json | node -p "JSON.parse(require('fs').readFileSync(0)).version"
curl -s https://mcah.axalize.vn/download/files/beta/latest.json | node -p "JSON.parse(require('fs').readFileSync(0)).version"
node -p "require('./desktop/package.json').version"
```

- Số đang phát = số lớn hơn trong hai kênh.
- `desktop/package.json` **lớn hơn** số đang phát: số đó chưa phát, giữ nguyên.
- **Bằng** số đang phát: nâng số kế tiếp (`0.9.15` → `0.9.16`, số không giới hạn: `0.9.9` → `0.9.10`):
  `cd desktop && npm version <số mới> --no-git-tag-version`.
- Không bao giờ dùng lại số đã phát cho code khác, không đổi tên tệp bộ cài.
- Commit của bản đang phát là commit đã đưa số đó vào (cũ nhất trong các commit đụng chuỗi đó; mới nhất là commit nâng
  số tiếp theo): `git log --reverse --format=%H -S'"version": "<số đang phát>"' -- desktop/package.json | head -1`.
  Không có commit nào sau đó và working tree sạch: dừng, báo "không có gì mới để phát".

## 2. Ghi chú phát hành (`desktop/release-notes/<phiên bản>.md`)

- Đọc mọi commit từ commit của bản đang phát tới HEAD (`git log --format='%h %s%n%b' <commit>..HEAD`) cộng thay đổi chưa
  commit. Tệp đã có (số chưa phát, viết dở từ trước) thì viết lại cho phủ đủ các thay đổi đó.
- Viết như `desktop/release-notes/0.9.14.md`: 2–6 gạch đầu dòng tiếng Việt, người dùng (nhân viên môi giới) đọc được,
  nói cái họ thấy hay làm được, không thuật ngữ code, không tên tệp. Gom thay đổi nhỏ, bỏ thay đổi chỉ dành cho người làm
  (CI, script phát hành, tài liệu nội bộ).
- `cd desktop && npm run notes:page` (cập nhật `frontend/public/release-notes/index.html`; test chặn nếu quên).

## 3. Kiểm trước khi commit

```bash
cd desktop && npm test
cd ../backend && npm run lint && npm test
cd ../frontend && npm run lint && npm test
```

Test hỏng thì dừng, báo test nào hỏng. Không sửa test cho qua.

Lint lỗi: xem tệp lỗi có khác `origin/main` không (`git diff --quiet origin/main -- <tệp>`). Tệp không đổi so với `main`
là lỗi có từ trước, không chặn phát hành: ghi từng lỗi vào mục **Chưa kiểm** của PR và báo cáo cuối. Lỗi ở tệp đợt này
có đổi thì dừng như test hỏng.

## 4. Commit và push `dev`

- `git status` xem hết thay đổi. Commit **mọi** thay đổi của đợt này. Tệp nào không rõ có thuộc đợt phát hành không
  (đã sửa từ lâu, không liên quan các commit) thì để ngoài commit và ghi vào báo cáo cuối, không hỏi.
- Một commit cho cả đợt (luật gộp commit). Tiêu đề: `App máy tính <phiên bản>: <tóm tắt ngắn các thay đổi chính>`,
  thân là gạch đầu dòng các thay đổi, cuối thân có dòng attribution theo nhắc nhở hệ thống.
- `git push origin dev`. Commit đổi `desktop/package.json` hay `desktop/` nên CI tự chạy.

## 5. PR `dev` → `main`

- `git log --format='%h %s' origin/main..origin/dev` lấy mọi commit sẽ vào PR.
- Tiêu đề: `Catoro <phiên bản>: <tóm tắt>`. Mô tả tiếng Việt, đủ các mục:
  **Tóm tắt** (gạch đầu dòng theo từng commit, nói bằng việc), **Migration** (tệp mới trong `backend/migrations/postgres`
  hoặc "không có"), **Đã kiểm** (test bước 3, CI), **Chưa kiểm** (cài thử tay trên Windows / Mac, luồng cần dữ liệu thật),
  **App máy tính** (phiên bản, link CI), dòng cuối attribution theo nhắc nhở hệ thống.
- Đã có PR mở từ `dev` vào `main` (`gh pr list --base main --head dev --state open`): `gh pr edit <số> --title … --body-file …`.
  Chưa có: `gh pr create --base main --head dev --title … --body-file …`. Viết mô tả ra tệp trong thư mục nháp, không vào repo.
- **Không merge, không bật auto-merge.** Gắn PR vào phiên bằng công cụ PR của app nếu có.

## 6. Chờ CI build đủ các hệ điều hành

```bash
bash .claude/skills/phat-hanh/scripts/ci-artifacts.sh
```

Chạy nền (`run_in_background`): một lượt CI mất khoảng 5–10 phút; không ngồi hỏi trạng thái, chờ thông báo xong.
Script chờ lượt CI của đúng commit HEAD, tải `catoro-installer-{linux,win,mac-arm64,mac-x64}` vào `desktop/dist/installer/`
(phẳng: `.deb`, `.exe`, hai `.dmg`, bốn `build-info-*.json`) và kiểm mọi bản build từ đúng commit đó.
CI lỗi: script in log bước hỏng. Dừng, tóm tắt lỗi cho người dùng; sửa được trong code thì đề xuất sửa (sửa xong là một
vòng mới từ bước 1 với **số kế tiếp**, vì số này đã vào commit).

## 7. Đẩy lên trang tải: beta rồi stable

Trong `desktop/`, biến đích đặt ngay trên dòng lệnh (không có thì script chỉ ghi ra máy, không đẩy gì):

```bash
CATORO_RELEASE_TARGET=mcah-release@mcah.axalize.vn:/srv/mcah/releases npm run release -- --channel beta
CATORO_RELEASE_TARGET=mcah-release@mcah.axalize.vn:/srv/mcah/releases npm run release -- --promote <phiên bản>
```

Script phát hành tự chặn khi thiếu bộ cài, các bản khác commit / khác phiên bản, chưa quét bí mật, thiếu ghi chú, khoá
không khớp. Bị chặn thì dừng và báo nguyên văn lý do; không dùng `--allow-missing` trừ khi người dùng bảo.

## 8. Kiểm trên server và báo cáo

```bash
for c in "" beta/; do curl -s "https://mcah.axalize.vn/download/files/${c}latest.json" | node -p "JSON.parse(require('fs').readFileSync(0)).version"; done
curl -s https://mcah.axalize.vn/download/files/releases.json | node -p "JSON.parse(require('fs').readFileSync(0)).releases.map(r => r.version).join(', ')"
```

Hai kênh phải ra đúng số mới. Kiểm thêm từng bộ cài trong `latest.json` trả 200 (`curl -sI`).

Báo cáo ngắn cho người dùng:
- Phiên bản, link PR, link lượt CI, https://mcah.axalize.vn/download.
- Ghi chú phát hành đã viết (dán nguyên).
- Tệp để ngoài commit (bước 4), nếu có.
- Chưa kiểm: chưa ai cài thử tay trên Windows / Mac (bản Mac ký ad-hoc, xem `docs/catoro-testcase-desktop-macos.md`).
- Trang web (trang tải, hướng dẫn, ghi chú phát hành trên web) chỉ đổi sau khi PR được merge vào `main` và triển khai.
