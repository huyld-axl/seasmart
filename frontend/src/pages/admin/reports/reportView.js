import dayjs from 'dayjs'
import { formatUsd } from '../../../utils/format'

// Báo cáo tháng (docs/mcah-ke-hoach-bao-cao.md): hàm thuần cho trang Báo cáo. Cột lấy từ API (constants/reports.js ở backend).

export const REPORT_OPTIONS = [
  { value: 'base', label: 'Dữ liệu tổng hợp' },
  { value: 'sales', label: 'Phải thu theo đối tác' },
  { value: 'cost', label: 'Phải chi theo đối tác' },
  { value: 'cashflow', label: 'Lịch thu chi' },
]
export const isReportKey = (value) => REPORT_OPTIONS.some((option) => option.value === value)

// Bề rộng cột theo kiểu; hai cột dính của Dữ liệu tổng hợp có bề rộng riêng để tên nhóm dính ngay sau chúng.
const percent = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const WIDTH = { text: 170, date: 112, money: 124, int: 76, percent: 112 }
export const STICKY_WIDTH = { month: 84, contract_number: 150 }
export const columnWidth = (col) => STICKY_WIDTH[col.key] || (col.key === 'no' ? 60 : WIDTH[col.type] || 140)

export function formatCell(col, value) {
  if (value == null || value === '') return col.type === 'money' ? formatUsd(0, { fixed: true }) : '—'
  if (col.type === 'money') return formatUsd(value, { fixed: true })
  if (col.type === 'percent') return `${percent.format(Number(value))}%`
  if (col.type === 'date') return dayjs(value).format('DD/MM/YYYY')
  return String(value)
}

// Đường dẫn chi tiết của ô có link.
export function linkOf(col, row) {
  const ids = row._links || {}
  if (col.link === 'partner' && ids.ship_owner_id) return `/partners/${ids.ship_owner_id}`
  if (col.link === 'seafarer' && ids.seafarer_id) return `/seafarers/${ids.seafarer_id}`
  if (col.link === 'contract' && ids.contract_id) return `/contracts/${ids.contract_id}`
  return null
}

// Cột đang hiện: tắt "Hiện 14 khoản" thì bỏ cột khoản (chỉ trên màn hình; file Excel luôn đủ).
export const visibleColumns = (columns, showDetail) => columns.filter((col) => showDetail || !col.detail)

// Gom cột liền nhau cùng nhóm thành { group, columns }; cột dính đứng riêng ngoài nhóm để antd cố định được.
export function groupColumns(columns) {
  const out = []
  for (const col of columns) {
    const last = out.at(-1)
    if (col.group && !col.sticky && last?.group === col.group) last.columns.push(col)
    else out.push({ group: col.sticky ? null : col.group || null, columns: [col] })
  }
  return out
}

// Tổng bề rộng các cột dính: tên nhóm dính ngay sau chừng đó.
export const stickyWidth = (columns) => columns.filter((col) => col.sticky).reduce((total, col) => total + columnWidth(col), 0)

export const monthLabel = (month) => (month ? dayjs(`${month}-01`).format('MM/YYYY') : '')
export const fileName = (key, month) => (key === 'all' ? `MCAH_Bao-cao_${month}.xlsx` : `MCAH_Bao-cao_${key}_${month}.xlsx`)
