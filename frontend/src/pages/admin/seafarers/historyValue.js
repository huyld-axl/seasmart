import { STATUS } from '../../../components/ds/statusMap'

// Dùng chung cho lịch sử trên màn hình và file log tải xuống.
export function historyValue(field, value, partner = false) {
  if (value === null || value === undefined || value === '') return 'trống'
  if (partner && field === 'is_active') {
    if ([1, '1', true, 'ACTIVE'].includes(value)) return STATUS.partner.ACTIVE.label
    if ([0, '0', false, 'INACTIVE'].includes(value)) return STATUS.partner.INACTIVE.label
  }
  if (!partner && field === 'status') return STATUS.crew[value]?.label || String(value)
  if (!partner && field === 'gender') return ({ M: 'Nam', F: 'Nữ', O: 'Khác' })[value] || String(value)
  if (!partner && field === 'social_insurance_joined') {
    if ([1, '1', true].includes(value)) return 'Có'
    if ([0, '0', false].includes(value)) return 'Không'
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
