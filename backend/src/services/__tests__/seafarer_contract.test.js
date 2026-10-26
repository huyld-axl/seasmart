import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { seafarerContractService: service } = require('../seafarer_contract.service')

// Pool giả như voyage.test.js: khớp đoạn SQL thô đầu tiên, ghi lại mọi câu đã chạy.
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
const inserts = (pool, table) => pool.calls.filter((c) => c.sql.startsWith(`INSERT INTO ${table}`))
const logActions = (pool) => inserts(pool, 'contract_approval_log').map((c) => c.params[0].action)

const detailRow = (over = {}) => ({
  id: 9, contract_number: 'HĐ-2026-0001', status: 'DRAFT', voyage_position_id: 4, seafarer_id: 2, start_date: '2026-11-05', end_date: '2027-08-05',
  seafarer_name: 'An', rank_name: 'Master', budget_total_usd: '17100', budget_monthly_usd: '1900',
  voyage_id: 1, voyage_code: 'CT-2026-001', voyage_status: 'PLANNING', vessel_name: 'MV A', ship_owner_name: 'Owner',
  positions_total: '1', positions_filled: '1', receivable_monthly: '0', payable_monthly: '0',
  ...over,
})
const detailRoutes = (row = detailRow()) => [
  ['FROM seafarer_contract c\n  JOIN seafarer s', () => [[row]]],
  ['FROM contract_item WHERE', () => [[]]],
  ['FROM contract_payment_term', () => [[]]],
  ['FROM contract_approval_log', () => [[]]],
]
const createBody = (over = {}) => ({ voyage_position_id: 4, seafarer_id: 2, start_date: '2026-11-05', end_date: '2027-08-05', ...over })
const createRoutes = (over = {}) => [
  ['FROM voyage_position p JOIN voyage v', () => [[{ id: 4, voyage_status: 'PLANNING', ...over.position }]]],
  ['SELECT 1 FROM seafarer_contract WHERE voyage_position_id', () => [over.taken ? [{ '?column?': 1 }] : []]],
  ['FROM seafarer WHERE', () => [[{ id: 2, status: 'AVAILABLE' }]]],
  ['SELECT c.contract_number, s.full_name', () => [over.overlap ?? []]],
  ['INSERT INTO "code_counter"', () => [{ rows: [{ last_value: 142 }] }]],
  ['INSERT INTO seafarer_contract SET', () => [{ insertId: 9, rows: [{ id: 9 }] }]],
  ...detailRoutes(),
]

