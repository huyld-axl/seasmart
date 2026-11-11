// Khoá Ed25519 ký bản phát hành. Chỉ máy phát hành giữ khoá riêng (desktop/.release/, không commit).
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const FILE = path.join(__dirname, '../.release/release-key.pem')

function privateKey() {
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 })
    const { privateKey: key } = crypto.generateKeyPairSync('ed25519')
    fs.writeFileSync(FILE, key.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  }
  return crypto.createPrivateKey(fs.readFileSync(FILE))
}

const publicKeyPem = () => crypto.createPublicKey(privateKey()).export({ type: 'spki', format: 'pem' })

module.exports = { privateKey, publicKeyPem }
