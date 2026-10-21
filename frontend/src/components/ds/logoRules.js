export const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ['image/jpeg', 'image/png']

// Trả về thông báo lỗi, hoặc '' nếu logo hợp lệ.
export function logoProblem(file) {
  if (!LOGO_TYPES.includes(file.type)) return 'Chỉ nhận logo JPG hoặc PNG'
  if (file.size > LOGO_MAX_BYTES) return 'Logo lớn hơn 2 MB, chọn ảnh nhỏ hơn'
  return ''
}
