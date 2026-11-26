// Thư mục tạm riêng của app (docs/catoro-ke-hoach-desktop-gd4.md 3.1): tệp Excel / PDF chuyển đổi, tệp nhập Excel…
// App máy tính đặt CATORO_TMP_DIR = <userData>/tmp và xoá toàn bộ lúc khởi động (không sót sau mất điện / crash).
// Bản web: <thư mục tạm hệ thống>/catoro.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { productEnv } = require('./env')

function tmpRoot() {
  const dir = productEnv('TMP_DIR') || path.join(os.tmpdir(), 'catoro')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

module.exports = { tmpRoot }
