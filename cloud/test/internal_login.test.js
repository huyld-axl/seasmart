// Đăng nhập khu nội bộ /internal (docs/mcah-ke-hoach-khu-noi-bo.md 5.3, 5.4; testcase nhóm B, C, D): mật khẩu → cài 2FA →
// mã khôi phục; đăng nhập hằng ngày; chống dùng lại mã; khoá 15 phút; reset đá phiên cũ; _check cho nginx; ?next an toàn.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { resetDb } = require('./helpers')
const { build } = require('../server')
const config = require('../src/config')
const adminAuth = require('../src/services/admin_auth')
const totp = require('../src/services/totp')

const EMAIL = 'noibo@axalize.vn'
const PASSWORD = 'mat-khau-noi-bo-dai'
const I = '/internal'
let app
let savedEmail
let nextIp = 0
const pool = () => require('../src/db')

// Trình duyệt giả: giữ cookie, mỗi trình duyệt một IP (giới hạn 10 lần / phút / IP của các POST đăng nhập).
function browser() {
  const jar = {}
  const remoteAddress = `10.1.0.${++nextIp}`
  const remember = (res) => {
    for (const c of [].concat(res.headers['set-cookie'] || [])) {
      const [pair] = c.split(';')
      const [k, ...v] = pair.split('=')
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)) delete jar[k]
      else jar[k] = v.join('=')
    }
    return res
  }
  const headers = (extra = {}) => ({ cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...extra })
  return {
    jar,
    get: async (url) => remember(await app.inject({ method: 'GET', url, remoteAddress, headers: headers() })),
    post: async (url, form, extra = {}) => remember(await app.inject({ method: 'POST', url, remoteAddress, headers: headers({ 'content-type': 'application/x-www-form-urlencoded', ...extra }), payload: new URLSearchParams(form).toString() })),
  }
}

const accountId = async () => (await adminAuth.current()).account.id
const codeNow = async () => {
  const { rows } = await pool().query('SELECT * FROM admin_auth WHERE account_id = $1', [await accountId()])
  return rows[0]
}

// Đăng nhập trọn (mật khẩu + cài 2FA lần đầu). → { b, secret, codes }
async function enroll() {
  const b = browser()
  const res = await b.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
  expect([res.statusCode, res.headers.location]).toEqual([303, `${I}/login/setup`])
  const secret = await adminAuth.pendingSecret(await accountId())
  const done = await b.post(`${I}/login/setup`, { code: totp.codeAt(secret, totp.stepAt()) })
  const codes = [...done.body.matchAll(/<span>([A-Z0-9]{4}-[A-Z0-9]{4})<\/span>/g)].map((m) => m[1])
  return { b, secret, codes, done }
}

// Mã của bước kế tiếp: bước hiện tại vừa dùng lúc cài thì không dùng lại được.
const nextCode = (secret) => totp.codeAt(secret, totp.stepAt() + 1)

beforeAll(async () => {
  await resetDb()
  savedEmail = config.adminEmail
  config.adminEmail = EMAIL
  app = build({ logger: false })
  await app.ready()
})
afterAll(async () => {
  config.adminEmail = savedEmail
  await app.close()
})
beforeEach(async () => {
  await pool().query('DELETE FROM audit')
  await pool().query('DELETE FROM admin_recovery_code')
  await pool().query('DELETE FROM admin_auth')
  await adminAuth.setPassword(PASSWORD)
  await pool().query("DELETE FROM audit WHERE action = 'admin_password_set'")
})

