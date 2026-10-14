import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { normalizeDocs, packTitle, cleanInputs, cleanEdits, packCode, packIdFromCode, zipPaths } = require('../export_pack.service')
const { PACK_TEMPLATES } = require('../../constants/pack_templates')
const { diffFields } = require('../seafarer.service')
const { fillText, applyInputs, applyEdits } = require('../form_export.service')
const { vndWords, parseAmount } = require('../../utils/vnd_words')
const { parseRange } = require('../../utils/sheet_html')
const { cvCells, monthsOnBoard } = require('../cv_tq_form.service')
const ExcelJS = require('exceljs')

describe('bộ giấy tờ: luật thuần', () => {
  it('12 mẫu, mẫu nào cũng có file Excel', () => {
    expect(PACK_TEMPLATES).toHaveLength(12)
    expect(PACK_TEMPLATES.filter((t) => !t.formKey)).toEqual([])
  })

  it('chuẩn hoá danh sách giấy: theo thứ tự mẫu, bỏ trùng', () => {
    expect(normalizeDocs(['uql', 'qddd', 'qddd'])).toEqual(['qddd', 'uql'])
  })

  it('từ chối mẫu lạ, danh sách rỗng, hai đơn BHXH cùng lúc', () => {
    expect(() => normalizeDocs(['xyz'])).toThrow()
    expect(() => normalizeDocs([])).toThrowError(expect.objectContaining({ statusCode: 400 }))
    expect(() => normalizeDocs(['bhxh', 'kbhxh'])).toThrowError(expect.objectContaining({ message: 'Chỉ chọn một trong hai đơn BHXH' }))
  })

  it('tên bộ theo giai đoạn', () => {
    expect(packTitle(['qddd', 'bl'])).toBe('Bộ giấy lên tàu')
    expect(packTitle(['kq', 'qdrt'])).toBe('Bộ giấy')
  })

  it('chỉ giữ ô điền đã biết, bỏ chuỗi rỗng', () => {
    expect(cleanInputs({ 'Tên tàu': ' MV A ', 'Lạ': 'x', 'Số tiền': '  ' })).toEqual({ 'Tên tàu': 'MV A' })
  })

  it('ô sửa tay: chỉ giữ giấy trong bộ và địa chỉ ô hợp lệ, cho phép xoá trắng ô', () => {
    expect(cleanEdits({ pt: { C6: 'Phí hồ sơ', B7: '', 'x1': 'a', A0: 'b', D4: 5 }, tl: { A1: 'x' } }, ['pt'])).toEqual({ pt: { C6: 'Phí hồ sơ', B7: '' } })
    expect(cleanEdits(undefined, ['pt'])).toEqual({})
  })

  it('ô sửa tay có định dạng: giữ đoạn chữ và ba cờ đậm, nghiêng, gạch chân', () => {
    expect(cleanEdits({ pt: { C6: [{ text: 'Phí ', bold: true, color: 'red' }, { text: '' }, { text: 'hồ sơ', italic: 1 }], B7: [{ nope: 1 }], D1: { text: 'x' } } }, ['pt']))
      .toEqual({ pt: { C6: [{ text: 'Phí ', bold: true, italic: false, underline: false }, { text: 'hồ sơ', bold: false, italic: false, underline: false }], B7: '' } })
  })

  it('ô sửa tay có gạch ngang, màu, cỡ chữ, căn lề: giữ giá trị hợp lệ, bỏ giá trị lạ', () => {
    const runs = [{ text: 'Phí', strike: true, color: '#C00000', size: 14.2 }, { text: ' x', strike: 'yes', color: 'red', size: 200 }]
    expect(cleanEdits({ pt: { C6: { runs, align: 'center' }, B7: { runs: 'Một', align: 'giữa' }, D1: { align: 'left' } } }, ['pt'])).toEqual({
      pt: {
        C6: { runs: [{ text: 'Phí', bold: false, italic: false, underline: false, strike: true, color: '#c00000', size: 14 }, { text: ' x', bold: false, italic: false, underline: false }], align: 'center' },
        B7: 'Một',
      },
    })
  })

  it('file trong .zip: một thư mục theo bộ, tải cả hai định dạng thì chia PDF và Excel', () => {
    expect(zipPaths('B0042 Trần A', ['pt', 'tl'], 'tl', 'pdf')).toEqual({ pdf: 'B0042 Trần A/02 Thanh lý hợp đồng.pdf' })
    expect(zipPaths('B0042 Trần A', ['pt', 'tl'], 'pt', 'all')).toEqual({ pdf: 'B0042 Trần A/PDF/01 Phiếu thu.pdf', xlsx: 'B0042 Trần A/Excel/01 Phiếu thu.xlsx' })
  })

  it('mã bộ', () => {
    expect(packCode(42)).toBe('B0042')
    expect(packIdFromCode('b0042')).toBe(42)
    expect(packIdFromCode('Trần')).toBeNull()
  })
})

