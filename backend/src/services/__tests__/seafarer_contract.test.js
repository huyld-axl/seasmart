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
  const state = { committed: false, rolledBack: false }
  return {
    calls,
    state,
    query: run,
    async getConnection() {
      return { query: run, beginTransaction: async () => {}, commit: async () => { state.committed = true }, rollback: async () => { state.rolledBack = true }, release: () => {} }
    },
  }
}
const inserts = (pool, table) => pool.calls.filter((c) => c.sql.startsWith(`INSERT INTO ${table}`))
const logActions = (pool) => inserts(pool, 'contract_approval_log').map((c) => c.params[0].action)

const detailRow = (over = {}) => ({
  id: 9, contract_number: 'HĐ-2026-0001', status: 'DRAFT', voyage_position_id: null, seafarer_voyage_id: 4, seafarer_id: 2, start_date: '2026-11-05', end_date: '2027-08-05',
  seafarer_name: 'An', rank_name: 'Master', budget_total_usd: null, budget_monthly_usd: '1900',
  voyage_id: null, trip_id: 4, trip_code: 'CT-2026-0004', trip_join_date: '2026-11-05', trip_planned_leave_date: '2027-08-05', trip_leave_date: null,
  vessel_id: 3, vessel_name: 'MV A', ship_owner_id: 1, ship_owner_name: 'Owner',
  awaiting_reapproval: false, date_mismatch: false,
  positions_total: '0', positions_filled: '0', receivable_monthly: '0', payable_monthly: '0',
  ...over,
})
const billSummary = (over = {}) => ({ n: '0', first_start: null, last_end: null, has_sent_or_paid: false, ...over })
const detailRoutes = (row = detailRow(), bills = billSummary()) => [
  ['FROM seafarer_contract c\n  JOIN seafarer s', () => [[row]]],
  ['FROM contract_item WHERE', () => [[]]],
  ['FROM contract_payment_term WHERE contract_id = ?', () => [[]]],
  ['FROM contract_approval_log', () => [[]]],
  ['BOOL_OR(status', () => [[bills]]],
]
const createBody = (over = {}) => ({ seafarer_voyage_id: 4, start_date: '2026-11-05', end_date: '2027-08-05', ...over })
const createRoutes = (over = {}) => [
  ['FROM seafarer_voyage sv JOIN seafarer s', () => [over.voyage === null ? [] : [{ id: 4, code: 'CT-2026-0004', seafarer_id: 2, seafarer_status: 'ON_VESSEL', ...over.voyage }]]],
  ['SELECT contract_number FROM seafarer_contract WHERE seafarer_voyage_id', () => [over.taken ? [{ contract_number: 'HĐ-2026-0003' }] : []]],
  ['c.contract_number, s.full_name', () => [over.overlap ?? []]],
  ['AS taken', () => [[{ taken: 0 }]]],
  ['INSERT INTO seafarer_contract SET', () => [{ insertId: 9, rows: [{ id: 9 }] }]],
  ...detailRoutes(),
]

// Bill của HĐ-C rút gọn: kỳ 1 (Đã thu), 2, 3 (Chưa gửi), chốt cuối tháng, 05/11/2026 → 05/08/2027 đổi thành 01/01 → 31/03 cho gọn.
const bill = (seq, start, end, status = 'OPEN') => ({
  id: seq * 10, code: `TT-${seq}`, seq, period_start: start, period_end: end, due_date: '2027-01-10', status, updated_at: '2026-12-01T00:00:00Z', total_usd: '1650', edited: false,
})
const BILLS = [bill(1, '2027-01-01', '2027-01-31', 'PAID'), bill(2, '2027-02-01', '2027-02-28'), bill(3, '2027-03-01', '2027-03-31')]
const planRoutes = (bills = BILLS, contract = { id: 9, start_date: '2027-01-01', end_date: '2027-03-31' }) => [
  ['SELECT id, start_date, end_date FROM seafarer_contract', () => [[contract]]],
  ['FROM contract_bill b WHERE b.contract_id = ? AND b.side = ?', () => [bills]],
  ['FROM contract_payment_term WHERE contract_id = ? AND side = ?', () => [[{ closing_day: 31, pay_day: 10, pay_month_offset: 1, holiday_rule: 'AFTER' }]]],
]

