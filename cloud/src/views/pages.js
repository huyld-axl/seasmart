// Trang web của máy chủ dịch vụ (wireframe 2, docs/design/wireframes/desktop-gd2.html). HTML thuần, không script
// (CSP chặn mọi script), một khung chung cùng màu và chữ với app.
const { escapeHtml: e } = require('../util')
const config = require('../config')

// Tiền tố đường dẫn khi chạy dưới /tai-khoan (config.basePath).
const B = config.basePath

const CSS = `
:root{color-scheme:light;--primary:#003366;--bg:#eef0f4;--surface:#fff;--fg:#2c2c2c;--muted:#707070;--border:#d3d5db;--err:#c10007;--err-bg:#fef2f2;--info:#1d4ed8;--info-bg:#eff6ff;--ok:#007a55;--ok-bg:#ecfdf5}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 Inter,system-ui,'Segoe UI',sans-serif;padding:16px}
main{width:min(400px,100%);background:var(--surface);border-radius:16px;padding:28px;display:grid;gap:14px}
.brand{display:flex;gap:10px;align-items:center;font-weight:700}.brand i{width:32px;height:32px;border-radius:8px;background:var(--primary);color:#fff;display:grid;place-items:center;font-style:normal;font-size:13px}
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
<title>${e(title)} · MCAH</title><style>${CSS}</style></head><body><main><div class="brand"><i>MC</i>MCAH</div>${body}</main></body></html>`
}

const notice = (kind, text) => (text ? `<div class="msg ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${e(text)}</div>` : '')
const googleButton = (enabled, label) => (enabled ? `<a class="btn" href="${B}/google">G&nbsp;&nbsp;${e(label)}</a><div class="or">hoặc</div>` : '')

const pages = {
  login: ({ email = '', error = '', info = '', google = false, reauth = false, invite = null }) => layout('Đăng nhập', `
<h1>${reauth ? 'Đăng nhập lại' : 'Đăng nhập'}</h1>
${invite ? notice('info', `Bạn được mời vào văn phòng ${invite.officeName}. Đăng nhập để nhận lời mời.`) : ''}
${reauth ? notice('info', 'Vì lý do an toàn, nhập lại mật khẩu để tiếp tục.') : ''}
${notice('err', error)}${notice('ok', info)}
${googleButton(google, 'Tiếp tục với Google')}
<form method="post" action="${B}/dang-nhap" style="display:grid;gap:12px">
<label>Email<input name="email" type="email" autocomplete="username" required value="${e(email)}" ${reauth && email ? 'readonly' : 'autofocus'}></label>
<label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required ${reauth && email ? 'autofocus' : ''}></label>
<button class="pri">Đăng nhập</button></form>
<div class="row"><a href="${B}/quen-mat-khau">Quên mật khẩu?</a><a href="${B}/dang-ky">Đăng ký</a></div>
<div class="row muted"><a href="${B}/dieu-khoan">Điều khoản</a><a href="${B}/quyen-rieng-tu">Quyền riêng tư</a></div>`),

  register: ({ email = '', fullName = '', error = '', google = false, invite = null }) => layout('Đăng ký', `
<h1>Đăng ký</h1>
${invite ? notice('info', `Bạn được mời vào văn phòng ${invite.officeName}.`) : ''}
${notice('err', error)}
${googleButton(google, 'Đăng ký bằng Google')}
<form method="post" action="${B}/dang-ky" style="display:grid;gap:12px">
<label>Họ tên<input name="full_name" autocomplete="name" required value="${e(fullName)}"></label>
<label>Email<input name="email" type="email" autocomplete="email" required value="${e(email)}" ${invite ? 'readonly' : ''}></label>
<label>Mật khẩu (ít nhất 10 ký tự)<input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
<button class="pri">Đăng ký</button></form>
<p class="muted">Bằng việc đăng ký, bạn đồng ý với <a href="${B}/dieu-khoan">Điều khoản sử dụng</a> và <a href="${B}/quyen-rieng-tu">Chính sách quyền riêng tư</a> của MCAH.</p>
<div class="row"><span class="muted">Đã có tài khoản?</span><a href="${B}/dang-nhap">Đăng nhập</a></div>`),

  // Điều khoản / quyền riêng tư (M5): nội dung chờ luật sư, tạm "TBC".
  legal: ({ title }) => layout(title, `
<h1>${e(title)}</h1>
<p>Nội dung đang được hoàn thiện (TBC).</p>
<p class="muted">Cần hỏi thêm, liên hệ MCAH.</p>
<div class="row"><a href="${B}/dang-nhap">Về đăng nhập</a></div>`),

  checkEmail: ({ email }) => layout('Xác minh email', `
<h1>Xác minh email</h1>${notice('info', `Đã gửi thư tới ${email}. Bấm liên kết trong thư rồi quay lại đây đăng nhập.`)}
<p class="muted">Không thấy thư? Xem mục Thư rác, hoặc <a href="${B}/gui-lai-xac-minh?email=${encodeURIComponent(email)}">gửi lại</a>.</p>`),

  forgot: ({ error = '', sentTo = '' }) => layout('Quên mật khẩu', `
<h1>Quên mật khẩu</h1>
${sentTo ? notice('ok', `Nếu ${sentTo} có tài khoản MCAH, thư đặt lại mật khẩu đã được gửi. Liên kết có hạn 30 phút.`) : notice('err', error)}
<form method="post" action="${B}/quen-mat-khau" style="display:grid;gap:12px">
<label>Email<input name="email" type="email" autocomplete="email" required autofocus></label>
<button class="pri">Gửi liên kết đặt lại</button></form>
<div class="row"><a href="${B}/dang-nhap">Về đăng nhập</a></div>`),

  reset: ({ token, error = '' }) => layout('Đặt mật khẩu mới', `
<h1>Đặt mật khẩu mới</h1>${notice('err', error)}
<form method="post" action="${B}/dat-lai" style="display:grid;gap:12px"><input type="hidden" name="token" value="${e(token)}">
<label>Mật khẩu mới (ít nhất 10 ký tự)<input name="password" type="password" autocomplete="new-password" minlength="10" required autofocus></label>
<button class="pri">Lưu mật khẩu</button></form>`),

  message: ({ title, kind = 'info', text, link = null }) => layout(title, `
<h1>${e(title)}</h1>${notice(kind, text)}${link ? `<a class="btn" href="${e(link.href)}">${e(link.label)}</a>` : ''}`),

  // Sau đăng nhập: hiện mã dự phòng và tự chuyển về app (meta refresh, không cần script).
  done: ({ shortCode, redirect }) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="1;url=${e(redirect)}"><title>Đã đăng nhập · MCAH</title><style>${CSS}</style></head><body><main>
<div class="brand"><i>MC</i>MCAH</div><h1>Đã đăng nhập</h1><p>Đang quay lại app MCAH…</p>
<p class="muted">App không tự vào? Trong app bấm "Nhập mã thủ công" và nhập mã này (có hạn 5 phút):</p>
<div class="code" aria-label="Mã đăng nhập">${e(shortCode)}</div></main></body></html>`,

  backToApp: () => layout('Đã đăng nhập', `<h1>Đã đăng nhập</h1>${notice('ok', 'Quay lại app MCAH. Có thể đóng tab này.')}`),
}

module.exports = pages
