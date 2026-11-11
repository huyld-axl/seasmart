// Nhật ký ra tệp trong userData/logs, xoay vòng: quá MAX_BYTES thì đổi tên thành .1, .2 (giữ KEEP tệp cũ).
const fs = require('fs')
const path = require('path')

const MAX_BYTES = 10 * 1024 * 1024
const KEEP = 2

function rotatingLog(file, { maxBytes = MAX_BYTES, keep = KEEP } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  let size = fs.existsSync(file) ? fs.statSync(file).size : 0
  let fd = fs.openSync(file, 'a', 0o600)

  function rotate() {
    fs.closeSync(fd)
    for (let i = keep; i >= 1; i--) {
      const from = i === 1 ? file : `${file}.${i - 1}`
      if (fs.existsSync(from)) fs.renameSync(from, `${file}.${i}`)
    }
    fd = fs.openSync(file, 'a', 0o600)
    size = 0
  }

  return {
    write(chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      if (size + buf.length > maxBytes && size > 0) rotate()
      fs.writeSync(fd, buf)
      size += buf.length
    },
    close() {
      fs.closeSync(fd)
    },
  }
}

// Chép mọi console.log / console.error của tiến trình chính vào main.log (vẫn in ra terminal khi chạy dev).
function captureConsole(log) {
  for (const name of ['log', 'info', 'warn', 'error']) {
    const original = console[name].bind(console)
    console[name] = (...args) => {
      original(...args)
      const line = args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
      log.write(`${new Date().toISOString()} ${name.toUpperCase()} ${line}\n`)
    }
  }
}

module.exports = { rotatingLog, captureConsole }