describe('seafarer_contract.service', () => {
  it('tạo hợp đồng: số {mã chuyến}/HĐ, đủ 12 khoản mặc định, 2 kỳ thanh toán, gắn chuyến, log CREATE', async () => {
    const pool = fakePool(createRoutes())
    await service.create(pool, createBody({
      items: [{ item_code: 'BASIC_WAGE', receivable_usd: 1150, payable_usd: 1050 }, { custom_name: ' Phụ cấp tàu ', kind: 'MONTHLY', receivable_usd: 10 }],
    }), 5)
    expect(inserts(pool, 'seafarer_contract')[0].params[0]).toMatchObject({ contract_number: 'CT-2026-0004/HĐ', status: 'DRAFT', seafarer_voyage_id: 4, created_by: 5 })
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

  it('tạo hợp đồng lấy thuyền viên theo chuyến, bỏ qua seafarer_id gửi lên', async () => {
    const pool = fakePool(createRoutes())
    await service.create(pool, createBody({ seafarer_id: 99 }), 5)
    expect(inserts(pool, 'seafarer_contract')[0].params[0].seafarer_id).toBe(2)
    expect(pool.calls.find((c) => c.sql.includes('c.contract_number, s.full_name')).params[0]).toBe(2)
  })

  it('tạo hợp đồng: chuyến không có, chuyến đã có hợp đồng, thuyền viên tạm ngưng, trùng thời gian, mã khoản lạ', async () => {
    await expect(service.create(fakePool(createRoutes({ voyage: null })), createBody())).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.create(fakePool(createRoutes({ taken: true })), createBody()))
      .rejects.toMatchObject({ statusCode: 409, message: 'Chuyến CT-2026-0004 đã có hợp đồng HĐ-2026-0003' })
    await expect(service.create(fakePool(createRoutes({ voyage: { seafarer_status: 'INACTIVE' } })), createBody())).rejects.toMatchObject({ statusCode: 409 })
    await expect(
      service.create(fakePool(createRoutes({ overlap: [{ contract_number: 'HĐ-2026-0007', full_name: 'An' }] })), createBody())
    ).rejects.toMatchObject({ statusCode: 409, message: 'An đã có hợp đồng HĐ-2026-0007 trùng thời gian' })
    await expect(service.create(fakePool(createRoutes()), createBody({ items: [{ item_code: 'NOPE' }] }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(service.create(fakePool(createRoutes()), createBody({ end_date: '2026-01-01' }))).rejects.toMatchObject({ statusCode: 400 })
  })

  const lockRow = (over = {}) => ['FOR UPDATE', () => [[{ id: 9, status: 'DRAFT', seafarer_id: 2, seafarer_voyage_id: 4, start_date: '2027-01-01', end_date: '2027-03-31', ...over }]]]

  it('sửa hợp đồng chờ duyệt, hiệu lực hoặc đã kết thúc thì 409; nháp thì thay toàn bộ khoản và kỳ thanh toán', async () => {
    for (const status of ['PENDING', 'ACTIVE', 'ENDED']) {
      await expect(service.update(fakePool([lockRow({ status })]), 9, createBody())).rejects.toMatchObject({ statusCode: 409, message: 'Hợp đồng đang khoá, không sửa được' })
    }
    const pool = fakePool([
      lockRow({ status: 'REJECTED', start_date: '2026-11-05', end_date: '2027-08-05' }),
      ['FROM seafarer WHERE', () => [[{ id: 2, status: 'AVAILABLE' }]]],
      ...detailRoutes(),
    ])
    await service.update(pool, 9, createBody(), 5)
    expect(pool.calls.some((c) => c.sql.startsWith('DELETE FROM contract_item'))).toBe(true)
    expect(pool.calls.some((c) => c.sql.startsWith('DELETE FROM contract_payment_term'))).toBe(true)
    expect(inserts(pool, 'contract_item')).toHaveLength(12)
    expect(inserts(pool, 'contract_payment_term')).toHaveLength(2)
    // Ngày không đổi: không tính plan bill.
    expect(pool.calls.some((c) => c.sql.includes('b.side = ?'))).toBe(false)
  })

  it('sửa hợp đồng cũ chưa gắn chuyến thì 409', async () => {
    await expect(service.update(fakePool([lockRow({ seafarer_voyage_id: null })]), 9, createBody())).rejects.toMatchObject({ statusCode: 409, message: 'Hợp đồng cũ chưa gắn chuyến' })
  })

  it('sửa ngày khi bill bị ảnh hưởng đã thu: 409 kèm danh sách bill; bill chưa gửi thì cho lưu', async () => {
    const build = (bills) => fakePool([lockRow(), ['FROM seafarer WHERE', () => [[{ id: 2, status: 'AVAILABLE' }]]], ...planRoutes(bills), ...detailRoutes()])
    // E = 15/01 cắt kỳ 1 (Đã thu).
    const blocked = build(BILLS)
    const error = await service.update(blocked, 9, createBody({ start_date: '2027-01-01', end_date: '2027-01-15' })).catch((e) => e)
    expect(error.statusCode).toBe(409)
    expect(error.message).toContain('TT-1 kỳ 1 (Đã thu)')
    expect(error.blocked_bills).toEqual([expect.objectContaining({ code: 'TT-1', status: 'PAID' })])
    expect(blocked.calls.some((c) => c.sql.startsWith('UPDATE seafarer_contract'))).toBe(false)
    // E = 20/02 chỉ đụng bill Chưa gửi, hoặc E muộn hơn: lưu được.
    const fine = build(BILLS)
    await service.update(fine, 9, createBody({ start_date: '2027-01-01', end_date: '2027-02-20' }), 5)
    expect(fine.calls.some((c) => c.sql.startsWith('UPDATE seafarer_contract'))).toBe(true)
    const later = build(BILLS)
    await service.update(later, 9, createBody({ start_date: '2027-01-01', end_date: '2027-06-30' }), 5)
    expect(later.calls.some((c) => c.sql.startsWith('UPDATE seafarer_contract'))).toBe(true)
  })

  it('sửa S khi có bill đã thu thì 409 liệt kê mọi bill chưa OPEN', async () => {
    const pool = fakePool([lockRow(), ['FROM seafarer WHERE', () => [[{ id: 2, status: 'AVAILABLE' }]]], ...planRoutes(), ...detailRoutes()])
    const error = await service.update(pool, 9, createBody({ start_date: '2027-01-05', end_date: '2027-03-31' })).catch((e) => e)
    expect(error.statusCode).toBe(409)
    expect(error.blocked_bills.map((b) => b.code)).toEqual(['TT-1'])
  })

  const transitionPool = (status, over = {}, extraRoutes = []) =>
    fakePool([
      ['FOR UPDATE OF c', () => [[{ status, seafarer_id: 2, seafarer_voyage_id: 4, end_date: '2027-03-31', today: '2026-11-02', ...over }]]],
      ...extraRoutes,
      ...planRoutes([]),
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
      ['revert', 'ACTIVE', 'DRAFT', 'REVERT'],
      ['end', 'ACTIVE', 'ENDED', 'END'],
    ]
    for (const [action, from, to, log] of cases) {
      const pool = transitionPool(from)
      await service.transition(pool, 9, action, { reason: 'Sai ngày' }, 5)
      const update = pool.calls.find((c) => c.sql.startsWith('UPDATE seafarer_contract'))
      expect(update.params[0].status).toBe(to)
      expect(logActions(pool)).toEqual([log])
    }
  })

  it('Kết thúc ghi payload ngày kết thúc và hôm nay, không đụng bill', async () => {
    const pool = transitionPool('ACTIVE')
    await service.transition(pool, 9, 'end', {}, 5)
    expect(JSON.parse(inserts(pool, 'contract_approval_log')[0].params[0].payload)).toEqual({ end_date: '2027-03-31', today: '2026-11-02' })
    expect(pool.calls.some((c) => /^(UPDATE|INSERT) (INTO )?contract_bill/.test(c.sql) || c.sql.includes('b.side = ?'))).toBe(false)
  })

  it('Đưa về Nháp chỉ đổi trạng thái, không đụng bill; hợp đồng cũ chưa gắn chuyến thì 409', async () => {
    const pool = transitionPool('ACTIVE')
    await service.transition(pool, 9, 'revert', {}, 5)
    expect(pool.calls.some((c) => /^(UPDATE|INSERT) (INTO )?contract_bill/.test(c.sql) || c.sql.includes('b.side = ?'))).toBe(false)
    await expect(service.transition(transitionPool('ACTIVE', { seafarer_voyage_id: null }), 9, 'revert', {}, 5))
      .rejects.toMatchObject({ statusCode: 409, message: 'Hợp đồng cũ chưa gắn chuyến' })
    await expect(service.transition(transitionPool('PENDING', { seafarer_voyage_id: null }), 9, 'approve', {}, 5))
      .rejects.toMatchObject({ statusCode: 409, message: 'Hợp đồng cũ chưa gắn chuyến' })
  })

  it('duyệt lần đầu (chưa có bill) gọi sinh yêu cầu thanh toán bên phải thu, các thao tác khác thì không', async () => {
    const approved = transitionPool('PENDING')
    await service.transition(approved, 9, 'approve', {}, 5)
    expect(approved.calls.find((c) => c.sql.startsWith('SELECT 1 FROM contract_bill')).params).toEqual([9, 'RECEIVABLE'])
    const submitted = transitionPool('DRAFT')
    await service.transition(submitted, 9, 'submit', {}, 5)
    expect(submitted.calls.some((c) => /^(UPDATE|INSERT) (INTO )?contract_bill/.test(c.sql) || c.sql.includes('b.side = ?'))).toBe(false)
  })

  it('chuyển trạng thái sai thì 409 nêu trạng thái hiện tại, không ghi gì', async () => {
    const cases = [['submit', 'PENDING'], ['submit', 'ACTIVE'], ['withdraw', 'DRAFT'], ['reject', 'DRAFT'], ['approve', 'DRAFT'], ['approve', 'ACTIVE'],
      ['revert', 'DRAFT'], ['revert', 'PENDING'], ['revert', 'REJECTED'], ['revert', 'ENDED'], ['end', 'DRAFT'], ['end', 'ENDED']]
    for (const [action, from] of cases) {
      const pool = transitionPool(from)
      await expect(service.transition(pool, 9, action, { reason: 'x' })).rejects.toMatchObject({ statusCode: 409 })
      expect(pool.calls.some((c) => /^(UPDATE|INSERT)/.test(c.sql))).toBe(false)
    }
    await expect(service.transition(transitionPool('DRAFT'), 9, 'approve')).rejects.toMatchObject({ message: 'Không thực hiện được: hợp đồng đang ở trạng thái Nháp' })
    await expect(service.transition(transitionPool('ENDED'), 9, 'revert')).rejects.toMatchObject({ message: 'Không thực hiện được: hợp đồng đang ở trạng thái Đã kết thúc' })
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

  it('duyệt không đổi trạng thái thuyền viên (chỉ chuyến đổi), kể cả khi gửi move_onboard', async () => {
    const onboard = transitionPool('PENDING')
    const result = await service.transition(onboard, 9, 'approve', { move_onboard: true }, 5)
    expect(result.moved).toBeUndefined()
    expect(onboard.calls.some((c) => c.sql.startsWith('UPDATE seafarer SET'))).toBe(false)
  })

  describe('duyệt lại hợp đồng đã có bill', () => {
    const reapprove = (bills, contract, extraRoutes = []) => fakePool([
      ['FOR UPDATE OF c', () => [[{ status: 'PENDING', seafarer_id: 2, seafarer_voyage_id: 4, end_date: contract.end_date, today: '2026-11-02' }]]],
      ...extraRoutes,
      ...planRoutes(bills, contract),
      ['SELECT item_code, custom_name, kind', () => [[{ item_code: 'BASIC_WAGE', custom_name: null, kind: 'MONTHLY', receivable_usd: '1650', payable_usd: null }]]],
      ['SELECT created_by FROM seafarer_contract', () => [[{ created_by: 3 }]]],
      ['AS taken', () => [[{ taken: 0 }]]],
      ['SELECT contract_number FROM seafarer_contract WHERE id', () => [[{ contract_number: 'CT-2026-0004/HĐ' }]]],
      ['INSERT INTO contract_bill SET', () => [{ insertId: 500, rows: [{ id: 500 }] }]],
      ...detailRoutes(),
    ])
    const OPEN_BILLS = [bill(1, '2027-01-01', '2027-01-31'), bill(2, '2027-02-01', '2027-02-28'), bill(3, '2027-03-01', '2027-03-31')]
    const fingerprintOf = async (bills, contract) => (await service.billPlan(reapprove(bills, contract), 9)).fingerprint

    it('E sớm: cắt kỳ chứa E (giữ tiền), xoá mềm kỳ sau, log CUT / DELETE và APPLY_BILLS', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-02-10' }
      const pool = reapprove(OPEN_BILLS, contract)
      await service.transition(pool, 9, 'approve', { expected_fingerprint: await fingerprintOf(OPEN_BILLS, contract) }, 5)
      const cut = pool.calls.find((c) => c.sql.startsWith('UPDATE contract_bill SET period_end'))
      expect(cut.params).toEqual(['2027-02-10', '2027-03-10', 5, 20])
      const removed = pool.calls.find((c) => c.sql.startsWith('UPDATE contract_bill SET deleted_at'))
      expect(removed.params).toEqual([5, 30])
      const billLogs = inserts(pool, 'contract_bill_log').map((c) => c.params[0].action)
      expect(billLogs).toEqual(['CUT', 'DELETE'].reverse())
      expect(logActions(pool)).toEqual(['APPROVE', 'APPLY_BILLS'])
      expect(inserts(pool, 'contract_bill_item')).toHaveLength(0)
    })

    it('E muộn: giữ bill cũ, sinh thêm kỳ nối tiếp chỉ có khoản hằng tháng', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-05-15' }
      const pool = reapprove(OPEN_BILLS, contract)
      await service.transition(pool, 9, 'approve', { expected_fingerprint: await fingerprintOf(OPEN_BILLS, contract) }, 5)
      const created = pool.calls.filter((c) => c.sql.startsWith('INSERT INTO contract_bill SET')).map((c) => c.params[0])
      expect(created.map((b) => [b.seq, b.period_start, b.period_end])).toEqual([[4, '2027-04-01', '2027-04-30'], [5, '2027-05-01', '2027-05-15']])
      expect(inserts(pool, 'contract_bill_item').every((c) => c.params[0].kind === 'MONTHLY')).toBe(true)
      expect(pool.calls.some((c) => c.sql.startsWith('UPDATE contract_bill SET'))).toBe(false)
    })

    it('S đổi: xoá mềm mọi bill, sinh lại từ 1, kỳ 1 có khoản một lần', async () => {
      const contract = { id: 9, start_date: '2027-01-10', end_date: '2027-02-28' }
      const pool = reapprove(OPEN_BILLS, contract)
      await service.transition(pool, 9, 'approve', { expected_fingerprint: await fingerprintOf(OPEN_BILLS, contract) }, 5)
      expect(pool.calls.filter((c) => c.sql.startsWith('UPDATE contract_bill SET deleted_at'))).toHaveLength(3)
      const created = pool.calls.filter((c) => c.sql.startsWith('INSERT INTO contract_bill SET')).map((c) => c.params[0])
      expect(created.map((b) => [b.seq, b.period_start, b.period_end])).toEqual([[1, '2027-01-10', '2027-01-31'], [2, '2027-02-01', '2027-02-28']])
    })

    it('không đổi ngày: không đụng bill và không cần fingerprint', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-03-31' }
      const pool = reapprove(OPEN_BILLS, contract)
      await service.transition(pool, 9, 'approve', {}, 5)
      expect(pool.calls.some((c) => /^(UPDATE|INSERT) (INTO )?contract_bill/.test(c.sql))).toBe(false)
      expect(logActions(pool)).toEqual(['APPROVE'])
    })

    it('bill bị ảnh hưởng đã gửi hoặc đã thu lúc duyệt thì 409 kèm bill, không ghi gì', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-01-20' }
      const pool = reapprove(BILLS, contract)
      const error = await service.transition(pool, 9, 'approve', { expected_fingerprint: 'x' }, 5).catch((e) => e)
      expect(error).toMatchObject({ statusCode: 409 })
      expect(error.blocked_bills.map((b) => b.code)).toEqual(['TT-1'])
      expect(pool.calls.some((c) => /^(UPDATE|INSERT)/.test(c.sql))).toBe(false)
    })

    it('fingerprint thiếu hoặc lệch thì 409 mở lại hộp, không ghi gì', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-02-10' }
      for (const expected_fingerprint of [undefined, 'lech']) {
        const pool = reapprove(OPEN_BILLS, contract)
        await expect(service.transition(pool, 9, 'approve', { expected_fingerprint }, 5))
          .rejects.toMatchObject({ statusCode: 409, message: 'Yêu cầu thanh toán vừa thay đổi, mở lại hộp duyệt' })
        expect(pool.calls.some((c) => /^(UPDATE|INSERT)/.test(c.sql))).toBe(false)
      }
    })

    it('bill đổi tiền sau khi mở hộp làm fingerprint đổi', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-02-10' }
      const edited = OPEN_BILLS.map((b) => (b.seq === 3 ? { ...b, total_usd: '1700' } : b))
      expect(await fingerprintOf(edited, contract)).not.toBe(await fingerprintOf(OPEN_BILLS, contract))
    })

    it('lỗi giữa chừng khi áp plan thì rollback, không commit', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-02-10' }
      const pool = reapprove(OPEN_BILLS, contract, [['UPDATE contract_bill SET deleted_at', () => { throw new Error('boom') }]])
      await expect(service.transition(pool, 9, 'approve', { expected_fingerprint: await fingerprintOf(OPEN_BILLS, contract) }, 5)).rejects.toThrow('boom')
      expect(pool.state).toEqual({ committed: false, rolledBack: true })
    })

    it('plan liệt kê bill sửa tay để hộp xác nhận nêu tên', async () => {
      const contract = { id: 9, start_date: '2027-01-01', end_date: '2027-02-10' }
      const pool = reapprove(OPEN_BILLS.map((b) => (b.seq === 3 ? { ...b, edited: 1 } : b)), contract)
      const plan = await service.billPlan(pool, 9)
      expect(plan.mode).toBe('CUT')
      expect(plan.remove).toEqual([expect.objectContaining({ code: 'TT-3', edited: true })])
      expect(plan.bills_range).toEqual({ start: '2027-01-01', end: '2027-03-31', count: 3 })
      expect(plan.contract_range).toEqual({ start: '2027-01-01', end: '2027-02-10' })
    })
  })

  it('xoá: chỉ hợp đồng nháp chưa từng có bill', async () => {
    const ok = fakePool([['UPDATE seafarer_contract SET deleted_at', () => [{ affectedRows: 1 }]]])
    await expect(service.softDelete(ok, 9)).resolves.toEqual({ success: true })
    const locked = fakePool([['UPDATE seafarer_contract SET deleted_at', () => [{ affectedRows: 0 }]], ['AS has_bills', () => [[{ status: 'ACTIVE', has_bills: false }]]]])
    await expect(service.softDelete(locked, 9)).rejects.toMatchObject({ statusCode: 409, message: 'Chỉ xoá được hợp đồng nháp' })
    const withBills = fakePool([['UPDATE seafarer_contract SET deleted_at', () => [{ affectedRows: 0 }]], ['AS has_bills', () => [[{ status: 'DRAFT', has_bills: true }]]]])
    await expect(service.softDelete(withBills, 9)).rejects.toMatchObject({ statusCode: 409, message: 'Hợp đồng đã có yêu cầu thanh toán, không xoá được' })
    const missing = fakePool([['UPDATE seafarer_contract SET deleted_at', () => [{ affectedRows: 0 }]]])
    await expect(service.softDelete(missing, 9)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('chi tiết trả chuyến mới, tóm tắt bill, cờ chờ duyệt lại, lệch ngày và balance theo budget của chuyến', async () => {
    const pool = fakePool([
      ['FROM seafarer_contract c\n  JOIN seafarer s', () => [[detailRow({ status: 'DRAFT', awaiting_reapproval: true, date_mismatch: true, trip_leave_date: '2027-06-01' })]]],
      ['FROM contract_item WHERE', () => [[
        { id: 1, kind: 'MONTHLY', item_code: 'BASIC_WAGE', custom_name: null, receivable_usd: '1900.00', payable_usd: '1650.00' },
        { id: 2, kind: 'MONTHLY', item_code: null, custom_name: 'Khác', receivable_usd: null, payable_usd: null },
      ]]],
      ['FROM contract_payment_term WHERE contract_id = ?', () => [[{ side: 'PAYABLE', closing_day: 31, pay_day: 15, pay_month_offset: 1, holiday_rule: 'BEFORE' }]]],
      ['FROM contract_approval_log', () => [[]]],
      ['BOOL_OR(status', () => [[billSummary({ n: '9', first_start: '2026-11-05', last_end: '2027-08-05', has_sent_or_paid: true })]]],
    ])
    const result = await service.get(pool, 9)
    expect(result.items[0]).toMatchObject({ name: 'Lương cơ bản', receivable_usd: 1900 })
    expect(result.terms.PAYABLE.pay_day).toBe(15)
    expect(result.contract.months).toBe(9)
    expect(result.contract).toMatchObject({ seafarer_voyage_id: 4, legacy_unlinked: false })
    expect(result.voyage).toMatchObject({ id: 4, code: 'CT-2026-0004', leave_date: '2027-06-01', vessel_name: 'MV A' })
    expect(result.legacy_voyage).toBeNull()
    expect(result.bills_summary).toEqual({ count: 9, first_start: '2026-11-05', last_end: '2027-08-05', has_sent_or_paid: true })
    expect(result.awaiting_reapproval).toBe(true)
    expect(result.date_mismatch).toEqual({ leave_date: '2027-06-01', end_date: '2027-08-05' })
    expect(result.balance).toMatchObject({ budgetMonthly: 1900, receivableMonthly: 1900, payableMonthly: 1650, diffMonthly: 250, diffContract: 2250, diffOk: true })
  })

  it('danh sách đếm theo trạng thái cho các tab', async () => {
    const pool = fakePool([
      ['GROUP BY c.status', () => [[{ status: 'DRAFT', n: '2' }, { status: 'ACTIVE', n: '5' }]]],
      ['ORDER BY c.created_at DESC', () => [[detailRow({ receivable_monthly: '1900', payable_monthly: '1650', awaiting_reapproval: true })]]],
    ])
    const result = await service.list(pool, { tab: 'ACTIVE', seafarer_voyage_id: 4 })
    expect(result.counts).toEqual({ all: 7, DRAFT: 2, PENDING: 0, REJECTED: 0, ACTIVE: 5, ENDED: 0 })
    expect(result.total).toBe(5)
    expect(result.data[0]).toMatchObject({ receivable_monthly: 1900, payable_monthly: 1650, diff_monthly: 250, awaiting_reapproval: true, trip: { code: 'CT-2026-0004' } })
    expect(pool.calls[0].sql).toContain('c.seafarer_voyage_id = ?')
  })
})
