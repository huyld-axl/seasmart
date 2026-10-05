'use strict'

const path = require('path')
const fs = require('fs')
const { FORM_META } = require('../../services/form_export.service')

const FORMS_DIR = path.resolve(__dirname, '../../../forms')
const META_FILE = path.join(FORMS_DIR, 'template_meta.json')

const TEMPLATE_META = [
  ...FORM_META,
  { key: 'cv_template', label: 'Mẫu CV thuyền viên (Trung Quốc)', file: 'CV china.xlsx' },
  { key: 'cv_eng_template', label: 'Mẫu CV thuyền viên (tiếng Anh)', file: 'CV eng.xlsx' },
  { key: 'bb_giao_nhan', label: 'BB Giao Nhận Giấy Tờ TV', file: 'BB GIAO NHẬN GIẤY TỜ TV.xlsx' },
]

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function writeMeta(data) {
  if (!fs.existsSync(FORMS_DIR)) fs.mkdirSync(FORMS_DIR, { recursive: true })
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2))
}

async function formTemplateRoutes(fastify) {
  // GET /api/v1/forms - list templates with upload status
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req) => {
    if (!['admin', 'operator'].includes(req.user.role)) {
      throw { statusCode: 403, message: 'Không có quyền' }
    }
    const uploadedMeta = readMeta()
    return TEMPLATE_META.map(({ key, label, file }) => ({
      key,
      label,
      file,
      originalName: uploadedMeta[key]?.originalName || null,
      exists: fs.existsSync(path.join(FORMS_DIR, file)),
    }))
  })

  // PUT /api/v1/forms/:formKey/template - replace template file
  fastify.put('/:formKey/template', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    if (!['admin', 'operator'].includes(req.user.role)) {
      throw { statusCode: 403, message: 'Không có quyền' }
    }

    const { formKey } = req.params
    const meta = TEMPLATE_META.find((f) => f.key === formKey)
    if (!meta) throw { statusCode: 404, message: `Form không tồn tại: ${formKey}` }

    const data = await req.file()
    if (!data) throw { statusCode: 400, message: 'Không có file' }

    const mime = data.mimetype
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    if (!allowed.includes(mime)) {
      throw { statusCode: 400, message: 'Chỉ chấp nhận file .xlsx hoặc .xls' }
    }

    if (!fs.existsSync(FORMS_DIR)) fs.mkdirSync(FORMS_DIR, { recursive: true })

    const destPath = path.join(FORMS_DIR, meta.file)
    const buf = await data.toBuffer()
    fs.writeFileSync(destPath, buf)

    const uploadedMeta = readMeta()
    uploadedMeta[formKey] = { originalName: data.filename, updatedAt: new Date().toISOString() }
    writeMeta(uploadedMeta)

    return reply.code(200).send({ message: `Đã cập nhật template: ${meta.label}` })
  })
}

module.exports = formTemplateRoutes
