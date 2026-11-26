// Văn phòng: Axalize tạo khách (văn phòng + quản trị), quản trị cài máy chính đầu tiên bằng vé, tạo / bỏ thành viên bằng chữ ký
// máy chính, vé mang văn phòng (docs/catoro-ke-hoach-tai-khoan-tu-tren-xuong.md 3.2–3.5).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import crypto from 'crypto'

const require = createRequire(import.meta.url)
const { resetDb } = require('./helpers')
const { build } = require('../server')
const mailer = require('../src/services/mailer')
const tickets = require('../src/services/tickets')
const accounts = require('../src/services/accounts')
const oauth = require('../src/services/oauth')
const { signingInput } = require('../src/routes/api')
const offices = require('../src/services/offices')

let app, axalize, admin, machine, officeId
const pool = () => require('../src/db')

async function verifiedAccount(email, name) {
  const { rows } = await pool().query('INSERT INTO account (email, full_name, email_verified_at) VALUES ($1, $2, NOW()) RETURNING *', [email, name])
  return rows[0]
}

function signed(method, url, body, key = machine.privateKey, time = Date.now()) {
  const raw = JSON.stringify(body)
  const signature = crypto.sign(null, Buffer.from(signingInput(method, url, time, raw)), key).toString('base64')
  return app.inject({ method, url, payload: raw, headers: { 'content-type': 'application/json', 'x-mcah-office': officeId, 'x-mcah-time': String(time), 'x-mcah-signature': signature } })
}

beforeAll(async () => {
  await resetDb()
  app = build({ logger: false })
  await app.ready()
  axalize = await verifiedAccount('sales@axalize.vn', 'Sales')
  machine = crypto.generateKeyPairSync('ed25519')
})
afterAll(() => app.close())

