// Địa chỉ máy chủ dịch vụ và chỗ phát bản cập nhật (docs/mcah-ke-hoach-desktop-gd6.md 3.9).
// Thứ tự: biến môi trường (chạy dev) → địa chỉ app đã học từ latest.json có chữ ký → địa chỉ gói lúc build.
// Đổi tên miền: sửa desktop/endpoints.json rồi phát một bản (kể cả không đổi code). App đang chạy kiểm bản mới, thấy
// `endpoints` trong latest.json đã ký thì lưu lại và từ đó dùng địa chỉ mới, không cần cài lại. Chữ ký bảo đảm không ai giả
// được để lái app sang máy chủ lạ. Tên miền cũ nên giữ chuyển hướng (308) vài tháng cho máy chưa kịp kiểm bản mới.
const fs = require('fs')
const { cloudUrlFile, updateUrlFile } = require('./paths')
const { getSettings, saveSettings } = require('./settings')

const clean = (u) => String(u || '').trim().replace(/\/+$/, '')
const fromFile = (file) => (fs.existsSync(file) ? clean(fs.readFileSync(file, 'utf8')) : '')
const learned = () => getSettings().endpoints || {}

const cloudUrl = () => clean(process.env.MCAH_CLOUD_URL) || learned().cloud_url || fromFile(cloudUrlFile) || 'http://localhost:4100'
const updateUrl = () => clean(process.env.MCAH_UPDATE_URL) || learned().update_url || fromFile(updateUrlFile)

// Chỉ nhận https (máy dev: http://localhost / 127.0.0.1).
function valid(u) {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' || (url.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(url.hostname))
  } catch {
    return false
  }
}

// Gọi với `endpoints` của latest.json SAU KHI đã kiểm chữ ký. → true nếu đã đổi địa chỉ.
function learn(endpoints) {
  if (!endpoints || !valid(endpoints.cloud_url) || !valid(endpoints.update_url)) return false
  const next = { cloud_url: clean(endpoints.cloud_url), update_url: clean(endpoints.update_url) }
  const now = learned()
  if (now.cloud_url === next.cloud_url && now.update_url === next.update_url) return false
  if (!now.cloud_url && next.cloud_url === fromFile(cloudUrlFile) && next.update_url === fromFile(updateUrlFile)) return false
  saveSettings({ endpoints: next })
  console.error(`Đổi địa chỉ máy chủ theo bản tin cập nhật: ${next.cloud_url}, ${next.update_url}`)
  return true
}

module.exports = { cloudUrl, updateUrl, learn, valid }
