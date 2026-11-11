import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, Modal } from 'antd'
import Select from '../../../components/ds/SearchSelect'
import DateField from '../../../components/ds/DateField'
import dayjs from 'dayjs'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import Banner from '../../../components/ds/Banner'
import { useRemovePreview, useVoyageMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { withFlag } from '../../../utils/flag'
import { deltaText } from './voyageList'

const CONTRACT_STATUS_LABELS = { DRAFT: 'Nháp', PENDING: 'Chờ duyệt', REJECTED: 'Bị từ chối', ACTIVE: 'Hiệu lực', ENDED: 'Đã kết thúc' }
const DATE_FORMAT = 'DD/MM/YYYY'
const API_DATE = 'YYYY-MM-DD'
const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' }, style: { width: '100%' } }

function usePortOptions() {
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  return {
    loading: ports.isLoading,
    options: (ports.data || []).map((row) => ({ value: row.id, label: row.country_name ? `${row.name} (${withFlag(row.country_code, row.country_name, row.country_flag_emoji)})` : row.name })),
  }
}

// Khung chung của ba hộp thoại: rộng 480, nút Huỷ và nút chính, gửi form khi bấm nút chính.
function FormModal({ title, okText, danger, pending, okDisabled, form, onClose, onSubmit, children, description }) {
  async function submit() {
    const values = await form.validateFields().catch(() => null)
    if (values) onSubmit(values)
  }
  return (
    <Modal
      open
      onCancel={onClose}
      width={480}
      title={title}
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" danger={danger} loading={pending} disabled={okDisabled} onClick={submit}>{okText}</Button>,
      ]}
    >
      {description ? <p className="vd-muted">{description}</p> : null}
      {children}
    </Modal>
  )
}

// Màn 13 · Đổi ngày rời dự kiến. Chênh lệch luôn so với ngày gốc (lần đầu đổi mới chép ngày gốc).
export function LeavePlanModal({ voyage: v, onClose }) {
  const toast = useToast()
  const { leavePlan } = useVoyageMutations()
  const [form] = Form.useForm()
  const next = Form.useWatch('planned_leave_date', form)
  const base = v.original_leave_date || v.planned_leave_date
  const delta = next ? deltaText(dayjs(next).startOf('day').diff(dayjs(base).startOf('day'), 'day')) : null

  async function onSubmit(values) {
    try {
      await leavePlan.mutateAsync({ id: v.id, planned_leave_date: values.planned_leave_date.format(API_DATE), note: values.note?.trim() || null })
      toast.success(`Đã đổi ngày rời dự kiến của ${v.seafarer_name}`)
      onClose()
    } catch (error) {
      toast.error('Không đổi được ngày rời', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <FormModal title={`Đổi ngày rời dự kiến · ${v.seafarer_name}`} okText="Lưu ngày rời mới" pending={leavePlan.isPending} form={form} onClose={onClose} onSubmit={onSubmit}>
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item label="Ngày rời hiện tại" extra={v.original_leave_date && v.original_leave_date !== v.planned_leave_date ? `Ngày gốc ${formatDate(v.original_leave_date)}` : undefined}>
          <Input value={formatDate(v.planned_leave_date)} disabled />
        </Form.Item>
        <Form.Item
          name="planned_leave_date"
          label="Ngày rời mới"
          rules={[{ required: true, message: 'Chọn ngày rời mới' }]}
          extra={delta ? `${delta.charAt(0).toUpperCase()}${delta.slice(1)} so với ngày gốc ${formatDate(base)}` : undefined}
        >
          <DateField format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(v.join_date), 'day')} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} maxLength={500} placeholder="Ví dụ: chủ tàu xin gia hạn thêm một tháng" />
        </Form.Item>
      </Form>
    </FormModal>
  )
}

