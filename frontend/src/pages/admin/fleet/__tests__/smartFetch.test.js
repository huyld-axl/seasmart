import { describe, expect, it } from 'vitest'
import { catalogValues, compareRows, fillBlanks, seedFromIncoming, seedNotices, unmatchedHints, vesselTypeCode } from '../smartFetch'

const proposal = { vessel_name: 'GEIYO K', imo_number: '9747613', vessel_type_id: 1, flag_country_id: 10, year_built: 2014, deadweight: 56000, technical_manager: 'Sealift Management', status: 'ACTIVE', has_boiler: 1 }

describe('catalogValues', () => {
  it('chỉ lấy các trường của danh mục và bỏ trường trống', () => {
    expect(catalogValues({ vessel_name: 'X', imo_number: '9747613', mmsi: null, vessel_type_id: 2, extra: 1 })).toEqual({ vessel_name: 'X', imo_number: '9747613', vessel_type_id: 2 })
    expect(catalogValues(undefined)).toEqual({})
  })
})

describe('fillBlanks', () => {
  it('chỉ điền ô còn trống, giữ ô đã có giá trị', () => {
    const values = { vessel_name: 'Tên tôi nhập', year_built: null, deadweight: '', technical_manager: undefined }
    expect(fillBlanks(values, proposal)).toEqual({ vessel_type_id: 1, flag_country_id: 10, year_built: 2014, deadweight: 56000, technical_manager: 'Sealift Management' })
  })
  it('không đụng status và các cờ có/không (form luôn có mặc định)', () => {
    const patch = fillBlanks({}, proposal)
    expect(patch).not.toHaveProperty('status')
    expect(patch).not.toHaveProperty('has_boiler')
    expect(patch).not.toHaveProperty('imo_number')
  })
  it('số 0 là giá trị đã có, không bị ghi đè', () => {
    expect(fillBlanks({ deadweight: 0 }, { deadweight: 56000 })).toEqual({})
  })
})

describe('compareRows', () => {
  const labels = { year_built: 'Năm đóng', deadweight: 'DWT', vessel_name: 'Tên tàu' }
  it('liệt kê ô trống (chọn sẵn) và ô khác giá trị (không chọn sẵn)', () => {
    const rows = compareRows({ vessel_name: 'GEIYO K', year_built: 2013, deadweight: null }, proposal, { labels })
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]))
    expect(byKey.year_built).toMatchObject({ label: 'Năm đóng', current: 2013, next: 2014, value: 2014, on: false })
    expect(byKey.deadweight).toMatchObject({ current: null, next: 56000, on: true })
    expect(byKey).not.toHaveProperty('vessel_name')
  })
  it('so sánh số với chữ như nhau và dùng display để hiện tên thay id', () => {
    const rows = compareRows({ year_built: '2014', vessel_type_id: 2 }, { year_built: 2014, vessel_type_id: 1 }, { display: (key, value) => (key === 'vessel_type_id' ? `Loại ${value}` : value) })
    expect(rows).toEqual([expect.objectContaining({ key: 'vessel_type_id', current: 'Loại 2', next: 'Loại 1', on: false })])
  })
  it('không có gì mới thì mảng rỗng', () => {
    expect(compareRows({ vessel_name: 'GEIYO K' }, { vessel_name: 'GEIYO K' })).toEqual([])
  })
})

describe('unmatchedHints', () => {
  it('chỉ gợi ý khi ô khoá ngoại còn trống', () => {
    const unmatched = { vessel_type: 'Limestone Carrier', flag: 'Atlantis', ship_owner: 'Sunrise Shipping Co.' }
    expect(unmatchedHints(unmatched, {})).toEqual({ vessel_type: 'Limestone Carrier', flag: 'Atlantis', ship_owner: 'Sunrise Shipping Co.' })
    expect(unmatchedHints(unmatched, { vessel_type_id: 3, ship_owner_id: 5 })).toEqual({ vessel_type: null, flag: 'Atlantis', ship_owner: null })
  })
})

