// Hằng số chuyến tàu và hợp đồng. Bản ESM cho frontend: frontend/src/constants/voyageContract.js (cùng nội dung).
const VOYAGE_STATUSES = ['PLANNING', 'ONBOARD', 'ENDED']
const VOYAGE_DISPLAY_STATUSES = ['RECRUITING', 'FULL', 'ONBOARD', 'ENDED']
const CONTRACT_STATUSES = ['DRAFT', 'PENDING', 'REJECTED', 'ACTIVE', 'ENDED']
const EDITABLE_CONTRACT_STATUSES = ['DRAFT', 'REJECTED']

const DEFAULT_ITEMS = [
  { code: 'BASIC_WAGE', kind: 'MONTHLY', name: 'Lương cơ bản' },
  { code: 'FIXED_OVERTIME', kind: 'MONTHLY', name: 'Làm thêm cố định' },
  { code: 'LEAVE_PAY', kind: 'MONTHLY', name: 'Lương phép' },
  { code: 'ALLOWANCE', kind: 'MONTHLY', name: 'Phụ cấp' },
  { code: 'BONUS', kind: 'MONTHLY', name: 'Thưởng' },
  { code: 'SERVICE_FEE', kind: 'MONTHLY', name: 'Phí dịch vụ' },
  { code: 'FLIGHT_OUT', kind: 'ONE_TIME', name: 'Vé máy bay đi' },
  { code: 'FLIGHT_BACK', kind: 'ONE_TIME', name: 'Vé máy bay về' },
  { code: 'VISA_FEE', kind: 'ONE_TIME', name: 'Phí visa' },
  { code: 'MEDICAL', kind: 'ONE_TIME', name: 'Khám sức khoẻ' },
  { code: 'TRAINING', kind: 'ONE_TIME', name: 'Huấn luyện/chứng chỉ' },
  { code: 'COMPLETION_BONUS', kind: 'ONE_TIME', name: 'Thưởng hoàn thành hợp đồng' },
]

const CLOSING_DAYS = [5, 10, 15, 20, 25, 31]
const PAY_DAYS = [1, 5, 10, 15, 20, 25, 31]
const PAY_MONTH_OFFSETS = [1, 2, 3]
const HOLIDAY_RULES = ['BEFORE', 'AFTER']

const DEFAULT_TERMS = {
  RECEIVABLE: { closing_day: 31, pay_day: 10, pay_month_offset: 1, holiday_rule: 'AFTER' },
  PAYABLE: { closing_day: 31, pay_day: 15, pay_month_offset: 1, holiday_rule: 'BEFORE' },
}

const DUE_SOON_DAYS = 3

// Yêu cầu thanh toán: trạng thái lưu và trạng thái hiển thị (tính từ ngày chốt sổ, hạn thanh toán).
const BILL_STATUSES = ['OPEN', 'SENT', 'PAID']
const BILL_DISPLAY_STATUSES = ['UPCOMING', 'TO_SEND', 'SENT', 'OVERDUE', 'PAID']

module.exports = {
  VOYAGE_STATUSES,
  VOYAGE_DISPLAY_STATUSES,
  CONTRACT_STATUSES,
  EDITABLE_CONTRACT_STATUSES,
  DEFAULT_ITEMS,
  CLOSING_DAYS,
  PAY_DAYS,
  PAY_MONTH_OFFSETS,
  HOLIDAY_RULES,
  DEFAULT_TERMS,
  DUE_SOON_DAYS,
  BILL_STATUSES,
  BILL_DISPLAY_STATUSES,
}
