import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Pool giả thay config/db: ghi lại mọi câu SQL, trả hàng theo bảng `rules` (đoạn SQL khớp đầu tiên).
let rules = []
const calls = []
const fakePool = {
  query: async (sql, params = []) => {
    calls.push({ sql, params })
    const hit = rules.find(([needle]) => sql.includes(needle))
    return hit ? hit[1](sql, params) : [[]]
  },
  async getConnection() {
    return { query: fakePool.query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }
  },
}
const stub = (rel, exports) => {
  const id = require.resolve(rel)
  require.cache[id] = { id, filename: id, loaded: true, exports }
}
stub('../../../config/db', fakePool)
stub('../../../config', { upload: { dir: '/tmp', maxFileSize: 1000 }, jwt: {}, sendgrid: {} })

const Fastify = require('fastify')
const { can } = require('../../../plugins/access')
const { ALL_PERMISSIONS } = require('../../../constants/permissions')

let app
beforeAll(async () => {
  app = Fastify()
  app.setErrorHandler((error, request, reply) => reply.code(error.statusCode || 500).send({ error: error.message }))
  // authenticate giả: quyền đọc từ header x-access (JSON).
  app.decorate('authenticate', async (request) => {
    const a = JSON.parse(request.headers['x-access'])
    request.user = { id: a.userId }
    request.access = { userId: a.userId, isAdmin: Boolean(a.isAdmin), permissions: new Set(a.permissions), scopes: a.scopes || {} }
  })
  app.decorate('can', can)
  await app.register(require('../seafarer.routes'), { prefix: '/seafarers' })
  await app.register(require('../seafarer.routes').seafarerContactRoutes, { prefix: '/seafarers/:seafarerId/contacts' })
  await app.register(require('../certificate.routes'), { prefix: '/seafarers/:seafarerId/certificates' })
  await app.register(require('../document.routes'), { prefix: '/documents' })
  await app.register(require('../dashboard.routes'), { prefix: '/dashboard' })
  await app.register(require('../voyage.routes'), { prefix: '/voyages' })
  await app.register(require('../opportunity.routes'), { prefix: '/opportunities' })
  await app.register(require('../seafarer_contract.routes'), { prefix: '/contracts' })
  await app.register(require('../export_pack.routes').exportPackRoutes, { prefix: '/exports' })
  await app.register(require('../master_data.routes'), { prefix: '/admin/master' })
  await app.register(require('../fleet.routes'), { prefix: '/admin/master' })
  await app.register(require('../users'), { prefix: '/users' })
  await app.register(require('../role.routes'), { prefix: '/roles' })
  await app.ready()
})
beforeEach(() => {
  rules = []
  calls.length = 0
})

const as = (permissions, scopes = {}, extra = {}) => ({ 'x-access': JSON.stringify({ userId: 7, permissions, scopes, ...extra }) })
const get = (url, headers) => app.inject({ method: 'GET', url, headers })
const executed = (re) => calls.some((c) => re.test(c.sql))

describe('tìm kiếm thuyền viên', () => {
  it.each(['Linh', 'linh', 'Tien Linh', 'Le Tien Linh', 'Lê Tiến Linh'])('danh sách và số đếm tìm bất kỳ phần tên, bỏ dấu: %s', async (search) => {
    rules = [
      ['COUNT(*) AS all_count', () => [[{ all_count: 1 }]]],
      ['COUNT(*) as total', () => [[{ total: 1 }]]],
      ['FROM seafarer s', () => [[{ id: 1, full_name: 'Lê Tiến Linh' }]]],
    ]
    const res = await get(`/seafarers?search=${encodeURIComponent(search)}`, as(['seafarer.view']))
    expect(res.statusCode).toBe(200)
    const searches = calls.filter((c) => c.sql.includes('unaccent(s.full_name::text) ILIKE unaccent(?)'))
    expect(searches).toHaveLength(3)
    for (const call of searches) expect(call.params.slice(0, 4)).toEqual(Array(4).fill(`%${search}%`))
  })
})

