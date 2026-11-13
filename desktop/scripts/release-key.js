// Khoá Ed25519 ký bản phát hành (docs/mcah-ke-hoach-desktop-gd6.md 3.1).
//   Khoá công khai: build/release-public-key.pem, TRONG repo — mọi máy build (Ubuntu, Windows) gói cùng một khoá.
//   Khoá riêng: chỉ máy phát hành giữ, desktop/.release/release-key.pem (không commit, không vào bộ cài). Mất khoá này
//   thì app đã cài không nhận bản cập nhật mới nữa: cất một bản sao ngoài máy (USB, két).
//   node scripts/release-key.js --init   sinh cặp khoá lần đầu (từ chối nếu đã có), ghi khoá công khai vào build/
//   node scripts/release-key.js --public ghi lại build/release-public-key.pem từ khoá riêng đang có
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const FILE = path.join(__dirname, '../.release/release-key.pem')
const PUBLIC_FILE = path.join(__dirname, '../build/release-public-key.pem')

const publicKeyPem = () => fs.readFileSync(PUBLIC_FILE, 'utf8')

// Chỉ máy phát hành gọi. Thiếu khoá riêng hoặc không khớp khoá công khai trong repo thì dừng.
function privateKey() {
  if (!fs.existsSync(FILE)) throw new Error(`Máy này không có khoá riêng ký bản phát hành (${FILE}). Chỉ máy phát hành mới phát hành được.`)
  const key = crypto.createPrivateKey(fs.readFileSync(FILE))
  const derived = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' })
  if (derived.trim() !== publicKeyPem().trim()) throw new Error('Khoá riêng không khớp build/release-public-key.pem trong repo. Không phát hành.')
  return key
}

function writePublic(key) {
  fs.writeFileSync(PUBLIC_FILE, crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' }))
  console.log(`Đã ghi ${path.relative(process.cwd(), PUBLIC_FILE)} — commit tệp này.`)
}

if (require.main === module) {
  if (process.argv.includes('--init')) {
    if (fs.existsSync(FILE)) throw new Error('Đã có khoá riêng, không sinh lại (sinh lại là app đã cài không nhận bản mới).')
    fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 })
    const { privateKey: key } = crypto.generateKeyPairSync('ed25519')
    fs.writeFileSync(FILE, key.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
    writePublic(key)
  } else if (process.argv.includes('--public')) {
    writePublic(crypto.createPrivateKey(fs.readFileSync(FILE)))
  }
}

module.exports = { privateKey, publicKeyPem, PUBLIC_FILE }
