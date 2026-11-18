// Trang quản trị nội bộ của bên mình (docs/mcah-ke-hoach-desktop-gd2.md 2.1 mục 10; wireframe 4, 5 của
// docs/design/wireframes/tai-khoan-tu-tren-xuong.html): khách hàng (văn phòng + quản trị), mọi tài khoản, lượng dùng,
// khoá / mở khoá văn phòng hoặc tài khoản có lý do, nhật ký.
// Ở khu nội bộ /internal/admin (docs/mcah-ke-hoach-khu-noi-bo.md 5.2): sau Basic Auth, chỉ admin CLOUD_ADMIN_EMAIL đã qua
// mật khẩu + mã TOTP (routes/internal_login.js). Không có dữ liệu nghiệp vụ của
// khách. HTML thuần không script (CSP): tìm là form GET, xác nhận là trang riêng. POST chỉ nhận từ chính trang này
// (cookie SameSite=Lax + Sec-Fetch-Site; Origin không dùng được vì Referrer-Policy no-referrer làm nó thành "null").
const zlib = require('zlib')
const config = require('../config')
const pool = require('../db')
const accounts = require('../services/accounts')
const offices = require('../services/offices')
const { escapeHtml: e } = require('../util')
const { adminSession } = require('./internal_login')

// Gốc trang quản trị. nginx giữ nguyên tiền tố /internal khi chuyển vào nên route trong máy chủ = đường công khai.
const A = `${config.internalBase}/admin`

const CSS = `body{margin:0;font:14px/1.5 Inter,system-ui,sans-serif;background:#eef0f4;color:#2c2c2c}main{max-width:1100px;margin:24px auto;padding:0 16px;display:grid;gap:14px}
h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;background:#fff}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e5e6ea;vertical-align:top}
th{color:#707070;font-weight:500}.scroll{overflow-x:auto;background:#fff;border-radius:12px}.scroll table{min-width:820px}
.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:#e7e8ec;white-space:nowrap}.tag.err{background:#fef2f2;color:#c10007}.tag.ok{background:#ecfdf5;color:#007a55}.tag.warn{background:#fffbeb;color:#bb4d00}
button,.btn{font:inherit;border:1px solid #d3d5db;background:#fff;color:#2c2c2c;border-radius:999px;padding:6px 14px;cursor:pointer;text-decoration:none;display:inline-block}
.pri{background:#003366;border-color:#003366;color:#fff}.danger{background:#c10007;border-color:#c10007;color:#fff}
.tabs{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.tabs a{padding:6px 12px;border-radius:999px;color:#2c2c2c;text-decoration:none}.tabs a.on{background:#fff;font-weight:600;border:1px solid #e5e6ea}
.who{margin-left:auto;font-size:12px;color:#707070}.who a{color:#003366}.muted{color:#707070}.small{font-size:12px}.mono{font-family:ui-monospace,monospace;white-space:nowrap}
.card{background:#fff;border-radius:12px;padding:16px;display:grid;gap:12px}.row{display:flex;gap:8px;align-items:end;flex-wrap:wrap}
label{display:grid;gap:4px;font-size:13px;flex:1;min-width:200px}input,textarea{font:inherit;border:1px solid #d3d5db;border-radius:8px;padding:8px 10px}textarea{min-height:80px}
.field-err{color:#c10007;font-size:12px}.banner{padding:10px 12px;border-radius:8px;font-size:13px}.banner.err{background:#fef2f2;color:#c10007}.banner.warn{background:#fffbeb;color:#bb4d00}.banner.ok{background:#ecfdf5;color:#007a55}
.chips{display:flex;gap:6px;flex-wrap:wrap}.chips a{padding:4px 10px;border-radius:999px;font-size:12px;background:#fff;border:1px solid #e5e6ea;color:#2c2c2c;text-decoration:none}.chips a.on{background:#e7e8ec;font-weight:600}
.bigcode{font-family:ui-monospace,monospace;font-size:24px;letter-spacing:.06em;text-align:center;padding:14px;background:#e7e8ec;border-radius:8px;user-select:all}
.confirm{max-width:520px;margin:40px auto}.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.actions{white-space:nowrap}`

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

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '')
const fmtTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : '')
const html = (reply, body, code = 200) => reply.code(code).type('text/html; charset=utf-8').send(body)

