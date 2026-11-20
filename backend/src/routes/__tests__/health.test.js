import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const Fastify = require('fastify')

let databaseError
const id = require.resolve('../../config/db')
require.cache[id] = {
  id, filename: id, loaded: true,
  exports: { native: { query: async () => { if (databaseError) throw databaseError } } },
}

let app
beforeAll(async () => {
  app = Fastify()
  await app.register(require('../health'))
})
afterAll(async () => app.close())

describe('database readiness', () => {
  it('reports healthy when PostgreSQL answers', async () => {
    databaseError = null
    const response = await app.inject('/health')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('fails health checks without exposing database details when PostgreSQL is unavailable', async () => {
    databaseError = new Error('getaddrinfo EAI_AGAIN postgres')
    const response = await app.inject('/health')
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'error' })
  })
})
