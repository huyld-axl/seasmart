// Cơ hội (một vị trí chủ tàu cần người) và chuyến (một thuyền viên đi một tàu).
// Giữ khớp với frontend/src/constants/opportunityVoyage.js.

const OPPORTUNITY_STATUSES = ['OPEN', 'WON', 'LOST', 'CANCELLED']
const OPPORTUNITY_DISPLAY_STATUSES = ['NEW', 'PICKING', 'WAITING', 'OWNER_SELECTED', 'WON', 'LOST', 'CANCELLED']
const CANDIDATE_STATUSES = ['PICKED', 'PLACED', 'NOT_SELECTED', 'REMOVED']
const CANDIDATE_SOURCES = ['SUGGEST', 'SEARCH']
const REQUIREMENT_KINDS = ['CERTIFICATE', 'EXPERIENCE', 'TEMPLATE']
const REQUIREMENT_LEVELS = ['REQUIRED', 'PREFERRED']
const VALID_UNTIL = ['JOIN', 'LEAVE', 'LEAVE_PLUS', 'ANY']
const VOYAGE_STATUSES = ['ONBOARD', 'LEFT']
const VOYAGE_SOURCES = ['OPPORTUNITY', 'MANUAL']
const MANUAL_REASONS = ['TRANSFER', 'OWNER_HIRED', 'LEGACY', 'OTHER']

// Ba giấy đọc từ cột trên bảng seafarer thay vì seafarer_certificate (mã trong certificate_type).
const SEAFARER_COLUMN_DOCS = {
  PASSPORT: { number: 'passport_number', expiry: 'passport_expiry' },
  SEAMAN_BOOK: { number: 'seaman_book_number', expiry: 'seaman_book_expiry' },
  MEDICAL_FITNESS: { number: 'medical_cert_number', expiry: 'medical_cert_expiry' },
}

const DEADLINE_WARN_DAYS = 7
const LEAVE_WARN_DAYS = 30

module.exports = {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_DISPLAY_STATUSES,
  CANDIDATE_STATUSES,
  CANDIDATE_SOURCES,
  REQUIREMENT_KINDS,
  REQUIREMENT_LEVELS,
  VALID_UNTIL,
  VOYAGE_STATUSES,
  VOYAGE_SOURCES,
  MANUAL_REASONS,
  SEAFARER_COLUMN_DOCS,
  DEADLINE_WARN_DAYS,
  LEAVE_WARN_DAYS,
}
