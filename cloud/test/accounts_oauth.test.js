// Tài khoản và OAuth cho app: đăng ký → xác minh → đăng nhập → PKCE → vé → làm mới; chống dò; max_age=0.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import crypto from 'crypto'

const require = createRequire(import.meta.url)
const { resetDb } = require('./helpers')
const { build } = require('../server')
const mailer = require('../src/services/mailer')
const tickets = require('../src/services/tickets')

let app
const b64url = (b) => Buffer.from(b).toString('base64url')
const pkce = () => {
  const verifier = b64url(crypto.randomBytes(32))
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) }
}
const REDIRECT = 'http://127.0.0.1:45678/callback'
const lastMailLink = (re) => re.exec(mailer.sent.at(-1).text)[1]

// Trình duyệt giả: giữ cookie giữa các lần gọi.
function browser() {
  const jar = {}
  const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
  const remember = (res) => {
    for (const c of [].concat(res.headers['set-cookie'] || [])) {
      const [pair] = c.split(';')
      const [k, ...v] = pair.split('=')
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)) delete jar[k]
      else jar[k] = v.join('=')
    }
    return res
  }
  return {
    get: async (url) => remember(await app.inject({ method: 'GET', url, headers: { cookie: cookieHeader() } })),
    post: async (url, form) => remember(await app.inject({ method: 'POST', url, headers: { cookie: cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams(form).toString() })),
  }
}

const authorizeUrl = (challenge, extra = '') => `/authorize?client_id=mcah-desktop&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256&state=${'s'.repeat(20)}${extra}`
const codeFrom = (html) => new URL(/url=([^"]+)"/.exec(html)[1].replace(/&#38;/g, '&').replace(/&amp;/g, '&')).searchParams.get('code')
const shortFrom = (html) => /aria-label="Mã đăng nhập">([A-Z0-9-]+)</.exec(html)[1]
const token = (body) => app.inject({ method: 'POST', url: '/token', payload: body })

beforeAll(async () => {
  await resetDb()
  app = build({ logger: false })
  await app.ready()
})
afterAll(() => app.close())

describe('đăng ký và đăng nhập', () => {
  it('chưa xác minh thì không đăng nhập được; xác minh xong thì được', async () => {
    const b = browser()
    const reg = await b.post('/dang-ky', { full_name: 'Hà Linh', email: 'halinh@thu.vn', password: 'MatKhauDai123' })
    expect(reg.body).toContain('Đã gửi thư tới halinh@thu.vn')
    expect((await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauDai123' })).body).toContain('chưa xác minh')
    const verify = await b.get(`/xac-minh?token=${lastMailLink(/token=([\w-]+)/)}`)
    expect(verify.body).toContain('Đã xác minh email')
    expect((await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauDai123' })).body).toContain('Đã đăng nhập')
  })

  it('mật khẩu ngắn / phổ biến bị từ chối', async () => {
    const b = browser()
    expect((await b.post('/dang-ky', { full_name: 'A', email: 'a@thu.vn', password: 'ngan' })).body).toContain('ít nhất 10')
    expect((await b.post('/dang-ky', { full_name: 'A', email: 'a@thu.vn', password: '1234567890' })).body).toContain('quá phổ biến')
  })

  it('sai mật khẩu 5 lần thì khoá 15 phút, kể cả mật khẩu đúng', async () => {
    const b = browser()
    for (let i = 0; i < 5; i++) await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'sai-mat-khau-x' })
    const res = await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauDai123' })
    expect(res.statusCode).toBe(429)
    await require('../src/db').query('DELETE FROM login_failure')
  })

  it('quên mật khẩu: đặt lại, mật khẩu cũ hết dùng', async () => {
    const b = browser()
    await b.post('/quen-mat-khau', { email: 'halinh@thu.vn' })
    const t = lastMailLink(/token=([\w-]+)/)
    expect((await b.post('/dat-lai', { token: t, password: 'MatKhauMoi4567' })).body).toContain('Đã đổi mật khẩu')
    expect((await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauDai123' })).statusCode).toBe(401)
    expect((await b.post('/dat-lai', { token: t, password: 'MatKhauKhac999' })).body).toContain('hết hạn')
  })
})

describe('OAuth cho app', () => {
  it('PKCE: đăng nhập trên web → mã → vé + refresh; mã chỉ dùng một lần; verifier sai bị từ chối', async () => {
    const b = browser()
    const { verifier, challenge } = pkce()
    expect((await b.get(authorizeUrl(challenge))).headers.location).toBe('/dang-nhap')
    const done = await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauMoi4567' })
    const code = codeFrom(done.body)
    expect((await token({ grant_type: 'authorization_code', code, code_verifier: 'sai', redirect_uri: REDIRECT })).statusCode).toBe(400)
    // Mã đã bị tiêu ở lần sai trên (dùng một lần) → phải lấy mã mới.
    const again = await b.get(authorizeUrl(challenge))
    const ok = await token({ grant_type: 'authorization_code', code: codeFrom(again.body), code_verifier: verifier, redirect_uri: REDIRECT })
    expect(ok.statusCode).toBe(200)
    const body = ok.json()
    const claims = tickets.verify(body.ticket)
    expect(claims.email).toBe('halinh@thu.vn')
    expect(claims.exp - claims.iat).toBe(7 * 86400)
    expect(body.refresh_token).toBeTruthy()
  })

  it('mã ngắn dự phòng đổi được (cần đúng verifier)', async () => {
    const b = browser()
    const { verifier, challenge } = pkce()
    await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauMoi4567' })
    const page = await b.get(authorizeUrl(challenge))
    const res = await token({ grant_type: 'authorization_code', short_code: shortFrom(page.body).toLowerCase(), code_verifier: verifier })
    expect(res.statusCode).toBe(200)
  })

  it('redirect_uri không phải 127.0.0.1 bị từ chối', async () => {
    const res = await browser().get(`/authorize?client_id=mcah-desktop&redirect_uri=${encodeURIComponent('https://ke-gian.vn/callback')}&code_challenge=${'a'.repeat(43)}&state=${'s'.repeat(20)}`)
    expect(res.statusCode).toBe(400)
  })

  it('refresh xoay vòng; dùng lại token cũ thì huỷ cả họ', async () => {
    const b = browser()
    const { verifier, challenge } = pkce()
    await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauMoi4567' })
    const first = (await token({ grant_type: 'authorization_code', code: codeFrom((await b.get(authorizeUrl(challenge))).body), code_verifier: verifier, redirect_uri: REDIRECT })).json()
    const second = (await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token })).json()
    expect(second.refresh_token).not.toBe(first.refresh_token)
    expect((await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token })).statusCode).toBe(400)
    // Token mới nhất cũng bị huỷ theo họ.
    expect((await token({ grant_type: 'refresh_token', refresh_token: second.refresh_token })).statusCode).toBe(400)
  })

  it('max_age=0: có phiên trình duyệt vẫn bắt nhập lại mật khẩu', async () => {
    const b = browser()
    const { challenge } = pkce()
    await b.post('/dang-nhap', { email: 'halinh@thu.vn', password: 'MatKhauMoi4567' })
    expect((await b.get(authorizeUrl(challenge))).body).toContain('Đã đăng nhập')
    const res = await b.get(authorizeUrl(challenge, '&max_age=0'))
    expect(res.headers.location).toContain('/dang-nhap?lai=1')
  })
})
