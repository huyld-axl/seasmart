import { describe, it, expect } from 'vitest'
import { formatCell, groupColumns, isReportKey, linkOf, stickyWidth, visibleColumns, fileName } from '../reportView'

const base = [
  { key: 'month', label: 'Tháng', group: 'Thông tin hợp đồng', type: 'text', sticky: true },
  { key: 'contract_number', label: 'Số hợp đồng', group: 'Thông tin hợp đồng', type: 'text', sticky: true, link: 'contract' },
  { key: 'vessel_name', label: 'Tàu', group: 'Thông tin hợp đồng', type: 'text' },
  { key: 'ship_owner_name', label: 'Đối tác', group: 'Thông tin hợp đồng', type: 'text' },
  { key: 'thu_BASIC_WAGE', label: 'Lương cơ bản', group: 'Thu', type: 'money', detail: true },
  { key: 'thu_total', label: 'Thu tổng', group: 'Thu', type: 'money' },
  { key: 'margin', label: 'Lãi thực tế', type: 'money' },
]

describe('reportView', () => {
  it('định dạng ô theo kiểu', () => {
    expect(formatCell({ type: 'money' }, 8750)).toBe('8.750,00')
    expect(formatCell({ type: 'money' }, null)).toBe('0,00')
    expect(formatCell({ type: 'percent' }, 33.3333)).toBe('33,33%')
    expect(formatCell({ type: 'date' }, '2026-11-05')).toBe('05/11/2026')
    expect(formatCell({ type: 'date' }, null)).toBe('—')
    expect(formatCell({ type: 'text' }, 'Cuối tháng')).toBe('Cuối tháng')
  })

  it('ẩn 14 khoản khi tắt công tắc', () => {
    expect(visibleColumns(base, false).map((c) => c.key)).not.toContain('thu_BASIC_WAGE')
    expect(visibleColumns(base, true)).toHaveLength(7)
  })

  it('gom nhóm: cột dính đứng riêng, cột cùng nhóm liền nhau gộp lại', () => {
    const groups = groupColumns(base)
    expect(groups.map((g) => [g.group, g.columns.map((c) => c.key)])).toEqual([
      [null, ['month']], [null, ['contract_number']],
      ['Thông tin hợp đồng', ['vessel_name', 'ship_owner_name']],
      ['Thu', ['thu_BASIC_WAGE', 'thu_total']],
      [null, ['margin']],
    ])
    expect(groupColumns([{ key: 'no', type: 'int' }, { key: 'total', type: 'money' }]).map((g) => g.group)).toEqual([null, null])
  })

  it('tên nhóm dính sau tổng bề rộng các cột dính', () => {
    expect(stickyWidth(base)).toBe(84 + 150)
    expect(stickyWidth([{ key: 'ship_owner_name', type: 'text', sticky: true }])).toBe(140)
  })

  it('link chi tiết', () => {
    const row = { _links: { contract_id: 4, seafarer_id: 9, ship_owner_id: 2 } }
    expect(linkOf({ link: 'contract' }, row)).toBe('/contracts/4')
    expect(linkOf({ link: 'seafarer' }, row)).toBe('/seafarers/9')
    expect(linkOf({ link: 'partner' }, row)).toBe('/partners/2')
    expect(linkOf({}, row)).toBeNull()
  })

  it('khoá báo cáo và tên file', () => {
    expect(isReportKey('cashflow')).toBe(true)
    expect(isReportKey('abc')).toBe(false)
    expect(fileName('sales', '2026-10')).toBe('MCAH_Bao-cao_sales_2026-10.xlsx')
    expect(fileName('all', '2026-10')).toBe('MCAH_Bao-cao_2026-10.xlsx')
  })
})