// Sửa ngày đã ghi khi nhập sai: ngày, nơi lên; chuyến đã rời thì cả ngày, nơi rời.
export function EditDatesModal({ voyage: v, onClose }) {
  const toast = useToast()
  const { editDates } = useVoyageMutations()
  const [form] = Form.useForm()
  const ports = usePortOptions()
  const left = Boolean(v.leave_date)
  const today = dayjs().endOf('day')
  const initialValues = {
    join_date: dayjs(v.join_date),
    join_port_id: v.join_port_id ?? undefined,
    ...(left ? { leave_date: dayjs(v.leave_date), leave_port_id: v.leave_port_id ?? undefined } : {}),
  }

  async function onSubmit(values) {
    try {
      await editDates.mutateAsync({
        id: v.id,
        join_date: values.join_date.format(API_DATE),
        join_port_id: values.join_port_id,
        ...(left ? { leave_date: values.leave_date.format(API_DATE), leave_port_id: values.leave_port_id } : {}),
      })
      toast.success(`Đã sửa ngày của chuyến ${v.code}`)
      onClose()
    } catch (error) {
      toast.error('Không sửa được ngày', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const afterJoin = {
    validator: (_, value) => {
      const start = form.getFieldValue('join_date')
      return !value || !start || !value.isBefore(start, 'day') ? Promise.resolve() : Promise.reject(new Error('Ngày rời tàu phải sau hoặc bằng ngày lên tàu'))
    },
  }

  return (
    <FormModal
      title={`Sửa ngày đã ghi · ${v.code}`}
      description="Dùng khi nhập sai. Đổi kế hoạch rời tàu thì dùng Đổi ngày rời dự kiến."
      okText="Lưu thay đổi"
      pending={editDates.isPending}
      form={form}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Form form={form} layout="vertical" requiredMark initialValues={initialValues}>
        <Form.Item name="join_date" label="Ngày lên tàu" rules={[{ required: true, message: 'Chọn ngày lên tàu' }]} extra="Không được sau hôm nay">
          <DateField format={DATE_FORMAT} style={{ width: '100%' }} disabledDate={(d) => d.isAfter(today)} />
        </Form.Item>
        <Form.Item name="join_port_id" label="Nơi lên tàu" rules={[{ required: true, message: 'Chọn nơi lên tàu' }]}>
          <Select {...selectProps} loading={ports.loading} options={ports.options} placeholder="Chọn cảng" />
        </Form.Item>
        {left ? (
          <>
            <Form.Item name="leave_date" label="Ngày rời tàu" dependencies={['join_date']} rules={[{ required: true, message: 'Chọn ngày rời tàu' }, afterJoin]}>
              <DateField format={DATE_FORMAT} style={{ width: '100%' }} disabledDate={(d) => d.isAfter(today)} />
            </Form.Item>
            <Form.Item name="leave_port_id" label="Nơi rời tàu" rules={[{ required: true, message: 'Chọn nơi rời tàu' }]}>
              <Select {...selectProps} loading={ports.loading} options={ports.options} placeholder="Chọn cảng" />
            </Form.Item>
          </>
        ) : null}
      </Form>
    </FormModal>
  )
}

// Đ4 · Huỷ chốt (chuyến từ cơ hội) / Xoá chuyến (tạo tay). Liệt kê việc sẽ xảy ra, gồm hợp đồng bị xoá mềm theo chuyến; hợp đồng đã hiệu lực thì chặn. Ghi chú tuỳ chọn.
export function RemoveModal({ voyage: v, onClose }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { remove } = useVoyageMutations()
  const [form] = Form.useForm()
  const fromOpportunity = v.source === 'OPPORTUNITY'
  const preview = useRemovePreview(v.id)
  const blocked = preview.data?.blocked
  const effects = [
    `Chuyến ${v.code} bị xoá khỏi danh sách và hồ sơ.`,
    !v.leave_date ? `${v.seafarer_name} về "Ở bờ".` : null,
    fromOpportunity && v.opportunity ? `Cơ hội ${v.opportunity.code} mở lại, các ứng viên về danh sách như trước khi chốt.` : null,
    ...(preview.data?.contracts || []).map((c) => `Hợp đồng ${c.contract_number} (${CONTRACT_STATUS_LABELS[c.status]}) bị xoá mềm.`),
  ].filter(Boolean)

  async function onSubmit(values) {
    try {
      await remove.mutateAsync({ id: v.id, note: values.note?.trim() || null })
      toast.success(fromOpportunity ? `Đã huỷ chốt ${v.seafarer_name}` : `Đã xoá chuyến ${v.code}`)
      onClose()
      navigate(fromOpportunity && v.opportunity ? `/opportunities/${v.opportunity.id}` : '/voyages')
    } catch (error) {
      toast.error(fromOpportunity ? 'Không huỷ chốt được' : 'Không xoá được chuyến', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <FormModal
      title={fromOpportunity ? `Huỷ chốt ${v.seafarer_name} · ${v.code}?` : `Xoá chuyến ${v.code}?`}
      okText={fromOpportunity ? 'Huỷ chốt' : 'Xoá chuyến'}
      danger
      pending={remove.isPending}
      okDisabled={preview.isLoading || preview.isError || blocked}
      form={form}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {blocked ? (
        <Banner tone="error" title={fromOpportunity ? 'Không huỷ chốt được' : 'Không xoá được chuyến'} description={`${preview.data.message}. Hợp đồng đã duyệt không xoá theo chuyến.`} />
      ) : preview.isError ? (
        <Banner tone="error" title="Không kiểm tra được hợp đồng của chuyến" description="Thử lại sau ít phút." />
      ) : (
        <>
          <p className="vd-muted">Sẽ xảy ra</p>
          <ul className="vy-leave-list">{effects.map((text) => <li key={text}>{text}</li>)}</ul>
        </>
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} maxLength={500} placeholder="Ví dụ: chủ tàu đổi ý" />
        </Form.Item>
      </Form>
    </FormModal>
  )
}
