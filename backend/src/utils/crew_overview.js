// Số liệu tổng quan cho danh sách thuyền viên (màn A1): tàu đang làm, giấy tờ hết/sắp hết hạn,
// giấy tờ chờ duyệt, độ đầy đủ hồ sơ. Các biểu thức SQL dùng bí danh `s` cho bảng seafarer.

const EXPIRING_DAYS = 90

// Giấy tờ có hạn: chứng chỉ (trừ bị thu hồi) + hộ chiếu, sổ thuyền viên, giấy khám sức khỏe.
const dateCount = (cond) =>
  `(IFNULL(s.passport_expiry ${cond}, 0) + IFNULL(s.seaman_book_expiry ${cond}, 0) + IFNULL(s.medical_cert_expiry ${cond}, 0)
    + (SELECT COUNT(*) FROM seafarer_certificate sc WHERE sc.seafarer_id = s.id AND sc.status <> 'REVOKED' AND sc.expiry_date ${cond}))`

const EXPIRED_EXPR = dateCount('< CURDATE()')
const EXPIRING_EXPR = dateCount(`BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ${EXPIRING_DAYS} DAY)`)
const PENDING_EXPR = '(SELECT COUNT(*) FROM seafarer_certificate sc WHERE sc.seafarer_id = s.id AND sc.status = \'PENDING\')'

// Hợp đồng đang chạy mới nhất: tàu và ngày dự kiến rời tàu.
const activeContract = (column) =>
  `(SELECT ${column} FROM employment_contract ec JOIN vessel v ON v.id = ec.vessel_id
    WHERE ec.seafarer_id = s.id AND ec.status = 'ACTIVE' AND ec.deleted_at IS NULL
    ORDER BY ec.start_date DESC LIMIT 1)`

const OVERVIEW_FIELDS = `${activeContract('v.vessel_name')} AS vessel_name,
  ${activeContract('ec.end_date')} AS contract_end,
  ${EXPIRED_EXPR} AS expired_count,
  ${EXPIRING_EXPR} AS expiring_count,
  ${PENDING_EXPR} AS pending_review_count,
  s.passport_number, s.seaman_book_number, s.medical_cert_number, s.nationality_id, s.current_rank_id`

// Tab trạng thái trên màn A1 → điều kiện WHERE.
const TAB_CONDITIONS = {
  onboard: 's.status = \'ON_VESSEL\'',
  standby: 's.status IN (\'AVAILABLE\', \'ON_LEAVE\')',
  review: `${PENDING_EXPR} > 0`,
  expiring: `(${EXPIRED_EXPR} + ${EXPIRING_EXPR}) > 0`,
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

const HELPER_FIELDS = ['passport_number', 'seaman_book_number', 'medical_cert_number', 'nationality_id', 'current_rank_id']

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