describe('đăng nhập khu nội bộ', () => {
  it('chưa đăng nhập: trang quản trị và _check từ chối; ?next chỉ nhận đường dưới /internal', async () => {
    const b = browser()
    expect((await b.get(`${I}/admin/accounts?q=a`)).headers.location).toBe(`${I}/login?next=${encodeURIComponent('/internal/admin/accounts?q=a')}`)
    expect((await b.get(`${I}/_check`)).statusCode).toBe(401)
    expect((await b.get(`${I}/login?next=https://evil.vn`)).body).toContain(`name="next" value="${I}/admin"`)
    expect((await b.get(`${I}/login?next=//evil.vn/internal/`)).body).toContain(`name="next" value="${I}/admin"`)
    expect((await b.get(`${I}/login/verify`)).headers.location).toBe(`${I}/login?expired=1`)
  })

  it('sai email hay sai mật khẩu cùng một câu; thiếu ô thì báo dưới ô', async () => {
    const b = browser()
    for (const form of [{ email: 'khac@axalize.vn', password: PASSWORD }, { email: EMAIL, password: 'sai-mat-khau-roi' }]) {
      const res = await b.post(`${I}/login`, form)
      expect([res.statusCode, res.body.includes('Email hoặc mật khẩu không đúng.')]).toEqual([400, true])
    }
    const empty = await b.post(`${I}/login`, { email: '', password: '' })
    expect([empty.body.includes('Nhập email'), empty.body.includes('Nhập mật khẩu')]).toEqual([true, true])
  })

  it('lần đầu: QR → mã đúng → 8 mã khôi phục, vào được; tải lại trang mã khôi phục thì về trang quản trị', async () => {
    const b = browser()
    await b.post(`${I}/login`, { email: EMAIL, password: PASSWORD, next: `${I}/design-system/` })
    const page = await b.get(`${I}/login/setup`)
    expect(page.body).toContain('<svg')
    const again = await b.get(`${I}/login/setup`)
    expect(again.body.match(/class="secret">([^<]+)/)[1]).toBe(page.body.match(/class="secret">([^<]+)/)[1])
    const secret = await adminAuth.pendingSecret(await accountId())
    expect((await b.post(`${I}/login/setup`, { code: '000000' })).body).toContain('Mã không đúng')
    const done = await b.post(`${I}/login/setup`, { code: totp.codeAt(secret, totp.stepAt()) })
    expect(done.body).toContain('Lưu mã khôi phục')
    expect([...done.body.matchAll(/<span>[A-Z0-9]{4}-[A-Z0-9]{4}<\/span>/g)].length).toBe(8)
    expect(done.body).toContain(`href="${I}/design-system/"`)
    expect((await b.get(`${I}/_check`)).statusCode).toBe(204)
    expect((await b.get(`${I}/admin`)).statusCode).toBe(200)
    // Tải lại / Back sau trang mã khôi phục: không hiện lại mã, về trang quản trị.
    const reload = await b.post(`${I}/login/setup`, { code: '123456' })
    expect(reload.headers.location).toBe(`${I}/login?expired=1`)
    expect((await b.get(reload.headers.location)).headers.location).toBe(`${I}/admin`)
    const { rows } = await pool().query("SELECT action FROM audit WHERE action LIKE 'admin_%' ORDER BY id")
    expect(rows.map((r) => r.action)).toEqual(['admin_2fa_fail', 'admin_2fa_enroll', 'admin_login'])
  })

  it('hằng ngày: mật khẩu → mã; mã vừa dùng không dùng lại; đăng xuất', async () => {
    const { secret } = await enroll()
    const b = browser()
    expect((await b.post(`${I}/login`, { email: EMAIL, password: PASSWORD })).headers.location).toBe(`${I}/login/verify`)
    expect((await b.get(`${I}/login/verify`)).body).toContain(`MCAH internal · ${EMAIL}`)
    const code = nextCode(secret)
    expect((await b.post(`${I}/login/verify`, { code })).headers.location).toBe(`${I}/admin`)
    const c = browser()
    await c.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
    expect((await c.post(`${I}/login/verify`, { code })).body).toContain('Mã không đúng')
    expect((await b.get(`${I}/logout`)).headers.location).toBe(`${I}/login`)
    expect((await b.get(`${I}/_check`)).statusCode).toBe(401)
    expect((await codeNow()).totp_last_step).toBe(String(totp.stepAt() + 1))
  })

  it('mã khôi phục: dùng một lần, báo còn mấy mã', async () => {
    const { codes } = await enroll()
    const b = browser()
    await b.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
    const res = await b.post(`${I}/login/recovery`, { code: codes[0].toLowerCase().replace('-', '') })
    expect(res.headers.location).toBe(`${I}/admin?recovery_left=7`)
    expect((await b.get(res.headers.location)).body).toContain('Còn <b>7</b> mã')
    const c = browser()
    await c.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
    expect((await c.post(`${I}/login/recovery`, { code: codes[0] })).body).toContain('không đúng hoặc đã dùng')
  })

  it('sai 5 lần (mật khẩu và mã cộng chung) thì khoá 15 phút, kể cả nhập đúng', async () => {
    const { secret } = await enroll()
    const b = browser()
    for (let i = 0; i < 3; i++) await b.post(`${I}/login`, { email: EMAIL, password: 'sai-mat-khau-roi' })
    await b.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
    await b.post(`${I}/login/verify`, { code: '000000' })
    const last = await b.post(`${I}/login/verify`, { code: '111111' })
    expect(last.body).toContain('Sai quá nhiều lần')
    const c = browser()
    const locked = await c.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
    expect([locked.statusCode, locked.body.includes('Sai quá nhiều lần')]).toEqual([429, true])
    await pool().query("UPDATE audit SET created_at = NOW() - INTERVAL '16 minutes'")
    await c.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
    expect((await c.post(`${I}/login/verify`, { code: nextCode(secret) })).headers.location).toBe(`${I}/admin`)
  })

  it('reset 2FA / đổi mật khẩu đá phiên đang mở; reset thì đăng nhập lại phải cài lại', async () => {
    const { b } = await enroll()
    await adminAuth.resetTotp()
    expect((await b.get(`${I}/admin`)).statusCode).toBe(302)
    const c = browser()
    expect((await c.post(`${I}/login`, { email: EMAIL, password: PASSWORD })).headers.location).toBe(`${I}/login/setup`)
    const { b: d } = await enroll()
    await adminAuth.setPassword('mat-khau-moi-hoan-toan')
    expect((await d.get(`${I}/admin`)).statusCode).toBe(302)
    expect((await browser().post(`${I}/login`, { email: EMAIL, password: PASSWORD })).statusCode).toBe(400)
    await expect(adminAuth.setPassword('ngan')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('POST từ trang khác bị chặn; tài khoản admin bị khoá thì không vào được', async () => {
    const res = await browser().post(`${I}/login`, { email: EMAIL, password: PASSWORD }, { 'sec-fetch-site': 'cross-site' })
    expect(res.statusCode).toBe(403)
    const { b } = await enroll()
    await pool().query('UPDATE account SET disabled_at = NOW() WHERE id = $1', [(await pool().query('SELECT id FROM account WHERE email = $1', [EMAIL])).rows[0].id])
    expect((await b.get(`${I}/_check`)).statusCode).toBe(401)
    await pool().query('UPDATE account SET disabled_at = NULL WHERE email = $1', [EMAIL])
  })
})

describe('đường cũ', () => {
  it('trang tài khoản tiếng Việt cũ chuyển sang tên mới (GET 301, POST 308, giữ query)', async () => {
    const b = browser()
    const get = await b.get('/dang-nhap?email=a%40b.vn')
    expect([get.statusCode, get.headers.location]).toEqual([301, '/login?email=a%40b.vn'])
    expect((await b.get('/xong')).headers.location).toBe('/done')
    const post = await b.post('/dang-nhap/email', { email: 'a@b.vn' })
    expect([post.statusCode, post.headers.location]).toEqual([308, '/login/email'])
    expect((await b.get('/quan-tri/nhat-ky')).headers.location).toBe(`${I}/admin/audit-log`)
    expect((await b.get('/quan-tri/tai-khoan?q=x')).headers.location).toBe(`${I}/admin/accounts?q=x`)
    expect((await b.get('/dieu-khoan')).statusCode).toBe(404)
  })
})
