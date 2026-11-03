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
  id: 7, code: 'CT-2026-0139', seafarer_id: 5, join_date: '2026-10-02', planned_leave_date: '2027-07-02',
  original_leave_date: null, leave_date: null, opportunity_join_date: null, today: '2026-10-26',
  legacy_contract_id: null, opportunity_id: null, ...over,
})
const detail = (row = voyageRow()) => ['FROM seafarer_voyage sv\n  JOIN seafarer s', () => [[row]]]
const body = (over = {}) => ({
  seafarer_id: 5, rank_id: 2, vessel_id: 4, ship_owner_id: 1, manual_reason: 'OWNER_HIRED',
  join_date: '2026-10-26', join_port_id: 9, planned_leave_date: '2027-07-02', ...over,
})
const person = ['FROM seafarer WHERE id = ? AND deleted_at IS NULL FOR UPDATE', () => [[{ id: 5, full_name: 'Lê Quang Huy', status: 'ON_VESSEL' }]]]
const onboard = ["sv.leave_date IS NULL AND sv.deleted_at IS NULL FOR UPDATE OF sv", () => [[{ id: 7, code: 'CT-2026-0139', seafarer_id: 5, join_date: '2026-10-02', vessel_name: 'MV Ocean Pride' }]]]

const vesselOwner = (ownerId) => ['SELECT ship_owner_id FROM vessel', () => [[{ ship_owner_id: ownerId }]]]

