import dayjs from 'dayjs'

// Cách hiển thị một dòng thuyền viên trên màn A1 (UI Kit, tab Màn hình).

export const CREW_TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'onboard', label: 'Đang trên tàu' },
  { value: 'standby', label: 'Chờ tàu' },
  { value: 'review', label: 'Chờ duyệt' },
  { value: 'expiring', label: 'Sắp hết hạn' },
]

const fmt = (date) => (date ? dayjs(date).format('DD/MM/YYYY') : null)

// Cột "Tàu / sẵn sàng".
export function availabilityText(row) {
  if (row.status === 'ON_VESSEL') {
    const end = fmt(row.contract_end)
    if (!row.vessel_name) return 'Đang trên tàu'
    return end ? `${row.vessel_name} · đến ${end}` : row.vessel_name
  }
  if (row.status === 'AVAILABLE') return 'Sẵn sàng'
  if (row.status === 'ON_LEAVE') return 'Đang nghỉ phép'
  return '—'
}

// Cột "Giấy tờ": hết hạn trước, rồi sắp hết hạn, còn lại là còn hạn.
export function docsAlert(row) {
  if (row.expired_count > 0) return { tone: 'error', text: `${row.expired_count} giấy tờ hết hạn` }
  if (row.expiring_count > 0) return { tone: 'warning', text: `${row.expiring_count} sắp hết hạn` }
  return { tone: 'muted', text: 'Còn hạn' }
}

// Chữ trong ô avatar: chữ đầu của tên đệm cuối và tên ("Trần Minh Khôi" → "MK").
export function nameInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const picked = parts.length === 1 ? parts : parts.slice(-2)
  return picked.map((part) => part[0]).join('').toUpperCase()
}
