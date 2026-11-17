// Đăng nhập khu nội bộ /internal (docs/mcah-ke-hoach-khu-noi-bo.md 5.3; wireframe docs/design/wireframes/khu-noi-bo.html
// màn 2–7). Nằm sau Basic Auth của nginx. Một admin: email + mật khẩu → mã TOTP (lần đầu: quét QR, nhận mã khôi phục).
// Cookie ký, path=/internal, SameSite=Strict: mcah_admin = phiên (tài khoản, lúc vào, auth_version; 8 giờ),
// mcah_admin_step = đã qua mật khẩu, chờ mã (5 phút). HTML thuần không script (CSP); QR là SVG dựng sẵn.
const QRCode = require('qrcode')
const config = require('../config')
const accounts = require('../services/accounts')
const adminAuth = require('../services/admin_auth')
const totp = require('../services/totp')
const { escapeHtml: e } = require('../util')

const I = config.internalBase
const SESSION_HOURS = 8
const STEP_MIN = 5
const html = (reply, body, code = 200) => reply.code(code).type('text/html; charset=utf-8').send(body)
const cookieOpts = (maxAgeSec) => ({ path: I, httpOnly: true, sameSite: 'strict', secure: config.secureCookies, signed: true, maxAge: maxAgeSec })

function readCookie(request, name) {
  const raw = request.cookies[name]
  if (!raw) return null
  const { valid, value } = request.unsignCookie(raw)
  if (!valid) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
const setCookie = (reply, name, value, maxAgeSec) => reply.setCookie(name, JSON.stringify(value), cookieOpts(maxAgeSec))
const clearCookie = (reply, name) => reply.clearCookie(name, { path: I })

// Chỉ quay về trang dưới /internal/ (không cho ?next= dẫn ra ngoài).
const safeNext = (next) => {
  const v = String(next || '')
  return v.startsWith(`${I}/`) && !v.startsWith('//') && !v.includes('..') && /^[\w\-./?=&%#]*$/.test(v) ? v : `${I}/admin`
}

// Cookie còn hạn, đúng admin hiện tại, đúng auth_version (đặt mật khẩu / reset 2FA làm mọi phiên cũ hết hiệu lực).
async function fromCookie(request, name, maxAgeMs) {
  const c = readCookie(request, name)
  if (!c?.a || !c.t || Date.now() - c.t > maxAgeMs) return null
  const admin = await adminAuth.current()
  if (!admin || admin.account.id !== c.a || admin.auth.auth_version !== c.v) return null
  return { ...admin, cookie: c }
}

// Phiên quản trị đã qua cả mật khẩu lẫn mã. Dùng cho admin.js và /internal/_check (auth_request của nginx).
async function adminSession(request) {
  const s = await fromCookie(request, 'mcah_admin', SESSION_HOURS * 3600 * 1000)
  return s && adminAuth.enrolled(s.auth) ? s.account : null
}

function sameSite(request) {
  const site = request.headers['sec-fetch-site']
  return !site || site === 'same-origin' || site === 'none'
}

const CSS = `:root{color-scheme:light;--primary:#003366;--bg:#eef0f4;--surface:#fff;--fg:#2c2c2c;--muted:#707070;--border:#d3d5db;--secondary:#e7e8ec;--err:#c10007;--err-bg:#fef2f2;--ok:#007a55;--ok-bg:#ecfdf5;--warn:#bb4d00;--warn-bg:#fffbeb}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 Inter,system-ui,'Segoe UI',sans-serif;padding:16px}
main{width:min(420px,100%);background:var(--surface);border-radius:16px;padding:28px;display:grid;gap:14px}main.wide{width:min(540px,100%)}
.brand{display:flex;gap:8px;align-items:center;font-weight:700}.brand span{font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:var(--secondary);color:var(--muted)}
h1{margin:0;font-size:20px}p{margin:0}.muted{color:var(--muted);font-size:14px}.small{font-size:12px}
.steps{display:flex;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--muted)}.steps span{padding:2px 8px;border-radius:999px;background:var(--secondary)}.steps .on{background:var(--primary);color:#fff}.steps .done{background:var(--ok-bg);color:var(--ok)}
label{display:grid;gap:4px;font-size:14px}input{font:inherit;padding:10px 12px;border:1px solid var(--border);border-radius:8px;width:100%;min-height:44px}
input.otp{font:600 24px/1.2 ui-monospace,monospace;letter-spacing:.3em;text-align:center}
input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
button,.btn{font:inherit;font-weight:600;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:999px;padding:10px 16px;min-height:44px;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center}
button.pri,.btn.pri{background:var(--primary);border-color:var(--primary);color:#fff}
.row{display:flex;justify-content:space-between;gap:8px;font-size:14px;flex-wrap:wrap}a{color:var(--primary)}
.msg{padding:10px 12px;border-radius:8px;font-size:14px}.err{background:var(--err-bg);color:var(--err)}.ok{background:var(--ok-bg);color:var(--ok)}.info{background:#eff6ff;color:#1d4ed8}
.field-err{color:var(--err);font-size:13px}
.qrwrap{display:grid;grid-template-columns:176px minmax(0,1fr);gap:16px;align-items:start}.qr svg{width:176px;height:176px;display:block;border:1px solid #e5e6ea;border-radius:8px}
.secret{font:13px/1.5 ui-monospace,monospace;letter-spacing:.08em;background:var(--secondary);padding:8px 10px;border-radius:8px;word-break:break-all;user-select:all}
.codes{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font:15px ui-monospace,monospace;text-align:center;user-select:all}.codes span{padding:8px;background:var(--secondary);border-radius:8px}
@media (max-width:480px){.qrwrap{grid-template-columns:1fr}}`

const layout = (title, body, wide = false) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${e(title)} · MCAH nội bộ</title><style>${CSS}</style></head><body><main${wide ? ' class="wide"' : ''}><div class="brand">MCAH <span>Nội bộ</span></div>${body}</main></body></html>`
const notice = (kind, text) => (text ? `<div class="msg ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${e(text)}</div>` : '')
const steps = (items) => `<div class="steps">${items.map(([label, state]) => `<span class="${state}">${state === 'done' ? '✓ ' : ''}${e(label)}</span>`).join('')}</div>`
const nextInput = (next) => `<input type="hidden" name="next" value="${e(safeNext(next))}">`

const LOCKED = 'Sai quá nhiều lần. Thử lại sau 15 phút.'
const WRONG_LOGIN = 'Email hoặc mật khẩu không đúng.'

const loginPage = ({ email = '', next = '', error = '', errors = {} } = {}) => layout('Đăng nhập quản trị', `
<h1>Đăng nhập quản trị</h1>${steps([['1 Mật khẩu', 'on'], ['2 Mã xác minh', '']])}${notice('err', error)}
<form method="post" action="${I}/login" style="display:grid;gap:12px" novalidate>${nextInput(next)}
<label>Email<input name="email" type="email" autocomplete="username" value="${e(email)}"${email ? '' : ' autofocus'}>${errors.email ? `<span class="field-err">${e(errors.email)}</span>` : ''}</label>
<label>Mật khẩu<input name="password" type="password" autocomplete="current-password"${email ? ' autofocus' : ''}>${errors.password ? `<span class="field-err">${e(errors.password)}</span>` : ''}</label>
<button class="pri">Tiếp tục</button></form>
<p class="muted small">Quên mật khẩu: đặt lại bằng lệnh trên server (người giữ server làm).</p>`)

const verifyPage = ({ email, error = '' }) => layout('Nhập mã xác minh', `
<h1>Nhập mã xác minh</h1>${steps([['Mật khẩu', 'done'], ['2 Mã xác minh', 'on']])}
<p class="muted">Mở app Authenticator (Google Authenticator…) trên điện thoại, nhập mã 6 số ở mục <b>MCAH internal · ${e(email)}</b>.</p>${notice('err', error)}
<form method="post" action="${I}/login/verify" style="display:grid;gap:12px" novalidate>
<label>Mã 6 số<input class="otp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" autofocus></label>
<button class="pri">Xác minh</button></form>
<div class="row"><a href="${I}/login">← Đăng nhập lại</a><a href="${I}/login/recovery">Mất điện thoại?</a></div>`)

const recoveryPage = ({ error = '' } = {}) => layout('Dùng mã khôi phục', `
<h1>Dùng mã khôi phục</h1><p class="muted">Nhập một trong ${adminAuth.RECOVERY_COUNT} mã khôi phục đã lưu khi cài xác minh hai bước.</p>${notice('err', error)}
<form method="post" action="${I}/login/recovery" style="display:grid;gap:12px" novalidate>
<label>Mã khôi phục<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" autofocus style="font-family:ui-monospace,monospace;letter-spacing:.08em"></label>
<button class="pri">Xác minh</button></form>
<div class="row"><a href="${I}/login/verify">← Dùng mã từ app Authenticator</a></div>`)

async function setupPage({ email, secret, error = '' }) {
  const qr = await QRCode.toString(totp.uri(secret, { issuer: 'MCAH internal', account: email }), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  const key = totp.base32(secret).replace(/(.{4})/g, '$1 ').trim()
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
  return layout('Cài xác minh hai bước', `
<h1>Cài xác minh hai bước</h1>${steps([['Mật khẩu', 'done'], ['2 Quét mã', 'on'], ['3 Mã khôi phục', '']])}
<div class="qrwrap"><div class="qr" aria-label="Mã QR để quét bằng app Authenticator">${qr}</div>
<div style="display:grid;gap:8px"><p><b>1.</b> Cài <b>Google Authenticator</b> (hoặc Microsoft Authenticator, Authy, 1Password…) trên điện thoại.</p>
<p><b>2.</b> Trong app bấm <b>+</b> → <b>Quét mã QR</b>, quét mã bên trái.</p>
<p class="muted small">Không quét được? Chọn "Nhập khoá thiết lập", gõ:</p><div class="secret">${e(key)}</div></div></div>
${notice('err', error)}
<form method="post" action="${I}/login/setup" style="display:grid;gap:12px" novalidate>
<label><span><b>3.</b> Nhập mã 6 số app vừa hiện</span><input class="otp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" autofocus></label>
<button class="pri">Xác nhận</button></form>
<p class="muted small">Giờ máy chủ: ${e(now)}. Mã luôn sai thì kiểm giờ điện thoại có đặt tự động không.</p>`, true)
}

const recoveryCodesPage = ({ codes, next }) => layout('Lưu mã khôi phục', `
<h1>Lưu mã khôi phục</h1>${steps([['Mật khẩu', 'done'], ['Quét mã', 'done'], ['3 Mã khôi phục', 'on']])}${notice('ok', 'Đã bật xác minh hai bước.')}
<p>Mất điện thoại thì dùng một mã dưới đây thay cho mã 6 số. Mỗi mã dùng được một lần. <b>Trang này chỉ hiện một lần</b> — chép vào trình quản lý mật khẩu hoặc in ra cất kỹ.</p>
<div class="codes" aria-label="Mã khôi phục">${codes.map((c) => `<span>${e(c)}</span>`).join('')}</div>
<a class="btn pri" href="${e(safeNext(next))}">Tôi đã lưu, vào trang quản trị</a>`, true)

async function internalLoginRoutes(fastify) {
  const limit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
  const startSession = (reply, admin) => {
    clearCookie(reply, 'mcah_admin_step')
    setCookie(reply, 'mcah_admin', { a: admin.account.id, t: Date.now(), v: admin.auth.auth_version }, SESSION_HOURS * 3600)
  }
  const stepOf = (request) => fromCookie(request, 'mcah_admin_step', STEP_MIN * 60 * 1000)
  const expired = (reply) => reply.code(303).redirect(`${I}/login?expired=1`)
  const badPost = (request, reply) => (sameSite(request) ? null : reply.code(403).send({ message: 'Yêu cầu không hợp lệ' }))

  fastify.get(I, async (request, reply) => reply.redirect(`${I}/admin`))
  fastify.get(`${I}/`, async (request, reply) => reply.redirect(`${I}/admin`))

  // nginx auth_request cho trang tĩnh dưới /internal (design system): 204 = cho qua, 401 = về trang đăng nhập.
  fastify.get(`${I}/_check`, async (request, reply) => reply.code((await adminSession(request)) ? 204 : 401).send())

  fastify.get(`${I}/login`, async (request, reply) => {
    if (await adminSession(request)) return reply.redirect(safeNext(request.query.next))
    const error = (await adminAuth.locked()) ? LOCKED : request.query.expired ? 'Hết thời gian, đăng nhập lại.' : ''
    return html(reply, loginPage({ next: request.query.next, error }))
  })

  fastify.post(`${I}/login`, limit, async (request, reply) => {
    if (badPost(request, reply)) return reply
    const email = accounts.normalizeEmail(request.body?.email)
    const password = String(request.body?.password || '')
    const next = request.body?.next
    const errors = { ...(email ? {} : { email: 'Nhập email' }), ...(password ? {} : { password: 'Nhập mật khẩu' }) }
    if (Object.keys(errors).length) return html(reply, loginPage({ email, next, errors }), 400)
    if (await adminAuth.locked()) return html(reply, loginPage({ email, next, error: LOCKED }), 429)
    const admin = await adminAuth.checkLogin(email, password)
    if (!admin) {
      await adminAuth.recordFail('admin_login_fail', request.ip, null, email)
      return html(reply, loginPage({ email, next, error: (await adminAuth.locked()) ? LOCKED : WRONG_LOGIN }), 400)
    }
    setCookie(reply, 'mcah_admin_step', { a: admin.account.id, t: Date.now(), v: admin.auth.auth_version, next: safeNext(next) }, STEP_MIN * 60)
    return reply.code(303).redirect(adminAuth.enrolled(admin.auth) ? `${I}/login/verify` : `${I}/login/setup`)
  })

  // ---- Mã 6 số (màn 3) ----
  fastify.get(`${I}/login/verify`, async (request, reply) => {
    const step = await stepOf(request)
    if (!step) return expired(reply)
    if (!adminAuth.enrolled(step.auth)) return reply.redirect(`${I}/login/setup`)
    return html(reply, verifyPage({ email: step.account.email, error: (await adminAuth.locked()) ? LOCKED : '' }))
  })

  fastify.post(`${I}/login/verify`, limit, async (request, reply) => {
    if (badPost(request, reply)) return reply
    const step = await stepOf(request)
    if (!step) return expired(reply)
    const email = step.account.email
    if (await adminAuth.locked()) return html(reply, verifyPage({ email, error: LOCKED }), 429)
    if (!(await adminAuth.verifyTotp(step.account.id, request.body?.code))) {
      await adminAuth.recordFail('admin_2fa_fail', request.ip, step.account.id, 'Mã Authenticator')
      return html(reply, verifyPage({ email, error: (await adminAuth.locked()) ? LOCKED : 'Mã không đúng. Mã đổi mỗi 30 giây, nhập mã đang hiện.' }), 400)
    }
    startSession(reply, step)
    await accounts.audit(step.account.id, 'admin_login', request.ip, null, undefined, 'Mã Authenticator')
    return reply.code(303).redirect(safeNext(step.cookie.next))
  })

  // ---- Mã khôi phục (màn 6) ----
  fastify.get(`${I}/login/recovery`, async (request, reply) => {
    const step = await stepOf(request)
    if (!step || !adminAuth.enrolled(step.auth)) return expired(reply)
    return html(reply, recoveryPage({ error: (await adminAuth.locked()) ? LOCKED : '' }))
  })

  fastify.post(`${I}/login/recovery`, limit, async (request, reply) => {
    if (badPost(request, reply)) return reply
    const step = await stepOf(request)
    if (!step || !adminAuth.enrolled(step.auth)) return expired(reply)
    if (await adminAuth.locked()) return html(reply, recoveryPage({ error: LOCKED }), 429)
    const left = await adminAuth.useRecovery(step.account.id, request.body?.code)
    if (left === null) {
      await adminAuth.recordFail('admin_2fa_fail', request.ip, step.account.id, 'Mã khôi phục')
      return html(reply, recoveryPage({ error: (await adminAuth.locked()) ? LOCKED : 'Mã khôi phục không đúng hoặc đã dùng.' }), 400)
    }
    startSession(reply, step)
    await accounts.audit(step.account.id, 'admin_recovery_used', request.ip, null, undefined, `Còn ${left} mã`)
    return reply.code(303).redirect(`${I}/admin?recovery_left=${left}`)
  })

  // ---- Cài 2FA lần đầu (màn 4, 5) ----
  fastify.get(`${I}/login/setup`, async (request, reply) => {
    const step = await stepOf(request)
    if (!step) return expired(reply)
    if (adminAuth.enrolled(step.auth)) return reply.redirect(`${I}/login/verify`)
    const secret = await adminAuth.pendingSecret(step.account.id)
    return html(reply, await setupPage({ email: step.account.email, secret, error: (await adminAuth.locked()) ? LOCKED : '' }))
  })

  fastify.post(`${I}/login/setup`, limit, async (request, reply) => {
    if (badPost(request, reply)) return reply
    const step = await stepOf(request)
    if (!step) return expired(reply)
    if (adminAuth.enrolled(step.auth)) return reply.code(303).redirect(`${I}/login/verify`)
    const email = step.account.email
    const again = async (error, code) => html(reply, await setupPage({ email, secret: await adminAuth.pendingSecret(step.account.id), error }), code)
    if (await adminAuth.locked()) return again(LOCKED, 429)
    const codes = await adminAuth.confirmSetup(step.account.id, request.body?.code, request.ip)
    if (!codes) {
      await adminAuth.recordFail('admin_2fa_fail', request.ip, step.account.id, 'Cài xác minh hai bước')
      return again((await adminAuth.locked()) ? LOCKED : 'Mã không đúng. Mã đổi mỗi 30 giây, nhập mã đang hiện.', 400)
    }
    startSession(reply, step)
    await accounts.audit(step.account.id, 'admin_login', request.ip, null, undefined, 'Cài xác minh hai bước')
    return html(reply, recoveryCodesPage({ codes, next: step.cookie.next }))
  })

  fastify.get(`${I}/logout`, async (request, reply) => {
    const admin = await adminSession(request)
    if (admin) await accounts.audit(admin.id, 'admin_logout', request.ip)
    clearCookie(reply, 'mcah_admin')
    clearCookie(reply, 'mcah_admin_step')
    return reply.redirect(`${I}/login`)
  })
}

module.exports = internalLoginRoutes
module.exports.adminSession = adminSession
