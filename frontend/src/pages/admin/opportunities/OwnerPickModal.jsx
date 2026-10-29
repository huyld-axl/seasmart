import { useState } from 'react'
import { Button, Modal } from 'antd'
import ChoiceCardGroup from '../../../components/ds/ChoiceCardGroup'
import useToast from '../../../components/ds/useToast'
import { useOpportunityMutations } from '../../../hooks/useOpportunities'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { candidateTags } from './opportunityView'

// Chủ tàu chọn ai? Chọn một ứng viên rồi Xác nhận; chọn người khác thì nhãn chuyển sang, "Bỏ nhãn" gỡ hẳn.
export default function OwnerPickModal({ opportunity, onClose }) {
  const toast = useToast()
  const { setOwnerSelected } = useOpportunityMutations()
  const live = (opportunity.candidates || []).filter((c) => c.status === 'PICKED')
  const held = live.find((c) => c.owner_selected_at)
  const [choice, setChoice] = useState(held?.seafarer_id ?? null)

  async function save(person, selected) {
    try {
      await setOwnerSelected.mutateAsync({ id: opportunity.id, seafarerId: person.seafarer_id, selected })
      toast.success(selected ? `Đã đánh dấu chủ tàu đã chọn ${person.full_name}` : `Đã bỏ nhãn của ${person.full_name}`)
      onClose()
    } catch (error) {
      toast.error('Không đổi được nhãn', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const options = live.map((c) => {
    const { docs } = candidateTags(c, opportunity, formatDate)
    const where = c.seafarer_status === 'ON_VESSEL' ? `Đang trên tàu${c.onboard_until ? `, rời dự kiến ${formatDate(c.onboard_until)}` : ''}` : 'Ở bờ'
    return {
      value: c.seafarer_id,
      title: c.full_name,
      aside: docs.tone === 'none' ? null : <span className={`op-tag op-tag--${docs.tone}`}>{docs.label}</span>,
      description: [c.current_rank_name, where, c.last_sent_at ? `gửi ${formatDate(c.last_sent_at)}` : 'chưa gửi hồ sơ'].filter(Boolean).join(' · '),
    }
  })
  const person = live.find((c) => c.seafarer_id === choice)

  return (
    <Modal
      open
      onCancel={onClose}
      width={520}
      title="Chủ tàu chọn ai?"
      footer={[
        held ? <Button key="clear" className="op-pick__clear" loading={setOwnerSelected.isPending} onClick={() => save(held, false)}>Bỏ nhãn</Button> : null,
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" disabled={!person || person.seafarer_id === held?.seafarer_id} loading={setOwnerSelected.isPending} onClick={() => save(person, true)}>Xác nhận</Button>,
      ]}
    >
      <p className="vt-desc">{opportunity.ship_owner_name} · {opportunity.rank_name}{opportunity.vessel_name ? ` · ${opportunity.vessel_name}` : ''}</p>
      <ChoiceCardGroup name="owner-pick" options={options} value={choice} onChange={setChoice} />
    </Modal>
  )
}
