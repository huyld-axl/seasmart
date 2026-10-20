const pool = require('../../config/db')
const { roleService } = require('../../services/role.service')
const { catalogForClient } = require('../../constants/permissions')

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }

async function roleRoutes(fastify) {
  const guard = { onRequest: [fastify.authenticate, fastify.can('role.manage')] }

  // GET /api/v1/roles/catalog — danh mục quyền để vẽ ma trận
  fastify.get('/catalog', guard, async () => catalogForClient())

  // GET /api/v1/roles
  fastify.get('/', guard, async () => ({ data: await roleService.list(pool) }))

  // POST /api/v1/roles
  fastify.post(
    '/',
    {
      ...guard,
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: ['string', 'null'], maxLength: 500 },
            copy_from_role_id: { type: ['integer', 'null'], minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const role = await roleService.create(pool, request.body, request.user.id)
      return reply.code(201).send({ data: role })
    }
  )

  // PUT /api/v1/roles/permissions — lưu quyền và phạm vi của nhiều vai trò trong một transaction
  fastify.put(
    '/permissions',
    {
      ...guard,
      schema: {
        body: {
          type: 'object',
          required: ['roles'],
          properties: {
            roles: {
              type: 'array',
              maxItems: 200,
              items: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer', minimum: 1 },
                  permissions: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 60 } },
                  scopes: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => ({ data: await roleService.savePermissions(pool, request.body.roles) })
  )

  // PUT /api/v1/roles/:id — đổi tên và mô tả
  fastify.put(
    '/:id',
    {
      ...guard,
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: ['string', 'null'], maxLength: 500 },
          },
        },
      },
    },
    async (request) => ({ data: await roleService.update(pool, request.params.id, request.body) })
  )

  // DELETE /api/v1/roles/:id
  fastify.delete('/:id', { ...guard, schema: { params: idParams } }, async (request, reply) => {
    await roleService.remove(pool, request.params.id)
    return reply.code(204).send()
  })
}

module.exports = roleRoutes
