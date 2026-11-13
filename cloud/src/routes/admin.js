// Trang quản trị nội bộ của bên mình (wireframe 8; docs/mcah-ke-hoach-desktop-gd2.md 2.1 mục 10): văn phòng, số thành
// viên, lượng dùng tháng này, khoá / mở khoá văn phòng. Chỉ tài khoản có email trong CLOUD_ADMIN_EMAILS (đăng nhập ở
// /dang-nhap như mọi người). Không có dữ liệu nghiệp vụ của khách. POST từ form cùng trang (cookie SameSite=Lax).
const config = require('../config')
const pool = require('../db')
const accounts = require('../services/accounts')
const offices = require('../services/offices')
const { escapeHtml: e } = require('../util')

const B = config.basePath

const CSS = `body{margin:0;font:14px/1.5 Inter,system-ui,sans-serif;background:#eef0f4;color:#2c2c2c}main{max-width:1100px;margin:24px auto;padding:0 16px}
h1{font-size:20px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e5e6ea}
th{color:#707070;font-weight:500}.tag{padding:2px 8px;border-radius:999px;font-size:12px;background:#fef2f2;color:#c10007}button{font:inherit;border:1px solid #d3d5db;background:#fff;border-radius:999px;padding:4px 12px;cursor:pointer}`

// Dùng bất thường (docs/mcah-ke-hoach-desktop-gd5.md 3.7, lớp L6): chỉ hiển thị cho bên mình xem, không tự khoá.
// 24 giờ qua gấp SPIKE lần trung bình ngày của 30 ngày trước đó và vượt MIN; đổi máy chính quá MOVES lần trong 30 ngày.
const SPIKE = 5
const MIN = 50
const MOVES = 2
function warnings(o) {
  const out = []
  const spike = (day, avg) => Number(day) > MIN && Number(day) > SPIKE * Number(avg)
  if (spike(o.ai_day, o.ai_avg)) out.push(`Quét AI tăng vọt: ${o.ai_day} trang / 24 giờ`)
  if (spike(o.lookup_day, o.lookup_avg)) out.push(`Tra tàu tăng vọt: ${o.lookup_day} lượt / 24 giờ`)
  if (Number(o.machine_moves) > MOVES) out.push(`Đổi máy chính ${o.machine_moves} lần / 30 ngày`)
  return out
}

async function adminAccount(request) {
  const raw = request.cookies.mcah_s
  if (!raw) return null
  const { valid, value } = request.unsignCookie(raw)
  if (!valid) return null
  let s
  try {
    s = JSON.parse(value)
  } catch {
    return null
  }
  const account = s?.a ? await accounts.findById(s.a) : null
  return account && config.adminEmails.includes(account.email.toLowerCase()) ? account : null
}

async function adminRoutes(fastify) {
  fastify.get('/quan-tri', async (request, reply) => {
    const admin = await adminAccount(request)
    if (!admin) return reply.redirect(`${config.basePath}/dang-nhap`)
    const { rows } = await pool.query(`
      SELECT o.id, o.name, o.locked_at, o.created_at,
        (SELECT COUNT(*) FROM office_member m WHERE m.office_id = o.id AND m.removed_at IS NULL) AS members,
        (SELECT COALESCE(SUM(units), 0) FROM usage u WHERE u.office_id = o.id AND u.kind = 'ai_page' AND u.created_at >= date_trunc('month', NOW())) AS ai_pages,
        (SELECT COALESCE(SUM(cost_usd), 0) FROM usage u WHERE u.office_id = o.id AND u.created_at >= date_trunc('month', NOW())) AS cost,
        (SELECT COUNT(*) FROM usage u WHERE u.office_id = o.id AND u.kind = 'vessel_lookup' AND u.created_at >= date_trunc('month', NOW())) AS lookups,
        (SELECT COALESCE(SUM(units), 0) FROM usage u WHERE u.office_id = o.id AND u.kind = 'ai_page' AND u.created_at >= NOW() - INTERVAL '1 day') AS ai_day,
        (SELECT COALESCE(SUM(units), 0) / 30.0 FROM usage u WHERE u.office_id = o.id AND u.kind = 'ai_page' AND u.created_at >= NOW() - INTERVAL '31 days' AND u.created_at < NOW() - INTERVAL '1 day') AS ai_avg,
        (SELECT COUNT(*) FROM usage u WHERE u.office_id = o.id AND u.kind = 'vessel_lookup' AND u.created_at >= NOW() - INTERVAL '1 day') AS lookup_day,
        (SELECT COUNT(*) / 30.0 FROM usage u WHERE u.office_id = o.id AND u.kind = 'vessel_lookup' AND u.created_at >= NOW() - INTERVAL '31 days' AND u.created_at < NOW() - INTERVAL '1 day') AS lookup_avg,
        (SELECT COUNT(*) FROM audit a WHERE a.office_id = o.id AND a.action = 'office_machine_replace' AND a.created_at >= NOW() - INTERVAL '30 days') AS machine_moves
      FROM office o ORDER BY o.created_at DESC`)
    const body = rows.map((o) => `<tr><td>${e(o.name)}${o.locked_at ? ' <span class="tag">Đã khoá</span>' : ''}</td><td>${e(warnings(o).join(' · ') || '—')}</td><td>${o.members}</td>
      <td>${o.ai_pages} trang · ${Number(o.cost).toFixed(2)} USD</td><td>${o.lookups}</td><td>${e(new Date(o.created_at).toLocaleDateString('vi-VN'))}</td>
      <td><form method="post" action="${B}/quan-tri/khoa"><input type="hidden" name="office" value="${e(o.id)}"><input type="hidden" name="lock" value="${o.locked_at ? '0' : '1'}"><button>${o.locked_at ? 'Mở khoá' : 'Khoá'}</button></form></td></tr>`).join('')
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Quản trị MCAH</title><style>${CSS}</style></head>
<body><main><h1>Văn phòng</h1><table><tr><th>Văn phòng</th><th>Cảnh báo</th><th>Thành viên</th><th>Quét AI tháng này</th><th>Tra IMO</th><th>Tạo ngày</th><th></th></tr>${body}</table></main></body></html>`)
  })

  fastify.post('/quan-tri/khoa', async (request, reply) => {
    const admin = await adminAccount(request)
    if (!admin) return reply.code(403).send({ message: 'Không có quyền' })
    const officeId = String(request.body?.office || '')
    if (!/^[0-9a-f-]{36}$/.test(officeId)) return reply.code(400).send({ message: 'Văn phòng không hợp lệ' })
    await offices.setLocked(officeId, request.body?.lock === '1')
    await accounts.audit(admin.id, request.body?.lock === '1' ? 'office_lock' : 'office_unlock', request.ip, officeId)
    return reply.redirect(`${config.basePath}/quan-tri`)
  })
}

adminRoutes.warnings = warnings
module.exports = adminRoutes
