import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { createVesselLookup, buildProvider } = require('../index')
const { isValidImo } = require('../../../utils/imo')

const TYPES = [{ id: 1, code: 'BULK', name_en: 'Bulk Carrier', name_vi: 'Tàu hàng rời' }]
const COUNTRIES = [{ id: 10, code: 'MH', name_en: 'Marshall Islands', name_vi: null }]
const GLOBAL = 120

// Các IMO hợp lệ khác nhau (tự tính chữ số kiểm tra).
function validImos(count) {
  const out = []
  for (let n = 0; out.length < count; n += 1) {
    const base = String(974000 + n)
    const sum = [...base].reduce((total, digit, index) => total + Number(digit) * (7 - index), 0)
    const imo = `${base}${sum % 10}`
    if (isValidImo(imo)) out.push(imo)
  }
  return out
}

// Pool giả: bảng vessel_lookup và trần chung trong bộ nhớ.
// Mỗi query chạy đồng bộ trong một lần gọi nên UPDATE giành lượt là nguyên tử, giống một lệnh UPDATE có điều kiện trong Postgres.
function fakeDb({ cached = {}, vessel = null, gateAge = Infinity } = {}) {
  const state = { cached: { ...cached }, upserts: [], gateAge, claims: 0, now: 0, lastCall: Number.isFinite(gateAge) ? -gateAge : -Infinity }
  const age = () => state.now - state.lastCall
  return {
    state,
    async query(sql, params) {
      if (sql.includes('UPDATE vessel_lookup_gate')) {
        if (age() >= params[0]) { state.lastCall = state.now; state.claims += 1; return [{ affectedRows: 1 }] }
        return [{ affectedRows: 0 }]
      }
      if (sql.includes('FROM vessel_lookup_gate')) return [[{ wait: Math.max(0, Math.ceil(params[0] - age())) }]]
      if (sql.includes('FROM vessel_lookup WHERE')) {
        await Promise.resolve()
        return [state.cached[params[0]] ? [state.cached[params[0]]] : []]
      }
      if (sql.includes('INSERT INTO vessel_lookup')) { state.upserts.push(params); return [[]] }
      if (sql.includes('FROM vessel_type')) return [TYPES]
      if (sql.includes('FROM country')) return [COUNTRIES]
      if (sql.includes('FROM vessel WHERE')) return [vessel ? [vessel] : []]
      throw new Error(`unexpected sql: ${sql}`)
    },
  }
}
const provider = (impl) => ({ name: 'fake', calls: 0, async fetchByImo(imo) { this.calls += 1; await Promise.resolve(); return impl(imo) } })
const FOUND = { found: true, raw: { name: 'GEIYO K', vessel_type: 'Bulk Carrier', flag: 'Marshall Is.', year_built: '2014' } }
const make = (p) => createVesselLookup({ provider: p, cooldownSeconds: 120, globalCooldownSeconds: GLOBAL })
const [IMO_A, IMO_B] = validImos(2)

describe('Lấy thông tin thông minh', () => {
  it('tắt khi chưa cấu hình nguồn: 503', async () => {
    const svc = createVesselLookup({ provider: null, cooldownSeconds: 120 })
    expect(svc.enabled()).toBe(false)
    await expect(svc.lookup(fakeDb(), IMO_A, 1)).rejects.toMatchObject({ statusCode: 503 })
  })
  it('IMO sai số kiểm tra: 400, không gọi nguồn, không tốn lượt', async () => {
    const p = provider(() => FOUND)
    const db = fakeDb()
    await expect(make(p).lookup(db, `${IMO_A.slice(0, 6)}${(Number(IMO_A[6]) + 1) % 10}`, 1)).rejects.toMatchObject({ statusCode: 400 })
    expect(p.calls).toBe(0)
    expect(db.state.claims).toBe(0)
  })
  it('chưa có bản lưu: giành lượt, gọi nguồn, lưu, trả bản đề xuất kèm 120 giây chờ', async () => {
    const p = provider(() => FOUND)
    const db = fakeDb()
    const out = await make(p).lookup(db, IMO_A, 7)
    expect(p.calls).toBe(1)
    expect(db.state.claims).toBe(1)
    expect(db.state.upserts[0].slice(0, 3)).toEqual([IMO_A, 'fake', 'FOUND'])
    expect(db.state.upserts[0][4]).toBe(7)
    expect(out).toMatchObject({ imo_number: IMO_A, found: true, from_cache: false, retry_after: 120, gate_wait: 120, existing_vessel: null })
    expect(out.proposal).toMatchObject({ vessel_name: 'GEIYO K', vessel_type_id: 1, flag_country_id: 10, year_built: 2014 })
  })
  it('nguồn không có tàu: found false, vẫn lưu và vẫn tính lượt', async () => {
    const p = provider(() => ({ found: false }))
    const db = fakeDb()
    const out = await make(p).lookup(db, IMO_A, 7)
    expect(out).toMatchObject({ found: false, proposal: {}, retry_after: 120 })
    expect(db.state.upserts[0][2]).toBe('NOT_FOUND')
    expect(db.state.claims).toBe(1)
  })
  it('báo tàu đã có trong MCAH, kể cả đã xoá mềm', async () => {
    const out = await make(provider(() => FOUND)).lookup(fakeDb({ vessel: { id: 4, vessel_name: 'GEIYO K', deleted_at: '2026-01-01' } }), IMO_A, 7)
    expect(out.existing_vessel).toEqual({ id: 4, vessel_name: 'GEIYO K', deleted: true })
  })
})

