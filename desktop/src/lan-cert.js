// Chứng chỉ HTTPS của máy chính trong mạng văn phòng (docs/mcah-ke-hoach-desktop-gd3.md 3.1): ECDSA P-256 tự ký,
// hạn 10 năm, tạo một lần. Máy nhân viên không tin kho CA mà ghim theo dấu vân tay SHA-256 (máy chủ dịch vụ giữ, vé mang).
// Khoá riêng cất bằng két hệ điều hành như khoá máy chính.
require('reflect-metadata')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const x509 = require('@peculiar/x509')
const { app, safeStorage } = require('electron')

x509.cryptoProvider.set(crypto.webcrypto)

const ALG = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }
const file = (name) => path.join(app.getPath('userData'), name)

// Dấu vân tay: SHA-256 hex của chứng chỉ dạng DER — Node trả cùng giá trị ở socket.getPeerCertificate().fingerprint256.
const fingerprintOf = (pem) => new crypto.X509Certificate(pem).fingerprint256.replace(/:/g, '').toLowerCase()

async function ensureCert(hostName) {
  // v2: chứng chỉ có CA:TRUE (bản đầu không có, máy nhân viên Electron không ghim được).
  const certFile = file('lan-cert-v2.pem')
  const keyFile = file('lan-key-v2.bin')
  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    try {
      const cert = fs.readFileSync(certFile, 'utf8')
      return { cert, key: safeStorage.decryptString(fs.readFileSync(keyFile)), fingerprint: fingerprintOf(cert) }
    } catch (error) {
      // Tệp hỏng (vd. bản thử cũ): tạo lại; backend báo dấu vân tay mới lên máy chủ dịch vụ.
      console.error(`Chứng chỉ trong mạng văn phòng hỏng, tạo lại: ${error.message}`)
    }
  }
  const keys = await crypto.webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify'])
  const created = await x509.X509CertificateGenerator.createSelfSigned({
    // Số sê-ri dương (byte đầu < 0x80): BoringSSL của Electron từ chối số âm.
    serialNumber: `01${crypto.randomBytes(8).toString('hex')}`,
    name: `CN=${hostName.replace(/[^A-Za-z0-9._-]/g, '-')}, O=MCAH`,
    notBefore: new Date(Date.now() - 24 * 3600 * 1000),
    notAfter: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000),
    keys,
    signingAlgorithm: ALG,
    // BoringSSL của Electron: danh sách phần mở rộng rỗng là chứng chỉ hỏng, và chỉ nhận chứng chỉ tự ký làm gốc tin cậy
    // (ca của máy nhân viên) khi có CA:TRUE + keyCertSign. Chứng chỉ chỉ dùng cho máy này, khoá không ký gì khác.
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyCertSign, true),
    ],
  })
  // Qua JWK: Node trong Electron (BoringSSL) không đọc được PKCS#8 DER do WebCrypto xuất.
  const jwk = await crypto.webcrypto.subtle.exportKey('jwk', keys.privateKey)
  const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' }).export({ type: 'pkcs8', format: 'pem' })
  const cert = created.toString('pem')
  const fingerprint = fingerprintOf(cert)
  fs.writeFileSync(keyFile, safeStorage.encryptString(key), { mode: 0o600 })
  fs.writeFileSync(certFile, cert)
  return { cert, key, fingerprint }
}

module.exports = { ensureCert, fingerprintOf }
