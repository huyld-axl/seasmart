// Phát hành (docs/mcah-ke-hoach-desktop-gd6.md 3.2, 3.3): gom bộ cài Ubuntu + Windows cùng phiên bản, ký latest.json,
// đặt vào dist/updates/<kênh>/ rồi (nếu có MCAH_RELEASE_TARGET) đẩy lên server: bộ cài trước, latest.json sau cùng.
//   npm run release -- --channel beta|stable      phát bản đang ở desktop/package.json
//   npm run release -- --promote 1.2.0            đưa bản beta 1.2.0 đã phát sang kênh ổn định (không build lại)
// Chặn (không phát gì) khi: thiếu .deb hoặc .exe, hai bản khác phiên bản / commit, có thay đổi chưa commit, chưa quét bí mật,
// thiếu release-notes/<phiên bản>.md, khoá riêng không khớp khoá công khai trong repo.
// MCAH_RELEASE_TARGET: đích rsync, vd. mcah-release@mcah.axalize.dev:/srv/mcah/releases
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const { canonical } = require('../src/manifest')

const DESKTOP = path.join(__dirname, '..')
const KEEP = 3

function plan({ desktop = DESKTOP, channel = 'beta' } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'))
  const { name: pkgName, version, build } = pkg
  const installers = path.join(desktop, build.directories.output)
  const problems = []
  if (!['beta', 'stable'].includes(channel)) problems.push(`Kênh không hợp lệ: ${channel}`)
  const files = {}
  const infos = {}
  for (const [platform, name] of [['linux', `${pkgName}_${version}_amd64.deb`], ['win', `${build.productName} Setup ${version}.exe`]]) {
    const src = path.join(installers, name)
    const infoFile = path.join(installers, `build-info-${platform}.json`)
    if (!fs.existsSync(src)) {
      problems.push(`Thiếu bộ cài ${platform === 'win' ? 'Windows' : 'Ubuntu'}: ${name}`)
      continue
    }
    if (!fs.existsSync(infoFile)) {
      problems.push(`Thiếu build-info-${platform}.json (bản ${platform} chưa chạy đủ npm run dist:${platform}, gồm quét bí mật)`)
      continue
    }
    const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'))
    infos[platform] = info
    if (info.version !== version) problems.push(`Bản ${platform} là ${info.version}, không phải ${version}`)
    if (info.scan !== 'clean') problems.push(`Bản ${platform} chưa quét bí mật sạch`)
    if (info.dirty) problems.push(`Bản ${platform} build khi còn thay đổi chưa commit`)
    const data = fs.readFileSync(src)
    files[platform] = { name, sha256: crypto.createHash('sha256').update(data).digest('hex'), size: data.length }
  }
  if (infos.linux && infos.win && infos.linux.commit !== infos.win.commit) problems.push(`Hai bản khác commit: Ubuntu ${infos.linux.commit.slice(0, 8)}, Windows ${infos.win.commit.slice(0, 8)}`)
  const notesFile = path.join(desktop, 'release-notes', `${version}.md`)
  const notes = fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8').trim() : ''
  if (!notes) problems.push(`Thiếu ghi chú thay đổi release-notes/${version}.md`)
  const migrations = path.join(desktop, '../backend/migrations/postgres')
  const lastMigration = fs.existsSync(migrations) ? fs.readdirSync(migrations).filter((n) => /^\d+.*\.sql$/.test(n)).sort().pop() : null
  return { version, files, installers, notes, lastMigration, problems, commit: infos.linux?.commit }
}

const sign = (signed, key) => ({ ...signed, signature: crypto.sign(null, Buffer.from(canonical(signed)), key).toString('base64') })

// Giữ KEEP phiên bản gần nhất trong thư mục kênh (bộ cài cũ cho máy cần quay về).
function prune(dir, keepNames) {
  const installers = fs.readdirSync(dir).filter((n) => /\.(deb|exe)$/.test(n)).map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t)
  const versions = []
  for (const { n } of installers) {
    const v = (/(\d+\.\d+\.\d+)/.exec(n) || [])[1]
    if (v && !versions.includes(v)) versions.push(v)
  }
  const keep = new Set(versions.slice(0, KEEP))
  for (const { n } of installers) if (!keepNames.has(n) && !keep.has((/(\d+\.\d+\.\d+)/.exec(n) || [])[1])) fs.rmSync(path.join(dir, n))
}

function upload(dir, channel) {
  const target = process.env.MCAH_RELEASE_TARGET
  if (!target) return console.log(`Chưa đặt MCAH_RELEASE_TARGET: bản phát nằm ở ${dir}, chưa đẩy lên server.`)
  const dest = `${target.replace(/\/+$/, '')}/${channel === 'beta' ? 'beta/' : ''}`
  // Bộ cài trước, latest.json sau cùng: app không bao giờ thấy latest.json trỏ tệp chưa lên xong.
  execFileSync('rsync', ['-av', '--exclude', 'latest.json', `${dir}/`, dest], { stdio: 'inherit' })
  execFileSync('rsync', ['-av', path.join(dir, 'latest.json'), dest], { stdio: 'inherit' })
  console.log(`Đã đẩy lên ${dest}`)
}

function release({ channel, key }) {
  const p = plan({ channel })
  if (p.problems.length) throw new Error(`Không phát hành ${p.version}:\n- ${p.problems.join('\n- ')}`)
  const dir = path.join(DESKTOP, 'dist/updates', channel)
  fs.mkdirSync(dir, { recursive: true })
  for (const { name } of Object.values(p.files)) fs.copyFileSync(path.join(p.installers, name), path.join(dir, name))
  const manifest = sign({ version: p.version, files: p.files, last_migration: p.lastMigration, notes: p.notes, channel, released_at: new Date().toISOString(), windows_signed: false }, key)
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(manifest, null, 2))
  prune(dir, new Set(Object.values(p.files).map((f) => f.name)))
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
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(sign({ ...rest, channel: 'stable', released_at: new Date().toISOString() }, key), null, 2))
  prune(dir, new Set(Object.values(manifest.files).map((f) => f.name)))
  console.log(`Đã đưa ${version} sang kênh ổn định`)
  upload(dir, 'stable')
}

if (require.main === module) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null }
  try {
    const key = require('./release-key').privateKey()
    if (arg('--promote')) promote(arg('--promote'), key)
    else release({ channel: arg('--channel') || 'beta', key })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { plan, sign }
