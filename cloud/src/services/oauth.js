// OAuth cho app cài trên máy (RFC 8252 + PKCE S256): mã dùng một lần (kèm mã ngắn dự phòng), vé Ed25519,
// refresh token xoay vòng (dùng lại token đã thay = bị lộ → huỷ cả họ).
const crypto = require('crypto')
const pool = require('../db')
const tickets = require('./tickets')
const { randomToken, sha256, shortCode, normalizeShortCode, b64url } = require('../util')

const CLIENT_ID = 'mcah-desktop'
const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d{2,5}\/callback$/
const CODE_TTL_MIN = 5
const REFRESH_DAYS = 90
const fail = (statusCode, message, error = 'invalid_request') => ({ statusCode, message, error })

// Tham số /authorize hợp lệ thì trả bản đã chuẩn hoá, sai thì null.
function parseAuthorize(q) {
  const maxAge = q.max_age === undefined || q.max_age === '' ? null : Number(q.max_age)
  const ok = q.client_id === CLIENT_ID && LOOPBACK.test(q.redirect_uri || '') && /^[A-Za-z0-9_-]{43}$/.test(q.code_challenge || '') &&
    (q.code_challenge_method || 'S256') === 'S256' && typeof q.state === 'string' && q.state.length >= 16 && q.state.length <= 200 &&
    (maxAge === null || (Number.isInteger(maxAge) && maxAge >= 0))
  return ok ? { redirect_uri: q.redirect_uri, code_challenge: q.code_challenge, state: q.state, max_age: maxAge } : null
}

async function issueCode(accountId, pending, authTime, db = pool) {
  const code = randomToken()
  const short = shortCode()
  await db.query(
    `INSERT INTO auth_code (code_hash, account_id, challenge, redirect_uri, auth_time, short_code_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' minutes')::interval)`,
    [sha256(code), accountId, pending.code_challenge, pending.redirect_uri, new Date(authTime), sha256(normalizeShortCode(short)), String(CODE_TTL_MIN)]
  )
  const url = new URL(pending.redirect_uri)
  url.searchParams.set('code', code)
  url.searchParams.set('state', pending.state)
  return { redirect: url.toString(), shortCode: short }
}

// Vé + thông tin văn phòng hiện tại của tài khoản (văn phòng có thể đổi giữa các lần làm mới: được mời, bị bỏ).
async function buildTicket(account, authTime, db = pool) {
  const { rows } = await db.query(
    `SELECT m.office_id, m.role, o.name AS office_name, o.locked_at, k.public_key
     FROM office_member m JOIN office o ON o.id = m.office_id
     LEFT JOIN office_machine k ON k.office_id = o.id AND k.revoked_at IS NULL
     WHERE m.account_id = $1 AND m.removed_at IS NULL`,
    [account.id]
  )
  const member = rows[0] || null
  return tickets.issue({
    sub: account.id,
    email: account.email,
    name: account.full_name || account.email,
    office: member?.office_id || null,
    office_name: member?.office_name || null,
    office_role: member?.role || null,
    office_locked: Boolean(member?.locked_at),
    machine: member?.public_key ? crypto.createHash('sha256').update(member.public_key).digest('hex').slice(0, 32) : null,
    auth_time: Math.floor(new Date(authTime).getTime() / 1000),
  })
}

async function issueRefresh(accountId, authTime, familyId = crypto.randomUUID(), db = pool) {
  const token = randomToken(40)
  await db.query(
    `INSERT INTO refresh_token (token_hash, account_id, family_id, auth_time, expires_at) VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval)`,
    [sha256(token), accountId, familyId, new Date(authTime), String(REFRESH_DAYS)]
  )
  return token
}

async function tokenResponse(account, authTime, refreshToken, db) {
  const { ticket, exp } = await buildTicket(account, authTime, db)
  return { ticket, refresh_token: refreshToken, offline_until: new Date(exp * 1000).toISOString() }
}

async function activeAccount(id, db) {
  const { rows } = await db.query('SELECT * FROM account WHERE id = $1', [id])
  const account = rows[0]
  if (!account || account.disabled_at) throw fail(400, 'Tài khoản đã bị khoá', 'invalid_grant')
  return account
}

const oauth = {
  CLIENT_ID,
  parseAuthorize,
  issueCode,
  buildTicket,

  // grant_type=authorization_code: { code | short_code, code_verifier, redirect_uri }.
  async exchangeCode({ code, short_code: short, code_verifier: verifier, redirect_uri: redirectUri }, db = pool) {
    const where = code ? 'code_hash = $1' : 'short_code_hash = $1'
    const key = code ? sha256(code) : sha256(normalizeShortCode(short))
    const { rows } = await db.query(
      `UPDATE auth_code SET used_at = NOW() WHERE ${where} AND used_at IS NULL AND expires_at > NOW() RETURNING *`,
      [key]
    )
    const row = rows[0]
    if (!row) throw fail(400, 'Mã đăng nhập không đúng hoặc đã hết hạn', 'invalid_grant')
    if (code && row.redirect_uri !== redirectUri) throw fail(400, 'Mã đăng nhập không đúng', 'invalid_grant')
    if (b64url(crypto.createHash('sha256').update(String(verifier || '')).digest()) !== row.challenge) throw fail(400, 'Mã đăng nhập không đúng', 'invalid_grant')
    const account = await activeAccount(row.account_id, db)
    return tokenResponse(account, row.auth_time, await issueRefresh(account.id, row.auth_time, undefined, db), db)
  },

  // grant_type=refresh_token. Token đã bị thay mà dùng lại → huỷ cả họ (có thể đã bị lấy cắp).
  async refresh(token, db = pool) {
    const { rows } = await db.query('SELECT * FROM refresh_token WHERE token_hash = $1', [sha256(token || '')])
    const row = rows[0]
    if (!row || row.expires_at < new Date()) throw fail(400, 'Phiên đã hết, đăng nhập lại', 'invalid_grant')
    if (row.revoked_at) {
      if (row.replaced_by) await db.query('UPDATE refresh_token SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1', [row.family_id])
      throw fail(400, 'Phiên đã hết, đăng nhập lại', 'invalid_grant')
    }
    const account = await activeAccount(row.account_id, db)
    const next = await issueRefresh(account.id, row.auth_time, row.family_id, db)
    await db.query('UPDATE refresh_token SET revoked_at = NOW(), replaced_by = $2 WHERE token_hash = $1', [row.token_hash, sha256(next)])
    return tokenResponse(account, row.auth_time, next, db)
  },

  // Đăng xuất trên máy: huỷ cả họ refresh token của phiên đó.
  async revoke(token, db = pool) {
    const { rows } = await db.query('SELECT family_id FROM refresh_token WHERE token_hash = $1', [sha256(token || '')])
    if (rows[0]) await db.query('UPDATE refresh_token SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1', [rows[0].family_id])
  },
}

module.exports = oauth
