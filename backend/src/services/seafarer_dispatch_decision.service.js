const fs = require('fs')
const path = require('path')
const dayjs = require('dayjs')
const PizZip = require('pizzip')
const pool = require('../config/db')

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TEMPLATE_PATH = path.join(__dirname, '../../forms/dispatch_decision_table_template.docx')
const BLANK_PLACEHOLDER = '.......'
function escapeXml(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDateVi(value) {
  return value ? dayjs(value).format('DD/MM/YYYY') : ''
}

function formatDateEn(value) {
  return value ? dayjs(value).format('DD-MMM-YYYY') : ''
}

function formatArticleDateRangeVi(from, to) {
  if (from && to) return `${dayjs(from).format('DD')} - ${dayjs(to).format('DD/MM/YYYY')}`
  if (from) return dayjs(from).format('DD/MM/YYYY')
  if (to) return dayjs(to).format('DD/MM/YYYY')
  return BLANK_PLACEHOLDER
}

function formatArticleDateRangeEn(from, to) {
  if (from && to) return `${dayjs(from).format('DD MMM YYYY')} - ${dayjs(to).format('DD MMM YYYY')}`
  if (from) return dayjs(from).format('DD MMM YYYY')
  if (to) return dayjs(to).format('DD MMM YYYY')
  return BLANK_PLACEHOLDER
}

function stripVesselPrefix(vesselName) {
  return String(vesselName || '')
    .replace(/^(MT\s+)?PVT\s+/i, '')
    .trim()
}

function normalizeIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map((id) => parseInt(id, 10)).filter(Boolean))]
}

