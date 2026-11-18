// Cửa sổ tiến độ cập nhật: tiến trình chính gọi show({ title, hint, done, total }) qua executeJavaScript.
// Có total thì vẽ phần trăm; không có thì thanh chạy qua lại.
const mb = (n) => `${Math.round(n / 1024 / 1024)} MB`

window.show = ({ title, hint, done, total }) => {
  document.getElementById('title').textContent = title
  if (hint) document.getElementById('hint').textContent = hint
  const known = total > 0 && done >= 0
  const percent = known ? Math.min(100, Math.floor((done / total) * 100)) : null
  document.getElementById('bar').classList.toggle('wait', !known)
  document.getElementById('fill').style.width = known ? `${percent}%` : ''
  document.getElementById('amount').textContent = known ? `${mb(done)} / ${mb(total)}` : ''
  document.getElementById('percent').textContent = known ? `${percent}%` : ''
}
