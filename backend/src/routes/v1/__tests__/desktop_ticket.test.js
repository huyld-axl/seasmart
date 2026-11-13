// Đăng nhập app máy tính bằng vé: vé ký đúng khoá (theo kid) mới nhận; sai khoá / sai kid / hết hạn bị từ chối;
// máy chưa có văn phòng thì trả needs_office.
import { describe, it, expect, beforeAll } from 'vitest'
import { createRequire } from 'module'
import crypto from 'crypto'
import Fastify from 'fastify'

const require = createRequire(import.meta.url)
process.env.JWT_SECRET ||= 'x'.repeat(40)
const pool = require('../../../config/db')
const routes = require('../desktop_ticket.routes')

const keys = crypto.generateKeyPairSync('ed25519')
const pem = keys.publicKey.export({ type: 'spki', format: 'pem' })
const kid = crypto.createHash('sha256').update(pem).digest('hex').slice(0, 16)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function ticket(claims, { key = keys.privateKey, k = kid } = {}) {
  const h = b64({ alg: 'EdDSA', kid: k })
  const p = b64({ aud: 'mcah-office', sub: 'acc-1', email: 'a@b.vn', exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
  return `${h}.${p}.${crypto.sign(null, Buffer.from(`${h}.${p}`), key).toString('base64url')}`
}

let app
beforeAll(async () => {
  pool.query = async () => [[]] // máy chưa có văn phòng
  app = Fastify()
  app.register(require('@fastify/jwt'), { secret: process.env.JWT_SECRET })
  app.decorate('authenticate', async () => {})
  app.register(routes, { publicKeyPem: pem, prefix: '/auth' })
  await app.ready()
})
const post = (t) => app.inject({ method: 'POST', url: '/auth/desktop-ticket', payload: { ticket: t } })

describe('desktop-ticket', () => {
  it('vé đúng, máy chưa có văn phòng → needs_office', async () => {
    const res = await post(ticket({}))
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ needs_office: true, account: { email: 'a@b.vn' } })
  })
  it('vé ký bằng khoá lạ, sai kid, hết hạn, sai aud → 401', async () => {
    const other = crypto.generateKeyPairSync('ed25519').privateKey
    expect((await post(ticket({}, { key: other }))).statusCode).toBe(401)
    expect((await post(ticket({}, { k: 'abcdef0123456789' }))).statusCode).toBe(401)
    expect((await post(ticket({ exp: Math.floor(Date.now() / 1000) - 1 }))).statusCode).toBe(401)
    expect((await post(ticket({ aud: 'khac' }))).statusCode).toBe(401)
  })
  it('dấu máy chính = 32 ký tự đầu SHA-256 của khoá PEM chuẩn hoá', () => {
    expect(routes.machineId(pem)).toBe(crypto.createHash('sha256').update(pem).digest('hex').slice(0, 32))
  })
})
