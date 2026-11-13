// Tạo văn phòng trên máy chính (docs/mcah-ke-hoach-desktop-gd2.md 4.3):
//   machineKey() — cặp khoá Ed25519 của máy chính (khoá riêng cất bằng két); tạo một lần, dùng lại khi thử lại.
// Máy không có két an toàn (Ubuntu thiếu gnome-keyring → basic_text) thì không cho tạo văn phòng.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { app, safeStorage } = require('electron')
const { secretStoreAvailable } = require('./settings')

const file = (name) => path.join(app.getPath('userData'), name)
const protect = (text) => safeStorage.encryptString(text)
const unprotect = (buf) => safeStorage.decryptString(buf)

function requireSecretStore() {
  if (!secretStoreAvailable()) {
    throw new Error('Máy chưa có kho mật khẩu an toàn của hệ điều hành. Trên Ubuntu cài gói gnome-keyring, đăng xuất rồi đăng nhập lại máy, sau đó mở lại MCAH.')
  }
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

// Q14 (docs/mcah-ke-hoach-desktop-gd4.md 3.6): không còn khoá dữ liệu / mật khẩu sao lưu. Máy thử đã tạo ở giai đoạn 2
// còn tệp khoá cũ thì xoá lúc khởi động.
function removeOldKeyFiles() {
  for (const name of ['data-key.bin', 'data-key-wraps.json', 'backup-keys.json', 'backup-keys.bin']) fs.rmSync(file(name), { force: true })
}

// Máy vừa được hỗ trợ MCAH nạp bản chụp (--restore): lần đăng nhập đầu phải chuyển máy chính trên máy chủ dịch vụ.
const MOVE = 'machine-move.json'
const pendingMove = () => fs.existsSync(file(MOVE))
const markMove = (officeId) => fs.writeFileSync(file(MOVE), JSON.stringify({ office_id: officeId, at: new Date().toISOString() }))
const clearMove = () => fs.rmSync(file(MOVE), { force: true })

module.exports = { machineKey, requireSecretStore, removeOldKeyFiles, pendingMove, markMove, clearMove }