describe('seafarer_contract.service', () => {
  it('tạo hợp đồng: số HĐ-năm-0142, đủ 12 khoản mặc định, 2 kỳ thanh toán, log CREATE', async () => {
    const pool = fakePool(createRoutes())
    await service.create(pool, createBody({
      items: [{ item_code: 'BASIC_WAGE', receivable_usd: 1150, payable_usd: 1050 }, { custom_name: ' Phụ cấp tàu ', kind: 'MONTHLY', receivable_usd: 10 }],
    }), 5)
    const year = new Date().getUTCFullYear()
    expect(inserts(pool, 'seafarer_contract')[0].params[0]).toMatchObject({ contract_number: `HĐ-${year}-0142`, status: 'DRAFT', created_by: 5 })
    const items = inserts(pool, 'contract_item').map((c) => c.params[0])
    expect(items).toHaveLength(13)
    expect(items.filter((i) => i.item_code)).toHaveLength(12)
    expect(items[0]).toMatchObject({ item_code: 'BASIC_WAGE', receivable_usd: 1150, payable_usd: 1050 })
    expect(items[1]).toMatchObject({ item_code: 'FIXED_OVERTIME', receivable_usd: null })
    expect(items[12]).toMatchObject({ custom_name: 'Phụ cấp tàu', kind: 'MONTHLY' })
    const terms = inserts(pool, 'contract_payment_term').map((c) => c.params[0])
    expect(terms.map((t) => [t.side, t.pay_day, t.holiday_rule])).toEqual([['RECEIVABLE', 10, 'AFTER'], ['PAYABLE', 15, 'BEFORE']])
    expect(logActions(pool)).toEqual(['CREATE'])
  })

  it('tạo hợp đồng: vị trí đã có hợp đồng, chuyến đã kết thúc, trùng thời gian, mã khoản lạ', async () => {
    await expect(service.create(fakePool(createRoutes({ taken: true })), createBody())).rejects.toMatchObject({ statusCode: 409, message: 'Vị trí này đã có hợp đồng' })
    await expect(service.create(fakePool(createRoutes({ position: { voyage_status: 'ENDED' } })), createBody())).rejects.toMatchObject({ statusCode: 409 })
    await expect(
      service.create(fakePool(createRoutes({ overlap: [{ contract_number: 'HĐ-2026-0007', full_name: 'An' }] })), createBody())
    ).rejects.toMatchObject({ statusCode: 409, message: 'An đã có hợp đồng HĐ-2026-0007 trùng thời gian' })
    await expect(service.create(fakePool(createRoutes()), createBody({ items: [{ item_code: 'NOPE' }] }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(service.create(fakePool(createRoutes()), createBody({ end_date: '2026-01-01' }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('sửa hợp đồng chờ duyệt hoặc hiệu lực thì 409; nháp thì thay toàn bộ khoản và kỳ thanh toán', async () => {
    const locked = (status) => fakePool([['FOR UPDATE', () => [[{ id: 9, status }]]]])
    for (const status of ['PENDING', 'ACTIVE', 'ENDED']) {
      await expect(service.update(locked(status), 9, createBody())).rejects.toMatchObject({ statusCode: 409, message: 'Hợp đồng đang khoá, không sửa được' })
    }
    const pool = fakePool([
      ['FOR UPDATE', () => [[{ id: 9, status: 'REJECTED' }]]],
      ['FROM seafarer WHERE', () => [[{ id: 2, status: 'AVAILABLE' }]]],
      ...detailRoutes(),
    ])
    await service.update(pool, 9, createBody(), 5)
    expect(pool.calls.some((c) => c.sql.startsWith('DELETE FROM contract_item'))).toBe(true)
    expect(pool.calls.some((c) => c.sql.startsWith('DELETE FROM contract_payment_term'))).toBe(true)
    expect(inserts(pool, 'contract_item')).toHaveLength(12)
    expect(inserts(pool, 'contract_payment_term')).toHaveLength(2)
  })

  const transitionPool = (status, voyageStatus = 'PLANNING') =>
    fakePool([
      ['FOR UPDATE OF c', () => [[{ status, seafarer_id: 2, voyage_status: voyageStatus }]]],
      // Bill đã có thì bước sinh bill khi duyệt bỏ qua (chi tiết sinh bill test ở contract_bill.test.js).
      ['SELECT 1 FROM contract_bill WHERE contract_id', () => [[{ '?column?': 1 }]]],
      ...detailRoutes(),
    ])

  it('các đường chuyển trạng thái hợp lệ, mỗi thao tác ghi đúng một dòng log', async () => {
    const cases = [
      ['submit', 'DRAFT', 'PENDING', 'SUBMIT'],
      ['submit', 'REJECTED', 'PENDING', 'SUBMIT'],
      ['withdraw', 'PENDING', 'DRAFT', 'WITHDRAW'],
      ['reject', 'PENDING', 'REJECTED', 'REJECT'],
      ['approve', 'PENDING', 'ACTIVE', 'APPROVE'],
    ]
    for (const [action, from, to, log] of cases) {
      const pool = transitionPool(from)
      await service.transition(pool, 9, action, { reason: 'Sai ngày' }, 5)
      const update = pool.calls.find((c) => c.sql.startsWith('UPDATE seafarer_contract'))
      expect(update.params[0].status).toBe(to)
      expect(logActions(pool)).toEqual([log])
    }
  })

  it('duyệt thì gọi sinh yêu cầu thanh toán bên phải thu, các thao tác khác thì không', async () => {
    const approved = transitionPool('PENDING')
    await service.transition(approved, 9, 'approve', {}, 5)
    expect(approved.calls.find((c) => c.sql.startsWith('SELECT 1 FROM contract_bill')).params).toEqual([9, 'RECEIVABLE'])
    const submitted = transitionPool('DRAFT')
    await service.transition(submitted, 9, 'submit', {}, 5)
    expect(submitted.calls.some((c) => c.sql.includes('contract_bill'))).toBe(false)
  })

  it('chuyển trạng thái sai thì 409 nêu trạng thái hiện tại, không ghi gì', async () => {
    for (const [action, from] of [['submit', 'PENDING'], ['submit', 'ACTIVE'], ['withdraw', 'DRAFT'], ['reject', 'DRAFT'], ['approve', 'DRAFT'], ['approve', 'ACTIVE']]) {
      const pool = transitionPool(from)
      await expect(service.transition(pool, 9, action, { reason: 'x' })).rejects.toMatchObject({ statusCode: 409 })
      expect(pool.calls.some((c) => /^(UPDATE|INSERT)/.test(c.sql))).toBe(false)
    }
    await expect(service.transition(transitionPool('DRAFT'), 9, 'approve')).rejects.toMatchObject({ message: 'Không thực hiện được: hợp đồng đang ở trạng thái Nháp' })
  })

  it('từ chối không lý do thì 400; có lý do thì lưu vào hợp đồng và log', async () => {
    for (const reason of [undefined, '', '   ']) {
      await expect(service.transition(transitionPool('PENDING'), 9, 'reject', { reason })).rejects.toMatchObject({ statusCode: 400 })
    }
    const pool = transitionPool('PENDING')
    await service.transition(pool, 9, 'reject', { reason: '  Sai ngày  ' }, 5)
    expect(pool.calls.find((c) => c.sql.startsWith('UPDATE seafarer_contract')).params[0].last_reject_reason).toBe('Sai ngày')
    expect(inserts(pool, 'contract_approval_log')[0].params[0]).toMatchObject({ action: 'REJECT', reason: 'Sai ngày' })
  })

  it('duyệt không đổi trạng thái thuyền viên nữa (giờ chỉ chuyến đổi), kể cả khi gửi move_onboard', async () => {
    const onboard = transitionPool('PENDING', 'ONBOARD')
    const result = await service.transition(onboard, 9, 'approve', { move_onboard: true }, 5)
    expect(result.moved).toBeUndefined()
    expect(onboard.calls.some((c) => c.sql.startsWith('UPDATE seafarer SET'))).toBe(false)
  })

  it('chỉ xoá được hợp đồng nháp', async () => {
    const ok = fakePool([['UPDATE seafarer_contract SET deleted_at', () => [{ affectedRows: 1 }]]])
    await expect(service.softDelete(ok, 9)).resolves.toEqual({ success: true })
    const locked = fakePool([['UPDATE seafarer_contract SET deleted_at', () => [{ affectedRows: 0 }]], ['SELECT status FROM seafarer_contract', () => [[{ status: 'ACTIVE' }]]]])
    await expect(service.softDelete(locked, 9)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('chi tiết trả balance tính từ khoản mặc định và budget của vị trí', async () => {
    const pool = fakePool([
      ['FROM seafarer_contract c\n  JOIN seafarer s', () => [[detailRow()]]],
      ['FROM contract_item WHERE', () => [[
        { id: 1, kind: 'MONTHLY', item_code: 'BASIC_WAGE', custom_name: null, receivable_usd: '1900.00', payable_usd: '1650.00' },
        { id: 2, kind: 'MONTHLY', item_code: null, custom_name: 'Khác', receivable_usd: null, payable_usd: null },
      ]]],
      ['FROM contract_payment_term', () => [[{ side: 'PAYABLE', closing_day: 31, pay_day: 15, pay_month_offset: 1, holiday_rule: 'BEFORE' }]]],
      ['FROM contract_approval_log', () => [[]]],
    ])
    const result = await service.get(pool, 9)
    expect(result.items[0]).toMatchObject({ name: 'Lương cơ bản', receivable_usd: 1900 })
    expect(result.terms.PAYABLE.pay_day).toBe(15)
    expect(result.contract.months).toBe(9)
    expect(result.balance).toMatchObject({ budgetMonthly: 1900, receivableMonthly: 1900, payableMonthly: 1650, diffMonthly: 250, diffContract: 2250, diffOk: true })
  })

  it('danh sách đếm theo trạng thái cho các tab', async () => {
    const pool = fakePool([
      ['GROUP BY c.status', () => [[{ status: 'DRAFT', n: '2' }, { status: 'ACTIVE', n: '5' }]]],
      ['ORDER BY c.created_at DESC', () => [[detailRow({ receivable_monthly: '1900', payable_monthly: '1650' })]]],
    ])
    const result = await service.list(pool, { tab: 'ACTIVE' })
    expect(result.counts).toEqual({ all: 7, DRAFT: 2, PENDING: 0, REJECTED: 0, ACTIVE: 5, ENDED: 0 })
    expect(result.total).toBe(5)
    expect(result.data[0]).toMatchObject({ receivable_monthly: 1900, payable_monthly: 1650, diff_monthly: 250 })
  })
})
