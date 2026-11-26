// Trang web của máy chủ dịch vụ (wireframe 2, docs/design/wireframes/desktop-gd2.html). HTML thuần, không script
// (CSP chặn mọi script), một khung chung cùng màu và chữ với app.
const { escapeHtml: e } = require('../util')
const config = require('../config')
const MARK = require('./brand_mark')

// Tiền tố đường dẫn khi chạy dưới /account (config.basePath). Trang pháp lý là tệp tĩnh của frontend ở /legal/.
const B = config.basePath

const CSS = `
:root{color-scheme:light;--primary:#003366;--bg:#eef0f4;--surface:#fff;--fg:#2c2c2c;--muted:#707070;--border:#d3d5db;--err:#c10007;--err-bg:#fef2f2;--info:#1d4ed8;--info-bg:#eff6ff;--ok:#007a55;--ok-bg:#ecfdf5}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 Inter,system-ui,'Segoe UI',sans-serif;padding:16px}
main{width:min(400px,100%);background:var(--surface);border-radius:16px;padding:28px;display:grid;gap:14px}
.brand{display:flex;gap:10px;align-items:center;font-weight:700}.brand i{width:32px;height:32px;border-radius:8px;background:var(--primary);color:#fff;display:grid;place-items:center;font-style:normal;font-size:13px}.brand i svg{width:22px;height:22px}
h1{margin:0;font-size:20px}p{margin:0}.muted{color:var(--muted);font-size:14px}
label{display:grid;gap:4px;font-size:14px}input{font:inherit;padding:10px 12px;border:1px solid var(--border);border-radius:8px;width:100%;min-height:44px}
input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
button,.btn{font:inherit;font-weight:600;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:999px;padding:10px 16px;min-height:44px;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px}
button.pri{background:var(--primary);border-color:var(--primary);color:#fff}
.or{text-align:center;color:var(--muted);font-size:13px}.row{display:flex;justify-content:space-between;gap:8px;font-size:14px}
a{color:var(--primary)}.msg{padding:10px 12px;border-radius:8px;font-size:14px}.err{background:var(--err-bg);color:var(--err)}.info{background:var(--info-bg);color:var(--info)}.ok{background:var(--ok-bg);color:var(--ok)}
.code{font:600 22px/1.2 ui-monospace,monospace;letter-spacing:.08em;text-align:center;padding:12px;background:#e7e8ec;border-radius:8px}
`

function layout(title, body) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)} · Catoro</title><style>${CSS}</style></head><body><main><div class="brand"><i>${MARK}</i>Catoro</div>${body}</main></body></html>`
}

const notice = (kind, text) => (text ? `<div class="msg ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${e(text)}</div>` : '')
const googleButton = (enabled, label) => (enabled ? `<a class="btn" href="${B}/google">G&nbsp;&nbsp;${e(label)}</a><div class="or">hoặc</div>` : '')

const pages = {
  // Wireframe 1, 3 của docs/design/wireframes/tai-khoan-tu-tren-xuong.html: Google hoặc mã qua email, không mật khẩu,
  // không đăng ký. reauth (sau 5 lần sai PIN): email khoá sẵn, phải xác nhận lại.
  login: ({ email = '', error = '', emailError = '', google = false, reauth = false }) => layout('Đăng nhập', `
<h1>${reauth ? 'Xác nhận lại' : 'Đăng nhập Catoro'}</h1>
${reauth ? notice('info', 'Vì lý do an toàn, xác nhận lại để tiếp tục.') : ''}
${notice('err', error)}
${googleButton(google, 'Tiếp tục với Google')}
<form method="post" action="${B}/login/email" style="display:grid;gap:12px" novalidate>
<label>Email<input name="email" type="email" autocomplete="username" value="${e(email)}" ${reauth && email ? 'readonly' : 'autofocus'}${emailError ? ' aria-invalid="true" aria-describedby="email-err"' : ''}>${emailError ? `<span id="email-err" style="color:var(--err);font-size:13px">${e(emailError)}</span>` : ''}</label>
<button class="pri">Tiếp tục với email</button></form>
<p class="muted">Chưa có tài khoản? Tài khoản do quản trị văn phòng tạo. Hỏi quản trị văn phòng của bạn.</p>
<div class="row muted"><a href="/legal/terms">Điều khoản</a><a href="/legal/privacy">Quyền riêng tư</a></div>`),

  // Wireframe 2: nhập mã 6 số đã gửi qua email. Gửi lại là nút gửi form (không có script đếm giờ).
  code: ({ email, error = '', info = '' }) => layout('Nhập mã', `
<h1>Nhập mã trong email</h1>
<p class="muted">Đã gửi mã 6 số tới <b>${e(email)}</b>. Mã có hạn 10 phút.</p>
${notice('err', error)}${notice('ok', info)}
<form method="post" action="${B}/login/code" style="display:grid;gap:12px" novalidate>
<label>Mã 6 số<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" autofocus style="font:600 24px/1.2 ui-monospace,monospace;letter-spacing:.3em;text-align:center"></label>
<button class="pri">Đăng nhập</button></form>
<div class="row"><a href="${B}/login/change-email">Dùng email khác</a>
<form method="post" action="${B}/login/resend" style="margin:0"><button style="min-height:0;padding:0;border:0;font-weight:400;color:var(--primary);background:none;text-decoration:underline">Gửi lại mã</button></form></div>
<p class="muted">Không thấy thư? Xem mục Thư rác. Vẫn không có: email này có thể chưa được tạo tài khoản, hỏi quản trị văn phòng.</p>`),


  message: ({ title, kind = 'info', text, link = null }) => layout(title, `
<h1>${e(title)}</h1>${notice(kind, text)}${link ? `<a class="btn" href="${e(link.href)}">${e(link.label)}</a>` : ''}`),

  // Sau đăng nhập: hiện mã dự phòng và tự chuyển về app (meta refresh, không cần script).
  done: ({ shortCode, redirect }) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="1;url=${e(redirect)}"><title>Đã đăng nhập · Catoro</title><style>${CSS}</style></head><body><main>
<div class="brand"><i>${MARK}</i>Catoro</div><h1>Đã đăng nhập</h1><p>Đang quay lại app Catoro…</p>
<p class="muted">App không tự vào? Trong app bấm "Nhập mã thủ công" và nhập mã này (có hạn 5 phút):</p>
<div class="code" aria-label="Mã đăng nhập">${e(shortCode)}</div></main></body></html>`,

  backToApp: () => layout('Đã đăng nhập', `<h1>Đã đăng nhập</h1>${notice('ok', 'Quay lại app Catoro. Có thể đóng tab này.')}`),
}

module.exports = pages
