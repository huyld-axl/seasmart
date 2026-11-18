// Trang chi tiết văn phòng trong khu quản trị: bấm tên văn phòng ở danh sách Khách hàng → thông tin, tài khoản (cả người đã rời),
// máy chính, lượng dùng, nhật ký; khoá / thêm quản trị từ trang này thì quay về trang này.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { resetDb } = require('./helpers')
const { build } = require('../server')
const config = require('../src/config')
const adminAuth = require('../src/services/admin_auth')
const totp = require('../src/services/totp')
const offices = require('../src/services/offices')
const accounts = require('../src/services/accounts')

const EMAIL = 'noibo@axalize.vn'
const PASSWORD = 'mat-khau-noi-bo-dai'
const I = '/internal'
const A = `${I}/admin`
let app, b, savedEmail, office, other
const pool = () => require('../src/db')

// Trình duyệt giả giữ cookie (như test/internal_login.test.js).
function browser() {
  const jar = {}
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
    get: async (url) => remember(await app.inject({ method: 'GET', url, remoteAddress: '10.2.0.1', headers: headers() })),
    post: async (url, form) => remember(await app.inject({ method: 'POST', url, remoteAddress: '10.2.0.1', headers: headers({ 'content-type': 'application/x-www-form-urlencoded' }), payload: new URLSearchParams(form).toString() })),
  }
}

beforeAll(async () => {
  await resetDb()
  savedEmail = config.adminEmail
  config.adminEmail = EMAIL
  app = build({ logger: false })
  await app.ready()
  await adminAuth.setPassword(PASSWORD)
  b = browser()
  await b.post(`${I}/login`, { email: EMAIL, password: PASSWORD })
  const me = (await adminAuth.current()).account
  await b.post(`${I}/login/setup`, { code: totp.codeAt(await adminAuth.pendingSecret(me.id), totp.stepAt()) })

  ;({ office } = await offices.createCustomer({ name: 'Công ty <ABC>', note: 'HĐ 7', adminEmail: 'quantri@abc.vn', adminName: 'Quản Trị', createdBy: me.id }))
  await offices.addMember({ officeId: office.id, email: 'nv1@abc.vn', fullName: 'Nhân Viên Một', role: 'member', createdBy: me.id, action: 'member_create' })
  await offices.addMember({ officeId: office.id, email: 'nv2@abc.vn', fullName: 'Nhân Viên Hai', role: 'member', createdBy: me.id, action: 'member_create' })
  await offices.removeMember({ officeId: office.id, email: 'nv2@abc.vn' })
  await pool().query("INSERT INTO office_machine (office_id, public_key, lan_name, lan_port) VALUES ($1, 'k', 'MAY-CHINH', 7443)", [office.id])
  await pool().query("INSERT INTO usage (office_id, kind, units, cost_usd) VALUES ($1, 'ai_page', 12, 0.5), ($1, 'vessel_lookup', 1, 0)", [office.id])
  ;({ office: other } = await offices.createCustomer({ name: 'Văn phòng khác', adminEmail: 'khac@xyz.vn', adminName: 'Khác', createdBy: me.id }))
})
afterAll(async () => {
  config.adminEmail = savedEmail
  await app.close()
})

