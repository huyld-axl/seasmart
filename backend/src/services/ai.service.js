'use strict'

const { createWorker } = require('tesseract.js')
const { PDFParse } = require('pdf-parse')
const { PDFDocument, PDFName } = require('pdf-lib')
const { callText, callVision } = require('./llm.service')

// Extract largest embedded JPEG image from a PDF page (for scanned PDFs)
function extractPageImage(page) {
  try {
    const resources = page.node.Resources()
    if (!resources) return null
    const xObject = resources.lookup(PDFName.of('XObject'))
    if (!xObject) return null
    const keys = xObject.keys ? xObject.keys() : []
    let biggest = null
    let biggestPixels = 0
    for (const key of keys) {
      const stream = xObject.lookup(key)
      if (!stream || !stream.dict || !stream.contents) continue
      const filter = stream.dict.lookup(PDFName.of('Filter'))
      if (filter?.toString() !== '/DCTDecode') continue
      const w = stream.dict.lookup(PDFName.of('Width'))?.numberValue || 0
      const h = stream.dict.lookup(PDFName.of('Height'))?.numberValue || 0
      if (w * h > biggestPixels) {
        biggestPixels = w * h
        biggest = stream
      }
    }
    return biggest ? Buffer.from(biggest.contents) : null
  } catch {
    return null
  }
}

async function extractTextFromFile(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer })
    const data = await parser.getText()
    await parser.destroy()
    return data.text?.trim() || ''
  }

  // Image: use Tesseract OCR (eng+vie for Vietnamese certificates)
  const worker = await createWorker(['eng', 'vie'])
  try {
    const result = await worker.recognize(buffer)
    return result.data.text?.trim() || ''
  } finally {
    await worker.terminate()
  }
}

function normalizeDate(v) {
  if (!v || v === 'null' || v === 'N/A' || v === '') return null
  const s = String(v).trim()
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const ymd = s.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  return s
}

function nullify(v) {
  if (v === null || v === undefined || v === 'null' || v === 'N/A' || v === '') return null
  return String(v).trim()
}

