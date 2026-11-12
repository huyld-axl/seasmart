// Tạo văn phòng trên máy chính (docs/mcah-ke-hoach-desktop-gd2.md 4.3, wireframe 4):
//   prepare(password) — sinh khoá dữ liệu (32 byte, cất bằng két hệ điều hành) và bọc nó bằng mật khẩu sao lưu và
//   mã khôi phục (data-key-wraps.json); trả mã khôi phục để hiện một lần. Gọi lại trước khi tạo xong thì làm lại từ đầu.
//   machineKey() — cặp khoá Ed25519 của máy chính (khoá riêng cất bằng két); tạo một lần, dùng lại khi thử lại.
// Máy không có két an toàn (Ubuntu thiếu gnome-keyring → basic_text) thì không cho tạo văn phòng.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { app, safeStorage } = require('electron')
const { secretStoreAvailable } = require('./settings')
const { setupKeys, wrap, unwrap } = require('./backup')

const file = (name) => path.join(app.getPath('userData'), name)
const protect = (text) => safeStorage.encryptString(text)
const unprotect = (buf) => safeStorage.decryptString(buf)

function requireSecretStore() {
  if (!secretStoreAvailable()) {
    throw new Error('Máy chưa có kho mật khẩu an toàn của hệ điều hành. Trên Ubuntu cài gói gnome-keyring, đăng xuất rồi đăng nhập lại máy, sau đó mở lại MCAH.')
  }
}

function prepare(backupPassword) {
  requireSecretStore()
  if (typeof backupPassword !== 'string' || backupPassword.length < 10) throw new Error('Mật khẩu sao lưu cần ít nhất 10 ký tự')
  const dataKey = crypto.randomBytes(32)
  const { recoveryCode, keys } = setupKeys(app.getPath('userData'), backupPassword, protect)
  const wraps = {
    password: wrap(Buffer.from(keys.password.kek, 'base64'), dataKey),
    recovery: wrap(Buffer.from(keys.recovery.kek, 'base64'), dataKey),
  }
  fs.writeFileSync(file('data-key.bin'), protect(dataKey.toString('base64')), { mode: 0o600 })
  fs.writeFileSync(file('data-key-wraps.json'), JSON.stringify(wraps), { mode: 0o600 })
  return recoveryCode
}

// Khoá dữ liệu (giai đoạn 4 dùng để mã hoá kho tệp và sao lưu).
const dataKey = () => Buffer.from(unprotect(fs.readFileSync(file('data-key.bin'))), 'base64')

// Mở bản bọc bằng khoá bọc (dẫn xuất từ mật khẩu sao lưu hoặc mã khôi phục) → khoá dữ liệu. Dùng để kiểm và khôi phục.
function unwrapDataKey(kind, kek) {
  return unwrap(kek, JSON.parse(fs.readFileSync(file('data-key-wraps.json'), 'utf8'))[kind])
}

function machineKey() {
  requireSecretStore()
  const keyFile = file('machine-key.bin')
  let privateKey
  if (fs.existsSync(keyFile)) {
    privateKey = crypto.createPrivateKey(unprotect(fs.readFileSync(keyFile)))
  } else {
    privateKey = crypto.generateKeyPairSync('ed25519').privateKey
    fs.writeFileSync(keyFile, protect(privateKey.export({ type: 'pkcs8', format: 'pem' })), { mode: 0o600 })
  }
  return { privateKey, publicPem: crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }) }
}

const hasPrepared = () => fs.existsSync(file('data-key.bin')) && fs.existsSync(file('data-key-wraps.json'))

module.exports = { prepare, dataKey, unwrapDataKey, machineKey, hasPrepared, requireSecretStore }
