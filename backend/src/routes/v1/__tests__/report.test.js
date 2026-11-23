import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Pool giả như kpi.test.js: trả hàng theo đoạn SQL khớp đầu tiên, ghi lại mọi câu.
let rules = []
const calls = []
const fakePool = {
  query: async (sql, params = []) => {
    calls.push({ sql, params })
    const hit = rules.find(([needle]) => sql.includes(needle))
    return hit ? hit[1](sql, params) : [[]]
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
    request.access = { userId: a.userId, isAdmin: false, permissions: new Set(a.permissions), scopes: a.scopes || {} }
  })
  app.decorate('can', can)
  await app.register(require('../report.routes'), { prefix: '/reports' })
  await app.ready()
})

const billRow = {
  id: 101, code: 'CH-1/HĐ/T1', seq: 1, status: 'SENT', contract_id: 1, period_start: '2026-10-01', period_end: '2026-10-31', due_date: '2026-11-10',
  display_status: 'SENT', total_usd: '3200', periods: '6', contract_number: 'CH-1/HĐ', seafarer_id: 16, seafarer_name: 'Đỗ Thành Long',
  rank_name: 'Thợ cả', vessel_id: 3, vessel_name: 'MV Blue Star', ship_owner_id: 3, ship_owner_name: 'Biển Xanh Co.', payout_id: null,
}
beforeEach(() => {
  calls.length = 0
  rules = [
    ['LEFT JOIN seafarer_payout sp', () => [[billRow]]],
    ['FROM contract_bill_item WHERE bill_id IN', () => [[{ bill_id: 101, item_code: 'BASIC_WAGE', amount_usd: '3200' }]]],
    ['FROM "user" WHERE id', () => [[{ name: 'Kế toán' }]]],
  ]
})

const as = (permissions, scopes) => ({ 'x-access': JSON.stringify({ userId: 7, permissions, scopes }) })
const get = (url, permissions, scopes) => app.inject({ method: 'GET', url, headers: as(permissions, scopes) })

describe('report routes', () => {
  it('xem báo cáo cần report.view', async () => {
    expect((await get('/reports/sales?month=2026-10', [])).statusCode).toBe(403)
    const res = await get('/reports/sales?month=2026-10', ['report.view'])
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ key: 'sales', title: 'Phải thu theo đối tác', rows: [{ ship_owner_name: 'Biển Xanh Co.', total: 3200, share: 100 }] })
  })

  it('báo cáo lạ: 404; tháng sai: 200 rỗng', async () => {
    expect((await get('/reports/abc?month=2026-10', ['report.view'])).statusCode).toBe(404)
    const bad = await get('/reports/sales?month=2026-13', ['report.view'])
    expect(bad.statusCode).toBe(200)
    expect(bad.json().rows).toEqual([])
    const none = await get('/reports/cashflow', ['report.view'])
    expect(none.statusCode).toBe(200)
    expect(none.json().rows).toEqual([])
  })

  it('xuất Excel cần thêm report.export; trả file đúng tên', async () => {
    expect((await get('/reports/sales/export?month=2026-10', ['report.view'])).statusCode).toBe(403)
    const res = await get('/reports/sales/export?month=2026-10', ['report.view', 'report.export'])
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''MCAH_Bao-cao_sales_2026-10.xlsx")
    const all = await get('/reports/all/export?month=2026-10', ['report.view', 'report.export'])
    expect(all.headers['content-disposition']).toContain('MCAH_Bao-cao_2026-10.xlsx')
    expect((await get('/reports/abc/export?month=2026-10', ['report.view', 'report.export'])).statusCode).toBe(404)
  })

  it('phạm vi chỉ của mình: lọc theo người tạo bill', async () => {
    await get('/reports/sales?month=2026-10', ['report.view'], { report: 'own' })
    const main = calls.find((c) => c.sql.includes('LEFT JOIN seafarer_payout sp'))
    expect(main.sql).toContain('b.created_by = ?')
    expect(main.params).toContain(7)
  })
})