function buildSimpleRun(text, { italic = false } = {}) {
  const runPr = [
    italic ? '<w:i/><w:iCs/>' : '',
    '<w:sz w:val="26"/>',
    '<w:szCs w:val="26"/>',
    '<w:lang w:val="en-US"/>',
  ].join('')
  return `<w:r><w:rPr>${runPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function replaceAllExact(xml, search, value) {
  return xml.split(search).join(value)
}

function normalizeDecisionNumber(value) {
  const raw = String(value || '').trim()
  if (!raw) return '......../......../QĐ-TV-SPT'
  if (/\/QĐ-TV-SPT$/i.test(raw)) return raw
  return `${raw}/QĐ-TV-SPT`
}

function stripRepeatedTableHeaders(xml) {
  return xml.replace(/<w:tblHeader\/>/g, '')
}

function findParagraphXmlByText(xml, text) {
  return (
    [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
      .map((match) => match[0])
      .find((paragraphXml) => paragraphXml.includes(text)) || null
  )
}

function buildArticle1ParagraphXml(paragraphXml, payload) {
  const openTag = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>'
  const paragraphProps = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || ''
  const vesselName = stripVesselPrefix(payload.vessel_name) || BLANK_PLACEHOLDER
  const location = payload.embark_location || BLANK_PLACEHOLDER
  const embarkDateVi = formatArticleDateRangeVi(payload.embark_date_from, payload.embark_date_to)
  const embarkDateEn = formatArticleDateRangeEn(payload.embark_date_from, payload.embark_date_to)

  const runs = [
    '<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">Điều 1/ </w:t></w:r>',
    '<w:r><w:rPr><w:b/><w:bCs/><w:i/><w:iCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>Article 1</w:t></w:r>',
    '<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>:</w:t></w:r>',
    '<w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve"> Điều động nhân sự nhận nhiệm vụ tại tàu PVT </w:t></w:r>',
    `<w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t>${escapeXml(vesselName)}</w:t></w:r>`,
    '<w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">, dự kiến ngày </w:t></w:r>',
    buildSimpleRun(embarkDateVi),
    '<w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve"> tại </w:t></w:r>',
    `<w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t>${escapeXml(location)}</w:t></w:r>`,
    '<w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r>',
    '<w:r><w:rPr><w:i/><w:iCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">Arrange personnel to embark MT PVT </w:t></w:r>',
    `<w:r><w:rPr><w:i/><w:iCs/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t>${escapeXml(vesselName)}</w:t></w:r>`,
    '<w:r><w:rPr><w:i/><w:iCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve"> at </w:t></w:r>',
    `<w:r><w:rPr><w:i/><w:iCs/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t>${escapeXml(location)}</w:t></w:r>`,
    '<w:r><w:rPr><w:i/><w:iCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve"> o/a </w:t></w:r>',
    buildSimpleRun(embarkDateEn, { italic: true }),
    '<w:r><w:rPr><w:i/><w:iCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>:</w:t></w:r>',
  ]

  return `${openTag}${paragraphProps}${runs.join('')}</w:p>`
}

function buildArticle3ParagraphXml(paragraphXml, payload, { italic = false } = {}) {
  const openTag = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>'
  const paragraphProps = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || ''
  const effectiveDateSource = payload.actual_embark_date || payload.embark_date_from
  const effectiveDateText = !effectiveDateSource
    ? BLANK_PLACEHOLDER
    : italic
      ? dayjs(effectiveDateSource).format('DD MMM YYYY')
      : formatDateVi(effectiveDateSource)
  const decisionNumber = payload.decision_number || '......../......../QĐ-TV-SPT'
  const runs = italic
    ? [
        '<w:r><w:rPr><w:i/><w:iCs/><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr><w:t xml:space="preserve">The Decision comes into effect from </w:t></w:r>',
        `<w:r><w:rPr><w:i/><w:iCs/><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t>${escapeXml(effectiveDateText)}</w:t></w:r>`,
        '<w:r><w:rPr><w:i/><w:iCs/><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t xml:space="preserve"> and replaces Decision No. </w:t></w:r>',
        `<w:r><w:rPr><w:i/><w:iCs/><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t xml:space="preserve">${escapeXml(decisionNumber)}. </w:t></w:r>`,
      ]
    : [
        '<w:r><w:rPr><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr><w:t xml:space="preserve">Quyết định này có hiệu lực kể từ ngày </w:t></w:r>',
        `<w:r><w:rPr><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t>${escapeXml(effectiveDateText)}</w:t></w:r>`,
        '<w:r><w:rPr><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t xml:space="preserve">, thay thế cho Quyết định số </w:t></w:r>',
        `<w:r><w:rPr><w:spacing w:val="-12"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="en-US"/></w:rPr><w:t xml:space="preserve">${escapeXml(decisionNumber)}. </w:t></w:r>`,
      ]

  return `${openTag}${paragraphProps}${runs.join('')}</w:p>`
}

function getTemplateXml() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('Khong tim thay mau quyet dinh dieu dong')
  }
  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH, 'binary'))
  const xml = zip.files['word/document.xml']?.asText()
  if (!xml) {
    throw new Error('Khong doc duoc noi dung mau quyet dinh dieu dong')
  }
  return { zip, xml }
}

function getRowBlocks(xml) {
  return [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((match) => match[0])
}

function findSampleRowXml(xml) {
  return (
    getRowBlocks(xml).find(
      (rowXml) => rowXml.includes('Nguyen Van A') && rowXml.includes('Replace')
    ) || null
  )
}

function buildParagraphFromTemplate(paragraphXml, text) {
  const openTag = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>'
  const paragraphProps = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || ''
  const runProps = paragraphXml.match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] || ''

  if (!text) {
    return `${openTag}${paragraphProps}</w:p>`
  }

  return (
    `${openTag}${paragraphProps}<w:r>${runProps}` +
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
  )
}

function replaceCellParagraphs(cellXml, texts) {
  const cellOpenTag = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] || '<w:tc>'
  const cellProps = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] || ''
  const paragraphs = [...cellXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match) => match[0])
  const templateParagraph = paragraphs[0] || '<w:p></w:p>'

  const nextParagraphs = texts.map((text, index) =>
    buildParagraphFromTemplate(paragraphs[index] || templateParagraph, text)
  )

  return `${cellOpenTag}${cellProps}${nextParagraphs.join('')}</w:tc>`
}

function buildRowXml(sampleRowXml, seafarer, index) {
  const cells = [...sampleRowXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((match) => match[0])
  if (cells.length < 5) {
    throw new Error('Mau quyet dinh dieu dong khong dung cau truc bang')
  }

  const fullNameVi = seafarer.full_name || ''
  const rankVi = seafarer.rank_name_vi || seafarer.rank_code || ''
  const rankEn = seafarer.rank_name_en || seafarer.rank_code || ''
  const cellValues = [
    [String(index + 1), ''],
    [fullNameVi, fullNameVi],
    [rankVi, rankEn],
    [formatDateVi(seafarer.date_of_birth), formatDateEn(seafarer.date_of_birth)],
    [seafarer.note || '', ''],
  ]

  const nextCells = cells.map((cellXml, cellIndex) =>
    replaceCellParagraphs(cellXml, cellValues[cellIndex] || [''])
  )

  let currentIndex = 0
  return sampleRowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, () => nextCells[currentIndex++] || '')
}

async function getSeafarersByIds(ids) {
  const placeholders = ids.map(() => '?').join(', ')
  const [rows] = await pool.query(
    `SELECT
      s.id,
      s.full_name,
      s.date_of_birth,
      (
        SELECT sd.vessel_name
        FROM seafarer_deployment sd
        WHERE sd.seafarer_id = s.id
        ORDER BY
          COALESCE(sd.join_date, '1000-01-01') DESC,
          COALESCE(sd.sign_off_date, '1000-01-01') DESC,
          sd.created_at DESC,
          sd.id DESC
        LIMIT 1
      ) AS latest_vessel_name,
      (
        SELECT sd.join_date
        FROM seafarer_deployment sd
        WHERE sd.seafarer_id = s.id
        ORDER BY
          COALESCE(sd.join_date, '1000-01-01') DESC,
          COALESCE(sd.sign_off_date, '1000-01-01') DESC,
          sd.created_at DESC,
          sd.id DESC
        LIMIT 1
      ) AS latest_join_date,
      r.code AS rank_code,
      r.name_vi AS rank_name_vi,
      r.name_en AS rank_name_en
     FROM seafarer s
     LEFT JOIN \`rank\` r ON r.id = s.current_rank_id
     WHERE s.deleted_at IS NULL
       AND s.id IN (${placeholders})`,
    ids
  )

  const rowMap = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => rowMap.get(id)).filter(Boolean)
}

