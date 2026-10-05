# Task: Kiểm tra & cải thiện tiêu chuẩn code

## Mục tiêu
Đánh giá dự án Marineport theo tiêu chuẩn code phổ biến và xác định các điểm cần cải thiện.

## Kết quả đánh giá

### Đạt chuẩn
| Tiêu chí | Ghi chú |
|---|---|
| Separation of concerns (route → service) | Rõ ràng, nhất quán |
| Security: JWT validation, CORS whitelist, field whitelist | Tốt |
| Soft delete | Áp dụng xuyên suốt |
| DB indexes | Migration `012_performance_indexes.sql` |
| API layer frontend centralized | Toàn bộ trong `api/index.js` |
| SQL performance | Prefix search thay vì leading wildcard |
| Error handling | Không lộ stack trace ra client |

### Cần cải thiện
| Vấn đề | Mức độ | Action |
|---|---|---|
| Backend không có ESLint | Trung bình | Thêm ESLint config cho `backend/` |
| Không có Prettier | Trung bình | Thêm `.prettierrc` cho cả project |
| Inline styles trong JSX | Nhẹ | Chuyển sang CSS class hoặc Ant Design token |
| `userService.js` tên file không nhất quán | Nhẹ | Đổi thành `user.service.js` |
| Không có `.editorconfig` | Nhẹ | Thêm `.editorconfig` ở root |

## Các task cụ thể

- [ ] Thêm ESLint cho backend (`backend/.eslintrc.js` hoặc `backend/eslint.config.js`)
- [ ] Thêm Prettier cho toàn project (`.prettierrc` ở root)
- [ ] Thêm `.editorconfig` ở root
- [ ] Đổi tên `userService.js` → `user.service.js`
- [ ] Review và giảm inline styles trong các page JSX

## Tham khảo
- Stack: Node.js + Fastify (backend), React 19 + Vite + Ant Design (frontend)
- Ngày đánh giá: 2026-03-14
