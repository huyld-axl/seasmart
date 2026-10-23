import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { fleetService, pickAllowed, VESSEL_COLUMNS, OWNER_COLUMNS } = require('../fleet.service')

// Pool giả: trả về hàng theo đoạn SQL khớp đầu tiên, ghi lại mọi câu đã chạy.
function fakePool(routes) {
  const calls = []
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params })
      const hit = routes.find(([needle]) => sql.includes(needle))
      return hit ? hit[1](sql, params) : [[]]
    },
  }
}
const count = (n) => [[{ n }]]

describe('fleet.service', () => {
  it('cột ghi được gồm đủ trường mới của tàu và đối tác', () => {
    for (const key of ['call_sign', 'status', 'class_status', 'dp_class', 'engine_power_kw', 'engine_type', 'passenger_capacity', 'crew_capacity', 'has_boiler', 'has_refrigeration', 'port_of_registry_id']) {
      expect(VESSEL_COLUMNS).toContain(key)
    }
    for (const key of ['tax_id', 'phone', 'fax', 'email', 'website', 'is_active']) expect(OWNER_COLUMNS).toContain(key)
  })

  it('pickAllowed bỏ cột lạ và đổi chuỗi rỗng thành null', () => {
    expect(pickAllowed({ vessel_name: 'A', call_sign: '', id: 9, deleted_at: 'x' }, VESSEL_COLUMNS)).toEqual({ vessel_name: 'A', call_sign: null })
  })

  it('không xoá tàu đang được dùng, báo 409', async () => {
    const pool = fakePool([
      ['FROM sea_service', () => count(2)],
      ['FROM voyage', () => count(1)],
      ['FROM seafarer_document', () => count(0)],
    ])
    await expect(fleetService.softDelete(pool, 'vessel', 5)).rejects.toMatchObject({ statusCode: 409 })
    expect(pool.calls.some((call) => call.sql.startsWith('UPDATE'))).toBe(false)
  })

  it('xoá mềm tàu chưa ai dùng', async () => {
    const pool = fakePool([
      ['FROM sea_service', () => count(0)],
      ['FROM voyage', () => count(0)],
      ['FROM seafarer_document', () => count(0)],
      ['UPDATE "vessel"', () => [{ affectedRows: 1 }]],
    ])
    await expect(fleetService.softDelete(pool, 'vessel', 5)).resolves.toEqual({ success: true })
  })

  it('không xoá đối tác đang có tàu, báo 409', async () => {
    const pool = fakePool([
      ['FROM vessel', () => count(3)],
      ['FROM voyage', () => count(0)],
      ['FROM export_pack', () => count(0)],
    ])
    await expect(fleetService.softDelete(pool, 'ship_owner', 2)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('danh sách tàu trả số đếm theo trạng thái cho các tab', async () => {
    const pool = fakePool([
      ['GROUP BY v.status', () => [[{ status: 'ACTIVE', n: '8' }, { status: 'LAID_UP', n: '1' }]]],
      ['ORDER BY v.vessel_name', () => [[{ id: 1, vessel_name: 'A' }]]],
    ])
    const result = await fleetService.listVessels(pool, { status: 'LAID_UP' })
    expect(result.counts).toEqual({ all: 9, ACTIVE: 8, LAID_UP: 1, UNDER_CONSTRUCTION: 0, SCRAPPED: 0 })
    expect(result.total).toBe(1)
    const rowsCall = pool.calls.find((call) => call.sql.includes('ORDER BY v.vessel_name'))
    expect(rowsCall.sql).toContain('v.status = ?')
    expect(rowsCall.params).toContain('LAID_UP')
  })

  it('lọc trạng thái lạ bị bỏ qua, không đưa vào SQL', async () => {
    const pool = fakePool([['GROUP BY v.status', () => [[]]], ['ORDER BY v.vessel_name', () => [[]]]])
    await fleetService.listVessels(pool, { status: "ACTIVE' OR 1=1" })
    expect(pool.calls.every((call) => !call.params.includes("ACTIVE' OR 1=1"))).toBe(true)
  })

  it('danh sách đối tác đếm đang hợp tác và ngừng hợp tác', async () => {
    const pool = fakePool([
      ['GROUP BY o.is_active', () => [[{ is_active: 1, n: '6' }, { is_active: 0, n: '1' }]]],
      ['ORDER BY o.company_name', () => [[]]],
    ])
    const result = await fleetService.listOwners(pool, {})
    expect(result.counts).toEqual({ all: 7, active: 6, inactive: 1 })
    expect(result.total).toBe(7)
  })
})

describe('fleet.service: người liên hệ của đối tác', () => {
  const ownerRow = [[{ id: 5, company_name: 'ACME', contacts: [] }]]
  const body = (contacts) => ({ company_name: 'ACME', contacts })
  function txPool() {
    const calls = []
    const conn = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async query(sql, params = []) {
        calls.push({ sql, params })
        return sql.startsWith('INSERT INTO ship_owner (') ? [{ insertId: 5 }] : [[]]
      },
    }
    return { calls, async getConnection() { return conn }, async query(sql) { return sql.includes('FROM ship_owner o') ? [[{ id: 5, company_name: 'ACME', contacts: [] }]] : ownerRow } }
  }
  const contactInserts = (pool) => pool.calls.filter((call) => call.sql.startsWith('INSERT INTO ship_owner_contact'))

  it('người đầu tiên là liên hệ chính khi không ai được chọn', async () => {
    const pool = txPool()
    await fleetService.createOwner(pool, body([{ name: 'An' }, { name: 'Bình' }]))
    expect(contactInserts(pool).map((call) => call.params[5])).toEqual([1, 0])
  })

  it('giữ đúng một liên hệ chính theo lựa chọn và bỏ dòng trống', async () => {
    const pool = txPool()
    await fleetService.createOwner(pool, body([{ name: 'An' }, { name: '' }, { name: 'Bình', is_primary: true }, { name: 'Chi', is_primary: true }]))
    const inserts = contactInserts(pool)
    expect(inserts.map((call) => call.params[1])).toEqual(['An', 'Bình', 'Chi'])
    expect(inserts.map((call) => call.params[5])).toEqual([0, 1, 0])
  })

  it('từ chối người liên hệ không có họ tên', async () => {
    await expect(fleetService.createOwner(txPool(), body([{ phone: '0901' }]))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('sửa chỉ danh sách liên hệ thì không cập nhật cột đối tác', async () => {
    const pool = txPool()
    await fleetService.updateOwner(pool, 5, { contacts: [{ name: 'An' }] })
    expect(pool.calls.some((call) => call.sql.startsWith('UPDATE ship_owner'))).toBe(false)
    expect(pool.calls.some((call) => call.sql.startsWith('DELETE FROM ship_owner_contact'))).toBe(true)
  })
})
