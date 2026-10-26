// Số liệu tổng quan cho danh sách thuyền viên (màn A1): tàu đang làm, giấy tờ hết/sắp hết hạn,
// giấy tờ chờ duyệt, độ đầy đủ hồ sơ. Các biểu thức SQL dùng bí danh `s` cho bảng seafarer.

const EXPIRING_DAYS = 60

// Giấy tờ có hạn: chứng chỉ (trừ bị thu hồi) + hộ chiếu, sổ thuyền viên, giấy khám sức khỏe.
const dateCount = (cond) =>
  `(COALESCE((s.passport_expiry ${cond})::integer, 0) + COALESCE((s.seaman_book_expiry ${cond})::integer, 0) + COALESCE((s.medical_cert_expiry ${cond})::integer, 0)
    + (SELECT COUNT(*) FROM seafarer_certificate sc WHERE sc.seafarer_id = s.id AND sc.status <> 'REVOKED' AND sc.expiry_date ${cond}))`

const EXPIRED_EXPR = dateCount('< CURRENT_DATE')
const EXPIRING_EXPR = dateCount(`BETWEEN CURRENT_DATE AND (CURRENT_DATE + (${EXPIRING_DAYS} * INTERVAL '1 day'))`)
const PENDING_EXPR = '(SELECT COUNT(*) FROM seafarer_certificate sc WHERE sc.seafarer_id = s.id AND sc.status = \'PENDING\')'

// Tàu đang làm: chuyến mới đang trên tàu (seafarer_voyage, mỗi người tối đa một).
const onboardVoyage = (column) =>
  `(SELECT ${column} FROM seafarer_voyage sv JOIN vessel v ON v.id = sv.vessel_id
    WHERE sv.seafarer_id = s.id AND sv.status = 'ONBOARD' AND sv.deleted_at IS NULL LIMIT 1)`
// Hết hạn: hợp đồng Hiệu lực gắn với chuyến đó (dữ liệu cũ), không có thì ngày rời dự kiến của chuyến.
const CONTRACT_END = `(SELECT COALESCE(ec.end_date, sv.planned_leave_date) FROM seafarer_voyage sv
    LEFT JOIN seafarer_contract ec ON ec.id = sv.legacy_contract_id AND ec.status = 'ACTIVE' AND ec.deleted_at IS NULL
    WHERE sv.seafarer_id = s.id AND sv.status = 'ONBOARD' AND sv.deleted_at IS NULL LIMIT 1)`

const OVERVIEW_FIELDS = `${onboardVoyage('v.vessel_name')} AS vessel_name,
  ${onboardVoyage('v.id')} AS vessel_id,
  ${CONTRACT_END} AS contract_end,
  ${EXPIRED_EXPR} AS expired_count,
  ${EXPIRING_EXPR} AS expiring_count,
  ${PENDING_EXPR} AS pending_review_count,
  s.passport_number, s.seaman_book_number, s.medical_cert_number, s.nationality_id, s.current_rank_id`

// Tab trạng thái trên màn A1 → điều kiện WHERE.
const TAB_CONDITIONS = {
  onboard: 's.status = \'ON_VESSEL\'',
  standby: 's.status = \'AVAILABLE\'',
  inactive: 's.status = \'INACTIVE\'',
}
const TABS = Object.keys(TAB_CONDITIONS)

// Trường tính vào độ đầy đủ hồ sơ.
const COMPLETENESS_FIELDS = [
  'national_id',
  'date_of_birth',
  'nationality_id',
  'phone_primary',
  'current_rank_id',
  'passport_number',
  'seaman_book_number',
  'medical_cert_number',
]

function completeness(row) {
  const filled = COMPLETENESS_FIELDS.filter((field) => row[field] !== null && row[field] !== undefined && row[field] !== '').length
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100)
}

const HELPER_FIELDS = ['seaman_book_number', 'medical_cert_number', 'nationality_id', 'current_rank_id']

// Bỏ cột chỉ dùng để tính, giữ số liệu dạng số.
function shapeRow(row) {
  const rest = { ...row }
  HELPER_FIELDS.forEach((field) => delete rest[field])
  return {
    ...rest,
    expired_count: Number(row.expired_count) || 0,
    expiring_count: Number(row.expiring_count) || 0,
    pending_review_count: Number(row.pending_review_count) || 0,
    completeness: completeness(row),
  }
}

module.exports = { OVERVIEW_FIELDS, TAB_CONDITIONS, TABS, EXPIRING_DAYS, completeness, shapeRow }
