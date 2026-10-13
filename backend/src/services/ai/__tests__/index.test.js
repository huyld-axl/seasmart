import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pool = require('../../../config/db')
const ai = require('../index')

describe('ai.run', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('ghi ai_call chỉ gồm số liệu, không có nội dung ảnh hay chữ đọc được', async () => {
    const query = vi.spyOn(pool, 'query').mockResolvedValue([{}])
    vi.spyOn(ai, 'callVision').mockResolvedValue({
      data: { name: 'TRAN VAN A' }, model: 'm', usage: { input: 10, output: 2 }, requestId: 'req_9', latencyMs: 42,
    })
    await ai.run({ task: 'split', uploadId: 5, promptVersion: 'split-1', tier: 'small', images: [{ buffer: Buffer.from('anh-bi-mat'), mimeType: 'image/jpeg' }] })
    const [sql, values] = query.mock.calls[0]
    expect(sql).toContain('INSERT INTO ai_call')
    expect(values).toEqual([5, null, 'split', 'openai', 'm', 'split-1', 10, 2, 42, 'req_9', 'OK', null])
    expect(JSON.stringify(values)).not.toMatch(/TRAN VAN A|anh-bi-mat/)
  })

  it('lỗi gọi AI vẫn được ghi và ném lại; lỗi ghi nhật ký không che lỗi gốc', async () => {
    vi.spyOn(pool, 'query').mockRejectedValue(new Error('db down'))
    vi.spyOn(ai, 'callVision').mockRejectedValue({ statusCode: 502, message: 'Không gọi được AI, thử lại sau' })
    await expect(ai.run({ task: 'certificate', documentId: 3, tier: 'small' })).rejects.toMatchObject({ statusCode: 502 })
  })
})
