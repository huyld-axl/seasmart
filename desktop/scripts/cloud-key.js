// Dấu vân tay bộ khoá kiểm vé đăng nhập (một hay nhiều khoá PEM): sha256 các khoá SPKI DER đã sắp xếp.
const crypto = require('crypto')

function fingerprint(pems) {
  const blocks = String(pems).match(/-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/g) || []
  if (!blocks.length) throw new Error('Không có khoá công khai nào')
  const ders = blocks.map((b) => crypto.createPublicKey(b).export({ type: 'spki', format: 'der' }).toString('hex')).sort()
  return crypto.createHash('sha256').update(ders.join('\n')).digest('hex')
}

async function fetchFingerprint(cloudUrl) {
  const url = `${cloudUrl.replace(/\/+$/, '')}/.well-known/mcah-keys`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Không lấy được khoá công khai từ ${url} (${r.status})`)
  const { keys } = await r.json()
  return fingerprint(keys.map((k) => crypto.createPublicKey(k.pem).export({ type: 'spki', format: 'pem' })).join(''))
}

module.exports = { fingerprint, fetchFingerprint }
