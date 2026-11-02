import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Modal, Select } from 'antd'
import dayjs from 'dayjs'
import Banner from '../../../components/ds/Banner'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { vesselApi } from '../../../api/fleetApi'
import { useOpportunityMutations } from '../../../hooks/useOpportunities'
import { useCan } from '../../../hooks/usePermission'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { withFlag } from '../../../utils/flag'

const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' }, style: { width: '100%' } }

// Màn 7 · Chốt người = ghi lên tàu. Chỉ người, ngày xuống (không sau hôm nay), nơi xuống; tàu khi cơ hội chưa có.
export default function PlaceModal({ opportunity: o, onClose }) {
  const navigate = useNavigate()
  const can = useCan()
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

  const pickedId = Form.useWatch('seafarer_id', form)
  const joinDate = Form.useWatch('join_date', form)
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

  // Người chọn còn hợp đồng chưa kết thúc trùng khoảng [ngày xuống, ngày rời dự kiến]: chốt vẫn thành công nhưng không sinh hợp đồng.
  const open = live.find((c) => c.seafarer_id === pickedId)?.open_contract
  const join = joinDate ? dayjs(joinDate).format('YYYY-MM-DD') : null
  const leave = join && o.planned_leave_date && String(o.planned_leave_date).slice(0, 10) > join ? String(o.planned_leave_date).slice(0, 10) : join
  const overlap = open && join && String(open.start_date).slice(0, 10) <= leave && String(open.end_date).slice(0, 10) >= join ? open : null

  async function submit() {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const person = live.find((c) => c.seafarer_id === values.seafarer_id)
    try {
      const { voyage, contract, contract_skipped: skipped } = await place.mutateAsync({
        id: o.id,
        seafarer_id: values.seafarer_id,
        join_date: values.join_date.format('YYYY-MM-DD'),
        join_port_id: values.join_port_id,
        ...(needVessel ? { vessel_id: values.vessel_id } : {}),
      })
      if (skipped) {
        toast.warning(`Đã chốt, chưa tạo hợp đồng vì trùng ${skipped.contract_number}`, {
          description: `${person?.full_name} · ${voyage.code}. Kết thúc hoặc rút ngắn ${skipped.contract_number}, rồi bấm Tạo hợp đồng trên chuyến.`,
          actionLabel: 'Mở chuyến',
          onAction: () => navigate(`/voyages/${voyage.id}`),
        })
      } else if (contract) {
        toast.success(`Đã chốt ${person?.full_name} · ${voyage.code} · hợp đồng nháp ${contract.contract_number}`, can('contract.view')
          ? { actionLabel: 'Mở hợp đồng', onAction: () => navigate(`/contracts/${contract.id}`) }
          : { actionLabel: 'Mở chuyến', onAction: () => navigate(`/voyages/${voyage.id}`) })
      } else {
        toast.success(`Đã chốt ${person?.full_name} · ${voyage.code}`, { actionLabel: 'Mở chuyến', onAction: () => navigate(`/voyages/${voyage.id}`) })
      }
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
      {overlap ? (
        <Banner
          tone="warning"
          title="Sẽ không tạo hợp đồng"
          description={`${open && live.find((c) => c.seafarer_id === pickedId)?.full_name} còn hợp đồng ${overlap.contract_number} tới ${formatDate(overlap.end_date)}, trùng thời gian. Chốt vẫn ghi lên tàu. Muốn có hợp đồng mới thì kết thúc hoặc rút ngắn ${overlap.contract_number}, rồi bấm “Tạo hợp đồng” trên chuyến.`}
        />
      ) : null}
    </Modal>
  )
}
