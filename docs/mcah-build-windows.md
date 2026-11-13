# MCAH — Build bộ cài Windows (hướng dẫn tự đủ cho máy ở nhà)

Tệp này dành cho **máy Windows chưa có gì**: chưa có code, và Claude Code trên máy đó chưa biết gì về dự án. Làm theo từ trên xuống là ra bộ cài Windows.

## 0. Bối cảnh (đọc một lần)

- **Dự án:** MCAH, phần mềm quản lý cho văn phòng môi giới thuyền viên. Có bản web và **app máy tính** (Electron) cho Windows và Ubuntu.
- **Repo:** https://github.com/huyld-axl/seasmart (công khai, tải không cần đăng nhập). Thư mục `desktop/` là app máy tính, `backend/` là máy chủ chạy bên trong app, `frontend/` là giao diện.
- **Vì sao phải build trên Windows:** code backend được dịch sang bytecode bằng chính Node của Windows. Build chéo từ Ubuntu sẽ ra bản không chạy được.
- **Ai làm gì:**
  - Máy Windows: chỉ **build** ra tệp `.exe`. Không ký, không đẩy lên server.
  - Máy Ubuntu (máy phát hành, ở văn phòng): giữ khoá ký, ký và đẩy cả hai bộ cài lên https://mcah.axalize.vn/download/.
- **Commit cần build:** `2bda402`. Bản Ubuntu 0.9.0 đã build từ commit này. Hai bản phải cùng commit, nếu không script phát hành sẽ từ chối.

## 1. Đoạn dán cho Claude Code ở máy nhà

Mở Claude Code trong một thư mục trống (ví dụ `C:\Users\<tên>\code`), rồi dán nguyên đoạn này:

```text
Tôi cần build bộ cài Windows cho dự án MCAH. Hướng dẫn đầy đủ nằm trong repo công khai
https://github.com/huyld-axl/seasmart, tệp docs/mcah-build-windows.md (nhánh dev).
Hãy:
1. Kiểm tra Git và Node (phải đúng v24.19.0 x64). Thiếu gì thì nói tôi cài, đưa link.
2. Clone repo vào thư mục hiện tại, đọc docs/mcah-build-windows.md ở nhánh dev, rồi làm theo mục 3.
Luật bắt buộc:
- KHÔNG sửa code, KHÔNG commit, KHÔNG push, KHÔNG tạo nhánh. Repo phải sạch (git status trống) khi build.
- KHÔNG đọc hay tạo tệp .env nào. KHÔNG đặt biến môi trường MCAH_*.
- Build lỗi thì dừng, tóm tắt lỗi bằng tiếng Việt đơn giản, đừng tự sửa code để vượt lỗi.
- Giải thích cho tôi bằng tiếng Việt đơn giản, tôi không phải lập trình viên.
```

## 2. Cài một lần (nếu chưa có)

1. **Git for Windows:** https://git-scm.com/download/win (giữ mặc định khi cài).
2. **Node.js đúng bản 24.19.0, 64-bit:** https://nodejs.org/dist/v24.19.0/node-v24.19.0-x64.msi
   - Phải đúng bản này, vì bộ cài kèm Node cùng bản và bytecode chỉ chạy trên đúng bản đã dịch.
   - Khi cài, màn "Tools for Native Modules" **không cần** tích.
   - Máy đã có Node khác bản: gỡ trong "Apps & features" rồi cài bản này.
3. **Đóng hết PowerShell / Claude Code rồi mở lại** (để nhận đường dẫn mới), kiểm tra:

   ```powershell
   git --version
   node -v
   npm -v
   ```

   `node -v` phải in đúng `v24.19.0`.

Cần khoảng **5 GB trống** ở ổ chứa code, và mạng ổn định (lần đầu tải khoảng 1 GB thư viện).

## 3. Build

Dùng **PowerShell**. Đừng để code trong thư mục OneDrive (OneDrive khoá tệp khi đồng bộ, build hay lỗi). Ví dụ dùng `C:\code`.

1. Lấy code đúng commit:

   ```powershell
   mkdir C:\code -Force; cd C:\code
   git clone https://github.com/huyld-axl/seasmart.git
   cd seasmart
   git checkout 2bda402
   git log -1 --oneline
   git status
   ```

   - Dòng log phải bắt đầu bằng `2bda402`. Git báo "detached HEAD" là bình thường.
   - `git status` phải báo không có thay đổi (working tree clean).
   - Đã clone từ trước: `cd C:\code\seasmart; git fetch; git checkout 2bda402`.
   - Lần sau người phát hành báo commit mới thì thay `2bda402` bằng commit đó.

