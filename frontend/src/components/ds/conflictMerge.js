import dayjs from 'dayjs'

// Chống ghi đè (docs/mcah-ke-hoach-desktop-gd3.md 3.4): so ba bản của form — lúc mở (base), mình đang nhập (mine),
// bản mới nhất trên máy chủ (theirs) — để biết ô nào người kia đổi, ô nào mình đổi, ô nào cả hai cùng đổi.
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function conflictRows({ base, mine, theirs, keys }) {
  const all = keys || [...new Set([...Object.keys(base || {}), ...Object.keys(mine || {}), ...Object.keys(theirs || {})])]
  const rows = []
  for (const key of all) {
    const mineChanged = !same(mine?.[key], base?.[key])
    const theirsChanged = !same(theirs?.[key], base?.[key])
    if (!mineChanged && !theirsChanged) continue
    // Hai bên đổi về cùng một giá trị: không còn gì để chọn.
    if (mineChanged && theirsChanged && same(mine?.[key], theirs?.[key])) continue
    rows.push({ key, kind: mineChanged && theirsChanged ? 'both' : mineChanged ? 'mine' : 'theirs', mine: mine?.[key], theirs: theirs?.[key] })
  }
  return rows
}

// Giá trị đặt lại vào form sau khi lấy bản mới: ô mình đổi giữ phần của mình; ô cả hai cùng đổi theo lựa chọn.
export function keptValues(rows, choices = {}) {
  return Object.fromEntries(rows.filter((row) => row.kind === 'mine' || (row.kind === 'both' && choices[row.key] !== 'theirs')).map((row) => [row.key, row.mine]))
}

export const conflictTitle = (by, at) => `Hồ sơ vừa được ${by || 'người khác'} sửa${at ? ` lúc ${dayjs(at).format('HH:mm DD/MM')}` : ''}`
