// Chuyến tàu cho tab Đi tàu: đổi chuyến của hệ thống (GET /voyages?seafarer_id=) sang props của
// components/ds/SeaServiceTimeline, mới nhất trước theo ngày lên tàu. Ngày từ API dạng yyyy-mm-dd.

const toDisplayDate = (iso) => (iso ? iso.split('-').reverse().join('/') : null)

export function voyageTrips(voyages = []) {
  return voyages
    .map((v) => ({
      id: `v${v.id}`,
      vessel: v.vessel_name,
      vesselSub: v.ship_owner_name || '',
      signOn: toDisplayDate(String(v.join_date).slice(0, 10)),
      signOff: v.leave_date ? toDisplayDate(String(v.leave_date).slice(0, 10)) : null,
      ongoing: !v.leave_date,
      rank: v.rank_name || '',
      source: { label: v.code },
      sortDate: String(v.join_date).slice(0, 10),
      raw: v,
    }))
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate) || b.raw.id - a.raw.id)
}
