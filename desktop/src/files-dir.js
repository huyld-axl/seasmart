// Thư mục hồ sơ dễ đọc mặc định (docs/catoro-ke-hoach-doi-ten.md 3.4). Máy cài từ 0.9.14: Tài liệu/Catoro - Hồ sơ.
// Máy đã dùng MCAH: cài đặt chưa ghi filesDir nghĩa là đang dùng mặc định cũ "MCAH - Hồ sơ". Ghim đường dẫn đó vào cài đặt,
// không chuyển tệp, không đổi tên thư mục.
const fs = require('fs')
const path = require('path')

const DEFAULT_NAME = 'Catoro - Hồ sơ'
const LEGACY_NAME = 'MCAH - Hồ sơ'

const defaultFilesDir = (documentsDir) => path.join(documentsDir, DEFAULT_NAME)

// Đường dẫn cần ghim, hoặc null nếu không cần (đã đặt thư mục, hoặc máy chưa từng có thư mục cũ).
function legacyFilesDirToPin({ savedFilesDir, documentsDir, exists = fs.existsSync }) {
  if (savedFilesDir) return null
  const legacy = path.join(documentsDir, LEGACY_NAME)
  return exists(legacy) ? legacy : null
}

module.exports = { defaultFilesDir, legacyFilesDirToPin }
