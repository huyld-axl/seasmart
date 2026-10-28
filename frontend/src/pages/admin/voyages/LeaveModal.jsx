import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, Modal, Select } from 'antd'
import dayjs from 'dayjs'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { useVoyageMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { withFlag } from '../../../utils/flag'
import { leaveHint } from './voyageList'

const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' }, style: { width: '100%' } }

// Màn 12 · Ghi rời tàu: một hoặc nhiều chuyến đang trên tàu. Chỉ ngày rời, nơi rời, ghi chú.
// voyages: dòng chuyến từ API (id, code, seafarer_name, rank_name, vessel_id, vessel_name, ship_owner_id, rank_id, join_date, planned_leave_date, planned_leave_port_id).
export default function LeaveModal({ voyages, onClose, onDone }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { leave, leaveMany } = useVoyageMutations()
  const [form] = Form.useForm()
  const leaveDate = Form.useWatch('leave_date', form)
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  const portOptions = (ports.data || []).map((row) => ({ value: row.id, label: row.country_name ? `${row.name} (${withFlag(row.country_code, row.country_name, row.country_flag_emoji)})` : row.name }))

  const single = voyages.length === 1 ? voyages[0] : null
  const today = dayjs().startOf('day')
  const latestJoin = voyages.reduce((max, v) => (dayjs(v.join_date).isAfter(max) ? dayjs(v.join_date) : max), dayjs(voyages[0].join_date))
  const planned = single?.planned_leave_date ? dayjs(single.planned_leave_date) : null
  const samePort = voyages.every((v) => v.planned_leave_port_id === voyages[0].planned_leave_port_id)
  const initialValues = {
    leave_date: planned && !planned.isAfter(today) ? planned : today,
    leave_port_id: samePort ? voyages[0].planned_leave_port_id ?? undefined : undefined,
  }
  const pending = leave.isPending || leaveMany.isPending

  async function submit() {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const body = { leave_date: values.leave_date.format('YYYY-MM-DD'), leave_port_id: values.leave_port_id, leave_note: values.leave_note?.trim() || undefined }
    try {
      if (single) await leave.mutateAsync({ id: single.id, ...body })
      else await leaveMany.mutateAsync({ voyage_ids: voyages.map((v) => v.id), ...body })
      if (single) {
        const query = new URLSearchParams({ owner: single.ship_owner_id, vessel: single.vessel_id, rank: single.rank_id })
        toast.success(`Đã ghi rời tàu ${single.seafarer_name}`, {
          actionLabel: 'Tạo cơ hội tìm người thay',
          onAction: () => navigate(`/opportunities/new?${query}`),
        })
      } else {
        toast.success(`Đã ghi rời tàu ${voyages.length} chuyến`)
      }
      onDone?.()
      onClose()
    } catch (error) {
      toast.error('Không ghi rời tàu được', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <Modal
      open
      onCancel={onClose}
      width={480}
      title={single ? `Ghi rời tàu · ${single.seafarer_name}` : `Ghi rời tàu ${voyages.length} chuyến`}
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" loading={pending} onClick={submit}>Ghi rời tàu</Button>,
      ]}
    >
      {single ? (
        <p className="vd-muted">{single.rank_name} · {single.vessel_name} · lên {formatDate(single.join_date)} · rời dự kiến {formatDate(single.planned_leave_date)}</p>
      ) : (
        <ul className="vy-leave-list">
          {voyages.map((v) => <li key={v.id}><b>{v.seafarer_name}</b> <span className="vd-muted">· {v.rank_name} · {v.vessel_name} · rời dự kiến {formatDate(v.planned_leave_date)}</span></li>)}
        </ul>
      )}
      <Form form={form} layout="vertical" initialValues={initialValues} requiredMark>
        <Form.Item
          name="leave_date"
          label="Ngày rời tàu"
          rules={[{ required: true, message: 'Chọn ngày rời tàu' }]}
          extra={single ? leaveHint(leaveDate, single.planned_leave_date) : 'Không được trước ngày lên tàu hay sau hôm nay.'}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(today, 'day') || d.isBefore(latestJoin, 'day')} />
        </Form.Item>
        <Form.Item name="leave_port_id" label="Nơi rời tàu" rules={[{ required: true, message: 'Chọn nơi rời tàu' }]}>
          <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
        </Form.Item>
        <Form.Item name="leave_note" label="Ghi chú">
          <Input.TextArea rows={3} maxLength={500} placeholder="Ví dụ: về sớm vì việc gia đình" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
