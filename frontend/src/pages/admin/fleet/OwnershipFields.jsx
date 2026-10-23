import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Form, Input, Select } from 'antd'
import ToggleRow from '../../../components/ds/ToggleRow'
import { Link } from 'react-router-dom'
import { vesselApi } from '../../../api/fleetApi'

export default function OwnershipFields({ value, onChange, canCreate = false }) {
  const [search, setSearch] = useState('')
  const list = useQuery({ queryKey: ['fleet', 'ownership-picker', search], queryFn: () => vesselApi.list({ search, limit: 100 }) })
  const patch = (next) => onChange({ ...value, ...next })
  return <div className="sf-grid">
    <Form.Item label="Tên tàu" className="sf-c8" required extra={!value.locked && canCreate ? <Link to="/vessels/new" target="_blank">Chưa có trong danh sách? Thêm tàu mới</Link> : null}>
      {value.locked ? <Input value={value.vessel_name || ''} maxLength={150} onChange={(e) => patch({ vessel_name: e.target.value })} /> : <Select style={{ width: '100%' }} disabled={value.locked} value={value.id} showSearch filterOption={false} onSearch={setSearch} onOpenChange={(open) => { if (open) list.refetch() }} placeholder="Chọn tàu" loading={list.isFetching} options={[...new Map([...(value.id ? [value] : []), ...(list.data?.data || [])].map((v) => [v.id, { value: v.id, label: `${v.vessel_name} · ${v.ship_owner_name || 'Chưa có chủ'}` }])).values()]} onChange={(id) => { const v = list.data?.data.find((v) => v.id === id); patch({ ...v, expected_owner_id: v.ship_owner_id ?? null }) }} />}

    </Form.Item>
    <Form.Item label="Sở hữu" className="sf-c4"><ToggleRow label="Đang sở hữu" value={value.is_current !== false} onChange={(on) => patch({ is_current: on, ended_at: on ? null : value.ended_at })} /></Form.Item>
    <Form.Item label="Sở hữu từ ngày" className="sf-c6" required><Input type="date" value={value.started_at?.slice(0, 10) || ''} onChange={(e) => patch({ started_at: e.target.value })} /></Form.Item>
    <Form.Item label="Đến ngày" className="sf-c6" required={value.is_current === false}><Input type="date" disabled={value.is_current !== false} min={value.started_at?.slice(0, 10)} value={value.is_current !== false ? '' : value.ended_at?.slice(0, 10) || ''} onChange={(e) => patch({ ended_at: e.target.value })} /></Form.Item>
  </div>
}
export function ownershipProblem(v) {
  if (!v.id) return 'Chọn tàu.'
  if (v.locked && !v.vessel_name?.trim()) return 'Nhập tên tàu.'
  if (!v.started_at) return 'Chọn ngày bắt đầu sở hữu.'
  if (v.is_current === false && (!v.ended_at || v.ended_at.slice(0, 10) < v.started_at.slice(0, 10))) return 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'
  return null
}