describe('văn phòng', () => {
  it('Axalize tạo khách: văn phòng chưa có máy chính; quản trị cài máy chính đầu tiên không cần đăng nhập lại', async () => {
    const { office } = await offices.createCustomer({ name: 'Công ty ABC', note: 'HĐ 1', adminEmail: 'QuanTri@thu.vn', adminName: 'Quản trị', createdBy: axalize.id })
    officeId = office.id
    admin = await accounts.findByEmail('quantri@thu.vn')
    expect(admin.created_by).toBe(axalize.id)
    expect(tickets.verify((await oauth.buildTicket(admin, Date.now())).ticket)).toMatchObject({ office: officeId, office_role: 'admin', office_name: 'Công ty ABC', office_has_machine: false, machine: null })
    await expect(offices.createCustomer({ name: 'Khác', adminEmail: 'quantri@thu.vn', adminName: 'X', createdBy: axalize.id })).rejects.toMatchObject({ statusCode: 409, field: 'email' })
    // Không còn tạo văn phòng từ app.
    expect((await app.inject({ method: 'POST', url: '/api/offices', payload: {} })).statusCode).toBe(404)

    const pem = machine.publicKey.export({ type: 'spki', format: 'pem' })
    const old = (await oauth.buildTicket(admin, Date.now() - 3600 * 1000)).ticket
    const res = await app.inject({ method: 'POST', url: `/api/offices/${officeId}/machine`, headers: { authorization: `Bearer ${old}` }, payload: { machine_public_key: pem } })
    expect(res.statusCode).toBe(200)
    const claims = tickets.verify((await oauth.buildTicket(admin, Date.now())).ticket)
    expect(claims.office_has_machine).toBe(true)
    expect(claims.machine).toMatch(/^[0-9a-f]{32}$/)
    // Cài máy chính đầu tiên không gửi thư báo chuyển máy.
    expect(mailer.sent.some((m) => m.subject.includes('máy chính mới'))).toBe(false)
  })

  it('tạo tài khoản cần chữ ký máy chính: sai khoá, lệch giờ bị từ chối', async () => {
    const other = crypto.generateKeyPairSync('ed25519')
    expect((await signed('POST', '/api/office/members', { email: 'nv@thu.vn', full_name: 'NV', role: 'member' }, other.privateKey)).statusCode).toBe(401)
    expect((await signed('POST', '/api/office/members', { email: 'nv@thu.vn', full_name: 'NV', role: 'member' }, machine.privateKey, Date.now() - 10 * 60 * 1000)).statusCode).toBe(401)
    expect((await signed('POST', '/api/office/invites', { email: 'nv@thu.vn' })).statusCode).toBe(404)
  })

  it('quản trị tạo nhân viên: có tài khoản ngay, không gửi thư; email thuộc văn phòng khác bị từ chối; bỏ thành viên thì vé mất văn phòng', async () => {
    const before = mailer.sent.length
    const res = await signed('POST', '/api/office/members', { email: 'NV@thu.vn', full_name: 'Nhân viên', role: 'member', created_by_email: 'quantri@thu.vn' })
    expect(res.json()).toEqual({ email: 'nv@thu.vn', created: true })
    expect(mailer.sent.length).toBe(before)
    const nv = await accounts.findByEmail('nv@thu.vn')
    expect(nv.created_by).toBe(admin.id)
    expect(tickets.verify((await oauth.buildTicket(nv, Date.now())).ticket)).toMatchObject({ office: officeId, office_role: 'member', office_has_machine: true })
    expect((await signed('POST', '/api/office/members', { email: 'nv@thu.vn', full_name: 'Nhân viên', role: 'member' })).statusCode).toBe(409)
    await offices.createCustomer({ name: 'Văn phòng khác', adminEmail: 'khac@thu.vn', adminName: 'Khác', createdBy: axalize.id })
    const elsewhere = await signed('POST', '/api/office/members', { email: 'khac@thu.vn', full_name: 'Khác', role: 'member' })
    expect([elsewhere.statusCode, elsewhere.json().error]).toEqual([409, 'member_elsewhere'])

    expect((await signed('POST', '/api/office/members/remove', { email: 'nv@thu.vn' })).json()).toEqual({ removed: true })
    expect(tickets.verify((await oauth.buildTicket(nv, Date.now())).ticket).office).toBeNull()
  })

  it('máy chính báo chứng chỉ trong mạng văn phòng; vé thành viên mang dấu vân tay để ghim', async () => {
    const fp = 'ab'.repeat(32)
    expect((await signed('POST', '/api/office/machine/lan', { fingerprint: 'xyz', name: 'MAY-CHINH', port: 7443 })).statusCode).toBe(400)
    expect((await signed('POST', '/api/office/machine/lan', { fingerprint: fp, name: 'MAY-CHINH', port: 7443 }, crypto.generateKeyPairSync('ed25519').privateKey)).statusCode).toBe(401)
    expect((await signed('POST', '/api/office/machine/lan', { fingerprint: fp, name: 'MAY-CHINH', port: 7443 })).json()).toEqual({ ok: true })
    const admin = await accounts.findByEmail('quantri@thu.vn')
    expect(tickets.verify((await oauth.buildTicket(admin, Date.now())).ticket)).toMatchObject({ machine_cert: fp, machine_name: 'MAY-CHINH', machine_port: 7443 })
  })

  it('chuyển máy chính: cần vé quản trị vừa đăng nhập; máy cũ bị báo machine_replaced', async () => {
    const admin = await accounts.findByEmail('quantri@thu.vn')
    const fresh = crypto.generateKeyPairSync('ed25519')
    const pem = fresh.publicKey.export({ type: 'spki', format: 'pem' })
    const call = (ticket) => app.inject({ method: 'POST', url: `/api/offices/${officeId}/machine`, headers: { authorization: `Bearer ${ticket}`, 'content-type': 'application/json' }, payload: { machine_public_key: pem } })
    const old = (await oauth.buildTicket(admin, Date.now() - 3600 * 1000)).ticket
    expect((await call(old)).json().error).toBe('reauth_required')
    expect((await call((await oauth.buildTicket(admin, Date.now())).ticket)).json()).toEqual({ replaced: true })
    const res = await signed('GET', '/api/office/machine/status', undefined)
    expect([res.statusCode, res.json().error]).toEqual([409, 'machine_replaced'])
    expect((await signed('GET', '/api/office/machine/status', undefined, fresh.privateKey)).json()).toEqual({ ok: true })
    machine = fresh
  })

  it('văn phòng bị khoá thì máy chính bị từ chối', async () => {
    await require('../src/services/offices').setLocked(officeId, true)
    expect((await signed('POST', '/api/office/members', { email: 'x@thu.vn', full_name: 'X', role: 'member' })).statusCode).toBe(403)
    await require('../src/services/offices').setLocked(officeId, false)
  })
})

