import { Button, Modal } from 'antd'
import useToast from '../../../components/ds/useToast'
import { useContractMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'

// Duyệt hợp đồng chờ duyệt. Trạng thái thuyền viên (Đang trên tàu / Ở bờ) giờ chỉ do chuyến đổi, nên không hỏi gì thêm.
export default function ApproveModal({ contract, open, onClose }) {
  const toast = useToast()
  const { approve } = useContractMutations()
  const number = contract.contract.contract_number

  async function submit() {
    try {
      await approve.mutateAsync({ id: contract.contract.id })
      toast.success(`Đã duyệt hợp đồng ${number}`)
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
    />
  )
}
