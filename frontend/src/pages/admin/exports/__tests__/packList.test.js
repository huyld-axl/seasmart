import { describe, it, expect } from 'vitest'
import { PACK_TABS, countByTab, filterPacks, crewDocs, packStore } from '../packStore'

const list = [
  { id: 'B1', seafarerName: 'Trần Minh Khôi', title: 'Bộ giấy lên tàu', status: 'SIGNING' },
  { id: 'B2', seafarerName: 'Võ Thanh Sơn', title: 'Bộ giấy tuyển dụng', status: 'STALE' },
  { id: 'B3', seafarerName: 'Trần Văn A', title: 'Bộ giấy', status: 'SIGNING' },
]

describe('màn Bản xuất', () => {
  it('đếm theo tab', () => {
    expect(PACK_TABS.map((t) => t.label)).toEqual(['Tất cả', 'Chờ duyệt', 'Đang ký', 'Cần làm lại', 'Đã xong'])
    expect(countByTab(list)).toEqual({ all: 3, PENDING_APPROVAL: 0, SIGNING: 2, STALE: 1, DONE: 0 })
  })

  it('lọc theo tab và tìm theo tên hoặc mã, không phân biệt hoa thường', () => {
    expect(filterPacks(list, 'SIGNING', '').map((p) => p.id)).toEqual(['B1', 'B3'])
    expect(filterPacks(list, 'all', 'trần').map((p) => p.id)).toEqual(['B1', 'B3'])
    expect(filterPacks(list, 'SIGNING', 'b3').map((p) => p.id)).toEqual(['B3'])
  })

  it('có đủ 5 bộ mẫu ở các trạng thái', () => {
    expect(new Set(packStore.all().map((p) => p.status))).toEqual(new Set(['PENDING_APPROVAL', 'SIGNING', 'STALE', 'DONE', 'REJECTED']))
  })
})

describe('ký online', () => {
  it('chỉ lấy giấy thuyền viên phải ký', () => {
    expect(crewDocs({ docs: ['qddd', 'bhxh', 'bl', 'uql'] })).toEqual(['bhxh', 'uql'])
  })
})
