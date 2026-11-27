// Mở thư mới trong app mail của máy, tự đính kèm tệp (mục 8.1 kế hoạch tổng; GĐ1 mục 3.5).
//   Ubuntu: Thunderbird qua `thunderbird -compose`; Evolution và app khác qua xdg-email --attach.
//   Windows: Simple MAPI (MAPISendMail trong MAPI32.DLL) qua koffi — Outlook bản Office, Thunderbird.
//   macOS: Thunderbird qua `thunderbird -compose`; Mail của máy qua AppleScript; app khác mở kèm tệp (`open -b`).
// Tệp đính kèm phải nằm ở chỗ app mail đọc được: Thunderbird bản snap trên Ubuntu không đọc /tmp và thư mục ẩn
// (~/.config/...), nên tệp gửi thư nằm trong thư mục thường của người dùng (attachmentDir). Backend ghi .zip vào đó
// (MAIL_DIR); giao diện chỉ gửi tên tệp, không gửi đường dẫn.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile, execFileSync, spawn } = require('child_process')
const { pathToFileURL } = require('url')
const { shell } = require('electron')

const KEEP_MS = 24 * 3600 * 1000

// ~/Catoro/Tệp gửi thư (Ubuntu, macOS) hoặc %LOCALAPPDATA%\Catoro\Tệp gửi thư (Windows). Trước 0.9.14 là thư mục MCAH (tệp tạm, tự xoá sau 24 giờ).
function attachmentDir() {
  const base = process.platform === 'win32' ? process.env.LOCALAPPDATA || os.tmpdir() : os.homedir()
  const dir = path.join(base, 'Catoro', 'Tệp gửi thư')
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

// Máy nhân viên: ghi tệp gửi thư do máy chính trả về (base64) vào thư mục gửi thư của máy này. → [{ name, size }]
function saveAttachments(files) {
  const dir = attachmentDir()
  return files.map((file) => {
    const clean = String(file.name).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(0, 150) || 'ho-so.zip'
    const { name, ext } = path.parse(clean)
    let candidate = clean
    for (let i = 2; fs.existsSync(path.join(dir, candidate)); i++) candidate = `${name} (${i})${ext}`
    const content = Buffer.from(String(file.content_base64 || ''), 'base64')
    fs.writeFileSync(path.join(dir, candidate), content, { mode: 0o600 })
    return { name: candidate, size: content.length }
  })
}

// Xoá tệp gửi thư cũ hơn 24 giờ (gọi lúc mở app).
function cleanAttachmentDir(now = Date.now()) {
  const dir = attachmentDir()
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name)
    try {
      if (now - fs.statSync(file).mtimeMs > KEEP_MS) fs.rmSync(file, { recursive: true, force: true })
    } catch {}
  }
}

// macOS: mã app (bundle id) nhận mailto trong LaunchServices; chưa chọn app nào thì là Mail của máy (luôn có sẵn).
function macMailApp() {
  try {
    const out = execFileSync('defaults', ['read', 'com.apple.LaunchServices/com.apple.launchservices.secure', 'LSHandlers']).toString()
    for (const block of out.split('}')) {
      if (/LSHandlerURLScheme\s*=\s*mailto;/.test(block)) return /LSHandlerRoleAll\s*=\s*"?([\w.-]+)"?;/.exec(block)?.[1] || 'com.apple.mail'
    }
  } catch {}
  return 'com.apple.mail'
}

// App mail mặc định, null nếu chưa có. Ubuntu: tên tệp .desktop của mailto; Windows: tên trong Clients\Mail; macOS: bundle id.
function defaultMailApp() {
  try {
    if (process.platform === 'darwin') return macMailApp()
    if (process.platform !== 'win32') return execFileSync('xdg-mime', ['query', 'default', 'x-scheme-handler/mailto']).toString().trim() || null
    for (const hive of ['HKCU', 'HKLM']) {
      try {
        const out = execFileSync('reg', ['query', `${hive}\\Software\\Clients\\Mail`, '/ve']).toString()
        const name = /REG_SZ\s+(.+)/.exec(out)?.[1]?.trim()
        if (name) return name
      } catch {}
    }
    return null
  } catch {
    return null
  }
}