function applyTemplateMeta(xml, payload) {
  const vesselShortName = stripVesselPrefix(payload.vessel_name) || BLANK_PLACEHOLDER
  const embarkLocation = payload.embark_location || BLANK_PLACEHOLDER
  const effectiveDateVi = formatDateVi(payload.embark_date_from)
  const effectiveDateEn = payload.embark_date_from
    ? dayjs(payload.embark_date_from).format('DD MMM YYYY')
    : ''
  // The letterhead's "Số/No: .../YYYY/QĐ-TV-SPT" and "Place/Date, ... /YYYY" both hardcode
  // the template's original year as plain "2026" runs (first 2 occurrences in document order,
  // ahead of any table rows or Điều 1/3 text this function also touches) - stamp them with the
  // actual export year instead of leaving the template's original year in place.
  const currentYear = String(dayjs().year())

  let nextXml = stripRepeatedTableHeaders(xml)
    .replace('<w:t>2026</w:t>', `<w:t>${currentYear}</w:t>`)
    .replace('<w:t>2026</w:t>', `<w:t>${currentYear}</w:t>`)
  nextXml = replaceAllExact(nextXml, '>AURORA<', `>${escapeXml(vesselShortName)}<`)
  nextXml = replaceAllExact(nextXml, '>Jorf Lasfar, Morocco<', `>${escapeXml(embarkLocation)}<`)
  nextXml = replaceAllExact(nextXml, '>21/02/2026<', `>${escapeXml(effectiveDateVi)}<`)
  nextXml = replaceAllExact(nextXml, '>21 Feb 2026<', `>${escapeXml(effectiveDateEn)}<`)

  const article1ParagraphXml = findParagraphXmlByText(nextXml, '<w:t>Article 1</w:t>')
  if (article1ParagraphXml) {
    nextXml = nextXml.replace(
      article1ParagraphXml,
      buildArticle1ParagraphXml(article1ParagraphXml, payload)
    )
  }

  const article3ViParagraphXml = findParagraphXmlByText(
    nextXml,
    '<w:t xml:space="preserve">Quyết định này có hiệu lực kể từ ngày </w:t>'
  )
  if (article3ViParagraphXml) {
    nextXml = nextXml.replace(
      article3ViParagraphXml,
      buildArticle3ParagraphXml(article3ViParagraphXml, payload)
    )
  }

  const article3EnParagraphXml = findParagraphXmlByText(
    nextXml,
    '<w:t xml:space="preserve">The Decision comes into effect from </w:t>'
  )
  if (article3EnParagraphXml) {
    nextXml = nextXml.replace(
      article3EnParagraphXml,
      buildArticle3ParagraphXml(article3EnParagraphXml, payload, { italic: true })
    )
  }

  return nextXml
}

