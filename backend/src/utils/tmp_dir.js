// Thư mục tạm riêng của app (docs/mcah-ke-hoach-desktop-gd4.md 3.1): tệp Excel / PDF chuyển đổi, tệp nhập Excel…
// App máy tính đặt MCAH_TMP_DIR = <userData>/tmp và xoá toàn bộ lúc khởi động (không sót sau mất điện / crash).
// Bản web: <thư mục tạm hệ thống>/mcah.
const fs = require('fs')
const os = require('os')
const path = require('path')

function tmpRoot() {
  const dir = process.env.MCAH_TMP_DIR || path.join(os.tmpdir(), 'mcah')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

module.exports = { tmpRoot }
