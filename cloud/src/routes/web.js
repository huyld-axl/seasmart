// Trang web tài khoản và OAuth cho app (docs/mcah-ke-hoach-desktop-gd2.md 3.3).
// Cookie ký (HttpOnly, SameSite=Lax): mcah_s = phiên trên trình duyệt (tài khoản + thời điểm đăng nhập, 8 giờ),
// mcah_oauth = yêu cầu /authorize đang chờ (10 phút), mcah_inv = mã lời mời đang chờ (1 giờ).
const config = require('../config')
const pages = require('../views/pages')
const accounts = require('../services/accounts')
const offices = require('../services/offices')
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
  // Đăng nhập xong (mật khẩu hoặc Google): nhận lời mời đang chờ, rồi trả mã cho app nếu có yêu cầu /authorize.
  // pendingNow: yêu cầu /authorize vừa nhận trong chính request này (cookie vừa đặt chưa có trong request).
  async function finishLogin(request, reply, account, authTime = Date.now(), pendingNow = null) {
    setCookie(reply, 'mcah_s', { a: account.id, t: authTime }, SESSION_HOURS * 3600)
    const invite = readCookie(request, 'mcah_inv')
    if (invite?.token) {
      clearCookie(reply, 'mcah_inv')
      try {
        await offices.acceptInvite(invite.token, account, request.ip)
      } catch (error) {
        return html(reply, pages.message({ title: 'Chưa nhận được lời mời', kind: 'err', text: error.message, link: { href: `${config.basePath}/dang-nhap`, label: 'Đăng nhập bằng tài khoản khác' } }), error.statusCode || 400)
      }
    }
    const pending = pendingNow || readCookie(request, 'mcah_oauth')
    if (pending) {
      clearCookie(reply, 'mcah_oauth')
      const { redirect, shortCode } = await oauth.issueCode(account.id, pending, authTime)
      return html(reply, pages.done({ shortCode, redirect }))
    }
    return html(reply, pages.message({ title: 'Đã đăng nhập', kind: 'ok', text: invite?.token ? 'Đã nhận lời mời. Mở app MCAH trên máy của văn phòng và đăng nhập.' : 'Mở app MCAH để làm việc.' }))
  }

  // Phiên trên trình duyệt còn hiệu lực và thoả max_age thì trả tài khoản.
  async function sessionAccount(request, maxAge = null) {
    const s = readCookie(request, 'mcah_s')
    if (!s?.a || !s.t) return null
    if (maxAge !== null && Date.now() - s.t > maxAge * 1000) return null
    const account = await accounts.findById(s.a)
    return account && !account.disabled_at && account.email_verified_at ? { account, authTime: s.t } : null
  }

  async function inviteInfo(request) {
    const pending = readCookie(request, 'mcah_inv')
    const invite = pending?.token ? await offices.findInvite(pending.token) : null
    return invite ? { officeName: invite.office_name, email: invite.email, fullName: invite.full_name } : null
  }

  // ---- OAuth cho app ----
  fastify.get('/authorize', async (request, reply) => {
    const pending = oauth.parseAuthorize(request.query)
    if (!pending) return html(reply, pages.message({ title: 'Yêu cầu không hợp lệ', kind: 'err', text: 'Mở lại app MCAH và bấm Đăng nhập.' }), 400)
    setCookie(reply, 'mcah_oauth', pending, 600)
    const session = await sessionAccount(request, pending.max_age)
    if (session) return finishLogin(request, reply, session.account, session.authTime, pending)
    const known = await sessionAccount(request)
    const query = pending.max_age === 0 && known ? `?lai=1&email=${encodeURIComponent(known.account.email)}` : ''
    return reply.redirect(`${config.basePath}/dang-nhap${query}`)
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
  fastify.get('/xong', async (request, reply) => html(reply, pages.backToApp()))
  fastify.get('/dieu-khoan', async (request, reply) => html(reply, pages.legal({ title: 'Điều khoản sử dụng' })))
  fastify.get('/quyen-rieng-tu', async (request, reply) => html(reply, pages.legal({ title: 'Chính sách quyền riêng tư' })))

  // ---- Đăng nhập ----
  const loginLimit = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }
  fastify.get('/dang-nhap', async (request, reply) => {
    const reauth = request.query.lai === '1'
    return html(reply, pages.login({ email: request.query.email || '', reauth, google: googleOn(), invite: await inviteInfo(request) }))
  })
  fastify.post('/dang-nhap', loginLimit, async (request, reply) => {
    const { email, password } = request.body || {}
    try {
      const account = await accounts.login({ email, password, ip: request.ip })
      return finishLogin(request, reply, account)
    } catch (error) {
      return html(reply, pages.login({ email, error: error.message, google: googleOn(), invite: await inviteInfo(request) }), error.statusCode || 400)
    }
  })
  fastify.get('/dang-xuat', async (request, reply) => {
    clearCookie(reply, 'mcah_s')
    return reply.redirect(`${config.basePath}/dang-nhap`)
  })

  // ---- Đăng ký, xác minh ----
  fastify.get('/dang-ky', async (request, reply) => {
    const invite = await inviteInfo(request)
    return html(reply, pages.register({ email: invite?.email || '', fullName: invite?.fullName || '', google: googleOn(), invite }))
  })
  fastify.post('/dang-ky', loginLimit, async (request, reply) => {
    const { email, full_name: fullName, password } = request.body || {}
    const invite = await inviteInfo(request)
    try {
      const verifiedByInvite = Boolean(invite && invite.email.toLowerCase() === String(email || '').trim().toLowerCase())
      const account = await accounts.register({ email, fullName, password, verifiedByInvite, ip: request.ip })
      if (verifiedByInvite) return finishLogin(request, reply, account)
      return html(reply, pages.checkEmail({ email: account.email }))
    } catch (error) {
      return html(reply, pages.register({ email, fullName, error: error.message, google: googleOn(), invite }), error.statusCode || 400)
    }
  })
  fastify.get('/xac-minh', async (request, reply) => {
    try {
      await accounts.verifyEmail(request.query.token)
      return html(reply, pages.message({ title: 'Đã xác minh email', kind: 'ok', text: 'Đăng nhập để tiếp tục.', link: { href: `${config.basePath}/dang-nhap`, label: 'Đăng nhập' } }))
    } catch (error) {
      return html(reply, pages.message({ title: 'Chưa xác minh được', kind: 'err', text: error.message, link: { href: `${config.basePath}/dang-ky`, label: 'Đăng ký lại' } }), 400)
    }
  })
  fastify.get('/gui-lai-xac-minh', loginLimit, async (request, reply) => {
    await accounts.resendVerify(request.query.email)
    return html(reply, pages.checkEmail({ email: String(request.query.email || '') }))
  })

  // ---- Quên / đặt lại mật khẩu ----
  fastify.get('/quen-mat-khau', async (request, reply) => html(reply, pages.forgot({})))
  fastify.post('/quen-mat-khau', loginLimit, async (request, reply) => {
    const email = String(request.body?.email || '').trim()
    await accounts.requestReset(email)
    return html(reply, pages.forgot({ sentTo: email }))
  })
  fastify.get('/dat-lai', async (request, reply) => html(reply, pages.reset({ token: String(request.query.token || '') })))
  fastify.post('/dat-lai', loginLimit, async (request, reply) => {
    const { token, password } = request.body || {}
    try {
      await accounts.resetPassword({ token, password, ip: request.ip })
      clearCookie(reply, 'mcah_s')
      return html(reply, pages.message({ title: 'Đã đổi mật khẩu', kind: 'ok', text: 'Đăng nhập bằng mật khẩu mới.', link: { href: `${config.basePath}/dang-nhap`, label: 'Đăng nhập' } }))
    } catch (error) {
      return html(reply, pages.reset({ token, error: error.message }), error.statusCode || 400)
    }
  })

  // ---- Google ----
  fastify.get('/google', loginLimit, async (request, reply) => {
    if (!google.enabled()) return reply.redirect(`${config.basePath}/dang-nhap`)
    // Đăng nhập lại bắt buộc (app gửi max_age=0 sau khi sai PIN): Google hỏi lại mật khẩu.
    const reauth = readCookie(request, 'mcah_oauth')?.max_age === 0
    const { url, pending } = google.start({ reauth })
    setCookie(reply, 'mcah_g', pending, 600)
    return reply.redirect(url)
  })
  fastify.get('/google/callback', loginLimit, async (request, reply) => {
    const pending = readCookie(request, 'mcah_g')
    clearCookie(reply, 'mcah_g')
    if (request.query.error) return html(reply, pages.login({ error: 'Đã huỷ đăng nhập bằng Google.', google: googleOn(), invite: await inviteInfo(request) }), 400)
    try {
      const profile = await google.finish({ code: String(request.query.code || ''), state: String(request.query.state || ''), pending })
      const account = await google.accountFor(profile, request.ip)
      return finishLogin(request, reply, account)
    } catch (error) {
      return html(reply, pages.login({ error: error.message, google: googleOn(), invite: await inviteInfo(request) }), error.statusCode || 400)
    }
  })

  // ---- Lời mời ----
  fastify.get('/moi', async (request, reply) => {
    const token = String(request.query.token || '')
    const invite = await offices.findInvite(token)
    if (!invite) return html(reply, pages.message({ title: 'Lời mời không dùng được', kind: 'err', text: 'Lời mời đã hết hạn, đã được dùng hoặc đã bị huỷ. Nhờ quản trị văn phòng gửi lại.' }), 400)
    setCookie(reply, 'mcah_inv', { token }, 3600)
    const existing = await accounts.findByEmail(invite.email)
    return reply.redirect(existing ? `${config.basePath}/dang-nhap?email=${encodeURIComponent(invite.email)}` : `${config.basePath}/dang-ky`)
  })
}

module.exports = webRoutes