function normalizeDecisionPayload(payload = {}) {
  const vesselName = String(payload.vessel_name || '').trim()
  const embarkLocation = String(payload.embark_location || '').trim()
  const embarkDateFrom =
    payload.embark_date_from && dayjs(payload.embark_date_from).isValid()
      ? payload.embark_date_from
      : null
  const embarkDateTo =
    payload.embark_date_to && dayjs(payload.embark_date_to).isValid()
      ? payload.embark_date_to
      : null
  const actualEmbarkDate =
    payload.actual_embark_date && dayjs(payload.actual_embark_date).isValid()
      ? payload.actual_embark_date
      : null
  const decisionNumber = normalizeDecisionNumber(payload.decision_number)

  if (
    embarkDateFrom &&
    embarkDateTo &&
    dayjs(embarkDateTo).isBefore(dayjs(embarkDateFrom), 'day')
  ) {
    throw { statusCode: 400, message: 'Khoang ngay du kien len tau khong hop le' }
  }

  return {
    vessel_name: vesselName,
    embark_location: embarkLocation,
    embark_date_from: embarkDateFrom,
    embark_date_to: embarkDateTo,
    actual_embark_date: actualEmbarkDate,
    decision_number: decisionNumber,
  }
}

function normalizeSeafarers(seafarers = []) {
  return (Array.isArray(seafarers) ? seafarers : []).map((seafarer) => ({
    id: parseInt(seafarer?.id, 10) || null,
    full_name: seafarer?.full_name || '',
    rank_code: seafarer?.rank_code || '',
    rank_name_vi: seafarer?.rank_name_vi || '',
    rank_name_en: seafarer?.rank_name_en || '',
    date_of_birth: seafarer?.date_of_birth || null,
    note: typeof seafarer?.note === 'string' ? seafarer.note.trim() : '',
  }))
}

function buildDecisionBuffer(payload = {}, seafarers = []) {
  const normalizedPayload = normalizeDecisionPayload(payload)
  const normalizedSeafarers = normalizeSeafarers(seafarers)
  if (!normalizedSeafarers.length) {
    throw { statusCode: 404, message: 'Khong tim thay thuyen vien de xuat quyet dinh' }
  }

  const { zip, xml } = getTemplateXml()
  const sampleRowXml = findSampleRowXml(xml)
  if (!sampleRowXml) {
    throw new Error('Khong tim thay dong mau trong file quyet dinh dieu dong')
  }

  const rowsXml = normalizedSeafarers.map((seafarer, index) =>
    buildRowXml(sampleRowXml, seafarer, index)
  )
  const xmlWithRows = xml.replace(sampleRowXml, rowsXml.join(''))
  const nextXml = applyTemplateMeta(xmlWithRows, normalizedPayload)
  zip.file('word/document.xml', nextXml)

  return zip.generate({ type: 'nodebuffer', mimeType: DOCX_MIME })
}

const seafarerDispatchDecisionService = {
  DOCX_MIME,

  async getSelection(ids = []) {
    const normalizedIds = normalizeIds(ids)
    if (!normalizedIds.length) return []

    const seafarers = await getSeafarersByIds(normalizedIds)
    return seafarers.map((seafarer) => ({
      id: seafarer.id,
      full_name: seafarer.full_name || '',
      rank_code: seafarer.rank_code || '',
      rank_name_vi: seafarer.rank_name_vi || '',
      rank_name_en: seafarer.rank_name_en || '',
      date_of_birth: seafarer.date_of_birth || null,
      latest_vessel_name: seafarer.latest_vessel_name || '',
      latest_join_date: seafarer.latest_join_date || null,
    }))
  },

  async exportDecision(payload = {}) {
    const normalizedIds = normalizeIds(payload.ids)
    if (!normalizedIds.length) {
      throw { statusCode: 400, message: 'Vui long chon it nhat 1 thuyen vien' }
    }

    const seafarers = await getSeafarersByIds(normalizedIds)
    const noteMap = new Map(
      (Array.isArray(payload.notes) ? payload.notes : [])
        .map((item) => ({
          seafarer_id: parseInt(item?.seafarer_id, 10),
          note: typeof item?.note === 'string' ? item.note.trim() : '',
        }))
        .filter((item) => item.seafarer_id)
        .map((item) => [item.seafarer_id, item.note])
    )

    const vesselName = String(payload.vessel_name || '').trim()

    return {
      filename: `${dayjs().format('YYYY.MM.DD')} QĐ NHẬP TÀU - ${vesselName}.docx`,
      buffer: buildDecisionBuffer(
        payload,
        seafarers.map((seafarer) => ({
          ...seafarer,
          note: noteMap.get(seafarer.id) || '',
        }))
      ),
    }
  },

  buildDecisionBuffer,
}

module.exports = seafarerDispatchDecisionService
