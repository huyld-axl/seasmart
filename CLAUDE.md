# Marineport Project Instructions

## gstack
- Use the /browse skill from gstack for all web browsing
- NEVER use mcp__claude-in-chrome__* tools
- Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /review, /ship, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies, /retro, /investigate, /document-release, /codex, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade

---

## 1. Project Overview

**Marineport** — Cổng tuyển dụng & quản lý thuyền viên hàng hải.

- **Backend:** Fastify 5 + PostgreSQL 17 (pg pool)
- **Frontend:** React 19 + Ant Design 6 + React Query 5 + Zustand 5 + Vite 8
- **Auth:** JWT (`@fastify/jwt`). Người dùng chỉ là nhân viên môi giới. Vai trò và quyền lưu trong DB, kiểm bằng `fastify.can('<mục>.<việc>')`; danh mục quyền ở `backend/src/constants/permissions.js`
- **Database:** PostgreSQL migrations in `backend/migrations/postgres/`; legacy MySQL SQL files are archival.

## 2. Architecture

```
backend/
├── server.js              # Fastify entry point
├── src/
│   ├── config/            # DB pool, env config
│   ├── constants/         # Enums, static values
│   ├── middleware/         # Auth, RBAC middleware
│   ├── models/            # Data access (optional)
│   ├── plugins/           # Fastify plugins (JWT, CORS, etc.)
│   ├── routes/v1/         # Route handlers (versioned)
│   ├── schemas/           # JSON Schema validation
│   ├── services/          # Business logic layer
│   ├── templates/         # Email/document templates
│   └── utils/             # Shared helpers
frontend/
├── src/
│   ├── api/               # API client functions (xxxApi.js)
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks (useXxx.js)
│   ├── layouts/           # Page layouts
│   ├── pages/             # Route-level page components
│   ├── stores/            # Zustand stores (xxxStore.js)
│   └── utils/             # Frontend helpers
```

**Data flow:** Routes → Services → PostgreSQL pool (pg), with bound query parameters.

## 3. Coding Conventions

### 3.1 Backend (Node.js / CommonJS)

