const { PDFDocument, PDFName } = require('pdf-lib')
const { callVision } = require('./llm.service')
const os = require('os')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const jobs = new Map()

const SCAN_PROMPT = `Đây là một trang từ sổ thuyền viên Việt Nam (Seaman's Book).
Hãy tìm tất cả bản ghi lịch sử đi tàu trên trang này.
Bảng đó có thể có tiêu đề như "Bố Trí Chức Danh", "Duties Arrangement", "Employment Record",
hoặc không có tiêu đề rõ ràng nhưng chứa thông tin: tên tàu, chức danh, ngày lên tàu, ngày rời tàu.

Nếu tìm thấy, trả về JSON array:
[
  {
    "vessel_name": "tên tàu",
    "vessel_type": "loại tàu (ví dụ: Bulk Carrier, Container, Tanker, General Cargo, Tug...) hoặc null",
    "vessel_flag": "quốc tịch/cờ hiệu tàu (ví dụ: Vietnam, Panama, Singapore...) hoặc null",
    "vessel_grt": "dung tích toàn phần GRT/GT — chỉ số, không đơn vị — hoặc null",
    "vessel_dwt": "tải trọng DWT — chỉ số, không đơn vị — hoặc null",
    "main_engine_kw": "công suất máy chính tính bằng kW — chỉ số; nếu ghi HP thì nhân 0.7457 — hoặc null",
    "rank_name": "chức danh đầy đủ như ghi trong sổ (ví dụ: Thuyền trưởng, Đại Phó, Máy trưởng, Thủy thủ, Thợ máy, Bếp trưởng, Master, Chief Officer, 2nd Engineer, AB, OS...)",
    "join_date": "ngày thuyền viên XUỐNG TÀU / LÊN TÀU — cột 'Ngày xuống tàu', 'Ngày lên tàu', 'Date of joining', 'Date of boarding' — KHÔNG phải ngày ký hợp đồng ('Ngày ký HĐ', 'Date of engagement') — YYYY-MM-DD hoặc null",
    "sign_off_date": "ngày thuyền viên RỜI TÀU — cột 'Ngày rời tàu', 'Date of discharge', 'Date of sign-off' — YYYY-MM-DD hoặc null",
    "employer": "tên công ty/tổ chức quản lý thuyền viên hoặc null"
  }
]
Mỗi trang có thể có 1 hoặc 2 bản ghi.
Nếu trang là bìa, thông tin cá nhân, hoặc không có lịch sử đi tàu thì trả về [].
Chỉ trả về JSON array, không giải thích thêm.`

const BOOK_INFO_PROMPT = `Đây là một trang từ sổ thuyền viên Việt Nam.
Hãy tìm thông tin về chính cuốn sổ này (không phải thông tin chuyến đi):
- Số sổ (Book No, Số sổ thuyền viên, Seaman's Book No)
- Ngày cấp sổ (Date of issue, Ngày cấp, Issued date)
- Ngày hết hạn sổ (Date of expiry, Valid until, Ngày hết hạn, Ngày đáo hạn)

Trả về JSON object (không phải array):
{
  "seaman_book_number": "số sổ hoặc null",
  "seaman_book_issued_date": "YYYY-MM-DD hoặc null",
  "seaman_book_expiry": "YYYY-MM-DD hoặc null"
}

Nếu không tìm thấy bất kỳ trường nào, trả về {"seaman_book_number":null,"seaman_book_issued_date":null,"seaman_book_expiry":null}.
Chỉ trả về JSON, không giải thích.`

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

const pdfScanService = {
  async createJob(seafarerId, pdfBuffer) {
    const jobId = crypto.randomUUID()
    const pdfPath = path.join(os.tmpdir(), `scan_${jobId}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)
    jobs.set(jobId, { pdfPath, seafarerId, createdAt: Date.now() })
    setTimeout(
      () => {
        const job = jobs.get(jobId)
        if (job) {
          try {
            fs.unlinkSync(job.pdfPath)
          } catch {}
          jobs.delete(jobId)
        }
      },
      15 * 60 * 1000
    )
    return jobId
  },

  async streamJob(jobId, reply) {
    const job = jobs.get(jobId)
    if (!job) throw { statusCode: 404, message: 'Job không tồn tại hoặc đã hết hạn' }

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    // Disable Nginx proxy buffering so SSE events reach the client immediately
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const emit = (data) => {
      if (!reply.raw.destroyed) {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }
    }

    // Reset Nginx proxy_read_timeout every 15s — prevents 60s default from killing the connection
    const keepalive = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(': keepalive\n\n')
    }, 15000)

    try {
      const pdfBytes = fs.readFileSync(job.pdfPath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pages = pdfDoc.getPages()
      const totalPages = pages.length

      emit({ type: 'start', totalPages })

      let bookInfoFound = false
      for (let i = 0; i < totalPages; i++) {
        if (reply.raw.destroyed) break
        emit({ type: 'progress', page: i + 1, totalPages })

        const imgBuffer = extractPageImage(pages[i])
        if (!imgBuffer) continue // trang không có ảnh nhúng → bỏ qua

        try {
          const text = await callVision(imgBuffer, 'image/jpeg', SCAN_PROMPT, 1024, 45000)
          const jsonMatch = text.match(/\[[\s\S]*\]/)
          const records = jsonMatch ? JSON.parse(jsonMatch[0]) : []

          if (Array.isArray(records) && records.length > 0) {
            emit({ type: 'records', page: i + 1, records })
          } else if (!bookInfoFound) {
            // Trang không có lịch sử đi tàu → thử tìm thông tin sổ
            try {
              const infoText = await callVision(
                imgBuffer,
                'image/jpeg',
                BOOK_INFO_PROMPT,
                256,
                30000
              )
              const infoMatch = infoText.match(/\{[\s\S]*\}/)
              if (infoMatch) {
                const info = JSON.parse(infoMatch[0])
                if (
                  info.seaman_book_number ||
                  info.seaman_book_issued_date ||
                  info.seaman_book_expiry
                ) {
                  bookInfoFound = true
                  emit({ type: 'book_info', ...info })
                }
              }
            } catch {
              // bỏ qua nếu không parse được
            }
          }
        } catch (err) {
          emit({ type: 'page_error', page: i + 1, error: err.message })
        }
      }

      emit({ type: 'done' })
    } catch (err) {
      emit({ type: 'error', error: err.message })
    } finally {
      clearInterval(keepalive)
      reply.raw.end()
      try {
        fs.unlinkSync(job.pdfPath)
      } catch {}
      jobs.delete(jobId)
    }
  },
}

module.exports = pdfScanService
