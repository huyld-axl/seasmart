// Gửi SMS qua cổng HTTP của nhà mạng/đối tác (cấu hình bằng env).
// SMS_WEBHOOK_URL nhận POST JSON { to, text }; SMS_WEBHOOK_TOKEN gửi kèm dạng Bearer.
// Chưa cấu hình thì báo 503, không bao giờ giả là đã gửi.

const TIMEOUT_MS = 10000

// Bỏ dấu tiếng Việt để tin nhắn đi bằng bảng mã GSM (rẻ và không vỡ chữ trên máy cũ).
function toAscii(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

// Số Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx → +84xxxxxxxxx.
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[\s.\-()]/g, '')
  if (/^\+84\d{9}$/.test(digits)) return digits
  if (/^84\d{9}$/.test(digits)) return `+${digits}`
  if (/^0\d{9}$/.test(digits)) return `+84${digits.slice(1)}`
  return null
}

function maskPhone(phone) {
  return phone ? `${phone.slice(0, -6)}***${phone.slice(-3)}` : ''
}

const smsService = {
  isConfigured() {
    return Boolean(process.env.SMS_WEBHOOK_URL && process.env.APP_URL)
  },

  async send(to, text) {
    if (!this.isConfigured()) throw { statusCode: 503, message: 'Chưa cấu hình gửi SMS (SMS_WEBHOOK_URL, APP_URL)' }
    const headers = { 'content-type': 'application/json' }
    if (process.env.SMS_WEBHOOK_TOKEN) headers.authorization = `Bearer ${process.env.SMS_WEBHOOK_TOKEN}`
    let res
    try {
      res = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to, text: toAscii(text) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw { statusCode: 502, message: 'Không kết nối được cổng SMS. Thử lại sau.' }
    }
    if (!res.ok) throw { statusCode: 502, message: `Cổng SMS từ chối (mã ${res.status}). Chép link gửi tay.` }
    return { sent_to: maskPhone(to) }
  },
}

module.exports = { smsService, toAscii, normalizePhone, maskPhone }
