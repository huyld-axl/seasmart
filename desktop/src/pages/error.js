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
