import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { voyageService } = require('../voyage.service')

// Pool giả: trả về hàng theo đoạn SQL khớp đầu tiên, ghi lại mọi câu đã chạy; có getConnection cho transaction.
function fakePool(routes) {
  const calls = []
  const run = async (sql, params = []) => {
    calls.push({ sql, params })
    const hit = routes.find(([needle]) => sql.includes(needle))
    return hit ? hit[1](sql, params) : [[]]
  }
  return {
    calls,
    query: run,
    async getConnection() {
      return { query: run, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }
    },
  }
}
const writes = (pool) => pool.calls.filter((c) => /^(INSERT|UPDATE)/.test(c.sql))

const detailRow = (over = {}) => ({
  id: 1, code: 'CT-2026-001', vessel_id: 1, vessel_name: 'MV A', ship_owner_id: 1, ship_owner_name: 'Owner',
  planned_embark_date: '2026-11-05', planned_disembark_date: '2027-08-05', actual_embark_date: null, actual_disembark_date: null,
  status: 'PLANNING', today: '2026-10-19', positions_total: '2', positions_filled: '1', budget_monthly_sum: '3800.00', diff_monthly_sum: null,
  ...over,
})
const detailRoutes = (row = detailRow()) => [
  ['FROM voyage v', () => [[row]]],
  ['FROM voyage_position p\n  JOIN "rank"', () => [[]]],
]
const body = (over = {}) => ({
  vessel_id: 1, ship_owner_id: 1, planned_embark_date: '2026-11-05', planned_disembark_date: '2027-08-05',
  positions: [{ rank_id: 2, budget_total_usd: 17100, budget_monthly_usd: 1900 }, { rank_id: 3, budget_total_usd: 9000, budget_monthly_usd: 1000 }],
  ...over,
})

