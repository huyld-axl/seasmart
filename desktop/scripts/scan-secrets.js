// Quét bộ cài tìm bí mật (kế hoạch tổng mục 6.3; docs/mcah-ke-hoach-desktop-gd2.md 4.6): mở app.asar và resources/,
// tìm khoá API, khoá riêng, tệp .env. Có thì build lỗi. Chạy sau electron-builder trong npm run dist:*.
//   node scripts/scan-secrets.js [thư mục bản đã giải nén, mặc định dist/installer/linux-unpacked]
const fs = require('fs')
const path = require('path')
const asar = require('@electron/asar')

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../dist/installer/linux-unpacked'))
const PATTERNS = [
  ['khoá OpenAI', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ['khoá Anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['khoá AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['khoá riêng PEM', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['Google client secret', /\bGOCSPX-[A-Za-z0-9_-]{20,}/],
  ['biến khoá có giá trị', /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|VESSEL_API_ENC_KEY|SMTP_PASSWORD|JWT_SECRET|GOOGLE_CLIENT_SECRET|CLOUD_COOKIE_SECRET)\s*=\s*['"]?[^\s'"#]{8,}/],
]
// Tệp không được có mặt trong bộ cài.
const FORBIDDEN_NAMES = [/^\.env(\..*)?$/, /^signing-key\.pem$/, /^release-key\.pem$/, /^db-secret$/]
// Thư viện bên thứ ba có chuỗi mẫu trong tài liệu / test (vd. "sk-..." trong README của SDK): không tính.
const SKIP = [/[\\/]node_modules[\\/][^\\/]+[\\/](test|tests|docs?|examples?)[\\/]/i, /\.(md|markdown|d\.ts|map)$/i, /[\\/]LICENSE/i]
const TEXT_EXT = /\.(js|cjs|mjs|json|txt|html|css|env|pem|yml|yaml|ini|conf|cfg|sql|sh|xml)$|^[^.]+$/i
const MAX_BYTES = 5 * 1024 * 1024

const findings = []
const check = (where, name, read) => {
  if (FORBIDDEN_NAMES.some((re) => re.test(name))) findings.push(`${where}: tệp không được có trong bộ cài`)
  if (SKIP.some((re) => re.test(where)) || !TEXT_EXT.test(name)) return
  const text = read()
  if (!text || text.length > MAX_BYTES) return
  for (const [label, re] of PATTERNS) if (re.test(text)) findings.push(`${where}: ${label}`)
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) walk(full)
    else if (entry.name === 'app.asar') scanAsar(full)
    else if (entry.isFile()) check(path.relative(ROOT, full), entry.name, () => (fs.statSync(full).size <= MAX_BYTES ? fs.readFileSync(full, 'utf8') : ''))
  }
}

function scanAsar(file) {
  for (const inner of asar.listPackage(file)) {
    const stat = asar.statFile(file, inner.slice(1))
    if (stat.files || stat.link || stat.unpacked) continue
    check(`app.asar${inner}`, path.basename(inner), () => (stat.size <= MAX_BYTES ? asar.extractFile(file, inner.slice(1)).toString('utf8') : ''))
  }
}

if (!fs.existsSync(ROOT)) {
  console.error(`Không thấy ${ROOT}`)
  process.exit(1)
}
walk(ROOT)
if (findings.length) {
  console.error(`Bộ cài có bí mật (${findings.length}):\n${findings.slice(0, 50).join('\n')}`)
  process.exit(1)
}
console.log(`Quét bí mật: sạch (${ROOT})`)
