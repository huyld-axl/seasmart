const { ROLES } = require('../constants/roles')

const createUserSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'role'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      role: { type: 'string', enum: ROLES },
    },
  },
}

const updateUserSchema = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ROLES },
      is_active: { type: 'boolean' },
    },
  },
}

const listUsersQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      role: { type: 'string', enum: ROLES },
      is_active: { type: 'string', enum: ['true', 'false'] },
      email: { type: 'string' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
}

module.exports = { createUserSchema, updateUserSchema, listUsersQuerySchema }
