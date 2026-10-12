// Nhà cung cấp Claude: bọc lời gọi đọc giấy đã có từ trước, cùng chữ ký callVision với OpenAI.
const DEFAULT_MODEL = 'claude-opus-5-5'

function toAppError(err) {
  if (err?.statusCode && !err?.status) return err
  const status = err?.status
  if (status === 401 || status === 403) return { statusCode: 502, message: 'Khoá Anthropic không hợp lệ hoặc không có quyền dùng model này' }
  if (status === 429) return { statusCode: 503, message: 'AI đang quá tải, thử lại sau ít phút' }
  return { statusCode: 502, message: 'Không gọi được AI, thử lại sau' }
}

function contentBlock({ buffer, mimeType }) {
  const data = buffer.toString('base64')
  if (mimeType === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
  return { type: 'image', source: { type: 'base64', media_type: mimeType, data } }
}

function createAnthropicProvider({ apiKey, model, timeoutMs = 120000, clientFactory } = {}) {
  const modelId = model || DEFAULT_MODEL
  let client = null
  function getClient() {
    if (!client) {
      client = clientFactory ? clientFactory({ apiKey }) : new (require('@anthropic-ai/sdk'))({ apiKey })
    }
    return client
  }

  return {
    name: 'anthropic',

    missing() {
      return apiKey ? [] : ['ANTHROPIC_API_KEY']
    },

    isConfigured() {
      return Boolean(apiKey)
    },

    describe() {
      return { provider: 'anthropic', model: modelId, models: { small: modelId, strong: modelId } }
    },

    // Claude dùng một model cho mọi mức (tier) và bỏ qua detail.
    async callVision({ instructions, images, schema }) {
      if (!this.isConfigured()) throw { statusCode: 503, message: 'AI chưa được cấu hình (thiếu ANTHROPIC_API_KEY)' }
      if (!images?.length) throw { statusCode: 400, message: 'Không có ảnh để đọc' }
      const startedAt = Date.now()
      let response
      try {
        response = await getClient().beta.messages.create({
          model: modelId,
          max_tokens: 8000,
          thinking: { type: 'adaptive' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { format: { type: 'json_schema', schema } },
          messages: [{ role: 'user', content: [...images.map(contentBlock), { type: 'text', text: instructions }] }],
        }, { timeout: timeoutMs })
      } catch (err) {
        throw toAppError(err)
      }
      if (response.stop_reason === 'refusal') throw { statusCode: 422, message: 'AI không đọc giấy này. Nhập tay giúp.' }
      if (response.stop_reason === 'max_tokens') throw { statusCode: 422, message: 'Giấy quá dài, AI đọc chưa hết. Tách trang rồi tải lại.' }
      const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('')
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw { statusCode: 502, message: 'AI trả kết quả không đọc được. Thử lại.' }
      }
      return {
        data,
        model: response.model || modelId,
        usage: { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 },
        requestId: response._request_id || response.id || null,
        latencyMs: Date.now() - startedAt,
      }
    },
  }
}

module.exports = { createAnthropicProvider }
