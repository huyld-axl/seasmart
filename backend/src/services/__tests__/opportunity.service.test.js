import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { opportunityService, parseRequirements } = require('../opportunity.service')

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

const row = (over = {}) => ({
  id: 9, code: 'CH-2026-044', status: 'OPEN', rank_id: 2, rank_name: 'Máy hai', ship_owner_id: 1, vessel_id: 3,
  planned_join_date: '2026-10-25', planned_leave_date: '2027-07-25', deadline: '2026-10-15',
  budget_monthly_usd: '4900.00', budget_total_usd: '44100.00', today: '2026-10-26', updated_at: new Date().toISOString(),
  candidates_count: '0', sent_count: '0', last_sent_at: null, selected_at: null, voyage_id: null, voyage_code: null,
  ...over,
})
const detailRoutes = (r = row()) => [['FROM opportunity o', () => [[r]]]]
const body = (over = {}) => ({
  ship_owner_id: 1, vessel_id: 3, rank_id: 2, budget_monthly_usd: 4900,
  planned_join_date: '2026-10-25', planned_leave_date: '2027-07-25', deadline: '2026-10-15',
  requirements: [{ kind: 'CERTIFICATE', certificate_type_id: 7 }, { kind: 'TEMPLATE', template_key: 'cv' }],
  ...over,
})

