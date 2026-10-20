# MCAH — Kế hoạch dựng Vai trò và quyền

- **Ngày lập:** 2026-10-20
- **Nhánh:** `feature/phan-quyen`, tách từ `feature/chuyen-tau-hop-dong` ở commit `7107102`. Worktree: `seasmart-wt-phanquyen/` (cạnh thư mục `seasmart/`).
- **Người làm:** một agent lập trình đọc file này từ đầu đến cuối rồi làm theo thứ tự. Mọi quyết định cần cho việc dựng đã ghi ở mục 1–6. Các file code thì phải đọc khi bước yêu cầu.
- **Wireframe đã duyệt:** `docs/design/wireframes/vai-tro-quyen.html` (bản 3). Cách mở ở mục 5.1.

---

## 0. Cách làm việc với file này

1. Đọc `CLAUDE.md` ở gốc repo trước khi viết dòng code nào. Mọi quy ước trong đó vẫn áp dụng: CommonJS không chấm phẩy ở backend, SQL tham số hoá, `pickAllowed`, lỗi dạng `{ statusCode, message }`, form theo mục 3.3, control theo mục 3.4, chữ trên giao diện bằng tiếng Việt.
2. Làm **đúng thứ tự các bước ở mục 7**. Mỗi bước có phần "Xong khi"; chỉ sang bước sau khi mọi ý trong đó đúng.
3. Sau mỗi bước: chạy lint và test của phần vừa sửa, rồi commit **một commit cho một bước**, message tiếng Việt, thể mệnh lệnh, ví dụ `Thêm bảng vai trò và quyền`. Không push.
4. Gặp dòng **⛔ DỪNG** thì dừng lại, báo người dùng đúng điều được yêu cầu và chờ trả lời. Không tự quyết thay.
5. Không làm những việc ở mục 2.2 "Không làm", kể cả khi thấy tiện tay.
6. Ghi tiến độ vào mục 10 "Nhật ký" cuối file sau mỗi bước (ngày, bước, commit, ghi chú, chỗ làm khác kế hoạch). Mở lại phiên mới thì đọc mục 10 để biết đang ở đâu.
7. Khi một chi tiết trong file này mâu thuẫn với code đang có (tên cột, tên hàm đã đổi…), ưu tiên code đang có, sửa cho khớp, rồi ghi một dòng vào Nhật ký.

---

## 1. Nghiệp vụ cần hiểu

### 1.1 Ai dùng hệ thống

**Người dùng duy nhất là nhân viên công ty môi giới thuyền viên.** Thuyền viên và trung tâm đào tạo **không** đăng nhập vào hệ thống. Vì vậy:

- Bỏ cổng thuyền viên: tự đăng ký, xác minh OTP, hồ sơ tự phục vụ (`/seafarer/*`), đăng ký khoá học bằng mã QR (`/enroll/:token`).
- Bỏ tài khoản đăng nhập của trung tâm đào tạo (vai trò `training_center`).
- **Giữ** dữ liệu trung tâm đào tạo, khoá học, ghi danh và tin nhắn mà nhân viên quản lý trong khu Quản trị. Đó là dữ liệu, không phải người dùng.

### 1.2 Vai trò

- Mỗi tài khoản có **đúng một vai trò**, hoặc **chưa có vai trò**.
- Có sẵn một vai trò hệ thống: **Quản trị viên** (`code = 'admin'`). Vai trò này luôn có mọi quyền, kể cả quyền thêm sau này. Không sửa tên, không sửa quyền, không xoá được.
- Các vai trò khác do quản trị viên tự tạo: tên (bắt buộc, không trùng, không phân biệt hoa thường), mô tả (tuỳ chọn). Khi tạo có thể chép quyền và phạm vi từ một vai trò có sẵn.
- Bỏ các vai trò cũ `operator` (Crewing Officer), `reviewer` (Người duyệt), `manning_agent`. Tài khoản đang mang các vai trò này chuyển sang **Chưa có vai trò**.
- **Chưa có vai trò:** đăng nhập được, nhưng không có quyền nào. Vào app thì thấy trang trống báo "Tài khoản chưa được gán vai trò. Liên hệ quản trị viên." và nút Đăng xuất.
- Xoá vai trò chỉ được khi không còn tài khoản nào dùng (kể cả tài khoản đã khoá; không tính tài khoản đã xoá mềm).

### 1.3 Quyền

- Một quyền là một việc trong một mục, mã dạng `<mục>.<việc>`. Danh sách đầy đủ ở mục 3.2 (40 quyền, 11 mục).
- **Xem là quyền gốc của mục:** có bất kỳ quyền nào khác trong mục thì phải có `<mục>.view`. Giao diện tự tích Xem khi tích quyền khác, và bỏ hết quyền khác khi bỏ Xem. Backend cũng tự thêm `view` khi lưu (mục 4.2), không tin giao diện.
- Vai trò không có `<mục>.view` thì mục đó **ẩn khỏi menu** và mọi API của mục trả 403.
- `role.manage` (sửa vai trò và quyền) **chỉ Quản trị viên có**. Không lưu được cho vai trò khác.

### 1.4 Phạm vi dữ liệu

- Áp cho 4 mục có cột `created_by`: **Thuyền viên** (`seafarer`), **Bản xuất** (`export_pack`), **Chuyến tàu** (`voyage`), **Hợp đồng** (`seafarer_contract`).
- Mỗi vai trò chọn cho từng mục: `all` (Tất cả, mặc định) hoặc `own` (Do mình tạo: chỉ bản ghi có `created_by` = id tài khoản đang đăng nhập).
- Phạm vi áp cho **mọi quyền trong mục**: danh sách, chi tiết, sửa, xoá, hành động riêng (bắt đầu chuyến, duyệt hợp đồng…).
- Bản ghi ngoài phạm vi: danh sách không có; mở theo id thì trả **404** (không lộ là có tồn tại).
- Dữ liệu con của thuyền viên (giấy tờ, chứng chỉ, lịch sử đi tàu, người thân, ảnh) theo phạm vi của **thuyền viên cha**.
- Bản ghi cũ có `created_by` rỗng chỉ hiện với phạm vi `all`.
- Quản trị viên luôn `all`.

### 1.5 Chống tự khoá và tự nâng quyền

- Không được khoá, xoá, hay đổi vai trò khiến hệ thống **không còn Quản trị viên nào đang hoạt động**.
- Không ai tự đổi vai trò của chính mình, tự khoá hay tự xoá chính mình.
- Chỉ Quản trị viên được: gán hoặc bỏ vai trò Quản trị viên của tài khoản khác; sửa, khoá, xoá tài khoản đang là Quản trị viên. Người có `account.update` mà không phải Quản trị viên thì không thấy "Quản trị viên" trong ô chọn vai trò, và API trả 403 nếu cố gửi.
- Đổi quyền có hiệu lực **ngay ở backend** (quyền đọc từ DB mỗi request). Giao diện cập nhật ở lần tải trang tới (gọi `/auth/me` khi mở app).

---

## 2. Phạm vi

### 2.1 Làm

1. Gỡ cổng thuyền viên và tài khoản trung tâm đào tạo (mục 1.1).
2. Bảng vai trò, quyền, phạm vi; chuyển tài khoản cũ.
3. Kiểm quyền và phạm vi ở mọi route backend thay cho kiểm theo tên vai trò.
4. API vai trò; `/auth/me` trả quyền.
5. Màn **Quản trị › Vai trò và quyền** (máy tính và điện thoại) đúng wireframe.
6. Màn Tài khoản: chọn vai trò từ danh sách vai trò, lọc theo vai trò, nhãn "Chưa có vai trò".
7. Menu, route và các nút thao tác ẩn theo quyền.
8. Control mới `PermissionCheck` trong design system.

### 2.2 Không làm (ghi lại để khỏi làm nhầm)

- Không cho một tài khoản nhiều vai trò.
- Không thêm quyền mới ngoài 40 quyền ở mục 3.2 (ví dụ quyền xem số tiền). Người dùng đã nói chưa cần.
- Không làm phạm vi "do mình phụ trách" (chưa có trường người phụ trách). Chỉ `all` / `own`.
- Không xoá bảng dữ liệu cũ (`otp_verification`, `qr_enrollment_link`, `enrollment_waitlist`…). Chỉ gỡ code dùng chúng ở phía cổng thuyền viên.
- Không xoá các màn Trung tâm đào tạo, Khoá học, Tin nhắn của khu Quản trị.
- Không làm nhật ký thay đổi quyền (audit log).
- Không đụng các file đang sửa dở ở thư mục `seasmart/` (nhánh `feature/chuyen-tau-hop-dong` có thay đổi chưa commit của phiên khác). Chỉ làm trong `seasmart-wt-phanquyen/`.

