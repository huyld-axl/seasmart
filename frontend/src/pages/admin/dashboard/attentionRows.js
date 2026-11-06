import { STATUS } from '../../../components/ds/statusMap'

// Hàm thuần cho màn Tổng quan: dòng API → dòng hiển thị { key, main, sub, days, late, text, to }.

const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
const shortRank = (rank) => (rank || '').replace(/\s*\(.*\)$/, '')
const usd = (n) => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })
// USD gọn trên biểu đồ: 26.900 → 26,9k.
export const usdShort = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k` : usd(n))
export { usd }

export const opportunityRow = (o) => ({
  key: `o${o.id}`,
  main: `${shortRank(o.rank_name)} · ${o.vessel_name || 'Chưa rõ tàu'}`,
  sub: [`Hạn chốt ${dm(o.deadline)}`, STATUS.opportunity[o.display_status]?.label, o.ship_owner_name].filter(Boolean).join(' · '),
  days: o.days, late: o.late, to: `/opportunities/${o.id}`,
})

const tripText = (trip) => (!trip ? 'ở bờ' : `${trip.where === 'UPCOMING' ? 'sắp lên' : 'đang trên'} ${trip.vessel_name}`)
export const certificateRow = (c) => ({
  key: `c${c.id}`,
  main: `${c.seafarer_name} · ${c.certificate_name}`,
  sub: [`Hết hạn ${dm(c.expiry_date)}`, tripText(c.trip), c.rank_name].filter(Boolean).join(' · '),
  days: c.days, late: c.late, to: `/seafarers/${c.seafarer_id}?tab=docs`,
})

export const scheduleRow = (v) => ({
  key: `v${v.voyage_id}${v.kind}`,
  main: `${v.seafarer_name} · ${shortRank(v.rank_name)}`,
  sub: v.kind === 'JOIN'
    ? [`Xuống tàu ${dm(v.date)}`, v.vessel_name, v.port_name].filter(Boolean).join(' · ')
    : [`Rời tàu dự kiến ${dm(v.date)}`, v.vessel_name, v.late ? 'chưa ghi rời tàu' : v.port_name].filter(Boolean).join(' · '),
  days: v.days, late: v.late, to: `/voyages/${v.voyage_id}`,
})

const WORK_TEXT = {
  BILL_OVERDUE: (r) => ['Yêu cầu thanh toán quá hạn', `${usd(r.amount_usd)} USD chưa về`],
  CONTRACT_REJECTED: (r, own) => [own ? 'Hợp đồng bị từ chối, cần sửa' : 'Hợp đồng bị từ chối', 'Sửa theo lý do rồi xin duyệt lại'],
  CONTRACT_PENDING: (r, own) => [own ? 'Hợp đồng đang chờ duyệt' : 'Hợp đồng chờ duyệt', own ? 'Chờ người duyệt' : 'Mở để duyệt hoặc từ chối'],
  CONTRACT_DRAFT: () => ['Hợp đồng nháp chưa xin duyệt', 'Điền đủ rồi bấm Xin duyệt'],
  BILL_TO_APPROVE: () => ['Yêu cầu thanh toán cần duyệt', 'Đã qua ngày chốt sổ'],
  BILL_TO_SEND: () => ['Yêu cầu thanh toán cần gửi', 'Đã duyệt, chưa gửi chủ tàu'],
}
export const workRow = (own) => (w) => {
  const [main, sub] = (WORK_TEXT[w.key] || (() => [w.key, '']))(w, own)
  return { key: w.key, main, sub, late: w.late, text: `${w.n} việc`, to: w.link }
}

// Các tab theo thứ tự hiện; chỉ tab API trả về (có quyền).
export function attentionTabs(tabs, own) {
  const defs = [
    ['opportunities', 'Hạn chốt cơ hội', opportunityRow, '/opportunities', 'Mở Cơ hội'],
    ['certificates', 'Chứng chỉ', certificateRow, '/seafarers', 'Mở Thuyền viên'],
    ['schedule', 'Xuống / rời tàu', scheduleRow, '/voyages', 'Mở Chuyến tàu'],
    ['work', own ? 'Việc của bạn' : 'Chờ xử lý', workRow(own), '/contracts', 'Mở Hợp đồng'],
  ]
  return defs.filter(([key]) => tabs?.[key]).map(([key, label, toRow, link, linkLabel]) => {
    const t = tabs[key]
    return { key, label, error: Boolean(t.error), count: t.count ?? 0, late: t.late ?? 0, rows: (t.rows || []).map(toRow), link, linkLabel }
  })
}

// Tab mở sẵn: tab đầu tiên có việc quá hạn, không có thì tab đầu tiên.
export const defaultTab = (list) => (list.find((t) => t.late > 0) || list[0])?.key ?? null

// Nhãn trục tháng: T6, T7… tháng đang chạy là "Tháng này" (điện thoại dùng nhãn ngắn T11, cột gạch chéo đã báo là dự kiến).
export const monthBars = (months, currentIsRunning) =>
  months.map((m, i) => {
    const running = currentIsRunning && i === months.length - 1
    const short = `T${Number(m.month.slice(5, 7))}`
    return { key: m.month, label: running ? 'Tháng này' : short, short: running ? short : undefined, value: m.value, projected: running }
  })
