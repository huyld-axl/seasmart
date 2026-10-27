import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { matchVesselType, matchCountry, mapClassStatus, mapDpClass, mapProposal, mapCatalogRow } = require('../map')

const types = [
  { id: 1, code: 'BULK', name_en: 'Bulk Carrier', name_vi: 'Tàu hàng rời' },
  { id: 2, code: 'CONTAINER', name_en: 'Container Ship', name_vi: 'Tàu container' },
  { id: 3, code: 'TANKER-OIL', name_en: 'Oil Tanker', name_vi: 'Tàu chở dầu' },
  { id: 4, code: 'TANKER-CHEM', name_en: 'Chemical Tanker', name_vi: 'Tàu chở hóa chất' },
  { id: 5, code: 'GENERAL-CARGO', name_en: 'General Cargo', name_vi: 'Tàu hàng tổng hợp' },
  { id: 6, code: 'FISHING', name_en: 'Fishing Vessel', name_vi: 'Tàu đánh cá' },
]
const countries = [
  { id: 10, code: 'MH', name_en: 'Marshall Islands', name_vi: 'Quần đảo Marshall' },
  { id: 11, code: 'PA', name_en: 'Panama', name_vi: 'Panama' },
  { id: 12, code: 'VN', name_en: 'Vietnam', name_vi: 'Việt Nam' },
  { id: 13, code: 'HK', name_en: 'Hong Kong', name_vi: null },
]
const refs = { types, countries }

describe('matchVesselType', () => {
  it('khớp đúng tên tiếng Anh, bỏ qua hoa thường và dấu câu', () => {
    expect(matchVesselType('bulk carrier', types)).toBe(1)
    expect(matchVesselType('CONTAINER SHIP', types)).toBe(2)
  })
  it('dò từ khoá khi không khớp đúng tên', () => {
    expect(matchVesselType('Crude Oil Tanker', types)).toBe(3)
    expect(matchVesselType('Chemical/Oil Products Tanker', types)).toBe(4)
    expect(matchVesselType('General Cargo Ship', types)).toBe(5)
    expect(matchVesselType('Fishing Trawler', types)).toBe(6)
  })
  it('không khớp thì null', () => {
    expect(matchVesselType('Limestone Carrier', [types[3]])).toBeNull()
    expect(matchVesselType('', types)).toBeNull()
    expect(matchVesselType('Yacht', types)).toBeNull()
  })
})

describe('matchCountry', () => {
  it('khớp mã ISO2, tên tiếng Anh và tên tiếng Việt', () => {
    expect(matchCountry('PA', countries)).toBe(11)
    expect(matchCountry('panama', countries)).toBe(11)
    expect(matchCountry('Quần đảo Marshall', countries)).toBe(10)
  })
  it('khớp tên gọi khác của nguồn tàu biển', () => {
    expect(matchCountry('Marshall Is.', countries)).toBe(10)
    expect(matchCountry('Hong Kong, China', countries)).toBe(13)
    expect(matchCountry('Viet Nam', countries)).toBe(12)
  })
  it('không khớp thì null', () => {
    expect(matchCountry('Atlantis', countries)).toBeNull()
    expect(matchCountry(null, countries)).toBeNull()
  })
})

describe('trạng thái và DP class', () => {
  it('không đăng kiểm được kiểm trước đăng kiểm', () => {
    expect(mapClassStatus('Unclassed')).toBe('UNCLASSED')
    expect(mapClassStatus('Not Classed')).toBe('UNCLASSED')
    expect(mapClassStatus('In Class')).toBe('IN_CLASS')
    expect(mapClassStatus('Class Suspended')).toBe('SUSPENDED')
    expect(mapClassStatus('Class Withdrawn')).toBe('WITHDRAWN')
    expect(mapClassStatus('???')).toBeNull()
  })
  it('đổi DP class các dạng viết', () => {
    expect(mapDpClass('DPS-1')).toBe('DP1')
    expect(mapDpClass('DP 2')).toBe('DP2')
    expect(mapDpClass('dp3')).toBe('DP3')
    expect(mapDpClass('None')).toBe('NONE')
    expect(mapDpClass('abc')).toBeNull()
  })
})

