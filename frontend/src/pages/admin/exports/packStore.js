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
const listeners = new Set()
const emit = () => listeners.forEach((listener) => listener())
const set = (id, patch) => {
  packs = packs.map((pack) => (pack.id === id ? { ...pack, ...patch(pack) } : pack))
  emit()
}

export const signKey = (doc, who) => `${doc}|${who}`

export function signState(pack, doc, who) {
  if (pack.status === 'PENDING_APPROVAL' || pack.status === 'REJECTED') return 'wait'
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
