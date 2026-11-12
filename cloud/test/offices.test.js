// Văn phòng: tạo bằng vé, mời / bỏ thành viên bằng chữ ký máy chính, nhận lời mời trên web, vé mang văn phòng.
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

let app, admin, machine, officeId
const pool = () => require('../src/db')

async function verifiedAccount(email, name) {
  const a = await accounts.register({ email, fullName: name, password: 'MatKhauDai123' })
  await pool().query('UPDATE account SET email_verified_at = NOW() WHERE id = $1', [a.id])
  return accounts.findById(a.id)
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
  admin = await verifiedAccount('quantri@thu.vn', 'Quản trị')
  machine = crypto.generateKeyPairSync('ed25519')
})
afterAll(() => app.close())

describe('văn phòng', () => {
  it('tạo văn phòng bằng vé; gọi lại cùng khoá không tạo văn phòng thứ hai', async () => {
    const { ticket } = await oauth.buildTicket(admin, Date.now())
    const body = { name: 'Công ty ABC', machine_public_key: machine.publicKey.export({ type: 'spki', format: 'pem' }) }
    const res = await app.inject({ method: 'POST', url: '/api/offices', headers: { authorization: `Bearer ${ticket}` }, payload: body })
    expect(res.statusCode).toBe(200)
    officeId = res.json().id
    const again = await app.inject({ method: 'POST', url: '/api/offices', headers: { authorization: `Bearer ${ticket}` }, payload: body })
    expect(again.json().id).toBe(officeId)
    const claims = tickets.verify((await oauth.buildTicket(admin, Date.now())).ticket)
    expect(claims).toMatchObject({ office: officeId, office_role: 'admin', office_name: 'Công ty ABC' })
    expect(claims.machine).toMatch(/^[0-9a-f]{32}$/)
  })

  it('mời cần chữ ký máy chính: sai khoá, lệch giờ bị từ chối', async () => {
    const other = crypto.generateKeyPairSync('ed25519')
    expect((await signed('POST', '/api/office/invites', { email: 'nv@thu.vn' }, other.privateKey)).statusCode).toBe(401)
    expect((await signed('POST', '/api/office/invites', { email: 'nv@thu.vn' }, machine.privateKey, Date.now() - 10 * 60 * 1000)).statusCode).toBe(401)
  })

  it('mời → thư mời → đăng ký từ liên kết (không cần xác minh) → vào văn phòng; bỏ thành viên thì vé mất văn phòng', async () => {
    const res = await signed('POST', '/api/office/invites', { email: 'nv@thu.vn', full_name: 'Nhân viên', role: 'member', invited_by_email: 'quantri@thu.vn' })
    expect(res.statusCode).toBe(200)
    const mail = mailer.sent.at(-1)
    expect(mail.subject).toContain('Công ty ABC')
    const inviteToken = /token=([\w-]+)/.exec(mail.text)[1]
    const jar = {}
    const go = async (method, url, form) => {
      const r = await app.inject({ method, url, headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, payload: form ? new URLSearchParams(form).toString() : undefined })
      for (const c of [].concat(r.headers['set-cookie'] || [])) { const [p] = c.split(';'); const [k, ...v] = p.split('='); jar[k] = v.join('=') }
      return r
    }
    expect((await go('GET', `/moi?token=${inviteToken}`)).headers.location).toBe('/dang-ky')
    expect((await go('GET', '/dang-ky')).body).toContain('Công ty ABC')
    const reg = await go('POST', '/dang-ky', { full_name: 'Nhân viên', email: 'nv@thu.vn', password: 'MatKhauDai456' })
    expect(reg.body).toContain('Đã nhận lời mời')
    const nv = await accounts.findByEmail('nv@thu.vn')
    expect(tickets.verify((await oauth.buildTicket(nv, Date.now())).ticket)).toMatchObject({ office: officeId, office_role: 'member' })
    // Liên kết mời đã dùng thì hết hiệu lực.
    expect((await go('GET', `/moi?token=${inviteToken}`)).statusCode).toBe(400)

    expect((await signed('POST', '/api/office/members/remove', { email: 'nv@thu.vn' })).json()).toEqual({ removed: true })
    expect(tickets.verify((await oauth.buildTicket(nv, Date.now())).ticket).office).toBeNull()
  })

  it('văn phòng bị khoá thì máy chính bị từ chối', async () => {
    await require('../src/services/offices').setLocked(officeId, true)
    expect((await signed('POST', '/api/office/invites', { email: 'x@thu.vn' })).statusCode).toBe(403)
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
  it('chỉ email trong CLOUD_ADMIN_EMAILS vào được; khoá văn phòng có hiệu lực', async () => {
    const config = require('../src/config')
    config.adminEmails.push('quantri@thu.vn')
    const jar = {}
    const go = async (method, url, form) => {
      const r = await app.inject({ method, url, headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, payload: form ? new URLSearchParams(form).toString() : undefined })
      for (const c of [].concat(r.headers['set-cookie'] || [])) { const [p] = c.split(';'); const [k, ...v] = p.split('='); jar[k] = v.join('=') }
      return r
    }
    expect((await go('GET', '/quan-tri')).headers.location).toBe('/dang-nhap')
    await go('POST', '/dang-nhap', { email: 'quantri@thu.vn', password: 'MatKhauDai123' })
    const page = await go('GET', '/quan-tri')
    expect(page.body).toContain('Công ty ABC')
    await go('POST', '/quan-tri/khoa', { office: officeId, lock: '1' })
    expect((await require('../src/services/offices').get(officeId)).locked_at).toBeTruthy()
    await go('POST', '/quan-tri/khoa', { office: officeId, lock: '0' })
    config.adminEmails.pop()
  })
})
