import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { normalizeDate, normalizeRank, normalizeName, sameName, normalizeNumber } = require('../normalize')

const TODAY = new Date(Date.UTC(2026, 9, 12))
const date = (text, options) => normalizeDate(text, { today: TODAY, ...options })

describe('normalizeDate', () => {
  it.each([
    ['04.1.2016', '04/01/2016'],
    ['02/08/2016', '02/08/2016'],
    ['JUL.11.2020', '11/07/2020'],
    ['17th-FEB-2020', '17/02/2020'],
    ['10-FEB-2024', '10/02/2024'],
    ['04 . 1 . 2016', '04/01/2016'],
    ['2016-01-04', '04/01/2016'],
    ['11 July 2020', '11/07/2020'],
    ['July 11, 2020', '11/07/2020'],
    ['Ngày 04 tháng 01 năm 2016', '04/01/2016'],
    ['29.02.2024', '29/02/2024'],
  ])('%s → %s', (input, expected) => {
    expect(date(input)).toMatchObject({ status: 'OK', value: expected })
  })

  it('trả thêm ngày dạng ISO', () => {
    expect(date('17th-FEB-2020').iso).toBe('2020-02-17')
  })

  it('năm hai chữ số là DATE_AMBIGUOUS kèm giá trị đoán', () => {
    expect(date('27.03.18')).toMatchObject({ status: 'DATE_AMBIGUOUS', value: '27/03/2018' })
    expect(date('10-FEB-24')).toMatchObject({ status: 'DATE_AMBIGUOUS', value: '10/02/2024' })
    expect(date('01.01.99')).toMatchObject({ status: 'DATE_AMBIGUOUS', value: '01/01/1999' })
  })

  it('ngày đọc được hai cách chỉ chưa chắc khi được báo thứ tự chưa rõ', () => {
    expect(date('03/04/2018').status).toBe('OK')
    expect(date('03/04/2018', { numericOrderUnknown: true })).toMatchObject({ status: 'DATE_AMBIGUOUS', value: '03/04/2018' })
    // Một cách đọc duy nhất (ngày > 12) thì không chưa chắc, và tên tháng thì luôn rõ.
    expect(date('27/03/2018', { numericOrderUnknown: true }).status).toBe('OK')
    expect(date('03-APR-2018', { numericOrderUnknown: true }).status).toBe('OK')
    expect(date('05/05/2018', { numericOrderUnknown: true }).status).toBe('OK')
  })

  it('ngày không hợp lệ hoặc không đọc được', () => {
    for (const bad of ['31/02/2020', '30.13.2020', 'abc', '1990', '12/2020', '1/1/20201', '32-JAN-2020']) {
      expect(date(bad).status).toBe('INVALID')
    }
    expect(date('')).toMatchObject({ status: 'EMPTY', value: null })
    expect(date(null).status).toBe('EMPTY')
    expect(date('29.02.2023').status).toBe('INVALID')
  })
})

describe('normalizeRank', () => {
  const ranks = [
    { id: 1, code: 'CAPT', name_vi: 'Thuyền trưởng', name_en: 'Captain' },
    { id: 2, code: 'CO', name_vi: 'Đại phó', name_en: 'Chief Officer' },
    { id: 12, code: '2E', name_vi: 'Máy hai', name_en: '2nd Engineer' },
    { id: 8, code: 'OSD', name_vi: 'Thủy thủ thực tập', name_en: 'Ordinary Seaman' },
    { id: 9, code: 'OS', name_vi: 'Thủy thủ thực tập', name_en: 'Ordinary Seaman' },
    { id: 18, code: 'OLR', name_vi: 'Thợ máy', name_en: 'Oiler' },
    { id: 19, code: 'WPR', name_vi: 'Thợ máy thực tập', name_en: 'Wiper' },
    { id: 20, code: 'OSE', name_vi: 'Thợ máy thực tập', name_en: 'Ordinary Seaman Engine' },
    { id: 21, code: 'ENGINE CADET', name_vi: 'Thực tập sỹ quan máy', name_en: 'Engine Cadet' },
  ]
  const code = (text) => normalizeRank(text, ranks)?.code ?? null

  it('viết tắt và cách viết khác', () => {
    expect(code('OLR')).toBe('OLR')
    expect(code('Oiler')).toBe('OLR')
    expect(code('2E')).toBe('2E')
    expect(code('2/E')).toBe('2E')
    expect(code('2nd Eng.')).toBeNull()
    expect(code('2ND ENGINEER')).toBe('2E')
    expect(code('C/O')).toBe('CO')
    expect(code('Master')).toBe('CAPT')
    expect(code('E/Cdt')).toBe('ENGINE CADET')
    expect(code('Thợ máy')).toBe('OLR')
    expect(code('Đại phó')).toBe('CO')
  })

  it('không có trong bảng hoặc trùng nhiều dòng thì null, không đoán', () => {
    expect(code('Chief Cook')).toBeNull()
    expect(code('Thợ máy thực tập')).toBeNull()
    expect(code('Thủy thủ thực tập')).toBeNull()
    expect(code('Ordinary Seaman')).toBe('OS')
    expect(code('')).toBeNull()
    expect(code('XYZ')).toBeNull()
  })

  it('trả về id để lưu rank_id', () => {
    expect(normalizeRank('Oiler', ranks).id).toBe(18)
  })
})

describe('tên người và số', () => {
  it('bỏ dấu, hoa thường, dấu câu', () => {
    expect(normalizeName('  Đỗ Văn  Hoài. ')).toBe('DO VAN HOAI')
  })

  it('cùng một người', () => {
    expect(sameName('Đỗ Văn Hoài', 'DO VAN HOAI')).toBe(true)
    expect(sameName('HOAI DO VAN', 'Đỗ Văn Hoài')).toBe(true)
    expect(sameName('Đỗ Văn Hoài', 'Đỗ Văn Hoàng')).toBe(false)
    expect(sameName('', 'Đỗ Văn Hoài')).toBe(false)
  })

  it('so số sổ bằng chữ và số', () => {
    expect(normalizeNumber('VN-0012 345')).toBe('VN0012345')
  })
})
