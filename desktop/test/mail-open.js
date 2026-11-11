// Thử mở thư kèm 2 tệp qua openMail (bước 0.10): electron test/mail-open.js <tệp>...
const { app } = require('electron')
app.whenReady().then(async () => {
  const { openMail, defaultMailApp } = require('../src/mail')
  console.log('app mail mặc định:', defaultMailApp())
  try {
    const r = await openMail({ to: ['chutau@example.com'], subject: 'MCAH thử: hồ sơ thuyền viên', body: 'Thư thử của bước 0.10, kèm PDF và ảnh.', attachments: process.argv.slice(2).filter((a) => a.startsWith('/')) })
    console.log('KẾT QUẢ:', JSON.stringify(r))
  } catch (e) {
    console.log('LỖI:', e.message)
  }
  setTimeout(() => app.exit(0), 3000)
})