2. Cài thư viện (lần đầu 5–15 phút):

   ```powershell
   cd C:\code\seasmart\backend;  npm ci
   cd C:\code\seasmart\frontend; npm ci
   cd C:\code\seasmart\desktop;  npm ci
   ```

   Có dòng `npm warn` là bình thường. Chỉ lo khi có `npm error`.

3. Build (vẫn ở `C:\code\seasmart\desktop`):

   ```powershell
   npm run dist:win
   ```

   - Chạy khoảng 5–15 phút. Lần đầu nó tải thêm Node cho Windows và Electron.
   - **Thành công** khi gần cuối có dòng `build-info-win: 0.9.0 @ 2bda402`, **không** có chữ "(có thay đổi chưa commit)".
   - Có chữ đó nghĩa là repo bị sửa gì đó: chạy `git status` xem tệp nào, `git checkout -- .` để bỏ, build lại.

4. Kiểm tra kết quả:

   ```powershell
   dir C:\code\seasmart\desktop\dist\installer
   type C:\code\seasmart\desktop\dist\installer\build-info-win.json
   ```

   Phải có tệp `MCAH Setup 0.9.0.exe` (khoảng 150–200 MB). `build-info-win.json` phải có:
   - `"commit": "2bda4023..."`, `"dirty": false`, `"scan": "clean"`;
   - `"cloud_url": "https://mcah.axalize.vn/tai-khoan"`;
   - `"update_url": "https://mcah.axalize.vn/download/files"`.

## 4. Thử cài

1. Mở `C:\code\seasmart\desktop\dist\installer\MCAH Setup 0.9.0.exe`.
2. Windows hiện "Windows đã bảo vệ máy tính của bạn": bấm **Thêm thông tin → Vẫn chạy** (bản chưa có chữ ký số, bình thường).
3. Windows có thể hỏi quyền quản trị (để mở cổng mạng cho máy chính trong văn phòng): đồng ý.
4. Đạt khi: app mở lên, không báo lỗi, tới được màn đầu (đăng nhập / chọn máy). Không cần đăng nhập thật.
5. Thử xong có thể gỡ app. Khi gỡ, app hỏi có xoá dữ liệu không: chọn có (máy thử, không có dữ liệu thật).

Ghi lại nếu có gì lạ (chụp màn hình) để báo người phát hành.

## 5. Đưa hai tệp về máy Ubuntu

Chép **đúng hai tệp**, **không đổi tên**, từ `C:\code\seasmart\desktop\dist\installer\`:

- `MCAH Setup 0.9.0.exe`
- `build-info-win.json`

Cách chép: Google Drive, USB, hoặc bất kỳ cách nào. Trên máy Ubuntu, đặt vào:

`/home/axalize/Public/code/SeaSmart MVP/seasmart/desktop/dist/installer/`

Sau đó nói Claude Code ở máy Ubuntu: "đã có bản Windows, phát hành 0.9.0 đủ hai bản".

## 6. Gặp lỗi

| Hiện tượng | Làm gì |
|---|---|
| `node -v` không phải `v24.19.0` | Gỡ Node, cài lại đúng bản ở mục 2, mở PowerShell mới. |
| `'git' / 'node' is not recognized` | Chưa cài, hoặc chưa mở lại PowerShell sau khi cài. |
| `npm ci` lỗi mạng (`ETIMEDOUT`, `ECONNRESET`) | Chạy lại lệnh. Vẫn lỗi thì đổi mạng / tắt VPN. |
| `npm ci` lỗi `EPERM` / `EBUSY` | Đóng VS Code, Explorer đang mở thư mục đó; tạm tắt diệt virus quét thư mục `C:\code`; chạy lại. |
| `running scripts is disabled on this system` | Chạy một lần: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, chọn Y. |
| Lỗi đường dẫn quá dài | Để code ở `C:\code` (ngắn) như hướng dẫn. |
| `npm run dist:win` lỗi | Chụp khoảng 30 dòng cuối, gửi người phát hành. Không tự sửa code. |
| Windows Defender xoá / chặn `.exe` vừa build | Ghi lại tên cảnh báo, gửi người phát hành. |
| build-info có "(có thay đổi chưa commit)" | `git status`, `git checkout -- .`, build lại. |

## 7. Những điều không làm

- Không sửa code, không commit, không push, không tạo nhánh.
- Không tạo / đọc tệp `.env`, không đặt biến `MCAH_CLOUD_URL` / `MCAH_UPDATE_URL`.
- Không cần, và không được chép khoá ký (`desktop/.release/`) sang máy Windows.
- Không tự đẩy bộ cài lên server: máy Ubuntu làm việc đó.
