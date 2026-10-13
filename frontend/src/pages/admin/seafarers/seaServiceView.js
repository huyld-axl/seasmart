// Chuyến đi tàu cho tab Đi tàu (T5): sắp xếp, "đang trên tàu", "trùng thời gian", đổi sang props của
// components/ds/SeaServiceTimeline. Ngày từ API dạng yyyy-mm-dd.

const toDisplayDate = (iso) => (iso ? iso.split('-').reverse().join('/') : null)

// [bắt đầu, kết thúc]; chưa rời tàu thì mở đến vô tận. Chuyến không có ngày xuống thì không so được.
function range(trip) {
  if (!trip.sign_on_date) return null
  return [trip.sign_on_date, trip.sign_off_date || '9999-12-31']
}

// Đang trên tàu: có ngày xuống tàu và chưa có ngày rời tàu.
export const isOngoing = (trip) => Boolean(trip.sign_on_date) && !trip.sign_off_date

// Mới nhất trước; chuyến chưa có ngày xuống xuống cuối.
export function sortNewestFirst(trips) {
  return [...trips].sort((a, b) => {
    if (!a.sign_on_date && !b.sign_on_date) return b.id - a.id
    if (!a.sign_on_date) return 1
    if (!b.sign_on_date) return -1
    return b.sign_on_date.localeCompare(a.sign_on_date) || b.id - a.id
  })
}

// Trùng thời gian: hai khoảng có phần chung (chạm đầu mút không tính). Trả chuyến trùng đầu tiên theo thứ tự mới nhất.
export function findOverlap(trip, all) {
  const mine = range(trip)
  if (!mine) return null
  return sortNewestFirst(all).find((other) => {
    if (other.id === trip.id) return false
    const theirs = range(other)
    return theirs && mine[0] < theirs[1] && theirs[0] < mine[1]
  }) || null
}

const vesselSub = (trip) => [trip.vessel_type_raw, trip.flag_raw, trip.gross_tonnage_raw ? `${trip.gross_tonnage_raw} GT` : null].filter(Boolean).join(' · ')

// Trạng thái đối chiếu tàu → khoá statusMap.vessel.
const VESSEL_STATUS = { MATCHED: 'VERIFIED', NOT_FOUND: 'NOT_FOUND', NOT_CHECKED: 'NOT_CHECKED' }

// Nguồn: chuyến từ sổ thuyền viên ghi trang; nhập tay ghi "Nhập tay".
export function toTimelineTrips(trips, documentLabel = () => 'Từ sổ thuyền viên') {
  return sortNewestFirst(trips).map((trip) => {
    const other = findOverlap(trip, trips)
    return {
      id: trip.id,
      vessel: trip.vessel_name || trip.vessel_name_raw || '(chưa có tên tàu)',
      vesselSub: vesselSub(trip),
      signOn: toDisplayDate(trip.sign_on_date),
      signOff: toDisplayDate(trip.sign_off_date),
      ongoing: isOngoing(trip),
      rank: trip.rank_raw || trip.rank_code || '',
      rankName: trip.rank_name || '',
      vesselStatus: VESSEL_STATUS[trip.vessel_match_status] || 'NOT_CHECKED',
      overlapNote: other ? `Trùng với chuyến ${other.vessel_name_raw || other.vessel_name || `#${other.id}`}${other.sign_on_date ? ` từ ${toDisplayDate(other.sign_on_date)}` : ''}` : null,
      source: trip.source_type === 'DOCUMENT' ? { type: 'document', label: documentLabel(trip) } : { type: 'manual' },
      raw: trip,
    }
  })
}