describe('website đối tác', () => {
  it.each([
    ['POST', '/admin/master/ship-owners', 'partner.create'],
    ['PUT', '/admin/master/ship-owners/1', 'partner.update'],
  ])('%s %s chặn URL có cổng vượt giới hạn trước khi ghi dữ liệu', async (method, url, permission) => {
    const res = await app.inject({
      method, url, headers: as([permission]),
      payload: { company_name: 'Đối tác kiểm thử', website: 'https://example.com:99999' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('URL không hợp lệ')
    expect(executed(/INSERT INTO ship_owner|UPDATE ship_owner/)).toBe(false)
  })
})

describe('điện thoại công ty đối tác', () => {
  it.each([
    ['POST', '/admin/master/ship-owners', 'partner.create'],
    ['PUT', '/admin/master/ship-owners/1', 'partner.update'],
  ])('%s %s chặn điện thoại toàn số 0 trước khi ghi dữ liệu', async (method, url, permission) => {
    const res = await app.inject({
      method, url, headers: as([permission]),
      payload: { company_name: 'Đối tác kiểm thử', phone: '0000000000' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Số điện thoại công ty không hợp lệ')
    expect(executed(/INSERT INTO ship_owner|UPDATE ship_owner/)).toBe(false)
  })
})

describe('chiều dài toàn bộ của tàu', () => {
  it.each([
    ['POST', '/admin/master/vessels', 'vessel.create'],
    ['PUT', '/admin/master/vessels/1', 'vessel.update'],
  ])('%s %s chặn LOA bằng 0 trước khi ghi dữ liệu', async (method, url, permission) => {
    const res = await app.inject({
      method, url, headers: as([permission]),
      payload: { vessel_name: 'Tàu kiểm thử', status: 'ACTIVE', length_overall: 0 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('LOA phải là số dương')
    expect(executed(/INSERT INTO vessel|UPDATE vessel/)).toBe(false)
  })

  it.each([0.01, 120.5, 600, null])('cho sửa LOA hợp lệ hoặc để trống: %s', async (lengthOverall) => {
    rules = [['FROM vessel v', () => [[{ id: 1, vessel_name: 'Tàu kiểm thử', status: 'ACTIVE' }]]]]
    const res = await app.inject({
      method: 'PUT', url: '/admin/master/vessels/1', headers: as(['vessel.update']),
      payload: { length_overall: lengthOverall },
    })
    expect(res.statusCode).toBe(200)
    const update = calls.find((c) => c.sql.startsWith('UPDATE vessel'))
    expect(update.params).toEqual([lengthOverall, 1])
  })
})

describe('ngày cấp hộ chiếu thuyền viên', () => {
  it.each([
    ['POST', '/seafarers', 'seafarer.create'],
    ['PUT', '/seafarers/1', 'seafarer.update'],
  ])('%s %s chặn ngày cấp hộ chiếu trước ngày sinh', async (method, url, permission) => {
    const res = await app.inject({
      method, url, headers: as([permission]),
      payload: { full_name: 'Nguyễn An', date_of_birth: '2000-01-01', passport_issued_date: '1999-01-01', passport_expiry: '2029-01-01' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Ngày cấp hộ chiếu không được trước ngày sinh')
    expect(executed(/INSERT INTO seafarer|UPDATE seafarer/)).toBe(false)
  })

  it.each([
    { passport_issued_date: '1999-01-01' },
    { date_of_birth: '2002-01-01' },
  ])('sửa riêng một ngày vẫn kiểm tra với ngày đã lưu: %j', async (payload) => {
    rules = [['FROM seafarer WHERE', () => [[{ id: 1, date_of_birth: '2000-01-01', passport_issued_date: '2001-01-01' }]]]]
    const res = await app.inject({ method: 'PUT', url: '/seafarers/1', headers: as(['seafarer.update']), payload })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Ngày cấp hộ chiếu không được trước ngày sinh')
    expect(executed(/UPDATE seafarer|INSERT INTO seafarer_revision/)).toBe(false)
  })

  it.each([
    { passport_issued_date: '2000-01-01' },
    { passport_issued_date: '2003-01-01' },
    { date_of_birth: '1990-01-01' },
    { passport_issued_date: null },
  ])('cho phép sửa ngày hợp lệ hoặc xoá ngày: %j', async (payload) => {
    const row = { id: 1, full_name: 'Nguyễn An', date_of_birth: '2000-01-01', passport_issued_date: '2001-01-01' }
    rules = [['FROM seafarer WHERE', () => [[row]]], ['FROM seafarer s', () => [[row]]]]
    const res = await app.inject({ method: 'PUT', url: '/seafarers/1', headers: as(['seafarer.update']), payload })
    expect(res.statusCode).toBe(200)
    expect(executed(/UPDATE seafarer/)).toBe(true)
  })
})

describe('CCCD thuyền viên', () => {
  it.each([
    ['POST', '/seafarers', 'seafarer.create', '000000000000'],
    ['PUT', '/seafarers/1', 'seafarer.update', '000000000000'],
    ['POST', '/seafarers', 'seafarer.create', '000000000'],
    ['PUT', '/seafarers/1', 'seafarer.update', '000000000'],
  ])('%s chặn số CCCD/CMND toàn số 0 (%s)', async (method, url, permission, nationalId) => {
    const res = await app.inject({
      method, url, headers: as([permission]),
      payload: { full_name: 'Nguyễn An', national_id: nationalId },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Số CCCD không hợp lệ')
    expect(executed(/INSERT INTO seafarer|UPDATE seafarer/)).toBe(false)
  })
})

describe('mã số thuế đối tác', () => {
  it.each([
    ['POST', '/admin/master/ship-owners', 'partner.create'],
    ['PUT', '/admin/master/ship-owners/1', 'partner.update'],
  ])('%s chặn mã số thuế toàn số 0 trước khi ghi dữ liệu', async (method, url, permission) => {
    const res = await app.inject({
      method, url, headers: as([permission]),
      payload: { company_name: 'Đối tác kiểm thử', tax_id: '0000000000' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Mã số thuế không hợp lệ')
    expect(executed(/INSERT INTO ship_owner|UPDATE ship_owner/)).toBe(false)
  })
})

describe('MMSI tàu', () => {
  it.each([
    ['POST', '/admin/master/vessels', 'vessel.create'],
    ['PUT', '/admin/master/vessels/1', 'vessel.update'],
  ])('%s chặn MMSI toàn số 0 trước khi ghi dữ liệu', async (method, url, permission) => {
    const res = await app.inject({
      method, url, headers: as([permission]),
      payload: { vessel_name: 'Tàu kiểm thử', mmsi: '000000000' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('MMSI không hợp lệ')
    expect(executed(/INSERT INTO vessel|UPDATE vessel/)).toBe(false)
  })
})

describe('thiếu quyền thì 403', () => {
  const cases = [
    ['GET', '/seafarers', 'seafarer.view'],
    ['GET', '/seafarers/1', 'seafarer.view'],
    ['POST', '/seafarers', 'seafarer.create', { full_name: 'A' }],
    ['PUT', '/seafarers/1', 'seafarer.update', {}],
    ['DELETE', '/seafarers/1', 'seafarer.delete'],
    ['GET', '/seafarers/1/certificates', 'seafarer.view'],
    ['GET', '/documents/seafarer/1', 'seafarer.docs'],
    ['GET', '/dashboard/kpi', 'contract.view'],
    ['GET', '/opportunities', 'opportunity.view'],
    ['POST', '/opportunities/1/place', 'opportunity.close', { seafarer_id: 1, join_date: '2026-01-01', join_port_id: 1 }],
    ['GET', '/voyages', 'voyage.view'],
    ['POST', '/voyages/1/leave', 'voyage.run', { leave_date: '2026-01-01', leave_port_id: 1 }],
    ['DELETE', '/voyages/1', 'voyage.delete'],
    ['GET', '/contracts', 'contract.view'],
    ['POST', '/contracts/1/approve', 'contract.approve', {}],
    ['POST', '/contracts/1/submit', 'contract.submit', {}],
    ['GET', '/exports', 'export.view'],
    ['POST', '/exports/preview', 'export.view', { template_key: 'x' }],
    ['GET', '/exports/1/download', 'export.download'],
    ['GET', '/admin/master/certificate-types', 'catalog.view'],
    ['DELETE', '/admin/master/certificate-types/1', 'catalog.delete'],
    ['GET', '/admin/master/vessels', 'vessel.view'],
    ['DELETE', '/admin/master/ship-owners/1', 'partner.delete'],
    ['GET', '/users', 'account.view'],
    ['DELETE', '/users/9', 'account.delete'],
    ['GET', '/roles/options', 'account.view'],
    ['GET', '/roles', 'role.manage'],
    ['PUT', '/roles/permissions', 'role.manage', { roles: [] }],
  ]
  for (const [method, url, perm, payload] of cases) {
    it(`${method} ${url} cần ${perm}`, async () => {
      const others = ALL_PERMISSIONS.filter((p) => p !== perm)
      const res = await app.inject({ method, url, headers: as(others), payload })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body)).toEqual({ error: 'Không có quyền' })
    })
  }
  it('không vai trò (không quyền nào) thì 403 ở mọi mục', async () => {
    for (const url of ['/seafarers', '/voyages', '/contracts', '/exports', '/users']) {
      expect((await get(url, as([]))).statusCode).toBe(403)
    }
  })
})

describe('phạm vi own: danh sách', () => {
  const lists = [
    ['/seafarers', 'seafarer', 'seafarer.view', /FROM seafarer s/, 's.created_by = ?'],
    ['/opportunities', 'opportunity', 'opportunity.view', /FROM opportunity o/, 'o.created_by = ?'],
    ['/voyages', 'voyage', 'voyage.view', /FROM seafarer_voyage sv/, 'sv.created_by = ?'],
    ['/contracts', 'contract', 'contract.view', /FROM seafarer_contract c/, 'c.created_by = ?'],
    ['/exports', 'export', 'export.view', /FROM export_pack p/, 'p.created_by = ?'],
  ]
  for (const [url, module, perm, , needle] of lists) {
    it(`${url}: own lọc theo created_by = id tài khoản, all thì không`, async () => {
      await get(url, as([perm], { [module]: 'own' }))
      const own = calls.filter((c) => c.sql.includes(needle))
      expect(own.length).toBeGreaterThan(0)
      expect(own.every((c) => c.params.includes(7))).toBe(true)
      calls.length = 0
      await get(url, as([perm], {}))
      expect(calls.some((c) => c.sql.includes(needle))).toBe(false)
      calls.length = 0
      await get(url, as([perm], { [module]: 'own' }, { isAdmin: true }))
      expect(calls.some((c) => c.sql.includes(needle))).toBe(false)
    })
  }
})

describe('phạm vi own: mở theo id', () => {
  const details = [
    ['/opportunities/3', 'opportunity', 'opportunity.view', 'FROM "opportunity"', /FROM opportunity o/],
    ['/voyages/3', 'voyage', 'voyage.view', 'FROM "seafarer_voyage"', /FROM seafarer_voyage sv/],
    ['/contracts/3', 'contract', 'contract.view', 'FROM "seafarer_contract"', /FROM seafarer_contract c/],
    ['/exports/3', 'export', 'export.view', 'FROM "export_pack"', /FROM export_pack p/],
  ]
  for (const [url, module, perm, needle, serviceSql] of details) {
    it(`${url}: của người khác hoặc created_by rỗng → 404 và không chạm service`, async () => {
      rules = [[needle, () => [[{ created_by: 8 }]]]]
      expect((await get(url, as([perm], { [module]: 'own' }))).statusCode).toBe(404)
      rules = [[needle, () => [[{ created_by: null }]]]]
      expect((await get(url, as([perm], { [module]: 'own' }))).statusCode).toBe(404)
      expect(executed(serviceSql)).toBe(false)
    })
    it(`${url}: của chính mình, hoặc phạm vi all → vào được service`, async () => {
      rules = [[needle, () => [[{ created_by: 7 }]]]]
      await get(url, as([perm], { [module]: 'own' }))
      expect(executed(serviceSql)).toBe(true)
      calls.length = 0
      rules = [[needle, () => [[{ created_by: 8 }]]]]
      await get(url, as([perm], {}))
      expect(executed(serviceSql)).toBe(true)
    })
  }

  it('thuyền viên: của người khác → 404, của mình → qua', async () => {
    rules = [['FROM seafarer s', () => [[{ id: 5, created_by: 8 }]]]]
    expect((await get('/seafarers/5', as(['seafarer.view'], { seafarer: 'own' }))).statusCode).toBe(404)
    rules = [['FROM seafarer s', () => [[{ id: 5, created_by: 7 }]]], ['FROM seafarer_bank_account', () => [[]]]]
    expect((await get('/seafarers/5', as(['seafarer.view'], { seafarer: 'own' }))).statusCode).toBe(200)
    expect((await get('/seafarers/5', as(['seafarer.view'], {}))).statusCode).toBe(200)
  })

  it('thao tác ghi cũng bị chặn 404 khi ngoài phạm vi (xoá chuyến, duyệt hợp đồng)', async () => {
    rules = [['FROM "seafarer_voyage"', () => [[{ created_by: 8 }]]], ['FROM "seafarer_contract"', () => [[{ created_by: 8 }]]]]
    expect((await app.inject({ method: 'DELETE', url: '/voyages/3', headers: as(['voyage.delete'], { voyage: 'own' }) })).statusCode).toBe(404)
    const approve = await app.inject({ method: 'POST', url: '/contracts/3/approve', payload: {}, headers: as(['contract.approve'], { contract: 'own' }) })
    expect(approve.statusCode).toBe(404)
    expect(calls.some((c) => /^UPDATE/.test(c.sql))).toBe(false)
  })
})

describe('dữ liệu con theo phạm vi của thuyền viên cha', () => {
  const own = (extra = ['seafarer.view']) => as(extra, { seafarer: 'own' })
  beforeEach(() => {
    rules = [
      ['FROM "seafarer" WHERE', () => [[{ created_by: 8 }]]],
      ['FROM "document_upload"', () => [[{ seafarer_id: 5 }]]],
      ['FROM "seafarer_document"', () => [[{ seafarer_id: 5 }]]],
    ]
  })
  const hidden = [
    ['GET', '/seafarers/5/certificates', ['seafarer.view']],
    ['GET', '/seafarers/5/contacts', ['seafarer.view']],
    ['POST', '/seafarers/5/contacts', ['seafarer.update'], { full_name: 'A', relationship: 'B' }],
    ['GET', '/documents/seafarer/5', ['seafarer.view', 'seafarer.docs']],
    ['GET', '/documents/uploads/9/file', ['seafarer.view', 'seafarer.docs']],
    ['DELETE', '/documents/uploads/9', ['seafarer.view', 'seafarer.docs']],
    ['GET', '/documents/9', ['seafarer.view', 'seafarer.docs']],
    ['DELETE', '/documents/9', ['seafarer.view', 'seafarer.docs']],
    ['POST', '/documents/certificates/confirm', ['seafarer.view', 'seafarer.docs'], { ids: [9] }],
  ]
  for (const [method, url, perms, payload] of hidden) {
    it(`${method} ${url}: thuyền viên cha của người khác → 404`, async () => {
      const res = await app.inject({ method, url, payload, headers: own(perms) })
      expect(res.statusCode).toBe(404)
    })
  }
  it('cùng yêu cầu với phạm vi all không bị chặn bởi phạm vi', async () => {
    const res = await app.inject({ method: 'GET', url: '/seafarers/5/certificates', headers: as(['seafarer.view'], {}) })
    expect(res.statusCode).not.toBe(404)
  })
})

describe('/documents/status chỉ cần đăng nhập', () => {
  it('không quyền nào vẫn qua được kiểm quyền (không 401/403)', async () => {
    expect([401, 403]).not.toContain((await get('/documents/status', as([]))).statusCode)
  })
})

describe('/roles/options cho người quản lý tài khoản', () => {
  it('có account.view mà không có role.manage vẫn đọc được tên vai trò, không lộ quyền', async () => {
    rules = [['FROM "role" r', () => [[{ id: 1, code: 'admin', name: 'Quản trị viên', description: null, scopes: {}, user_count: 1 }]]]]
    const res = await get('/roles/options', as(['account.view']))
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data).toEqual([{ id: 1, name: 'Quản trị viên', description: null, is_system: true }])
  })
})

describe('hợp đồng gắn chuyến: quyền các thao tác mới', () => {
  it('POST /contracts cần contract.create; có quyền thì đi vào service (chuyến không có → 404, không còn khoá 409)', async () => {
    const payload = { seafarer_voyage_id: 1, start_date: '2026-11-01', end_date: '2027-05-01' }
    expect((await app.inject({ method: 'POST', url: '/contracts', headers: as(['contract.view']), payload })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/contracts', headers: as(['contract.create']), payload })).statusCode).toBe(404)
  })

  it('revert cần contract.update, end cần contract.end, bill-plan cần contract.view', async () => {
    const post = (action, permissions) => app.inject({ method: 'POST', url: `/contracts/9/${action}`, headers: as(permissions) })
    expect((await post('revert', ['contract.view'])).statusCode).toBe(403)
    expect((await post('revert', ['contract.update'])).statusCode).toBe(404)
    expect((await post('end', ['contract.view', 'contract.update'])).statusCode).toBe(403)
    expect((await post('end', ['contract.end'])).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: '/contracts/9/bill-plan', headers: as([]) })).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/contracts/9/bill-plan', headers: as(['contract.view']) })).statusCode).toBe(404)
  })
})
