import dayjs from 'dayjs'

// Cách hiển thị một dòng thuyền viên trên màn A1 (UI Kit, tab Màn hình).

export const CREW_TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'onboard', label: 'Đang trên tàu' },
  { value: 'standby', label: 'Ở bờ' },
  { value: 'inactive', label: 'Tạm ngưng' },
]

const fmt = (date) => (date ? dayjs(date).format('DD/MM/YYYY') : null)

// Cột "Tàu đang sign on": tên tàu và hạn hợp đồng của chuyến đang đi; chỉ khi trạng thái là Đang trên tàu.
export function vesselNow(row) {
  if (row.status !== 'ON_VESSEL' || !row.vessel_name) return null
  const end = fmt(row.contract_end)
  return { vessel: row.vessel_name, vesselId: row.vessel_id ?? null, until: end ? `đến ${end}` : null }
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