describe('lịch sử sửa hồ sơ', () => {
  it('chỉ ghi trường thật sự đổi, ngày so theo ngày', () => {
    const before = { full_name: 'A', date_of_birth: new Date('1990-03-13T00:00:00Z'), height_cm: 170, notes: null }
    expect(diffFields(before, { full_name: 'A', date_of_birth: '1990-03-13', height_cm: '170', notes: '' })).toEqual({})
    expect(diffFields(before, { full_name: 'B', height_cm: 172 })).toEqual({ full_name: ['A', 'B'], height_cm: ['170', '172'] })
  })
})

describe('điền mã vào file mẫu', () => {
  const data = { HD6: '555', HD67: '', HD80: 'MV A', HD81: 'OWNER', HD101: 'NGUYỄN VĂN A', H94: '06' }

  it('mã dài không bị mã ngắn ăn mất (HD67 không thành HD6 + 7)', () => {
    expect(fillText('HD67', data)).toBe('')
    expect(fillText('Địa chỉ: HD6', data)).toBe('Địa chỉ: 555')
  })

  it('nhận cả kiểu viết rời và thiếu chữ D; mã lạ giữ nguyên', () => {
    expect(fillText('Họ tên ứng viên: HD 101', data)).toBe('Họ tên ứng viên: NGUYỄN VĂN A')
    expect(fillText('MV HD80 do Công ty : H81 chi trả', data)).toBe('MV MV A do Công ty : OWNER chi trả')
    expect(fillText('Ngày H94, số HD999, HĐLĐ', data)).toBe('Ngày 06, số HD999, HĐLĐ')
  })

  it('đọc vùng in của sheet', () => {
    expect(parseRange('A1:J29')).toEqual({ left: 1, top: 1, right: 10, bottom: 29 })
    expect(parseRange(undefined)).toBeNull()
  })
})

describe('CV chủ tàu Trung Quốc: điền theo ô', () => {
  it('số tháng trên tàu: tối thiểu 1, chưa rời tàu để trống', () => {
    expect(monthsOnBoard('2026-05-01', '2026-09-30')).toBe('4')
    expect(monthsOnBoard('2026-07-03', '2026-07-31')).toBe('1')
    expect(monthsOnBoard('2026-07-03', null)).toBe('')
  })

  it('thông tin cá nhân, giấy tờ, chứng chỉ và lần đi tàu vào đúng ô', () => {
    const cells = cvCells({
      seafarer: { full_name: 'Đỗ Văn Hoài', rank_name_en: 'Engine Cadet', date_of_birth: '1982-03-12', passport_number: 'P2345689', passport_issued_date: '2021-01-12', shoe_size: 42 },
      certificates: [
        { type_code: 'AFF', certificate_number: 'AFF-1', issued_date: '2020-01-01', expiry_date: '2025-01-01' },
        { type_code: 'AFF', certificate_number: 'AFF-2', issued_date: '2025-02-01', expiry_date: '2030-02-01' },
        { type_code: 'PASSPORT', certificate_number: 'P999', issued_date: '2024-05-05' },
      ],
      services: [{ vessel_name_raw: 'ABBOTSGRANGE', rank_raw: 'Captain', sign_on_date: '2026-07-01', sign_off_date: '2026-07-06', gross_tonnage_raw: '1654' }],
      kin: { full_name: 'Trần Thị B', relationship: 'Vợ', phone_primary: '0900000000' },
    }, new Date(2026, 9, 6))
    expect(cells).toMatchObject({
      B5: 'Engine Cadet', G5: '2026.10.06', D7: 'ĐỖ VĂN HOÀI', D8: '12/03/1982', D9: '42', D13: 'Trần Thị B (Vợ)', F13: '0900000000',
      D17: 'P999', E17: '05/05/2024', D25: 'AFF-2', F25: '01/02/2030',
      C44: 'ABBOTSGRANGE', C45: 'Captain', C49: '1654', C54: '01/07/2026', C56: '1',
    })
    expect(cells.D44).toBeUndefined()
  })
})

