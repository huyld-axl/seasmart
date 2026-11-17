// Lệnh cho người giữ server (docs/mcah-ke-hoach-khu-noi-bo.md 5.4): admin khu nội bộ là CLOUD_ADMIN_EMAIL.
//   node scripts/admin.js set-password   đặt / đổi mật khẩu (tạo tài khoản nếu chưa có)
//   node scripts/admin.js reset-2fa      tắt xác minh hai bước, lần đăng nhập sau quét QR mới
// Cả hai đăng xuất mọi phiên quản trị đang mở. Mật khẩu gõ ở dấu nhắc (không hiện, không nằm trong lịch sử shell).
const readline = require('readline')
const config = require('../src/config')
const pool = require('../src/db')
const adminAuth = require('../src/services/admin_auth')

// Hỏi một dòng; hidden thì không in ký tự gõ ra màn hình.
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text)
        else if (text.includes('\n') || text.includes('\r')) rl.output.write('\n')
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function setPassword() {
  console.log(`Đặt mật khẩu cho ${config.adminEmail}`)
  const password = await ask(`Mật khẩu mới (ít nhất ${adminAuth.MIN_PASSWORD} ký tự): `, { hidden: true })
  const again = await ask('Nhập lại: ', { hidden: true })
  if (password !== again) throw new Error('Hai lần nhập không giống nhau, chưa đổi gì')
  await adminAuth.setPassword(password)
  console.log('✓ Đã đặt mật khẩu. Các phiên quản trị đang mở đã bị đăng xuất.')
}

async function reset2fa() {
  const answer = await ask(`Tắt xác minh hai bước của ${config.adminEmail}? Lần đăng nhập sau sẽ phải quét mã QR mới. (gõ "co" để đồng ý): `)
  if (answer.trim().toLowerCase() !== 'co') throw new Error('Đã huỷ, chưa đổi gì')
  await adminAuth.resetTotp()
  console.log('✓ Đã tắt. Các phiên quản trị đang mở đã bị đăng xuất.')
}

const COMMANDS = { 'set-password': setPassword, 'reset-2fa': reset2fa }

async function main() {
  const run = COMMANDS[process.argv[2]]
  if (!run) throw new Error('Cách dùng: node scripts/admin.js set-password | reset-2fa')
  if (!config.adminEmail) throw new Error('Chưa đặt CLOUD_ADMIN_EMAIL trong cloud/.env')
  await run()
}

main()
  .catch((error) => {
    console.error(`✗ ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => pool.end())
