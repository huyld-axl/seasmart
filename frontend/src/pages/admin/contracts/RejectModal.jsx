import { Button, Form, Input, Modal } from 'antd'
import useToast from '../../../components/ds/useToast'
import { useContractMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'

// Từ chối hợp đồng chờ duyệt: bắt buộc ghi lý do để người tạo biết cần sửa gì.
export default function RejectModal({ contract, open, onClose }) {
  const toast = useToast()
  const [form] = Form.useForm()
  const { reject } = useContractMutations()
  const number = contract.contract.contract_number

  async function submit({ reason }) {
    try {
      await reject.mutateAsync({ id: contract.contract.id, reason: reason.trim() })
      toast.success(`Đã từ chối hợp đồng ${number}`)
      onClose()
    } catch (error) {
      toast.error(`Không từ chối được hợp đồng ${number}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={520}
      destroyOnHidden
      afterClose={() => form.resetFields()}
      title={
        <div>
          <div>Từ chối hợp đồng {number}?</div>
          <p className="vt-desc">Hợp đồng về trạng thái Bị từ chối. Người tạo thấy lý do, sửa và xin duyệt lại.</p>
        </div>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" danger loading={reject.isPending} onClick={() => form.submit()}>Từ chối hợp đồng</Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark onFinish={submit}>
        <Form.Item name="reason" label="Lý do từ chối" rules={[{ required: true, whitespace: true, message: 'Ghi lý do từ chối' }]} extra="Ghi rõ cần sửa gì để người tạo sửa đúng.">
          <Input.TextArea rows={4} maxLength={1000} showCount autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  )
}
