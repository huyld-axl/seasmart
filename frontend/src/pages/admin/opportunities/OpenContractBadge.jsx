import { Link } from 'react-router-dom'
import StatusBadge from '../../../components/ds/StatusBadge'
import { useCan } from '../../../hooks/usePermission'
import { formatDate } from '../../../utils/format'

// Nhãn vàng "Đang có hợp đồng {số} · tới {ngày}" trên ứng viên còn hợp đồng chưa kết thúc. Chỉ là cảnh báo: vẫn thêm, gửi, chốt được.
// Bấm nhãn mở hợp đồng đó (khi có quyền xem hợp đồng).
export default function OpenContractBadge({ contract }) {
  const can = useCan()
  if (!contract) return null
  const badge = <StatusBadge group="contract" value="PENDING" label={`Đang có hợp đồng ${contract.contract_number} · tới ${formatDate(contract.end_date)}`} />
  return can('contract.view')
    ? <Link to={`/contracts/${contract.id}`} onClick={(event) => event.stopPropagation()}>{badge}</Link>
    : badge
}
