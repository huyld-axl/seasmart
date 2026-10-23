import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { fleetService } = require('../fleet.service')
function transaction({ current = 2, active = 1, exists = true } = {}) {
  const events = []
  const conn = {
    async beginTransaction() { events.push('begin') }, async commit() { events.push('commit') }, async rollback() { events.push('rollback') }, release() {},
    async query(sql, params) {
      events.push({ sql, params })
      if (sql.includes('FROM ship_owner')) return [[{ id: 5, is_active: active }]]
      if (sql.includes('FROM vessel')) return [exists ? [{ id: 8, ship_owner_id: current }] : []]
      return [{ affectedRows: 1 }]
    },
  }
  return { events, async getConnection() { return conn } }
}
describe('liên kết tàu với đối tác', () => {
  it('chuyển chủ đã xác nhận trong transaction có khoá tàu', async () => {
    const pool = transaction()
    await fleetService.linkOwnerVessel(pool, 5, { vessel_id: 8, expected_owner_id: 2 })
    expect(pool.events.find((event) => event.sql?.startsWith('UPDATE')).params).toEqual([5, 8])
    expect(pool.events.some((event) => event.sql?.includes('FOR UPDATE'))).toBe(true)
    expect(pool.events).toContain('commit')
  })
  it('không ghi đè khi chủ tàu vừa thay đổi', async () => {
    const pool = transaction({ current: 3 })
    await expect(fleetService.linkOwnerVessel(pool, 5, { vessel_id: 8, expected_owner_id: 2 })).rejects.toMatchObject({ statusCode: 409 })
    expect(pool.events.some((event) => event.sql?.startsWith('UPDATE'))).toBe(false)
    expect(pool.events).toContain('rollback')
  })
  it('tàu đã liên kết không tạo thêm lần chuyển chủ', async () => {
    const pool = transaction({ current: 5 })
    await fleetService.linkOwnerVessel(pool, 5, { vessel_id: 8, expected_owner_id: 5 })
    expect(pool.events.some((event) => event.sql?.startsWith('UPDATE'))).toBe(false)
  })
  it('không liên kết với đối tác ngừng hợp tác', async () => {
    await expect(fleetService.linkOwnerVessel(transaction({ active: 0 }), 5, { vessel_id: 8, expected_owner_id: 2 })).rejects.toMatchObject({ statusCode: 409 })
  })
  it('trả 404 cho tàu không tồn tại', async () => {
    await expect(fleetService.linkOwnerVessel(transaction({ exists: false }), 5, { vessel_id: 8, expected_owner_id: null })).rejects.toMatchObject({ statusCode: 404 })
  })
})
