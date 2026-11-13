// "Tiếp tục với Google" với Google giả: kiểm state / nonce / aud / iss / email đã xác minh / auth_time khi đăng nhập
// lại; gắn tài khoản theo google_sub rồi theo email; tạo tài khoản mới.
import { describe, it, expect, beforeAll } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { resetDb } = require('./helpers')
const config = require('../src/config')
const google = require('../src/services/google')
const accounts = require('../src/services/accounts')

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const idToken = (claims) => `${b64({ alg: 'RS256' })}.${b64(claims)}.chu-ky`
const fakeGoogle = (claims, ok = true) => async () => ({ ok, json: async () => (ok ? { id_token: idToken(claims) } : { error: 'invalid_grant' }) })

beforeAll(async () => {
  await resetDb()
  config.google.clientId = 'client-thu.apps.googleusercontent.com'
  config.google.clientSecret = 'bi-mat-thu'
})

const good = (pending, extra = {}) => ({ iss: 'https://accounts.google.com', aud: config.google.clientId, exp: Math.floor(Date.now() / 1000) + 600, nonce: pending.nonce, sub: 'g-123', email: 'Ha.Linh@gmail.com', email_verified: true, name: 'Hà Linh', ...extra })

describe('Google', () => {
  it('địa chỉ Google có PKCE, state, nonce; đăng nhập lại thêm prompt=login + max_age=0', () => {
    const { url, pending } = google.start()
    const u = new URL(url)
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
    expect(u.searchParams.get('state')).toBe(pending.state)
    expect(u.searchParams.get('redirect_uri')).toBe(`${config.publicUrl}/google/callback`)
    const re = new URL(google.start({ reauth: true }).url)
    expect([re.searchParams.get('prompt'), re.searchParams.get('max_age')]).toEqual(['login', '0'])
  })

  it('từ chối: state sai, nonce sai, aud sai, iss lạ, email chưa xác minh, Google báo lỗi', async () => {
    const { pending } = google.start()
    const run = (claims, opts = {}) => google.finish({ code: 'c', state: opts.state ?? pending.state, pending, fetchImpl: fakeGoogle(claims, opts.ok ?? true) })
    await expect(run(good(pending), { state: 'khac' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(run(good(pending, { nonce: 'khac' }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(run(good(pending, { aud: 'app-khac' }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(run(good(pending, { iss: 'https://gia-mao.vn' }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(run(good(pending, { email_verified: false }))).rejects.toMatchObject({ message: 'Email Google chưa được xác minh' })
    await expect(run(good(pending), { ok: false })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('đăng nhập lại: auth_time cũ (phiên Google có sẵn) bị từ chối, mới thì nhận', async () => {
    const { pending } = google.start({ reauth: true })
    const old = Math.floor(Date.now() / 1000) - 3600
    await expect(google.finish({ code: 'c', state: pending.state, pending, fetchImpl: fakeGoogle(good(pending, { auth_time: old })) })).rejects.toMatchObject({ statusCode: 400 })
    const fresh = await google.finish({ code: 'c', state: pending.state, pending, fetchImpl: fakeGoogle(good(pending, { auth_time: Math.floor(Date.now() / 1000) })) })
    expect(fresh.email).toBe('ha.linh@gmail.com')
  })

  it('tạo tài khoản mới; lần sau tìm theo google_sub; tài khoản email có sẵn thì gắn vào', async () => {
    const a = await google.accountFor({ sub: 'g-123', email: 'ha.linh@gmail.com', name: 'Hà Linh' })
    expect(a.email_verified_at).toBeTruthy()
    expect((await google.accountFor({ sub: 'g-123', email: 'ha.linh@gmail.com' })).id).toBe(a.id)
    const existing = await accounts.register({ email: 'co.san@thu.vn', fullName: 'Có Sẵn', password: 'MatKhauDai123' })
    expect((await google.accountFor({ sub: 'g-999', email: 'co.san@thu.vn' })).id).toBe(existing.id)
    await expect(google.accountFor({ sub: 'g-khac', email: 'co.san@thu.vn' })).rejects.toMatchObject({ statusCode: 400 })
  })
})