function parseExtractionResponse(text) {
  const cleaned = text.replace(/```[a-z]*\n?/gi, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw { statusCode: 422, message: 'Không thể phân tích kết quả AI' }
  }
  let result
  try {
    result = JSON.parse(jsonMatch[0])
  } catch {
    throw { statusCode: 422, message: 'Kết quả AI không phải JSON hợp lệ' }
  }
  const cocRank = nullify(result.coc_rank)
  const certName = nullify(result.certificate_name)
  return {
    seafarer_name: nullify(result.seafarer_name),
    certificate_name: cocRank ? `Bằng chuyên môn - ${cocRank}` : certName,
    certificate_number: nullify(result.certificate_number),
    issued_date: normalizeDate(result.issued_date),
    expiry_date: normalizeDate(result.expiry_date),
    competency_level: nullify(result.competency_level),
    limitation: nullify(result.limitation),
    coc_rank: cocRank,
    suggested_certificate_type_id: null,
  }
}

function detectImageMime(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  return 'image/jpeg'
}

function matchCertificateType(certName, certificateTypes) {
  if (!certName) return null
  const name = certName.toLowerCase()
  let bestId = null
  let bestScore = 0
  for (const ct of certificateTypes) {
    const en = (ct.name_en || '').toLowerCase()
    const vi = (ct.name_vi || '').toLowerCase()
    const abbr = (ct.abbreviation || '').toLowerCase()
    if (en === name || vi === name) return ct.id
    let score = 0
    if (en && name.includes(en)) score = Math.max(score, en.length)
    if (en && en.includes(name)) score = Math.max(score, name.length)
    if (vi && name.includes(vi)) score = Math.max(score, vi.length)
    if (abbr && name.includes(abbr) && abbr.length > 2) score = Math.max(score, abbr.length * 2)
    // Bonus when abbreviation appears explicitly in parentheses — strongest signal (e.g. "ARPA" in "(ARPA)")
    if (abbr && abbr.length > 2 && new RegExp(`\\(${abbr}\\)`, 'i').test(name))
      score = Math.max(score, abbr.length * 4)
    if (score > bestScore) {
      bestScore = score
      bestId = ct.id
    }
  }
  return bestScore >= 4 ? bestId : null
}

const KEYWORD_RULES = [
  {
    code: 'BASIC_TRAINING',
    patterns: [
      'BASIC TRAINING',
      'AN TOÀN CƠ BẢN',
      'CERTIFICATE OF PROFICIENCY IN BASIC TRAINING',
      'NGHIEP VU CO BAN',
      'PERSONAL SURVIVAL TECHNIQUES',
    ],
  },
  { code: 'PSCRB', patterns: ['SURVIVAL CRAFT AND RESCUE BOATS', 'XUỒNG CỨU SINH', 'PSCRB'] },
  {
    code: 'AFF',
    patterns: ['ADVANCED FIRE FIGHTING', 'ADVANCED FIRE-FIGHTING', 'CHỮA CHÁY NÂNG CAO'],
  },
  { code: 'MEFA', patterns: ['MEDICAL FIRST AID', 'SƠ CỨU Y TẾ'] },
  { code: 'MC', patterns: ['MEDICAL CARE', 'CHĂM SÓC Y TẾ'] },
  { code: 'SECURITY_AWARENESS', patterns: ['SECURITY AWARENESS', 'NHẬN THỨC AN NINH'] },
  { code: 'SECURITY_DUTIES', patterns: ['DESIGNATED SECURITY DUTIES'] },
  { code: 'SSO', patterns: ['SHIP SECURITY OFFICER'] },
  { code: 'GMDSS-GOC', patterns: ['GMDSS'] },
  { code: 'MEDICAL_FITNESS', patterns: ['MEDICAL CERTIFICATE FOR SEAFARERS', 'MEDICAL FITNESS'] },
  { code: 'TANKER_CHEMICAL', patterns: ['CHEMICAL TANKER FAMILIARIZATION'] },
  { code: 'TANKER-CHEM-ADV', patterns: ['CHEMICAL TANKER ADVANCE'] },
  { code: 'TANKER_OIL', patterns: ['OIL TANKER FAMILIARIZATION'] },
  { code: 'TANKER-OIL-ADV', patterns: ['OIL TANKER ADVANCE'] },
  { code: 'CERT_PROF_SEAFARERS', patterns: ['CERTIFICATE OF PROFICIENCY FOR SEAFARERS'] },
  { code: 'ARPA', patterns: ['ARPA', 'AUTOMATIC RADAR PLOTTING AID', 'RADAR PLOTTING AID'] },
  {
    code: 'RADAR_OBSERVATION',
    patterns: [
      'RADAR NAVIGATION',
      'RADAR OBSERVATION',
      'QUAN SÁT RADAR',
      'SỬ DỤNG RADAR',
      'RADAR OBSERVATION AND PLOTTING',
    ],
  },
  { code: 'ECDIS', patterns: ['ECDIS'] },
  { code: 'BRM', patterns: ['BRIDGE RESOURCE MANAGEMENT'] },
  { code: 'INERT_GAS_CRUDE_OIL_WASHING', patterns: ['INERT GAS', 'CRUDE OIL WASHING'] },
  {
    code: 'FLAG_STATE_ENDORSEMENT',
    patterns: [
      'FOR THE RECOGNITION OF A CERTIFICATE',
      'IMMARBE',
      'REGULATION I/10',
      'REGULATION 1/10',
      'FLAG STATE ENDORSEMENT',
      'CERTIFICATE OF RECOGNITION',
      'ENDORSEMENT ATTESTING',
    ],
  },
]

function matchByKeywords(ocrText, certificateTypes) {
  if (!ocrText) return null
  const upper = ocrText.toUpperCase()
  for (const rule of KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      if (upper.includes(pattern.toUpperCase())) {
        const ct = certificateTypes.find((c) => c.code === rule.code)
        if (ct) return ct.id
      }
    }
  }
  return null
}

function matchRank(rankName, ranks) {
  if (!rankName) return null
  const name = rankName.toLowerCase()
  for (const r of ranks) {
    const vi = (r.name_vi || '').toLowerCase()
    const en = (r.name_en || '').toLowerCase()
    if (vi === name || en === name) return r
  }
  let best = null
  let bestScore = 0
  for (const r of ranks) {
    const vi = (r.name_vi || '').toLowerCase()
    const en = (r.name_en || '').toLowerCase()
    let score = 0
    if (vi && name.includes(vi)) score = Math.max(score, vi.length)
    if (vi && vi.includes(name)) score = Math.max(score, name.length)
    if (en && name.includes(en)) score = Math.max(score, en.length)
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return bestScore >= 4 ? best : null
}

function detectLanguage(text) {
  return /[àáảãạăắặằẳẵâấậầẩẫèéẻẽẹêếệềểễìíỉĩịòóỏõọôốộồổỗơớợờởỡùúủũụưứựừửữỳýỷỹỵđ]/i.test(text)
    ? 'vi'
    : 'en'
}

async function translateText(text, targetLang) {
  const prompt =
    targetLang === 'en'
      ? `Translate this Vietnamese maritime certificate name to English. Return ONLY the translation, no explanation:\n${text}`
      : `Translate this English maritime certificate name to Vietnamese. Return ONLY the translation, no explanation:\n${text}`
  const response = await callClaude(prompt)
  return response.content[0]?.text?.trim() || text
}

const EXTRACTION_FIELDS = `JSON fields to extract:
- seafarer_name: full name of the certificate holder (look for labels: "Cấp cho Ông/Bà:", "Họ và tên:", "Upon:", "This is to certify that:", "Cho:", "The holder:", "Issued to:", "Name:", "Full name:")
- coc_rank: ONLY for CoC (header contains "GIẤY CHỨNG NHẬN KHẢ NĂNG CHUYÊN MÔN" or "Certificate of Competency"). Extract the exact certified rank title shown on the certificate (e.g. "Sỹ quan máy", "Máy trưởng", "Thuyền trưởng", "Engine officer", "Chief Engineer"). Return null for all other certificate types.
- certificate_name: the certificate category name. Rules:
  - If this is a CoC (coc_rank is not null): return null — the name will be built from coc_rank by the system.
  - ALL OTHER certificates: extract the SPECIFIC subject/specialization name, NOT the generic document type header.
    Priority order:
    1. Text immediately after headers like "GIẤY CHỨNG NHẬN", "CHỨNG CHỈ", "CERTIFICATE" on the same or next line
    2. Course/program name after phrases: "Đã hoàn thành chương trình", "bồi dưỡng kiến thức", "đào tạo", "Chương trình:", "Khóa học:", "Course:", "Training:"
    3. For Flag State Endorsements (document title or body contains "Endorsement attesting the recognition", "Certificate of Recognition", or is issued by a flag state registry such as Belize/IMMARBE, Panama, Marshall Islands, Liberia, Bahamas, Vanuatu, Cyprus): return "Flag State Endorsement - [Country]" (e.g. "Flag State Endorsement - Belize").
    4. If only a generic header exists, use it as-is.
- certificate_number: registration/serial number — look for labels: "Giấy chứng nhận số", "Số chứng nhận:", "Số chứng chỉ:", "Reg. No.", "Số hiệu:", "Số vào sổ:", "Số:", "No.", "Certificate No.", "Quyết định số:". The number often follows fill dots (e.g. "Giấy chứng nhận số .......A9412.AF.BNHP" → certificate_number is "A9412.AF.BNHP", include all parts after the dots). Pick the most specific one, not the decision number.
- issued_date: the date the certificate was ISSUED — look for labels: "Cấp ngày", "issued on", "Ngày cấp", "ngày...tháng...năm" near the issuer's signature. IMPORTANT: do NOT use the holder's birth date (labeled "Sinh ngày", "Date of birth", "ngày sinh", "Ngày sinh"). Return as YYYY-MM-DD or null.
- expiry_date: expiry/valid until date as YYYY-MM-DD or null (look for "Có giá trị đến", "valid until", "hết hạn vào", "hết hạn ngày"; null if not stated)
- competency_level: only for CoC. Look for "Vận hành" or "Operational" → return "Vận hành"; "Quản lý" or "Management" → return "Quản lý". Return null for all other certificate types.
- limitation: only for CoC. Read the "Hạn chế" / "Limitation" column. If the value is "Không", "NIL", or empty → return "NIL". If there is a specific restriction (e.g. "< 3000 kW", "< 500 GT") → return that exact text. Return null for all other certificate types.

Example CoC: {"seafarer_name":"DO MANH HOANG","coc_rank":"Sỹ quan máy","certificate_name":null,"certificate_number":"G6589.EO1.02","issued_date":"2024-02-20","expiry_date":"2029-02-20","competency_level":"Vận hành","limitation":"NIL"}
Example other: {"seafarer_name":"NGUYEN VAN A","coc_rank":null,"certificate_name":"AN TOÀN CƠ BẢN","certificate_number":"4697/GDVN","issued_date":"2016-08-25","expiry_date":null,"competency_level":null,"limitation":null}`

function extractRelevantSection(fullText, maxChars = 2000) {
  const upper = fullText.toUpperCase()
  for (const rule of KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      const idx = upper.indexOf(pattern.toUpperCase())
      if (idx !== -1) {
        const start = Math.max(0, idx - 300)
        const end = Math.min(fullText.length, start + maxChars)
        return fullText.slice(start, end)
      }
    }
  }
  return fullText.slice(0, maxChars)
}

function buildPrompt(ocrText) {
  return `Extract structured data from this Vietnamese certificate/document OCR text. Return ONLY a JSON object, no explanation.

OCR TEXT:
${extractRelevantSection(ocrText)}

${EXTRACTION_FIELDS}`
}

function buildVisionPrompt() {
  return `Extract structured data from this Vietnamese certificate/document image. Return ONLY a JSON object, no explanation.

${EXTRACTION_FIELDS}`
}

const IDENTITY_EXTRACTION_PROMPT = `Nhận dạng các tài liệu trong đoạn text OCR dưới đây (có thể gồm CCCD, Hộ chiếu, Sổ thuyền viên).
Trả về DUY NHẤT một JSON object, không giải thích thêm:
{
  "cccd": {
    "national_id": "12 số CCCD hoặc 9 số CMND",
    "full_name": "họ và tên đầy đủ",
    "date_of_birth": "YYYY-MM-DD",
    "gender": "M hoặc F (Nam→M, Nữ→F)",
    "national_id_issued_date": "YYYY-MM-DD",
    "national_id_issued_place": "nơi cấp (ví dụ: CỤC TRƯỞNG CỤC CẢNH SÁT QLHC...)",
    "permanent_address": "địa chỉ thường trú đầy đủ"
  },
  "passport": {
    "passport_number": "số hộ chiếu",
    "passport_issued_date": "YYYY-MM-DD",
    "passport_expiry": "YYYY-MM-DD",
    "passport_issued_place": "nơi cấp"
  },
  "seaman_book": {
    "seaman_book_number": "số sổ thuyền viên",
    "seaman_book_issued_date": "YYYY-MM-DD",
    "seaman_book_expiry": "YYYY-MM-DD",
    "seaman_book_issued_place": "nơi cấp"
  }
}

Quy tắc:
- Đặt null cho cả section nếu không tìm thấy loại giấy tờ đó
- Đặt null cho field nếu không đọc được giá trị
- Dates định dạng YYYY-MM-DD, hỗ trợ đầu vào DD/MM/YYYY hoặc DD.MM.YYYY
- CCCD nhận dạng qua: "CĂN CƯỚC CÔNG DÂN", "CCCD", "Số:", "Họ và tên", "Ngày sinh", "Nơi thường trú"
- Hộ chiếu nhận dạng qua: "PASSPORT", "VIỆT NAM", "Surname/Họ", "Date of expiry", "Place of issue"
- Sổ thuyền viên nhận dạng qua: "SỔ THUYỀN VIÊN", "SEAMAN'S BOOK", "Số:", "Ngày cấp", "Hết hạn"`

function parseIdentityResponse(text) {
  const cleaned = text.replace(/```[a-z]*\n?/gi, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw { statusCode: 422, message: 'Không thể phân tích kết quả AI' }
  let result
  try {
    result = JSON.parse(jsonMatch[0])
  } catch {
    throw { statusCode: 422, message: 'Kết quả AI không phải JSON hợp lệ' }
  }

  const detected = []
  const flat = {}

  if (result.cccd) {
    detected.push('cccd')
    const c = result.cccd
    if (nullify(c.national_id)) flat.national_id = nullify(c.national_id)
    if (nullify(c.full_name)) flat.full_name = nullify(c.full_name)
    if (normalizeDate(c.date_of_birth)) flat.date_of_birth = normalizeDate(c.date_of_birth)
    if (nullify(c.gender)) flat.gender = nullify(c.gender)
    if (normalizeDate(c.national_id_issued_date))
      flat.national_id_issued_date = normalizeDate(c.national_id_issued_date)
    if (nullify(c.national_id_issued_place))
      flat.national_id_issued_place = nullify(c.national_id_issued_place)
    if (nullify(c.permanent_address)) flat.permanent_address = nullify(c.permanent_address)
  }

  if (result.passport) {
    detected.push('passport')
    const p = result.passport
    if (nullify(p.passport_number)) flat.passport_number = nullify(p.passport_number)
    if (normalizeDate(p.passport_issued_date))
      flat.passport_issued_date = normalizeDate(p.passport_issued_date)
    if (normalizeDate(p.passport_expiry)) flat.passport_expiry = normalizeDate(p.passport_expiry)
    if (nullify(p.passport_issued_place))
      flat.passport_issued_place = nullify(p.passport_issued_place)
  }

  if (result.seaman_book) {
    detected.push('seaman_book')
    const s = result.seaman_book
    if (nullify(s.seaman_book_number)) flat.seaman_book_number = nullify(s.seaman_book_number)
    if (normalizeDate(s.seaman_book_issued_date))
      flat.seaman_book_issued_date = normalizeDate(s.seaman_book_issued_date)
    if (normalizeDate(s.seaman_book_expiry))
      flat.seaman_book_expiry = normalizeDate(s.seaman_book_expiry)
    if (nullify(s.seaman_book_issued_place))
      flat.seaman_book_issued_place = nullify(s.seaman_book_issued_place)
  }

  flat._detected_documents = detected
  return flat
}

async function ocrPageBuffer(pageBuffer) {
  const worker = await createWorker(['eng', 'vie'])
  try {
    const result = await worker.recognize(pageBuffer)
    return result.data.text?.trim() || ''
  } finally {
    await worker.terminate()
  }
}

// Titles that appear on cover/template pages of Vietnamese maritime cert booklets
const COVER_PAGE_SIGNALS = [
  'CHỈ DẪN',
  'CERTIFICATE OF PROFICIENCY IN PROFESSIONAL TRAINING',
  'HUẤN LUYỆN NGHIỆP VỤ CHUYÊN MÔN',
  'STANDARDS OF TRAINING, CERTIFICATION AND WATCHKEEPING',
]

// Classify a PDF page from OCR text: 'cert' | 'cover' | 'unknown'
function classifyPage(ocrText) {
  if (!ocrText || ocrText.trim().length < 20) return 'unknown'
  const upper = ocrText.toUpperCase()
  for (const rule of KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      if (upper.includes(pattern.toUpperCase())) return 'cert'
    }
  }
  if (upper.includes('KHẢ NĂNG CHUYÊN MÔN') || upper.includes('CERTIFICATE OF COMPETENCY'))
    return 'cert'
  // Cover pages (blank template pages) have cover signals but NO dates.
  // Single-page certs have both template text and dates — must not be skipped.
  const hasCoverSignal = COVER_PAGE_SIGNALS.some((s) => upper.includes(s.toUpperCase()))
  const hasDate = /\d{2}[/.\-]\d{2}[/.\-]\d{4}/.test(ocrText)
  if (hasCoverSignal && !hasDate) return 'cover'
  return 'unknown'
}

