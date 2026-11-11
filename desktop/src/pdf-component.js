// Thành phần xuất PDF = LibreOffice (không gói kèm, Q6). Dò sẵn trên máy; chưa có thì cài (GĐ1 mục 3.4).
//   Ubuntu: pkexec apt-get install libreoffice-calc (máy đã có bản đầy đủ thì không làm gì; không dùng -nogui vì
//   gói đó xung đột, có thể gỡ mất LibreOffice đầy đủ của người dùng).
//   Windows: tải MSI chính thức từ download.documentfoundation.org, kiểm SHA-256, msiexec /passive (Windows hỏi quyền).
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn, execFileSync } = require('child_process')
const { app } = require('electron')

const TDF = 'https://download.documentfoundation.org/libreoffice/stable/'

// Đường dẫn soffice, null nếu chưa có. MCAH_NO_SOFFICE=1 giả máy chưa có (chỉ để thử).
function findSoffice() {
  if (process.env.MCAH_NO_SOFFICE) return null
  const candidates = process.platform === 'win32'
    ? [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).map((p) => path.join(p, 'LibreOffice', 'program', 'soffice.exe'))
    : ['/usr/bin/soffice', '/usr/local/bin/soffice', '/snap/bin/libreoffice', '/var/lib/flatpak/exports/bin/org.libreoffice.LibreOffice']
  for (const file of candidates) if (fs.existsSync(file)) return file
  if (process.platform !== 'win32') {
    try {
      return execFileSync('sh', ['-c', 'command -v soffice']).toString().trim() || null
    } catch {}
  }
  return null
}

function runInstaller(cmd, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const feed = (buf) => String(buf).split('\n').filter(Boolean).forEach(onLine)
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else if (cmd === 'pkexec' && (code === 126 || code === 127)) reject(new Error('Chưa nhập mật khẩu quản trị, chưa cài'))
      else if (code === 1602) reject(new Error('Đã huỷ cài đặt'))
      else reject(new Error(`Cài không thành công (mã ${code})`))
    })
  })
}

async function installLinux(progress) {
  progress({ percent: null, text: 'Đang cài (máy sẽ hỏi mật khẩu quản trị)…' })
  await runInstaller('pkexec', ['apt-get', 'install', '-y', '--no-install-recommends', 'libreoffice-calc'], (line) => {
    const m = /^(Get|Unpacking|Setting up)/.exec(line)
    if (m) progress({ percent: null, text: line.slice(0, 80) })
  })
}

async function installWindows(progress) {
  progress({ percent: 0, text: 'Đang tìm bản mới nhất…' })
  const listing = await (await fetch(TDF)).text()
  const versions = [...listing.matchAll(/href="(\d+\.\d+\.\d+)\/"/g)].map((m) => m[1])
  const version = versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1)
  if (!version) throw new Error('Không tìm thấy bản LibreOffice để tải')
  const name = `LibreOffice_${version}_Win_x86-64.msi`
  const url = `${TDF}${version}/win/x86_64/${name}`
  const expected = (await (await fetch(`${url}.sha256`)).text()).trim().split(/\s+/)[0]
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Không tải được LibreOffice (${r.status})`)
  const total = Number(r.headers.get('content-length')) || 0
  const chunks = []
  let got = 0
  for await (const chunk of r.body) {
    chunks.push(chunk)
    got += chunk.length
    if (total) progress({ percent: Math.round((got / total) * 90), text: 'Đang tải…' })
  }
  const data = Buffer.concat(chunks)
  if (!/^[0-9a-f]{64}$/.test(expected) || crypto.createHash('sha256').update(data).digest('hex') !== expected) {
    throw new Error('Tệp tải về không khớp mã kiểm tra, đã huỷ')
  }
  const file = path.join(app.getPath('temp'), name)
  fs.writeFileSync(file, data)
  progress({ percent: 95, text: 'Đang cài (Windows sẽ hỏi quyền quản trị)…' })
  try {
    await runInstaller('msiexec', ['/i', file, '/passive', '/norestart'], () => {})
  } finally {
    fs.rmSync(file, { force: true })
  }
}

async function installSoffice(progress) {
  if (process.platform === 'win32') await installWindows(progress)
  else await installLinux(progress)
  const found = findSoffice()
  if (!found) throw new Error('Đã cài nhưng chưa thấy LibreOffice, thử mở lại app')
  progress({ percent: 100, text: 'Đã cài xong' })
  return found
}

module.exports = { findSoffice, installSoffice }
