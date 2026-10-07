import { describe, it, expect } from 'vitest'
import { packStore, signProgress, signState } from '../packStore'

describe('packStore (tạm, chưa có backend)', () => {
  it('tạo → chờ duyệt → duyệt → ký đủ thì xong', () => {
    const pack = packStore.create({ seafarerId: '1', seafarerName: 'A', docs: ['qddd', 'tl'], inputs: {}, createdBy: 'x@demo' })
    expect(pack.status).toBe('PENDING_APPROVAL')
    expect(pack.title).toBe('Bộ giấy')
    expect(signState(pack, 'qddd', 'Giám đốc')).toBe('wait')
    packStore.approve(pack.id)
    packStore.signAs(pack.id, 'Giám đốc')
    let now = packStore.get(pack.id)
    expect(now.status).toBe('SIGNING')
    expect(signProgress(now)).toEqual({ done: 2, total: 3 })
    packStore.signAs(pack.id, 'Thuyền viên')
    now = packStore.get(pack.id)
    expect(now.status).toBe('DONE')
  })

  it('trả lại giữ lý do; mã bộ tăng dần', () => {
    const a = packStore.create({ docs: ['qddd'], inputs: {}, createdBy: 'x' })
    const b = packStore.create({ docs: ['qddd'], inputs: {}, createdBy: 'x' })
    expect(Number(b.id.slice(1))).toBe(Number(a.id.slice(1)) + 1)
    expect(a.title).toBe('Bộ giấy lên tàu')
    packStore.reject(a.id, 'Thiếu thư bảo lãnh')
    expect(packStore.get(a.id)).toMatchObject({ status: 'REJECTED', rejectReason: 'Thiếu thư bảo lãnh' })
  })
})
