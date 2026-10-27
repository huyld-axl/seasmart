import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { realImo, splitExNames, toCatalogRow } = require('../ship_catalog_rows')

describe('realImo', () => {
  it('chỉ nhận 7 chữ số', () => {
    expect(realImo(9747613)).toBe('9747613')
    expect(realImo(-997755302)).toBeNull()
    expect(realImo(12000333)).toBeNull()
    expect(realImo(999999)).toBeNull()
  })
})

describe('splitExNames', () => {
  it('tách theo ; và bỏ tên rác, tên trùng', () => {
    expect(splitExNames('KIVANC TARUS;2,7[L&lt;#L,#OD?ZT33L23;SHERIN;sherin;YAAKOB II', 'YAAKOB II')).toEqual(['KIVANC TARUS', 'SHERIN'])
  })
  it('giải mã HTML escape hợp lệ và gọn khoảng trắng', () => {
    expect(splitExNames('A &amp; B;  THEA K          ', 'X')).toEqual(['A & B', 'THEA K'])
  })
  it('rỗng thì trả mảng rỗng', () => {
    expect(splitExNames(null, 'X')).toEqual([])
    expect(splitExNames('', 'X')).toEqual([])
  })
})

describe('toCatalogRow', () => {
  const base = { IMO_NO: 9747613, SHIP_NAME: ' GEIYO K ', EX_NAMES: 'OLD ONE', MMSI: 431000001, SHIP_TYPE: 'BULK CARRIER', SHIP_TYPE_GROUP: 'BULK CARRIER', COUNTRY_NAME: 'JAPAN', ABBR: 'jp', REGISTER_ID: 'UA_1' }
  it('chuẩn hoá một dòng đầy đủ', () => {
    expect(toCatalogRow(base)).toEqual({
      source_id: 9747613, imo_number: '9747613', ship_name: 'GEIYO K', mmsi: '431000001', ship_type: 'BULK CARRIER',
      ship_type_group: 'BULK CARRIER', flag_code: 'JP', flag_name: 'JAPAN', register_id: 'UA_1', ex_names: ['OLD ONE'],
    })
  })
  it('MMSI sai độ dài, mã cờ không chuẩn, IMO giả -> null', () => {
    const row = toCatalogRow({ ...base, IMO_NO: -997755302, MMSI: 12345, ABBR: 'USSR', COUNTRY_NAME: '' })
    expect(row).toMatchObject({ source_id: -997755302, imo_number: null, mmsi: null, flag_code: null, flag_name: null })
  })
  it('bỏ dòng không tên', () => {
    expect(toCatalogRow({ ...base, SHIP_NAME: '  ' })).toBeNull()
  })
})
