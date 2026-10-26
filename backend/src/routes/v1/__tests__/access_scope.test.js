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
  const { seafarerSeaServiceRoutes, seaServiceRoutes } = require('../sea_service.routes')
  await app.register(seafarerSeaServiceRoutes, { prefix: '/seafarers/:seafarerId/sea-services' })
  await app.register(seaServiceRoutes, { prefix: '/sea-services' })
  await app.register(require('../document.routes'), { prefix: '/documents' })
  await app.register(require('../dashboard.routes'), { prefix: '/dashboard' })
  await app.register(require('../voyage.routes'), { prefix: '/voyages' })
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

describe('thiếu quyền thì 403', () => {
  const cases = [
    ['GET', '/seafarers', 'seafarer.view'],
    ['GET', '/seafarers/1', 'seafarer.view'],
    ['POST', '/seafarers', 'seafarer.create', { full_name: 'A' }],
    ['PUT', '/seafarers/1', 'seafarer.update', {}],
    ['DELETE', '/seafarers/1', 'seafarer.delete'],
    ['GET', '/seafarers/1/certificates', 'seafarer.view'],
    ['POST', '/seafarers/1/sea-services', 'seafarer.sea', {}],
    ['GET', '/documents/seafarer/1', 'seafarer.docs'],
    ['GET', '/dashboard/certificate-alerts', 'seafarer.view'],
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
      ['FROM "sea_service"', () => [[{ seafarer_id: 5 }]]],
    ]
  })
  const hidden = [
    ['GET', '/seafarers/5/certificates', ['seafarer.view']],
    ['GET', '/seafarers/5/contacts', ['seafarer.view']],
    ['POST', '/seafarers/5/contacts', ['seafarer.update'], { full_name: 'A', relationship: 'B' }],
    ['GET', '/seafarers/5/sea-services', ['seafarer.view']],
    ['POST', '/seafarers/5/sea-services', ['seafarer.sea'], {}],
    ['PUT', '/sea-services/9', ['seafarer.sea'], { reason: 'x' }],
    ['DELETE', '/sea-services/9', ['seafarer.sea'], { reason: 'x' }],
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
    const res = await app.inject({ method: 'GET', url: '/seafarers/5/sea-services', headers: as(['seafarer.view'], {}) })
    expect(res.statusCode).toBe(200)
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