describe('vesselTypeCode', () => {
  it('sinh mã từ tên tiếng Anh', () => {
    expect(vesselTypeCode('Limestone Carrier')).toBe('LIMESTONE-CARRIER')
    expect(vesselTypeCode('  Ro/Ro (cargo) ')).toBe('RO-RO-CARGO')
  })
  it('tránh trùng mã có sẵn', () => {
    expect(vesselTypeCode('Barge', ['BARGE'])).toBe('BARGE-2')
    expect(vesselTypeCode('Barge', ['barge', 'BARGE-2'])).toBe('BARGE-3')
  })
  it('tên rỗng vẫn ra mã hợp lệ', () => {
    expect(vesselTypeCode('')).toBe('TYPE')
  })
})

describe('seedFromIncoming', () => {
  const base = { status: 'ACTIVE', has_boiler: false }
  const prefill = { vessel_name: 'EVER GIVEN', imo_number: '9811000', mmsi: '353136000', vessel_type_id: 2 }
  it('không có dữ liệu đến thì giữ nguyên giá trị gốc', () => {
    expect(seedFromIncoming(base, null)).toMatchObject({ values: base, sources: {}, catalogCount: 0, smartCount: 0 })
  })
  it('chỉ từ danh mục: điền và đánh dấu nguồn catalog', () => {
    const seed = seedFromIncoming(base, { prefill, unmatched: { flag: 'ATLANTIS' }, smart: null })
    expect(seed.values).toMatchObject({ status: 'ACTIVE', vessel_name: 'EVER GIVEN', imo_number: '9811000', vessel_type_id: 2 })
    expect(seed.sources).toEqual({ vessel_name: 'catalog', imo_number: 'catalog', mmsi: 'catalog', vessel_type_id: 'catalog' })
    expect(seed.unmatched).toEqual({ flag: 'ATLANTIS' })
    expect(seed.catalogCount).toBe(4)
  })
  it('có thông minh: chỉ điền ô còn trống, không đè giá trị danh mục', () => {
    const smart = { found: true, imo_number: '9811000', proposal: { vessel_name: 'KHÁC TÊN', vessel_type_id: 9, year_built: 2018, deadweight: 199629, flag_country_id: 11 }, unmatched: { ship_owner: 'Sunrise' } }
    const seed = seedFromIncoming(base, { prefill, unmatched: {}, smart })
    expect(seed.values).toMatchObject({ vessel_name: 'EVER GIVEN', vessel_type_id: 2, year_built: 2018, deadweight: 199629, flag_country_id: 11 })
    expect(seed.sources).toMatchObject({ vessel_name: 'catalog', year_built: 'smart', flag_country_id: 'smart' })
    expect(seed.smartCount).toBe(3)
    expect(seed.unmatched).toEqual({ ship_owner: 'Sunrise' })
  })
})

describe('seedNotices', () => {
  it('thông báo cho từng nguồn', () => {
    const seed = seedFromIncoming({}, { prefill: { vessel_name: 'X', imo_number: '9811000' }, unmatched: {}, smart: { found: true, imo_number: '9811000', proposal: { year_built: 2018 }, unmatched: {}, existing_vessel: { id: 4, vessel_name: 'EVER GIVEN', deleted: false } } })
    const notices = seedNotices(seed, '27/10/2026 10:30')
    expect(notices.map((notice) => notice.key)).toEqual(['catalog', 'smart', 'existing'])
    expect(notices[0].title).toBe('Đã điền 2 trường từ danh mục tàu thế giới')
    expect(notices[1].title).toBe('Đã lấy thêm 1 trường bằng Lấy thông minh (lúc 27/10/2026 10:30)')
    expect(notices[2]).toMatchObject({ tone: 'warning', vesselId: 4 })
  })
  it('nguồn không có tàu thì cảnh báo; tàu đã xoá mềm thì không báo trùng', () => {
    const seed = seedFromIncoming({}, { prefill: { imo_number: '9100009' }, unmatched: {}, smart: { found: false, imo_number: '9100009', existing_vessel: { id: 1, vessel_name: 'A', deleted: true } } })
    const notices = seedNotices(seed)
    expect(notices.map((notice) => notice.key)).toEqual(['catalog', 'smart'])
    expect(notices[1]).toMatchObject({ tone: 'warning', title: 'Nguồn bên ngoài không có tàu IMO 9100009' })
  })
  it('không có gì thì không có thông báo', () => {
    expect(seedNotices(seedFromIncoming({}, null))).toEqual([])
  })
})
