'use strict'

const seamanBookService = require('../../services/seaman_book.service')

async function seamanBookRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  fastify.get('/seafarers/:seafarerId/seaman-books', auth, async (req, reply) => {
    try {
      return await seamanBookService.list(parseInt(req.params.seafarerId))
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  fastify.post('/seafarers/:seafarerId/seaman-books', auth, async (req, reply) => {
    try {
      const row = await seamanBookService.create(parseInt(req.params.seafarerId), req.body)
      return reply.code(201).send(row)
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  fastify.put('/seafarers/:seafarerId/seaman-books/:id', auth, async (req, reply) => {
    try {
      return await seamanBookService.update(
        parseInt(req.params.seafarerId),
        parseInt(req.params.id),
        req.body
      )
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  fastify.delete('/seafarers/:seafarerId/seaman-books/:id', auth, async (req, reply) => {
    try {
      await seamanBookService.remove(parseInt(req.params.seafarerId), parseInt(req.params.id))
      return { ok: true }
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })
}

module.exports = seamanBookRoutes
