// Lớp nhà cung cấp AI: chọn theo AI_PROVIDER, giới hạn song song, ghi nhật ký ai_call (không chứa nội dung giấy).
const config = require('../../config')
const pool = require('../../config/db')
const { createLimiter } = require('./limiter')
const { createOpenAIProvider } = require('./openai_provider')
const { createAnthropicProvider } = require('./anthropic_provider')

let provider = null
let limiter = null

function buildProvider() {
  const { ai } = config
  if (ai.provider === 'anthropic') {
    return createAnthropicProvider({ apiKey: ai.anthropicApiKey, model: ai.anthropicModel, timeoutMs: ai.timeoutMs })
  }
  return createOpenAIProvider({
    apiKey: ai.openaiApiKey,
    baseURL: ai.openaiBaseUrl,
    models: { small: ai.openaiModelSmall, strong: ai.openaiModelStrong },
    timeoutMs: ai.timeoutMs,
  })
}

function getProvider() {
  if (!provider) provider = buildProvider()
  return provider
}

const ai = {
  isConfigured() {
    return getProvider().isConfigured()
  },

  // Chữ cho thông báo "chưa cấu hình", gồm tên biến còn thiếu của nhà cung cấp đang chọn.
  notConfiguredMessage() {
    return `AI đọc giấy tờ chưa được cấu hình (thiếu ${getProvider().missing().join(', ')})`
  },

  describe() {
    return { configured: this.isConfigured(), ...getProvider().describe() }
  },

  // callVision({ task, tier, detail, instructions, images, schemaName, schema })
  // → { data, model, usage: { input, output }, requestId, latencyMs }
  async callVision(args) {
    if (!limiter) limiter = createLimiter(config.ai.concurrency)
    return limiter.run(() => getProvider().callVision(args))
  },

  // callVision kèm ghi ai_call. Việc ghi nhật ký lỗi không làm hỏng lời gọi.
  async run({ task, uploadId = null, documentId = null, promptVersion = null, ...args }) {
    const info = getProvider().describe()
    try {
      const result = await ai.callVision({ task, ...args })
      await ai.log({ task, uploadId, documentId, promptVersion, model: result.model, usage: result.usage, requestId: result.requestId, latencyMs: result.latencyMs, status: 'OK' })
      return result
    } catch (err) {
      await ai.log({ task, uploadId, documentId, promptVersion, model: info.models?.[args.tier] || info.model, status: 'ERROR', error: err?.message })
      throw err
    }
  },

  async log({ task, uploadId, documentId, promptVersion, model, usage, requestId, latencyMs, status, error }) {
    try {
      await pool.query(
        'INSERT INTO ai_call (upload_id, document_id, task, provider, model, prompt_version, input_tokens, output_tokens, latency_ms, request_id, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          uploadId, documentId, task, getProvider().name, model || null, promptVersion,
          usage?.input ?? null, usage?.output ?? null, latencyMs ?? null, requestId || null,
          status, error ? String(error).slice(0, 500) : null,
        ]
      )
    } catch {
      // Nhật ký là phụ; không để lỗi ghi làm hỏng việc đọc giấy.
    }
  },
}

module.exports = ai
