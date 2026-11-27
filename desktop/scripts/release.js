// Phát hành (docs/catoro-ke-hoach-desktop-gd6.md 3.2, 3.3): gom bộ cài Ubuntu + Windows + macOS (chip Apple, chip Intel) cùng phiên bản, ký latest.json,
// đặt vào dist/updates/<kênh>/ rồi (nếu có CATORO_RELEASE_TARGET, tên cũ MCAH_RELEASE_TARGET vẫn nhận) đẩy lên server: bộ cài trước, latest.json sau cùng.
//   npm run release -- --channel beta|stable      phát bản đang ở desktop/package.json
//   npm run release -- --promote 1.2.0            đưa bản beta 1.2.0 đã phát sang kênh ổn định (không build lại)
// Chặn (không phát gì) khi: thiếu .deb, .exe hoặc một trong hai .dmg, các bản khác phiên bản / commit, có thay đổi chưa commit, chưa quét bí mật,
// thiếu release-notes/<phiên bản>.md, khoá riêng không khớp khoá công khai trong repo.
// Thư mục kênh có thêm releases.json: các bản còn giữ (KEEP bản gần nhất), trang tải hiện ở mục "Bản cũ hơn".
// CATORO_RELEASE_TARGET: đích rsync, vd. mcah-release@mcah.axalize.vn:/srv/mcah/releases
// latest.json mang `endpoints` (desktop/endpoints.json): đổi tên miền thì sửa tệp đó và phát bản mới, app tự học (3.9).
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const { productEnv } = require('../src/env')
const { canonical } = require('../src/manifest')

const DESKTOP = path.join(__dirname, '..')
const KEEP = 3

// [khoá trong latest.json (PLATFORM của src/updater.js), tên đọc được, tên bộ cài electron-builder đặt]
const PLATFORMS = (pkgName, productName, version) => [
  ['linux', 'Ubuntu', `${pkgName}_${version}_amd64.deb`],
  ['win', 'Windows', `${productName} Setup ${version}.exe`],
  ['mac-arm64', 'macOS chip Apple', `${productName}-${version}-arm64.dmg`],
  ['mac-x64', 'macOS chip Intel', `${productName}-${version}-x64.dmg`],
]

// allowMissing: nền tảng được phép vắng mặt (vd. ['win'] khi chưa build được bản Windows; 'mac' = cả hai bản macOS); bản có mặt vẫn kiểm đủ.
// cloudKey: dấu vân tay khoá máy chủ thật (lấy lúc phát hành); bản gói khoá khác thì không đăng nhập được.
function plan({ desktop = DESKTOP, channel = 'beta', allowMissing = [], cloudKey } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'))
  const { name: pkgName, version, build } = pkg
  const installers = path.join(desktop, build.directories.output)
  const problems = []
  const endpoints = JSON.parse(fs.readFileSync(path.join(desktop, 'endpoints.json'), 'utf8'))
  if (!['beta', 'stable'].includes(channel)) problems.push(`Kênh không hợp lệ: ${channel}`)
  const files = {}
  const infos = {}
  for (const [platform, label, name] of PLATFORMS(pkgName, build.productName, version)) {
    const src = path.join(installers, name)
    const infoFile = path.join(installers, `build-info-${platform}.json`)
    if (!fs.existsSync(src)) {
      if (allowMissing.includes(platform) || allowMissing.includes(platform.split('-')[0])) continue
      problems.push(`Thiếu bộ cài ${label}: ${name}`)
      continue
    }
    if (!fs.existsSync(infoFile)) {
      problems.push(`Thiếu build-info-${platform}.json (bản ${label} chưa chạy đủ npm run dist:${platform.split('-')[0]}, gồm quét bí mật)`)
      continue
    }
    const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'))
    infos[platform] = info
    if (info.version !== version) problems.push(`Bản ${platform} là ${info.version}, không phải ${version}`)
    if (info.scan !== 'clean') problems.push(`Bản ${platform} chưa quét bí mật sạch`)
    if (info.dirty) problems.push(`Bản ${platform} build khi còn thay đổi chưa commit`)
    if (info.cloud_url !== endpoints.cloud_url || info.update_url !== endpoints.update_url) problems.push(`Bản ${platform} gói địa chỉ ${info.update_url} / ${info.cloud_url}, khác endpoints.json`)
    if (cloudKey && info.cloud_key !== cloudKey) problems.push(`Bản ${platform} gói khoá đăng nhập khác khoá máy chủ thật (build lại, không đặt CATORO_CLOUD_URL)`)
    const data = fs.readFileSync(src)
    files[platform] = { name, sha256: crypto.createHash('sha256').update(data).digest('hex'), size: data.length }
  }
  if (!Object.keys(files).length) problems.push('Không có bộ cài nào')
  if (new Set(Object.values(infos).map((i) => i.commit)).size > 1) problems.push(`Các bản khác commit: ${Object.entries(infos).map(([k, i]) => `${k} ${i.commit.slice(0, 8)}`).join(', ')}`)
  const notesFile = path.join(desktop, 'release-notes', `${version}.md`)
  const notes = fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8').trim() : ''
  if (!notes) problems.push(`Thiếu ghi chú thay đổi release-notes/${version}.md`)
  const migrations = path.join(desktop, '../backend/migrations/postgres')
  const lastMigration = fs.existsSync(migrations) ? fs.readdirSync(migrations).filter((n) => /^\d+.*\.sql$/.test(n)).sort().pop() : null
  return { version, files, installers, notes, lastMigration, endpoints, problems, commit: Object.values(infos)[0]?.commit }
}

