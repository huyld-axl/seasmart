// Tên và chỗ của từng tệp trong thư mục hồ sơ dễ đọc (docs/mcah-ke-hoach-desktop-gd4.md 3.2, kế hoạch tổng mục 5.5).
// Hàm thuần: nhận dữ liệu hồ sơ, trả đường dẫn tương đối (dấu /). file_store.js lo phần ghi / chuyển trên đĩa.
const path = require('path')

const MAX_PATH = 200
// Nhóm theo nhãn của tab Giấy tờ (frontend certificateView.js CATEGORY).
const GROUPS = {
  DOCUMENT: '01 Tuỳ thân',
  COMPETENCY: '02 Bằng (COC)',
  STCW: '03 Chứng chỉ (COP)',
  VN: '03 Chứng chỉ (COP)',
  MEDICAL: '04 Y tế',
  OTHER: '05 Khác',
  PANAMA: '05 Khác',
}
const PHOTO_GROUP = '06 Ảnh'
const SENT_GROUP = '07 Hồ sơ đã gửi'
const OLD = 'Bản cũ'

// Bỏ ký tự Windows cấm và ký tự điều khiển, gộp khoảng trắng, chuẩn NFC, không kết thúc bằng dấu chấm / khoảng trắng.
function clean(text, max = 80) {
  const s = String(text ?? '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, '')
  return s || 'Không tên'
}

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

function seafarerFolder(s) {
  return `Thuyền viên/${clean(`${clean(s.full_name, 60).toUpperCase()} - ${s.seafarer_code || `TV${s.id}`}`, 90)}`
}

function partnerFolder(o) {
  return `Đối tác/${clean(o.company_name, 80)}`
}

// Giấy tờ: <nhóm>/[Bản cũ/]<loại> - <số> - hết hạn <năm-tháng-ngày>.<đuôi>
function certificatePath(seafarer, cert, ext) {
  const parts = [clean(cert.type_name || cert.display_name || 'Giấy tờ', 60)]
  if (cert.certificate_number) parts.push(clean(cert.certificate_number, 30))
  if (cert.expiry_date) parts.push(`hết hạn ${day(cert.expiry_date)}`)
  const group = GROUPS[cert.category] || GROUPS.OTHER
  return fit(`${seafarerFolder(seafarer)}/${group}${cert.superseded ? `/${OLD}` : ''}/${parts.join(' - ')}${ext}`)
}

const photoPath = (seafarer, ext) => `${seafarerFolder(seafarer)}/${PHOTO_GROUP}/Chân dung${ext}`

function sentPath(seafarer, send) {
  return fit(`${seafarerFolder(seafarer)}/${SENT_GROUP}/${day(send.sent_at) || 'chưa rõ ngày'} - gửi ${clean(send.partner_name || 'đối tác', 60)}.zip`)
}

const logoPath = (owner, ext) => `${partnerFolder(owner)}/Logo${ext}`

// Cắt tên tệp (giữ đuôi) để cả đường dẫn dưới MAX_PATH ký tự.
function fit(rel) {
  if (rel.length <= MAX_PATH) return rel
  const ext = path.posix.extname(rel)
  const dir = path.posix.dirname(rel)
  const base = path.posix.basename(rel, ext)
  const room = MAX_PATH - dir.length - ext.length - 1
  return `${dir}/${clean(base.slice(0, Math.max(room, 10)))}${ext}`
}

// Hai tệp trùng tên trong một thư mục: thêm " (2)", " (3)". taken: Set đường dẫn đã dùng (so không phân biệt hoa thường).
function unique(rel, taken) {
  const key = (p) => p.toLowerCase()
  if (!taken.has(key(rel))) {
    taken.add(key(rel))
    return rel
  }
  const ext = path.posix.extname(rel)
  const stem = rel.slice(0, rel.length - ext.length)
  for (let i = 2; ; i++) {
    const next = `${stem} (${i})${ext}`
    if (!taken.has(key(next))) {
      taken.add(key(next))
      return next
    }
  }
}

const README = 'Thư mục này do MCAH quản lý.\r\n\r\nXem và copy thoải mái. Muốn thêm, sửa, xoá giấy tờ thì làm trong app MCAH.\r\nĐổi tên, di chuyển hoặc xoá tệp ở đây có thể làm MCAH không tìm thấy tệp.\r\n'

module.exports = { clean, seafarerFolder, partnerFolder, certificatePath, photoPath, sentPath, logoPath, fit, unique, README, GROUPS }
