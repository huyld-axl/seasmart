// runDaily: mỗi job ngày chạy tối đa một lần mỗi ngày, chạy bù khi lần chạy cuối là hôm trước, không chạy chồng.
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
process.env.JWT_SECRET ||= 'x'.repeat(40)
const { runDaily } = require('../jobs')

// DB giả: lastRun = ngày chạy cuối ('today' | 'yesterday' | null), locked = khoá advisory đang bị giữ.
function fakeDb({ lastRun = null, locked = false } = {}) {
  const state = { lastRun, inserts: 0, released: false }
  const client = {
    query: vi.fn(async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ ok: !locked }] }
      if (sql.includes('FROM job_run')) return { rows: state.lastRun === 'today' ? [{ '?column?': 1 }] : [] }
      if (sql.startsWith('INSERT INTO job_run')) {
        state.lastRun = 'today'
        state.inserts += 1
      }
      return { rows: [] }
    }),
    release: () => { state.released = true },
  }
  return { db: { native: { connect: async () => client } }, state }
}

describe('runDaily', () => {
  it('chạy bù khi lần chạy cuối là hôm trước, rồi ghi ngày', async () => {
    const { db, state } = fakeDb({ lastRun: 'yesterday' })
    const fn = vi.fn()
    expect(await runDaily('expire_certificates', fn, db)).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(state.inserts).toBe(1)
    expect(state.released).toBe(true)
  })

  it('không chạy lần hai trong cùng ngày', async () => {
    const { db } = fakeDb({ lastRun: 'yesterday' })
    const fn = vi.fn()
    await runDaily('notify_expiry', fn, db)
    expect(await runDaily('notify_expiry', fn, db)).toBe(false)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('không chạy khi lần khác đang giữ khoá', async () => {
    const { db } = fakeDb({ locked: true })
    const fn = vi.fn()
    expect(await runDaily('purge_trash', fn, db)).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })

  it('job lỗi thì không ghi là đã chạy, để giờ sau thử lại', async () => {
    const { db, state } = fakeDb()
    await expect(runDaily('purge_trash', async () => { throw new Error('hỏng') }, db)).rejects.toThrow('hỏng')
    expect(state.inserts).toBe(0)
    expect(state.released).toBe(true)
  })
})
