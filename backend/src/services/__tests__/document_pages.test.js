import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const documentPages = require('../document_pages.service')
const { makePdf } = require('../../../test_support/make_pdf')

const solid = (w, h, background) => sharp({ create: { width: w, height: h, channels: 3, background } })

// Điểm giữa ảnh JPEG kết quả: để kiểm tra đúng trang và đúng chiều.
async function centerPixel(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const offset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels
  return [data[offset], data[offset + 1], data[offset + 2]]
}

describe('cắt trang', () => {
  it('PDF scan nhiều trang thành từng ảnh JPEG đúng thứ tự', async () => {
    const colors = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }]
    const scans = await Promise.all(colors.map(async (background) => ({
      jpeg: await solid(1200, 1700, background).jpeg().toBuffer(), width: 1200, height: 1700,
    })))
    const pages = await documentPages.cut(makePdf(scans), 'application/pdf')
    expect(pages.map((page) => page.pageNo)).toEqual([1, 2, 3])
    const centers = await Promise.all(pages.map((page) => centerPixel(page.image)))
    expect(centers[0][0]).toBeGreaterThan(200)
    expect(centers[1][1]).toBeGreaterThan(200)
    expect(centers[2][2]).toBeGreaterThan(200)
    expect(Math.max(pages[0].width, pages[0].height)).toBeLessThanOrEqual(2400)
    expect(pages[0].height).toBeGreaterThan(pages[0].width)
    expect((await sharp(pages[0].thumb).metadata()).height).toBeLessThanOrEqual(400)
    expect((await sharp(pages[0].image).metadata()).format).toBe('jpeg')
  })

  it('PDF chữ nhiều trang, trang xoay 90 độ ra ảnh nằm ngang', async () => {
    const upright = await documentPages.cut(makePdf(['Một', 'Hai']), 'application/pdf')
    expect(upright).toHaveLength(2)
    const rotated = await documentPages.cut(makePdf(['Một'], { rotate: 90 }), 'application/pdf')
    expect(rotated[0].width).toBeGreaterThan(rotated[0].height)
  })

  it('ảnh JPG xoay theo EXIF và thu về cạnh dài tối đa 2400', async () => {
    // 3000x1000 ghi hướng EXIF 6 (xoay 90 độ): sau khi xoay phải dựng đứng.
    const input = await solid(3000, 1000, { r: 10, g: 20, b: 30 }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const [page] = await documentPages.cut(input, 'image/jpeg')
    expect(page.pageNo).toBe(1)
    expect(page.height).toBe(2400)
    expect(page.width).toBe(800)
  })

  it('ảnh PNG có nền trong suốt thành JPEG nền trắng', async () => {
    const input = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    const [page] = await documentPages.cut(input, 'image/png')
    expect(await centerPixel(page.image)).toEqual([255, 255, 255])
  })

  it('từ chối PDF quá 50 trang, PDF có mật khẩu, PDF hỏng và ảnh hỏng', async () => {
    const tooMany = makePdf(Array.from({ length: documentPages.MAX_PDF_PAGES + 1 }, (_, i) => `T${i}`))
    await expect(documentPages.cut(tooMany, 'application/pdf')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('quá giới hạn') })
    const locked = fs.readFileSync(path.join(__dirname, '../../../test_support/password_protected.pdf'))
    await expect(documentPages.cut(locked, 'application/pdf')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('mật khẩu') })
    await expect(documentPages.cut(Buffer.from('%PDF-1.4 hỏng'), 'application/pdf')).rejects.toMatchObject({ statusCode: 400 })
    await expect(documentPages.cut(Buffer.from('không phải ảnh'), 'image/jpeg')).rejects.toMatchObject({ statusCode: 400 })
  })
})
