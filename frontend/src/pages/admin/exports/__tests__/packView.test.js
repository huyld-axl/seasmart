import { describe, it, expect } from 'vitest'
import { signState, signProgress, pendingInAppSigners, crewPending, PACK_TABS } from '../packView'

const pack = (status, signatures = []) => ({ status, docs: ['qddd', 'tl'], signatures })

describe('đọc bộ giấy từ API', () => {
  it('chưa duyệt thì chưa ai ký, kể cả có dữ liệu chữ ký cũ', () => {
    expect(signState(pack('PENDING_APPROVAL', [{ template_key: 'qddd', signer: 'Giám đốc' }]), 'qddd', 'Giám đốc')).toBe('wait')
  })

  it('tiến độ và người còn phải ký', () => {
    const p = pack('SIGNING', [{ template_key: 'qddd', signer: 'Giám đốc' }])
    expect(signProgress(p)).toEqual({ done: 1, total: 3 })
    expect(pendingInAppSigners(p)).toEqual(['Giám đốc'])
    expect(crewPending(p)).toBe(true)
    const all = pack('SIGNING', [{ template_key: 'qddd', signer: 'Giám đốc' }, { template_key: 'tl', signer: 'Giám đốc' }, { template_key: 'tl', signer: 'Thuyền viên' }])
    expect(pendingInAppSigners(all)).toEqual([])
    expect(crewPending(all)).toBe(false)
  })

  it('5 tab của Bản xuất', () => {
    expect(PACK_TABS.map((t) => t.value)).toEqual(['all', 'PENDING_APPROVAL', 'SIGNING', 'STALE', 'DONE'])
  })
})
