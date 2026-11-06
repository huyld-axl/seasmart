import { Form, Modal } from 'antd'
import DateField from '../../../components/ds/DateField'
import dayjs from 'dayjs'
import { formatUsd } from '../../../utils/format'

// Hộp thoại ghi nhận đã thu: chọn ngày tiền về, mặc định hôm nay, không sau hôm nay.
export default function CollectModal({ bill, open, pending, onCancel, onConfirm }) {
  const [form] = Form.useForm()
  return (
    <Modal
      open={open}
      title={`Ghi nhận đã thu ${bill.code}?`}
      okText="Ghi nhận đã thu"
      cancelText="Huỷ"
      confirmLoading={pending}
      onCancel={onCancel}
      onOk={() => form.validateFields().then((values) => onConfirm(values.paid_date.format('YYYY-MM-DD')))}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark initialValues={{ paid_date: dayjs() }}>
        <Form.Item
          name="paid_date"
          label="Ngày thu"
          rules={[{ required: true, message: 'Chọn ngày thu' }]}
          extra={`${bill.ship_owner.company_name} · ${formatUsd(bill.total_usd, { fixed: true })} USD. Ghi khi đã nhận đủ tiền.`}
        >
          <DateField format="DD/MM/YYYY" placeholder="dd/mm/yyyy" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