describe('thông tin điền thêm và ô sửa tay vào đúng chỗ trên giấy', () => {
  // Sheet giả: chỉ cần getCell trả về ô có value và text.
  const sheet = (cells, formats = {}) => ({
    cells,
    getCell(address) {
      const self = this
      return { numFmt: formats[address], get text() { return String(self.cells[address] ?? '') }, get value() { return self.cells[address] }, set value(v) { self.cells[address] = v } }
    },
  })

  it('đọc số tiền bằng chữ', () => {
    expect(vndWords(100000)).toBe('Một trăm nghìn đồng chẵn')
    expect(vndWords(1250000)).toBe('Một triệu hai trăm năm mươi nghìn đồng chẵn')
    expect(vndWords(2005015)).toBe('Hai triệu không trăm lẻ năm nghìn không trăm mười lăm đồng chẵn')
    expect(vndWords(21)).toBe('Hai mươi mốt đồng chẵn')
    expect(parseAmount('1.250.000 đ')).toBe(1250000)
    expect(parseAmount('chưa rõ')).toBeNull()
  })

  it('phiếu thu: số tiền ra cả số lẫn chữ, lý do thu thay mặc định', () => {
    const ws = sheet({ B7: 100000, A8: '(Một trăm nghìn đồng chẵn)', F10: 'Một trăm nghìn đồng chẵn./.', C6: 'Thu tiền quỹ' })
    applyInputs(ws, 'phieu_thu', { 'Số tiền': '1.250.000', 'Lý do thu': 'Phí hồ sơ' })
    expect(ws.cells).toEqual({ B7: 1250000, A8: '(Một triệu hai trăm năm mươi nghìn đồng chẵn)', F10: 'Một triệu hai trăm năm mươi nghìn đồng chẵn./.', C6: 'Phí hồ sơ' })
  })

  it('số tiền không đọc được thì giữ nguyên mẫu; ô để trống thì không đụng tới', () => {
    const ws = sheet({ B7: 100000, A8: '(x)', F10: 'x', C6: 'Thu tiền quỹ' })
    applyInputs(ws, 'phieu_thu', { 'Số tiền': 'chưa rõ', 'Lý do thu': '  ' })
    expect(ws.cells).toEqual({ B7: 100000, A8: '(x)', F10: 'x', C6: 'Thu tiền quỹ' })
  })

  it('ô sửa tay ghi sau cùng, ô số vẫn là số', () => {
    const ws = sheet({ B7: 100000, C6: 'Thu tiền quỹ', D2: 3 }, { B7: '#,##0' })
    applyInputs(ws, 'phieu_thu', { 'Lý do thu': 'Phí hồ sơ' })
    applyEdits(ws, { C6: 'Phí khám sức khỏe', B7: '2.500.000', D2: 'ba', E9: '' })
    expect(ws.cells).toEqual({ B7: 2500000, C6: 'Phí khám sức khỏe', D2: 'ba', E9: '' })
    applyEdits(ws, { C6: [{ text: 'Phí ', bold: true }, { text: 'khám', underline: true }] })
    expect(ws.cells.C6.richText.map((run) => [run.text, run.font.bold, run.font.underline])).toEqual([['Phí ', true, false], ['khám', false, true]])
    applyEdits(ws, undefined)
    expect(ws.cells.B7).toBe(2500000)
  })

  it('ô sửa tay ghi gạch ngang, màu, cỡ chữ và căn lề vào file', () => {
    const ws = new ExcelJS.Workbook().addWorksheet('a')
    ws.getCell('C6').value = 'Thu tiền quỹ'
    ws.getCell('C6').font = { name: 'Times New Roman', size: 12 }
    applyEdits(ws, { C6: { runs: [{ text: 'Phí', strike: true, color: '#c00000', size: 14 }, { text: ' quỹ' }], align: 'right' } })
    const [first, second] = ws.getCell('C6').value.richText
    expect(first.font).toMatchObject({ name: 'Times New Roman', strike: true, color: { argb: 'FFC00000' }, size: 14 })
    expect(second.font).toMatchObject({ strike: false, size: 12 })
    expect(ws.getCell('C6').alignment.horizontal).toBe('right')
  })

  it('nối sau nhãn, thay chỗ chấm, điền ngày thanh lý', () => {
    const roi = sheet({ B22: 'Thuyền viên rời tàu tại:', B23: 'Thời gian dự kiến rời  tàu :' })
    applyInputs(roi, 'qd_roi_tau', { 'Cảng rời tàu': 'Qingdao', 'Ngày rời tàu': '20/11/2026' })
    expect(roi.cells).toEqual({ B22: 'Thuyền viên rời tàu tại: Qingdao', B23: 'Thời gian dự kiến rời  tàu : 20/11/2026' })

    const bh = sheet({ E17: 'Mức đóng :……………' })
    applyInputs(bh, 'don_bh', { 'Mức đóng': '5.000.000 đ/tháng' })
    expect(bh.cells.E17).toBe('Mức đóng : 5.000.000 đ/tháng')

    const tl = sheet({ A13: 'Hôm nay ngày ….... tháng …..... năm …......., tại [TÊN CÔNG TY], chúng tôi gồm:' })
    applyInputs(tl, 'thanh_ly', { 'Ngày thanh lý': '5/11/2026' })
    expect(tl.cells.A13).toBe('Hôm nay ngày 05 tháng 11 năm 2026, tại [TÊN CÔNG TY], chúng tôi gồm:')
  })
})
