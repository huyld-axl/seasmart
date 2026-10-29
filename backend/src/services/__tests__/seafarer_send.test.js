import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const PizZip = require('pizzip')
const { filesOfZip } = require('../seafarer_send.service')

describe('bản đã gửi: liệt kê tệp trong .zip', () => {
  it('tách giấy tờ và biểu mẫu, bỏ số thứ tự, đuôi tệp, tệp ghi chú và bản trùng PDF / Excel', () => {
    const zip = new PizZip()
    zip.file('B0001 An/01 CV thuyền viên.pdf', 'a')
    zip.file('B0001 An/xlsx/01 CV thuyền viên.xlsx', 'a')
    zip.file('B0001 An/GIAY-TO/01-Hộ chiếu.jpg', 'a')
    zip.file('B0001 An/GIAY-TO/02-Sổ thuyền viên.pdf', 'a')
    zip.file('B0001 An/THIEU-GIAY.txt', 'a')
    zip.file('B0001 An/CHUA-CO.txt', 'a')
    const files = filesOfZip(zip.generate({ type: 'nodebuffer' }))
    expect(files.map(({ kind, name }) => [kind, name])).toEqual([
      ['form', 'CV thuyền viên'],
      ['doc', 'Hộ chiếu'],
      ['doc', 'Sổ thuyền viên'],
    ])
  })
})
