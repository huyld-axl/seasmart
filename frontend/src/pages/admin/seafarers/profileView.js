import dayjs from 'dayjs'

// Dữ liệu hiển thị cho màn A2 Hồ sơ thuyền viên (UI Kit, phương án A).

export const EXPIRING_DAYS = 90

const fmt = (date) => dayjs(date).format('DD/MM/YYYY')

// Hạn một giấy tờ so với hôm nay: EXPIRED, EXPIRING (trong 90 ngày) hoặc VALID.
export function expiryState(date, today = dayjs()) {
  if (!date) return null
  const day = dayjs(date)
  if (day.isBefore(today, 'day')) return 'EXPIRED'
  if (day.diff(today, 'day') <= EXPIRING_DAYS) return 'EXPIRING'
  return 'VALID'
}

// Mục "Cần chú ý": giấy tờ hết hạn trước, rồi sắp hết hạn, rồi chứng chỉ chờ duyệt.
export function attentionItems(seafarer, certificates = [], today = dayjs()) {
  const dated = [
    ['Hộ chiếu', seafarer?.passport_expiry],
    ['Sổ thuyền viên', seafarer?.seaman_book_expiry],
    ['Giấy khám sức khỏe', seafarer?.medical_cert_expiry],
    ...certificates
      .filter((cert) => cert.status !== 'REVOKED')
      .map((cert) => [cert.certificate_type_name || 'Chứng chỉ', cert.expiry_date]),
  ]
  const items = []
  dated.forEach(([name, date]) => {
    const state = expiryState(date, today)
    if (state === 'EXPIRED' || state === 'EXPIRING') {
      items.push({ kind: 'cert', state, text: `${name} hết hạn ${fmt(date)}`, sort: dayjs(date).valueOf() })
    }
  })
  items.sort((a, b) => (a.state === b.state ? a.sort - b.sort : a.state === 'EXPIRED' ? -1 : 1))
  const pending = certificates.filter((cert) => cert.status === 'PENDING').length
  if (pending) items.push({ kind: 'review', state: 'PENDING', text: `${pending} giấy tờ chờ duyệt` })
  return items
}

// Hợp đồng đang chạy mới nhất (dòng phụ ở đầu hồ sơ). API không trả trạng thái hợp đồng,
// nên coi là đang chạy khi đã bắt đầu và chưa có ngày rời tàu thực tế.
export function activeContract(contracts = [], today = dayjs()) {
  return contracts
    .filter((contract) => !contract.deleted_at && !contract.actual_end_date && contract.start_date && !dayjs(contract.start_date).isAfter(today, 'day'))
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0] || null
}

// Dòng phụ dưới tên: chức danh · quốc tịch · tàu hoặc tình trạng sẵn sàng.
export function headLine(seafarer, contract) {
  const parts = [seafarer?.rank_name, seafarer?.nationality_name]
  if (contract?.vessel_name) {
    parts.push(contract.end_date ? `${contract.vessel_name} · đến ${fmt(contract.end_date)}` : contract.vessel_name)
  }
  return parts.filter(Boolean).join(' · ')
}

// Mở hộp chọn tệp của khung thả giấy tờ đang hiện trong trang.
export function openFilePicker(root) {
  root?.querySelector('.crew-wow input[type="file"]')?.click()
}
