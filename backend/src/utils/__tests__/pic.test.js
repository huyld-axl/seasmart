import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { resolvePic, assertAssignable, ownSql, picFilter, picOf } = require('../pic')
const { contractBillService } = require('../../services/contract_bill.service')

// Kết nối giả: chỉ tài khoản trong `active` là đang hoạt động.
function fakeConn(active, routes = []) {
  const calls = []
  const query = async (sql, params = []) => {
    calls.push({ sql, params })
    const hit = routes.find(([needle]) => sql.includes(needle))
    if (hit) return hit[1](sql, params)
    if (sql.includes('FROM "user" WHERE id IN') && sql.includes('is_active')) return [params[0].filter((id) => active.includes(id)).map((id) => ({ id }))]
    if (sql.includes('FROM "user" WHERE id = ?')) return [active.includes(params[0]) ? [{ id: params[0] }] : []]
    return [[]]
  }
  return { calls, query, getConnection: async () => ({ query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} }) }
}

describe('người phụ trách', () => {
  it('lấy người đầu tiên còn hoạt động, bỏ qua trống và tài khoản đã khoá', async () => {
    expect(await resolvePic(fakeConn([3, 5]), [null, 9, 5, 3])).toBe(5)
    expect(await resolvePic(fakeConn([]), [9])).toBeNull()
    expect(await resolvePic(fakeConn([1]), [null, undefined])).toBeNull()
  })

  it('không giao cho tài khoản đã khoá', async () => {
    await expect(assertAssignable(fakeConn([3]), 9)).rejects.toMatchObject({ statusCode: 400 })
    await expect(assertAssignable(fakeConn([3]), 3)).resolves.toBeUndefined()
  })

  it('lọc: id, chưa giao, giá trị lạ bỏ qua', () => {
    const params = []
    expect(picFilter('b', '7', params)).toBe(' AND b.pic_user_id = ?')
    expect(params).toEqual([7])
    expect(picFilter('b', 'none', params)).toBe(' AND b.pic_user_id IS NULL')
    expect(picFilter('b', 'abc', params)).toBe('')
    expect(picFilter('b', undefined, params)).toBe('')
    expect(params).toEqual([7])
    expect(ownSql('c')).toBe('(c.created_by = ? OR c.pic_user_id = ?)')
  })

  it('dạng trả về', () => {
    expect(picOf({ pic_id: null })).toBeNull()
    expect(picOf({ pic_id: 4, pic_name: 'Lan', pic_is_active: 0 })).toEqual({ id: 4, name: 'Lan', is_active: false })
  })

  it('đổi người phụ trách bill: ghi ASSIGN, không ghi UPDATE, không đổi updated_by', async () => {
    const pool = fakeConn([7], [
      ['SELECT id, pic_user_id FROM contract_bill', () => [[{ id: 20, pic_user_id: 3 }]]],
      ['COALESCE(full_name, email) AS name FROM "user" WHERE id IN', () => [[{ id: 3, name: 'Lan' }, { id: 7, name: 'Minh' }]]],
      ['FROM contract_bill b', () => [[]]],
    ])
    await contractBillService.assignPic(pool, 20, 7, 5).catch(() => {})
    const update = pool.calls.find((c) => c.sql.startsWith('UPDATE contract_bill'))
    expect(update.sql).toBe('UPDATE contract_bill SET pic_user_id = ? WHERE id = ?')
    expect(update.params).toEqual([7, 20])
    const logs = pool.calls.filter((c) => c.sql.startsWith('INSERT INTO contract_bill_log')).map((c) => c.params[0])
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('ASSIGN')
    expect(JSON.parse(logs[0].payload)).toEqual({ from: { id: 3, name: 'Lan' }, to: { id: 7, name: 'Minh' } })
  })

  it('đổi sang tài khoản đã khoá: 400, không ghi gì', async () => {
    const pool = fakeConn([], [['SELECT id, pic_user_id FROM contract_bill', () => [[{ id: 20, pic_user_id: 3 }]]]])
    await expect(contractBillService.assignPic(pool, 20, 9, 5)).rejects.toMatchObject({ statusCode: 400 })
    expect(pool.calls.some((c) => c.sql.startsWith('UPDATE contract_bill'))).toBe(false)
  })
})
