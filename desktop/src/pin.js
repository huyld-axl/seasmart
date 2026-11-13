// Mã PIN 6 số theo máy và tự khoá (docs/mcah-ke-hoach-desktop-gd2.md 4.4, wireframe 5).
// PIN băm scrypt + muối, cùng số lần sai, cất bằng két hệ điều hành (pin.bin). Sai MAX_FAILS lần thì báo để
// tiến trình chính bỏ phiên (đăng nhập lại qua trình duyệt, web bắt nhập lại mật khẩu).
// Tự khoá: rỗi quá ngưỡng (Cài đặt trên máy này, 5–60 phút, mặc định 15) hoặc máy khoá màn hình.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { EventEmitter } = require('events')
const { app, powerMonitor, safeStorage } = require('electron')
const { secretStoreAvailable } = require('./settings')

const MAX_FAILS = 5
const SCRYPT = { N: 2 ** 14, r: 8, p: 1 }
const events = new EventEmitter()
let locked = false
let timer = null

const file = () => path.join(app.getPath('userData'), 'pin.bin')

function read() {
  try {
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(file())))
  } catch {
    return null
  }
}

function write(data) {
  fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 })
}

const hash = (pin, salt) => crypto.scryptSync(pin, Buffer.from(salt, 'base64'), 32, SCRYPT).toString('base64')

function setLocked(value) {
  if (locked === value) return
  locked = value
  events.emit('changed', locked)
}

const pin = {
  events,
  MAX_FAILS,
  isLocked: () => locked,
  // Máy không có két an toàn thì không đặt PIN được (phiên cũng không lưu), không khoá.
  hasPin: () => secretStoreAvailable() && fs.existsSync(file()),

  setPin(value) {
    if (!/^\d{6}$/.test(String(value))) throw new Error('Mã PIN gồm đúng 6 chữ số')
    if (!secretStoreAvailable()) throw new Error('Máy chưa có kho mật khẩu an toàn, không đặt được mã PIN')
    const salt = crypto.randomBytes(16).toString('base64')
    write({ salt, hash: hash(String(value), salt), fails: 0 })
  },

  // { ok } | { ok: false, left } | { ok: false, left: 0, exhausted: true } (đã xoá PIN, người gọi bỏ phiên).
  unlock(value) {
    const data = read()
    if (!data) {
      setLocked(false)
      return { ok: true }
    }
    const good = /^\d{6}$/.test(String(value)) && crypto.timingSafeEqual(Buffer.from(hash(String(value), data.salt)), Buffer.from(data.hash))
    if (good) {
      write({ ...data, fails: 0 })
      setLocked(false)
      return { ok: true }
    }
    const fails = data.fails + 1
    if (fails >= MAX_FAILS) {
      pin.clear()
      setLocked(false)
      return { ok: false, left: 0, exhausted: true }
    }
    write({ ...data, fails })
    return { ok: false, left: MAX_FAILS - fails }
  },

  clear() {
    fs.rmSync(file(), { force: true })
  },

  lock() {
    if (pin.hasPin()) setLocked(true)
  },

  // Theo dõi rỗi; lockMinutes() đọc ngưỡng hiện tại; loggedIn() — chỉ khoá khi đang đăng nhập.
  watch({ lockMinutes, loggedIn }) {
    clearInterval(timer)
    timer = setInterval(() => {
      if (!locked && loggedIn() && powerMonitor.getSystemIdleTime() >= lockMinutes() * 60) pin.lock()
    }, 30 * 1000)
    // Chỉ khi chạy dev: khoá sau N giây đăng nhập, để thử màn khoá không phải chờ rỗi thật.
    if (!app.isPackaged && process.env.MCAH_LOCK_AFTER_SECONDS) {
      setInterval(() => { if (!locked && loggedIn()) pin.lock() }, Number(process.env.MCAH_LOCK_AFTER_SECONDS) * 1000)
    }
    powerMonitor.on('lock-screen', () => {
      if (loggedIn()) pin.lock()
    })
  },
}

module.exports = pin
