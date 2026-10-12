const path = require('path')
const sharp = require('sharp')

const MAX_PDF_PAGES = 50
const MAX_EDGE = 2400
const THUMB_EDGE = 400
const PDF_DPI = 200
const JPEG_QUALITY = 88

let pdfjsPromise = null
function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsPromise
}

// Ảnh gốc → JPEG đã xoay theo EXIF, cạnh dài tối đa MAX_EDGE, kèm ảnh thu nhỏ.
async function toPage(input) {
  let main
  try {
    main = await sharp(input, { failOn: 'error' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw { statusCode: 400, message: 'Không đọc được ảnh, tệp có thể bị hỏng' }
  }
  const thumb = await sharp(main.data).resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside' }).jpeg({ quality: 75 }).toBuffer()
  return { image: main.data, thumb, width: main.info.width, height: main.info.height }
}

async function cutPdf(buffer) {
  const pdfjs = await loadPdfjs()
  const { createCanvas } = require('@napi-rs/canvas')
  const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'))
  let task
  let doc
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl: path.join(pdfRoot, 'standard_fonts') + path.sep,
      cMapUrl: path.join(pdfRoot, 'cmaps') + path.sep,
      cMapPacked: true,
      isEvalSupported: false,
      verbosity: 0,
    })
    doc = await task.promise
  } catch (err) {
    await task?.destroy().catch(() => {})
    if (err?.name === 'PasswordException') throw { statusCode: 400, message: 'PDF có mật khẩu. Bỏ mật khẩu rồi tải lại.' }
    throw { statusCode: 400, message: 'Không đọc được PDF, tệp có thể bị hỏng' }
  }
  try {
    if (doc.numPages > MAX_PDF_PAGES) {
      throw { statusCode: 400, message: `PDF có ${doc.numPages} trang, quá giới hạn ${MAX_PDF_PAGES} trang. Chia nhỏ rồi tải lại.` }
    }
    const pages = []
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo)
      const base = page.getViewport({ scale: 1 })
      // 200 dpi, nhưng không quá MAX_EDGE điểm ảnh ở cạnh dài (tránh trang khổ lớn làm tràn bộ nhớ).
      const scale = Math.min(PDF_DPI / 72, MAX_EDGE / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      try {
        await page.render({ canvasContext: context, viewport }).promise
      } catch {
        throw { statusCode: 422, message: `Không vẽ được trang ${pageNo} của PDF` }
      }
      pages.push({ pageNo, ...(await toPage(canvas.toBuffer('image/png'))) })
      page.cleanup()
    }
    return pages
  } finally {
    await task.destroy()
  }
}

const documentPages = {
  MAX_PDF_PAGES,

  // Tệp (PDF, JPG, PNG) → [{ pageNo, image, thumb, width, height }], ảnh JPEG đã xoay đúng chiều.
  async cut(buffer, mimeType) {
    if (mimeType === 'application/pdf') return cutPdf(buffer)
    return [{ pageNo: 1, ...(await toPage(buffer)) }]
  },
}

module.exports = documentPages
