// Ghi dist/installer/build-info-<linux|win>.json sau khi build + quét bí mật sạch (docs/mcah-ke-hoach-desktop-gd6.md 3.2):
// phiên bản, commit, lúc build. Script phát hành chặn khi hai bản khác commit / khác phiên bản / chưa quét.
//   node scripts/build-info.js linux|win
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const platform = process.argv[2]
if (!['linux', 'win'].includes(platform)) throw new Error('Dùng: node scripts/build-info.js linux|win')
const DESKTOP = path.join(__dirname, '..')
const { version } = require(path.join(DESKTOP, 'package.json'))
const git = (...args) => execFileSync('git', args, { cwd: DESKTOP }).toString().trim()
const dirty = git('status', '--porcelain', '--untracked-files=no') !== ''
const info = { platform, version, commit: git('rev-parse', 'HEAD'), dirty, scan: 'clean', built_at: new Date().toISOString() }
fs.writeFileSync(path.join(DESKTOP, 'dist/installer', `build-info-${platform}.json`), JSON.stringify(info, null, 2))
console.log(`build-info-${platform}: ${version} @ ${info.commit.slice(0, 8)}${dirty ? ' (có thay đổi chưa commit)' : ''}`)