describe('chi tiết văn phòng', () => {
  it('danh sách khách hàng và tài khoản có link sang trang chi tiết', async () => {
    const url = `${A}/customers/view?office=${office.id}`
    expect((await b.get(A)).body).toContain(`href="${url}"`)
    expect((await b.get(`${A}/accounts`)).body).toContain(`href="${url}"`)
  })

  it('hiện thông tin, mọi tài khoản (cả người đã rời), máy chính, lượng dùng, nhật ký; chỉ của văn phòng đó', async () => {
    const res = await b.get(`${A}/customers/view?office=${office.id}`)
    expect(res.statusCode).toBe(200)
    const html = res.body
    expect(html).toContain('Công ty &#60;ABC&#62;')
    expect(html).not.toContain('Công ty <ABC>')
    expect(html).toContain('HĐ 7')
    for (const email of ['quantri@abc.vn', 'nv1@abc.vn', 'nv2@abc.vn']) expect(html).toContain(email)
    expect(html).toContain('Đã rời')
    expect(html).toContain('2 (1 quản trị)')
    expect(html).toContain('MAY-CHINH:7443')
    // Tháng theo giờ Việt Nam (không lệch sang tháng trước do múi giờ).
    const [, m, y] = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' }).split('/')
    expect(html).toContain(`<tr><td>${m}/${y}</td><td>12</td><td>1</td><td>0</td><td>0.50 USD</td></tr>`)
    expect(html).toContain('Thêm khách hàng')
    expect(html).toContain('Bỏ tài khoản khỏi văn phòng')
    expect(html).not.toContain('khac@xyz.vn')
  })

  it('văn phòng không có / mã sai → về danh sách; chưa đăng nhập → trang đăng nhập', async () => {
    expect((await b.get(`${A}/customers/view?office=00000000-0000-0000-0000-000000000000`)).headers.location).toBe(A)
    expect((await b.get(`${A}/customers/view?office=abc`)).headers.location).toBe(A)
    expect((await browser().get(`${A}/customers/view?office=${office.id}`)).headers.location).toContain(`${I}/login?next=`)
  })

  it('khoá văn phòng / khoá tài khoản / thêm quản trị đi từ trang chi tiết thì quay về trang đó', async () => {
    const back = `${A}/customers/view?office=${office.id}`
    expect((await b.get(`${A}/customers/lock?office=${office.id}&back=${office.id}`)).body).toContain(`href="${back}">Huỷ`)
    const lock = await b.post(`${A}/customers/lock`, { office: office.id, lock: '1', reason: 'Chưa thanh toán', back: office.id })
    expect(lock.headers.location).toBe(back)
    expect((await b.get(back)).body).toContain('Chưa thanh toán')
    const nv1 = await accounts.findByEmail('nv1@abc.vn')
    expect((await b.post(`${A}/accounts/lock`, { account: nv1.id, lock: '1', reason: 'Nghỉ việc', back: office.id })).headers.location).toBe(back)
    expect((await b.post(`${A}/customers/admins`, { office: office.id, email: 'qt2@abc.vn', full_name: 'Quản Trị Hai', back: office.id })).headers.location).toBe(back)
    // Không có back: như cũ.
    expect((await b.post(`${A}/customers/lock`, { office: other.id, lock: '1', reason: 'Thử' })).headers.location).toBe(A)
    expect((await b.post(`${A}/accounts/lock`, { account: nv1.id, lock: '0' })).headers.location).toBe(`${A}/accounts`)
  })
})

describe('báo lỗi từ app', () => {
  it('danh sách và tải về chỉ cho admin đã đăng nhập; tệp tải về có thông tin máy và log', async () => {
    const zlib = require('zlib')
    const bundle = zlib.gzipSync(JSON.stringify({ meta: { errorCode: 'DB_MIGRATE' }, files: { 'main.log': 'Khởi động lỗi <x>' } }))
    const { rows } = await pool().query("INSERT INTO bug_report (error_code, app_version, platform, note, meta, bundle) VALUES ('DB_MIGRATE', '0.9.5', 'win32', 'ghi <chú>', '{}', $1) RETURNING id", [bundle])
    const list = await b.get(`${A}/bug-reports`)
    expect(list.body).toContain('DB_MIGRATE')
    expect(list.body).toContain('ghi &#60;chú&#62;')
    const file = await b.get(`${A}/bug-reports/download?id=${rows[0].id}`)
    expect(file.headers['content-disposition']).toContain(`mcah-bao-loi-${rows[0].id}.txt`)
    expect(file.body).toContain('===== main.log =====\nKhởi động lỗi <x>')
    expect((await b.get(`${A}/bug-reports/download?id=abc`)).statusCode).toBe(404)
    expect((await browser().get(`${A}/bug-reports`)).headers.location).toContain(`${I}/login?next=`)
  })
})