describe('tính năng qua máy chủ', () => {
  it('tìm danh mục tàu cần chữ ký máy chính và ghi lượt dùng', async () => {
    const pool = require('../src/db')
    await pool.query("INSERT INTO ship_catalog (source_id, imo_number, ship_name) VALUES (9123456, '9123456', 'PACIFIC STAR THU') ON CONFLICT DO NOTHING")
    const res = await signed('GET', '/api/vessels/catalog', undefined)
    expect(res.statusCode).toBe(200)
    const time = Date.now()
    const raw = ''
    const sig = crypto.sign(null, Buffer.from(signingInput('GET', '/api/vessels/catalog', time, raw)), machine.privateKey).toString('base64')
    const found = await app.inject({ method: 'GET', url: '/api/vessels/catalog?q=pacific%20star', headers: { 'x-mcah-office': officeId, 'x-mcah-time': String(time), 'x-mcah-signature': sig } })
    expect(found.json().data[0]).toMatchObject({ imo_number: '9123456', ship_name: 'PACIFIC STAR THU' })
    const { rows } = await pool.query("SELECT COUNT(*) n FROM usage WHERE office_id = $1 AND kind = 'catalog_search'", [officeId])
    expect(Number(rows[0].n)).toBeGreaterThanOrEqual(1)
    expect((await app.inject({ method: 'GET', url: '/api/vessels/catalog?q=pacific' })).statusCode).toBe(401)
  })

  it('AI: ảnh sai loại bị từ chối trước khi gọi nhà cung cấp', async () => {
    const res = await signed('POST', '/api/ai/vision', { task: 'read', images: [{ mimeType: 'application/pdf', base64: 'AA==' }] })
    expect(res.statusCode).toBe(400)
  })
})

