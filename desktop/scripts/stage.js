// Gom những phần chạy kèm app vào dist/stage/<os>/ để electron-builder chép vào resources/:
//   backend/   mã backend + node_modules chỉ phần chạy, đúng hệ điều hành đích (không .env, không test, không uploads)
//   forms/     mẫu biểu xuất hồ sơ
//   postgres/  initdb, pg_ctl, postgres + thư viện (từ gói @embedded-postgres)
//   node/      file Node chính thức, cùng bản với Node đang chạy script này (đã kiểm SHA-256)
// và dist/stage/cloud-public-key.pem (khoá công khai máy chủ dịch vụ thử, lấy từ cloud/.data).
//   node scripts/stage.js linux | win
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const target = process.argv[2]
if (!['linux', 'win'].includes(target)) throw new Error('Dùng: node scripts/stage.js linux|win')
const npmOs = target === 'win' ? 'win32' : 'linux'

const DESKTOP = path.join(__dirname, '..')
const ROOT = path.join(DESKTOP, '..')
const STAGE = path.join(DESKTOP, 'dist/stage')
const OUT = path.join(STAGE, target)
const PG_VERSION = require(path.join(DESKTOP, 'package.json')).devDependencies['embedded-postgres']

const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })

function copyBackend() {
  const dest = path.join(OUT, 'backend')
  const skip = new Set(['node_modules', '.env', 'uploads', 'storage', 'test_support', '__tests__', 'Dockerfile', 'docker-entrypoint.sh', '.dockerignore', 'eslint.config.js', 'vitest.config.js'])
  fs.cpSync(path.join(ROOT, 'backend'), dest, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src)
      return !skip.has(name) && !name.startsWith('.env') && !/\.test\.js$/.test(name) && !name.endsWith('.bak')
    },
  })
  sh('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', `--os=${npmOs}`, '--cpu=x64'], dest)
  removeSourceMaps(dest)
}

// Bộ cài không kèm tệp .map (bản đồ mã nguồn của thư viện; docs/mcah-ke-hoach-desktop-gd5.md 3.4).
function removeSourceMaps(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) removeSourceMaps(full)
    else if (entry.name.endsWith('.map')) fs.rmSync(full)
  }
}

function copyPostgres() {
  const pkg = target === 'win' ? 'windows-x64' : 'linux-x64'
  const tmp = path.join(STAGE, `.pg-${pkg}`)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  sh('npm', ['pack', `@embedded-postgres/${pkg}@${PG_VERSION}`, '--silent'], tmp)
  const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'))
  sh('tar', ['-xzf', tgz], tmp)
  const native = path.join(tmp, 'package/native')
  // Gói Linux lưu symlink của thư viện .so trong pg-symlinks.json; dựng lại cho đúng.
  const links = path.join(native, 'pg-symlinks.json')
  if (fs.existsSync(links)) {
    for (const { source, target: to } of JSON.parse(fs.readFileSync(links, 'utf8'))) {
      const at = path.join(tmp, 'package', to)
      fs.rmSync(at, { force: true })
      fs.symlinkSync(path.relative(path.dirname(at), path.join(tmp, 'package', source)), at)
    }
  }
  fs.cpSync(native, path.join(OUT, 'postgres'), { recursive: true, verbatimSymlinks: true })
  fs.rmSync(tmp, { recursive: true, force: true })
}

