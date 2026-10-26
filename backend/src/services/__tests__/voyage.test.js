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
const writes = (pool) => pool.calls.filter((c) => /^(INSERT|UPDATE|DELETE)/.test(c.sql.trim()))

const todayRoute = ["SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today", () => [[{ today: '2026-10-26' }]]]
const voyageRow = (over = {}) => ({
  id: 7, code: 'CT-2026-0139', status: 'ONBOARD', seafarer_id: 5, join_date: '2026-10-02', planned_leave_date: '2027-07-02',
  original_leave_date: null, leave_date: null, opportunity_join_date: null, today: '2026-10-26', transferred_from_id: null,
  legacy_contract_id: null, opportunity_id: null, ...over,
})
const detail = (row = voyageRow()) => ['FROM seafarer_voyage sv\n  JOIN seafarer s', () => [[row]]]
const body = (over = {}) => ({
  seafarer_id: 5, rank_id: 2, vessel_id: 4, ship_owner_id: 1, manual_reason: 'TRANSFER',
  join_date: '2026-10-26', join_port_id: 9, planned_leave_date: '2027-07-02', ...over,
})
const person = ['FROM seafarer WHERE id = ? AND deleted_at IS NULL FOR UPDATE', () => [[{ id: 5, full_name: 'Lê Quang Huy', status: 'ON_VESSEL' }]]]
const onboard = ["sv.status = 'ONBOARD' AND sv.deleted_at IS NULL FOR UPDATE OF sv", () => [[{ id: 7, code: 'CT-2026-0139', status: 'ONBOARD', seafarer_id: 5, join_date: '2026-10-02', vessel_name: 'MV Ocean Pride' }]]]