describe('mapProposal', () => {
  const raw = {
    name: ' GEIYO K ', imo_number: '9747613', vessel_type: 'Bulk Carrier', flag: 'Marshall Is.', mmsi: '538006748', call_sign: 'V7KT9XYZ123',
    year_built: '2014-05', gross_tonnage: '31,557', deadweight: 56000, class_society: 'NK', class_status: 'In Class', lifecycle_status: 'In Service',
    dp_class: 'DPS-2', has_boiler: true, has_refrigeration: 'false', manager_name: 'Sealift Management', owner_name: 'Sealift Maritime S.A.',
    class_number: 'C123', engine_maker: 'MAN',
  }
  it('đổi sang cột của vessel, chỉ giữ trường hợp lệ', () => {
    const { proposal } = mapProposal(raw, refs)
    expect(proposal).toEqual({
      vessel_name: 'GEIYO K', imo_number: '9747613', mmsi: '538006748', call_sign: 'V7KT9XYZ12', vessel_type_id: 1, flag_country_id: 10,
      year_built: 2014, classification_society: 'NK', status: 'ACTIVE', class_status: 'IN_CLASS', gross_tonnage: 31557, deadweight: 56000,
      dp_class: 'DP2', has_boiler: 1, has_refrigeration: 0, technical_manager: 'Sealift Management',
    })
  })
  it('chữ khoá ngoại không khớp đi vào unmatched, thông tin phụ vào extra', () => {
    const { unmatched, extra } = mapProposal({ ...raw, vessel_type: 'Yacht', flag: 'Atlantis' }, refs)
    expect(unmatched).toEqual({ vessel_type: 'Yacht', flag: 'Atlantis', ship_owner: 'Sealift Maritime S.A.' })
    expect(extra).toEqual({ owner_name: 'Sealift Maritime S.A.', class_number: 'C123', engine_maker: 'MAN' })
  })
  it('bỏ giá trị sai: MMSI sai độ dài, năm ngoài khoảng, số âm', () => {
    const { proposal } = mapProposal({ name: 'X', mmsi: '12345', year_built: '1850', gross_tonnage: -5, deadweight: 'abc' }, refs)
    expect(proposal).toEqual({ vessel_name: 'X' })
  })
  it('boolean chỉ đưa vào khi nguồn trả rõ true/false', () => {
    expect(mapProposal({ name: 'X', has_boiler: undefined }, refs).proposal).not.toHaveProperty('has_boiler')
    expect(mapProposal({ name: 'X', has_boiler: 'maybe' }, refs).proposal).not.toHaveProperty('has_boiler')
  })
})

describe('mapCatalogRow', () => {
  it('đổi dòng danh mục thành bản điền sẵn', () => {
    const row = { ship_name: 'EVER GIVEN', imo_number: '9811000', mmsi: '353136000', ship_type: 'CONTAINER SHIP', ship_type_group: 'CARGO SHIP', flag_code: 'PA', flag_name: 'PANAMA' }
    expect(mapCatalogRow(row, refs)).toEqual({
      prefill: { vessel_name: 'EVER GIVEN', imo_number: '9811000', mmsi: '353136000', vessel_type_id: 2, flag_country_id: 11 },
      unmatched: {},
    })
  })
  it('loại tàu và cờ không khớp thì để trống kèm chữ gốc', () => {
    const row = { ship_name: 'XXII', imo_number: '7112759', mmsi: null, ship_type: 'LIMESTONE CARRIER', ship_type_group: 'OTHER/AUXILIARY', flag_code: null, flag_name: 'BAHRAIN' }
    const out = mapCatalogRow(row, { types: [types[3]], countries })
    expect(out.prefill).toEqual({ vessel_name: 'XXII', imo_number: '7112759' })
    expect(out.unmatched).toEqual({ vessel_type: 'LIMESTONE CARRIER', flag: 'BAHRAIN' })
  })
})
