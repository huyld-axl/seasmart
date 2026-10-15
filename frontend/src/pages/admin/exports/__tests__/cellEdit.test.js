import { describe, it, expect } from 'vitest'
import { readCell, writeCell, splitValue } from '../cellEdit'

const cell = (html, style = '') => {
  document.body.innerHTML = `<table><tr><td data-cell="C6" style="${style}">${html}</td></tr></table>`
  return document.querySelector('td')
}

describe('ô sửa tay: đọc và vẽ lại', () => {
  it('does not save the red preview hint as an edited font color', () => {
    const style = document.createElement('style')
    style.textContent = 'html.fill-highlight [data-fill-state="filled"] { color: rgb(185, 28, 28) !important; }'
    document.head.appendChild(style)
    document.documentElement.classList.add('fill-highlight')
    try {
      const td = cell('Tên: <span data-fill-state="filled">NGUYỄN VĂN A</span>', 'color:rgb(0,0,0)')
      expect(readCell(td)).toBe('Tên: NGUYỄN VĂN A')
      expect(document.documentElement.classList.contains('fill-highlight')).toBe(true)
    } finally {
      style.remove()
      document.documentElement.classList.remove('fill-highlight')
    }
  })
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