// Thunderbird: gọi thẳng `thunderbird -compose`. Không qua xdg-email: với bản snap, xdg-email không nhận ra Thunderbird
// và rơi về `gio open mailto:...&attach=`, mà Thunderbird bỏ qua đính kèm trong mailto (chặn vì an toàn).
function thunderbirdBinary() {
  const mac = (dir) => path.join(dir, 'Thunderbird.app/Contents/MacOS/thunderbird')
  for (const bin of ['/snap/bin/thunderbird', '/usr/bin/thunderbird', '/usr/local/bin/thunderbird', mac('/Applications'), mac(path.join(os.homedir(), 'Applications'))]) if (fs.existsSync(bin)) return bin
  return null
}

function composeArg({ to, cc, bcc, subject, body, attachments }) {
  const q = (v) => `'${String(v).replace(/'/g, '’')}'`
  const parts = [`to=${q(to.join(','))}`, `subject=${q(subject)}`, `body=${q(body)}`]
  if (cc.length) parts.push(`cc=${q(cc.join(','))}`)
  if (bcc.length) parts.push(`bcc=${q(bcc.join(','))}`)
  if (attachments.length) parts.push(`attachment=${q(attachments.map((f) => pathToFileURL(f).href).join(','))}`)
  return parts.join(',')
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.on('error', reject)
    child.on('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function openLinux(mail) {
  const app = defaultMailApp() || ''
  const thunderbird = /thunderbird/i.test(app) && thunderbirdBinary()
  if (thunderbird) return run(thunderbird, ['-compose', composeArg(mail)])
  // Evolution và app khác: xdg-email (Evolution nhận attach trong mailto).
  const args = ['--utf8', '--subject', mail.subject, '--body', mail.body]
  for (const addr of mail.cc) args.push('--cc', addr)
  for (const addr of mail.bcc) args.push('--bcc', addr)
  for (const file of mail.attachments) args.push('--attach', file)
  args.push(...(mail.to.length ? mail.to : ['']))
  return new Promise((resolve, reject) => {
    execFile('xdg-email', args, (error, _out, stderr) => (error ? reject(new Error(stderr || error.message)) : resolve()))
  })
}

// Mail của máy: tham số qua argv (không ghép vào script): tiêu đề, nội dung, rồi số người nhận + địa chỉ cho to / cc / bcc,
// còn lại là tệp đính kèm. Lần đầu macOS hỏi "Catoro muốn điều khiển Mail" (NSAppleEventsUsageDescription trong package.json).
const MAIL_SCRIPT = `on run argv
  set i to 3
  tell application "Mail"
    set m to make new outgoing message with properties {subject:item 1 of argv, content:item 2 of argv, visible:true}
    repeat with cls in {"to", "cc", "bcc"}
      set n to (item i of argv) as integer
      repeat with j from 1 to n
        set addr to item (i + j) of argv
        tell m
          if contents of cls is "to" then make new to recipient at end of to recipients with properties {address:addr}
          if contents of cls is "cc" then make new cc recipient at end of cc recipients with properties {address:addr}
          if contents of cls is "bcc" then make new bcc recipient at end of bcc recipients with properties {address:addr}
        end tell
      end repeat
      set i to i + n + 1
    end repeat
    delay 0.5
    tell content of m
      repeat with j from i to count of argv
        make new attachment with properties {file name:(POSIX file (item j of argv)) as alias} at after last paragraph
      end repeat
    end tell
    activate
  end tell
end run`

// Chưa thử được trên máy Mac thật (chỉ có Ubuntu / Windows): kiểm theo docs/catoro-testcase-desktop-macos.md.
function openMac(mail) {
  const app = defaultMailApp()
  const thunderbird = /thunderbird/i.test(app) && thunderbirdBinary()
  if (thunderbird) return run(thunderbird, ['-compose', composeArg(mail)])
  const args = app === 'com.apple.mail'
    ? ['osascript', ['-e', MAIL_SCRIPT, mail.subject, mail.body, ...[mail.to, mail.cc, mail.bcc].flatMap((list) => [String(list.length), ...list]), ...mail.attachments]]
    // Outlook, Spark…: mở tệp bằng app mail là thư mới kèm tệp (người nhận gõ tay).
    : ['open', ['-b', app, ...mail.attachments]]
  return new Promise((resolve, reject) => {
    execFile(...args, (error, _out, stderr) => (error ? reject(new Error(String(stderr).trim() || error.message)) : resolve()))
  })
}

// MAPISendMail: chỉ có trên Windows; chưa thử được trên Ubuntu.
function openWindows({ to, cc, bcc, subject, body, attachments }) {
  const koffi = require('koffi')
  const lib = koffi.load('MAPI32.DLL')
  const MapiRecipDesc = koffi.struct('MapiRecipDesc', {
    ulReserved: 'uint32', ulRecipClass: 'uint32', lpszName: 'str', lpszAddress: 'str', ulEIDSize: 'uint32', lpEntryID: 'void *',
  })
  const MapiFileDesc = koffi.struct('MapiFileDesc', {
    ulReserved: 'uint32', flFlags: 'uint32', nPosition: 'uint32', lpszPathName: 'str', lpszFileName: 'str', lpFileType: 'void *',
  })
  const MapiMessage = koffi.struct('MapiMessage', {
    ulReserved: 'uint32', lpszSubject: 'str', lpszNoteText: 'str', lpszMessageType: 'str', lpszDateReceived: 'str',
    lpszConversationID: 'str', flFlags: 'uint32', lpOriginator: 'void *', nRecipCount: 'uint32',
    lpRecips: koffi.pointer(MapiRecipDesc), nFileCount: 'uint32', lpFiles: koffi.pointer(MapiFileDesc),
  })
  const MAPISendMail = lib.func('uint32 __stdcall MAPISendMail(uintptr, uintptr, MapiMessage *, uint32, uint32)')
  const MAPI_LOGON_UI = 0x1
  const MAPI_DIALOG = 0x8
  const recips = [[to, 1], [cc, 2], [bcc, 3]].flatMap(([list, cls]) => list.map((addr) => ({ ulRecipClass: cls, lpszName: addr, lpszAddress: `SMTP:${addr}` })))
  const message = {
    lpszSubject: subject,
    lpszNoteText: body,
    nRecipCount: recips.length,
    lpRecips: recips,
    nFileCount: attachments.length,
    lpFiles: attachments.map((file) => ({ nPosition: 0xffffffff, lpszPathName: file, lpszFileName: path.basename(file) })),
  }
  return new Promise((resolve, reject) => {
    MAPISendMail.async(0, 0, message, MAPI_LOGON_UI | MAPI_DIALOG, 0, (error, code) => {
      if (error) reject(error)
      // 0 = đã mở; 1 = người dùng đóng thư (cũng coi là xong việc mở).
      else if (code === 0 || code === 1) resolve()
      else reject(new Error(`Không mở được app mail (MAPI ${code})`))
    })
  })
}

// Mở thư kèm tệp. files: tên tệp trong attachmentDir (không nhận đường dẫn). Không có app mail: mở thư mục chứa tệp
// để kéo thả và trả opened: false để giao diện hiện nút "Cài Thunderbird".
async function openMail({ to = [], cc = [], bcc = [], subject = '', body = '', files = [] }) {
  const dir = attachmentDir()
  const attachments = files.map((name) => {
    if (/[\\/]/.test(name) || name === '..' || path.basename(name) !== name) throw new Error('Tên tệp đính kèm không hợp lệ')
    const file = path.join(dir, name)
    if (!fs.existsSync(file)) throw new Error(`Không thấy tệp ${name}`)
    return file
  })
  if (!defaultMailApp()) {
    await shell.openPath(dir)
    return { opened: false }
  }
  await ({ win32: openWindows, darwin: openMac }[process.platform] || openLinux)({ to, cc, bcc, subject, body, attachments })
  return { opened: true }
}

module.exports = { saveAttachments, openMail, attachmentDir, cleanAttachmentDir, defaultMailApp }
