import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const service = require('../certificate.service')
const pool = require('../../config/db')
const { assertCertificateDates } = require('../../utils/certificate_dates')
afterEach(() => vi.restoreAllMocks())

describe('ngày chứng chỉ khi thêm/sửa', () => {
  it('chặn tạo trước khi ghi SQL nếu hạn trước ngày cấp', async () => {
    const query = vi.spyOn(pool, 'query')
    await expect(service.create(1, { issued_date: '2026-11-02', expiry_date: '2025-01-01' }, 1)).rejects.toMatchObject({ statusCode: 400, message: 'Ngày hết hạn không được trước ngày cấp' })
    expect(query).not.toHaveBeenCalled()
  })
  it.each([{ expiry_date: '2025-01-01' }, { issued_date: '2028-01-01' }])('kiểm tra dữ liệu gộp khi chỉ sửa một ngày %j', async (patch) => {
    vi.spyOn(service, 'getById').mockResolvedValue({ issued_date: '2026-01-01', expiry_date: '2027-01-01', no_expiry: 0 })
    const query = vi.spyOn(pool, 'query')
    await expect(service.update(1, 2, patch, 3)).rejects.toMatchObject({ statusCode: 400 })
    expect(query).not.toHaveBeenCalled()
  })
  it.each([
    { issued_date: '2020-01-01', expiry_date: '2021-01-01' },
    { issued_date: '2026-11-02', expiry_date: '2026-11-02' },
    { issued_date: '2026-11-02', expiry_date: null, no_expiry: true },
    { issued_date: '2026-11-02', expiry_date: '2025-01-01', no_expiry: true },
  ])('vẫn nhận giấy cũ đúng thứ tự, tròn ngày và không thời hạn %j', (data) => {
    expect(() => assertCertificateDates(data)).not.toThrow()
  })
  it.each(['2026-02-31', 'invalid', '01/11/2026'])('chặn ngày không hợp lệ khi sửa %s', (issued_date) => {
    expect(() => assertCertificateDates({ issued_date })).toThrow()
  })
  it('cho phép cập nhật hợp lệ và ghi đúng payload', async () => {
    vi.spyOn(service, 'getById').mockResolvedValue({ issued_date: '2020-01-01', expiry_date: '2021-01-01', no_expiry: 0 })
    const query = vi.spyOn(pool, 'query').mockResolvedValue([{ affectedRows: 1 }])
    const patch = { expiry_date: '2022-01-01' }
    await service.update(1, 2, patch, 3)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE seafarer_certificate'), [patch, 3, 1])
  })
})