const aiService = {
  async extractCertificateInfo(fileBuffer, mimeType, certificateTypes) {
    let responseText
    let rawOcrText = ''

    if (mimeType === 'application/pdf') {
      const pdfText = await extractTextFromFile(fileBuffer, mimeType)
      if (pdfText.length >= 50) {
        rawOcrText = pdfText
        responseText = await callText(buildPrompt(pdfText))
      } else {
        // Scanned PDF: OCR-classify each page first (local, free), only call Vision API on cert pages
        const pdfDoc = await PDFDocument.load(fileBuffer)
        const pages = pdfDoc.getPages()

        let chosenImageBuffer = null
        let chosenText = null
        let firstFallbackBuffer = null
        let firstFallbackText = null
        let firstFallbackOcr = ''

        for (let i = 0; i < pages.length; i++) {
          const imgBuffer = extractPageImage(pages[i])
          if (!imgBuffer) continue

          // Classify via Tesseract OCR — skip cover pages before paying for Vision API
          const ocrText = await ocrPageBuffer(imgBuffer)
          const pageClass = classifyPage(ocrText)
          if (pageClass === 'cover') continue

          const imageMime = detectImageMime(imgBuffer)
          const pageText = await callVision(imgBuffer, imageMime, buildVisionPrompt())

          // Keep the first non-cover page as fallback for unknown certificate types
          if (!firstFallbackBuffer) {
            firstFallbackBuffer = imgBuffer
            firstFallbackText = pageText
            firstFallbackOcr = ocrText
          }

          let hasCertContent = false
          try {
            const parsed = parseExtractionResponse(pageText)
            hasCertContent = !!(
              parsed.certificate_number ||
              parsed.certificate_name ||
              parsed.coc_rank
            )
          } catch {}

          if (hasCertContent || pageClass === 'cert') {
            chosenImageBuffer = imgBuffer
            chosenText = pageText
            rawOcrText = ocrText // reuse — no second Tesseract run needed
            break
          }
        }

        // Fallback: use first non-cover image page if no cert page was identified
        if (!chosenImageBuffer && firstFallbackBuffer) {
          chosenImageBuffer = firstFallbackBuffer
          chosenText = firstFallbackText
          rawOcrText = firstFallbackOcr
        }

        if (!chosenImageBuffer) {
          throw {
            statusCode: 422,
            message: 'Không thể đọc ảnh từ PDF. Hãy thử chuyển sang file ảnh.',
          }
        }

        responseText = chosenText
      }
    } else {
      // Image file: send directly to Vision API (preserves spatial layout)
      responseText = await callVision(fileBuffer, mimeType, buildVisionPrompt())
    }

    const extracted = parseExtractionResponse(responseText || '')

    extracted.suggested_certificate_type_id =
      matchByKeywords(rawOcrText, certificateTypes) ??
      matchCertificateType(extracted.certificate_name, certificateTypes)

    return extracted
  },

  async extractIdentityDocuments(fileBuffer, mimeType) {
    let combinedText = ''

    if (mimeType === 'application/pdf') {
      // Try text-based PDF first
      const parser = new PDFParse({ data: fileBuffer })
      let pdfText = ''
      let numPages = 1
      try {
        await parser.load()
        const data = await parser.getText()
        pdfText = data.text?.trim() || ''
        numPages = data.numpages || 1
      } catch {
        // ignore parse errors, will fallback to image extraction
      } finally {
        await parser.destroy()
      }

      if (pdfText.length >= 50) {
        // Text-based PDF — use extracted text directly
        combinedText = pdfText.slice(0, 5000)
      } else {
        // Scanned PDF — extract each page image and OCR in parallel (max 6 pages)
        const pagesToProcess = Math.min(numPages, 6)
        const pageBuffers = []
        for (let i = 1; i <= pagesToProcess; i++) {
          const pageParser = new PDFParse({ data: fileBuffer })
          try {
            await pageParser.load()
            const imgResult = await pageParser.getImage({ page: i })
            const imgData = imgResult.pages?.[0]?.images?.[0]?.data
            if (imgData) {
              pageBuffers.push(Buffer.from(Object.values(imgData)))
            }
          } catch {
            // skip pages that fail
          } finally {
            await pageParser.destroy()
          }
        }

        if (pageBuffers.length === 0) {
          throw { statusCode: 422, message: 'Không thể đọc ảnh từ PDF. Hãy thử file ảnh JPG/PNG.' }
        }

        const pageTexts = await Promise.all(pageBuffers.map((buf) => ocrPageBuffer(buf)))
        combinedText = pageTexts
          .filter((t) => t.length > 0)
          .join('\n\n---TRANG MOI---\n\n')
          .slice(0, 5000)
      }
    } else {
      // Image file
      combinedText = await extractTextFromFile(fileBuffer, mimeType)
      combinedText = combinedText.slice(0, 5000)
    }

    if (!combinedText) {
      throw { statusCode: 422, message: 'Không thể đọc nội dung tài liệu. Hãy thử ảnh rõ nét hơn.' }
    }

    const prompt = `${IDENTITY_EXTRACTION_PROMPT}\n\nOCR TEXT:\n${combinedText}`
    const text = await callText(prompt, 1024)
    return parseIdentityResponse(text)
  },
}

module.exports = aiService
module.exports.translateText = translateText
module.exports.detectLanguage = detectLanguage
module.exports.matchRank = matchRank
