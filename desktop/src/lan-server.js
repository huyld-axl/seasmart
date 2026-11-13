// Cổng HTTPS của máy chính trong mạng văn phòng (docs/mcah-ke-hoach-desktop-gd3.md 3.1, 3.3). Chỉ chuyển tiếp vào
// Fastify (vẫn chỉ nghe 127.0.0.1) những đường cho máy nhân viên: /lan/hello, /lan/pair, /lan/installer/*, /api/*, /public/*.
// Mọi request đi qua đây được gắn x-mcah-lan = mã bí mật của lần chạy này: backend biết là từ máy khác và bắt buộc mã
// thiết bị (plugins/lan_device.js). Request có x-mcah-protocol khác PROTOCOL thì trả 426 để máy nhân viên cập nhật.
const https = require('https')
const http = require('http')
const crypto = require('crypto')
const { PROTOCOL } = require('./lan')

const ROUTES = /^\/(lan\/hello|lan\/pair|lan\/pair\/status|lan\/installer\/[A-Za-z0-9._%-]+|api\/.+|public\/.+)$/
const HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer', 'host']

// secret: tạo trước khi chạy backend (newSecret) và truyền cho backend qua MCAH_LAN_SECRET.
const newSecret = () => crypto.randomBytes(24).toString('base64url')

function start({ cert, key, port, secret, backendUrl, appVersion, installerFor }) {
  const server = https.createServer({ cert, key, minVersion: 'TLSv1.2' }, (req, res) => {
    const reply = (status, data) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data))
    const url = new URL(req.url, 'https://lan')
    if (!ROUTES.test(url.pathname) || url.pathname.includes('..')) return reply(404, { error: 'Không có' })
    const proto = req.headers['x-mcah-protocol']
    if (proto !== undefined && Number(proto) !== PROTOCOL && !url.pathname.startsWith('/lan/')) {
      return reply(426, { error: 'Máy này cần cập nhật để nối máy chính', code: 'UPDATE_REQUIRED', protocol: PROTOCOL, version: appVersion() })
    }
    // Bộ cài cho máy nhân viên (giai đoạn 3 bước 8): tiến trình chính phục vụ thẳng, sau khi backend kiểm mã thiết bị.
    const backendPath = url.pathname.startsWith('/lan/') ? `/api/v1${url.pathname}` : url.pathname
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !HOP.includes(k) && k !== 'x-mcah-lan' && k !== 'x-mcah-lan-ip'))
    headers['x-mcah-lan'] = secret
    headers['x-mcah-lan-ip'] = req.socket.remoteAddress || ''
    const target = new URL(backendPath + url.search, backendUrl())
    const upstream = http.request(target, { method: req.method, headers }, (r) => {
      // Bộ cài: backend chỉ trả { ok } sau khi kiểm thiết bị; tiến trình chính gửi tệp.
      if (url.pathname.startsWith('/lan/installer/') && r.statusCode === 200) {
        r.resume()
        return installerFor(decodeURIComponent(url.pathname.split('/').pop()), res)
      }
      res.writeHead(r.statusCode, Object.fromEntries(Object.entries(r.headers).filter(([k]) => !HOP.includes(k))))
      r.pipe(res)
    })
    upstream.on('error', () => reply(503, { error: 'Máy chính đang khởi động, thử lại sau ít giây', code: 'MAIN_STARTING' }))
    req.pipe(upstream)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => resolve({ secret, port, close: () => server.close() }))
  })
}

module.exports = { start, newSecret }
