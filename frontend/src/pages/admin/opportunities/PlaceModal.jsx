import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Modal, Select } from 'antd'
import dayjs from 'dayjs'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { vesselApi } from '../../../api/fleetApi'
import { useOpportunityMutations } from '../../../hooks/useOpportunities'
import apiErrorText from '../../../utils/apiError'
import { withFlag } from '../../../utils/flag'

const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' }, style: { width: '100%' } }

// Màn 7 · Chốt người = ghi lên tàu. Chỉ người, ngày xuống (không sau hôm nay), nơi xuống; tàu khi cơ hội chưa có.
export default function PlaceModal({ opportunity: o, onClose }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { place } = useOpportunityMutations()
  const [form] = Form.useForm()
  const [vesselSearch, setVesselSearch] = useState('')
  const needVessel = !o.vessel_id
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  const vessels = useQuery({
    queryKey: ['fleet', 'vessel-options', vesselSearch, o.ship_owner_id],
    queryFn: () => vesselApi.list({ search: vesselSearch || undefined, ship_owner_id: o.ship_owner_id || undefined, limit: 50 }),
    enabled: needVessel,
  })

  const live = (o.candidates || []).filter((c) => c.status === 'PICKED')
  const held = live.find((c) => c.owner_selected_at)
  const today = dayjs().startOf('day')
  const planned = o.planned_join_date ? dayjs(o.planned_join_date) : null
  const initialValues = {
    seafarer_id: held?.seafarer_id ?? (live.length === 1 ? live[0].seafarer_id : undefined),
    join_date: planned && !planned.isAfter(today) ? planned : today,
    join_port_id: o.planned_join_port_id ?? undefined,
  }
  const personOptions = live.map((c) => ({ value: c.seafarer_id, label: c.owner_selected_at ? `${c.full_name} · chủ tàu đã chọn` : c.full_name }))
  const portOptions = (ports.data || []).map((row) => ({ value: row.id, label: row.country_name ? `${row.name} (${withFlag(row.country_code, row.country_name, row.country_flag_emoji)})` : row.name }))
  const vesselOptions = (vessels.data?.data || []).map((v) => ({ value: v.id, label: v.vessel_name }))

  async function submit() {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const person = live.find((c) => c.seafarer_id === values.seafarer_id)
    try {
      const { voyage } = await place.mutateAsync({
        id: o.id,
        seafarer_id: values.seafarer_id,
        join_date: values.join_date.format('YYYY-MM-DD'),
        join_port_id: values.join_port_id,
        ...(needVessel ? { vessel_id: values.vessel_id } : {}),
      })
      toast.success(`Đã chốt ${person?.full_name} · ${voyage.code}`, { actionLabel: 'Mở chuyến', onAction: () => navigate(`/voyages/${voyage.id}`) })
      onClose()
    } catch (error) {
      toast.error(`Không chốt được ${person?.full_name || ''}`.trim(), { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <Modal
      open
      onCancel={onClose}
      width={480}
      title={`Chốt người · ${o.rank_name} · ${o.vessel_name || 'Chưa rõ tàu'}`}
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" loading={place.isPending} onClick={submit}>Chốt</Button>,
      ]}
    >
      <p className="vd-muted">{o.code} · {o.ship_owner_name}</p>
      <Form form={form} layout="vertical" initialValues={initialValues} requiredMark>
        <Form.Item name="seafarer_id" label="Người" rules={[{ required: true, message: 'Chọn người được chốt' }]}>
          <Select {...selectProps} options={personOptions} placeholder="Chọn ứng viên" />
        </Form.Item>
        {needVessel ? (
          <Form.Item name="vessel_id" label="Tàu" rules={[{ required: true, message: 'Chọn tàu' }]} extra="Cơ hội chưa có tàu, chọn tàu người này lên.">
            <Select {...selectProps} showSearch={{ filterOption: false, onSearch: setVesselSearch }} loading={vessels.isFetching} options={vesselOptions} placeholder="Tìm tàu" />
          </Form.Item>
        ) : null}
        <Form.Item name="join_date" label="Ngày xuống tàu" rules={[{ required: true, message: 'Chọn ngày xuống tàu' }]} extra="Không được sau hôm nay.">
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(today, 'day')} />
        </Form.Item>
        <Form.Item name="join_port_id" label="Nơi xuống tàu" rules={[{ required: true, message: 'Chọn nơi xuống tàu' }]}>
          <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
