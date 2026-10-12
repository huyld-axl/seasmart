// Nhà cung cấp OpenAI qua Responses API. Mọi lời gọi gửi store: false; không ghi nội dung giấy vào log.
const MAX_RETRIES = 3

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Lỗi tạm thời: quá tải (429), máy chủ OpenAI lỗi (5xx), mất kết nối hoặc quá thời gian chờ.
function isTransient(err) {
  if (typeof err?.status === 'number') return err.status === 429 || err.status >= 500
  return ['APIConnectionError', 'APIConnectionTimeoutError'].includes(err?.name) ||
    ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(err?.code)
}

// Đổi lỗi SDK thành { statusCode, message } an toàn: không đưa nội dung gốc của lỗi ra ngoài.
function toAppError(err) {
  if (err?.statusCode && !err?.status) return err
  const status = err?.status
  if (status === 401 || status === 403) return { statusCode: 502, message: 'Khoá OpenAI không hợp lệ hoặc không có quyền dùng model này' }
  if (status === 429) return { statusCode: 503, message: 'AI đang quá tải, thử lại sau ít phút' }
  if (status === 400 || status === 404 || status === 422) return { statusCode: 502, message: 'OpenAI từ chối yêu cầu đọc giấy. Kiểm tra mã model đã cấu hình' }
  if (err?.name === 'APIConnectionTimeoutError') return { statusCode: 504, message: 'AI trả lời quá lâu, thử lại' }
  return { statusCode: 502, message: 'Không gọi được AI, thử lại sau' }
}

function buildInput(images, detail) {
  return [{
    role: 'user',
    content: images.map((image) => {
      if (!/^image\/(jpeg|png|webp)$/.test(image.mimeType)) {
        throw { statusCode: 400, message: 'OpenAI chỉ nhận ảnh JPG, PNG; PDF phải được cắt thành ảnh từng trang trước' }
      }
      return { type: 'input_image', image_url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`, detail }
    }),
  }]
}

function parseResponse(response) {
  if (response?.status === 'incomplete') {
    throw { statusCode: 422, message: 'AI đọc chưa hết giấy này. Tách ít trang hơn rồi thử lại.' }
  }
  const parts = (response?.output || []).flatMap((item) => item.content || [])
  if (parts.some((part) => part.type === 'refusal')) throw { statusCode: 422, message: 'AI không đọc giấy này. Nhập tay giúp.' }
  const text = response?.output_text ?? parts.filter((part) => part.type === 'output_text').map((part) => part.text).join('')
  try {
    return JSON.parse(text)
  } catch {
    throw { statusCode: 502, message: 'AI trả kết quả không đọc được. Thử lại.' }
  }
}

function createOpenAIProvider({ apiKey, baseURL, models = {}, timeoutMs = 120000, retryDelayMs = 1000, clientFactory } = {}) {
  let client = null
  function getClient() {
    if (!client) {
      client = clientFactory
        ? clientFactory({ apiKey, baseURL })
        : new (require('openai'))({ apiKey, baseURL: baseURL || undefined, maxRetries: 0 })
    }
    return client
  }

  return {
    name: 'openai',

    missing() {
      const missing = []
      if (!apiKey) missing.push('OPENAI_API_KEY')
      if (!models.small) missing.push('OPENAI_MODEL_SMALL')
      if (!models.strong) missing.push('OPENAI_MODEL_STRONG')
      return missing
    },

    isConfigured() {
      return this.missing().length === 0
    },

    describe() {
      return { provider: 'openai', model: models.strong || null, models: { small: models.small || null, strong: models.strong || null } }
    },

    async callVision({ tier = 'small', detail = 'high', instructions, images, schemaName, schema }) {
      if (!this.isConfigured()) throw { statusCode: 503, message: `AI chưa được cấu hình (thiếu ${this.missing().join(', ')})` }
      if (!images?.length) throw { statusCode: 400, message: 'Không có ảnh để đọc' }
      const model = models[tier]
      if (!model) throw { statusCode: 400, message: 'Mức model không hợp lệ' }
      const request = {
        model,
        store: false,
        instructions,
        input: buildInput(images, detail),
        text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
      }

      const startedAt = Date.now()
      let response
      for (let attempt = 0; ; attempt += 1) {
        try {
          response = await getClient().responses.create(request, { timeout: timeoutMs })
          break
        } catch (err) {
          if (attempt >= MAX_RETRIES || !isTransient(err)) throw toAppError(err)
          await sleep(retryDelayMs * 2 ** attempt)
        }
      }
      const data = parseResponse(response)
      return {
        data,
        model: response.model || model,
        usage: { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 },
        requestId: response._request_id || response.id || null,
        latencyMs: Date.now() - startedAt,
      }
    },
  }
}

module.exports = { createOpenAIProvider, isTransient, toAppError }