describe('trang quản trị nội bộ', () => {
  it('chỉ admin CLOUD_ADMIN_EMAIL (mật khẩu + mã) vào được; thêm khách, thêm quản trị, khoá tài khoản, nhật ký', async () => {
    const config = require('../src/config')
    const adminAuth = require('../src/services/admin_auth')
    const totp = require('../src/services/totp')
    const saved = config.adminEmail
    config.adminEmail = 'sales@axalize.vn'
    const jar = {}
    const go = async (method, url, form, headers = {}) => {
      const r = await app.inject({ method, url, remoteAddress: '10.9.9.9', headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...headers }, payload: form ? new URLSearchParams(form).toString() : undefined })
      for (const c of [].concat(r.headers['set-cookie'] || [])) { const [p] = c.split(';'); const [k, ...v] = p.split('='); jar[k] = v.join('=') }
      return r
    }
    const login = async (email) => {
      await go('POST', '/login/email', { email })
      return go('POST', '/login/code', { code: /: (\d{6})/.exec(mailer.sent.filter((m) => m.to === email).at(-1).subject)[1] })
    }
    const A = '/internal/admin'
    try {
      expect((await go('GET', A)).headers.location).toBe(`/internal/login?next=${encodeURIComponent(A)}`)
      // Đăng nhập tài khoản thường (kể cả quản trị văn phòng, kể cả chính email admin) không mở được khu nội bộ.
      await login('quantri@thu.vn')
      expect((await go('GET', A)).headers.location).toMatch(/^\/internal\/login/)
      const sales = await adminAuth.setPassword('mat-khau-noi-bo-1')
      await login('sales@axalize.vn')
      expect((await go('GET', A)).headers.location).toMatch(/^\/internal\/login/)
      await go('POST', '/internal/login', { email: 'sales@axalize.vn', password: 'mat-khau-noi-bo-1' })
      const secret = await adminAuth.pendingSecret(sales.id)
      expect((await go('POST', '/internal/login/setup', { code: totp.codeAt(secret, totp.stepAt()) })).body).toContain('Lưu mã khôi phục')
      const list = await go('GET', A)
      expect(list.body).toContain('Công ty ABC')
      expect(list.body).toContain('Đang dùng')
      expect(list.body).toContain('Chờ cài máy chính')

      const missing = await go('POST', `${A}/customers`, { name: 'Nam Hải Crew', note: 'HĐ 12', admin_email: '', admin_name: 'An' })
      expect([missing.statusCode, missing.body.includes('Nhập email quản trị'), missing.body.includes('value="HĐ 12"')]).toEqual([400, true, true])
      const taken = await go('POST', `${A}/customers`, { name: 'Nam Hải Crew', admin_email: 'quantri@thu.vn', admin_name: 'An' })
      expect([taken.statusCode, taken.body.includes('đã thuộc một văn phòng khác')]).toEqual([409, true])
      const before = mailer.sent.length
      expect((await go('POST', `${A}/customers`, { name: 'Nam Hải Crew', admin_email: 'an@namhai.vn', admin_name: 'Nguyễn An' })).body).toContain('Đã thêm Nam Hải Crew')
      expect(mailer.sent.length).toBe(before)
      const nh = (await pool().query("SELECT id FROM office WHERE name = 'Nam Hải Crew'")).rows[0]
      expect((await go('GET', `${A}/customers/admins?office=${nh.id}`)).body).toContain('Thêm quản trị cho Nam Hải Crew')
      expect((await go('POST', `${A}/customers/admins`, { office: nh.id, email: 'an2@namhai.vn', full_name: 'An Hai' })).statusCode).toBe(302)
      expect((await offices.membership((await accounts.findByEmail('an2@namhai.vn')).id)).role).toBe('admin')

      const accountsPage = await go('GET', `${A}/accounts?filter=never`)
      expect(accountsPage.body).toContain('an@namhai.vn')
      expect(accountsPage.body).toContain('Chưa đăng nhập')
      expect(accountsPage.body).not.toContain('quantri@thu.vn')

      const target = await accounts.findByEmail('an@namhai.vn')
      expect((await go('POST', `${A}/accounts/lock`, { account: target.id, lock: '1', reason: '' })).statusCode).toBe(400)
      expect((await go('POST', `${A}/accounts/lock`, { account: target.id, lock: '1', reason: 'Nghỉ việc' }, { 'sec-fetch-site': 'cross-site' })).statusCode).toBe(403)
      await go('POST', `${A}/accounts/lock`, { account: target.id, lock: '1', reason: 'Nghỉ việc' })
      expect((await accounts.findById(target.id)).disabled_at).toBeTruthy()
      await go('POST', `${A}/accounts/lock`, { account: target.id, lock: '0' })
      expect((await accounts.findById(target.id)).disabled_at).toBeNull()

      expect((await go('POST', `${A}/customers/lock`, { office: officeId, lock: '1', reason: '' })).statusCode).toBe(400)
      await go('POST', `${A}/customers/lock`, { office: officeId, lock: '1', reason: 'Thử khoá' })
      expect((await offices.get(officeId)).locked_at).toBeTruthy()
      await go('POST', `${A}/customers/lock`, { office: officeId, lock: '0' })

      const log = (await go('GET', `${A}/audit-log`)).body
      for (const text of ['Thêm khách hàng', 'Thêm quản trị', 'Tạo tài khoản', 'Cài máy chính', 'Khoá tài khoản', 'Nghỉ việc', 'Khoá văn phòng', 'Thử khoá', 'Mở khoá văn phòng', 'Đặt mật khẩu quản trị', 'Bật xác minh hai bước', 'Đăng nhập quản trị']) expect(log).toContain(text)
    } finally {
      config.adminEmail = saved
    }
  })
})
