// Ổ đĩa chứa dữ liệu máy chính có mã hoá không (docs/mcah-ke-hoach-desktop-gd4.md 3.7, wireframe màn 6). Không mã hoá
// tài liệu trong app (Q14) nên đây là lớp bảo vệ chính khi mất máy. → 'on' | 'off' | 'unknown'
//   Ubuntu: thiết bị chứa thư mục (df) có tầng crypt (LUKS) bên dưới (lsblk -s).
//   Windows: thuộc tính BitLockerProtection của ổ (đọc được không cần quyền quản trị; 1 / 3 / 5 = đang bảo vệ).
const { execFile } = require('child_process')
const path = require('path')

const run = (cmd, args) => new Promise((resolve) => execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, out) => resolve(err ? null : String(out))))

async function check(dir) {
  try {
    if (process.platform === 'win32') {
      const drive = path.parse(path.resolve(dir)).root.replace(/\\$/, '')
      const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(New-Object -ComObject Shell.Application).NameSpace('${drive}\\').Self.ExtendedProperty('System.Volume.BitLockerProtection')`])
      if (out === null) return 'unknown'
      const v = Number(out.trim())
      if ([1, 3, 5].includes(v)) return 'on'
      return [0, 2, 4, 6].includes(v) ? 'off' : 'unknown'
    }
    const df = await run('df', ['--output=source', dir])
    const source = df?.trim().split('\n').pop()
    if (!source?.startsWith('/dev/')) return 'unknown'
    const tree = await run('lsblk', ['-J', '-s', '-o', 'NAME,TYPE', source])
    if (!tree) return 'unknown'
    return JSON.stringify(JSON.parse(tree)).includes('"type":"crypt"') ? 'on' : 'off'
  } catch {
    return 'unknown'
  }
}

module.exports = { check }
