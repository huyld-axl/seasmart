import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const api = (await import('../client')).default
const { documentApi } = await import('../documentApi')
const { seaServiceApi } = await import('../seaServiceApi')

describe('lớp gọi API giấy tờ, đi tàu, chứng chỉ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of ['get', 'post', 'put', 'delete']) api[method].mockResolvedValue({ data: { ok: true, data: [] } })
  })

  it('giấy tờ: đổi loại, chấp nhận nhanh, xác nhận chứng chỉ, ảnh trang', async () => {
    await documentApi.retype(7, 'certificate')
    expect(api.put).toHaveBeenCalledWith('/documents/7/type', { docType: 'certificate' })
    await documentApi.acceptClear(7)
    expect(api.post).toHaveBeenCalledWith('/documents/7/accept-clear', {})
    await documentApi.confirmCertificates([1, 2])
    expect(api.post).toHaveBeenCalledWith('/documents/certificates/confirm', { ids: [1, 2] })
    await documentApi.pageImage(3, 2, 'thumb')
    expect(api.get).toHaveBeenCalledWith('/documents/uploads/3/pages/2/image', { params: { size: 'thumb' }, responseType: 'blob' })
    await documentApi.decide(7, 'coc', 'edit', 'A1')
    expect(api.put).toHaveBeenCalledWith('/documents/7/fields/coc', { action: 'edit', value: 'A1' })
  })

  it('đi tàu: sửa và xoá luôn kèm lý do', async () => {
    await seaServiceApi.update(5, { rank_raw: '2/E' }, 'Sổ ghi nhầm')
    expect(api.put).toHaveBeenCalledWith('/sea-services/5', { rank_raw: '2/E', reason: 'Sổ ghi nhầm' })
    await seaServiceApi.remove(5, 'Nhập trùng')
    expect(api.delete).toHaveBeenCalledWith('/sea-services/5', { data: { reason: 'Nhập trùng' } })
    await seaServiceApi.create(2, { vessel_name_raw: 'A' })
    expect(api.post).toHaveBeenCalledWith('/seafarers/2/sea-services', { vessel_name_raw: 'A' })
    await expect(seaServiceApi.list(2)).resolves.toEqual([])
  })
})
