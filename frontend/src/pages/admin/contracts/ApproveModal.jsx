import { useState } from 'react'
import { Button, Modal } from 'antd'
import { CompassOutlined } from '@ant-design/icons'
import Banner from '../../../components/ds/Banner'
import ToggleRow from '../../../components/ds/ToggleRow'
import useToast from '../../../components/ds/useToast'
import { useContractMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'

// Duyệt hợp đồng chờ duyệt. Chuyến đang trên tàu thì hỏi có chuyển thuyền viên sang Đang trên tàu (mặc định bật).
export default function ApproveModal({ contract, open, onClose }) {
  const toast = useToast()
  const { approve } = useContractMutations()
  const [moveOnboard, setMoveOnboard] = useState(true)
  const { voyage, seafarer } = contract
  const number = contract.contract.contract_number
  const onboard = voyage.status === 'ONBOARD'

  async function submit() {
    try {
      const result = await approve.mutateAsync({ id: contract.contract.id, ...(onboard ? { move_onboard: moveOnboard } : {}) })
      toast.success(result.moved ? `Đã duyệt hợp đồng ${number} · ${seafarer.full_name} chuyển sang Đang trên tàu` : `Đã duyệt hợp đồng ${number}`)
      onClose()
    } catch (error) {
      toast.error(`Không duyệt được hợp đồng ${number}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={480}
      destroyOnHidden
      title={
        <div>
          <div>Duyệt hợp đồng {number}?</div>
          <p className="vt-desc">Hợp đồng chuyển sang Hiệu lực và khoá nội dung.</p>
        </div>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" loading={approve.isPending} onClick={submit}>Duyệt hợp đồng</Button>,
      ]}
    >
      {onboard ? (
        <div className="ct-approve">
          <Banner
            tone="neutral"
            icon={CompassOutlined}
            title={`Chuyến ${voyage.code} đang trên tàu từ ${formatDate(voyage.actual_embark_date)}`}
            description={`${seafarer.full_name} đang ở trạng thái Ở bờ vì lúc bắt đầu chuyến hợp đồng chưa hiệu lực.`}
          />
          <div className="ct-approve__toggle">
            <ToggleRow label={`Chuyển ${seafarer.full_name} sang Đang trên tàu`} hint="Tắt nếu người này chưa lên tàu, trạng thái giữ Ở bờ." value={moveOnboard} onChange={setMoveOnboard} />
          </div>
        </div>
      ) : (
        <p className="ct-approve__note">
          {voyage.status === 'ENDED' ? `Chuyến ${voyage.code} đã kết thúc.` : `Chuyến ${voyage.code} chưa bắt đầu. ${seafarer.full_name} sẽ chuyển sang Đang trên tàu khi bấm Bắt đầu chuyến.`}
        </p>
      )}
    </Modal>
  )
}
