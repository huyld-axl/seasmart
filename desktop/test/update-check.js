// Thử phần kiểm bản cập nhật (bước 0.7) trong Electron, không cài: electron test/update-check.js
// Cần chỗ phát thử ở MCAH_UPDATE_URL. Giả làm app bản 0.0.1.
const { app } = require('electron')
app.getVersion = () => '0.0.1'
app.whenReady().then(async () => {
  const { checkForUpdate, download } = require('../src/updater')
  try {
    const update = await checkForUpdate()
    if (!update) console.log('KẾT QUẢ: không có bản mới')
    else {
      const file = await download(update)
      console.log(`KẾT QUẢ: nhận ${update.version}, tải và kiểm SHA-256 xong (${require('fs').statSync(file).size} byte)`)
    }
  } catch (error) {
    console.log(`KẾT QUẢ: từ chối — ${error.message}`)
  }
  app.exit(0)
})
