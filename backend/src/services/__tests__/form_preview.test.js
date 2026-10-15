const fs = require('fs')
const os = require('os')
const path = require('path')
const ExcelJS = require('exceljs')

describe('form preview filling guide', () => {
  let dir, previous, service, pool
  beforeAll(async () => {
    previous = process.env.FORMS_DIR
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seasmart-preview-'))
    process.env.FORMS_DIR = dir
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Form')
    ws.getCell('A1').value = 'Họ tên: HD4; Chủ tàu: HD18; CCCD: HD10'
    ws.getCell('A1').font = { name: 'Times New Roman', color: { argb: 'FF000000' } }
    ws.getCell('A2').value = 'HD67'
    await wb.xlsx.writeFile(path.join(dir, 'HĐ1.xlsx'))
    pool = require('../../config/db')
    service = require('../form_export.service')
    vi.spyOn(pool, 'query').mockImplementation(async (sql) => {
      if (sql.includes('FROM seafarer s')) return [[{ full_name: 'ỨNG VIÊN THỬ', date_of_birth: '1990-01-01', national_id: '' }]]
      if (sql.includes('FROM ship_owner')) return [[{ company_name: 'CHỦ TÀU THỬ', contact_person: 'Người đại diện' }]]
      throw new Error('Unexpected test query')
    })
  })
  afterAll(() => {
    vi.restoreAllMocks()
    if (previous === undefined) delete process.env.FORMS_DIR
    else process.env.FORMS_DIR = previous
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('marks applicant/owner replacements and missing profile data, with optional rows left blank', async () => {
    const { html } = await service.previewForm(1, 'hd1', { shipOwnerId: 1 })
    expect(html).toContain('data-fill-state="filled" title="Đã điền">ỨNG VIÊN THỬ')
    expect(html).toContain('data-fill-state="filled" title="Đã điền">CHỦ TÀU THỬ')
    expect(html).toContain('CCCD: <span data-fill-state="missing" data-fill-empty="true"')
    expect(html).toContain('data-cell="A2" style=')
  })

  it('turns an empty slot into filled state when edited and keeps downloaded styles', async () => {
    const edits = { A1: 'Nội dung đã điền tay' }
    const preview = await service.previewForm(1, 'hd1', { shipOwnerId: 1, edits })
    expect(preview.html).toContain('data-cell="A1" data-fill-field="true" data-fill-state="filled"')
    const { buffer } = await service.exportForm(1, 'hd1', { shipOwnerId: 1, edits })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    expect(wb.worksheets[0].getCell('A1').value).toBe('Nội dung đã điền tay')
    expect(wb.worksheets[0].getCell('A1').font.color.argb).toBe('FF000000')
    const cleared = await service.previewForm(1, 'hd1', { shipOwnerId: 1, edits: { A1: '' } })
    expect(cleared.html).toContain('data-cell="A1" data-fill-field="true" data-fill-state="missing"')
  })
})