const sign = (signed, key) => ({ ...signed, signature: crypto.sign(null, Buffer.from(canonical(signed)), key).toString('base64') })

// Giữ KEEP phiên bản gần nhất trong thư mục kênh (bộ cài cũ cho máy cần quay về).
function prune(dir, keepNames) {
  const installers = fs.readdirSync(dir).filter((n) => /\.(deb|exe|dmg)$/.test(n)).map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t)
  const versions = []
  for (const { n } of installers) {
    const v = (/(\d+\.\d+\.\d+)/.exec(n) || [])[1]
    if (v && !versions.includes(v)) versions.push(v)
  }
  const keep = new Set(versions.slice(0, KEEP))
  for (const { n } of installers) if (!keepNames.has(n) && !keep.has((/(\d+\.\d+\.\d+)/.exec(n) || [])[1])) fs.rmSync(path.join(dir, n))
}

// Nền tảng theo tên bộ cài (gồm tên cũ mcah-desktop_*.deb, MCAH Setup *.exe).
function platformOf(name) {
  if (name.endsWith('.deb')) return 'linux'
  if (name.endsWith('.exe')) return 'win'
  if (name.endsWith('-arm64.dmg')) return 'mac-arm64'
  if (name.endsWith('-x64.dmg')) return 'mac-x64'
  return null
}

const versionCmp = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

// Ghi releases.json từ bộ cài đang có trong thư mục kênh (sau prune), mới nhất trước.
// current: bản tin vừa phát (lấy ngày phát). SHA-256 lấy lại từ releases.json cũ khi tệp không đổi, khỏi băm lại.
function writeReleases(dir, current) {
  const file = path.join(dir, 'releases.json')
  let before = []
  try {
    before = JSON.parse(fs.readFileSync(file, 'utf8')).releases || []
  } catch {}
  const byVersion = {}
  for (const name of fs.readdirSync(dir)) {
    const platform = platformOf(name)
    const version = (/(\d+\.\d+\.\d+)/.exec(name) || [])[1]
    if (!platform || !version) continue
    const stat = fs.statSync(path.join(dir, name))
    const prev = before.find((r) => r.version === version)
    const known = prev?.files?.[platform]
    const sha256 = known?.name === name && known.size === stat.size ? known.sha256 : crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex')
    const entry = (byVersion[version] ||= { version, released_at: prev?.released_at || stat.mtime.toISOString(), files: {} })
    entry.files[platform] = { name, sha256, size: stat.size }
  }
  if (byVersion[current.version]) byVersion[current.version].released_at = current.released_at
  const releases = Object.values(byVersion).sort((a, b) => versionCmp(b.version, a.version))
  fs.writeFileSync(file, JSON.stringify({ channel: current.channel, releases }, null, 2))
}