describe('voyage.service: tạo chuyến tay', () => {
  it('Chuyển tàu: đóng chuyến cũ cùng ngày, ghi chú tàu mới, nối transferred_from_id', async () => {
    const pool = fakePool([
      todayRoute, person, onboard,
      ['SELECT vessel_name FROM vessel', () => [[{ vessel_name: 'MV Ocean Grace' }]]],
      ['INSERT INTO "code_counter"', () => [{ rows: [{ last_value: 161 }] }]],
      ['INSERT INTO seafarer_voyage SET', () => [{ insertId: 8 }]],
      detail(voyageRow({ id: 8 })),
    ])
    const result = await voyageService.create(pool, body(), 1)
    const close = writes(pool).find((c) => c.sql.includes("SET status = 'LEFT'"))
    expect(close.params).toEqual(['2026-10-26', 9, 'Chuyển sang MV Ocean Grace', 1, 7])
    const inserted = pool.calls.find((c) => c.sql.startsWith('INSERT INTO seafarer_voyage SET')).params[0]
    expect(inserted).toMatchObject({ code: 'CT-2026-0161', source: 'MANUAL', manual_reason: 'TRANSFER', transferred_from_id: 7, status: 'ONBOARD' })
    expect(result.closed_voyage).toEqual({ id: 7, code: 'CT-2026-0139' })
  })

  it('người đang trên tàu, lý do khác Chuyển tàu thì 409, không ghi gì', async () => {
    const pool = fakePool([todayRoute, person, onboard])
    await expect(voyageService.create(pool, body({ manual_reason: 'OWNER_HIRED' }), 1)).rejects.toMatchObject({ statusCode: 409 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('nhập chuyến cũ trùng thời gian chuyến đã rời thì 409', async () => {
    const pool = fakePool([todayRoute, person, ["sv.status = 'LEFT'", () => [[{ code: 'CT-2025-0310' }]]]])
    await expect(voyageService.create(pool, body({ manual_reason: 'LEGACY', ended: true, join_date: '2025-09-01', leave_date: '2026-01-01', leave_port_id: 9 }), 1))
      .rejects.toMatchObject({ statusCode: 409, message: 'Lê Quang Huy đã có chuyến CT-2025-0310 trùng thời gian' })
  })

  it('ngày lên sau hôm nay, lý do Khác không ghi chú thì 400', async () => {
    await expect(voyageService.create(fakePool([todayRoute]), body({ join_date: '2026-10-27' }), 1)).rejects.toMatchObject({ statusCode: 400 })
    await expect(voyageService.create(fakePool([]), body({ manual_reason: 'OTHER' }), 1)).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('voyage.service: rời tàu, đổi ngày', () => {
  const lock = (over) => ['SELECT * FROM seafarer_voyage WHERE id', () => [[voyageRow(over)]]]

  it('ngày rời trước ngày lên thì 400', async () => {
    const pool = fakePool([lock()])
    await expect(voyageService.leave(pool, 7, { leave_date: '2026-09-01', leave_port_id: 9 }, 1)).rejects.toMatchObject({ statusCode: 400 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('ghi rời: chuyến LEFT, log LEAVE, thuyền viên về Ở bờ nếu không còn chuyến khác', async () => {
    const pool = fakePool([lock(), detail()])
    await voyageService.leave(pool, 7, { leave_date: '2026-10-26', leave_port_id: 9, leave_note: 'Sức khoẻ' }, 1)
    const sqls = writes(pool).map((c) => c.sql)
    expect(sqls[0]).toContain("SET status = 'LEFT'")
    expect(sqls[1]).toContain('seafarer_voyage_log')
    expect(sqls[2]).toContain("SET status = 'AVAILABLE'")
  })

  it('ghi rời nhiều chuyến: có một chuyến đã rời thì 409, không chuyến nào đổi', async () => {
    const pool = fakePool([['FROM seafarer_voyage sv JOIN seafarer s', () => [[
      voyageRow({ id: 7, full_name: 'A' }), voyageRow({ id: 8, status: 'LEFT', full_name: 'Trần Văn Bình' }),
    ]]]])
    await expect(voyageService.leaveMany(pool, { voyage_ids: [7, 8], leave_date: '2026-10-26', leave_port_id: 9 }, 1))
      .rejects.toMatchObject({ statusCode: 409, message: 'Đã rời tàu: Trần Văn Bình' })
    expect(writes(pool)).toHaveLength(0)
  })

  it('đổi ngày rời dự kiến giữ ngày gốc lần đầu', async () => {
    const pool = fakePool([lock(), detail()])
    await voyageService.leavePlan(pool, 7, { planned_leave_date: '2027-08-02' }, 1)
    expect(writes(pool)[0].sql).toContain('original_leave_date = COALESCE(original_leave_date, planned_leave_date)')
  })
})

describe('voyage.service: huỷ chốt, xoá', () => {
  const lock = (over) => ['SELECT * FROM seafarer_voyage WHERE id', () => [[voyageRow(over)]]]

  it('chuyến gắn hợp đồng cũ thì 409', async () => {
    const pool = fakePool([lock({ legacy_contract_id: 3 }), ['SELECT contract_number FROM seafarer_contract', () => [[{ contract_number: 'HĐ-2026-0004' }]]]])
    await expect(voyageService.remove(pool, 7, {}, 1)).rejects.toMatchObject({ statusCode: 409, message: 'Chuyến này gắn với hợp đồng HĐ-2026-0004, không huỷ được' })
    expect(writes(pool)).toHaveLength(0)
  })

  it('huỷ chốt đưa cơ hội về OPEN, ứng viên về PICKED, thuyền viên về Ở bờ', async () => {
    const pool = fakePool([lock({ opportunity_id: 44 })])
    await voyageService.remove(pool, 7, { note: 'Chốt nhầm' }, 1)
    const sqls = writes(pool).map((c) => c.sql)
    expect(sqls.some((q) => q.includes('SET deleted_at = NOW()'))).toBe(true)
    expect(sqls.some((q) => q.includes("SET status = 'AVAILABLE'"))).toBe(true)
    expect(sqls.some((q) => q.includes("UPDATE opportunity SET status = 'OPEN'"))).toBe(true)
    expect(sqls.some((q) => q.includes("SET status = 'PICKED'"))).toBe(true)
  })
})

describe('voyage.service: đội ngũ trên tàu', () => {
  it('đếm người sắp rời trong 6 tháng mà tàu chưa có cơ hội mở cùng chức danh', async () => {
    const pool = fakePool([
      ['FROM seafarer_voyage sv\n  JOIN seafarer s', () => [[voyageRow({ id: 1, source: 'OPPORTUNITY' }), voyageRow({ id: 2, status: 'LEFT', leave_date: '2026-09-14', source: 'MANUAL' })]]],
      ['FROM opportunity o JOIN "rank" r', () => [[{ id: 50, code: 'CH-2026-047', rank_id: 3 }]]],
      ['AS horizon', () => [[{ today: '2026-10-26', horizon: '2027-04-26' }]]],
      ["SELECT rank_id FROM opportunity", () => [[{ rank_id: 3 }]]],
      ["SELECT id, rank_id, planned_leave_date FROM seafarer_voyage", () => [[
        { id: 1, rank_id: 2, planned_leave_date: '2027-03-05' },
        { id: 3, rank_id: 3, planned_leave_date: '2027-03-05' },
        { id: 4, rank_id: 2, planned_leave_date: '2027-08-01' },
      ]]],
    ])
    const out = await voyageService.crewTimeline(pool, { vessel_id: 4, from: '2026-06-01', to: '2027-08-31' })
    expect(out.summary).toMatchObject({ onboard_today: 3, voyages_in_range: 2, left_in_range: 1, leaving_without_cover: 1, leaving_without_cover_ids: [1], by_source: { OPPORTUNITY: 1, MANUAL: 1 } })
    expect(out.open_opportunities).toHaveLength(1)
  })
})
