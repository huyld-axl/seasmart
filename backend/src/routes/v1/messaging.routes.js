const pool = require('../../config/db')

async function messagingRoutes(fastify) {
  // GET /api/v1/messages/threads - list conversations for current user
  fastify.get('/threads', { onRequest: [fastify.authenticate] }, async (request) => {
    const userId = request.user.id
    // Dùng JOIN thay vì correlated subqueries để tránh N+1
    const [rows] = await pool.query(
      `SELECT c.id, c.title, c.type, c.updated_at,
              last_msg.content AS last_message,
              last_msg.created_at AS last_message_at,
              COALESCE(unread.cnt, 0) AS unread_count
       FROM conversation c
       JOIN conversation_participant cp ON cp.conversation_id = c.id AND cp.user_id = ?
       LEFT JOIN (
         SELECT m1.conversation_id, m1.content, m1.created_at
         FROM message m1
         JOIN (
           SELECT conversation_id, MAX(id) AS max_id
           FROM message WHERE deleted_at IS NULL
           GROUP BY conversation_id
         ) latest ON latest.conversation_id = m1.conversation_id AND m1.id = latest.max_id
       ) last_msg ON last_msg.conversation_id = c.id
       LEFT JOIN (
         SELECT m.conversation_id, COUNT(*) AS cnt
         FROM message m
         JOIN conversation_participant cp2 ON cp2.conversation_id = m.conversation_id AND cp2.user_id = ?
         WHERE m.deleted_at IS NULL AND m.created_at > COALESCE(cp2.last_read_at, '2000-01-01')
         GROUP BY m.conversation_id
       ) unread ON unread.conversation_id = c.id
       ORDER BY last_msg.created_at DESC`,
      [userId, userId]
    )
    return rows
  })

  // GET /api/v1/messages/threads/:id - messages in a thread
  fastify.get('/threads/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const convId = parseInt(request.params.id)

    // verify participant
    const [[part]] = await pool.query(
      'SELECT id FROM conversation_participant WHERE conversation_id = ? AND user_id = ?',
      [convId, userId]
    )
    if (!part) return reply.code(403).send({ error: 'Không có quyền truy cập cuộc trò chuyện này' })

    const { page = 1, limit = 50 } = request.query
    const safeLimit = Math.min(parseInt(limit) || 50, 100)
    const offset = (parseInt(page) - 1) * safeLimit

    const [messages] = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.sender_id,
              u.email AS sender_email,
              COALESCE(s.full_name, u.email) AS sender_name
       FROM message m
       JOIN \`user\` u ON u.id = m.sender_id
       LEFT JOIN seafarer s ON s.user_id = m.sender_id
       WHERE m.conversation_id = ? AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [convId, parseInt(safeLimit), offset]
    )

    // mark as read
    await pool.query(
      'UPDATE conversation_participant SET last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?',
      [convId, userId]
    )

    return messages.reverse()
  })

  // POST /api/v1/messages - send a message (creates thread if needed)
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            conversation_id: { type: 'integer' },
            recipient_id: { type: 'integer' },
            content: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const senderId = request.user.id
      const { conversation_id, recipient_id, content } = request.body

      let convId = conversation_id

      if (!convId) {
        if (!recipient_id)
          return reply.code(400).send({ error: 'Cần conversation_id hoặc recipient_id' })

        // find existing DIRECT conversation between the two users
        const [[existing]] = await pool.query(
          `SELECT c.id FROM conversation c
         JOIN conversation_participant cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
         JOIN conversation_participant cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
         WHERE c.type = 'DIRECT'
         LIMIT 1`,
          [senderId, recipient_id]
        )

        if (existing) {
          convId = existing.id
        } else {
          const [res] = await pool.query('INSERT INTO conversation (type) VALUES (\'DIRECT\')')
          convId = res.insertId
          if (senderId === recipient_id) {
            // self-conversation: single participant
            await pool.query(
              'INSERT INTO conversation_participant (conversation_id, user_id) VALUES (?,?)',
              [convId, senderId]
            )
          } else {
            await pool.query(
              'INSERT INTO conversation_participant (conversation_id, user_id) VALUES (?,?),(?,?)',
              [convId, senderId, convId, recipient_id]
            )
          }
        }
      } else {
        // verify sender is participant
        const [[part]] = await pool.query(
          'SELECT id FROM conversation_participant WHERE conversation_id = ? AND user_id = ?',
          [convId, senderId]
        )
        if (!part) return reply.code(403).send({ error: 'Không có quyền gửi tin nhắn' })
      }

      const [res] = await pool.query(
        'INSERT INTO message (conversation_id, sender_id, content) VALUES (?,?,?)',
        [convId, senderId, content]
      )

      await pool.query('UPDATE conversation SET updated_at = NOW() WHERE id = ?', [convId])

      return reply
        .code(201)
        .send({ id: res.insertId, conversation_id: convId, content, created_at: new Date() })
    }
  )

  // DELETE /api/v1/messages/:id - soft delete own message
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const msgId = parseInt(request.params.id)
    const [[msg]] = await pool.query('SELECT sender_id FROM message WHERE id = ?', [msgId])
    if (!msg) return reply.code(404).send({ error: 'Không tìm thấy tin nhắn' })
    if (msg.sender_id !== userId && request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Không có quyền xóa tin nhắn này' })
    }
    await pool.query('UPDATE message SET deleted_at = NOW() WHERE id = ?', [msgId])
    return { success: true }
  })
}

module.exports = messagingRoutes
