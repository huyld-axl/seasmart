import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Pool giả như access_scope.test.js: trả hàng theo đoạn SQL khớp đầu tiên, ghi lại mọi câu.
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

let app
beforeAll(async () => {
  app = Fastify()
  app.setErrorHandler((error, request, reply) => reply.code(error.statusCode || 500).send({ error: error.message }))
  app.decorate('authenticate', async (request) => {
    const a = JSON.parse(request.headers['x-access'])
    request.user = { id: a.userId }
    request.access = { userId: a.userId, isAdmin: false, permissions: new Set(a.permissions), scopes: {} }
  })
  app.decorate('can', can)
  await app.register(require('../dashboard.routes'), { prefix: '/dashboard' })
  await app.register(require('../kpi_target.routes'), { prefix: '/kpi-targets' })
  await app.ready()
})

// Hôm nay 04/11/2026. Một hợp đồng 1.000 USD/tháng từ 16/11 tính cho người 7; người 8 có mục tiêu.
const baseRules = (targets = []) => [
  ['CURRENT_DATE', () => [[{ today: '2026-11-04' }]]],
  ["status IN ('ACTIVE', 'ENDED')", () => [[{ id: 1, start_date: '2026-11-16', end_date: '2027-05-15', credited_to: 7 }]]],
  ['FROM contract_item', () => [[{ contract_id: 1, kind: 'MONTHLY', receivable_usd: '1000.00', payable_usd: null }]]],
  ['contract_approval_log', () => [[{ month: '2026-10', credited_to: 7, n: 2 }, { month: '2026-11', credited_to: 7, n: 1 }]]],
  ['FROM kpi_target WHERE month', () => [targets]],
  ["status IN ('PENDING', 'DRAFT')", () => [[{ pending: 1, draft: 1 }]]],
  ['opportunity_candidate', () => [[{ owner_selected: 1 }]]],
  ['FROM "user" WHERE id IN', (sql, params) => [params[0].map((id) => ({ id, name: id === 7 ? 'Nguyễn Thị Lan' : 'Đỗ Minh Quân' }))]],
]
beforeEach(() => {
  rules = baseRules()
  calls.length = 0
})

const as = (permissions, userId = 7) => ({ 'x-access': JSON.stringify({ userId, permissions }) })
const req = (method, url, permissions, payload) => app.inject({ method, url, headers: as(permissions), payload })

describe('quyền', () => {
  it.each([
    ['GET', '/dashboard/kpi', 'contract.view'],
    ['GET', '/kpi-targets?month=2026-11', 'kpi.manage'],
    ['PUT', '/kpi-targets', 'kpi.manage', { month: '2026-11', rows: [] }],
    ['POST', '/kpi-targets/copy', 'kpi.manage', { from: '2026-10', to: '2026-11' }],
  ])('%s %s cần %s', async (method, url, perm, body) => {
    expect((await req(method, url, ['seafarer.view'], body)).statusCode).toBe(403)
    expect((await req(method, url, [perm], body)).statusCode).toBe(200)
  })
})

