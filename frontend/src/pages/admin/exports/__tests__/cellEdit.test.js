import { describe, it, expect } from 'vitest'
import { readCell, writeCell, splitValue } from '../cellEdit'

const cell = (html, style = '') => {
  document.body.innerHTML = `<table><tr><td data-cell="C6" style="${style}">${html}</td></tr></table>`
  return document.querySelector('td')
}

describe('ô sửa tay: đọc và vẽ lại', () => {
  it('chữ một kiểu như ô gốc thì là chuỗi', () => {
    expect(readCell(cell('Phí hồ sơ', 'text-align:left'), 'left')).toBe('Phí hồ sơ')
  })

  it('gạch ngang, màu, cỡ chữ đi vào đoạn; đổi căn lề thì kèm align', () => {
    const td = cell('Phí <span style="text-decoration:line-through;color:#c00000;font-size:14pt">hồ sơ</span>', 'text-align:left')
    td.style.textAlign = 'center'
    const value = readCell(td, 'left')
    expect(value.align).toBe('center')
    expect(value.runs[1]).toMatchObject({ text: 'hồ sơ', strike: true, color: '#c00000', size: 14 })
    expect(value.runs[0]).not.toHaveProperty('color')
  })

  it('vẽ lại giá trị đã lưu cho ra đúng giá trị đó', () => {
    const value = { runs: [{ text: 'A', bold: true, italic: false, underline: false }, { text: 'B', bold: false, italic: true, underline: true, strike: true, color: '#0070c0', size: 16 }], align: 'right' }
    const td = cell('', 'text-align:left')
    writeCell(td, value, 'left')
    expect(readCell(td, 'left')).toEqual(value)
    writeCell(td, 'chữ', 'left')
    expect(td.style.textAlign).toBe('left')
    expect(splitValue('x')).toEqual({ runs: 'x', align: null })
  })
})
