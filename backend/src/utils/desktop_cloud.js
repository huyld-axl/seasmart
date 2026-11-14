// Gọi máy chủ dịch vụ từ máy chính của app máy tính (docs/mcah-ke-hoach-desktop-gd2.md 4.2): qua cổng ký của tiến trình
// chính (MCAH_SIGNER_URL + MCAH_SIGNER_TOKEN), vì khoá máy chính không nằm ở backend. Chỉ bật khi chạy desktop và máy đã
// có văn phòng (office_info). Lỗi: { statusCode, message, code } như mọi lỗi của backend.
const config = require('../config')
const pool = require('../config/db')

const SIGNER_URL = process.env.MCAH_SIGNER_URL || ''
const SIGNER_TOKEN = process.env.MCAH_SIGNER_TOKEN || ''

async function officeId(db = pool) {
  const [rows] = await db.query('SELECT office_id FROM office_info WHERE id = 1')
  return rows[0]?.office_id || null
}

const desktopCloud = {
  async enabled(db = pool) {
    return Boolean(config.desktop && SIGNER_URL && (await officeId(db)))
  },

  // → body của máy chủ dịch vụ; lỗi mạng → 503 CLOUD_OFFLINE; máy chủ từ chối → giữ mã và câu báo của máy chủ.
  async call(path, body, { method = 'POST', db = pool } = {}) {
    const office = await officeId(db)
    if (!SIGNER_URL || !office) throw { statusCode: 503, message: 'Máy chưa có văn phòng', code: 'NO_OFFICE' }
    let r
    try {
      r = await fetch(`${SIGNER_URL}/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signer-token': SIGNER_TOKEN },
        body: JSON.stringify({ office_id: office, path, method, body }),
        signal: AbortSignal.timeout(140000),
      })
    } catch {
      throw { statusCode: 503, message: 'App chưa sẵn sàng gọi máy chủ MCAH, thử lại', code: 'SIGNER_DOWN' }
    }
    const data = await r.json().catch(() => ({}))
    if (r.status !== 200) throw { statusCode: r.status === 503 ? 503 : 502, message: data.error || 'Không gọi được máy chủ MCAH', code: data.code || 'CLOUD_ERROR' }
    if (data.status >= 400) {
      throw { statusCode: data.status === 403 ? 403 : data.status >= 500 ? 502 : 400, message: data.body?.message || 'Máy chủ MCAH từ chối', code: data.body?.error === 'office_locked' ? 'OFFICE_LOCKED' : 'CLOUD_REJECTED' }
    }
    return data.body
  },

  // Máy chính báo chứng chỉ HTTPS trong mạng văn phòng (docs/mcah-ke-hoach-desktop-gd3.md 3.1); tiến trình chính truyền
  // dấu vân tay / tên / cổng qua biến môi trường. Gọi lúc mở app (lặp mỗi giờ tới khi được) và ngay sau khi tạo văn phòng.
  // Trả true khi đã báo xong.
  async registerLan(db = pool) {
    const fingerprint = process.env.MCAH_LAN_FINGERPRINT
    if (!fingerprint || !(await desktopCloud.enabled(db))) return false
    await desktopCloud.call('/api/office/machine/lan', { fingerprint, name: process.env.MCAH_LAN_NAME, port: Number(process.env.MCAH_LAN_PORT) }, { db })
    return true
  },
}

module.exports = desktopCloud
