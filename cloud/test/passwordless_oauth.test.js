// Đăng nhập không mật khẩu (mã 6 số qua email) và OAuth cho app: mã → PKCE → vé → làm mới; chống dò; max_age=0; hạn 30 ngày
// (docs/mcah-ke-hoach-tai-khoan-tu-tren-xuong.md 3.1, 3.8).
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

// Trình duyệt giả: giữ cookie giữa các lần gọi.
// Mỗi trình duyệt giả một IP (giới hạn 20 lần / phút / IP của các trang đăng nhập dùng chung giữa các test).
let nextIp = 0
function browser() {
  const jar = {}
  const remoteAddress = `10.0.0.${++nextIp}`
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
    get: async (url) => remember(await app.inject({ method: 'GET', url, remoteAddress, headers: { cookie: cookieHeader() } })),
    post: async (url, form) => remember(await app.inject({ method: 'POST', url, remoteAddress, headers: { cookie: cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams(form).toString() })),
  }
}

const authorizeUrl = (challenge, extra = '') => `/authorize?client_id=mcah-desktop&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256&state=${'s'.repeat(20)}${extra}`
const codeFrom = (html) => new URL(/url=([^"]+)"/.exec(html)[1].replace(/&#38;/g, '&').replace(/&amp;/g, '&')).searchParams.get('code')
const shortFrom = (html) => /aria-label="Mã đăng nhập">([A-Z0-9-]+)</.exec(html)[1]
const token = (body) => app.inject({ method: 'POST', url: '/token', payload: body })

const pool = () => require('../src/db')
const config = require('../src/config')
const lastCode = (to) => /: (\d{6})/.exec(mailer.sent.filter((m) => m.to === to.toLowerCase()).at(-1).subject)[1]
const ip = (n) => ({ remoteAddress: `10.1.0.${n}` })

// Đăng nhập trên trang web bằng mã email; trả trang sau khi nhập mã (trang "Đã đăng nhập" / trao mã cho app).
async function loginWithCode(b, email) {
  const sent = await b.post('/dang-nhap/email', { email })
  expect([sent.statusCode, sent.headers.location]).toEqual([303, '/dang-nhap/ma'])
  return b.post('/dang-nhap/ma', { code: lastCode(email) })
}

// Tài khoản do quản trị tạo (không qua đăng ký): chỉ có email + họ tên.
async function account(email, name = 'Thử') {
  const { rows } = await pool().query('INSERT INTO account (email, full_name) VALUES ($1, $2) RETURNING *', [email, name])
  return rows[0]
}
// Lùi các mã đã gửi về quá khứ để test gửi mã tiếp: mặc định qua cả mốc chờ 60 giây lẫn giới hạn 5 thư / giờ.
const allowResend = (email, seconds = 2 * 3600) => pool().query("UPDATE login_code SET created_at = created_at - ($2 || ' seconds')::interval WHERE email = $1", [email, String(seconds)])

beforeAll(async () => {
  await resetDb()
  app = build({ logger: false })
  await app.ready()
  await account('halinh@thu.vn', 'Hà Linh')
})
afterAll(() => app.close())

describe('đăng nhập bằng mã email', () => {
  it('trang đăng nhập không còn mật khẩu, đăng ký, quên mật khẩu; địa chỉ cũ không còn', async () => {
    const page = (await browser().get('/dang-nhap')).body
    expect(page).toContain('Tiếp tục với email')
    expect(page).not.toMatch(/type="password"|Đăng ký|Quên mật khẩu/)
    for (const url of ['/dang-ky', '/quen-mat-khau', '/dat-lai', '/xac-minh', '/moi?token=x']) expect((await browser().get(url)).statusCode).toBe(404)
    expect((await browser().post('/dang-nhap', { email: 'halinh@thu.vn', password: 'x' })).statusCode).toBe(404)
  })

  it('gửi mã → nhập đúng thì đăng nhập, đặt email_verified_at và lần đăng nhập; mã chỉ dùng một lần', async () => {
    const b = browser()
    const done = await loginWithCode(b, 'HaLinh@thu.vn')
    expect(done.body).toContain('Đã đăng nhập')
    const a = (await pool().query("SELECT * FROM account WHERE email = 'halinh@thu.vn'")).rows[0]
    expect(a.email_verified_at).toBeTruthy()
    expect(a.last_login_method).toBe('email_code')
    expect(mailer.sent.at(-1).text).not.toMatch(/https?:/)
    const reuse = await browser().post('/dang-nhap/ma', { code: lastCode('halinh@thu.vn') })
    expect(reuse.headers.location).toBe('/dang-nhap')
  })

  it('sai mã báo lỗi; sai 5 lần thì mã hết hiệu lực kể cả nhập đúng; quá 10 phút thì hết hạn', async () => {
    await allowResend('halinh@thu.vn')
    const b = browser()
    await b.post('/dang-nhap/email', { email: 'halinh@thu.vn' })
    const right = lastCode('halinh@thu.vn')
    const wrong = right === '000000' ? '111111' : '000000'
    expect((await b.post('/dang-nhap/ma', { code: wrong })).body).toContain('Mã không đúng')
    for (let i = 0; i < 4; i++) await b.post('/dang-nhap/ma', { code: wrong })
    expect((await b.post('/dang-nhap/ma', { code: right })).body).toContain('hết hiệu lực')

    await allowResend('halinh@thu.vn')
    await b.post('/dang-nhap/gui-lai', {})
    await pool().query("UPDATE login_code SET expires_at = NOW() - INTERVAL '1 second' WHERE email = 'halinh@thu.vn'")
    expect((await b.post('/dang-nhap/ma', { code: lastCode('halinh@thu.vn') })).body).toContain('hết hiệu lực')
  })

  it('gửi lại: chặn trong 60 giây, sau đó gửi được và mã cũ không dùng được nữa', async () => {
    await allowResend('halinh@thu.vn')
    const b = browser()
    await b.post('/dang-nhap/email', { email: 'halinh@thu.vn' })
    const first = lastCode('halinh@thu.vn')
    expect((await b.post('/dang-nhap/gui-lai', {})).body).toMatch(/Thử gửi lại sau \d+ giây/)
    await allowResend('halinh@thu.vn')
    expect((await b.post('/dang-nhap/gui-lai', {})).body).toContain('Đã gửi mã mới')
    const second = lastCode('halinh@thu.vn')
    if (first !== second) expect((await b.post('/dang-nhap/ma', { code: first })).body).toContain('Mã không đúng')
    expect((await b.post('/dang-nhap/ma', { code: second })).body).toContain('Đã đăng nhập')
  })

  it('email chưa có tài khoản: trang như thường nhưng không có thư, không đăng nhập được; email sai dạng báo dưới ô', async () => {
    const before = mailer.sent.length
    const b = browser()
    const res = await b.post('/dang-nhap/email', { email: 'la@khong-co.vn' })
    expect(res.headers.location).toBe('/dang-nhap/ma')
    expect((await b.get('/dang-nhap/ma')).body).toContain('la@khong-co.vn')
    expect(mailer.sent.length).toBe(before)
    expect((await b.post('/dang-nhap/ma', { code: '123456' })).body).toContain('Mã không đúng')
    expect((await pool().query("SELECT COUNT(*)::int n FROM account WHERE email = 'la@khong-co.vn'")).rows[0].n).toBe(0)
    const bad = await browser().post('/dang-nhap/email', { email: 'khong-phai-email' })
    expect([bad.statusCode, /aria-invalid="true"/.test(bad.body)]).toEqual([400, true])
  })

  it('tối đa 5 thư / email / giờ', async () => {
    await account('nhieu@thu.vn')
    for (let i = 0; i < 5; i++) {
      await allowResend('nhieu@thu.vn', 61)
      expect((await app.inject({ method: 'POST', url: '/dang-nhap/email', payload: 'email=nhieu%40thu.vn', headers: { 'content-type': 'application/x-www-form-urlencoded' }, ...ip(i) })).statusCode).toBe(303)
    }
    await allowResend('nhieu@thu.vn', 61)
    const res = await app.inject({ method: 'POST', url: '/dang-nhap/email', payload: 'email=nhieu%40thu.vn', headers: { 'content-type': 'application/x-www-form-urlencoded' }, ...ip(9) })
    expect(res.body).toContain('quá nhiều mã')
  })

  it('tài khoản bị khoá: không có thư', async () => {
    const locked = await account('khoa@thu.vn')
    await require('../src/services/accounts').setDisabled(locked.id, true)
    const before = mailer.sent.length
    const b = browser()
    await b.post('/dang-nhap/email', { email: 'khoa@thu.vn' })
    expect(mailer.sent.length).toBe(before)
  })

  it('email nội bộ Axalize (CLOUD_ADMIN_EMAILS) tự có tài khoản ở lần đăng nhập đầu; email khác thì không', async () => {
    config.adminEmails.push('sales@axalize.vn')
    try {
      expect((await loginWithCode(browser(), 'sales@axalize.vn')).body).toContain('Đã đăng nhập')
    } finally {
      config.adminEmails.pop()
    }
  })
})

describe('OAuth cho app', () => {
  it('PKCE: đăng nhập trên web → mã → vé + refresh; mã chỉ dùng một lần; verifier sai bị từ chối', async () => {
    const b = browser()
    const { verifier, challenge } = pkce()
    expect((await b.get(authorizeUrl(challenge))).headers.location).toBe('/dang-nhap')
    await allowResend('halinh@thu.vn')
    const done = await loginWithCode(b, 'halinh@thu.vn')
    const code = codeFrom(done.body)
    expect((await token({ grant_type: 'authorization_code', code, code_verifier: 'sai', redirect_uri: REDIRECT })).statusCode).toBe(400)
    // Mã đã bị tiêu ở lần sai trên (dùng một lần) → phải lấy mã mới (phiên trình duyệt đã xoá → đăng nhập lại).
    await b.get(authorizeUrl(challenge))
    await allowResend('halinh@thu.vn')
    const again = await loginWithCode(b, 'halinh@thu.vn')
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
    await b.get(authorizeUrl(challenge))
    await allowResend('halinh@thu.vn')
    const page = await loginWithCode(b, 'halinh@thu.vn')
    const res = await token({ grant_type: 'authorization_code', short_code: shortFrom(page.body).toLowerCase(), code_verifier: verifier })
    expect(res.statusCode).toBe(200)
  })

  it('redirect_uri không phải 127.0.0.1 bị từ chối', async () => {
    const res = await browser().get(`/authorize?client_id=mcah-desktop&redirect_uri=${encodeURIComponent('https://ke-gian.vn/callback')}&code_challenge=${'a'.repeat(43)}&state=${'s'.repeat(20)}`)
    expect(res.statusCode).toBe(400)
  })

  async function appTokens() {
    const b = browser()
    const { verifier, challenge } = pkce()
    await b.get(authorizeUrl(challenge))
    await allowResend('halinh@thu.vn')
    const page = await loginWithCode(b, 'halinh@thu.vn')
    return { b, challenge, tokens: (await token({ grant_type: 'authorization_code', code: codeFrom(page.body), code_verifier: verifier, redirect_uri: REDIRECT })).json() }
  }

  it('refresh xoay vòng; dùng lại token cũ thì huỷ cả họ', async () => {
    const { tokens: first } = await appTokens()
    const second = (await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token })).json()
    expect(second.refresh_token).not.toBe(first.refresh_token)
    expect((await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token })).statusCode).toBe(400)
    // Token mới nhất cũng bị huỷ theo họ.
    expect((await token({ grant_type: 'refresh_token', refresh_token: second.refresh_token })).statusCode).toBe(400)
  })

  it('hạn cứng 30 ngày: vé không vượt mốc; quá mốc thì refresh báo session_expired', async () => {
    const { tokens } = await appTokens()
    await pool().query("UPDATE refresh_token SET auth_time = NOW() - INTERVAL '27 days', expires_at = NOW() + INTERVAL '3 days' WHERE account_id = (SELECT id FROM account WHERE email = 'halinh@thu.vn') AND revoked_at IS NULL")
    const near = (await token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })).json()
    const claims = tickets.verify(near.ticket)
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(3 * 86400 + 5)
    await pool().query("UPDATE refresh_token SET expires_at = NOW() - INTERVAL '1 second' WHERE account_id = (SELECT id FROM account WHERE email = 'halinh@thu.vn') AND revoked_at IS NULL")
    const over = await token({ grant_type: 'refresh_token', refresh_token: near.refresh_token })
    expect([over.statusCode, over.json().error]).toEqual([400, 'session_expired'])
  })

  it('tài khoản bị khoá: refresh bị từ chối', async () => {
    const { tokens } = await appTokens()
    const accounts = require('../src/services/accounts')
    const a = await accounts.findByEmail('halinh@thu.vn')
    await accounts.setDisabled(a.id, true)
    expect((await token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })).statusCode).toBe(400)
    await accounts.setDisabled(a.id, false)
  })

  it('trao mã cho app xong thì xoá phiên trình duyệt; max_age=0 điền sẵn email và bắt nhập mã mới', async () => {
    const { b, challenge } = await appTokens()
    const again = await b.get(authorizeUrl(challenge))
    expect([again.statusCode, again.headers.location]).toEqual([302, '/dang-nhap'])
    const re = await b.get(authorizeUrl(challenge, '&max_age=0'))
    expect(re.headers.location).toContain('/dang-nhap?lai=1&email=halinh')
    const page = (await b.get(re.headers.location)).body
    expect(page).toContain('Xác nhận lại')
    expect(page).toMatch(/value="halinh@thu.vn" readonly/)
  })
})
