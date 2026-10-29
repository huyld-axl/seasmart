import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { opportunityService } = require('../opportunity.service')
const submissionService = require('../submission.service')
const { exportPackService } = require('../export_pack.service')
const emailService = require('../email.service')
const mailService = require('../opportunity_mail.service')

const user = { id: 4, email: 'sales@example.com' }
const opportunity = (overrides = {}) => ({
  status: 'OPEN',
  candidates: [
    { id: 11, seafarer_id: 1, status: 'PICKED', export_pack: { id: 101 } },
    { id: 12, seafarer_id: 2, status: 'PICKED', export_pack: null },
    { id: 13, seafarer_id: 3, status: 'REMOVED', export_pack: null },
  ],
  ...overrides,
})
const pool = { query: vi.fn().mockResolvedValue([[{ full_name: 'Nguyễn An' }]]) }
const body = { candidate_ids: [11], to: ['owner@example.com'], cc: ['sales@example.com'], bcc: ['boss@example.com'], subject: 'S', body: 'B' }

describe('gửi hồ sơ cho chủ tàu qua mail server', () => {
  let get
  let send
  let record
  beforeEach(() => {
    get = vi.spyOn(opportunityService, 'get').mockResolvedValue(opportunity())
    send = vi.spyOn(emailService, 'send').mockResolvedValue(true)
    vi.spyOn(emailService, 'isConfigured').mockReturnValue(true)
    vi.spyOn(exportPackService, 'buildZip').mockResolvedValue({ buffer: Buffer.from('zip'), filename: 'B0001 An.zip' })
    vi.spyOn(submissionService, 'ensurePack').mockResolvedValue({})
    record = vi.spyOn(opportunityService, 'recordSend').mockResolvedValue({ sends: [{ id: 9 }] })
  })
  afterEach(() => vi.restoreAllMocks())

  it('đính kèm .zip từng người, Reply-To là người gửi, rồi ghi nhận lần gửi', async () => {
    await mailService.send(pool, 5, body, user)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ['owner@example.com'], cc: ['sales@example.com'], replyTo: 'sales@example.com', bcc: ['boss@example.com'], fromName: 'Nguyễn An', subject: 'S', text: 'B',
      attachments: [expect.objectContaining({ filename: 'B0001 An.zip', contentType: 'application/zip' })],
    }))
    expect(record).toHaveBeenCalledWith(pool, 5, expect.objectContaining({ candidate_ids: [11], to_email: 'owner@example.com', subject: 'S', cc_emails: ['sales@example.com'], bcc_emails: ['boss@example.com'], body: 'B' }), 4)
  })

  it('người chưa có bộ giấy thì tạo trước khi đính kèm', async () => {
    get.mockResolvedValueOnce(opportunity()).mockResolvedValueOnce(opportunity({ candidates: [{ id: 12, seafarer_id: 2, status: 'PICKED', export_pack: { id: 102 } }] }))
    await mailService.send(pool, 5, { ...body, candidate_ids: [12] }, user)
    expect(submissionService.ensurePack).toHaveBeenCalledWith(pool, 5, 2, user)
  })

  it('đính kèm thêm tệp người dùng chọn, từ chối loại tệp lạ', async () => {
    const extra = { filename: 'bang-gia.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' }
    await mailService.send(pool, 5, body, user, [extra])
    expect(send.mock.calls[0][0].attachments).toHaveLength(2)
    expect(send.mock.calls[0][0].attachments[1]).toMatchObject({ filename: 'bang-gia.pdf' })
    await expect(mailService.send(pool, 5, body, user, [{ ...extra, filename: 'a.exe', contentType: 'application/x-msdownload' }])).rejects.toMatchObject({ statusCode: 415 })
  })

  it('đọc và kiểm tra nội dung thư từ payload JSON', () => {
    const ok = mailService.parsePayload(JSON.stringify({ candidate_ids: [11], to: ['a@b.co'], cc: [], subject: 'S', body: 'B' }))
    expect(ok).toMatchObject({ to: ['a@b.co'], cc: [], bcc: [], ship_owner_contact_id: null })
    for (const raw of ['not json', JSON.stringify({ candidate_ids: [], to: ['a@b.co'], subject: 'S', body: 'B' }), JSON.stringify({ candidate_ids: [1], to: ['sai'], subject: 'S', body: 'B' }), JSON.stringify({ candidate_ids: [1], to: [], subject: 'S', body: 'B' })]) {
      expect(() => mailService.parsePayload(raw)).toThrow()
    }
  })

  it('không ghi nhận gửi khi mail server lỗi', async () => {
    send.mockRejectedValue(new Error('connect ECONNREFUSED'))
    await expect(mailService.send(pool, 5, body, user)).rejects.toMatchObject({ statusCode: 502 })
    expect(record).not.toHaveBeenCalled()
  })

  it('từ chối khi chưa cấu hình mail server, cơ hội đã đóng, hoặc ứng viên không thuộc cơ hội', async () => {
    emailService.isConfigured.mockReturnValue(false)
    await expect(mailService.send(pool, 5, body, user)).rejects.toMatchObject({ statusCode: 503 })
    emailService.isConfigured.mockReturnValue(true)
    get.mockResolvedValue(opportunity({ status: 'LOST' }))
    await expect(mailService.send(pool, 5, body, user)).rejects.toMatchObject({ statusCode: 409 })
    get.mockResolvedValue(opportunity())
    await expect(mailService.send(pool, 5, { ...body, candidate_ids: [13] }, user)).rejects.toMatchObject({ statusCode: 400 })
    expect(send).not.toHaveBeenCalled()
  })
})
