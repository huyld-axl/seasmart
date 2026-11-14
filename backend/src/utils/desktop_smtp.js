// Cấu hình SMTP của người gửi trong app máy tính: tiến trình chính của app gắn vào header x-mcah-smtp (base64 JSON)
// lúc chuyển tiếp yêu cầu, giao diện không thấy mật khẩu. Chỉ nhận khi chạy chế độ máy tính và yêu cầu đến từ máy này.
const config = require('../config')

function desktopSmtp(request) {
  const raw = request.headers['x-mcah-smtp']
  if (!config.desktop || !raw || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip)) return null
  try {
    const smtp = JSON.parse(Buffer.from(String(raw), 'base64').toString('utf8'))
    if (typeof smtp.host !== 'string' || !Number.isInteger(smtp.port) || typeof smtp.user !== 'string' || typeof smtp.password !== 'string') return null
    return smtp
  } catch {
    return null
  }
}

module.exports = { desktopSmtp }
