import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { shipCatalogService } = require('../ship_catalog.service')

const TYPES = [{ id: 2, code: 'CONTAINER', name_en: 'Container Ship', name_vi: 'Tàu container' }]
const COUNTRIES = [{ id: 11, code: 'PA', name_en: 'Panama', name_vi: 'Panama' }]
function fakeDb({ total = 1, rows = [] } = {}) {
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('COUNT(*)')) return [[{ total }]]
      if (sql.includes('FROM vessel_type')) return [TYPES]
      if (sql.includes('FROM country')) return [COUNTRIES]
      return [rows]
    },
  }
}
const ROW = { source_id: 9811000, imo_number: '9811000', ship_name: 'EVER GIVEN', mmsi: '353136000', ship_type: 'CONTAINER SHIP', ship_type_group: 'CARGO SHIP', flag_code: 'PA', flag_name: 'PANAMA', ex_name: null }

describe('Danh mục tàu thế giới', () => {
  it('dưới 2 ký tự thì không truy vấn', async () => {
    const db = fakeDb()
    expect(await shipCatalogService.search(db, { q: ' a ' })).toEqual({ data: [], total: 0, page: 1, limit: 20 })
    expect(await shipCatalogService.search(db, {})).toMatchObject({ total: 0 })
    expect(db.calls).toHaveLength(0)
  })
  it('loại tàu đã có bằng NOT EXISTS trên toàn bảng vessel, cả đếm và lấy dòng', async () => {
    const db = fakeDb({ rows: [ROW] })
    await shipCatalogService.search(db, { q: 'ever' })
    const [count, page] = db.calls
    expect(count.sql).toContain('NOT EXISTS (SELECT 1 FROM vessel v WHERE v.imo_number = s.imo_number)')
    expect(page.sql).toContain('NOT EXISTS (SELECT 1 FROM vessel v WHERE v.imo_number = s.imo_number)')
  })
  it('escape % _ \\ trong từ khoá, IMO 7 số và MMSI 9 số so khớp đúng cột', async () => {
    const db = fakeDb({ total: 0 })
    await shipCatalogService.search(db, { q: '50%_a\\' })
    expect(db.calls[0].params).toEqual(['%50\\%\\_a\\\\%', '%50\\%\\_a\\\\%', null, null])
    await shipCatalogService.search(db, { q: '9811000' })
    expect(db.calls[1].params.slice(2)).toEqual(['9811000', null])
    await shipCatalogService.search(db, { q: '353136000' })
    expect(db.calls[2].params.slice(2)).toEqual([null, '353136000'])
  })
  it('phân trang: bỏ qua đúng số dòng, giới hạn tối đa 50', async () => {
    const db = fakeDb({ total: 100, rows: [ROW] })
    const out = await shipCatalogService.search(db, { q: 'ever', page: 3, limit: 999 })
    expect(out).toMatchObject({ total: 100, page: 3, limit: 50 })
    expect(db.calls[1].params.slice(-2)).toEqual([50, 100])
  })
  it('mỗi dòng kèm prefill (id loại tàu, id cờ) và unmatched', async () => {
    const db = fakeDb({ rows: [ROW, { ...ROW, source_id: 1, imo_number: null, mmsi: null, ship_name: 'X', ship_type: 'YACHT', flag_code: null, flag_name: 'ATLANTIS' }] })
    const { data } = await shipCatalogService.search(db, { q: 'ever' })
    expect(data[0].prefill).toEqual({ vessel_name: 'EVER GIVEN', imo_number: '9811000', mmsi: '353136000', vessel_type_id: 2, flag_country_id: 11 })
    expect(data[1].prefill).toEqual({ vessel_name: 'X' })
    expect(data[1].unmatched).toEqual({ vessel_type: 'YACHT', flag: 'ATLANTIS' })
  })
  it('không có kết quả thì không đọc danh mục tham chiếu', async () => {
    const db = fakeDb({ total: 0 })
    await shipCatalogService.search(db, { q: 'zzz' })
    expect(db.calls).toHaveLength(1)
  })
})
