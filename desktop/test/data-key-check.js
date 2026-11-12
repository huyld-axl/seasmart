// Kiểm khoá dữ liệu của một văn phòng đã tạo: mở bản bọc bằng mật khẩu sao lưu và bằng mã khôi phục phải ra cùng
// khoá dữ liệu đang cất trong két. Chạy: electron test/data-key-check.js --user-data-dir=<thư mục>
// (MCAH_BACKUP_PASSWORD, MCAH_RECOVERY_CODE). Chỉ để thử, không nằm trong app.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { app, safeStorage } = require('electron')

app.setName('MCAH')
app.whenReady().then(() => {
  const dir = app.getPath('userData')
  const keys = JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(dir, 'backup-keys.bin'))))
  const wraps = JSON.parse(fs.readFileSync(path.join(dir, 'data-key-wraps.json'), 'utf8'))
  const dataKey = Buffer.from(safeStorage.decryptString(fs.readFileSync(path.join(dir, 'data-key.bin'))), 'base64')
  const kdf = (secret, salt) => crypto.scryptSync(secret.normalize('NFC'), Buffer.from(salt, 'base64'), 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  const unwrap = (kek, w) => {
    const d = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(w.iv, 'base64'))
    d.setAuthTag(Buffer.from(w.tag, 'base64'))
    return Buffer.concat([d.update(Buffer.from(w.key, 'base64')), d.final()])
  }
  const byPassword = unwrap(kdf(process.env.MCAH_BACKUP_PASSWORD, keys.password.salt), wraps.password)
  const byRecovery = unwrap(kdf(process.env.MCAH_RECOVERY_CODE.replace(/-/g, ''), keys.recovery.salt), wraps.recovery)
  let wrong = 'mở được (SAI)'
  try { unwrap(kdf('mat-khau-sai-123', keys.password.salt), wraps.password) } catch { wrong = 'bị từ chối' }
  console.log(`KẾT QUẢ: bằng mật khẩu ${byPassword.equals(dataKey) ? 'khớp' : 'KHÔNG khớp'}; bằng mã khôi phục ${byRecovery.equals(dataKey) ? 'khớp' : 'KHÔNG khớp'}; mật khẩu sai ${wrong}`)
  app.exit(0)
})
