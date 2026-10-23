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

// Hợp đồng Hiệu lực của chuyến đang trên tàu (ONBOARD), mới nhất: tàu và ngày kết thúc hợp đồng.
// Chỉ chuyến đã bắt đầu mới tính, cùng điều kiện với việc chuyển seafarer.status sang ON_VESSEL (bắt đầu chuyến, duyệt hợp đồng).
const activeContract = (column) =>
  `(SELECT ${column} FROM seafarer_contract ec
    JOIN voyage_position vp ON vp.id = ec.voyage_position_id
    JOIN voyage vy ON vy.id = vp.voyage_id
    JOIN vessel v ON v.id = vy.vessel_id
    WHERE ec.seafarer_id = s.id AND ec.status = 'ACTIVE' AND ec.deleted_at IS NULL AND vy.status = 'ONBOARD'
    ORDER BY ec.start_date DESC LIMIT 1)`

const OVERVIEW_FIELDS = `${activeContract('v.vessel_name')} AS vessel_name,
  ${activeContract('v.id')} AS vessel_id,
  ${activeContract('ec.end_date')} AS contract_end,
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