const TABS = [['', 'Khách hàng'], ['/accounts', 'Tài khoản'], ['/bug-reports', 'Báo lỗi'], ['/audit-log', 'Nhật ký']]
function page(admin, tab, title, content) {
  const tabs = TABS.map(([p, label]) => `<a href="${A}${p}"${p === tab ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('')
    + `<a href="${config.internalBase}/design-system/" target="_blank" rel="noopener">Design system ↗</a>`
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Quản trị MCAH</title><style>${CSS}</style></head>
<body><main><nav class="tabs">${tabs}<span class="who">${e(admin.email)} · <a href="${config.internalBase}/logout">Đăng xuất</a></span></nav>${content}</main></body></html>`
}
const confirmPage = (title, content) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Quản trị MCAH</title><style>${CSS}</style></head>
<body><main class="confirm"><div class="card">${content}</div></main></body></html>`

// Form gửi từ trang khác: trình duyệt không gửi cookie SameSite=Lax với POST khác trang; thêm Sec-Fetch-Site cho chắc.
function sameSite(request) {
  const site = request.headers['sec-fetch-site']
  return !site || site === 'same-origin' || site === 'none'
}

const ACTIONS = {
  customer_create: 'Thêm khách hàng',
  office_admin_add: 'Thêm quản trị',
  member_create: 'Tạo tài khoản',
  office_machine_setup: 'Cài máy chính',
  office_lock: 'Khoá văn phòng',
  office_unlock: 'Mở khoá văn phòng',
  account_lock: 'Khoá tài khoản',
  account_unlock: 'Mở khoá tài khoản',
  // Đăng nhập khu nội bộ (routes/internal_login.js, scripts/admin.js).
  admin_login: 'Đăng nhập quản trị',
  admin_logout: 'Đăng xuất quản trị',
  admin_login_fail: 'Sai mật khẩu quản trị',
  admin_2fa_fail: 'Sai mã xác minh',
  admin_recovery_used: 'Dùng mã khôi phục',
  admin_2fa_enroll: 'Bật xác minh hai bước',
  admin_password_set: 'Đặt mật khẩu quản trị',
  admin_2fa_reset: 'Reset xác minh hai bước',
}
const FAILS = ['admin_login_fail', 'admin_2fa_fail']
// Nhật ký riêng một văn phòng (trang chi tiết): thêm các việc người trong văn phòng làm.
const OFFICE_ACTIONS = {
  ...ACTIONS,
  member_remove: 'Bỏ tài khoản khỏi văn phòng',
  office_machine_replace: 'Chuyển máy chính',
  login_google: 'Đăng nhập (Google)',
  login_email_code: 'Đăng nhập (mã email)',
}

// Trang chi tiết văn phòng: đường dẫn, và quay về trang đó sau khi khoá / thêm quản trị nếu đi từ đó.
const officeUrl = (id) => `${A}/customers/view?office=${encodeURIComponent(id)}`
const backTo = (id, fallback) => (/^[0-9a-f-]{36}$/.test(String(id || '')) ? officeUrl(id) : fallback)
const backField = (id) => (id ? `<input type="hidden" name="back" value="${e(id)}">` : '')

// Mọi thứ trang chi tiết cần về một văn phòng; null nếu không có.
async function officeDetail(id) {
  const { rows: [office] } = await pool.query(
    'SELECT o.*, cb.email AS created_by_email FROM office o LEFT JOIN account cb ON cb.id = o.created_by WHERE o.id = $1', [id])
  if (!office) return null
  const [members, machines, usage, log, stats] = await Promise.all([
    pool.query(`
      SELECT a.id, a.email, a.full_name, a.disabled_at, a.last_login_at, a.last_login_method, a.created_at,
        m.role, m.joined_at, m.removed_at, cb.email AS created_by_email
      FROM office_member m JOIN account a ON a.id = m.account_id LEFT JOIN account cb ON cb.id = a.created_by
      WHERE m.office_id = $1
      ORDER BY m.removed_at IS NOT NULL, m.role = 'member', a.email`, [id]),
    pool.query('SELECT registered_at, revoked_at, lan_name, lan_port, lan_updated_at, cert_fingerprint FROM office_machine WHERE office_id = $1 ORDER BY registered_at DESC', [id]),
    pool.query(`
      SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'MM/YYYY') AS month,
        date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS month_start,
        COALESCE(SUM(units) FILTER (WHERE kind = 'ai_page'), 0) AS ai_pages,
        COUNT(*) FILTER (WHERE kind = 'vessel_lookup') AS lookups,
        COUNT(*) FILTER (WHERE kind = 'catalog_search') AS searches,
        COALESCE(SUM(cost_usd), 0) AS cost
      FROM usage WHERE office_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY 1, 2 ORDER BY 2 DESC`, [id]),
    pool.query(`
      SELECT a.created_at, a.action, a.detail, a.ip, acc.email
      FROM audit a LEFT JOIN account acc ON acc.id = a.account_id
      WHERE a.office_id = $1 ORDER BY a.created_at DESC, a.id DESC LIMIT 100`, [id]),
    officeRows(''),
  ])
  return { office, members: members.rows, machines: machines.rows, usage: usage.rows, log: log.rows, stats: stats.find((o) => o.id === id) }
}

// Ô nhập có lỗi riêng (thiếu trường, email thuộc văn phòng khác…): báo dưới đúng ô.
const field = (label, name, values, errors, attrs = '') =>
  `<label>${label}<input name="${name}" value="${e(values[name] || '')}"${attrs}${errors[name] ? ' aria-invalid="true"' : ''}>${errors[name] ? `<span class="field-err">${e(errors[name])}</span>` : ''}</label>`
// Lỗi từ dịch vụ → { tên ô: câu báo }; lỗi không gắn ô thì để ở banner.
const fieldErrors = (error, map = {}) => (error.field ? { [map[error.field] || error.field]: error.message } : { _: error.message })
const clientError = (error) => error.statusCode && error.statusCode < 500

async function officeRows(q) {
  const { rows } = await pool.query(`
    SELECT o.id, o.name, o.note, o.locked_at, o.created_at,
      EXISTS (SELECT 1 FROM office_machine k WHERE k.office_id = o.id AND k.revoked_at IS NULL) AS has_machine,
      (SELECT string_agg(a.email, ', ' ORDER BY a.email) FROM office_member m JOIN account a ON a.id = m.account_id
        WHERE m.office_id = o.id AND m.role = 'admin' AND m.removed_at IS NULL) AS admins,
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
  const needle = String(q || '').trim().toLowerCase()
  return needle ? rows.filter((o) => [o.name, o.note, o.admins].some((v) => String(v || '').toLowerCase().includes(needle))) : rows
}

