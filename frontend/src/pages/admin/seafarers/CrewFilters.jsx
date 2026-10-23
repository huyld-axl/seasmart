import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, InputNumber, Select } from 'antd'
import { DownOutlined, FilterOutlined } from '@ant-design/icons'
import { lookupApi } from '../../../api'
import { EMPTY_FILTERS, filterCount } from './crewFilters'

// Nút mở / đóng hàng bộ lọc nâng cao; số trên nút là số nhóm lọc đang bật.
export function CrewFilterButton({ value, open, onToggle }) {
  return (
    <Badge count={filterCount(value)} size="small" offset={[-4, 4]}>
      <Button className="crew-filter-btn" icon={<FilterOutlined />} aria-expanded={open} aria-controls="crew-filter-bar" onClick={onToggle}>
        Bộ lọc <DownOutlined className="crew-filter-btn__chev" />
      </Button>
    </Badge>
  )
}

// Hàng bộ lọc nâng cao mở rộng ngay dưới thanh công cụ: chức danh (từng giữ), tàu đã từng đi, tuổi, chứng chỉ còn hiệu lực.
// value / onChange: đối tượng dạng EMPTY_FILTERS; áp dụng ngay khi đổi.
export function CrewFilterBar({ value, onChange }) {
  const [vesselSearch, setVesselSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(vesselSearch.trim()), 250)
    return () => clearTimeout(timer)
  }, [vesselSearch])

  const ranks = useQuery({ queryKey: ['ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data), staleTime: 300000 })
  const certTypes = useQuery({ queryKey: ['certificate-types'], queryFn: () => lookupApi.certificateTypes().then((r) => r.data), staleTime: 300000 })
  const vessels = useQuery({ queryKey: ['vessels-lookup', debounced], queryFn: () => lookupApi.vessels(debounced).then((r) => r.data), staleTime: 60000 })
  const set = (patch) => onChange({ ...value, ...patch })
  const multi = { mode: 'multiple', maxTagCount: 'responsive', allowClear: true, style: { width: '100%' } }

  return (
    <div className="crew-filterbar" id="crew-filter-bar">
      <label className="crew-filterbar__field crew-filterbar__field--wide">
        <span>Chức danh (từng giữ)</span>
        <Select {...multi} placeholder="Chọn chức danh" optionFilterProp="label" loading={ranks.isLoading} value={value.ranks} onChange={(v) => set({ ranks: v })} options={(ranks.data || []).map((r) => ({ value: r.id, label: r.name_vi }))} />
      </label>
      <label className="crew-filterbar__field crew-filterbar__field--wide">
        <span>Tàu đã từng đi</span>
        <Select {...multi} labelInValue placeholder="Tìm tên tàu" filterOption={false} onSearch={setVesselSearch} loading={vessels.isLoading} value={value.vessels} onChange={(v) => set({ vessels: v })} options={(vessels.data || []).map((v) => ({ value: v.id, label: v.vessel_name }))} />
      </label>
      <div className="crew-filterbar__field crew-filterbar__field--age">
        <span>Tuổi</span>
        <div className="crew-filterbar__age">
          <InputNumber min={0} max={120} placeholder="Từ" aria-label="Tuổi từ" value={value.ageMin} onChange={(v) => set({ ageMin: v ?? null })} />
          <span aria-hidden>–</span>
          <InputNumber min={0} max={120} placeholder="Đến" aria-label="Tuổi đến" value={value.ageMax} onChange={(v) => set({ ageMax: v ?? null })} />
        </div>
      </div>
      <label className="crew-filterbar__field crew-filterbar__field--wide" title="Còn hiệu lực hoặc sắp hết hạn; phải có đủ các loại đã chọn">
        <span>Chứng chỉ còn hiệu lực</span>
        <Select {...multi} placeholder="Chọn loại chứng chỉ" optionFilterProp="label" loading={certTypes.isLoading} value={value.certs} onChange={(v) => set({ certs: v })} options={(certTypes.data || []).map((c) => ({ value: c.id, label: c.name_vi }))} />
      </label>
      <Button className="crew-filterbar__clear" disabled={!filterCount(value)} onClick={() => onChange(EMPTY_FILTERS)}>Xoá bộ lọc</Button>
    </div>
  )
}
