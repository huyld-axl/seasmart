import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Kho tệp (docs/mcah-ke-hoach-desktop-gd4.md 3.1): chỉ file_store / tmp_dir / file_trash được đụng UPLOAD_DIR và thư mục
// hồ sơ; service, route không gọi fs đọc / ghi / xoá tệp. Ngoại lệ có lý do ghi ở ALLOW.
const SRC = path.resolve(__dirname, '../..')
const STORE = new Set(['utils/file_store.js', 'utils/tmp_dir.js', 'utils/file_trash.js', 'config/index.js'])
const ALLOW = {
  'routes/v1/import.routes.js': 'tệp nhập Excel trong thư mục tạm của app',
  'services/email.service.js': 'đọc mẫu thư trong mã nguồn',
  'services/form_export.service.js': 'đọc tệp mẫu biểu mẫu trong mã nguồn',
  'services/opportunity_mail.service.js': 'ghi tệp đính kèm vào thư mục gửi thư của app mail (MAIL_DIR)',
  'plugins/maintenance.js': 'kiểm tệp cờ bảo trì do app máy tính tạo',
  'utils/xlsx_pdf.js': 'tệp Excel / PDF chuyển đổi trong thư mục tạm của app',
}
const FS_CALL = /\bfs\.(promises\.)?(readFile|writeFile|createReadStream|createWriteStream|rm|rmSync|unlink|unlinkSync|existsSync|readFileSync|writeFileSync|copyFile|rename|renameSync|mkdirSync|readdirSync)\b/

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full, out) } else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

describe('kho tệp', () => {
  it('không service / route nào đụng thẳng UPLOAD_DIR hay gọi fs ngoài lớp kho tệp', () => {
    const bad = []
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join('/')
      if (STORE.has(rel) || rel.startsWith('jobs') || rel === 'server.js') continue
      const text = fs.readFileSync(file, 'utf8')
      if (/config\.upload\.dir|UPLOAD_DIR|MCAH_FILES_DIR/.test(text)) bad.push(`${rel}: dùng thẳng thư mục kho tệp`)
      if (!ALLOW[rel] && FS_CALL.test(text)) bad.push(`${rel}: gọi fs`)
    }
    expect(bad).toEqual([])
  })
})
