const ExcelJS = require('exceljs')
const { fillMarkedText, markParts, markCell, getFieldMarks } = require('../form_fields')
const { sheetToHtml } = require('../sheet_html')

describe('field markers on a form preview', () => {
  it('separates filled values and missing slots within the same sentence', () => {
    const ws = new ExcelJS.Workbook().addWorksheet('Form')
    const result = fillMarkedText('Họ tên: HD4; CCCD: HD10; thêm người: HD67', { HD4: 'NGUYỄN VĂN A', HD10: '', HD67: '' }, new Set(['HD67']))
    ws.getCell('A1').value = result.value
    markParts(ws.getCell('A1'), result.parts)
    const { html } = sheetToHtml(ws)
    expect(html).toContain('Họ tên: <span data-fill-state="filled" title="Đã điền">NGUYỄN VĂN A</span>')
    expect(html).toContain('CCCD: <span data-fill-state="missing" data-fill-empty="true"')
    expect(result.parts).toHaveLength(2)
    expect(html).not.toContain('color:#b91c1c')
  })

  it('uses the merged master cell and ignores ordinary empty layout cells', () => {
    const ws = new ExcelJS.Workbook().addWorksheet('Form')
    ws.mergeCells('A1:C1')
    markCell(ws.getCell('B1'), '')
    ws.getCell('D1').value = 'Nhãn cố định'
    ws.getCell('A2').value = ''
    const { html } = sheetToHtml(ws)
    expect(html).toContain('data-cell="A1" data-fill-field="true" data-fill-state="missing"')
    expect(html).toContain('data-cell="A2" style=')
    expect(html).toContain('data-cell="D1" style=')
  })

  it('preserves rich text styles and escapes user data while marking replacements', () => {
    const ws = new ExcelJS.Workbook().addWorksheet('Form')
    const first = fillMarkedText('Tên: HD4', { HD4: '<img onerror="test">' })
    const second = fillMarkedText('; số: HD7', { HD7: '' })
    ws.getCell('A1').value = { richText: [{ text: first.value, font: { bold: true } }, { text: second.value, font: { italic: true } }] }
    markParts(ws.getCell('A1'), [...first.parts, ...second.parts.map((part) => ({ ...part, start: part.start + first.value.length, end: part.end + first.value.length }))])
    const { html } = sheetToHtml(ws)
    expect(html).toContain('font-weight:700')
    expect(html).toContain('font-style:italic')
    expect(html).toContain('&lt;img onerror=&quot;test&quot;&gt;')
    expect(html).not.toContain('<img onerror')
    expect(html).toContain('data-fill-empty="true"')
  })

  it('keeps preview hints out of downloaded workbook contents and formatting', async () => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Form')
    const cell = ws.getCell('A1')
    cell.value = 'NGUYỄN VĂN A'
    cell.font = { name: 'Times New Roman', color: { argb: 'FF000000' } }
    markCell(cell, cell.value)
    const restored = new ExcelJS.Workbook()
    await restored.xlsx.load(await wb.xlsx.writeBuffer())
    const downloaded = restored.getWorksheet('Form').getCell('A1')
    expect(downloaded.value).toBe(cell.value)
    expect(downloaded.font.color.argb).toBe('FF000000')
    expect(getFieldMarks(downloaded)).toBeUndefined()
  })
})
