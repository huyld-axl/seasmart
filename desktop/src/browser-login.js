// Đăng nhập qua trình duyệt (giai đoạn 0, bước 0.5): OAuth cho app cài trên máy, RFC 8252 + PKCE S256.
// Mở trình duyệt mặc định tới trang đăng nhập của máy chủ dịch vụ, chờ trình duyệt chuyển về
// http://127.0.0.1:<cổng tạm>/callback, đổi mã lấy vé. Cổng tạm chỉ mở trong lúc chờ.
const http = require('http')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { shell } = require('electron')
const { cloudPublicKeyFile } = require('./paths')

const CLOUD_URL = (process.env.MCAH_CLOUD_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '')
const CLIENT_ID = 'mcah-desktop'
const WAIT_MS = 5 * 60 * 1000

// MCAH_OPEN_URL_WITH: lệnh mở trang thay cho trình duyệt mặc định (chỉ dùng khi chạy thử tự động).
function openInBrowser(url) {
  if (process.env.MCAH_OPEN_URL_WITH) spawn(process.env.MCAH_OPEN_URL_WITH, [url], { stdio: 'ignore', detached: true }).unref()
  else shell.openExternal(url)
}

// Khoá công khai của máy chủ dịch vụ, gói sẵn trong app (không cần mạng lúc mở app). Thiếu thì tắt đăng nhập qua trình duyệt.
function cloudPublicKey() {
  const file = process.env.MCAH_CLOUD_PUBLIC_KEY_FILE || cloudPublicKeyFile
  if (!fs.existsSync(file)) return null
  const pem = fs.readFileSync(file, 'utf8')
  crypto.createPublicKey(pem)
  return pem
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

// Trả về vé đã ký. Từ chối nếu state không khớp (chống trang lạ đẩy mã vào cổng tạm).
function getTicket() {
  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(16))

  return new Promise((resolve, reject) => {
    let redirectUri
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Yêu cầu không hợp lệ')
        return
      }
      res.writeHead(302, { location: `${CLOUD_URL}/done` }).end()
      finish()
      try {
        const r = await fetch(`${CLOUD_URL}/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: url.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirectUri }),
        })
        const body = await r.json()
        if (!r.ok || !body.ticket) throw new Error('Máy chủ dịch vụ không cấp vé')
        resolve(body.ticket)
      } catch (error) {
        reject(error)
      }
    })
    const timer = setTimeout(() => {
      finish()
      reject(new Error('Hết thời gian chờ đăng nhập'))
    }, WAIT_MS)
    function finish() {
      clearTimeout(timer)
      server.close()
    }
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${server.address().port}/callback`
      const auth = new URL(`${CLOUD_URL}/authorize`)
      auth.search = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: 'S256', state }).toString()
      openInBrowser(auth.toString())
    })
  })
}

// Đưa vé cho máy chính (Fastify) đổi lấy phiên của văn phòng.
async function exchangeTicket(backendUrl, ticket) {
  const r = await fetch(`${backendUrl}/api/v1/auth/desktop-ticket`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket }),
  })
  const body = await r.json()
  if (!r.ok) throw new Error(body.error || 'Máy chính từ chối vé')
  return body
}

module.exports = { cloudPublicKey, getTicket, exchangeTicket }
