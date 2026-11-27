// Nhà cung cấp AI "cloud" của app máy tính (docs/catoro-ke-hoach-desktop-gd2.md 4.5): gửi ảnh tới máy chủ dịch vụ Catoro
// (qua cổng ký của tiến trình chính), máy chủ gọi nhà cung cấp AI thật bằng khoá của bên mình. Bộ cài không có khoá AI.
const desktopCloud = require('../../utils/desktop_cloud')

function createCloudProvider() {
  return {
    name: 'cloud',
    // Có văn phòng mới gọi được; chưa có thì lời gọi báo lỗi rõ (desktopCloud.call → NO_OFFICE).
    isConfigured: () => true,
    missing: () => [],
    describe: () => ({ provider: 'cloud', model: 'máy chủ Catoro', models: { small: 'máy chủ Catoro', strong: 'máy chủ Catoro' } }),
    async callVision({ images, ...args }) {
      const payload = { ...args, images: images.map((image) => ({ mimeType: image.mimeType, base64: image.buffer.toString('base64') })) }
      try {
        return await desktopCloud.call('/api/ai/vision', payload)
      } catch (error) {
        if (error.code === 'CLOUD_OFFLINE' || error.code === 'SIGNER_DOWN') throw { statusCode: 503, message: 'Cần kết nối internet để AI đọc giấy tờ' }
        if (error.code === 'OFFICE_LOCKED') throw { statusCode: 403, message: 'Văn phòng đang bị khoá dịch vụ AI, liên hệ Catoro' }
        throw error
      }
    },
  }
}

module.exports = { createCloudProvider }