const officeStatus = (o) =>
  o.locked_at ? '<span class="tag err">Đã khoá</span>' : o.has_machine ? '<span class="tag ok">Đang dùng</span>' : '<span class="tag warn">Chờ cài máy chính</span>'

// Trạng thái tài khoản (wireframe 5): khoá > nội bộ Axalize > đã rời văn phòng > chưa đăng nhập > đang dùng.
function accountStatus(a) {
  if (a.disabled_at) return ['locked', '<span class="tag err">Đã khoá</span>']
  if (!a.office_id && a.email.toLowerCase() === config.adminEmail) return ['internal', '<span class="tag">Nội bộ Axalize</span>']
  if (!a.office_id) return ['left', `<span class="tag">${a.left_office ? 'Đã rời văn phòng' : 'Chưa vào văn phòng'}</span>`]
  if (!a.last_login_at) return ['never', '<span class="tag">Chưa đăng nhập</span>']
  return ['active', '<span class="tag ok">Đang dùng</span>']
}
const METHODS = { google: 'Google', email_code: 'Mã email' }

async function adminRoutes(fastify) {
  // Mọi trang / POST dưới /internal/admin: chưa có phiên quản trị (mật khẩu + mã) → trang đăng nhập quản trị.
  async function guard(request, reply) {
    const admin = await adminSession(request)
    if (!admin) {
      if (request.method === 'GET') return reply.redirect(`${config.internalBase}/login?${new URLSearchParams({ next: request.url })}`)
      return reply.code(403).send({ message: 'Không có quyền' })
    }
    if (request.method === 'POST' && !sameSite(request)) return reply.code(403).send({ message: 'Yêu cầu không hợp lệ' })
    request.admin = admin
  }
  const uuid = (v) => (/^[0-9a-f-]{36}$/.test(String(v || '')) ? String(v) : null)

  // ---- Khách hàng (wireframe 4) ----
  async function customersPage(admin, { q = '', values = {}, errors = {}, notice = '', recoveryLeft = null } = {}) {
    const rows = await officeRows(q)
    const locked = rows.filter((o) => o.locked_at).length
    const body = rows.map((o) => `<tr><td><b><a href="${officeUrl(o.id)}">${e(o.name)}</a></b>${o.note ? `<div class="muted small">${e(o.note)}</div>` : ''}</td>
      <td>${officeStatus(o)}</td><td>${e(o.admins || '—')}</td><td>${o.members}</td>
      <td>${warnings(o).map((w) => `<span class="tag warn">${e(w)}</span>`).join(' ') || '—'}</td>
      <td>${o.ai_pages} trang · ${Number(o.cost).toFixed(2)} USD</td><td>${o.lookups}</td><td>${e(fmtDate(o.created_at))}</td>
      <td class="actions"><a class="btn" href="${A}/customers/admins?office=${e(o.id)}">Thêm quản trị</a> <a class="btn" href="${A}/customers/lock?office=${e(o.id)}">${o.locked_at ? 'Mở khoá' : 'Khoá'}</a></td></tr>`).join('')
    return page(admin, '', 'Khách hàng', `
${recoveryLeft !== null ? `<div class="banner ${recoveryLeft <= 2 ? 'err' : 'warn'}">Bạn vừa vào bằng mã khôi phục. Còn <b>${recoveryLeft}</b> mã. Đã có điện thoại mới: nhờ người giữ server chạy reset-2fa để cài lại.</div>` : ''}
${notice ? `<div class="banner ok">${e(notice)}</div>` : ''}${errors._ ? `<div class="banner err">${e(errors._)}</div>` : ''}
<form method="post" action="${A}/customers" class="card" novalidate><b>Thêm khách hàng</b>
<div class="grid2">${field('Tên văn phòng *', 'name', values, errors, ' maxlength="200"')}${field('Ghi chú', 'note', values, errors, ' maxlength="500" placeholder="Tên công ty, số hợp đồng…"')}
${field('Email quản trị *', 'admin_email', values, errors, ' type="email" maxlength="200"')}${field('Họ tên quản trị *', 'admin_name', values, errors, ' maxlength="200"')}</div>
<div class="row" style="justify-content:flex-end"><button class="pri">Thêm khách hàng</button></div>
<p class="muted small" style="margin:0">Không gửi thư nào. Báo khách tải MCAH và đăng nhập bằng email quản trị (Google hoặc mã gửi qua email).</p></form>
<form method="get" action="${A}" class="row" style="align-items:center"><input name="q" value="${e(q)}" placeholder="Tìm văn phòng, ghi chú, email quản trị…" style="flex:1;max-width:360px" aria-label="Tìm khách hàng"><button>Tìm</button>
<span class="muted small">${rows.length} văn phòng · ${locked} đang khoá</span></form>
<div class="scroll"><table><tr><th>Văn phòng</th><th>Trạng thái</th><th>Quản trị</th><th>Tài khoản</th><th>Cảnh báo</th><th>Quét AI tháng này</th><th>Tra IMO</th><th>Tạo ngày</th><th></th></tr>
${body || '<tr><td colspan="9" class="muted">Chưa có khách hàng nào.</td></tr>'}</table></div>`)
  }

  fastify.get(A, { preHandler: guard }, async (request, reply) => html(reply, await customersPage(request.admin, { q: String(request.query.q || ''), recoveryLeft: /^\d+$/.test(String(request.query.recovery_left || '')) ? Number(request.query.recovery_left) : null })))

  fastify.post(`${A}/customers`, { preHandler: guard }, async (request, reply) => {
    const values = request.body || {}
    const errors = {}
    if (!String(values.name || '').trim()) errors.name = 'Nhập tên văn phòng'
    if (!String(values.admin_email || '').trim()) errors.admin_email = 'Nhập email quản trị'
    if (!String(values.admin_name || '').trim()) errors.admin_name = 'Nhập họ tên quản trị'
    if (Object.keys(errors).length) return html(reply, await customersPage(request.admin, { values, errors }), 400)
    try {
      const { office, admin } = await offices.createCustomer({ name: values.name, note: values.note, adminEmail: values.admin_email, adminName: values.admin_name, createdBy: request.admin.id, ip: request.ip })
      return html(reply, await customersPage(request.admin, { notice: `Đã thêm ${office.name}. Báo ${admin.email} tải MCAH và đăng nhập bằng email này.` }))
    } catch (error) {
      if (!clientError(error)) throw error
      return html(reply, await customersPage(request.admin, { values, errors: fieldErrors(error, { email: 'admin_email', full_name: 'admin_name' }) }), error.statusCode)
    }
  })

  // ---- Chi tiết một văn phòng: thông tin, máy chính, tài khoản, lượng dùng 6 tháng, nhật ký ----
  const memberStatus = (m) => {
    if (m.disabled_at) return '<span class="tag err">Đã khoá</span>'
    if (m.removed_at) return `<span class="tag">Đã rời ${e(fmtDate(m.removed_at))}</span>`
    if (!m.last_login_at) return '<span class="tag">Chưa đăng nhập</span>'
    return '<span class="tag ok">Đang dùng</span>'
  }

  function officePage(admin, { office, members, machines, usage, log, stats }) {
    const active = members.filter((m) => !m.removed_at)
    const machine = machines.find((m) => !m.revoked_at)
    const warns = stats ? warnings(stats) : []
    const memberRows = members.map((m) => `<tr><td>${e(m.email)}</td><td>${e(m.full_name || '')}</td>
      <td>${m.role === 'admin' ? 'Quản trị' : 'Nhân viên'}</td><td>${e(fmtDate(m.joined_at))}</td><td>${e(m.created_by_email || '—')}</td>
      <td>${m.last_login_at ? `${e(fmtTime(m.last_login_at))} · ${METHODS[m.last_login_method] || ''}` : '—'}</td><td>${memberStatus(m)}</td>
      <td><a class="btn" href="${A}/accounts/lock?account=${e(m.id)}&amp;back=${e(office.id)}">${m.disabled_at ? 'Mở khoá' : 'Khoá'}</a></td></tr>`).join('')
    const machineRows = machines.map((m) => `<tr><td>${m.revoked_at ? '<span class="tag">Đã thay</span>' : '<span class="tag ok">Đang dùng</span>'}</td>
      <td>${e(fmtTime(m.registered_at))}</td><td>${e(fmtTime(m.revoked_at) || '—')}</td>
      <td>${m.lan_name ? `${e(m.lan_name)}${m.lan_port ? `:${e(m.lan_port)}` : ''}` : '—'}${m.lan_updated_at ? `<div class="muted small">báo lúc ${e(fmtTime(m.lan_updated_at))}</div>` : ''}</td>
      <td class="mono small">${e(m.cert_fingerprint ? `${String(m.cert_fingerprint).slice(0, 16)}…` : '—')}</td></tr>`).join('')
    const usageRows = usage.map((u) => `<tr><td>${e(u.month)}</td><td>${u.ai_pages}</td><td>${u.lookups}</td><td>${u.searches}</td><td>${Number(u.cost).toFixed(2)} USD</td></tr>`).join('')
    const logRows = log.map((r) => {
      const label = OFFICE_ACTIONS[r.action] || r.action
      return `<tr><td>${e(fmtTime(r.created_at))}</td><td>${e(r.email || '—')}</td><td>${FAILS.includes(r.action) ? `<span class="tag err">${e(label)}</span>` : e(label)}</td><td>${e(r.detail || '—')}</td><td class="mono">${e(r.ip || '—')}</td></tr>`
    }).join('')
    return page(admin, '', office.name, `
<p class="small" style="margin:0"><a href="${A}">← Khách hàng</a></p>
<div class="card">
<div class="row" style="align-items:center"><h1 style="flex:1">${e(office.name)}</h1>${officeStatus({ ...office, has_machine: Boolean(machine) })}
<a class="btn" href="${A}/customers/admins?office=${e(office.id)}&amp;back=${e(office.id)}">Thêm quản trị</a> <a class="btn${office.locked_at ? '' : ' danger'}" href="${A}/customers/lock?office=${e(office.id)}&amp;back=${e(office.id)}">${office.locked_at ? 'Mở khoá' : 'Khoá văn phòng'}</a></div>
${office.note ? `<p style="margin:0">${e(office.note)}</p>` : ''}
<div class="grid2 small">
<div><span class="muted">Tạo ngày</span><br>${e(fmtTime(office.created_at))}${office.created_by_email ? ` · ${e(office.created_by_email)}` : ''}</div>
<div><span class="muted">Khoá từ</span><br>${office.locked_at ? e(fmtTime(office.locked_at)) : '—'}</div>
<div><span class="muted">Tài khoản đang có</span><br>${active.length} (${active.filter((m) => m.role === 'admin').length} quản trị)</div>
<div><span class="muted">Mã văn phòng</span><br><span class="mono">${e(office.id)}</span></div>
</div>
${warns.map((w) => `<div class="banner warn">${e(w)}</div>`).join('')}
</div>
<h1>Tài khoản</h1>
<div class="scroll"><table><tr><th>Email</th><th>Họ tên</th><th>Vai trò</th><th>Vào văn phòng</th><th>Người tạo</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th></th></tr>
${memberRows || '<tr><td colspan="8" class="muted">Chưa có tài khoản nào.</td></tr>'}</table></div>
<h1>Máy chính</h1>
<div class="scroll"><table><tr><th>Trạng thái</th><th>Cài lúc</th><th>Thay lúc</th><th>Tên trong mạng văn phòng</th><th>Dấu vân tay</th></tr>
${machineRows || '<tr><td colspan="5" class="muted">Chưa cài máy chính.</td></tr>'}</table></div>
<h1>Lượng dùng 6 tháng</h1>
<div class="scroll"><table><tr><th>Tháng</th><th>Quét AI (trang)</th><th>Tra IMO</th><th>Tìm danh mục tàu</th><th>Chi phí</th></tr>
${usageRows || '<tr><td colspan="5" class="muted">Chưa dùng.</td></tr>'}</table></div>
<h1>Nhật ký văn phòng</h1>
<div class="scroll"><table><tr><th>Lúc</th><th>Người làm</th><th>Việc</th><th>Chi tiết</th><th>IP</th></tr>
${logRows || '<tr><td colspan="5" class="muted">Chưa có thao tác nào.</td></tr>'}</table></div><p class="muted small" style="margin:0">100 dòng gần nhất.</p>`)
  }

  fastify.get(`${A}/customers/view`, { preHandler: guard }, async (request, reply) => {
    const detail = uuid(request.query.office) && (await officeDetail(request.query.office))
    if (!detail) return reply.redirect(`${A}`)
    return html(reply, officePage(request.admin, detail))
  })

  // Thêm quản trị cho văn phòng có sẵn (quản trị cũ nghỉ, mất email).
  function addAdminPage(office, values = {}, errors = {}, back = '') {
    return confirmPage('Thêm quản trị', `<h1>Thêm quản trị cho ${e(office.name)}</h1>
${errors._ ? `<div class="banner err">${e(errors._)}</div>` : ''}
<form method="post" action="${A}/customers/admins" style="display:grid;gap:12px" novalidate><input type="hidden" name="office" value="${e(office.id)}">${backField(back)}
${field('Email *', 'email', values, errors, ' type="email" maxlength="200"')}${field('Họ tên *', 'full_name', values, errors, ' maxlength="200"')}
<div class="row" style="justify-content:flex-end"><a class="btn" href="${e(backTo(back, A))}">Huỷ</a><button class="pri">Thêm quản trị</button></div></form>`)
  }

  fastify.get(`${A}/customers/admins`, { preHandler: guard }, async (request, reply) => {
    const office = uuid(request.query.office) && (await offices.get(request.query.office))
    if (!office) return reply.redirect(`${A}`)
    return html(reply, addAdminPage(office, {}, {}, uuid(request.query.back) || ''))
  })

  fastify.post(`${A}/customers/admins`, { preHandler: guard }, async (request, reply) => {
    const id = uuid(request.body?.office)
    const office = id && (await offices.get(id))
    if (!office) return reply.code(400).send({ message: 'Văn phòng không hợp lệ' })
    const values = request.body
    const errors = {}
    if (!String(values.email || '').trim()) errors.email = 'Nhập email'
    if (!String(values.full_name || '').trim()) errors.full_name = 'Nhập họ tên'
    if (Object.keys(errors).length) return html(reply, addAdminPage(office, values, errors, uuid(values.back) || ''), 400)
    try {
      await offices.addMember({ officeId: id, email: values.email, fullName: values.full_name, role: 'admin', createdBy: request.admin.id, action: 'office_admin_add', ip: request.ip })
    } catch (error) {
      if (!clientError(error)) throw error
      return html(reply, addAdminPage(office, values, fieldErrors(error), uuid(values.back) || ''), error.statusCode)
    }
    return reply.redirect(backTo(values.back, A))
  })

  // ---- Khoá văn phòng ----
  function lockPage(office, error = '', reason = '', back = '') {
    const lock = !office.locked_at
    return confirmPage(lock ? 'Khoá văn phòng' : 'Mở khoá văn phòng', `
<h1>${lock ? 'Khoá' : 'Mở khoá'} văn phòng ${e(office.name)}?</h1>
${lock
    ? '<p style="margin:0">Mọi máy của văn phòng sẽ không vào được MCAH (máy đang mở bị đưa ra trong vòng 1 giờ). Dữ liệu trên máy khách vẫn giữ nguyên; mở khoá là dùng tiếp.</p>'
    : '<p style="margin:0">Văn phòng dùng lại được: người dùng đăng nhập lại là vào làm việc tiếp.</p>'}
${error ? `<div class="banner err">${e(error)}</div>` : ''}
<form method="post" action="${A}/customers/lock" style="display:grid;gap:12px"><input type="hidden" name="office" value="${e(office.id)}">${backField(back)}<input type="hidden" name="lock" value="${lock ? '1' : '0'}">
${lock ? `<label>Lý do *<textarea name="reason" maxlength="500" required>${e(reason)}</textarea></label>` : ''}
<div class="row" style="justify-content:flex-end"><a class="btn" href="${e(backTo(back, A))}">Huỷ</a><button class="${lock ? 'danger' : 'pri'}">${lock ? 'Khoá' : 'Mở khoá'}</button></div></form>`)
  }

  fastify.get(`${A}/customers/lock`, { preHandler: guard }, async (request, reply) => {
    const office = uuid(request.query.office) && (await offices.get(request.query.office))
    if (!office) return reply.redirect(`${A}`)
    return html(reply, lockPage(office, '', '', uuid(request.query.back) || ''))
  })

  fastify.post(`${A}/customers/lock`, { preHandler: guard }, async (request, reply) => {
    const id = uuid(request.body?.office)
    const office = id && (await offices.get(id))
    if (!office) return reply.code(400).send({ message: 'Văn phòng không hợp lệ' })
    const lock = request.body?.lock === '1'
    const reason = String(request.body?.reason || '').trim().slice(0, 500)
    if (lock && !reason) return html(reply, lockPage(office, 'Nhập lý do khoá', '', uuid(request.body?.back) || ''), 400)
    await offices.setLocked(id, lock)
    await accounts.audit(request.admin.id, lock ? 'office_lock' : 'office_unlock', request.ip, id, pool, lock ? reason : null)
    return reply.redirect(backTo(request.body?.back, A))
  })

  // ---- Tài khoản (wireframe 5) ----
  const FILTERS = [['', 'Tất cả'], ['never', 'Chưa đăng nhập'], ['locked', 'Đã khoá']]

  async function accountRows() {
    const { rows } = await pool.query(`
      SELECT a.id, a.email, a.full_name, a.disabled_at, a.last_login_at, a.last_login_method, a.created_at,
        EXISTS (SELECT 1 FROM office_member x WHERE x.account_id = a.id AND x.removed_at IS NOT NULL) AS left_office,
        cb.email AS created_by_email, m.office_id, m.role, o.name AS office_name
      FROM account a LEFT JOIN account cb ON cb.id = a.created_by
      LEFT JOIN office_member m ON m.account_id = a.id AND m.removed_at IS NULL
      LEFT JOIN office o ON o.id = m.office_id
      ORDER BY a.created_at DESC`)
    return rows
  }

  fastify.get(`${A}/accounts`, { preHandler: guard }, async (request, reply) => {
    const q = String(request.query.q || '').trim().toLowerCase()
    const filter = FILTERS.some(([f]) => f && f === request.query.filter) ? request.query.filter : ''
    const all = await accountRows()
    const searched = q ? all.filter((a) => [a.email, a.full_name, a.office_name].some((v) => String(v || '').toLowerCase().includes(q))) : all
    const shown = filter ? searched.filter((a) => accountStatus(a)[0] === filter) : searched
    const chips = FILTERS.map(([f, label]) => {
      const n = f ? searched.filter((a) => accountStatus(a)[0] === f).length : searched.length
      const href = `${A}/accounts?${new URLSearchParams({ ...(q ? { q } : {}), ...(f ? { filter: f } : {}) })}`
      return `<a href="${e(href)}"${f === filter ? ' class="on"' : ''}>${label} ${n}</a>`
    }).join('')
    const body = shown.map((a) => `<tr><td>${e(a.email)}</td><td>${e(a.full_name || '')}</td>
      <td>${a.office_name ? `<a href="${officeUrl(a.office_id)}">${e(a.office_name)}</a> · ${a.role === 'admin' ? 'Quản trị' : 'Nhân viên'}` : '—'}</td><td>${e(a.created_by_email || '—')}</td>
      <td>${a.last_login_at ? `${e(fmtTime(a.last_login_at))} · ${METHODS[a.last_login_method] || ''}` : '—'}</td><td>${accountStatus(a)[1]}</td>
      <td><a class="btn" href="${A}/accounts/lock?account=${e(a.id)}">${a.disabled_at ? 'Mở khoá' : 'Khoá'}</a></td></tr>`).join('')
    return html(reply, page(request.admin, '/accounts', 'Tài khoản', `
<form method="get" action="${A}/accounts" class="row" style="align-items:center"><input name="q" value="${e(q)}" placeholder="Tìm email, họ tên, văn phòng…" style="flex:1;max-width:360px" aria-label="Tìm tài khoản">${filter ? `<input type="hidden" name="filter" value="${e(filter)}">` : ''}<button>Tìm</button></form>
<div class="chips">${chips}</div>
<div class="scroll"><table><tr><th>Email</th><th>Họ tên</th><th>Văn phòng · vai trò</th><th>Người tạo</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th></th></tr>
${body || '<tr><td colspan="7" class="muted">Không có tài khoản nào.</td></tr>'}</table></div>`))
  })

  function accountLockPage(account, error = '', back = '') {
    const lock = !account.disabled_at
    return confirmPage(lock ? 'Khoá tài khoản' : 'Mở khoá tài khoản', `
<h1>${lock ? 'Khoá' : 'Mở khoá'} tài khoản ${e(account.email)}?</h1>
${lock
    ? '<p style="margin:0">Người này không đăng nhập được nữa; máy đang mở bị đưa ra trong vòng 1 giờ.</p>'
    : '<p style="margin:0">Người này đăng nhập lại được (Google hoặc mã email).</p>'}
${error ? `<div class="banner err">${e(error)}</div>` : ''}
<form method="post" action="${A}/accounts/lock" style="display:grid;gap:12px"><input type="hidden" name="account" value="${e(account.id)}">${backField(back)}<input type="hidden" name="lock" value="${lock ? '1' : '0'}">
${lock ? '<label>Lý do *<textarea name="reason" maxlength="500" required></textarea></label>' : ''}
<div class="row" style="justify-content:flex-end"><a class="btn" href="${e(backTo(back, `${A}/accounts`))}">Huỷ</a><button class="${lock ? 'danger' : 'pri'}">${lock ? 'Khoá' : 'Mở khoá'}</button></div></form>`)
  }

  fastify.get(`${A}/accounts/lock`, { preHandler: guard }, async (request, reply) => {
    const account = uuid(request.query.account) && (await accounts.findById(request.query.account))
    if (!account) return reply.redirect(`${A}/accounts`)
    return html(reply, accountLockPage(account, '', uuid(request.query.back) || ''))
  })

  fastify.post(`${A}/accounts/lock`, { preHandler: guard }, async (request, reply) => {
    const id = uuid(request.body?.account)
    const account = id && (await accounts.findById(id))
    if (!account) return reply.code(400).send({ message: 'Tài khoản không hợp lệ' })
    const lock = request.body?.lock === '1'
    const reason = String(request.body?.reason || '').trim().slice(0, 500)
    if (lock && !reason) return html(reply, accountLockPage(account, 'Nhập lý do khoá', uuid(request.body?.back) || ''), 400)
    if (lock && account.id === request.admin.id) return html(reply, accountLockPage(account, 'Không tự khoá tài khoản đang dùng', uuid(request.body?.back) || ''), 400)
    await accounts.setDisabled(id, lock)
    const membership = await offices.membership(id)
    await accounts.audit(request.admin.id, lock ? 'account_lock' : 'account_unlock', request.ip, membership?.office_id || null, pool, lock ? `${account.email} · ${reason}` : account.email)
    return reply.redirect(backTo(request.body?.back, `${A}/accounts`))
  })

  // ---- Báo lỗi từ app (routes/bug_report.js) ----
  fastify.get(`${A}/bug-reports`, { preHandler: guard }, async (request, reply) => {
    const { rows } = await pool.query('SELECT id, received_at, error_code, app_version, platform, note, ip, length(bundle) AS size FROM bug_report ORDER BY received_at DESC, id DESC LIMIT 200')
    const body = rows.map((r) => `<tr><td>${e(fmtTime(r.received_at))}</td><td><span class="tag err">${e(r.error_code)}</span></td><td>${e(r.app_version)}</td><td>${e(r.platform)}</td><td>${e(r.note || '—')}</td><td class="mono">${e(r.ip || '—')}</td><td class="actions"><a class="btn" href="${A}/bug-reports/download?id=${r.id}">Tải về (${Math.ceil(r.size / 1024)} KB)</a></td></tr>`).join('')
    return html(reply, page(request.admin, '/bug-reports', 'Báo lỗi', `<div class="scroll"><table><tr><th>Lúc</th><th>Mã lỗi</th><th>Phiên bản</th><th>Hệ điều hành</th><th>Ghi chú của người dùng</th><th>IP</th><th></th></tr>
${body || '<tr><td colspan="7" class="muted">Chưa có báo lỗi nào.</td></tr>'}</table></div><p class="muted small" style="margin:0">200 báo lỗi gần nhất. Log đã ẩn email, số điện thoại, số giấy tờ ở máy khách.</p>`))
  })

  // Tải một báo lỗi thành tệp văn bản: thông tin máy rồi từng tệp log, dễ đọc / grep.
  fastify.get(`${A}/bug-reports/download`, { preHandler: guard }, async (request, reply) => {
    const id = String(request.query.id || '')
    if (!/^\d{1,12}$/.test(id)) return reply.code(404).send('Không có')
    const { rows } = await pool.query('SELECT bundle FROM bug_report WHERE id = $1', [id])
    if (!rows.length) return reply.code(404).send('Không có')
    const { meta, files } = JSON.parse(zlib.gunzipSync(rows[0].bundle).toString('utf8'))
    const text = [JSON.stringify(meta, null, 2), ...Object.entries(files).map(([name, content]) => `\n===== ${name} =====\n${content}`)].join('\n')
    return reply.header('Content-Disposition', `attachment; filename="mcah-bao-loi-${id}.txt"`).header('Cache-Control', 'no-store').type('text/plain; charset=utf-8').send(text)
  })

  // ---- Nhật ký ----
  fastify.get(`${A}/audit-log`, { preHandler: guard }, async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT a.created_at, a.action, a.detail, a.ip, acc.email, o.name AS office_name
       FROM audit a LEFT JOIN account acc ON acc.id = a.account_id LEFT JOIN office o ON o.id = a.office_id
       WHERE a.action = ANY($1) ORDER BY a.created_at DESC, a.id DESC LIMIT 200`,
      [Object.keys(ACTIONS)]
    )
    const body = rows.map((r) => {
      // Khoá: detail là lý do (khoá tài khoản: "email · lý do").
      let target = r.office_name || ''
      let reason = '—'
      if (r.action === 'office_lock') reason = r.detail || '—'
      else if (r.action === 'account_lock') {
        const [who, ...why] = String(r.detail || '').split(' · ')
        target = [who, r.office_name].filter(Boolean).join(' · ')
        reason = why.join(' · ') || '—'
      } else target = [r.office_name, r.detail].filter(Boolean).join(' · ')
      const action = FAILS.includes(r.action) ? `<span class="tag err">${ACTIONS[r.action]}</span>` : ACTIONS[r.action]
      return `<tr><td>${e(fmtTime(r.created_at))}</td><td>${e(r.email || '—')}</td><td>${action}</td><td>${e(target || '—')}</td><td>${e(reason)}</td><td class="mono">${e(r.ip || '—')}</td></tr>`
    }).join('')
    return html(reply, page(request.admin, '/audit-log', 'Nhật ký', `<div class="scroll"><table><tr><th>Lúc</th><th>Người làm</th><th>Việc</th><th>Đối tượng</th><th>Lý do</th><th>IP</th></tr>
${body || '<tr><td colspan="6" class="muted">Chưa có thao tác nào.</td></tr>'}</table></div><p class="muted small" style="margin:0">200 dòng gần nhất.</p>`))
  })
}

// Đường cũ /tai-khoan/quan-tri… (máy chủ thật: nginx trả 301 trước khi tới đây; giữ cho máy dev chạy không nginx).
const LEGACY = {
  '/quan-tri': '',
  '/quan-tri/khach/quan-tri': '/customers/admins',
  '/quan-tri/khoa': '/customers/lock',
  '/quan-tri/tai-khoan': '/accounts',
  '/quan-tri/tai-khoan/khoa': '/accounts/lock',
  '/quan-tri/nhat-ky': '/audit-log',
}
async function legacyAdminRoutes(fastify) {
  for (const [from, to] of Object.entries(LEGACY)) {
    fastify.get(from, async (request, reply) => {
      const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''
      return reply.code(301).redirect(`${A}${to}${query}`)
    })
  }
}

adminRoutes.warnings = warnings
adminRoutes.legacyAdminRoutes = legacyAdminRoutes
module.exports = adminRoutes
