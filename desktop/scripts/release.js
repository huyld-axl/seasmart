// Ký và gom bản phát hành vào dist/updates/ (chỗ phát thử): latest.json + các bộ cài của phiên bản hiện tại.
// Khoá ký nằm ở desktop/.release/release-key.pem (không commit); tạo mới nếu chưa có.
//   node scripts/release.js
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { canonical } = require('../src/manifest')

const DESKTOP = path.join(__dirname, '..')
const { name: pkgName, version, build } = require(path.join(DESKTOP, 'package.json'))
const INSTALLERS = path.join(DESKTOP, build.directories.output)
const OUT = path.join(DESKTOP, 'dist/updates')

const key = require('./release-key').privateKey()
const files = {}
for (const [platform, name] of [['linux', `${pkgName}_${version}_amd64.deb`], ['win', `${build.productName} Setup ${version}.exe`]]) {
  const src = path.join(INSTALLERS, name)
  if (!fs.existsSync(src)) continue
  const data = fs.readFileSync(src)
  files[platform] = { name, sha256: crypto.createHash('sha256').update(data).digest('hex'), size: data.length }
}
if (!Object.keys(files).length) throw new Error(`Không có bộ cài ${version} trong ${INSTALLERS}`)

fs.mkdirSync(OUT, { recursive: true })
for (const { name } of Object.values(files)) fs.copyFileSync(path.join(INSTALLERS, name), path.join(OUT, name))
const signed = { version, files }
const signature = crypto.sign(null, Buffer.from(canonical(signed)), key).toString('base64')
fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify({ ...signed, signature }, null, 2))
console.log(`Đã phát ${version}: ${Object.keys(files).join(', ')}`)
