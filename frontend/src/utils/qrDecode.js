import jsQR from 'jsqr'

const MAX_EDGE = 1600

// Đọc mã QR trong một tệp ảnh (ảnh chụp màn hình hay ảnh chụp từ camera). Trả chữ trong mã, hoặc null nếu không thấy mã.
export async function decodeQrFile(file) {
  const bitmap = await createImageBitmap(file)
  try {
    // Thử ảnh gốc rồi thu nhỏ: ảnh chụp camera lớn đôi khi đọc tốt hơn sau khi thu nhỏ.
    for (const scale of [1, 0.5]) {
      const longest = Math.max(bitmap.width, bitmap.height)
      const ratio = Math.min(1, MAX_EDGE / longest) * scale
      const width = Math.max(1, Math.round(bitmap.width * ratio))
      const height = Math.max(1, Math.round(bitmap.height * ratio))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(bitmap, 0, 0, width, height)
      const { data } = ctx.getImageData(0, 0, width, height)
      const hit = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
      if (hit?.data) return hit.data
    }
    return null
  } finally {
    bitmap.close?.()
  }
}
