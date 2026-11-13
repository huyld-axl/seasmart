import { describe, it, expect } from 'vitest'
import { assertVersion } from '../row_version'

const db = { query: async () => [[{ email: 'hoa@abc.vn' }]] }

describe('assertVersion', () => {
  it('cho lưu khi đúng số phiên bản hoặc không gửi', async () => {
    await expect(assertVersion(db, { version: 3 }, 3)).resolves.toBeUndefined()
    await expect(assertVersion(db, { version: 3 }, '3')).resolves.toBeUndefined()
    await expect(assertVersion(db, { version: 3 }, undefined)).resolves.toBeUndefined()
  })
  it('409 kèm người sửa khi số đã cũ', async () => {
    const at = new Date('2026-11-12T03:42:00Z')
    const expected = new Date(at.getTime() - at.getTimezoneOffset() * 60000)
    await expect(assertVersion(db, { version: 4, updated_by: 7, updated_at: at }, 3)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      conflict: { changed_by: 'hoa@abc.vn', changed_at: expected, version: 4 },
    })
  })
})
