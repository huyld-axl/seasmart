import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')
const { reportService: service } = require('../report.service')
const { reportWorkbook, reportFileName } = require('../../utils/report_xlsx')

// Bộ số mẫu của wireframe (docs/design/wireframes/bao-cao.html): 6 bill tháng 10/2026, 3 đối tác.
const OWNERS = { 1: 'Hải Âu Shipping', 2: 'Đông Á Marine', 3: 'Biển Xanh Co.' }
const BILLS = [
  { id: 101, c: 1, o: 1, s: 11, name: 'Nguyễn Hữu Phước', ps: '2026-10-15', pe: '2026-10-31', due: '2026-11-10', thu: { BASIC_WAGE: 1500, SERVICE_FEE: 150, OTHER_MONTHLY: 100, FLIGHT_OUT: 500 }, tra: { BASIC_WAGE: 1300, OTHER_MONTHLY: 80, FLIGHT_OUT: 500 } },
  { id: 102, c: 2, o: 1, s: 12, name: 'Trần Văn Bình', ps: '2026-10-01', pe: '2026-10-31', due: '2026-11-10', thu: { BASIC_WAGE: 2000, ALLOWANCE: 150, SERVICE_FEE: 150 }, tra: { BASIC_WAGE: 1750, ALLOWANCE: 150 }, paid: 9 },
  { id: 103, c: 3, o: 1, s: 13, name: 'Vũ Đức Anh', ps: '2026-10-01', pe: '2026-10-31', due: '2026-11-10', thu: { BASIC_WAGE: 3800, SERVICE_FEE: 400 }, tra: { BASIC_WAGE: 3500 } },
  { id: 104, c: 4, o: 2, s: 14, name: 'Lê Minh Tâm', ps: '2026-09-26', pe: '2026-10-25', due: '2026-11-05', thu: { BASIC_WAGE: 1400, SERVICE_FEE: 150 }, tra: { BASIC_WAGE: 1150 } },
  { id: 105, c: 5, o: 2, s: 15, name: 'Phạm Quốc Huy', ps: '2026-09-26', pe: '2026-10-25', due: '2026-11-05', thu: { BASIC_WAGE: 1100, SERVICE_FEE: 100 }, tra: { BASIC_WAGE: 950 }, paid: 10 },
  { id: 106, c: 6, o: 3, s: 16, name: 'Đỗ Thành Long', ps: '2026-10-20', pe: '2026-10-31', due: '2026-11-20', thu: { BASIC_WAGE: 2600, SERVICE_FEE: 200, FLIGHT_OUT: 400 }, tra: { BASIC_WAGE: 2300, FLIGHT_OUT: 400 } },
]

function fakePool() {
  const calls = []
  const routes = [
    ['LEFT JOIN seafarer_payout sp', () => [BILLS.map((b) => ({
      id: b.id, code: `CH-${b.c}/HĐ/T1`, seq: 1, status: 'SENT', contract_id: b.c, period_start: b.ps, period_end: b.pe, due_date: b.due,
      display_status: 'SENT', total_usd: String(Object.values(b.thu).reduce((s, v) => s + v, 0)), periods: '6', contract_number: `CH-${b.c}/HĐ`,
      seafarer_id: b.s, seafarer_name: b.name, rank_name: 'Thợ máy', vessel_id: b.o, vessel_name: `MV ${b.o}`, ship_owner_id: b.o, ship_owner_name: OWNERS[b.o], pic_id: 4, pic_name: 'Thu Hà', pic_is_active: 1,
      payout_id: b.paid || null, payout_version: b.paid ? 1 : null, payout_status: b.paid ? 'PAID' : null, paid_date: b.paid ? '2026-11-05' : null,
    }))]],
    ['FROM contract_bill_item WHERE bill_id IN', () => [BILLS.flatMap((b) => Object.entries(b.thu).map(([item_code, v]) => ({ bill_id: b.id, item_code, amount_usd: String(v) })))]],
    ["AND side = 'PAYABLE'", () => [BILLS.map((b) => ({ contract_id: b.c, pay_day: b.c === 6 ? 31 : 15, pay_month_offset: 1, holiday_rule: 'BEFORE' }))]],
    ['FROM contract_item WHERE contract_id IN', () => [BILLS.flatMap((b) => Object.entries(b.tra).map(([item_code, v]) => ({ contract_id: b.c, item_code, payable_usd: String(v) })))]],
    ['FROM seafarer_payout_item WHERE payout_id IN', () => [BILLS.filter((b) => b.paid).flatMap((b) => Object.entries(b.tra).map(([item_code, v]) => ({ payout_id: b.paid, item_code, amount_usd: String(v) })))]],
    ['FROM seafarer_contract c WHERE', () => [BILLS.map((b) => ({ id: b.c, start_date: '2026-10-01', end_date: '2027-03-31' }))]],
    ['FROM contract_payment_term WHERE contract_id IN', () => [BILLS.flatMap((b) => [
      { contract_id: b.c, side: 'RECEIVABLE', closing_day: b.o === 2 ? 25 : 31, pay_day: b.o === 2 ? 5 : 10, pay_month_offset: 1, holiday_rule: 'AFTER' },
      { contract_id: b.c, side: 'PAYABLE', closing_day: 31, pay_day: 15, pay_month_offset: 1, holiday_rule: 'BEFORE' },
    ])]],
    ['FROM contract_item ci', () => [BILLS.flatMap((b) => Object.keys({ ...b.thu, ...b.tra })
      .map((code) => ({ contract_id: b.c, item_code: code, receivable_usd: b.thu[code] ?? null, payable_usd: b.tra[code] ?? null })))]],
  ]
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params })
      const hit = routes.find(([needle]) => sql.includes(needle))
      return hit ? hit[1](sql, params) : [[]]
    },
  }
}

