const createUserSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'role_id'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      role_id: { type: 'integer', minimum: 1 },
    },
  },
}

const updateUserSchema = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      role_id: { type: 'integer', minimum: 1 },
      is_active: { type: 'boolean' },
    },
  },
}

const listUsersQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      // Số id vai trò, hoặc `none` = chưa có vai trò.
      role_id: { type: 'string', pattern: '^(\\d+|none)$' },
      is_active: { type: 'string', enum: ['true', 'false'] },
      email: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
}

module.exports = { createUserSchema, updateUserSchema, listUsersQuerySchema }