async function download(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Tải ${url}: ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

async function copyNode() {
  const version = process.version
  const name = target === 'win' ? `node-${version}-win-x64.zip` : `node-${version}-linux-x64.tar.xz`
  const base = `https://nodejs.org/dist/${version}`
  const sums = (await download(`${base}/SHASUMS256.txt`)).toString()
  const expected = sums.split('\n').find((l) => l.endsWith(`  ${name}`))?.split(' ')[0]
  const archive = await download(`${base}/${name}`)
  const actual = crypto.createHash('sha256').update(archive).digest('hex')
  if (!expected || expected !== actual) throw new Error(`SHA-256 của ${name} không khớp`)
  const tmp = path.join(STAGE, '.node')
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  fs.writeFileSync(path.join(tmp, name), archive)
  if (target === 'win') sh('unzip', ['-q', name], tmp)
  else sh('tar', ['-xJf', name], tmp)
  const dir = path.join(tmp, name.replace(/\.(zip|tar\.xz)$/, ''))
  const dest = path.join(OUT, 'node')
  fs.mkdirSync(dest, { recursive: true })
  const exe = target === 'win' ? 'node.exe' : 'bin/node'
  fs.copyFileSync(path.join(dir, exe), path.join(dest, path.basename(exe)))
  fs.chmodSync(path.join(dest, path.basename(exe)), 0o755)
  fs.copyFileSync(path.join(dir, 'LICENSE'), path.join(dest, 'LICENSE'))
  fs.rmSync(tmp, { recursive: true, force: true })
}

// Khoá công khai kiểm vé đăng nhập, gói vào bộ cài. Build cho máy chủ thật (MCAH_CLOUD_URL không phải localhost): lấy từ
// <máy chủ>/.well-known/mcah-keys. Build cho máy dev: suy ra từ cloud/.data/signing-key.pem.
async function writeCloudKey() {
  const url = (process.env.MCAH_CLOUD_URL || '').replace(/\/+$/, '')
  let pem
  if (url && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    if (!url.startsWith('https://')) throw new Error('MCAH_CLOUD_URL của máy chủ thật phải là https')
    const r = await fetch(`${url}/.well-known/mcah-keys`)
    if (!r.ok) throw new Error(`Không lấy được khoá công khai từ ${url} (${r.status})`)
    const { keys } = await r.json()
    if (!keys?.length) throw new Error(`${url} không trả khoá công khai nào`)
    pem = keys.map((k) => crypto.createPublicKey(k.pem).export({ type: 'spki', format: 'pem' })).join('')
    console.log(`Khoá công khai từ ${url}: ${keys.map((k) => k.kid).join(', ')}`)
  } else {
    const keyFile = path.join(ROOT, 'cloud/.data/signing-key.pem')
    if (!fs.existsSync(keyFile)) throw new Error('Chưa có cloud/.data/signing-key.pem: chạy `node cloud/server.js` một lần')
    pem = crypto.createPublicKey(crypto.createPrivateKey(fs.readFileSync(keyFile))).export({ type: 'spki', format: 'pem' })
  }
  fs.writeFileSync(path.join(STAGE, 'cloud-public-key.pem'), pem)
}

// Khoá công khai kiểm bản phát hành + địa chỉ phát hành (MCAH_UPDATE_URL lúc build; trống = tắt tự cập nhật).
function writeUpdateConfig() {
  // Khoá công khai trong repo (build/release-public-key.pem): mọi máy build gói cùng một khoá, không cần khoá riêng.
  fs.writeFileSync(path.join(STAGE, 'release-public-key.pem'), require('./release-key').publicKeyPem())
  fs.writeFileSync(path.join(STAGE, 'update-url.txt'), process.env.MCAH_UPDATE_URL || '')
  fs.writeFileSync(path.join(STAGE, 'cloud-url.txt'), process.env.MCAH_CLOUD_URL || 'http://localhost:4100')
}

// Bản thử của bước 0.7: thêm một migration cuối để kiểm cập nhật có chạy migration.
function addTestMigration() {
  if (!process.env.MCAH_TEST_MIGRATION) return
  fs.copyFileSync(path.join(DESKTOP, 'test/update_test_migration.sql'), path.join(OUT, 'backend/migrations/postgres/999_desktop_update_test.sql'))
}

// Gom backend thành một khối và dịch bytecode bằng chính Node đi kèm (docs/mcah-ke-hoach-desktop-gd5.md 3.1).
// Bytecode chỉ dịch được trên đúng hệ điều hành đích: build bản Windows trên Linux thì chỉ gom + nén, chưa dịch.
function protectBackend() {
  const nodeBin = path.join(OUT, 'node', target === 'win' ? 'node.exe' : 'node')
  const sameOs = (target === 'win') === (process.platform === 'win32')
  if (!sameOs) console.warn('CẢNH BÁO: build chéo hệ điều hành, backend chỉ được gom + nén, chưa dịch bytecode. Build lại trên Windows trước khi phát hành.')
  sh(process.execPath, [path.join(__dirname, 'build-backend.js'), path.join(OUT, 'backend'), nodeBin, ...(sameOs ? [] : ['--no-bytecode'])], DESKTOP)
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  copyBackend()
  addTestMigration()
  fs.cpSync(path.join(ROOT, 'forms'), path.join(OUT, 'forms'), { recursive: true })
  copyPostgres()
  await copyNode()
  protectBackend()
  await writeCloudKey()
  writeUpdateConfig()
  console.log(`Đã gom xong: ${path.relative(DESKTOP, OUT)}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
