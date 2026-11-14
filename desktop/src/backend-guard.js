// Nạp trước vào tiến trình backend (node -r). App giữ đầu kia của stdin; app thoát vì bất cứ lý do gì
// (kể cả kill -9) thì stdin đóng và backend tự thoát theo, không còn tiến trình mồ côi giữ cổng.
process.stdin.on('end', () => process.exit(0))
process.stdin.on('error', () => process.exit(0))
process.stdin.resume()
