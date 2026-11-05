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
    request.access = { userId: a.userId, isAdmin: false, permissions: new Set(a.permissions), scopes: a.scopes || {} }
  })
  app.decorate('can', can)
  await app.register(require('../dashboard.routes'), { prefix: '/dashboard' })
  await app.ready()
})

// Hôm nay 04/11/2026. Mỗi tab một bộ dữ liệu giả nhỏ.
const baseRules = () => [
  ['SELECT TO_CHAR(CURRENT_DATE', () => [[{ today: '2026-11-04' }]]],
  ['FROM opportunity o', () => [[
    { id: 1, code: 'CH26001', status: 'OPEN', rank_name: 'Đại phó', deadline: '2026-11-01', today: '2026-11-04', candidates_count: 0, sent_count: 0 },
    { id: 2, code: 'CH26002', status: 'OPEN', rank_name: 'Bếp', deadline: '2026-11-06', today: '2026-11-04', candidates_count: 0, sent_count: 0 },
  ]]],
  ['FROM seafarer_certificate sc', () => [[
    { id: 5, seafarer_name: 'Phan Đức Long', expiry_date: '2026-10-29', days_left: -6, voyage_id: 9, vessel_name: 'MV Ocean Glory', upcoming: false },
    { id: 6, seafarer_name: 'Lê Văn Đức', expiry_date: '2026-11-20', days_left: 16, voyage_id: null },
  ]]],
  ['FROM seafarer_voyage sv', () => [[
    { voyage_id: 3, seafarer_name: 'Nguyễn Văn An', join_date: '2026-06-01', planned_leave_date: '2026-10-28' },
    { voyage_id: 4, seafarer_name: 'Bùi Văn Thắng', join_date: '2026-11-10', planned_leave_date: '2027-05-10' },
  ]]],
  ['FROM seafarer_contract c', () => [[{ rejected: 1, pending: 2, draft: 3 }]]],
  ['FROM contract_bill b', () => [[{ overdue: 2, overdue_usd: '18400.00', to_approve: 2, to_send: 0 }]]],
]
beforeEach(() => {
  rules = baseRules()
  calls.length = 0
})

const ALL = ['opportunity.view', 'seafarer.view', 'voyage.view', 'contract.view', 'bill.view']
const get = (permissions, scopes = {}) => app.inject({ method: 'GET', url: '/dashboard/attention', headers: { 'x-access': JSON.stringify({ userId: 7, permissions, scopes }) } })

describe('GET /dashboard/attention', () => {
  it('không có quyền xem nào thì 403', async () => {
    expect((await get(['kpi.manage'])).statusCode).toBe(403)
  })

  it('quản lý: đủ 4 tab, quá hạn trước, đếm đúng', async () => {
    const t = (await get([...ALL, 'kpi.view_all'])).json().data.tabs
    expect(Object.keys(t).sort()).toEqual(['certificates', 'opportunities', 'schedule', 'work'])
    expect(t.opportunities).toMatchObject({ count: 2, late: 1 })
    expect(t.opportunities.rows.map((r) => [r.code, r.late, r.days])).toEqual([['CH26001', true, 3], ['CH26002', false, 2]])
    expect(t.certificates.rows[0]).toMatchObject({ late: true, days: 6, trip: { where: 'ONBOARD', vessel_name: 'MV Ocean Glory' } })
    expect(t.certificates.rows[1].trip).toBeNull()
    expect(t.schedule.rows.map((r) => [r.kind, r.late, r.days])).toEqual([['LEAVE', true, 7], ['JOIN', false, 6]])
    expect(t.work.rows.map((r) => r.key)).toEqual(['BILL_OVERDUE', 'CONTRACT_REJECTED', 'CONTRACT_PENDING', 'BILL_TO_APPROVE'])
    expect(t.work.rows[0].amount_usd).toBe(18400)
  })

  it('thiếu opportunity.view, bill.view: không có tab cơ hội, không có dòng YCTT', async () => {
    const t = (await get(['seafarer.view', 'contract.view', 'kpi.view_all'])).json().data.tabs
    expect(t.opportunities).toBeUndefined()
    expect(t.schedule).toBeUndefined()
    expect(t.work.rows.some((r) => r.key.startsWith('BILL'))).toBe(false)
  })

  it('môi giới (không kpi.view_all): lọc của mình; có Nháp chưa xin duyệt, không có YCTT cần duyệt', async () => {
    const t = (await get(ALL)).json().data.tabs
    const opp = calls.find((c) => c.sql.includes('FROM opportunity o'))
    expect(opp.sql).toMatch(/o\.owner_user_id = \?/)
    expect(opp.params).toEqual([7])
    expect(calls.find((c) => c.sql.includes('FROM seafarer_certificate sc')).params).toEqual([7])
    expect(t.work.rows.map((r) => r.key)).toEqual(['BILL_OVERDUE', 'CONTRACT_REJECTED', 'CONTRACT_PENDING', 'CONTRACT_DRAFT'])
  })

  it('phạm vi own lọc theo người tạo', async () => {
    await get([...ALL, 'kpi.view_all'], { opportunity: 'own', voyage: 'own' })
    expect(calls.find((c) => c.sql.includes('FROM opportunity o')).sql).toMatch(/o\.created_by = \?/)
    expect(calls.find((c) => c.sql.includes('FROM seafarer_voyage sv')).params).toEqual([7])
  })

  it('một tab lỗi thì tab đó { error: true }, tab khác vẫn có', async () => {
    rules.unshift(['FROM seafarer_certificate sc', () => { throw new Error('mất kết nối') }])
    const t = (await get([...ALL, 'kpi.view_all'])).json().data.tabs
    expect(t.certificates).toEqual({ error: true })
    expect(t.opportunities.count).toBe(2)
  })
})
