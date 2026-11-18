// Màn lỗi khởi động: hiện lý do theo mã lỗi, nút gọi app qua window.mcah.startup (preload).
const REASONS = {
  DB_START: 'Không khởi động được cơ sở dữ liệu.',
  DB_MIGRATE: 'Không cập nhật được cấu trúc dữ liệu.',
  BACKEND_START: 'Không khởi động được phần xử lý của app.',
  DISK_FULL: 'Ổ đĩa đã đầy.',
  UNKNOWN: 'Gặp lỗi không rõ khi mở app.',
}
const params = new URLSearchParams(location.search)
const code = REASONS[params.get('code')] ? params.get('code') : 'UNKNOWN'
document.getElementById('reason').textContent = REASONS[code]
document.getElementById('code').textContent = `Mã lỗi: ${code} · ${params.get('at') || ''}`
document.getElementById('retry').onclick = () => window.mcah.startup.retry()
document.getElementById('logs').onclick = () => window.mcah.startup.openLogs()
document.getElementById('quit').onclick = () => window.mcah.startup.quit()

// Gửi báo lỗi: app tự gom nhật ký và thông tin máy (tiến trình chính), trang này chỉ gửi ghi chú.
const report = document.getElementById('report')
const result = document.getElementById('result')
const sendButton = document.getElementById('send')
document.getElementById('open-report').onclick = () => {
  report.hidden = false
  document.getElementById('note').focus()
}
document.getElementById('cancel').onclick = () => (report.hidden = true)
sendButton.onclick = async () => {
  sendButton.disabled = true
  sendButton.textContent = 'Đang gửi…'
  try {
    const out = await window.mcah.startup.sendReport(document.getElementById('note').value)
    report.hidden = true
    result.hidden = false
    result.className = 'ok'
    if (out.status === 'sent') {
      result.textContent = `Đã gửi báo lỗi cho MCAH (mã ${out.id}). Khi liên hệ hỗ trợ, đọc mã này giúp.`
    } else {
      result.textContent = 'Không gửi được qua mạng. Đã lưu báo lỗi thành tệp trong thư mục Tải xuống; gửi tệp này cho bộ phận hỗ trợ MCAH.'
      window.mcah.startup.revealReport(out.path)
    }
  } catch {
    sendButton.disabled = false
    sendButton.textContent = 'Gửi'
    result.hidden = false
    result.className = 'err'
    result.textContent = 'Không gửi được báo lỗi. Bấm “Mở thư mục nhật ký” và gửi tệp nhật ký cho bộ phận hỗ trợ.'
  }
}
