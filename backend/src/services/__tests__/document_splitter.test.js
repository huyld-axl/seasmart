import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ai = require('../ai')
const splitter = require('../document_splitter.service')
const { normalizeSplit, groupPapers } = splitter

const page = (n, type, group, extra = {}) => ({ page: n, type, group, page_label: `Trang ${n}`, note: '', ...extra })

describe('normalizeSplit', () => {
  it('giữ đúng thứ tự trang, bỏ trang trùng và trang ngoài lô', () => {
    const out = normalizeSplit({ pages: [page(2, 'certificate', 1), page(1, 'seaman_book_info', 1), page(2, 'other', 9), page(7, 'certificate', 3)] }, [1, 2])
    expect(out.map((e) => [e.page, e.type])).toEqual([[1, 'seaman_book_info'], [2, 'certificate']])
  })

  it('trang thiếu xếp "other" kèm ghi chú; loại lạ cũng thành "other"', () => {
    const out = normalizeSplit({ pages: [page(1, 'passport', 1)] }, [1, 2, 3])
    expect(out.map((e) => e.type)).toEqual(['other', 'other', 'other'])
    expect(out[1].note).toMatch(/không trả kết quả/)
    expect(out[1].group).toBeNull()
  })

  it('kết quả sai khuôn thì báo lỗi, không đoán', () => {
    expect(() => normalizeSplit(null, [1])).toThrow()
    expect(() => normalizeSplit({ pages: 'x' }, [1])).toThrow()
    try {
      normalizeSplit({ nope: [] }, [1])
      expect.unreachable()
    } catch (err) {
      expect(err.statusCode).toBe(502)
    }
  })
})

describe('groupPapers', () => {
  const entries = (list) => list.map(([pageNo, type, group, batch = 0]) => ({ page: pageNo, type, group, label: null, note: null, batch }))

  it('chứng chỉ hai mặt cùng nhóm gom thành một giấy', () => {
    const papers = groupPapers(entries([[1, 'certificate', 1], [2, 'certificate', 1], [3, 'certificate', 2]]))
    expect(papers.map((p) => [p.type, p.pageFrom, p.pageTo])).toEqual([['certificate', 1, 2], ['certificate', 3, 3]])
  })

  it('trang sổ không gom dù cùng nhóm', () => {
    const papers = groupPapers(entries([[1, 'seaman_book_duty', 1], [2, 'seaman_book_duty', 1], [3, 'seaman_book_info', 1]]))
    expect(papers.map((p) => [p.type, p.pageFrom, p.pageTo])).toEqual([['seaman_book_duty', 1, 1], ['seaman_book_duty', 2, 2], ['seaman_book_info', 3, 3]])
  })

  it('không gom trang không liền nhau, khác loại, nhóm rỗng hoặc khác lô', () => {
    const papers = groupPapers(entries([
      [1, 'certificate', 1], [3, 'certificate', 1], // cách trang
      [4, 'other', 2], [5, 'certificate', 2], // khác loại
      [6, 'certificate', null], [7, 'certificate', null], // không có nhóm
      [8, 'certificate', 1, 0], [9, 'certificate', 1, 1], // khác lô
    ]))
    expect(papers.map((p) => [p.pageFrom, p.pageTo])).toEqual([[1, 1], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9]])
  })
})

describe('split', () => {
  beforeEach(() => vi.restoreAllMocks())
  const pages = (n, from = 1) => Array.from({ length: n }, (_, i) => ({ page_no: from + i, thumbBuffer: Buffer.from(`t${from + i}`) }))

  it('một lần gọi cho tệp tới 20 trang, gửi ảnh thu nhỏ độ chi tiết thấp, model nhỏ', async () => {
    const run = vi.spyOn(ai, 'run').mockResolvedValue({ data: { pages: [page(1, 'certificate', 1), page(2, 'certificate', 1)] } })
    const result = await splitter.split({ uploadId: 4, pages: pages(2) })
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0]).toMatchObject({ task: 'split', tier: 'small', detail: 'low', uploadId: 4, promptVersion: 'split-4' })
    expect(run.mock.calls[0][0].images).toHaveLength(2)
    expect(result.papers).toEqual([{ type: 'certificate', pageFrom: 1, pageTo: 2, label: 'Trang 1' }])
  })

  it('PDF dài chia lô 20 trang, số trang giữ nguyên toàn tệp', async () => {
    const run = vi.spyOn(ai, 'run').mockImplementation(async ({ images, instructions }) => {
      const numbers = instructions.match(/trang số: ([\d, ]+)\./)[1].split(', ').map(Number)
      expect(numbers).toHaveLength(images.length)
      return { data: { pages: numbers.map((n) => page(n, 'other', n)) } }
    })
    const result = await splitter.split({ uploadId: 1, pages: pages(45) })
    expect(run).toHaveBeenCalledTimes(3)
    expect(run.mock.calls.map((c) => c[0].images.length)).toEqual([20, 20, 5])
    expect(result.entries.map((e) => e.page)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1))
  })

  it('lỗi nhà cung cấp được ném lại, không trả kết quả nửa vời', async () => {
    vi.spyOn(ai, 'run').mockRejectedValue({ statusCode: 503, message: 'AI đang quá tải, thử lại sau ít phút' })
    await expect(splitter.split({ uploadId: 1, pages: pages(1) })).rejects.toMatchObject({ statusCode: 503 })
  })
})
