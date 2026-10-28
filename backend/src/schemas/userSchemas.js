const createUserSchema = {
  body: {
    type: 'object',
    required: ['email', 'full_name', 'role_id'],
    properties: {
      email: { type: 'string', format: 'email' },
      full_name: { type: 'string', minLength: 1, maxLength: 150, pattern: '\\S' },
      role_id: { type: 'integer', minimum: 1 },
    },
  },
}

const updateUserSchema = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      full_name: { type: 'string', minLength: 1, maxLength: 150, pattern: '\\S' },
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
      status: { type: 'string', enum: ['pending', 'active', 'locked'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
}

const setPasswordSchema = {
  body: {
    type: 'object',
    required: ['token', 'password'],
    properties: {
      token: { type: 'string', minLength: 1 },
      password: { type: 'string', minLength: 8, maxLength: 128, pattern: '^(?=.*[A-Za-z])(?=.*\\d)' },
    },
  },
}

const inviteQuerySchema = {
  querystring: { type: 'object', required: ['token'], properties: { token: { type: 'string', minLength: 1 } } },
}

module.exports = { inviteQuerySchema, setPasswordSchema, createUserSchema, updateUserSchema, listUsersQuerySchema }
