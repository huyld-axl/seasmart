// Đếm ngược dạng m:ss, ví dụ 105 giây -> "1:45". Làm tròn lên để không hiện 0:00 khi còn lẻ giây.
export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// Số giây còn lại tới mốc `until` (ms); 0 khi chưa đặt hoặc đã qua.
export function secondsLeft(until, now = Date.now()) {
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
}
