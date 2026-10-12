import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { createOpenAIProvider } = require('../openai_provider')
const { createLimiter } = require('../limiter')

const IMAGE = { buffer: Buffer.from('jpegbytes'), mimeType: 'image/jpeg' }
const ARGS = { task: 'split', tier: 'small', detail: 'low', instructions: 'Nhận loại trang', images: [IMAGE], schemaName: 'split_result', schema: { type: 'object' } }
const OK = { status: 'completed', output_text: '{"pages":[]}', model: 'm-small', usage: { input_tokens: 120, output_tokens: 7 }, _request_id: 'req_1' }

// Giả lập SDK: mỗi phần tử trong plan là một kết quả hoặc một lỗi cho lần gọi tương ứng.
function fakeProvider(plan, extra = {}) {
  const create = vi.fn()
  for (const step of plan) {
    if (step instanceof Error) create.mockRejectedValueOnce(step)
    else create.mockResolvedValueOnce(step)
  }
  const provider = createOpenAIProvider({
    apiKey: 'k',
    models: { small: 'm-small', strong: 'm-strong' },
    retryDelayMs: 0,
    clientFactory: () => ({ responses: { create } }),
    ...extra,
  })
  return { provider, create }
}

const httpError = (status, name = 'APIError') => Object.assign(new Error('chi tiết nội bộ'), { status, name })

describe('openai provider', () => {
  it('thiếu key hoặc mã model thì chưa cấu hình và báo biến còn thiếu', () => {
    const provider = createOpenAIProvider({ apiKey: '', models: { small: 'a' } })
    expect(provider.isConfigured()).toBe(false)
    expect(provider.missing()).toEqual(['OPENAI_API_KEY', 'OPENAI_MODEL_STRONG'])
    expect(createOpenAIProvider({ apiKey: 'k', models: { small: 'a', strong: 'b' } }).isConfigured()).toBe(true)
  })

  it('không gọi SDK khi chưa cấu hình', async () => {
    const create = vi.fn()
    const provider = createOpenAIProvider({ apiKey: '', models: {}, clientFactory: () => ({ responses: { create } }) })
    await expect(provider.callVision(ARGS)).rejects.toMatchObject({ statusCode: 503 })
    expect(create).not.toHaveBeenCalled()
  })

  it('gửi store:false, khuôn strict, ảnh data URL và model theo mức', async () => {
    const { provider, create } = fakeProvider([OK])
    const result = await provider.callVision({ ...ARGS, tier: 'strong', detail: 'high' })
    const [request] = create.mock.calls[0]
    expect(request.store).toBe(false)
    expect(request.model).toBe('m-strong')
    expect(request.instructions).toBe('Nhận loại trang')
    expect(request.text.format).toMatchObject({ type: 'json_schema', name: 'split_result', strict: true })
    expect(request.input[0].content[0]).toMatchObject({ type: 'input_image', detail: 'high' })
    expect(request.input[0].content[0].image_url).toBe(`data:image/jpeg;base64,${IMAGE.buffer.toString('base64')}`)
    expect(result).toMatchObject({ data: { pages: [] }, model: 'm-small', usage: { input: 120, output: 7 }, requestId: 'req_1' })
  })

  it('thử lại lỗi tạm thời rồi thành công', async () => {
    const { provider, create } = fakeProvider([httpError(429), httpError(503), Object.assign(new Error('x'), { name: 'APIConnectionError' }), OK])
    const result = await provider.callVision(ARGS)
    expect(create).toHaveBeenCalledTimes(4)
    expect(result.data).toEqual({ pages: [] })
  })

  it('thử lại tối đa 3 lần rồi báo lỗi, không lộ chi tiết lỗi gốc', async () => {
    const { provider, create } = fakeProvider([httpError(500), httpError(500), httpError(500), httpError(500)])
    const err = await provider.callVision(ARGS).catch((e) => e)
    expect(create).toHaveBeenCalledTimes(4)
    expect(err.statusCode).toBe(502)
    expect(err.message).not.toContain('chi tiết nội bộ')
  })

  it.each([400, 401])('không thử lại lỗi %i', async (status) => {
    const { provider, create } = fakeProvider([httpError(status), OK])
    await expect(provider.callVision(ARGS)).rejects.toMatchObject({ statusCode: 502 })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('từ chối PDF và kết quả hỏng', async () => {
    const { provider } = fakeProvider([{ ...OK, output_text: 'không phải JSON' }])
    await expect(provider.callVision({ ...ARGS, images: [{ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf' }] })).rejects.toMatchObject({ statusCode: 400 })
    await expect(provider.callVision(ARGS)).rejects.toMatchObject({ statusCode: 502 })
  })

  it('model từ chối hoặc đọc dở thì báo lỗi 422', async () => {
    const refusal = { status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'no' }] }] }
    const { provider } = fakeProvider([refusal, { status: 'incomplete', output: [] }])
    await expect(provider.callVision(ARGS)).rejects.toMatchObject({ statusCode: 422 })
    await expect(provider.callVision(ARGS)).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('limiter', () => {
  it('không chạy quá số lời gọi song song cho phép', async () => {
    const limiter = createLimiter(2)
    let active = 0
    let peak = 0
    const task = () => limiter.run(async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    })
    await Promise.all(Array.from({ length: 6 }, task))
    expect(peak).toBe(2)
  })

  it('một lời gọi lỗi không chặn hàng đợi', async () => {
    const limiter = createLimiter(1)
    const failing = limiter.run(async () => { throw new Error('x') })
    const next = limiter.run(async () => 'ok')
    await expect(failing).rejects.toThrow()
    await expect(next).resolves.toBe('ok')
  })
})
