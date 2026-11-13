// Cổng ký nội bộ (docs/mcah-ke-hoach-desktop-gd2.md 4.2): backend không giữ khoá máy chính. Backend gửi
// POST http://127.0.0.1:<cổng>/call { office_id, path, body } kèm x-signer-token (mã ngẫu nhiên mỗi lần chạy app);
// tiến trình chính ký Ed25519 bằng khoá máy chính rồi gửi tới máy chủ dịch vụ, trả { status, body }.
// Chuỗi đem ký khớp cloud/src/routes/api.js: "POST\n<path>\n<time>\n<sha256 hex của thân>".
const http = require('http')
const crypto = require('crypto')

const ALLOWED = /^\/api\/office\/(invites|invites\/revoke|members\/remove|members\/restore|machine\/lan)$|^\/api\/(ai\/vision|vessels\/imo\/\d{7}|vessels\/catalog)$/

function start({ cloudUrl, machineKey }) {
  const token = crypto.randomBytes(24).toString('base64url')
  const server = http.createServer((req, res) => {
    const reply = (status, data) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data))
    if (req.method !== 'POST' || req.url !== '/call') return reply(404, {})
    const given = Buffer.from(String(req.headers['x-signer-token'] || ''))
    if (given.length !== token.length || !crypto.timingSafeEqual(given, Buffer.from(token))) return reply(401, {})
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 40 * 1024 * 1024) req.destroy()
    })
    req.on('end', async () => {
      try {
        const { office_id: officeId, path, method = 'POST', body } = JSON.parse(raw)
        const cleanPath = String(path).split('?')[0]
        if (!ALLOWED.test(cleanPath) || !/^[0-9a-f-]{36}$/.test(officeId) || !['GET', 'POST'].includes(method)) return reply(400, { error: 'Yêu cầu ký không hợp lệ' })
        const payload = method === 'GET' ? '' : JSON.stringify(body ?? {})
        const time = String(Date.now())
        const input = `${method}\n${cleanPath}\n${time}\n${crypto.createHash('sha256').update(payload).digest('hex')}`
        const signature = crypto.sign(null, Buffer.from(input), machineKey().privateKey).toString('base64')
        let r
        try {
          r = await fetch(`${cloudUrl()}${path}`, {
            method,
            headers: { 'content-type': 'application/json', 'x-mcah-office': officeId, 'x-mcah-time': time, 'x-mcah-signature': signature },
            body: method === 'GET' ? undefined : payload,
            signal: AbortSignal.timeout(130000),
          })
        } catch {
          return reply(503, { error: 'Không kết nối được máy chủ MCAH. Cần kết nối internet.', code: 'CLOUD_OFFLINE' })
        }
        const text = await r.text()
        let data = {}
        try {
          data = text ? JSON.parse(text) : {}
        } catch {
          data = { message: text.slice(0, 200) }
        }
        reply(200, { status: r.status, body: data })
      } catch (error) {
        reply(500, { error: error.message })
      }
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, token, close: () => server.close() }))
  })
}

module.exports = { start }
