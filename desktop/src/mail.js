// Mở thư mới trong app mail của máy, tự đính kèm tệp (mục 8.1; giai đoạn 0, bước 0.10).
//   Ubuntu: Thunderbird qua `thunderbird -compose`; Evolution và app khác qua xdg-email --attach.
//   Windows: Simple MAPI (MAPISendMail trong MAPI32.DLL) qua koffi — Outlook bản Office, Thunderbird.
// Tệp đính kèm phải nằm ở chỗ app mail đọc được: Thunderbird bản snap trên Ubuntu không đọc /tmp và thư mục ẩn
// (~/.config/...), nên bản tạm để gửi thư nằm trong thư mục thường của người dùng (attachmentDir).
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile, execFileSync, spawn } = require('child_process')
const { pathToFileURL } = require('url')
const { shell } = require('electron')

// Chỗ để bản tạm gửi thư: ~/MCAH/Tệp gửi thư (Windows: thư mục tạm của người dùng là được).
function attachmentDir() {
  const dir = process.platform === 'win32' ? path.join(os.tmpdir(), 'MCAH-gui-thu') : path.join(os.homedir(), 'MCAH', 'Tệp gửi thư')
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

// App mail mặc định (Ubuntu), null nếu chưa có.
function defaultMailApp() {
  if (process.platform === 'win32') return null
  try {
    return execFileSync('xdg-mime', ['query', 'default', 'x-scheme-handler/mailto']).toString().trim() || null
  } catch {
    return null
  }
}

// Thunderbird: gọi thẳng `thunderbird -compose`. Không qua xdg-email: với bản snap, xdg-email không nhận ra Thunderbird
// và rơi về `gio open mailto:...&attach=`, mà Thunderbird bỏ qua đính kèm trong mailto (chặn vì an toàn).
function thunderbirdBinary() {
  for (const bin of ['/snap/bin/thunderbird', '/usr/bin/thunderbird', '/usr/local/bin/thunderbird']) if (fs.existsSync(bin)) return bin
  return null
}

function composeArg({ to, subject, body, attachments }) {
  const q = (v) => `'${String(v).replace(/'/g, '’')}'`
  const parts = [`to=${q(to.join(','))}`, `subject=${q(subject)}`, `body=${q(body)}`]
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

function openLinux({ to = [], subject = '', body = '', attachments = [] }) {
  const app = defaultMailApp() || ''
  const thunderbird = /thunderbird/i.test(app) && thunderbirdBinary()
  if (thunderbird) return run(thunderbird, ['-compose', composeArg({ to, subject, body, attachments })])
  // Evolution và app khác: xdg-email (Evolution nhận attach trong mailto).
  const args = ['--utf8', '--subject', subject, '--body', body]
  for (const file of attachments) args.push('--attach', file)
  args.push(...(to.length ? to : ['']))
  return new Promise((resolve, reject) => {
    execFile('xdg-email', args, (error, _out, stderr) => (error ? reject(new Error(stderr || error.message)) : resolve()))
  })
}

// MAPISendMail: chỉ có trên Windows; chưa thử được ở giai đoạn 0 trên Ubuntu.
function openWindows({ to = [], subject = '', body = '', attachments = [] }) {
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
  const MAPI_TO = 1
  const MAPI_LOGON_UI = 0x1
  const MAPI_DIALOG = 0x8
  const message = {
    lpszSubject: subject,
    lpszNoteText: body,
    nRecipCount: to.length,
    lpRecips: to.map((addr) => ({ ulRecipClass: MAPI_TO, lpszName: addr, lpszAddress: `SMTP:${addr}` })),
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

// Mở thư kèm tệp. Không có app mail: mở thư mục chứa tệp để kéo thả, báo cho người gọi hiện nút "Cài Thunderbird".
async function openMail(mail) {
  const dir = attachmentDir()
  const attachments = (mail.attachments || []).map((file) => {
    const copy = path.join(dir, path.basename(file))
    fs.copyFileSync(file, copy)
    return copy
  })
  if (process.platform !== 'win32' && !defaultMailApp()) {
    shell.openPath(dir)
    return { opened: false, folder: dir }
  }
  await (process.platform === 'win32' ? openWindows : openLinux)({ ...mail, attachments })
  return { opened: true, folder: dir }
}

module.exports = { openMail, attachmentDir, defaultMailApp }
