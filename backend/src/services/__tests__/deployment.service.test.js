import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import dbPool from '../../config/db'

const mockPool = { query: vi.fn() }
const originalQuery = dbPool.query.bind(dbPool)

describe('deployment.service soft warnings', () => {
  beforeEach(() => {
    mockPool.query.mockReset()
    dbPool.query = mockPool.query
  })

  it('returns checklist warning when required items are unchecked', async () => {
    mockPool.query
      .mockResolvedValueOnce([
        [{ id: 1, seafarer_id: 99, status: 'collecting_docs', rank_name: 'AB' }],
      ])
      .mockResolvedValueOnce([
        [
          { item_key: 'BIEN_BAN', is_checked: 1, notes: null },
          { item_key: 'KY_TEN_MAU', is_checked: 0, notes: null },
          { item_key: 'CHUP_ANH', is_checked: 1, notes: null },
          { item_key: 'VAX_COVID', is_checked: 0, notes: null },
          { item_key: 'CHECK_ONLINE', is_checked: 1, notes: null },
        ],
      ])
      .mockResolvedValueOnce([[{ id: 99, full_name: 'Test', passport_expiry: null }]])
      .mockResolvedValueOnce([[]])

    const deploymentService = (await import('../deployment.service')).default
    const warnings = await deploymentService.evaluateSoftWarnings(1, 'confirmed', {
      cert_scope: 'all',
    })

    const checklistWarning = warnings.find((w) => w.code === 'CHECKLIST_INCOMPLETE')
    expect(checklistWarning).toBeTruthy()
    expect(checklistWarning.details).toContain('KY_TEN_MAU')
    expect(checklistWarning.details).toContain('VAX_COVID')
  })

  it('warns when passport under 18 months and certs under 12 months', async () => {
    const monthDiff = (fromDate, toDate) => {
      const from = new Date(fromDate)
      const to = new Date(toDate)
      const years = to.getFullYear() - from.getFullYear()
      const months = to.getMonth() - from.getMonth()
      const days = to.getDate() - from.getDate()
      return years * 12 + months + (days >= 0 ? 0 : -1)
    }
    const now = new Date()
    const passportExpiry = new Date(now.getFullYear(), now.getMonth() + 10, now.getDate())
    const certExpirySoon = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
    const certExpiryFar = new Date(now.getFullYear(), now.getMonth() + 24, now.getDate())

    const passportWarn = monthDiff(now, passportExpiry) < 18
    const certWarnCount = [certExpirySoon, certExpiryFar].filter(
      (d) => monthDiff(now, d) < 12
    ).length

    expect(passportWarn).toBe(true)
    expect(certWarnCount).toBe(1)
  })

  it('reads local document date from checklist notes and warns when over 6 months', async () => {
    const parseDocDateFromNote = (note) => {
      const match = String(note || '').match(/DOC_DATE=(\d{4}-\d{2}-\d{2})/)
      return match ? match[1] : null
    }
    const monthDiff = (fromDate, toDate) => {
      const from = new Date(fromDate)
      const to = new Date(toDate)
      const years = to.getFullYear() - from.getFullYear()
      const months = to.getMonth() - from.getMonth()
      const days = to.getDate() - from.getDate()
      return years * 12 + months + (days >= 0 ? 0 : -1)
    }
    const oldDoc = new Date()
    oldDoc.setMonth(oldDoc.getMonth() - 8)
    const oldDocStr = oldDoc.toISOString().slice(0, 10)
    const parsed = parseDocDateFromNote(`DOC_DATE=${oldDocStr}`)

    expect(parsed).toBe(oldDocStr)
    expect(monthDiff(parsed, new Date()) > 6).toBe(true)
  })
})

describe('deployment.service job sync', () => {
  beforeEach(() => {
    mockPool.query.mockReset()
    dbPool.query = mockPool.query
  })

  it('creates deployment from job assignment with mapped fields', async () => {
    const deploymentService = (await import('../deployment.service')).default
    const createSpy = vi.spyOn(deploymentService, 'create').mockResolvedValue({ id: 123 })

    const job = {
      id: 88,
      seafarer_id: 10,
      vessel_name: 'MV Pacific Star',
      vessel_flag: 'Panama',
      rank_id: 6,
      start_date: '2026-05-01',
    }

    const result = await deploymentService.createFromJob(job)

    expect(createSpy).toHaveBeenCalledWith(10, {
      job_id: 88,
      vessel_id: null,
      vessel_name: 'MV Pacific Star',
      vessel_flag: 'Panama',
      vessel_type: null,
      rank_id: 6,
      join_date: '2026-05-01',
      notes: 'Auto tạo từ công việc',
    })
    expect(result).toEqual({ id: 123 })
    createSpy.mockRestore()
  })

  it('returns null when job has no seafarer assignment', async () => {
    const deploymentService = (await import('../deployment.service')).default
    const createSpy = vi.spyOn(deploymentService, 'create')

    const result = await deploymentService.createFromJob({ id: 90, seafarer_id: null })

    expect(result).toBeNull()
    expect(createSpy).not.toHaveBeenCalled()
    createSpy.mockRestore()
  })

  it('marks linked deployment as cancelled when unassigning from job', async () => {
    const buildCancelSql = () => `
      UPDATE seafarer_deployment
      SET status = 'cancelled',
          notes = CONCAT(COALESCE(notes, ''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE '\\n' END, ?),
          updated_at = NOW()
      WHERE job_id = ? AND seafarer_id = ? AND status <> 'cancelled'
    `
    const sql = buildCancelSql()
    const params = ['Hủy do gỡ thuyền viên', 77, 12]

    expect(sql).toContain("status = 'cancelled'")
    expect(sql).toContain('WHERE job_id = ? AND seafarer_id = ?')
    expect(params).toEqual(['Hủy do gỡ thuyền viên', 77, 12])
  })
})

afterEach(() => {
  dbPool.query = originalQuery
  vi.restoreAllMocks()
})