describe('opportunity.service', () => {
  it('tạo cơ hội cấp mã CH-năm-số, tự tính budget cả chuyến, ghi hồ sơ yêu cầu theo thứ tự', async () => {
    const year = new Date().getUTCFullYear()
    const pool = fakePool([
      ['INSERT INTO "code_counter"', () => [{ rows: [{ last_value: 44 }] }]],
      ['INSERT INTO opportunity SET', () => [{ insertId: 9, rows: [{ id: 9 }] }]],
      ...detailRoutes(),
    ])
    const result = await opportunityService.create(pool, body(), 5)
    const insert = pool.calls.find((c) => c.sql.startsWith('INSERT INTO opportunity SET'))
    expect(insert.params[0]).toMatchObject({ code: `CH-${year}-044`, status: 'OPEN', owner_user_id: 5, budget_monthly_usd: 4900, budget_total_usd: 44100 })
    const reqs = pool.calls.filter((c) => c.sql.startsWith('INSERT INTO opportunity_requirement'))
    expect(reqs.map((c) => [c.params[0].kind, c.params[0].sort_order, c.params[0].valid_until])).toEqual([['CERTIFICATE', 0, 'LEAVE'], ['TEMPLATE', 1, 'ANY']])
    expect(result.display_status).toBe('NEW')
    expect(result.months).toBe(9)
  })

  it('ngày rời trước ngày xuống hoặc hồ sơ yêu cầu sai thì 400, không ghi gì', async () => {
    const pool = fakePool([])
    await expect(opportunityService.create(pool, body({ planned_leave_date: '2026-10-01' }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(opportunityService.create(pool, body({ requirements: [{ kind: 'TEMPLATE', template_key: 'khong-co' }] }))).rejects.toMatchObject({ statusCode: 400 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('sửa cơ hội đã chốt thì 409', async () => {
    const pool = fakePool([['FROM opportunity WHERE id', () => [[row({ status: 'WON' })]]]])
    await expect(opportunityService.update(pool, 9, { notes: 'x' }, 1)).rejects.toMatchObject({ statusCode: 409 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('đóng Không thành thiếu lý do thì 400; đóng cơ hội đã đóng thì 409', async () => {
    await expect(opportunityService.close(fakePool([]), 9, { outcome: 'LOST', reason: '  ' }, 1)).rejects.toMatchObject({ statusCode: 400 })
    const pool = fakePool([
      ['UPDATE opportunity SET status', () => [{ affectedRows: 0 }]],
      ['SELECT id FROM opportunity', () => [[{ id: 9 }]]],
    ])
    await expect(opportunityService.close(pool, 9, { outcome: 'CANCELLED' }, 1)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('nhân bản chép hồ sơ yêu cầu, không chép ứng viên', async () => {
    const pool = fakePool([
      ['SELECT * FROM opportunity WHERE id', () => [[row({ budget_monthly_usd: 4900 })]]],
      ['INSERT INTO "code_counter"', () => [{ rows: [{ last_value: 45 }] }]],
      ['INSERT INTO opportunity SET', () => [{ insertId: 10, rows: [{ id: 10 }] }]],
      ...detailRoutes(row({ id: 10 })),
    ])
    await opportunityService.duplicate(pool, 9, { rank_id: 4 }, 1)
    expect(pool.calls.find((c) => c.sql.startsWith('INSERT INTO opportunity SET')).params[0]).toMatchObject({ rank_id: 4, status: 'OPEN' })
    expect(pool.calls.some((c) => c.sql.includes('INSERT INTO opportunity_requirement') && c.sql.includes('SELECT'))).toBe(true)
    expect(pool.calls.some((c) => c.sql.includes('opportunity_candidate') && /^INSERT/.test(c.sql))).toBe(false)
  })

  it('hồ sơ yêu cầu điền sẵn: theo tàu trước, không có thì mẫu chức danh, không có nữa thì trống', async () => {
    const vesselRow = { kind: 'CERTIFICATE', certificate_type_id: 7, level: 'REQUIRED', valid_until: 'LEAVE' }
    const fromVessel = fakePool([['FROM vessel_certificate_requirement', () => [[vesselRow]]]])
    expect(await opportunityService.presets(fromVessel, { vessel_id: 3, rank_id: 2 })).toMatchObject({ source: 'VESSEL', requirements: [vesselRow] })
    const fromRank = fakePool([['FROM rank_requirement_preset', () => [[{ id: 1, kind: 'TEMPLATE', template_key: 'cv' }]]]])
    expect((await opportunityService.presets(fromRank, { vessel_id: 3, rank_id: 2 })).source).toBe('RANK')
    expect((await opportunityService.presets(fakePool([]), { vessel_id: 3, rank_id: 2 })).source).toBe('NONE')
  })

  it('không xoá được cơ hội đã gửi chủ tàu', async () => {
    const pool = fakePool([
      ['SELECT status FROM opportunity', () => [[{ status: 'OPEN' }]]],
      ['FROM opportunity_send', () => [[{ '?column?': 1 }]]],
    ])
    await expect(opportunityService.remove(pool, 9)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('parseRequirements', () => {
  it('kinh nghiệm cần đúng một cặp chức danh + tháng hoặc loại tàu + chuyến', () => {
    expect(parseRequirements([{ kind: 'EXPERIENCE', rank_id: 2, min_months: 12 }])[0]).toMatchObject({ level: 'REQUIRED', valid_until: 'ANY' })
    expect(() => parseRequirements([{ kind: 'EXPERIENCE', rank_id: 2, vessel_type_id: 1, min_months: 12, min_trips: 1 }])).toThrow()
    expect(() => parseRequirements([{ kind: 'EXPERIENCE', rank_id: 2 }])).toThrow()
  })
  it('LEAVE_PLUS phải có số tháng, mốc khác thì không', () => {
    expect(() => parseRequirements([{ kind: 'CERTIFICATE', certificate_type_id: 1, valid_until: 'LEAVE_PLUS' }])).toThrow()
    expect(() => parseRequirements([{ kind: 'CERTIFICATE', certificate_type_id: 1, valid_until: 'JOIN', plus_months: 6 }])).toThrow()
    expect(parseRequirements([{ kind: 'CERTIFICATE', certificate_type_id: 1, valid_until: 'LEAVE_PLUS', plus_months: 6 }])).toHaveLength(1)
  })
})

describe('ứng viên, nhãn, ghi nhận gửi', () => {
  const lock = (status = 'OPEN') => ['SELECT * FROM opportunity WHERE id', () => [[row({ status })]]]

  it('thêm người tạm ngưng thì 409, không ghi gì', async () => {
    const pool = fakePool([lock(), ['FROM seafarer WHERE id IN', () => [[{ id: 4, full_name: 'Lê Văn A', status: 'INACTIVE' }]]]])
    await expect(opportunityService.addCandidates(pool, 9, { seafarer_ids: [4] }, 1)).rejects.toMatchObject({ statusCode: 409 })
    expect(writes(pool)).toHaveLength(0)
  })

  it('cơ hội đã đóng thì không thêm ứng viên', async () => {
    const pool = fakePool([lock('WON')])
    await expect(opportunityService.addCandidates(pool, 9, { seafarer_ids: [4] }, 1)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('gắn nhãn cho người thứ hai thì bỏ nhãn người thứ nhất trước', async () => {
    const pool = fakePool([lock(), ['UPDATE opportunity_candidate SET owner_selected_at', () => [{ affectedRows: 1 }]], ...detailRoutes()])
    await opportunityService.setOwnerSelected(pool, 9, 5, true, 1)
    const ups = writes(pool).map((c) => c.sql)
    expect(ups[0]).toContain('owner_selected_at = NULL')
    expect(ups[0]).toContain('seafarer_id <> ?')
    expect(ups[1]).toContain('owner_selected_at = NOW()')
  })

  it('ghi nhận gửi khi có người chưa có bản xuất thì 409', async () => {
    const pool = fakePool([
      lock(),
      ['FROM opportunity_candidate c JOIN seafarer s', () => [[{ id: 1, export_pack_id: 3, full_name: 'A' }, { id: 2, export_pack_id: null, full_name: 'Trịnh Quang Vinh' }]]],
    ])
    await expect(opportunityService.recordSend(pool, 9, { candidate_ids: [1, 2], to_email: 'x@y.z', subject: 's' }, 1))
      .rejects.toMatchObject({ statusCode: 409, message: 'Chưa có bản xuất: Trịnh Quang Vinh' })
    expect(writes(pool)).toHaveLength(0)
  })

  it('đề xuất: lọc rảnh trước ngày bằng chuyến đang trên tàu, đánh dấu người đang được giữ chỗ', async () => {
    const pool = fakePool([
      ...detailRoutes(row({ ship_owner_name: 'Đông Á' })),
      ['FROM seafarer s\n', () => [[
        { id: 4, full_name: 'B', today: '2026-10-26', onboard_voyage_id: null },
        { id: 5, full_name: 'A', today: '2026-10-26', onboard_voyage_id: 8, onboard_until: '2026-10-20' },
      ]]],
      ['FROM opportunity_candidate c JOIN opportunity o', () => [[{ seafarer_id: 5, code: 'CH-2026-050' }]]],
    ])
    const result = await opportunityService.suggestions(pool, 9, { free_before: '2026-10-25' })
    const sql = pool.calls.find((c) => c.sql.includes('FROM seafarer s\n'))
    expect(sql.sql).toContain('ob.planned_leave_date <= ?')
    expect(sql.params).toContain('2026-10-25')
    expect(result.data.find((r) => r.id === 5)).toMatchObject({ held_by: 'CH-2026-050', free_from: '2026-10-20' })
    expect(result.data.find((r) => r.id === 4)).toMatchObject({ held_by: null, free_from: null })
  })
})