describe('voyage.service: tạo chuyến tay', () => {
  it('chủ tàu không khớp chủ của tàu thì 400, không ghi gì', async () => {
    const pool = fakePool([todayRoute, person, vesselOwner(2)])
    await expect(voyageService.create(pool, body(), 1)).rejects.toMatchObject({ statusCode: 400, message: 'Chủ tàu không khớp với chủ tàu của tàu này' })
    expect(writes(pool)).toHaveLength(0)
  })

  it('người đang trên tàu thì 409 với mọi lý do, không ghi gì và không ghi rời chuyến cũ', async () => {
    for (const manual_reason of ['OWNER_HIRED', 'LEGACY', 'OTHER']) {
      const pool = fakePool([todayRoute, person, onboard])
      await expect(voyageService.create(pool, body({ manual_reason, notes: 'x' }), 1))
        .rejects.toMatchObject({ statusCode: 409, message: 'Lê Quang Huy đang trên MV Ocean Pride, ghi rời tàu chuyến đó trước' })
      expect(writes(pool)).toHaveLength(0)
    }
  })

  it('lý do Chuyển tàu không còn hợp lệ', async () => {
    await expect(voyageService.create(fakePool([]), body({ manual_reason: 'TRANSFER' }), 1)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('người ở bờ: tạo chuyến, không ghi transferred_from_id', async () => {
    const pool = fakePool([
      todayRoute, person, vesselOwner(1),
      ['INSERT INTO "code_counter"', () => [{ rows: [{ last_value: 61 }] }]],
      ['INSERT INTO seafarer_voyage SET', () => [{ insertId: 8 }]],
      detail(voyageRow({ id: 8 })),
    ])
    await voyageService.create(pool, body(), 1)
    const inserted = pool.calls.find((c) => c.sql.startsWith('INSERT INTO seafarer_voyage SET')).params[0]
    expect(inserted).toMatchObject({ code: `CT${String(new Date().getUTCFullYear()).slice(-2)}61`, source: 'MANUAL', manual_reason: 'OWNER_HIRED' })
    expect(inserted).not.toHaveProperty('transferred_from_id')
  })

  it('nhập chuyến cũ trùng thời gian chuyến đã rời thì 409', async () => {
    const pool = fakePool([todayRoute, person, ["sv.leave_date IS NOT NULL", () => [[{ code: 'CT-2025-0310' }]]]])
    await expect(voyageService.create(pool, body({ manual_reason: 'LEGACY', ended: true, join_date: '2025-09-01', leave_date: '2026-01-01', leave_port_id: 9 }), 1))
      .rejects.toMatchObject({ statusCode: 409, message: 'Lê Quang Huy đã có chuyến CT-2025-0310 trùng thời gian' })
  })

  it('ngày lên sau hôm nay, lý do Khác không ghi chú thì 400', async () => {
    await expect(voyageService.create(fakePool([todayRoute]), body({ join_date: '2026-10-27' }), 1)).rejects.toMatchObject({ statusCode: 400 })
    await expect(voyageService.create(fakePool([]), body({ manual_reason: 'OTHER' }), 1)).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('voyage.service: danh sách', () => {
  it('no_contract chỉ lấy chuyến chưa có hợp đồng chưa xoá', async () => {
    const pool = fakePool([['FROM seafarer_voyage sv\n  JOIN seafarer s', () => [[voyageRow()]]]])
    await voyageService.list(pool, { no_contract: true })
    expect(pool.calls[0].sql).toContain('NOT EXISTS (SELECT 1 FROM seafarer_contract c WHERE c.seafarer_voyage_id = sv.id AND c.deleted_at IS NULL)')
  })

  it('chi tiết trả hợp đồng của chuyến và cờ lệch ngày khi đã rời mà hợp đồng còn dài hơn', async () => {
    const left = voyageRow({ leave_date: '2026-10-17' })
    const pool = fakePool([
      detail(left),
      ['FROM seafarer_contract c WHERE c.seafarer_voyage_id = ?', () => [[{ id: 3, contract_number: 'HĐ-2026-0031', status: 'ACTIVE', start_date: '2026-03-10', end_date: '2026-12-31', diff_monthly: '250' }]]],
    ])
    const result = await voyageService.get(pool, 7)
    expect(result.contract).toMatchObject({ contract_number: 'HĐ-2026-0031', diff_monthly: 250 })
    expect(result.date_mismatch).toEqual({ leave_date: '2026-10-17', end_date: '2026-12-31' })
    const onboard = fakePool([detail(), ['FROM seafarer_contract c WHERE c.seafarer_voyage_id = ?', () => [[{ id: 3, status: 'ACTIVE', end_date: '2026-01-01', diff_monthly: '0' }]]]])
    expect((await voyageService.get(onboard, 7)).date_mismatch).toBeNull()
    const ended = fakePool([detail(left), ['FROM seafarer_contract c WHERE c.seafarer_voyage_id = ?', () => [[{ id: 3, status: 'ENDED', end_date: '2026-12-31', diff_monthly: '0' }]]]])
    expect((await voyageService.get(ended, 7)).date_mismatch).toBeNull()
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
    expect(sqls[0]).toContain('SET leave_date = ?')
    expect(sqls[1]).toContain('seafarer_voyage_log')
    expect(sqls[2]).toContain("SET status = 'AVAILABLE'")
  })

  it('ghi rời nhiều chuyến: có một chuyến đã rời thì 409, không chuyến nào đổi', async () => {
    const pool = fakePool([['FROM seafarer_voyage sv JOIN seafarer s', () => [[
      voyageRow({ id: 7, full_name: 'A' }), voyageRow({ id: 8, leave_date: '2026-10-17', full_name: 'Trần Văn Bình' }),
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

  const contractRows = (rows) => ['FROM seafarer_contract c WHERE c.seafarer_voyage_id', () => [rows]]

  it('chuyến có hợp đồng Hiệu lực hoặc Đã kết thúc thì 409', async () => {
    for (const status of ['ACTIVE', 'ENDED']) {
      const pool = fakePool([lock(), contractRows([{ id: 3, contract_number: 'HĐ-2026-0004', status, bills: '0' }])])
      await expect(voyageService.remove(pool, 7, {}, 1)).rejects.toMatchObject({ statusCode: 409, message: 'Chuyến có hợp đồng HĐ-2026-0004 đã hiệu lực, không huỷ được' })
      expect(writes(pool)).toHaveLength(0)
    }
  })

  it('chuyến có hợp đồng Nháp đã có bill (chờ duyệt lại) cũng bị chặn', async () => {
    const pool = fakePool([lock(), contractRows([{ id: 3, contract_number: 'HĐ-2026-0004', status: 'DRAFT', bills: '4' }])])
    await expect(voyageService.remove(pool, 7, {}, 1)).rejects.toMatchObject({ statusCode: 409 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('hợp đồng Nháp / Chờ duyệt / Bị từ chối bị xoá mềm theo chuyến, ghi log DELETE', async () => {
    const pool = fakePool([lock(), contractRows([{ id: 3, contract_number: 'HĐ-2026-0004', status: 'PENDING', bills: '0' }])])
    const result = await voyageService.remove(pool, 7, {}, 1)
    expect(result.deleted_contracts).toEqual([{ id: 3, contract_number: 'HĐ-2026-0004', status: 'PENDING' }])
    const sqls = writes(pool)
    expect(sqls.some((c) => c.sql.startsWith('UPDATE seafarer_contract SET deleted_at = NOW()') && c.params.at(-1) === 3)).toBe(true)
    expect(sqls.find((c) => c.sql.startsWith('INSERT INTO contract_approval_log')).params[0]).toMatchObject({ contract_id: 3, action: 'DELETE' })
  })

  it('xem trước huỷ chốt liệt kê hợp đồng bị xoá hoặc báo bị chặn', async () => {
    const free = fakePool([['FROM seafarer_voyage WHERE id = ?', () => [[{ id: 7 }]]], contractRows([{ id: 3, contract_number: 'HĐ-2026-0004', status: 'DRAFT', bills: '0' }])])
    expect(await voyageService.removePreview(free, 7)).toMatchObject({ blocked: false, contracts: [{ contract_number: 'HĐ-2026-0004', status: 'DRAFT' }] })
    const held = fakePool([['FROM seafarer_voyage WHERE id = ?', () => [[{ id: 7 }]]], contractRows([{ id: 3, contract_number: 'HĐ-2026-0004', status: 'ACTIVE', bills: '3' }])])
    expect(await voyageService.removePreview(held, 7)).toMatchObject({ blocked: true, message: 'Chuyến có hợp đồng HĐ-2026-0004 đã hiệu lực, không huỷ được', contracts: [] })
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
      ['FROM seafarer_voyage sv\n  JOIN seafarer s', () => [[voyageRow({ id: 1, source: 'OPPORTUNITY' }), voyageRow({ id: 2, leave_date: '2026-09-14', source: 'MANUAL' })]]],
      ['FROM opportunity o JOIN "rank" r', () => [[{ id: 50, code: 'CH26047', rank_id: 3 }]]],
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
