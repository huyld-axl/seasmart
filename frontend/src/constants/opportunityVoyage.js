// Cơ hội và chuyến. Bản CommonJS cho backend: backend/src/constants/opportunity_voyage.js (cùng giá trị).
export const OPPORTUNITY_TABS = ['open', 'won', 'lost', 'cancelled', 'all']
export const REQUIREMENT_KINDS = ['CERTIFICATE', 'EXPERIENCE', 'TEMPLATE']
export const REQUIREMENT_LEVELS = ['REQUIRED', 'PREFERRED']
export const VALID_UNTIL = ['JOIN', 'LEAVE', 'LEAVE_PLUS', 'ANY']
export const VOYAGE_TABS = ['onboard', 'left', 'all']
export const VOYAGE_SOURCES = ['OPPORTUNITY', 'MANUAL']
export const MANUAL_REASONS = ['TRANSFER', 'OWNER_HIRED', 'LEGACY', 'OTHER']
export const DEADLINE_WARN_DAYS = 7
export const LEAVE_WARN_DAYS = 30
export const MAILTO_MAX = 1800

export const OPPORTUNITY_TAB_LABELS = { open: 'Đang mở', won: 'Đã chốt', lost: 'Không thành', cancelled: 'Huỷ', all: 'Tất cả' }
export const VOYAGE_TAB_LABELS = { onboard: 'Đang trên tàu', left: 'Đã rời tàu', all: 'Tất cả' }
export const LEVEL_LABELS = { REQUIRED: 'Bắt buộc', PREFERRED: 'Nên có' }
export const VALID_UNTIL_LABELS = { JOIN: 'Còn hạn tới ngày xuống', LEAVE: 'Còn hạn tới ngày rời', LEAVE_PLUS: 'Còn hạn tới ngày rời + N tháng', ANY: 'Có là được' }
export const MANUAL_REASON_LABELS = { TRANSFER: 'Chuyển tàu', OWNER_HIRED: 'Chủ tàu tự tuyển', LEGACY: 'Nhập chuyến cũ', OTHER: 'Khác' }
export const SOURCE_LABELS = { OPPORTUNITY: 'Từ cơ hội', MANUAL: 'Tạo tay' }
