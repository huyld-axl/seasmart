export const PHOTO_MAX_BYTES = 10 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png']

// Kiểm tra ảnh chọn từ ô chọn tệp hoặc kéo thả. Trả về thông báo lỗi, hoặc '' nếu hợp lệ.
export function photoProblem(file) {
  if (!PHOTO_TYPES.includes(file.type)) return 'Chỉ nhận ảnh JPG hoặc PNG'
  if (file.size > PHOTO_MAX_BYTES) return 'Ảnh lớn hơn 10 MB, chọn ảnh nhỏ hơn'
  return ''
}
