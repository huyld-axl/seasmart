# Naming Conventions - Marineport

Tài liệu tham chiếu nhanh cho quy ước đặt tên trong dự án.

## Backend (Node.js / CommonJS)

| Loại | Convention | Pattern | Ví dụ |
|---|---|---|---|
| Route file | snake_case | `{domain}.routes.js` | `seafarer.routes.js` |
| Service file | snake_case | `{domain}.service.js` | `auth.service.js` |
| Middleware file | snake_case | `{name}.js` | `authenticate.js` |
| Schema file | snake_case | `{domain}.schema.js` | `seafarer.schema.js` |
| Utility file | snake_case | `{name}.js` | `date_helper.js` |
| Plugin file | snake_case | `{name}.plugin.js` | `jwt.plugin.js` |
| Constant file | snake_case | `{domain}.js` | `roles.js` |
| Variables | camelCase | - | `seafarerList`, `totalCount` |
| Functions | camelCase | - | `getSeafarerById`, `validateInput` |
| Constants | SCREAMING_SNAKE_CASE | - | `MAX_RETRY`, `ROLE_ADMIN` |

## Frontend (React / ESM)

| Loại | Convention | Pattern | Ví dụ |
|---|---|---|---|
| Component file | PascalCase | `{Name}.jsx` | `SeafarerList.jsx`, `LoginPage.jsx` |
| Page file | PascalCase | `{Name}Page.jsx` | `SeafarerDetailPage.jsx` |
| Hook file | camelCase | `use{Name}.js` | `useAuth.js`, `useSeafarers.js` |
| API file | camelCase | `{domain}Api.js` | `seafarerApi.js`, `authApi.js` |
| Store file | camelCase | `{domain}Store.js` | `authStore.js` |
| Context file | PascalCase | `{Name}Context.jsx` | `AuthContext.jsx` |
| Utility file | camelCase | `{name}.js` | `formatDate.js` |
| CSS file | PascalCase (match component) | `{Name}.css` | `App.css` |
| Components | Functional + default export | - | `export default SeafarerList` |
| Props | camelCase | - | `onSubmit`, `isLoading` |

## Database (MySQL)

| Loại | Convention | Ví dụ |
|---|---|---|
| Table name | snake_case, singular | `seafarer`, `training_course` |
| Column name | snake_case | `created_at`, `vessel_name` |
| Primary key | `id` (auto-increment) | `id` |
| Foreign key | `{table}_id` | `seafarer_id`, `course_id` |
| Boolean column | `is_` prefix | `is_active`, `is_verified` |
| Soft delete | `deleted_at` | `deleted_at DATETIME NULL` |
| Timestamps | `created_at`, `updated_at` | - |
| Enum values | snake_case | `pending_review`, `approved` |

## API Endpoints

| Action | Method | Pattern | Ví dụ |
|---|---|---|---|
| List | GET | `/api/v1/{resources}` | `GET /api/v1/seafarers` |
| Detail | GET | `/api/v1/{resources}/:id` | `GET /api/v1/seafarers/1` |
| Create | POST | `/api/v1/{resources}` | `POST /api/v1/seafarers` |
| Update | PUT | `/api/v1/{resources}/:id` | `PUT /api/v1/seafarers/1` |
| Delete | DELETE | `/api/v1/{resources}/:id` | `DELETE /api/v1/seafarers/1` |
| Custom action | POST/GET | `/api/v1/{resources}/:id/{action}` | `POST /api/v1/seafarers/1/approve` |

## Git

| Loại | Convention | Ví dụ |
|---|---|---|
| Feature branch | `feature/{short-desc}` | `feature/seafarer-export` |
| Bug fix branch | `fix/{short-desc}` | `fix/login-validation` |
| Refactor branch | `refactor/{short-desc}` | `refactor/service-layer` |
| Commit message | Imperative mood | `Add seafarer export feature` |
