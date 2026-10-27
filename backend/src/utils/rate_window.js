// Giới hạn số lượt trong một cửa sổ trượt, theo khoá (ví dụ id người dùng). Giữ trong bộ nhớ tiến trình.
function createRateWindow({ max, windowMs, now = Date.now }) {
  const hits = new Map()
  return {
    // { ok: true } và ghi nhận một lượt; hoặc { ok: false, retryAfter } (giây) khi đã hết lượt.
    hit(key) {
      const t = now()
      const recent = (hits.get(key) || []).filter((time) => t - time < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (t - recent[0])) / 1000)) }
      }
      recent.push(t)
      hits.set(key, recent)
      return { ok: true }
    },
  }
}

module.exports = { createRateWindow }