| Item | Convention | Example |
|---|---|---|
| File naming | `snake_case.{type}.js` | `auth.service.js`, `seafarer.routes.js` |
| Variables/functions | camelCase | `getSeafarerById`, `totalCount` |
| DB column names | snake_case | `created_at`, `vessel_name` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY`, `ROLE_ADMIN` |
| Semicolons | **None** (ESLint enforced) | `const x = 1` |
| Quotes | Single quotes | `'hello'` |

**Route pattern:**
```js
async function seafarerRoutes(fastify) {
  fastify.get('/api/v1/seafarers', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    // ...
  })
}
module.exports = seafarerRoutes
```

**Service pattern:**
```js
const seafarerService = {
  async getById(pool, id) {
    const [rows] = await pool.query('SELECT * FROM seafarer WHERE id = ? AND deleted_at IS NULL', [id])
    return rows[0]
  }
}
module.exports = seafarerService
```

**Error handling:** throw `{ statusCode, message }` — Fastify handles serialization.

### 3.2 Frontend (React / ESM)

| Item | Convention | Example |
|---|---|---|
| Component files | PascalCase.jsx | `SeafarerList.jsx`, `LoginPage.jsx` |
| Hook files | `useXxx.js` | `useAuth.js`, `useSeafarers.js` |
| API files | `xxxApi.js` | `seafarerApi.js`, `authApi.js` |
| Store files | `xxxStore.js` | `authStore.js` |
| Exports | Default export for components | `export default SeafarerList` |
| Components | Functional only + hooks | No class components |

**UI text:** Vietnamese. **Code identifiers:** English.

### 3.3 Form thêm / sửa (thuyền viên, tàu, đối tác và các form CRUD sau này)

Mọi form thêm / sửa theo một kiểu, lấy form thuyền viên làm chuẩn. Dùng chung khung `FormFrame` ở `pages/admin/fleet/FleetParts.jsx` và CSS `sf-*` của `SeafarerForm.css`.

- **Thêm mới:** nút lưu **luôn bấm được**. Thiếu trường bắt buộc thì hiện lỗi ngay dưới trường và cuộn tới ô lỗi đầu tiên. Không disable nút để ép người dùng điền.
- **Sửa:** nút lưu chỉ **disable khi chưa có thay đổi nào**. Trường đã đổi có viền màu nhấn và chip "Đã sửa", thanh lưu hiện số thay đổi.
- **Thêm mới có thêm nút "Lưu & thêm … khác"** cạnh nút chính: lưu xong ở lại trang, form về trống, cuộn lên đầu. Nút chính "Thêm …" lưu xong thì sang trang chi tiết.
- Nút Huỷ quay về chi tiết (khi sửa) hoặc danh sách (khi thêm). Thanh lưu dính đáy màn hình.
- Chữ trên nút: "Thêm {đối tượng}" / "Lưu thay đổi" / "Lưu & thêm {đối tượng} khác" / "Huỷ".

### 3.4 Control dùng chung (design system)

Mỗi loại control chỉ có **một** kiểu. Cần control mới thì thêm vào `components/ds/`, minh hoạ ở `/design-system`, rồi mới dùng. Không tự dựng kiểu riêng trong từng trang.

| Nhu cầu | Dùng | Không dùng |
|---|---|---|
| Bật / tắt một thuộc tính có / không (nồi hơi, lạnh, người thân là liên lạc, bảo lãnh) | `ToggleRow` (`components/ds/ToggleRow.jsx`) | Nút dạng chip bấm bật, checkbox, `Switch` đặt lẻ |
| Chọn **một** trong vài giá trị | Nhóm nút `ChoiceGroup` (cho phép bỏ chọn) hoặc `SegmentedPick` (luôn có một giá trị) | Radio, nhiều `ToggleRow` thay cho một lựa chọn |
| Chọn từ danh sách dài | `Select` có tìm kiếm | Ô nhập tự do khi đã có danh mục |
| Tích quyền trong lưới nhiều cột (ma trận vai trò) | `PermissionCheck` (`components/ds/PermissionCheck.jsx`) | `Checkbox` của antd hay `ToggleRow` trong lưới |

## 4. API Conventions

- Base path: `/api/v1/`
- RESTful verbs:
  - `GET /api/v1/seafarers` — list (with pagination)
  - `GET /api/v1/seafarers/:id` — detail
  - `POST /api/v1/seafarers` — create
  - `PUT /api/v1/seafarers/:id` — update
  - `DELETE /api/v1/seafarers/:id` — soft delete (`deleted_at = NOW()`)
- Auth: `onRequest: [fastify.authenticate]` on protected routes
- Validation: inline JSON Schema in route options

## 5. Database Conventions

- Table names: `snake_case`, singular (`seafarer`, `training_course`)
- Soft delete: `deleted_at` column (nullable DATETIME)
- Timestamps: `created_at DEFAULT CURRENT_TIMESTAMP`, `updated_at` on update
- Foreign keys: `{table}_id` pattern (`seafarer_id`, `course_id`)
- Always use parameterized queries — **never** string interpolation in SQL

## 6. Security Policy

- **Never** commit `.env` files
- Passwords: bcrypt with salt rounds 10
- Input whitelisting: `pickAllowed()` pattern to strip unexpected fields
- Rate limiting on auth routes (`@fastify/rate-limit`)
- JWT tokens for authentication; quyền đọc từ DB mỗi request (`fastify.can`), không tin vai trò trong token
- **No raw SQL interpolation** — always `pool.query('... WHERE id = ?', [id])`
- File uploads: validate MIME type and size before processing

## 7. Review Checklist

Before merging any code, verify:

- [ ] No hardcoded secrets or credentials
- [ ] SQL uses parameterized queries (no string interpolation)
- [ ] Input validated via JSON Schema or `pickAllowed` whitelist
- [ ] Protected routes have `onRequest: [fastify.authenticate, fastify.can('<mục>.<việc>')]`; mục có phạm vi dữ liệu thì lọc / kiểm bằng `utils/scope.js`
- [ ] Errors thrown with `{ statusCode, message }` format
- [ ] No `console.log` left in production code (warnings OK in dev)
- [ ] Vietnamese UI text consistent with existing patterns
- [ ] File naming follows convention (see [naming-conventions.md](docs/naming-conventions.md))
- [ ] New DB queries use `deleted_at IS NULL` for soft-deleted tables

## 8. Git Workflow

- Branch naming: `feature/xxx`, `fix/xxx`, `refactor/xxx`
- Commit messages: imperative mood, Vietnamese or English
- **Never push directly to `main`** — use feature branches + review
- Run `npm run lint` in both backend/ and frontend/ before committing
- Pre-commit hook runs ESLint + Prettier automatically via husky

## 9. Testing

- **Backend:** Vitest — `cd backend && npm test`
- **Frontend:** Vitest + React Testing Library — `cd frontend && npm test`
- Test files: `__tests__/` directories next to source, or `*.test.js` / `*.test.jsx`
- Run tests before creating PRs

## 10. Useful Commands

```bash
# Development
cd backend && npm run dev      # Start backend (nodemon)
cd frontend && npm run dev     # Start frontend (Vite)

# Linting
cd backend && npm run lint     # ESLint backend
cd frontend && npm run lint    # ESLint frontend

# Testing
cd backend && npm test         # Run backend tests
cd frontend && npm test        # Run frontend tests

# Build
cd frontend && npm run build   # Production build
```
