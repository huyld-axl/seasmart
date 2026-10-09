const Anthropic = require('@anthropic-ai/sdk')
const { DOC_TYPES, AI_STATES } = require('../constants/document_types')

const MODEL = process.env.DOC_READER_MODEL || 'claude-opus-5-5'

// Kết quả AI trả về theo đúng khuôn này (structured output), backend lọc lại theo DOC_TYPES.
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['doc_type', 'page_label', 'fields'],
  properties: {
    doc_type: { type: 'string', enum: [...Object.keys(DOC_TYPES), 'other'] },
    page_label: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'raw', 'value', 'state', 'note'],
        properties: {
          key: { type: 'string' },
          raw: { type: 'string' },
          value: { type: 'string' },
          state: { type: 'string', enum: AI_STATES },
          note: { type: 'string' },
        },
      },
    },
  },
}

function layoutText() {
  return Object.entries(DOC_TYPES).map(([type, t]) => {
    const fields = t.fields.map((field) => `  - ${field.key}: ${field.label} (${field.english})${field.date ? ' [ngày]' : ''}`).join('\n')
    return `${type} — ${t.label}\n${fields}`
  }).join('\n\n')
}

function buildPrompt(certificateTypes) {
  const types = certificateTypes.map((c) => `${c.code}: ${c.name_vi}`).join('\n')
  return [
    'Bạn đọc ảnh giấy tờ của thuyền viên Việt Nam cho một agency tuyển dụng. Người duyệt sẽ so từng ô với bản gốc, nên đọc trung thực, không đoán.',
    '',
    'Bước 1: nhận loại giấy, chọn một doc_type dưới đây; không khớp loại nào thì "other" và để fields rỗng.',
    'Bước 2: với mỗi ô của loại đó, trả một phần tử fields:',
    '- key: đúng key trong danh sách.',
    '- raw: chữ đúng như trên giấy, giữ nguyên chính tả và dấu chấm trong ngày.',
    '- value: giá trị đã chuẩn hoá. Tên người viết hoa chữ cái đầu có dấu tiếng Việt; ngày dạng dd/mm/yyyy.',
    '- state: PROPOSED khi đọc rõ; UNKNOWN khi ô để trống hoặc không có trên giấy (raw và value để rỗng); DATE_AMBIGUOUS khi ngày viết tay có thể đọc hai cách.',
    '- note: một câu tiếng Việt khi state không phải PROPOSED, nói vì sao; còn lại để rỗng.',
    'page_label: trang nào của giấy (ví dụ "Trang 2–3"), không rõ thì "1 trang".',
    certificateTypes.length ? '\nVới chứng chỉ, ô typeCode là mã loại chứng chỉ khớp nhất trong danh mục dưới đây (cả raw và value là mã), không khớp thì UNKNOWN:\n' + types : '',
    '',
    'Các loại giấy và ô:',
    layoutText(),
  ].join('\n')
}

// Lọc kết quả AI theo khuôn: bỏ key lạ, ô thiếu thì thành UNKNOWN, giữ thứ tự trên giấy.
function normalizeExtraction(result) {
  const type = DOC_TYPES[result?.doc_type]
  if (!type) return { doc_type: null, page_label: result?.page_label || null, fields: [] }
  const byKey = new Map((result.fields || []).map((field) => [field.key, field]))
  const fields = type.fields.map((layout) => {
    const got = byKey.get(layout.key)
    const state = AI_STATES.includes(got?.state) ? got.state : 'UNKNOWN'
    const value = state === 'UNKNOWN' ? '' : String(got?.value || '').trim().slice(0, 500)
    return {
      key: layout.key,
      raw: String(got?.raw || '').trim().slice(0, 500),
      value,
      state: state === 'PROPOSED' && !value ? 'UNKNOWN' : state,
      note: String(got?.note || '').trim().slice(0, 500) || null,
    }
  })
  return { doc_type: result.doc_type, page_label: String(result.page_label || '').slice(0, 100) || null, fields }
}

function contentBlock(buffer, mimeType) {
  const data = buffer.toString('base64')
  if (mimeType === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
  return { type: 'image', source: { type: 'base64', media_type: mimeType, data } }
}

const documentReader = {
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY)
  },

  async read(buffer, mimeType, certificateTypes = []) {
    if (!this.isConfigured()) {
      throw { statusCode: 503, message: 'AI đọc giấy tờ chưa được cấu hình (thiếu ANTHROPIC_API_KEY)' }
    }
    const client = new Anthropic()
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [{
        role: 'user',
        content: [contentBlock(buffer, mimeType), { type: 'text', text: buildPrompt(certificateTypes) }],
      }],
    })
    if (response.stop_reason === 'refusal') throw { statusCode: 422, message: 'AI không đọc giấy này. Nhập tay giúp.' }
    if (response.stop_reason === 'max_tokens') throw { statusCode: 422, message: 'Giấy quá dài, AI đọc chưa hết. Tách trang rồi tải lại.' }
    const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('')
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw { statusCode: 502, message: 'AI trả kết quả không đọc được. Thử lại.' }
    }
    return normalizeExtraction(parsed)
  },
}

module.exports = documentReader
module.exports.normalizeExtraction = normalizeExtraction
module.exports.buildPrompt = buildPrompt
