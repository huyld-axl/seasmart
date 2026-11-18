import { expect, it } from 'vitest'
import { fleetService } from '../fleet.service'

it('tạo đối tác và liên kết tàu cùng giao dịch; ngày sai rollback, ngày đúng commit', async () => {
  for (const started_at of ['2019-01-01', '2021-01-01']) {
    const events = []
    const conn = {
      async beginTransaction() { events.push('begin') },
      async commit() { events.push('commit') },
      async rollback() { events.push('rollback') },
      release() {},
      async query(sql) {
        events.push(sql)
        if (sql.startsWith('INSERT INTO ship_owner (')) return [{ insertId: 8 }]
        if (sql.includes('SELECT id, is_active FROM ship_owner')) return [[{ id: 8, is_active: 1 }]]
        if (sql.includes('SELECT id, ship_owner_id FROM vessel')) return [[{ id: 4, ship_owner_id: 2 }]]
        if (sql.includes('SELECT started_at FROM vessel_ownership')) return [[{ started_at: '2020-01-01' }]]
        return [[]]
      },
    }
    const pool = { async getConnection() { return conn }, async query() { return [[{ id: 8, company_name: 'QA' }]] } }
    const save = fleetService.createOwner(pool, { company_name: 'QA', ownerships: [{ vessel_id: 4, expected_owner_id: 2, started_at, is_current: true }] })
    if (started_at < '2020-01-01') {
      await expect(save).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Ngày bắt đầu sở hữu mới') })
      expect(events).toContain('rollback')
      expect(events).not.toContain('commit')
      expect(events.some((s) => s.startsWith('UPDATE vessel SET'))).toBe(false)
    } else {
      await expect(save).resolves.toMatchObject({ id: 8 })
      expect(events).toContain('commit')
      expect(events.filter((s) => s === 'begin')).toHaveLength(1)
    }
  }
})