describe('report.service', () => {
  it('Phải thu theo đối tác: theo Tổng giảm dần, tỷ lệ đủ 100%', async () => {
    const r = await service.build(fakePool(), 'sales', { month: '2026-10' })
    expect(r.title).toBe('Phải thu theo đối tác')
    expect(r.rows.map((x) => [x.ship_owner_name, x.monthly, x.one_time, x.total, x.headcount, x.share])).toEqual([
      ['Hải Âu Shipping', 8250, 500, 8750, 3, 50],
      ['Biển Xanh Co.', 2800, 400, 3200, 1, 16.67],
      ['Đông Á Marine', 2750, 0, 2750, 2, 33.33],
    ])
    expect(r.rows[0]).toMatchObject({ no: 1, month: '10/2026' })
    expect(r.totals).toMatchObject({ monthly: 13800, one_time: 900, total: 14700, headcount: 6, share: 100, ship_owner_name: 'Tổng cộng' })
  })

  it('Phải chi theo đối tác: số Trả như bảng Trả lương', async () => {
    const r = await service.build(fakePool(), 'cost', { month: '2026-10' })
    expect(r.rows.map((x) => [x.ship_owner_name, x.monthly, x.one_time, x.total])).toEqual([
      ['Hải Âu Shipping', 6780, 500, 7280], ['Biển Xanh Co.', 2300, 400, 2700], ['Đông Á Marine', 2100, 0, 2100],
    ])
    expect(r.totals).toMatchObject({ total: 12080, headcount: 6 })
  })

  it('Lịch thu chi: sắp theo hạn thu, gộp ô theo ngày và theo đối tác, hạn trả', async () => {
    const r = await service.build(fakePool(), 'cashflow', { month: '2026-10' })
    expect(r.rows.map((x) => x.seafarer_name)).toEqual(['Lê Minh Tâm', 'Phạm Quốc Huy', 'Nguyễn Hữu Phước', 'Trần Văn Bình', 'Vũ Đức Anh', 'Đỗ Thành Long'])
    expect(r.rows.map((x) => x._span.day)).toEqual([2, 0, 3, 0, 0, 1])
    expect(r.rows.map((x) => x.day_total)).toEqual([2750, 2750, 8750, 8750, 8750, 3200])
    expect(r.rows[0]).toMatchObject({ receivable: 1550, payable: 1150, margin: 400, payable_due_date: '2026-11-13' })
    expect(r.rows[5].payable_due_date).toBe('2026-11-30')
    expect(r.totals).toMatchObject({ receivable: 14700, payable: 12080, margin: 2620, day_total: 14700, owner_total: 14700, due_date: 'Tổng' })
    expect(r.columns.some((c) => /trạng thái/i.test(c.label))).toBe(false)
  })

  it('Dữ liệu tổng hợp: thực tế từ bill / trả lương, dự kiến từ khoản tiền hợp đồng, lãi gộp dự kiến', async () => {
    const r = await service.build(fakePool(), 'base', { month: '2026-10' })
    expect(r.rows.map((x) => x.ship_owner_name)).toEqual(['Biển Xanh Co.', 'Đông Á Marine', 'Đông Á Marine', 'Hải Âu Shipping', 'Hải Âu Shipping', 'Hải Âu Shipping'])
    const phuoc = r.rows.find((x) => x.seafarer_name === 'Nguyễn Hữu Phước')
    expect(phuoc).toMatchObject({
      month: '10/2026', contract_number: 'CH-1/HĐ', pic_name: 'Thu Hà', contract_start: '2026-10-01',
      thu_BASIC_WAGE: 1500, thu_FLIGHT_OUT: 500, thu_VISA_FEE: 0, thu_monthly: 1750, thu_one_time: 500, thu_total: 2250,
      tra_BASIC_WAGE: 1300, tra_total: 1880, margin: 370,
      r_closing: 'Cuối tháng', r_pay: 'Ngày 10 tháng sau', r_holiday: 'Làm sau', p_pay: 'Ngày 15 tháng sau', p_holiday: 'Làm trước',
      ri_BASIC_WAGE: 1500, ri_FLIGHT_OUT: 500, ri_monthly: 1750, ri_one_time: 500, ri_total: 2250,
      pi_BASIC_WAGE: 1300, pi_FLIGHT_OUT: 500, pi_total: 1880,
      planned_margin: 370,
    })
    expect(r.rows.find((x) => x.seafarer_name === 'Lê Minh Tâm')).toMatchObject({ r_closing: 'Ngày 25', r_pay: 'Ngày 5 tháng sau' })
    expect(r.totals).toMatchObject({ thu_total: 14700, tra_total: 12080, margin: 2620, ri_total: 14700, pi_total: 12080, planned_margin: 2620, contract_number: 'Tổng · 6 dòng' })
  })

  it('tháng sai hoặc thiếu: bảng rỗng, không đọc DB', async () => {
    const pool = fakePool()
    for (const month of ['2026-13', undefined]) {
      const r = await service.build(pool, 'sales', { month })
      expect(r.rows).toEqual([])
      expect(r.totals.total).toBe(0)
    }
    expect(pool.calls).toHaveLength(0)
  })

  it('phạm vi chỉ của mình: lọc theo người tạo bill', async () => {
    const pool = fakePool()
    await service.build(pool, 'sales', { month: '2026-10', ownerId: 7 })
    expect(pool.calls[0].sql).toContain('b.created_by = ?')
    expect(pool.calls[0].params).toContain(7)
  })
})

