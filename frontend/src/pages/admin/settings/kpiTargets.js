// Hàm thuần cho màn Mục tiêu tháng.

// Ô đổi so với bản đã lưu (null và ô trống coi như nhau).
const same = (a, b) => (a ?? null) === (b ?? null)
export function changedCells(original, draft) {
  const out = []
  for (const row of draft) {
    const base = original.find((r) => r.user_id === row.user_id) || {}
    if (!same(base.contracts, row.contracts)) out.push(`${row.user_id}:contracts`)
    if (!same(base.revenue_usd, row.revenue_usd)) out.push(`${row.user_id}:revenue_usd`)
  }
  return out
}

// Chỉ gửi dòng có ô đổi.
export function changedRows(original, draft) {
  const cells = new Set(changedCells(original, draft).map((c) => Number(c.split(':')[0])))
  return draft.filter((r) => cells.has(r.user_id)).map(({ user_id, contracts, revenue_usd }) => ({ user_id, contracts: contracts ?? null, revenue_usd: revenue_usd ?? null }))
}

// Lỗi từng ô: số hợp đồng nguyên ≥ 0; doanh thu ≥ 0, tối đa 2 chữ số thập phân.
export function cellErrors(draft) {
  const errors = {}
  for (const r of draft) {
    if (r.contracts != null && (!Number.isInteger(r.contracts) || r.contracts < 0)) errors[`${r.user_id}:contracts`] = 'Số nguyên từ 0'
    if (r.revenue_usd != null && (r.revenue_usd < 0 || Math.abs(Math.round(r.revenue_usd * 100) - r.revenue_usd * 100) > 1e-6)) errors[`${r.user_id}:revenue_usd`] = 'Tối đa 2 số lẻ'
  }
  return errors
}

// Tổng công ty: chưa ai đặt ô đó thì null.
export function totals(rows) {
  const sum = (field) => { const v = rows.map((r) => r[field]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) : null }
  return { contracts: sum('contracts'), revenue_usd: sum('revenue_usd'), done: rows.reduce((s, r) => s + (r.done || 0), 0), revenue: rows.reduce((s, r) => s + (r.revenue || 0), 0) }
}

export const prevMonth = (month) => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