describe('voyage.service', () => {
  it('tạo chuyến cấp mã CT-năm-số và ghi từng vị trí theo thứ tự', async () => {
    const year = new Date().getUTCFullYear()
    const pool = fakePool([
      ['INSERT INTO "code_counter"', () => [{ rows: [{ last_value: 18 }] }]],
      ['INSERT INTO voyage SET', () => [{ insertId: 7, rows: [{ id: 7 }] }]],
      ...detailRoutes(),
    ])
    const result = await voyageService.create(pool, body(), 5)
    const voyageInsert = pool.calls.find((c) => c.sql.startsWith('INSERT INTO voyage SET'))
    expect(voyageInsert.params[0]).toMatchObject({ code: `CT-${year}-018`, created_by: 5, vessel_id: 1 })
    const positions = pool.calls.filter((c) => c.sql.startsWith('INSERT INTO voyage_position'))
    expect(positions).toHaveLength(2)
    expect(result.months).toBe(9)
  })

  it('tạo chuyến không có vị trí hoặc ngày ngược thì 400, không ghi gì', async () => {
    const pool = fakePool([])
    await expect(voyageService.create(pool, body({ positions: [] }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(voyageService.create(pool, body({ planned_disembark_date: '2026-10-01' }))).rejects.toMatchObject({ statusCode: 400 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('sửa chuyến bỏ vị trí đã có hợp đồng thì 409', async () => {
    const pool = fakePool([
      ['FOR UPDATE', () => [[{ id: 1, status: 'PLANNING' }]]],
      ['SELECT p.id, r.name_vi', () => [[{ id: 10, rank_name: 'Thuyền trưởng', has_contract: true }, { id: 11, rank_name: 'AB', has_contract: false }]]],
    ])
    await expect(voyageService.update(pool, 1, body({ positions: [{ id: 11, rank_id: 3, budget_total_usd: 1, budget_monthly_usd: 1 }] }))).rejects.toMatchObject({
      statusCode: 409,
      message: 'Vị trí Thuyền trưởng đã có hợp đồng, không xoá được',
    })
  })

  it('sửa chuyến đang chuẩn bị mà gửi ngày thực tế thì 400', async () => {
    const pool = fakePool([['FOR UPDATE', () => [[{ id: 1, status: 'PLANNING' }]]]])
    await expect(voyageService.update(pool, 1, body({ actual_embark_date: '2026-11-06' }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('sửa chuyến xoá mềm vị trí bị bỏ, cập nhật vị trí cũ, thêm vị trí mới', async () => {
    const pool = fakePool([
      ['FOR UPDATE', () => [[{ id: 1, status: 'PLANNING' }]]],
      ['SELECT p.id, r.name_vi', () => [[{ id: 10, rank_name: 'A', has_contract: false }, { id: 11, rank_name: 'B', has_contract: false }]]],
      ...detailRoutes(),
    ])
    await voyageService.update(pool, 1, body({ positions: [{ id: 10, rank_id: 2, budget_total_usd: 1, budget_monthly_usd: 1 }, { rank_id: 4, budget_total_usd: 2, budget_monthly_usd: 2 }] }), 5)
    const sqls = writes(pool).map((c) => c.sql)
    expect(sqls.some((s) => s.startsWith('UPDATE voyage_position SET deleted_at'))).toBe(true)
    expect(sqls.filter((s) => s.startsWith('UPDATE voyage_position SET ?'))).toHaveLength(1)
    expect(sqls.filter((s) => s.startsWith('INSERT INTO voyage_position'))).toHaveLength(1)
  })

  it('xoá chuyến có hợp đồng thì 409, không có thì xoá mềm', async () => {
    const withContract = fakePool([['FOR UPDATE', () => [[{ status: 'PLANNING' }]]], ['FROM seafarer_contract c JOIN', () => [[{ n: '1' }]]]])
    await expect(voyageService.softDelete(withContract, 1)).rejects.toMatchObject({ statusCode: 409 })
    const clean = fakePool([['FOR UPDATE', () => [[{ status: 'PLANNING' }]]], ['FROM seafarer_contract c JOIN', () => [[{ n: '0' }]]]])
    await expect(voyageService.softDelete(clean, 1)).resolves.toEqual({ success: true })
    const onboard = fakePool([['FOR UPDATE', () => [[{ status: 'ONBOARD' }]]]])
    await expect(voyageService.softDelete(onboard, 1)).rejects.toMatchObject({ statusCode: 409 })
  })

  const crew = [
    { seafarer_id: 1, seafarer_name: 'An', seafarer_status: 'AVAILABLE', rank_name: 'Master', contract_status: 'ACTIVE' },
    { seafarer_id: 2, seafarer_name: 'Bình', seafarer_status: 'AVAILABLE', rank_name: 'AB', contract_status: 'PENDING' },
    { seafarer_id: 3, seafarer_name: 'Cường', seafarer_status: 'AVAILABLE', rank_name: 'Oiler', contract_status: 'DRAFT' },
  ]

  it('bắt đầu chuyến: chỉ đổi người có hợp đồng hiệu lực, trả moved và skipped', async () => {
    const pool = fakePool([
      ['FOR UPDATE', () => [[{ id: 1, status: 'PLANNING' }]]],
      ['JOIN voyage_position p ON p.id = c.voyage_position_id\n           JOIN "rank"', () => [crew]],
      ...detailRoutes(detailRow({ status: 'ONBOARD' })),
    ])
    const result = await voyageService.transition(pool, 1, 'start', { actual_embark_date: '2026-11-05', embark_port_id: 3 }, 5)
    expect(result.moved).toEqual([{ seafarer_id: 1, seafarer_name: 'An', rank_name: 'Master' }])
    expect(result.skipped.map((s) => [s.seafarer_id, s.contract_status])).toEqual([[2, 'PENDING'], [3, 'DRAFT']])
    const update = pool.calls.find((c) => c.sql.startsWith('UPDATE seafarer'))
    expect(update.params).toEqual(['ON_VESSEL', [1]])
  })

  it('bắt đầu chuyến không ở PLANNING thì 409, không ghi gì', async () => {
    const pool = fakePool([['FOR UPDATE', () => [[{ id: 1, status: 'ONBOARD' }]]]])
    await expect(voyageService.transition(pool, 1, 'start', { actual_embark_date: '2026-11-05', embark_port_id: 3 })).rejects.toMatchObject({ statusCode: 409 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('kết thúc chuyến: ngày rời trước ngày xuống thì 400; đúng thì chỉ đưa người đang ON_VESSEL về AVAILABLE', async () => {
    const routes = [
      ['FOR UPDATE', () => [[{ id: 1, status: 'ONBOARD', actual_embark_date: '2026-11-05' }]]],
      ['JOIN voyage_position p ON p.id = c.voyage_position_id\n           JOIN "rank"', () => [[{ ...crew[0], seafarer_status: 'ON_VESSEL' }, { ...crew[1] }]]],
      ...detailRoutes(detailRow({ status: 'ENDED' })),
    ]
    const bad = fakePool(routes)
    await expect(voyageService.transition(bad, 1, 'end', { actual_disembark_date: '2026-11-01', disembark_port_id: 3 })).rejects.toMatchObject({ statusCode: 400 })
    const pool = fakePool(routes)
    const result = await voyageService.transition(pool, 1, 'end', { actual_disembark_date: '2027-08-05', disembark_port_id: 3 })
    expect(result.moved.map((m) => m.seafarer_id)).toEqual([1])
    expect(result.skipped.map((m) => m.seafarer_id)).toEqual([2])
    expect(pool.calls.find((c) => c.sql.startsWith('UPDATE seafarer')).params).toEqual(['AVAILABLE', [1]])
  })

  it('danh sách tính display_status, nhãn trễ ngày và số đếm cho các tab', async () => {
    const pool = fakePool([
      ['FROM voyage v', () => [[
        detailRow({ id: 1, positions_total: '2', positions_filled: '2' }),
        detailRow({ id: 2, planned_embark_date: '2026-10-17' }),
        detailRow({ id: 3, status: 'ONBOARD' }),
      ]]],
    ])
    const all = await voyageService.list(pool, {})
    expect(all.counts).toEqual({ all: 3, RECRUITING: 1, FULL: 1, ONBOARD: 1, ENDED: 0 })
    expect(all.data.find((r) => r.id === 2).due).toEqual({ kind: 'LATE', days: 2 })
    const full = await voyageService.list(pool, { tab: 'FULL' })
    expect(full.data.map((r) => r.id)).toEqual([1])
    expect(full.total).toBe(1)
  })
})
