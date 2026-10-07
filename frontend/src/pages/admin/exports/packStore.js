import { useSyncExternalStore } from 'react'
import { packSignatures, template } from './packModel'

// Kho bộ giấy tạm trong bộ nhớ trình duyệt: chưa có backend xuất bộ giấy và ký.
// Tải lại trang là mất. Khi có API, thay các hàm dưới đây bằng lời gọi API, giữ nguyên tên.

const SELF_SIGN = 'Thuyền viên' // ký qua link SMS, không ký trong app

let packs = [
  {
    id: 'B0042',
    seafarerId: null,
    seafarerName: 'Trần Minh Khôi',
    snapshot: { full_name: 'Trần Minh Khôi', date_of_birth: '1990-03-13', rank_name: 'Thợ máy chính (Oiler)' },
    title: 'Bộ giấy lên tàu',
    docs: ['qddd', 'bhxh', 'bl', 'uqcn', 'uql'],
    inputs: { 'Tên tàu': 'MV Lotus Pearl', 'Ngày xuống tàu': '20/10/2026' },
    status: 'PENDING_APPROVAL',
    createdBy: 'Lê Thu Hà',
    createdAt: '2026-10-07T10:58:00',
    signs: {},
    demo: true,
  },
]

// Thêm vài bộ mẫu ở các trạng thái khác để màn Bản xuất có đủ dạng (dữ liệu giả).
const demo = (id, seafarerName, rank, title, docs, status, createdBy, createdAt, extra = {}) => ({
  id, seafarerId: null, seafarerName, title, docs, status, createdBy, createdAt, demo: true,
  snapshot: { full_name: seafarerName, date_of_birth: '1988-02-10', rank_name: rank },
  inputs: {}, signs: {}, ...extra,
})
packs = packs.concat([
  demo('B0041', 'Phạm Quốc Bảo', 'Bosun', 'Bộ giấy lên tàu', ['qddd', 'bhxh', 'uql'], 'SIGNING', 'Lê Thu Hà', '2026-10-07T09:30:00', { signs: { 'qddd|Giám đốc': 'done' } }),
  demo('B0039', 'Võ Thanh Sơn', 'Chief Officer (CO)', 'Bộ giấy tuyển dụng', ['kq', 'tb', 'cv', 'pt'], 'STALE', 'Lê Thu Hà', '2026-10-04T15:10:00', { staleReason: 'Hồ sơ đổi chức danh sau khi tạo bộ' }),
  demo('B0038', 'Đào Văn Hùng', 'Second Engineer (2/E)', 'Bộ giấy rời tàu', ['qdrt', 'tl'], 'DONE', 'Lê Thu Hà', '2026-10-04T08:20:00', { signs: { 'qdrt|Giám đốc': 'done', 'tl|Thuyền viên': 'done', 'tl|Giám đốc': 'done' } }),
  demo('B0036', 'Lê Văn Đức', 'Chief Engineer (CE)', 'Bộ giấy tuyển dụng', ['kq', 'tb'], 'REJECTED', 'Lê Thu Hà', '2026-10-03T11:00:00', { rejectReason: 'Thiếu điểm thi tuyển của giám khảo 2' }),
])
const listeners = new Set()
const emit = () => listeners.forEach((listener) => listener())
const set = (id, patch) => {
  packs = packs.map((pack) => (pack.id === id ? { ...pack, ...patch(pack) } : pack))
  emit()
}

export const signKey = (doc, who) => `${doc}|${who}`

export function signState(pack, doc, who) {
  if (['PENDING_APPROVAL', 'REJECTED', 'STALE'].includes(pack.status)) return 'wait'
  return pack.signs[signKey(doc, who)] || 'wait'
}

export function signProgress(pack) {
  const all = packSignatures(pack.docs)
  const done = all.filter(({ doc, who }) => pack.signs[signKey(doc, who)] === 'done').length
  return { done, total: all.length }
}

function nextId() {
  const max = packs.reduce((top, pack) => Math.max(top, Number(pack.id.slice(1)) || 0), 0)
  return `B${String(max + 1).padStart(4, '0')}`
}

export const packStore = {
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
  all: () => packs,
  get: (id) => packs.find((pack) => pack.id === id) || null,

  create({ seafarerId, seafarerName, snapshot, docs, inputs, createdBy }) {
    const stages = [...new Set(docs.map((key) => template(key).stage))]
    const title = stages.length === 1 ? { tuyen: 'Bộ giấy tuyển dụng', 'di-tau': 'Bộ giấy lên tàu', 'roi-tau': 'Bộ giấy rời tàu' }[stages[0]] : 'Bộ giấy'
    const pack = { id: nextId(), seafarerId, seafarerName, snapshot, title, docs, inputs, status: 'PENDING_APPROVAL', createdBy, createdAt: new Date().toISOString(), signs: {} }
    packs = [pack, ...packs]
    emit()
    return pack
  },

  approve(id) { set(id, () => ({ status: 'SIGNING' })) },
  reject(id, reason) { set(id, () => ({ status: 'REJECTED', rejectReason: reason })) },

  // Ký mọi giấy trong bộ mà người này cần ký (người ký trong app).
  signAs(id, who) {
    set(id, (pack) => {
      const signs = { ...pack.signs }
      packSignatures(pack.docs).filter((s) => s.who === who).forEach((s) => { signs[signKey(s.doc, s.who)] = 'done' })
      const done = packSignatures(pack.docs).every((s) => signs[signKey(s.doc, s.who)] === 'done')
      return { signs, status: done ? 'DONE' : 'SIGNING' }
    })
  },
}

export { SELF_SIGN }

export function usePacks() {
  return useSyncExternalStore(packStore.subscribe, packStore.all)
}

export function usePack(id) {
  return useSyncExternalStore(packStore.subscribe, () => packStore.get(id))
}

// Tab của màn Bản xuất (C1).
export const PACK_TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'SIGNING', label: 'Đang ký' },
  { value: 'STALE', label: 'Cần làm lại' },
  { value: 'DONE', label: 'Đã xong' },
]

export function filterPacks(list, tab, search) {
  const q = search.trim().toLowerCase()
  return list.filter((pack) => (tab === 'all' || pack.status === tab)
    && (!q || `${pack.seafarerName} ${pack.id} ${pack.title}`.toLowerCase().includes(q)))
}

export function countByTab(list) {
  return Object.fromEntries(PACK_TABS.map((t) => [t.value, t.value === 'all' ? list.length : list.filter((p) => p.status === t.value).length]))
}

// Giấy thuyền viên cần ký online (C2).
export function crewDocs(pack) {
  return pack.docs.filter((key) => template(key).signers.includes(SELF_SIGN))
}
