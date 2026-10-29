import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
const require = createRequire(import.meta.url)
const config = require('../../config')
const { certificateFilePath, TRASH_DAYS } = require('../file_trash')

describe('quy tắc xoá tệp', () => {
  it('giữ tệp 180 ngày trước khi xoá khỏi ổ đĩa', () => {
    expect(TRASH_DAYS).toBe(180)
  })
  it('đổi document_url của chứng chỉ ra đường dẫn trên ổ đĩa, bỏ qua khi rỗng', () => {
    expect(certificateFilePath(31, '/uploads/certificates/31/1_17.jpg')).toBe(path.join(config.upload.dir, 'certificates', '31', '1_17.jpg'))
    expect(certificateFilePath(31, null)).toBeNull()
  })
})
