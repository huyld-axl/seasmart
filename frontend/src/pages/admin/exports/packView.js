import { template, packSignatures } from './packModel'

// Đọc một bộ giấy trả về từ API: ai đã ký giấy nào, tiến độ, tab danh sách.

export const SELF_SIGN = 'Thuyền viên' // ký qua link SMS, không ký trong app

export function signState(pack, doc, who) {
  if (!['SIGNING', 'DONE'].includes(pack.status)) return 'wait'
  return pack.signatures?.some((s) => s.template_key === doc && s.signer === who) ? 'done' : 'wait'
}

export function signProgress(pack) {
  const all = packSignatures(pack.docs)
  return { done: all.filter(({ doc, who }) => signState(pack, doc, who) === 'done').length, total: all.length }
}

// Vai ký trong app còn phải ký ít nhất một giấy.
export function pendingInAppSigners(pack) {
  const signers = [...new Set(pack.docs.flatMap((key) => template(key).signers))].filter((who) => who !== SELF_SIGN)
  return signers.filter((who) => pack.docs.some((key) => template(key).signers.includes(who) && signState(pack, key, who) !== 'done'))
}

export function crewPending(pack) {
  return pack.docs.some((key) => template(key).signers.includes(SELF_SIGN) && signState(pack, key, SELF_SIGN) !== 'done')
}

export const PACK_TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'SIGNING', label: 'Đang ký' },
  { value: 'STALE', label: 'Cần làm lại' },
  { value: 'DONE', label: 'Đã xong' },
]

export const signLink = (token) => `${window.location.origin}/sign/${token}`