describe('Trần chung: cả hệ thống 1 lần mỗi 2 phút', () => {
  it('trong thời gian chờ chung, IMO khác bị từ chối 429 kèm số giây chờ, không gọi nguồn', async () => {
    const p = provider(() => FOUND)
    const db = fakeDb({ gateAge: 30 })
    await expect(make(p).lookup(db, IMO_A, 1)).rejects.toMatchObject({ statusCode: 429, retry_after: 90 })
    expect(p.calls).toBe(0)
    expect(db.state.upserts).toHaveLength(0)
  })
  it('qua thời gian chờ chung thì gọi được lại', async () => {
    const p = provider(() => FOUND)
    const out = await make(p).lookup(fakeDb({ gateAge: 121 }), IMO_A, 1)
    expect(p.calls).toBe(1)
    expect(out.from_cache).toBe(false)
  })
  it('gọi song song nhiều IMO khác nhau: chỉ MỘT yêu cầu gọi được nguồn, các yêu cầu còn lại 429', async () => {
    const p = provider(() => FOUND)
    const db = fakeDb()
    const svc = make(p)
    const imos = validImos(10)
    const results = await Promise.allSettled(imos.map((imo, i) => svc.lookup(db, imo, i)))
    expect(p.calls).toBe(1)
    expect(db.state.claims).toBe(1)
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(9)
    expect(rejected.every((r) => r.reason.statusCode === 429 && r.reason.retry_after > 0)).toBe(true)
  })
  it('gọi song song CÙNG một IMO cũng chỉ một lần gọi nguồn', async () => {
    const p = provider(() => FOUND)
    const db = fakeDb()
    const svc = make(p)
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => svc.lookup(db, IMO_A, i)))
    expect(p.calls).toBe(1)
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })
  it('nguồn lỗi vẫn tính lượt: lần sau 429, và lỗi 502 kèm retry_after', async () => {
    const p = provider(() => { throw { statusCode: 502, message: 'Nguồn ngoài không phản hồi' } })
    const db = fakeDb()
    const svc = make(p)
    await expect(svc.lookup(db, IMO_A, 1)).rejects.toMatchObject({ statusCode: 502, message: 'Nguồn ngoài không phản hồi', retry_after: 120 })
    expect(db.state.upserts).toHaveLength(0)
    await expect(svc.lookup(db, IMO_B, 1)).rejects.toMatchObject({ statusCode: 429 })
    expect(p.calls).toBe(1)
  })
  it('hết thời gian chờ chung thì gọi lại được sau lỗi', async () => {
    const p = provider(() => { throw { statusCode: 502, message: 'x' } })
    const db = fakeDb()
    const svc = make(p)
    await expect(svc.lookup(db, IMO_A, 1)).rejects.toMatchObject({ statusCode: 502 })
    db.state.now += 121
    await expect(svc.lookup(db, IMO_B, 1)).rejects.toMatchObject({ statusCode: 502 })
    expect(p.calls).toBe(2)
  })
  it('waitSeconds: 0 khi rảnh, còn lại khi đang chờ', async () => {
    const svc = make(provider(() => FOUND))
    expect(await svc.waitSeconds(fakeDb())).toBe(0)
    expect(await svc.waitSeconds(fakeDb({ gateAge: 45 }))).toBe(75)
  })
})

describe('Bản lưu theo IMO', () => {
  const cachedRow = (age) => ({ status: 'FOUND', raw: FOUND.raw, age, fetched_at: '2026-10-27T03:00:00Z' })
  it('trong thời gian chờ của IMO: trả bản đã lưu, không gọi nguồn, không tốn lượt chung', async () => {
    const p = provider(() => FOUND)
    const db = fakeDb({ cached: { [IMO_A]: cachedRow(45) } })
    const out = await make(p).lookup(db, IMO_A, 7)
    expect(p.calls).toBe(0)
    expect(db.state.claims).toBe(0)
    expect(out).toMatchObject({ from_cache: true, fetched_at: '2026-10-27T03:00:00Z', retry_after: 75, gate_wait: 0 })
    expect(out.proposal.vessel_name).toBe('GEIYO K')
  })
  it('retry_after là lớn nhất của thời gian chờ IMO và trần chung', async () => {
    const out = await make(provider(() => FOUND)).lookup(fakeDb({ cached: { [IMO_A]: cachedRow(100) }, gateAge: 10 }), IMO_A, 7)
    expect(out).toMatchObject({ from_cache: true, gate_wait: 110, retry_after: 110 })
  })
  it('hết thời gian chờ của IMO nhưng trần chung còn: 429, không gọi nguồn', async () => {
    const p = provider(() => FOUND)
    await expect(make(p).lookup(fakeDb({ cached: { [IMO_A]: cachedRow(121) }, gateAge: 20 }), IMO_A, 7)).rejects.toMatchObject({ statusCode: 429, retry_after: 100 })
    expect(p.calls).toBe(0)
  })
  it('hết cả hai thời gian chờ: gọi nguồn lại và ghi đè bản lưu', async () => {
    const p = provider(() => FOUND)
    const out = await make(p).lookup(fakeDb({ cached: { [IMO_A]: cachedRow(121) }, gateAge: 121 }), IMO_A, 7)
    expect(p.calls).toBe(1)
    expect(out.from_cache).toBe(false)
  })
})

describe('buildProvider', () => {
  it('chỉ bật khi đủ nguồn, địa chỉ và khoá', () => {
    expect(buildProvider({ provider: '' })).toBeNull()
    expect(buildProvider({ provider: 'legacy_proxy', baseUrl: 'http://x', encKey: '' })).toBeNull()
    expect(buildProvider({ provider: 'unknown', baseUrl: 'http://x', encKey: 'k' })).toBeNull()
    expect(buildProvider({ provider: 'legacy_proxy', baseUrl: 'http://x', encKey: 'k' }).name).toBe('legacy_proxy')
  })
})
