let errorNotifier = null

export function setErrorNotifier(fn) {
  errorNotifier = typeof fn === 'function' ? fn : null
}

export function notifyError(messageText) {
  const msg = messageText || 'Có lỗi xảy ra'
  if (errorNotifier) {
    errorNotifier(msg)
    return
  }

  // Fallback nhẹ khi App context chưa sẵn sàng.
  // Tránh dùng static antd message để không phát warning theme context.

  console.error(msg)
}
