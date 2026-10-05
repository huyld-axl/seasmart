# TASK-08: Messaging API

## Why
Cho phép giao tiếp nội bộ giữa các user trong hệ thống (admin ↔ thuyền viên, trung tâm ↔ thuyền viên).

## Trạng thái: DONE ✅ (backend implemented: messaging.routes.js + qr_enrollment.routes.js + migration 010)

## Files cần tạo
- `backend/src/services/message.service.js`
- `backend/src/routes/v1/message.routes.js`
- `backend/migrations/002_messaging.sql` — migration thêm 3 bảng mới

## Files cần sửa
- `backend/src/routes/v1/index.js` — đăng ký messageRoutes

## Migration cần chạy trước

```sql
-- File: backend/migrations/002_messaging.sql
CREATE TABLE conversation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'direct',
  title VARCHAR(200) NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY (created_by) REFERENCES user(id)
);

CREATE TABLE conversation_participant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES conversation(id),
  FOREIGN KEY (user_id) REFERENCES user(id),
  UNIQUE KEY uq_conv_user (conversation_id, user_id)
);

CREATE TABLE message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  content TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES conversation(id),
  FOREIGN KEY (sender_id) REFERENCES user(id)
);
```

## How — Các bước thực hiện

### Bước 1: `message.service.js`

**listConversations(userId)**
```sql
SELECT c.*, cp.joined_at,
  (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id AND m.is_read = 0 AND m.sender_id != ?) as unread_count,
  (SELECT content FROM message m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message
FROM conversation c
JOIN conversation_participant cp ON cp.conversation_id = c.id
WHERE cp.user_id = ?
ORDER BY c.created_at DESC
```

**createConversation({ createdBy, participantIds, title, type })**
- INSERT conversation
- INSERT conversation_participant cho tất cả participants (kể cả createdBy)

**getMessages(conversationId, userId, { page, limit })**
- Kiểm tra userId là participant của conversation
- SELECT messages với paging, ORDER BY created_at ASC

**sendMessage(conversationId, senderId, content)**
- Kiểm tra senderId là participant
- INSERT message

**markRead(conversationId, userId)**
- UPDATE message SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?

### Bước 2: `message.routes.js`

```
GET    /conversations                    → listConversations
POST   /conversations                    → createConversation
GET    /conversations/:id/messages       → getMessages (paging)
POST   /conversations/:id/messages       → sendMessage
PUT    /conversations/:id/read           → markRead
```

### Bước 3: Đăng ký trong `index.js`
```js
import messageRoutes from './message.routes.js'
fastify.register(messageRoutes, { prefix: '/messages' })
```

## Các kịch bản

### Phương án A: HTTP polling (CHỌN cho MVP)
- Client poll GET /conversations/:id/messages mỗi 10-30 giây
- Ưu: đơn giản, không cần WebSocket
- Nhược: không real-time

### Phương án B: WebSocket / SSE
- Real-time notifications
- Ưu: UX tốt hơn
- Nhược: phức tạp hơn, cần thêm setup

**Chọn Phương án A** cho MVP. Upgrade lên WebSocket sau nếu cần.

## Điểm quan trọng
- Kiểm tra user là participant trước khi cho xem/gửi tin nhắn
- `unread_count` tính từ tin nhắn của người khác (không tính của mình)
- Paging cho messages: mới nhất ở cuối (ASC), nhưng load theo page từ cuối lên
- Không cần soft delete cho message (giữ lịch sử)

## Acceptance Criteria
- [ ] GET /conversations chỉ trả về conversation của user đang đăng nhập
- [ ] POST /conversations tạo được với nhiều participants
- [ ] GET /conversations/:id/messages: user không phải participant → 403
- [ ] POST /conversations/:id/messages gửi được tin nhắn
- [ ] PUT /conversations/:id/read đánh dấu đã đọc đúng
- [ ] unread_count chính xác