describe('report_xlsx', () => {
  const read = async (buffer) => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    return wb
  }

  it('cả 4 báo cáo một file: 4 sheet, tiêu đề, dòng tổng, gộp ô, định dạng', async () => {
    const pool = fakePool()
    const reports = []
    for (const key of ['base', 'sales', 'cost', 'cashflow']) reports.push(await service.build(pool, key, { month: '2026-10' }))
    const wb = await read(await reportWorkbook(reports, { userName: 'Kế toán', now: new Date(2026, 10, 23, 9, 15) }))
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Du lieu tong hop', 'Phai thu', 'Phai chi', 'Lich thu chi'])

    const sales = wb.getWorksheet('Phai thu')
    expect(sales.getCell('A1').value).toBe('Phải thu theo đối tác')
    expect(sales.getCell('A2').value).toBe('Tháng 10/2026 · xuất 23/11/2026 09:15 bởi Kế toán · USD')
    expect(sales.getRow(4).values.slice(1)).toEqual(['STT', 'Tháng', 'Đối tác', 'Khoản hằng tháng', 'Khoản một lần', 'Tổng', 'Số thuyền viên', 'Tỷ lệ số người'])
    expect(sales.getCell('F5').value).toBe(8750)
    expect(sales.getCell('F5').numFmt).toBe('#,##0.00')
    expect(sales.getCell('H5').value).toBe(0.5)
    expect(sales.getCell('C8').value).toBe('Tổng cộng')
    expect(sales.getCell('F8').value).toBe(14700)

    const cash = wb.getWorksheet('Lich thu chi')
    expect(cash.getCell('C5').isMerged).toBe(true)
    expect(cash.getCell('C6').master.address).toBe('C5')
    expect(cash.getCell('C7').master.address).toBe('C7')
    expect(cash.getCell('C9').master.address).toBe('C7')
    expect(cash.getCell('B5').value).toEqual(new Date(Date.UTC(2026, 10, 5)))

    const base = wb.getWorksheet('Du lieu tong hop')
    expect(base.getRow(4).values.slice(1)).toHaveLength(86)
    expect(base.getCell('A3').value).toBe('Thông tin hợp đồng')
    expect(base.getCell('H3').master.address).toBe('A3')
    expect(base.getCell('I3').value).toBe('Yêu cầu thanh toán')
    // Lãi thực tế (cột 45) không thuộc nhóm: gộp hai dòng tiêu đề.
    expect(base.getRow(3).getCell(45).value).toBe('Lãi thực tế')
    expect(base.getRow(4).getCell(45).master.address).toBe(base.getRow(3).getCell(45).address)
    expect(base.getRow(3).getCell(86).value).toBe('Lãi gộp dự kiến')
    // Hai cột lãi làm nổi: chữ đậm màu xanh, không tô nền.
    expect(base.getRow(5).getCell(45).font).toMatchObject({ bold: true, color: { argb: 'FF007A55' } })
    expect(base.getRow(5).getCell(86).fill?.pattern ?? 'none').toBe('none')
    expect(base.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 4 })
    expect(base.getCell('B11').value).toBe('Tổng · 6 dòng')
  })

  it('tháng không có bill: vẫn có tiêu đề và dòng tổng 0', async () => {
    const empty = { query: async () => [[]] }
    const report = await service.build(empty, 'sales', { month: '2026-02' })
    const wb = await read(await reportWorkbook([report], { now: new Date(2026, 10, 23) }))
    const ws = wb.worksheets[0]
    expect(ws.getCell('C5').value).toBe('Tổng cộng')
    expect(ws.getCell('F5').value).toBe(0)
  })

  it('tên file', () => {
    expect(reportFileName('sales', '2026-10')).toBe('MCAH_Bao-cao_sales_2026-10.xlsx')
    expect(reportFileName('all', '2026-10')).toBe('MCAH_Bao-cao_2026-10.xlsx')
  })
})
