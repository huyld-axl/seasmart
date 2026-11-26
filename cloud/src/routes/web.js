// Trang web tài khoản và OAuth cho app (docs/catoro-ke-hoach-desktop-gd2.md 3.3). Đăng nhập không mật khẩu, không đăng ký
// (docs/catoro-ke-hoach-tai-khoan-tu-tren-xuong.md 3.1): Google hoặc mã 6 số gửi qua email.
// Cookie ký (HttpOnly, SameSite=Lax): catoro_s = phiên trên trình duyệt (tài khoản + thời điểm đăng nhập, 8 giờ),
// catoro_oauth = yêu cầu /authorize đang chờ (10 phút), catoro_otp = email đang chờ nhập mã (10 phút),
// catoro_last = tài khoản vừa trao mã cho app (8 giờ), chỉ để điền sẵn email khi app bắt đăng nhập lại, không đăng nhập được.
const config = require('../config')
const pages = require('../views/pages')
const accounts = require('../services/accounts')
const loginCodes = require('../services/login_codes')
const oauth = require('../services/oauth')
const tickets = require('../services/tickets')
const google = require('../services/google')

const SESSION_HOURS = 8
const html = (reply, body, code = 200) => reply.code(code).type('text/html; charset=utf-8').send(body)
const cookieOpts = (maxAgeSec) => ({ path: config.basePath || '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies, signed: true, maxAge: maxAgeSec })
const googleOn = () => google.enabled()

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
const clearCookie = (reply, name) => reply.clearCookie(name, { path: config.basePath || '/' })

async function webRoutes(fastify) {
  // Đăng nhập xong (Google hoặc mã email): trả mã cho app nếu có yêu cầu /authorize.
  // pendingNow: yêu cầu /authorize vừa nhận trong chính request này (cookie vừa đặt chưa có trong request).
  // Đã trao mã cho app thì không giữ phiên trình duyệt: lần sau bấm Đăng nhập trên app (kể cả sau khi đăng xuất
  // để đổi tài khoản) trình duyệt luôn hỏi lại, không lặng lẽ vào tài khoản cũ.
  async function finishLogin(request, reply, account, authTime = Date.now(), pendingNow = null) {
    const pending = pendingNow || readCookie(request, 'catoro_oauth')
    if (pending) {
      clearCookie(reply, 'catoro_s')
      clearCookie(reply, 'catoro_oauth')
      setCookie(reply, 'catoro_last', { a: account.id, t: authTime }, SESSION_HOURS * 3600)
      const { redirect, shortCode } = await oauth.issueCode(account.id, pending, authTime)
      return html(reply, pages.done({ shortCode, redirect }))
    }
    setCookie(reply, 'catoro_s', { a: account.id, t: authTime }, SESSION_HOURS * 3600)
    return html(reply, pages.message({ title: 'Đã đăng nhập', kind: 'ok', text: 'Mở app Catoro để làm việc.' }))
  }

  // Phiên trên trình duyệt còn hiệu lực và thoả max_age thì trả tài khoản.
  async function sessionAccount(request, maxAge = null, cookie = 'catoro_s') {
    const s = readCookie(request, cookie)
    if (!s?.a || !s.t) return null
    if (maxAge !== null && Date.now() - s.t > maxAge * 1000) return null
    const account = await accounts.findById(s.a)
    return account && !account.disabled_at && account.email_verified_at ? { account, authTime: s.t } : null
  }

  const loginPage = (request, extra = {}) => {
    const reauth = readCookie(request, 'catoro_oauth')?.max_age === 0
    return pages.login({ google: googleOn(), reauth, ...extra })
  }

  // ---- OAuth cho app ----
  fastify.get('/authorize', async (request, reply) => {
    const pending = oauth.parseAuthorize(request.query)
    if (!pending) return html(reply, pages.message({ title: 'Yêu cầu không hợp lệ', kind: 'err', text: 'Mở lại app Catoro và bấm Đăng nhập.' }), 400)
    setCookie(reply, 'catoro_oauth', pending, 600)
    const session = await sessionAccount(request, pending.max_age)
    if (session) return finishLogin(request, reply, session.account, session.authTime, pending)
    const known = (await sessionAccount(request)) || (await sessionAccount(request, null, 'catoro_last'))
    const query = pending.max_age === 0 && known ? `?reauth=1&email=${encodeURIComponent(known.account.email)}` : ''
    return reply.redirect(`${config.basePath}/login${query}`)
  })

  fastify.post('/token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = request.body || {}
    try {
      if (body.grant_type === 'authorization_code') return await oauth.exchangeCode(body)
      if (body.grant_type === 'refresh_token') return await oauth.refresh(body.refresh_token)
      if (body.grant_type === 'revoke') {
        await oauth.revoke(body.refresh_token)
        return { ok: true }
      }
      return reply.code(400).send({ error: 'unsupported_grant_type', message: 'Yêu cầu không hợp lệ' })
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ error: error.error || 'invalid_request', message: error.message })
    }
  })

  fastify.get('/.well-known/mcah-keys', async () => ({ keys: tickets.publicKeys() }))

  // Trang chuyển về sau khi app đã nhận mã (app chuyển trình duyệt tới đây).
  fastify.get('/done', async (request, reply) => html(reply, pages.backToApp()))

  // ---- Đăng nhập: trang chính, mã qua email (wireframe 1, 2) ----
  const loginLimit = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }
  const OTP_SEC = loginCodes.TTL_MIN * 60
  const codePage = (reply, email, extra = {}, code = 200) => html(reply, pages.code({ email, ...extra }), code)

  fastify.get('/login', async (request, reply) => html(reply, loginPage(request, { email: String(request.query.email || '') })))

  fastify.post('/login/email', loginLimit, async (request, reply) => {
    const email = accounts.normalizeEmail(request.body?.email)
    try {
      await loginCodes.send({ email, ip: request.ip })
    } catch (error) {
      if (error.error === 'email_invalid') return html(reply, loginPage(request, { email, emailError: error.message }), 400)
      // Vừa gửi mã cho email này: về trang nhập mã, không gửi thư mới.
      if (error.error === 'resend_wait') {
        setCookie(reply, 'catoro_otp', { e: email }, OTP_SEC)
        return codePage(reply, email, { info: 'Mã vừa được gửi, xem hộp thư.' })
      }
      if (!error.statusCode || error.statusCode >= 500) throw error
      return html(reply, loginPage(request, { email, error: error.message }), error.statusCode)
    }
    setCookie(reply, 'catoro_otp', { e: email }, OTP_SEC)
    return reply.code(303).redirect(`${config.basePath}/login/code`)
  })

  fastify.get('/login/code', async (request, reply) => {
    const otp = readCookie(request, 'catoro_otp')
    if (!otp?.e) return reply.redirect(`${config.basePath}/login`)
    return codePage(reply, otp.e)
  })

  fastify.post('/login/code', loginLimit, async (request, reply) => {
    const otp = readCookie(request, 'catoro_otp')
    if (!otp?.e) return reply.code(303).redirect(`${config.basePath}/login`)
    let account
    try {
      account = await loginCodes.verify({ email: otp.e, code: request.body?.code })
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) throw error
      return codePage(reply, otp.e, { error: error.message }, error.statusCode)
    }
    clearCookie(reply, 'catoro_otp')
    await accounts.recordLogin(account, 'email_code', request.ip)
    return finishLogin(request, reply, account)
  })

  fastify.post('/login/resend', loginLimit, async (request, reply) => {
    const otp = readCookie(request, 'catoro_otp')
    if (!otp?.e) return reply.code(303).redirect(`${config.basePath}/login`)
    try {
      await loginCodes.send({ email: otp.e, ip: request.ip })
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) throw error
      return codePage(reply, otp.e, { error: error.message }, error.statusCode)
    }
    setCookie(reply, 'catoro_otp', { e: otp.e }, OTP_SEC)
    return codePage(reply, otp.e, { info: 'Đã gửi mã mới.' })
  })

  fastify.get('/login/change-email', async (request, reply) => {
    clearCookie(reply, 'catoro_otp')
    return reply.redirect(`${config.basePath}/login`)
  })

  fastify.get('/logout', async (request, reply) => {
    clearCookie(reply, 'catoro_s')
    clearCookie(reply, 'catoro_last')
    return reply.redirect(`${config.basePath}/login`)
  })

  // ---- Google ----
  fastify.get('/google', loginLimit, async (request, reply) => {
    if (!google.enabled()) return reply.redirect(`${config.basePath}/login`)
    // Đăng nhập lại bắt buộc (app gửi max_age=0 sau khi sai PIN): Google hỏi lại mật khẩu.
    const reauth = readCookie(request, 'catoro_oauth')?.max_age === 0
    const { url, pending } = google.start({ reauth })
    setCookie(reply, 'catoro_g', pending, 600)
    return reply.redirect(url)
  })
  fastify.get('/google/callback', loginLimit, async (request, reply) => {
    const pending = readCookie(request, 'catoro_g')
    clearCookie(reply, 'catoro_g')
    if (request.query.error) return html(reply, loginPage(request, { error: 'Đã huỷ đăng nhập bằng Google.' }), 400)
    try {
      const profile = await google.finish({ code: String(request.query.code || ''), state: String(request.query.state || ''), pending })
      const account = await google.accountFor(profile)
      await accounts.recordLogin(account, 'google', request.ip)
      return finishLogin(request, reply, account)
    } catch (error) {
      return html(reply, loginPage(request, { error: error.message }), error.statusCode || 400)
    }
  })
}

// Đường tiếng Việt cũ (docs/catoro-ke-hoach-khu-noi-bo.md mục 4): app máy tính đã phát hành chuyển trình duyệt về /xong, trang
// đăng nhập cũ còn mở trong trình duyệt. GET chuyển 301, POST chuyển 308 (giữ thân form). Giữ cả query (?email=…).
const LEGACY = {
  '/dang-nhap': '/login',
  '/dang-nhap/email': '/login/email',
  '/dang-nhap/ma': '/login/code',
  '/dang-nhap/gui-lai': '/login/resend',
  '/dang-nhap/email-khac': '/login/change-email',
  '/dang-xuat': '/logout',
  '/xong': '/done',
}

async function legacyRoutes(fastify) {
  for (const [from, to] of Object.entries(LEGACY)) {
    const move = (code) => async (request, reply) => {
      const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''
      return reply.code(code).redirect(`${config.basePath}${to}${query}`)
    }
    fastify.get(from, move(301))
    fastify.post(from, move(308))
  }
}

module.exports = webRoutes
module.exports.legacyRoutes = legacyRoutes
module.exports.LEGACY = LEGACY