---

## 3. Dữ liệu

### 3.1 Migration `backend/migrations/postgres/009_roles_permissions.sql`

Kiểm số thứ tự: migration cuối hiện có là `008_ship_owner_drop_code.sql`. Nếu đã có `009_*` thì lấy số kế tiếp và ghi Nhật ký. Migration phải chạy lại lần hai mà không làm gì (dùng `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, điều kiện `WHERE`).

```sql
CREATE TABLE IF NOT EXISTS "role" (
  "id" INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL PRIMARY KEY,
  "code" varchar(30),                 -- chỉ vai trò hệ thống có, hiện là 'admin'
  "name" varchar(100) NOT NULL,
  "description" varchar(500),
  "scopes" JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { "seafarer": "own", ... }; thiếu khoá = 'all'
  "created_by" INTEGER,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "role_code_uq" ON "role" ("code") WHERE "code" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "role_name_uq" ON "role" (lower("name"));
-- trigger updated_at: dùng lại hàm touch_updated_at() như các bảng khác

CREATE TABLE IF NOT EXISTS "role_permission" (
  "role_id" INTEGER NOT NULL REFERENCES "role"("id") ON DELETE CASCADE,
  "permission" varchar(60) NOT NULL,
  PRIMARY KEY ("role_id", "permission")
);

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role_id" INTEGER REFERENCES "role"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "user_role_id" ON "user" ("role_id");

INSERT INTO "role" ("code", "name", "description")
VALUES ('admin', 'Quản trị viên', 'Luôn có mọi quyền')
ON CONFLICT DO NOTHING;
```

Chuyển dữ liệu (cùng file, sau phần trên):

- `role = 'admin'` → `role_id` = id vai trò `admin`.
- `role IN ('operator','reviewer','manning_agent')` → `role_id` để `NULL` (Chưa có vai trò).
- `role IN ('training_center','seafarer')` → xoá mềm: `deleted_at = NOW(), is_active = 0` (chỉ dòng chưa xoá).
- **Giữ cột `user.role`** ở bước này để code cũ còn chạy trong lúc chuyển. Bước 13 mới bỏ cột (migration `010`).

`role` là bảng cấu hình, **xoá cứng** (khoá ngoại `RESTRICT` trên `user.role_id` chặn xoá khi còn tài khoản, kể cả tài khoản đã xoá mềm; service phải trả lỗi 409 dễ hiểu trước khi chạm tới khoá ngoại; tài khoản đã xoá mềm thì đặt `role_id = NULL` trước khi xoá vai trò).

Vai trò Quản trị viên **không cần dòng** trong `role_permission`: code coi `code = 'admin'` là có mọi quyền.

### 3.2 Danh mục quyền `backend/src/constants/permissions.js`

Một nguồn duy nhất. Frontend lấy qua API (mục 4.2), **không chép** danh sách sang frontend.

```js
// Mục quyền theo thứ tự và nhóm của menu. scoped: mục có phạm vi dữ liệu (cột created_by).
const PERMISSION_MODULES = [
  { key: 'seafarer', group: 'Hồ sơ', label: 'Thuyền viên', scoped: true, permissions: [
    ['view', 'Xem danh sách và hồ sơ'],
    ['create', 'Thêm thuyền viên'],
    ['import', 'Nhập từ Excel'],
    ['update', 'Sửa hồ sơ', 'Gồm ảnh chân dung, gia quyến, tài khoản ngân hàng'],
    ['delete', 'Xoá thuyền viên'],
    ['docs', 'Tải giấy tờ và đọc bằng AI', 'CCCD, hộ chiếu, sổ thuyền viên, chứng chỉ'],
    ['sea', 'Sửa lịch sử đi tàu'],
  ] },
  { key: 'partner', group: 'Hồ sơ', label: 'Đối tác', permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Thêm đối tác'], ['update', 'Sửa đối tác'], ['delete', 'Xoá đối tác']] },
  { key: 'vessel', group: 'Hồ sơ', label: 'Tàu', permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Thêm tàu', 'Gồm tra cứu theo số IMO'], ['update', 'Sửa tàu'], ['delete', 'Xoá tàu']] },
  { key: 'export', group: 'Hồ sơ', label: 'Bản xuất', scoped: true, permissions: [['view', 'Xem bộ giấy'], ['create', 'Tạo và sửa bộ giấy'], ['download', 'Tải bản xuất', 'Word, Excel, PDF']] },
  { key: 'voyage', group: 'Vận hành', label: 'Chuyến tàu', scoped: true, permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Tạo chuyến tàu'], ['update', 'Sửa chuyến tàu', 'Gồm vị trí dự kiến và budget'], ['delete', 'Xoá chuyến tàu'], ['run', 'Bắt đầu và kết thúc chuyến']] },
  { key: 'contract', group: 'Vận hành', label: 'Hợp đồng', scoped: true, permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Tạo hợp đồng'], ['update', 'Sửa hợp đồng nháp'], ['delete', 'Xoá hợp đồng nháp'], ['submit', 'Gửi duyệt và rút lại'], ['approve', 'Duyệt và từ chối']] },
  { key: 'catalog', group: 'Hệ thống', label: 'Danh mục', permissions: [['view', 'Xem danh mục', 'Chứng chỉ, loại tàu, loại hợp đồng, cảng, quốc gia'], ['update', 'Thêm và sửa'], ['delete', 'Xoá']] },
  { key: 'training', group: 'Hệ thống', label: 'Đào tạo', permissions: [['view', 'Xem trung tâm đào tạo và khóa học'], ['update', 'Thêm và sửa', 'Gồm ghi danh, danh sách chờ'], ['delete', 'Xoá']] },
  { key: 'message', group: 'Hệ thống', label: 'Tin nhắn', permissions: [['view', 'Xem và gửi tin nhắn']] },
  { key: 'account', group: 'Hệ thống', label: 'Tài khoản', permissions: [['view', 'Xem danh sách tài khoản'], ['update', 'Thêm, sửa, khoá tài khoản', 'Gồm đặt lại mật khẩu và đổi vai trò'], ['delete', 'Xoá tài khoản']] },
  { key: 'role', group: 'Hệ thống', label: 'Vai trò và quyền', permissions: [['manage', 'Sửa vai trò và quyền', 'Chỉ Quản trị viên', { adminOnly: true }]] },
]
```

Export thêm: `ALL_PERMISSIONS` (mảng mã), `GRANTABLE_PERMISSIONS` (bỏ `adminOnly`), `SCOPED_MODULES` (`['seafarer','export','voyage','contract']`), `normalizePermissions(list)` (lọc mã không có trong danh mục và mã `adminOnly`, tự thêm `<mục>.view` khi mục có quyền khác, bỏ trùng, sắp theo thứ tự danh mục), `normalizeScopes(obj)` (chỉ giữ khoá thuộc `SCOPED_MODULES`, giá trị `all`/`own`, bỏ khoá có giá trị `all`). Viết test cho hai hàm này.

Cấu trúc trên chỉ là gợi ý cách viết; tên, mô tả và thứ tự quyền phải giữ đúng như trên (khớp wireframe).

---

## 4. Backend

### 4.1 Nạp quyền và kiểm quyền — `backend/src/plugins/access.js` (hoặc thêm vào `plugins/index.js`)

- `loadAccess(userId)`: **một** câu SQL lấy `is_active`, `deleted_at`, `role_id`, `role.code`, `role.name`, `role.scopes` và mảng quyền (`array_agg` từ `role_permission`). Trả `{ userId, roleId, roleName, isAdmin, permissions: Set, scopes }`. `isAdmin` thì `permissions` = toàn bộ `ALL_PERMISSIONS`, `scopes` = `{}`.
- Sửa decorator `fastify.authenticate`: sau `jwtVerify()` gọi `loadAccess(request.user.id)`, gắn `request.access`. Tài khoản đã khoá hoặc đã xoá mềm → **401** (khoá có hiệu lực ngay, không đợi token hết hạn). Đây là 1 câu SQL mỗi request, chấp nhận được; không làm cache.
- `fastify.can(...perms)`: trả hàm `onRequest` dùng sau `authenticate`, **thiếu bất kỳ** quyền nào → 403 `{ error: 'Không có quyền' }` (giữ đúng câu và khoá `error` các route đang dùng). Cách dùng: `{ onRequest: [fastify.authenticate, fastify.can('voyage.update')] }`.
- `scopeOf(request, module)` → `'all'` | `'own'`.
- `ownFilter(request, module, column)` → `{ sql, params }`: phạm vi `own` thì `{ sql: ' AND <column> = ?', params: [userId] }`, ngược lại `{ sql: '', params: [] }`. `column` do code truyền vào (hằng số trong code, không bao giờ từ input). Dùng trong service: route truyền `request.access` (hoặc `{ userId, scope }`) xuống service.
- `assertInScope(request, module, row)`: dùng sau khi đọc một bản ghi theo id; ngoài phạm vi thì ném `{ statusCode: 404, message: 'Không tìm thấy' }` (dùng đúng câu 404 mà service đó đang dùng).
- Test: `backend/src/plugins/__tests__/access.test.js` (hoặc theo chỗ test đang để): admin có mọi quyền; chưa có vai trò thì rỗng; thiếu quyền 403; khoá tài khoản 401; `ownFilter` hai nhánh.

### 4.2 API vai trò — `backend/src/routes/v1/role.routes.js`, `backend/src/services/role.service.js`, đăng ký prefix `/roles`

Tất cả cần `role.manage`.

| Method | Path | Việc |
|---|---|---|
| GET | `/roles/catalog` | Trả `{ modules: PERMISSION_MODULES dạng object, total: 40 }` cho giao diện vẽ ma trận. |
| GET | `/roles` | Mọi vai trò, Quản trị viên đầu tiên rồi theo `created_at`. Mỗi dòng: `id, code, name, description, is_system (code IS NOT NULL), user_count (tài khoản chưa xoá mềm), permissions (mảng; admin = toàn bộ), scopes`. |
| POST | `/roles` | Body `{ name, description?, copy_from_role_id? }`. Tên trùng → 409 "Đã có vai trò tên này". Chép từ admin = chép `GRANTABLE_PERMISSIONS`, scopes rỗng. Trả vai trò vừa tạo. |
| PUT | `/roles/:id` | Body `{ name, description }`. Vai trò hệ thống → 400 "Không sửa được vai trò Quản trị viên". |
| PUT | `/roles/permissions` | Body `{ roles: [{ id, permissions: [], scopes: {} }] }`. **Một transaction** cho cả lô (giao diện lưu một lần). Bỏ qua/400 nếu có vai trò hệ thống. Chạy `normalizePermissions`, `normalizeScopes`, xoá rồi chèn lại `role_permission`, cập nhật `scopes`. Trả `GET /roles`. |
| DELETE | `/roles/:id` | Hệ thống → 400. `user_count > 0` → 409 "Còn N tài khoản đang dùng vai trò này". |

Validation bằng JSON Schema inline như các route khác (`name` 1–100 ký tự sau khi trim, `description` ≤ 500).

### 4.3 `/auth/me` và đăng nhập

- `POST /auth/login` và `GET /auth/me` trả `user` gồm: `id, email, is_active, role: { id, name, is_system } | null, permissions: [...], scopes: {...}`. `/auth/me` đọc từ `request.access` (không trả nguyên payload JWT như bây giờ).
- JWT payload chỉ còn `{ id, email }`. Bỏ `role`, `linked_entity_*`. Token cũ vẫn chạy vì quyền đọc từ DB.
- Sửa `frontend/src/devAuth.js` nếu nó đọc `payload.role`.

### 4.4 Thay kiểm theo tên vai trò bằng kiểm quyền

Quy tắc chung: GET danh sách/chi tiết → `view`; POST tạo → `create`; PUT/PATCH sửa → `update`; DELETE → `delete`; hành động riêng theo bảng. Route nào đang chỉ có `authenticate` (không kiểm vai trò) cũng phải thêm `can(...)`, trừ các route ghi "chỉ đăng nhập". Bỏ hết hằng `ADMIN_ROLES`, `EDITOR_ROLES`, `CREATE_ROLES`, `REVIEW_ROLES`, `VOYAGE_EDITOR_ROLES`, `ROLES` và hàm `requireRole` cục bộ.

| File route | Quyền |
|---|---|
| `seafarer.routes.js` | danh sách, chi tiết, ảnh (GET) → `seafarer.view`; POST tạo → `seafarer.create`; PUT, ảnh POST/DELETE → `seafarer.update`; DELETE → `seafarer.delete`; route người thân (`seafarerContactRoutes`) GET → `view`, ghi → `update`. Phạm vi `seafarer` theo cột `s.created_by`. |
| `certificate.routes.js` | GET → `seafarer.view`; ghi → `seafarer.update`. Phạm vi theo thuyền viên cha. |
| `document.routes.js` | `/status` → chỉ đăng nhập; mọi route khác → `seafarer.docs` (đọc cũng cần `seafarer.view`). Phạm vi theo thuyền viên cha (route có `:seafarerId` thì kiểm thẳng; route theo id upload/document thì đọc ra `seafarer_id` rồi kiểm). |
| `sea_service.routes.js` | GET → `seafarer.view`; ghi → `seafarer.sea`. Phạm vi theo thuyền viên cha. |
| `import.routes.js` | → `seafarer.import`. |
| `export_pack.routes.js` | `/templates`, GET → `export.view`; POST `/`, PUT, POST `/preview` → `export.create`; các `download` → `export.download`. Phạm vi `export` theo `created_by`. |
| `fleet.routes.js` | dùng chung cho tàu và đối tác: chọn `vessel.*` hoặc `partner.*` theo bảng; `restore` → `update`. |
| `voyage.routes.js` | như quy tắc chung; `start`, `end` → `voyage.run`. Phạm vi `voyage`. |
| `seafarer_contract.routes.js` | như quy tắc chung; `submit`, `withdraw` → `contract.submit`; `approve`, `reject` → `contract.approve`. Phạm vi `contract`. |
| `master_data.routes.js` | GET → `catalog.view`; POST, PUT → `catalog.update`; DELETE → `catalog.delete`. |
| `lookup.routes.js` | chỉ đăng nhập (ô chọn dùng ở nhiều màn). |
| `training_center.routes.js`, `training_course.routes.js`, `enrollment.routes.js`, `waitlist.routes.js` | GET → `training.view`; POST, PUT → `training.update`; DELETE → `training.delete`. Bỏ mọi nhánh riêng cho vai trò `training_center`. |
| `messaging.routes.js` | → `message.view`. Nhánh "người gửi hoặc admin" đổi thành "người gửi hoặc `isAdmin`". |
| `notification.routes.js` | chỉ đăng nhập. |
| `users.js` | GET → `account.view`; POST, PATCH, toggle-active → `account.update`; DELETE → `account.delete`; `/search` (dùng cho ô chọn người nhận tin nhắn) → `message.view`. Thêm các chặn ở mục 1.5. |
| `role.routes.js` | → `role.manage`. |

Sau bước này, lệnh sau không được còn kết quả nào ngoài `constants/permissions.js`, test và migration:
`grep -rnE "request\.user\.role|user\?\.role|_ROLES\b|requireRole|'operator'|'reviewer'|'manning_agent'|'training_center'" backend/src`

### 4.5 API tài khoản

- `user.service.js`: đọc/ghi `role_id` thay `role`. Danh sách và chi tiết trả `role: { id, name, is_system } | null`. Lọc `role_id` (số) hoặc `role_id=none` (chưa có vai trò).
- `userSchemas.js`: `role_id` integer, bắt buộc khi tạo; khi sửa có thể gửi. Bỏ enum `ROLES`.
- Chặn ở mục 1.5, mỗi chặn một câu lỗi tiếng Việt rõ ràng, có test.

---

## 5. Giao diện

### 5.1 Xem wireframe

Mở `docs/design/wireframes/vai-tro-quyen.html` bằng trình duyệt. Thanh đen trên cùng chuyển khung Máy tính / Điện thoại và dựng nhanh từng trạng thái. Mở thẳng một trạng thái bằng hash, ví dụ `#st=changed&frame=desk&notes=0`. Các giá trị `st`: `reset` (chỉ Quản trị viên), `samples` (đã tạo 2 vai trò), `changed`, `confirm`, `add`, `blocked`. Chụp để so sánh: `google-chrome --headless=new --window-size=1440,1000 --screenshot=out.png "file://…/vai-tro-quyen.html#st=changed&frame=desk&notes=0"`.

Khung "Ghi chú" đầu wireframe là bản tóm tắt quyết định; mục 1 của file này là bản đầy đủ.

### 5.2 Điều hướng và quyền ở frontend

- `stores/authStore.js`: `user` có `permissions`, `scopes`, `role`. Gọi `refreshUser()` một lần khi app mở (có token) để lấy quyền mới. Sửa `devAuth.js` cho khớp.
- Hook `hooks/usePermission.js`: `useCan()` trả hàm `can(...perms)` (đủ mọi quyền), `can` rỗng khi chưa đăng nhập.
- `ProtectedRoute`: bỏ prop `roles`, thêm prop `perm` (chuỗi hoặc mảng). Không đủ quyền → `/403`. Tài khoản chưa có vai trò → `/no-role`.
- `App.jsx`: gắn `perm` cho từng route (`/seafarers` → `seafarer.view`, `/seafarers/new` → `seafarer.create`, `/:id/edit` → `seafarer.update`, `/:id/upload` và `/:id/review` → `seafarer.docs`, `/seafarers/import` → `seafarer.import`, tương tự cho tàu, đối tác, bản xuất, chuyến, hợp đồng; `/master-data/*` → `catalog.view`; `/training-centers*`, `/courses*` → `training.view`; `/messages` → `message.view`; `/admin/users*` → `account.view`; `/admin/roles` → `role.manage`). `/` chuyển tới mục đầu tiên người dùng xem được; không có mục nào → `/no-role`.
- Trang `/no-role`: dùng `StandaloneError` hoặc khung trang lỗi đang có, câu ở mục 1.2, nút Đăng xuất.
- `layouts/navConfig.js`: mỗi mục và tab có `perm`. Thêm tab `{ to: '/admin/roles', label: 'Vai trò và quyền', perm: 'role.manage' }` ngay sau Tài khoản. `sectionsFor(user)` lọc mục và tab theo quyền; mục có tab thì ẩn khi không còn tab nào, và `to` của mục trỏ tới tab đầu tiên còn lại. Bỏ `TRAINING_CENTER_SECTIONS`.
- `AdminLayout.jsx`: dòng meta ở menu người dùng hiện `email · tên vai trò` hoặc `email · Chưa có vai trò`.
- `ErrorPage.jsx`, `LoginPage.jsx`: bỏ nhánh `training_center`/`seafarer`; sau đăng nhập về `/`.
- Nút thao tác theo quyền: ẩn (không chỉ disable) nút Thêm / Sửa / Xoá / Nhập Excel / Tải giấy tờ / Bắt đầu, Kết thúc chuyến / Xin duyệt, Thôi xin duyệt / Duyệt, Từ chối / Tạo bộ giấy / Tải bản xuất khi thiếu quyền. `RowActions` nhận cờ `canEdit`, `canDelete`. Tìm chỗ bằng `grep -rn "RowActions\|Button" frontend/src/pages/admin` và đi từng màn; `PackDetailPage.jsx` đang có `mayEdit` theo tên vai trò → đổi sang quyền.

### 5.3 Control mới `PermissionCheck` — `components/ds/PermissionCheck.jsx`

- Ô tích của ma trận: nút `role="checkbox"`, `aria-checked` `true | false | mixed`, vùng bấm 36×36, ô 20×20 bo 6px; tích = nền `--primary` + dấu ✓ trắng; một phần = dấu − ; `disabled` mờ 45%; `changed` = vòng 2px màu nhấn quanh ô (y wireframe, class `.pc`).
- Props: `checked` (`true|false|'mixed'`), `disabled`, `changed`, `label` (aria-label), `title`, `onChange`.
- CSS trong `ds.css`. Thêm vào trang `/design-system` (`pages/DesignSystemPage.jsx`) một mục minh hoạ 5 trạng thái, và thêm một dòng vào bảng mục 3.4 của `CLAUDE.md`: "Tích quyền trong lưới nhiều cột (ma trận vai trò) → `PermissionCheck`; không dùng `Checkbox` của antd hay `ToggleRow` trong lưới".
- Phạm vi trong ô ma trận dùng `SegmentedPick` đang có (`pages/admin/fleet/FleetParts.jsx`, class `sf-seg`) cỡ nhỏ. Nếu cần prop `size="small"` thì thêm vào chính `SegmentedPick` (và minh hoạ ở `/design-system`), không làm bản riêng.

### 5.4 Màn Vai trò và quyền — `pages/admin/roles/`

Gợi ý file: `RoleMatrixPage.jsx` (trang, giữ state nháp), `PermissionMatrix.jsx` (bảng máy tính), `RolePhoneView.jsx` (điện thoại), `RoleFormModal.jsx` (thêm / sửa / nhân bản), `RoleSaveModal.jsx` (xác nhận lưu), `roleMatrix.js` (hàm thuần: tính trạng thái ô, áp quy tắc Xem là gốc, đếm thay đổi, so nháp với đã lưu; **có test**), `roles.css`. API: `api/roleApi.js`, hook `hooks/useRoles.js` (React Query).

Theo đúng wireframe:

- Đầu trang: tiêu đề "Vai trò và quyền", đoạn mô tả, nút chính "Thêm vai trò". Ô tìm quyền, nút "Thu gọn tất cả / Mở tất cả", chú thích 3 ký hiệu.
- Chỉ có Quản trị viên → khung gợi ý nét đứt có nút "Thêm vai trò".
- Bảng: cột đầu (dính trái) là quyền; dòng nhóm (Hồ sơ / Vận hành / Hệ thống); dòng mục có nút thu gọn, icon, số quyền, chữ "Có phạm vi dữ liệu" nếu mục có phạm vi; dòng quyền có tên và mô tả, Xem có chú "quyền gốc của mục"; `role.manage` có chip khoá "Chỉ Quản trị viên" và ô của vai trò khác là "—". Đầu bảng dính trên, nền `--table-header`, chữ navy, vạch navy 2px dưới (như mọi bảng). Cuối hàng tiêu đề có ô "+ Thêm vai trò" nét đứt. Bảng tự cuộn ngang khi nhiều vai trò.
- Đầu cột vai trò: tên (tối đa 2 dòng), nút ⋯, "N tài khoản · x/40 quyền" (admin: "toàn quyền" + chip "Cố định"), chip "Đã sửa n", thanh tiến độ mỏng.
- Ô dòng mục: `PermissionCheck` tích / bỏ cả mục (trạng thái `mixed` khi một phần). Mục có phạm vi: dưới ô là `SegmentedPick` "Tất cả | Do mình tạo" khi vai trò có Xem của mục; không có Xem thì "—"; admin là chữ "Tất cả" mờ.
- Cột Quản trị viên: mọi ô tích, `disabled`, nền xám nhạt.
- Rê chuột vào một ô thì cả cột sáng nhẹ.
- Thanh lưu dính đáy (giống `sf-savebar`): chưa đổi → "Đã lưu. Chưa có thay đổi mới." + nút "Lưu thay đổi" disable; có đổi → "N thay đổi chưa lưu ở {tên vai trò…}" + "Bỏ thay đổi" + "Lưu thay đổi".
- Bấm Lưu → hộp thoại "Lưu N thay đổi quyền?", mô tả "Áp dụng cho X tài khoản. Người đang đăng nhập nhận quyền mới ở lần tải trang tới.", mỗi vai trò một khối: Thêm (chip xanh lá), Bỏ (chip đỏ), Phạm vi (chip tím) dạng "Mục: Tên quyền". Nút "Quay lại sửa" / "Lưu thay đổi" → gọi `PUT /roles/permissions` một lần.
- Rời trang khi còn thay đổi chưa lưu → hỏi xác nhận (dùng cách các form hiện có đang làm nếu có; không có thì `useBlocker` của react-router + `modal.confirm`).
- Menu ⋯: admin chỉ có "Xem N tài khoản". Vai trò khác: "Sửa tên và mô tả", "Nhân bản vai trò", "Xem N tài khoản", "Xoá vai trò" (đỏ). "Xem tài khoản" sang `/admin/users?role_id=…` (trang Tài khoản đọc tham số này để lọc sẵn).
- Hộp thoại thêm / sửa / nhân bản: Tên vai trò* , Mô tả (textarea), "Chép quyền từ" (chỉ khi thêm; lựa chọn đầu "Không chép, bắt đầu trống"; mỗi vai trò kèm "(N quyền)" hoặc "(toàn quyền)"). Thêm: nút luôn bấm được, lỗi hiện dưới ô (trống / trùng tên). Sửa: nút "Lưu thay đổi" disable khi chưa đổi gì. Nhân bản = thêm với tên "Bản sao của X" và chép từ X. Tạo xong: toast, cột mới ở cuối, cuộn ngang tới cột đó, đầu cột nháy sáng.
- Xoá: còn tài khoản → hộp thoại cảnh báo "Chưa xoá được X" + nút "Xem N tài khoản"; không còn → hộp thoại xác nhận nút đỏ "Xoá vai trò".
- Thêm / sửa / xoá vai trò khi đang có thay đổi quyền chưa lưu: giữ nguyên nháp của các vai trò khác.
- Toast dùng `useToast` (góc dưới).
- **Điện thoại (< 640px):** ô chọn vai trò (`Select`), thẻ vai trò (tên, chip, mô tả, số tài khoản/quyền, nút ⋯; admin có banner khoá), mỗi mục một khối có `SegmentedPick` phạm vi (nếu có) và mỗi quyền một `ToggleRow` (có chip "Đã sửa"); thanh lưu dính đáy, nút giãn đủ ngang.
- Trạng thái đang tải (skeleton) và lỗi tải (`EmptyState isError` + "Thử lại") như các danh sách khác.

### 5.5 Màn Tài khoản

- `components/admin/users/UserForm.jsx`: ô "Vai trò" là `Select` lấy từ `GET /roles` (mô tả vai trò hiện dưới tên trong mỗi lựa chọn). Người không phải Quản trị viên không thấy lựa chọn Quản trị viên. Sửa tài khoản của chính mình: ô vai trò khoá, kèm gợi ý "Không tự đổi vai trò của mình".
- `UserListPage.jsx`: bộ lọc vai trò lấy từ `GET /roles` + lựa chọn "Chưa có vai trò"; đọc `?role_id=` khi mở trang.
- `RoleBadge` (đang ở `components/admin/users/`): hiện tên vai trò; `null` → nhãn cảnh báo "Chưa có vai trò".
- `constants/roles.js` (frontend) và `backend/src/constants/roles.js`: xoá khi không còn chỗ dùng.

---

## 6. Gỡ cổng thuyền viên và tài khoản trung tâm đào tạo

Đọc từng file trước khi xoá. Xoá hẳn file, bỏ đăng ký route, bỏ import. Chạy lint để bắt import mồ côi.

**Backend**

- `routes/v1/seafarer_portal.routes.js`, `services/seafarer_portal.service.js` → xoá; bỏ khỏi `routes/v1/index.js`.
- `routes/v1/qr_enrollment.routes.js` → xoá cả file (route công khai cho thuyền viên tự ghi danh và route quản lý mã QR); bỏ khỏi `index.js`.
- `routes/v1/auth.routes.js`: bỏ `/register`, `/register/seafarer`, `/verify/request`, `/verify` (và route OTP khác nếu có). Giữ `/login`, `/me`, đổi mật khẩu nếu có.
- `services/auth.service.js`: bỏ `register`, `registerSeafarer`, phần OTP. `services/sms.service.js` và `email.service.js`: chỉ xoá nếu sau khi gỡ không còn ai dùng (`jobs.js`, `waitlist.service.js`, `enrollment.service.js` đang import — kiểm từng chỗ; có dùng thì giữ).
- Bỏ mọi nhánh `role === 'training_center'` / `'seafarer'` trong route và service (training_course, training_center, enrollment, seafarer, messaging…). Cột `training_center.user_id`/`seafarer.user_id` nếu có: để nguyên, không đọc nữa.

**Frontend**

- Xoá `layouts/SeafarerLayout.jsx`, thư mục `pages/seafarer/`, `pages/QREnrollPage.jsx`, các route `/seafarer/*`, `/enroll/:token`, `/tc/*` trong `App.jsx`, hàm API tương ứng trong `api/` (portal, register, verify, qr).
- Gỡ UI tạo / xem mã QR ghi danh trong trang khoá học (`CourseDetailPage.jsx` hoặc component con) nếu có.
- `LoginPage.jsx`: bỏ link "Đăng ký" cho thuyền viên nếu có.
- Test của các phần đã xoá: xoá theo.

Sau bước này: `grep -rnE "seafarer_portal|SeafarerLayout|registerSeafarer|qr_enrollment|QREnroll|/seafarer/|training_center'" backend/src frontend/src` chỉ còn tên bảng `training_center` của dữ liệu đào tạo (không phải vai trò).

---

## 7. Các bước

### Bước 0 — Chuẩn bị

1. `cd` vào `seasmart-wt-phanquyen`. Chạy `git status` và `git branch --show-current` (phải là `feature/phan-quyen`, cây sạch).
2. Cài phụ thuộc nếu worktree chưa có `node_modules` (`npm install` ở gốc, `backend/`, `frontend/` theo `README.md`).
3. Đọc: `CLAUDE.md`; `backend/src/plugins/index.js`; `backend/src/routes/v1/index.js`, `auth.routes.js`, `users.js`, `voyage.routes.js`; `backend/src/services/user.service.js`, `auth.service.js`; `backend/src/schemas/userSchemas.js`; `backend/src/utils/transaction.js`; `frontend/src/App.jsx`, `stores/authStore.js`, `components/common/ProtectedRoute.jsx`, `layouts/navConfig.js`, `layouts/AdminLayout.jsx`; `pages/admin/users/`, `components/admin/users/`; `components/ds/` (`Controls.jsx`, `ToggleRow.jsx`, `RowActions.jsx`, `ds.css`, `useToast.jsx`); `pages/admin/fleet/FleetParts.jsx` (`SegmentedPick`, `FormFrame`); `pages/admin/seafarers/SeafarerForm.css` (`sf-savebar`, `sf-chip`); `pages/DesignSystemPage.jsx`.
4. Chạy `cd backend && npm run lint && npm test` và `cd frontend && npm run lint && npm test` để biết mốc. Ghi số test qua vào Nhật ký. Test đỏ sẵn thì ghi lại, không sửa.

**Xong khi:** đúng nhánh, đã ghi mốc test.

### Bước 1 — Gỡ cổng thuyền viên và tài khoản trung tâm đào tạo

Làm mục 6. Chạy lint, test, `vite build`.

**Xong khi:** lệnh `grep` cuối mục 6 sạch; lint/test/build qua; đăng nhập bằng tài khoản quản trị vẫn vào được và các màn chính mở được.

### Bước 2 — Migration

1. Tạo migration mục 3.1. Trước khi chạy, đếm tài khoản theo `role` trên DB dev và ghi vào Nhật ký.
2. Chạy `cd backend && npm run migrate` (đọc `backend/.env` hoặc `README.md` để biết DB). Kiểm bằng `psql`: bảng mới, vai trò Quản trị viên, `role_id` của tài khoản admin, tài khoản vai trò cũ có `role_id` NULL, tài khoản `training_center`/`seafarer` đã xoá mềm.
3. Chạy migrate lần hai: không đổi gì.
4. ⛔ **DỪNG** nếu DB dev **không còn** tài khoản `admin` nào đang hoạt động sau migrate: báo người dùng, hỏi tài khoản nào được làm Quản trị viên.

**Xong khi:** migrate chạy qua hai lần; số liệu đã ghi; commit.

### Bước 3 — Danh mục quyền và kiểm quyền (backend)

Làm mục 3.2 và 4.1, kèm test. Chưa đổi route nào.

**Xong khi:** test mới qua; toàn backend qua; commit.

### Bước 4 — API vai trò, `/auth/me`, đăng nhập

Làm mục 4.2 và 4.3, kèm test service (tạo, trùng tên, chép quyền, lưu lô có tự thêm `view` và bỏ `role.manage`, phạm vi chuẩn hoá, xoá bị chặn khi còn tài khoản, không sửa được admin).

**Xong khi:** test qua; gọi thử bằng `curl` (hoặc service thật trong transaction rồi rollback, như kế hoạch trước đã làm) đủ 6 route; commit.

### Bước 5 — Đổi kiểm quyền ở mọi route và thêm phạm vi

Làm mục 4.4. Có thể chia commit theo nhóm file (hồ sơ; vận hành; hệ thống) nếu lớn, mỗi commit một dòng Nhật ký. Viết test cho: thiếu quyền → 403; phạm vi `own` ẩn bản ghi người khác ở danh sách và trả 404 khi mở theo id, cho đủ 4 mục có phạm vi; dữ liệu con theo thuyền viên cha. Kiểm lại các service tạo mới của 4 bảng có ghi `created_by` từ `request.user.id` (nếu chỗ nào chưa ghi thì sửa và ghi Nhật ký).

**Xong khi:** lệnh `grep` cuối mục 4.4 sạch; test qua; commit.

### Bước 6 — API tài khoản

Làm mục 4.5, kèm test các chặn ở mục 1.5.

**Xong khi:** test qua; commit.

### Bước 7 — Nền frontend

Làm mục 5.2 trừ phần "Nút thao tác theo quyền" (làm ở bước 11). `api/roleApi.js`, `hooks/useRoles.js`, route `/admin/roles` trỏ trang tạm.

**Xong khi:** đăng nhập admin thấy đủ menu và tab mới; tạo nhanh (bằng API) một vai trò chỉ có `seafarer.view`, gán cho một tài khoản thử → đăng nhập tài khoản đó chỉ thấy mục Thuyền viên, gõ URL `/voyages` ra 403; tài khoản chưa có vai trò ra `/no-role`; lint/test/build qua; commit.

### Bước 8 — Control `PermissionCheck`

Làm mục 5.3.

**Xong khi:** `/design-system` có mục minh hoạ; dòng mới trong `CLAUDE.md` 3.4; commit.

### Bước 9 — Màn Vai trò và quyền (máy tính)

Làm mục 5.4 phần máy tính và mọi hộp thoại. `roleMatrix.js` có test.

**Xong khi:** chụp trang thật ở 1440px các trạng thái tương ứng `reset`, `samples`, `changed`, `confirm`, `add`, `blocked` của wireframe và so cạnh nhau, khớp bố cục, chữ, trạng thái; lưu thật được và tải lại trang vẫn đúng; lint/test/build qua; commit.

### Bước 10 — Màn Vai trò và quyền (điện thoại)

Làm phần điện thoại mục 5.4.

**Xong khi:** chụp 390px khớp wireframe khung Điện thoại, không tràn ngang; commit.

### Bước 11 — Tài khoản và nút theo quyền

Làm mục 5.5 và phần "Nút thao tác theo quyền" của mục 5.2.

**Xong khi:** với tài khoản thử chỉ có quyền xem ở mọi mục, đi qua từng danh sách và chi tiết: không còn nút ghi nào; cấp thêm quyền sửa một mục thì nút Sửa của mục đó hiện lại (sau khi tải lại trang); màn Tài khoản lọc được "Chưa có vai trò"; commit.

### Bước 12 — Kiểm phạm vi trên app thật

Hai tài khoản thử cùng một vai trò có phạm vi `own` ở cả 4 mục: mỗi người tạo một thuyền viên, một chuyến, một hợp đồng, một bộ giấy. Kiểm mỗi người chỉ thấy của mình ở danh sách; mở URL chi tiết của người kia ra trang 404; đổi phạm vi sang `all` thì thấy hết. Ghi kết quả vào Nhật ký. Dọn dữ liệu thử.

**Xong khi:** đủ các ý trên; commit (nếu có sửa).

### Bước 13 — Bỏ cột cũ và kiểm cuối

1. Migration `010_user_drop_role.sql`: `ALTER TABLE "user" DROP COLUMN IF EXISTS "role"`. Trước đó `grep -rn "\brole\b" backend/src` để chắc không câu SQL nào còn đọc `user.role` (cột `role_id`, bảng `role` thì được). Bỏ `linked_entity_type`, `linked_entity_id` **chỉ khi** không còn chỗ nào đọc; còn thì ghi Nhật ký và để nguyên.
2. Cập nhật `CLAUDE.md` mục 1 (dòng Auth: bỏ "5 roles…", ghi "Vai trò và quyền lưu trong DB, kiểm bằng `fastify.can('<mục>.<việc>')`; danh mục ở `backend/src/constants/permissions.js`") và mục 7 Review Checklist ("route có `authenticate` + `can(...)`").
3. Lint/test hai phía, `vite build`. Rà checklist `CLAUDE.md` mục 7.
4. Viết dòng Nhật ký tổng kết: mốc test cuối, những chỗ làm khác kế hoạch, việc còn mở.

**Xong khi:** mọi ý trên xong; commit. Không push, không tạo PR; báo người dùng.

---

## 8. Kiểm thử chấp nhận (tóm tắt)

1. Admin thấy mọi thứ; không sửa, không xoá được cột Quản trị viên.
2. Tạo vai trò, chép quyền, tích / bỏ ô, tích cả mục, quy tắc Xem là gốc, đổi phạm vi, lưu một lần qua hộp thoại tóm tắt, tải lại vẫn đúng.
3. Xoá vai trò còn tài khoản bị chặn; không còn thì xoá được.
4. Tài khoản chưa có vai trò vào `/no-role`.
5. Menu, route, nút ẩn đúng theo quyền; API trả 403 khi gọi thẳng.
6. Phạm vi `own` đúng ở 4 mục và dữ liệu con.
7. Không khoá được Quản trị viên cuối cùng; không tự đổi vai trò, tự khoá, tự xoá; người không phải admin không gán được vai trò admin.
8. Không còn đường vào cổng thuyền viên, đăng ký, OTP, QR.

## 9. Việc để sau

- Phạm vi "do mình phụ trách" (cần trường người phụ trách trên thuyền viên / chuyến).
- Nhật ký thay đổi quyền.
- Quyền xem số tiền (hợp đồng, lương) nếu người dùng cần sau này.
- Giai đoạn 3 Chuyến tàu và Hợp đồng (một thuyền viên rời tàu sớm…): nhắc người dùng khi làm xong việc này.

---

## 10. Nhật ký

| Ngày | Bước | Commit | Ghi chú |
|---|---|---|---|
| 2026-10-20 | — | (commit này) | Lập kế hoạch. Wireframe bản 3 ở `docs/design/wireframes/vai-tro-quyen.html`. Đã duyệt: người dùng chỉ là nhân viên môi giới (bỏ cổng thuyền viên, tài khoản trung tâm đào tạo); chỉ giữ Quản trị viên, vai trò khác tự tạo; tài khoản vai trò cũ thành "Chưa có vai trò"; làm luôn phạm vi Tất cả / Do mình tạo; mỗi tài khoản một vai trò; 40 quyền (bỏ "Duyệt bộ giấy" vì code không có thao tác này). |
| 2026-10-20 | 0 | (commit này) | Chuẩn bị. Nhánh `feature/phan-quyen`, cây sạch, đã `npm install` backend và frontend; người dùng chép `backend/.env`. Mốc test: backend lint 0 lỗi (11 cảnh báo), test 188 qua / 17 bỏ qua / 0 lỗi (22 file qua, 2 bỏ qua); frontend lint 0 lỗi (1 cảnh báo), test 116 qua (21 file). Không có test đỏ sẵn. **Khác kế hoạch:** nhánh này chỉ có migration tới `006`; `007_ship_owner_logo.sql` và `008_ship_owner_drop_code.sql` có thật nhưng nằm chưa commit ở `seasmart/` (phiên khác), nên giữ số `009` cho migration vai trò theo ý người dùng. **Lưu ý:** DB dev dùng chung với `seasmart/`; đến Bước 13 phải ⛔ DỪNG hỏi người dùng trước khi chạy migration `010` (bỏ cột `user.role`). |
| 2026-10-20 | 1 | (commit này) | Gỡ cổng thuyền viên và tài khoản trung tâm đào tạo. Backend: xoá `seafarer_portal` (route + service), `qr_enrollment.routes`, `waitlist.routes`; bỏ `/auth/register*`, `/auth/verify/*`, OTP, job dọn OTP, `emailService.sendOtp`; bỏ mọi nhánh `training_center`/`seafarer` ở route và service (training_center, training_course, enrollment, seafarer, import, user.searchUsers); JWT bỏ `linked_entity_*`. Frontend: xoá `SeafarerLayout`, `pages/seafarer/`, `QREnrollPage`, route `/seafarer/*`, `/enroll/:token`, `/tc/*`, `seafarerPortalApi` và các hàm register/verify. Kiểm: backend lint 0 lỗi / test 188 qua; frontend lint 0 lỗi / test 116 qua / `vite build` qua; khởi động backend thật: `/auth/register` và `/portal/seafarer/*` trả 404, `/auth/login` sai mật khẩu trả 401. Chưa thử đăng nhập admin bằng tài khoản thật (không có mật khẩu) — sẽ kiểm ở Bước 7. **Khác kế hoạch:** (1) xoá cả `waitlist.routes.js` vì hai route đó (xác nhận / huỷ chỗ chờ) chỉ dành cho đăng nhập thuyền viên; `waitlist.service` và email `email-waitlist-notify` giữ nguyên nên link "Xác nhận đăng ký" trong email đang trỏ tới `/seafarer/courses` đã không còn. **Việc cần người dùng quyết:** luồng danh sách chờ khoá học giờ do nhân viên xử lý thế nào (bỏ email, hay nhân viên xác nhận thay)? (2) giữ `sms.service.js` (không ai import từ trước, có test riêng); (3) `constants/roles.js` (hai phía) thu còn 4 vai trò cũ, xoá hẳn ở Bước 6/11; (4) grep cuối mục 6 còn khớp `/seafarer/` ở API `documents/seafarer/:id` của nhân viên (không phải cổng), `components/seafarer/FormExportTab` và link email waitlist nói trên. |
| 2026-10-20 | 2 | (commit này) | Migration `009_roles_permissions.sql` (bảng `role`, `role_permission`, cột `user.role_id`, vai trò `admin`, chuyển tài khoản cũ). Số tài khoản theo `role` trước khi chạy trên DB dev (dùng chung với `seasmart/`): chỉ 1 tài khoản `admin` (đang hoạt động, chưa xoá), không có tài khoản vai trò nào khác. Sau migrate: bảng mới có, vai trò `admin` id 1, tài khoản admin có `role_id = 1`, không còn tài khoản nào bị xoá mềm; chạy `npm run migrate` lần hai không đổi gì. DB còn ≥ 1 Quản trị viên hoạt động nên không phải ⛔ DỪNG. Ghi chú: DB đã có `007`, `008` do phiên `seasmart/` áp trước; `migrate.js` chỉ xét file có trong thư mục nên không xung đột. Cột `user.role` giữ nguyên. |
| 2026-10-20 | 3 | (commit này) | Danh mục quyền `backend/src/constants/permissions.js` (40 quyền, 11 mục; thêm `catalogForClient()` cho `/roles/catalog`, `ADMIN_ROLE_CODE`) và `backend/src/plugins/access.js` (`loadAccess`, `can`, `scopeOf`, `ownFilter`, `assertInScope`); `fastify.authenticate` nạp quyền từ DB mỗi request, gắn `request.access`, tài khoản khoá/xoá → 401; thêm decorator `fastify.can`. Chưa đổi route nào. Test mới: `constants/__tests__/permissions.test.js`, `plugins/__tests__/access.test.js`; toàn backend 208 qua / 17 bỏ qua, lint 0 lỗi. `loadAccess(1)` chạy thật trên DB dev: admin, 40 quyền. Chọn: `assertInScope` coi `created_by` rỗng là ngoài phạm vi `own` (đúng mục 1.4). |
| 2026-10-20 | 4 | (commit này) | API vai trò (`role.service.js`, `role.routes.js`, prefix `/roles`: catalog, danh sách, tạo, đổi tên/mô tả, lưu lô quyền, xoá; tất cả cần `role.manage`) và `/auth/login`, `/auth/me` trả `{ id, email, is_active, role, permissions, scopes }` (thêm `toClientUser` trong `plugins/access.js`). Service theo kiểu repo hiện có: nhận `db` làm đối số đầu. Test mới `role.service.test.js` (10 ca: tạo, trùng tên, chép quyền, lưu lô tự thêm view và bỏ `role.manage`, chuẩn hoá phạm vi, rollback cả lô, xoá bị chặn, không sửa admin); backend 218 qua / 17 bỏ qua, lint 0 lỗi. Gọi thử bằng `fastify.inject` trên DB dev (token ký tạm cho admin id 1): đủ 6 route trả đúng 200/201/204/400/409, không token 401; vai trò thử đã xoá, DB về còn 1 vai trò. **Khác kế hoạch:** token JWT tạm **giữ `role`** (từ cột `user.role`) vì các route chưa chuyển sang kiểm quyền còn đọc `request.user.role`; bỏ ở cuối Bước 5. Chưa thử `/auth/login` bằng mật khẩu thật (không có mật khẩu admin). |
| 2026-10-20 | 5 | (commit này) | Mọi route backend đổi từ kiểm tên vai trò sang `fastify.can('<mục>.<việc>')` theo bảng mục 4.4; thêm phạm vi `own` cho thuyền viên, bản xuất, chuyến, hợp đồng: danh sách lọc `created_by` (service nhận `ownerId`), mở/sửa/xoá/hành động riêng theo id ngoài phạm vi trả 404 (`utils/scope.js`: `ownerIdFor`, `assertRecordInScope`, `assertSeafarerInScope`, `assertChildInScope`, `assertDocumentsInScope`); dữ liệu con (chứng chỉ, người thân, ảnh, lịch sử đi tàu, upload/giấy tờ AI) theo thuyền viên cha. Bỏ `ADMIN_ROLES`, `EDITOR_ROLES`, `VOYAGE_EDITOR_ROLES`, `requireRole`, `request.user.role`; JWT chỉ còn `{ id, email }`; `lookup.routes` giờ bắt đăng nhập (trước đó không kiểm gì). `users.js` đã chuyển sang `account.*`/`message.view` nhưng chưa có các chặn mục 1.5 (Bước 6). Test mới `routes/v1/__tests__/access_scope.test.js` (50 ca: 22 route thiếu quyền → 403, danh sách `own` 4 mục, mở theo id 404, thao tác ghi bị chặn, dữ liệu con 13 route); backend 268 qua / 17 bỏ qua, lint 0 lỗi. Smoke bằng `fastify.inject` trên DB dev với admin: 18 GET chính đều 200. Mọi chỗ tạo mới của 4 bảng đã ghi `created_by` (import Excel, tạo thuyền viên, chuyến, hợp đồng, bản xuất), không phải sửa. **Khác kế hoạch / cần biết:** (1) `GET /seafarers/forms`, `/:id/export-form/:formKey`, `/seafarers/export` (Excel danh sách) kế hoạch không nói: gán `seafarer.view` (+ phạm vi); (2) `grep` cuối mục 4.4 còn một dòng ở `backend/src/constants/roles.js` (mảng 4 vai trò cũ cho enum tài khoản) và test của nó — xoá ở Bước 6; (3) tạo bộ giấy cho thuyền viên ngoài phạm vi `seafarer` của mình vẫn được (phạm vi mỗi mục độc lập theo mục 1.4); (4) `GET /admin/master/vessels` và `/ship-owners` trả 500 trên DB dev vì DB đã chạy `008_ship_owner_drop_code` của phiên `seasmart/` còn code nhánh này vẫn đọc `ship_owner.code` (`column o.code does not exist`) — không do bước này, sẽ hết khi gộp với nhánh chuyến tàu-hợp đồng; các màn Tàu/Đối tác sẽ lỗi trong lúc kiểm giao diện ở nhánh này. |
| 2026-10-20 | 6 | (commit này) | API tài khoản đọc/ghi `role_id`: danh sách/chi tiết trả `role: { id, name, is_system } \| null` (+ `is_admin`), lọc `role_id` (số) hoặc `role_id=none`; tạo cần `role_id`; sửa gửi `role_id`/`email`/`is_active`. Các chặn mục 1.5 trong `user.service` (`assertCanChange`), mỗi chặn một câu tiếng Việt: không tự đổi vai trò / khoá / xoá mình (403); chỉ Quản trị viên được gán/bỏ vai trò Quản trị viên và sửa/khoá/xoá tài khoản Quản trị viên (403); không để hệ thống hết Quản trị viên hoạt động (409). Lỗi giờ ném `{ statusCode, message }` (trả `{ error }`; frontend đã đọc cả `error` và `message`). Xoá `backend/src/constants/roles.js` và `ROLES` enum; `grep` mục 4.4 giờ sạch. Test mới `user.service.test.js` (12 ca); backend 278 qua / 17 bỏ qua, lint 0 lỗi; smoke trên DB dev (admin): lọc `role_id`, `none`, mẫu sai 400, tự khoá/xoá 403. **Khác kế hoạch:** cột `user.role` còn NOT NULL tới migration 010, nên tạo/sửa tài khoản ghi kèm `role = 'admin'` nếu vai trò Quản trị viên, ngược lại `'reviewer'` (giá trị ít quyền nhất của code cũ bên `seasmart/`, vì DB dùng chung); tài khoản không còn trả `verification_status`. |
| 2026-10-20 | 7 | (commit này) | Nền frontend: `authStore` (user có `role`, `permissions`, `scopes`; cờ `ready`; `refreshUser` đọc `res.data.user` — sửa lỗi cũ đọc nguyên `res.data` — gọi một lần khi mở app trong `App.jsx`), `hooks/usePermission.js` (`useCan`, `canOf`, `scopeOf`), `ProtectedRoute` (prop `perm`; chưa có vai trò → `/no-role`; thiếu quyền → `/403`; chờ `ready` để không nháy 403 vì quyền cũ), `pages/errors/NoRolePage.jsx`, `App.jsx` gắn `perm` cho từng route theo mục 5.2 và `/` chuyển tới mục đầu tiên xem được, `navConfig` có `perm` cho mục/tab + tab "Vai trò và quyền" + `sectionsFor(user)` lọc theo quyền (bỏ `TRAINING_CENTER_SECTIONS`), `AdminLayout` hiện `email · tên vai trò` hoặc `email · Chưa có vai trò`, `LoginPage`/`ErrorPage` về `/`, `devAuth.js` và interceptor 401 theo kiểu mới, `api/roleApi.js`, `hooks/useRoles.js`, trang tạm `/admin/roles`. Frontend lint 0 lỗi, test 119 qua (thêm 3 ca `navConfig`), `vite build` qua. **Kiểm trên app thật** (backend :3999, vite :5174, DB dev, quản trị vào bằng `?devToken=`): admin thấy đủ 8 mục + 5 tab (có "Vai trò và quyền"); tạo vai trò thử "Thử nghiệm xem thuyền viên" (chỉ `seafarer.view`) + 2 tài khoản thử `tv-xem@kiemthu.test` (vai trò đó) và `khong-vai-tro@kiemthu.test` (chưa có vai trò): tài khoản đầu chỉ thấy mục Thuyền viên, gõ `/voyages` ra `/403`; tài khoản sau vào `/no-role` với đúng câu kế hoạch và nút Đăng xuất. Dữ liệu thử này **còn trên DB dev** để dùng tiếp ở Bước 11–12, sẽ dọn ở Bước 13. **Chưa làm (đúng kế hoạch):** ẩn nút thao tác theo quyền (Bước 11) — tài khoản thử vẫn thấy nút "Thêm thuyền viên". Màn Tài khoản còn đọc `user.role` kiểu chuỗi cũ nên sẽ hiển thị sai tới Bước 11. |
| 2026-10-20 | 8 | (commit này) | Control `PermissionCheck` (`components/ds/PermissionCheck.jsx`, CSS `.pc` trong `ds.css`, đúng wireframe: vùng bấm 36×36, ô 20×20 bo 6px, ✓ / −, khoá mờ 45%, vòng nhấn khi `changed`); `SegmentedPick` thêm prop `size="small"` (`sf-seg--sm`); mục "Ô tích quyền trong ma trận" ở `/design-system` (5 trạng thái + nhóm nút phạm vi cỡ nhỏ); thêm dòng vào bảng 3.4 của `CLAUDE.md`; test `PermissionCheck.test.jsx` (3 ca). Frontend lint 0 lỗi, test 122 qua. Mở `/design-system#o-tich-quyen` trên app thật: đủ 5 ô đúng `aria-checked`/disabled/changed. |
| 2026-10-20 | 9 | (commit này) | Màn Vai trò và quyền (máy tính) ở `pages/admin/roles/`: `RoleMatrixPage` (giữ nháp, thanh lưu `sf-savebar`, chặn rời trang), `PermissionMatrix` (bảng dính đầu và cột quyền, nhóm Hồ sơ / Vận hành / Hệ thống, dòng mục thu gọn, ô `PermissionCheck` tích cả mục + `SegmentedPick` cỡ nhỏ cho phạm vi, cột Quản trị viên khoá, rê ô sáng cả cột, đầu cột có chip "Đã sửa n" và thanh tiến độ), `RoleFormModal` (thêm / sửa / nhân bản), `RoleSaveModal` (tóm tắt Thêm / Bỏ / Phạm vi), `RoleDeleteModal` (cảnh báo còn tài khoản / xác nhận xoá), `RoleIcon`, `roles.css`, `roleMatrix.js` (hàm thuần, 20 test), `api/roleApi.js`, `hooks/useRoles.js`. **Kiểm trên app thật** (DB dev): tạo vai trò qua hộp thoại (lỗi "Nhập tên vai trò." khi trống, "Đã có vai trò tên này." khi trùng, nhân bản chép sẵn tên và "Chép quyền từ"), tích 14 quyền + 2 phạm vi → savebar "16 thay đổi chưa lưu", hộp thoại "Lưu 16 thay đổi quyền?", lưu rồi tải lại vẫn đủ; menu ⋯ đủ mục theo mẫu; xoá vai trò còn tài khoản ra cảnh báo "Chưa xoá được…", xoá vai trò trống chạy được; tích quyền khác tự tích Xem, bỏ Xem bỏ các quyền khác; rời trang khi còn thay đổi hiện "Rời trang này?" (Ở lại giữ nguyên), Bỏ thay đổi hoạt động. **So wireframe**: chụp headless Chrome 1440×1000 trạng thái `samples` và `reset` của wireframe với trang thật — khớp bố cục, chữ, số đo (tiêu đề, mô tả, thanh tìm, chú thích 3 ký hiệu, đầu bảng navy, cột quyền 360px, cột vai trò 176px, ô "+ Thêm vai trò", khối gợi ý nét đứt khi chỉ có Quản trị viên, thanh lưu). Trạng thái `changed`, `confirm`, `add`, `blocked` kiểm bằng thao tác thật và ảnh chụp trong trình duyệt của app (hộp thoại dùng `Modal` antd như các hộp thoại khác của app). **Khác kế hoạch / wireframe:** (1) `App.jsx` đổi từ `<BrowserRouter>` sang `createBrowserRouter` + `RouterProvider` (với một route `*` chứa `<Routes>` cũ) vì `useBlocker` chỉ chạy trên data router — kế hoạch cho phép "dùng `useBlocker`" nhưng không nói điều này; (2) không có chip "MỚI" ở tab (kế hoạch mục 5.2 không yêu cầu); (3) hộp thoại dùng `Modal` antd, không dựng scrim riêng như wireframe; (4) `sf-seg--sm` chỉnh về 24px / 11px đúng wireframe. Phần điện thoại (`< 640px`) để Bước 10 — hiện < 640px vẫn hiện bảng. |
| 2026-10-20 | 10 | (commit này) | Màn Vai trò và quyền cho điện thoại (< 640px, `RolePhoneView.jsx`, hook `useMediaQuery`): tiêu đề + nút "Thêm vai trò" cỡ nhỏ, ô chọn vai trò (`Select`), thẻ vai trò (tên, chip "Cố định" / "Đã sửa n", menu ⋯, mô tả, số tài khoản/quyền, banner khoá cho Quản trị viên), mỗi mục một khối có `SegmentedPick` phạm vi (khi vai trò có Xem của mục) và mỗi quyền một `ToggleRow`; thanh lưu dính đáy, nút giãn đủ ngang. **Khác kế hoạch:** `ToggleRow` thêm prop `changed` (viền màu nhấn + chip "Đã sửa", minh hoạ ở `/design-system`) để làm đúng wireframe — theo luật "một kiểu mỗi control" nên thêm vào control có sẵn, không dựng bản riêng. Kiểm: chụp headless Chrome 390 px trang thật và wireframe `frame=phone` — khớp bố cục; trên app thật ở 390×844: `scrollWidth` = 390 (không tràn ngang) cả khi đang có thay đổi, bật quyền → "Đã sửa" ở dòng, đổi phạm vi, thanh lưu "2 thay đổi chưa lưu", Bỏ thay đổi trả về trạng thái đã lưu. Frontend lint 0 lỗi, test 142 qua, `vite build` qua. |