function upload(dir, channel) {
  const target = productEnv('RELEASE_TARGET')
  if (!target) return console.log(`Chưa đặt CATORO_RELEASE_TARGET: bản phát nằm ở ${dir}, chưa đẩy lên server.`)
  const dest = `${target.replace(/\/+$/, '')}/${channel === 'beta' ? 'beta/' : ''}`
  // Bộ cài trước, latest.json + releases.json sau cùng: app / trang tải không bao giờ thấy tệp trỏ bộ cài chưa lên xong.
  execFileSync('rsync', ['-av', '--exclude', 'latest.json', '--exclude', 'releases.json', `${dir}/`, dest], { stdio: 'inherit' })
  execFileSync('rsync', ['-av', path.join(dir, 'releases.json'), path.join(dir, 'latest.json'), dest], { stdio: 'inherit' })
  console.log(`Đã đẩy lên ${dest}`)
}

function release({ channel, key, allowMissing = [], cloudKey }) {
  const p = plan({ channel, allowMissing, cloudKey })
  if (p.problems.length) throw new Error(`Không phát hành ${p.version}:\n- ${p.problems.join('\n- ')}`)
  const dir = path.join(DESKTOP, 'dist/updates', channel)
  fs.mkdirSync(dir, { recursive: true })
  for (const { name } of Object.values(p.files)) fs.copyFileSync(path.join(p.installers, name), path.join(dir, name))
  const manifest = sign({ version: p.version, files: p.files, last_migration: p.lastMigration, endpoints: p.endpoints, notes: p.notes, channel, released_at: new Date().toISOString(), windows_signed: false, mac_signed: false }, key)
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(manifest, null, 2))
  prune(dir, new Set(Object.values(p.files).map((f) => f.name)))
  writeReleases(dir, manifest)
  console.log(`Đã phát ${p.version} kênh ${channel === 'beta' ? 'thử nghiệm' : 'ổn định'}: ${Object.keys(p.files).join(', ')}`)
  upload(dir, channel)
}

function promote(version, key) {
  const beta = path.join(DESKTOP, 'dist/updates/beta')
  const manifest = JSON.parse(fs.readFileSync(path.join(beta, 'latest.json'), 'utf8'))
  if (manifest.version !== version) throw new Error(`Bản thử nghiệm đang là ${manifest.version}, không phải ${version}`)
  const dir = path.join(DESKTOP, 'dist/updates/stable')
  fs.mkdirSync(dir, { recursive: true })
  for (const f of Object.values(manifest.files)) fs.copyFileSync(path.join(beta, f.name), path.join(dir, f.name))
  const { signature, ...rest } = manifest
  const promoted = sign({ ...rest, channel: 'stable', released_at: new Date().toISOString() }, key)
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(promoted, null, 2))
  prune(dir, new Set(Object.values(manifest.files).map((f) => f.name)))
  writeReleases(dir, promoted)
  console.log(`Đã đưa ${version} sang kênh ổn định`)
  upload(dir, 'stable')
}

if (require.main === module) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null }
  ;(async () => {
    const key = require('./release-key').privateKey()
    if (arg('--promote')) return promote(arg('--promote'), key)
    const { cloud_url } = JSON.parse(fs.readFileSync(path.join(DESKTOP, 'endpoints.json'), 'utf8'))
    const cloudKey = await require('./cloud-key').fetchFingerprint(cloud_url)
    release({ channel: arg('--channel') || 'beta', key, cloudKey, allowMissing: (arg('--allow-missing') || '').split(',').filter(Boolean) })
  })().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = { plan, sign, writeReleases }