describe('GET /dashboard/kpi', () => {
  it('không có kpi.view_all: số của mình, có phần sắp vào, không có danh sách người', async () => {
    const res = await req('GET', '/dashboard/kpi', ['contract.view'])
    const d = res.json().data
    expect(d.view).toBe('own')
    expect(d.people).toBeUndefined()
    expect(d.contracts.pending).toEqual({ pending: 1, draft: 1, owner_selected: 1 })
    // Mọi truy vấn số liệu đều lọc theo người được tính = 7.
    const filtered = calls.filter((c) => /contract_approval_log|status IN \('ACTIVE', 'ENDED'\)/.test(c.sql))
    expect(filtered.every((c) => c.params.includes(7))).toBe(true)
  })

  it('doanh thu, hợp đồng ký lần đầu, tiến độ; chưa đặt mục tiêu thì null', async () => {
    const d = (await req('GET', '/dashboard/kpi', ['contract.view'])).json().data
    expect(d).toMatchObject({ month: '2026-11', day: 4, days_in_month: 30 })
    expect(d.revenue.months.map((m) => m.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(d.revenue.months[5]).toEqual({ month: '2026-11', value: 500, projected: true })
    expect(d.revenue.to_date).toBe(0)
    expect(d.contracts.months[4].value).toBe(2)
    expect(d.contracts.done).toBe(1)
    expect(d.revenue.target).toBeNull()
    expect(d.contracts).toMatchObject({ target: null, pace: null, label: null })
  })

  it('có kpi.view_all: số cả công ty, danh sách người xếp theo tên, người chậm có nhãn BEHIND', async () => {
    rules = baseRules([{ user_id: 7, contracts: 3, revenue_usd: '7500.00' }, { user_id: 8, contracts: 2, revenue_usd: null }])
    const d = (await req('GET', '/dashboard/kpi', ['contract.view', 'kpi.view_all'])).json().data
    expect(d.view).toBe('company')
    expect(d.contracts).toMatchObject({ done: 1, target: 5, pace: 0.67, label: 'ON_TRACK' })
    expect(d.revenue).toMatchObject({ target: 7500, label: { kind: 'SHORT', short: 7000 } })
    expect(d.people.map((p) => [p.name, p.done, p.target, p.label])).toEqual([
      ['Đỗ Minh Quân', 0, 2, 'BEHIND'],
      ['Nguyễn Thị Lan', 1, 3, 'ON_TRACK'],
    ])
    expect(d.people[1].revenue).toBe(500)
  })

  it('tháng sai định dạng thì 400', async () => {
    expect((await req('GET', '/dashboard/kpi?month=2026-13', ['contract.view'])).statusCode).toBe(400)
  })
})

describe('mục tiêu tháng', () => {
  it('lưu: ngày 1 của tháng, một tài khoản hai lần thì 400', async () => {
    rules.unshift(['SELECT id FROM "user"', () => [[{ id: 7 }]]])
    const ok = await req('PUT', '/kpi-targets', ['kpi.manage'], { month: '2026-11', rows: [{ user_id: 7, contracts: 3, revenue_usd: 7500 }] })
    expect(ok.statusCode).toBe(200)
    const insert = calls.find((c) => c.sql.includes('INSERT INTO kpi_target'))
    expect(insert.params.slice(0, 4)).toEqual([7, '2026-11-01', 3, 7500])
    const dup = await req('PUT', '/kpi-targets', ['kpi.manage'], { month: '2026-11', rows: [{ user_id: 7 }, { user_id: 7 }] })
    expect(dup.statusCode).toBe(400)
  })

  it('số âm, USD 3 số lẻ, tài khoản không có thì báo lỗi', async () => {
    expect((await req('PUT', '/kpi-targets', ['kpi.manage'], { month: '2026-11', rows: [{ user_id: 7, contracts: -1 }] })).statusCode).toBe(400)
    expect((await req('PUT', '/kpi-targets', ['kpi.manage'], { month: '2026-11', rows: [{ user_id: 7, revenue_usd: 10.005 }] })).statusCode).toBe(400)
    rules.unshift(['SELECT id FROM "user"', () => [[]]])
    expect((await req('PUT', '/kpi-targets', ['kpi.manage'], { month: '2026-11', rows: [{ user_id: 99, contracts: 1 }] })).statusCode).toBe(404)
  })

  it('chép tháng trước chỉ điền ô trống (COALESCE giữ ô đã có)', async () => {
    const res = await req('POST', '/kpi-targets/copy', ['kpi.manage'], { from: '2026-10', to: '2026-11' })
    expect(res.statusCode).toBe(200)
    const copy = calls.find((c) => c.sql.includes('INSERT INTO kpi_target'))
    expect(copy.sql).toMatch(/contracts = COALESCE\(kpi_target\.contracts, EXCLUDED\.contracts\)/)
    expect(copy.params).toEqual(['2026-11-01', 7, 7, '2026-10-01'])
    expect((await req('POST', '/kpi-targets/copy', ['kpi.manage'], { from: '2026-11', to: '2026-11' })).statusCode).toBe(400)
  })
})
