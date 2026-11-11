import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, InputNumber } from 'antd'
import Select from '../../../components/ds/SearchSelect'
import { DownOutlined, FilterOutlined } from '@ant-design/icons'
import { lookupApi } from '../../../api'
import { filterCount } from './crewFilters.js'

// Nút mở / đóng hàng bộ lọc nâng cao; số trên nút là số nhóm lọc đang bật (`count` ghi đè khi màn khác dùng bộ lọc riêng).
export function CrewFilterButton({ value, count = filterCount(value), open, onToggle }) {
  return (
    <Badge count={count} size="small" offset={[-4, 4]}>
      <Button className="crew-filter-btn" icon={<FilterOutlined />} aria-label="Bộ lọc" aria-expanded={open} aria-controls="crew-filter-bar" onClick={onToggle}>
        <span className="crew-filter-btn__label">Bộ lọc</span><DownOutlined className="crew-filter-btn__chev" />
      </Button>
    </Badge>
  )
}

// Các ô bộ lọc nâng cao của danh sách thuyền viên: chức danh (từng giữ), tàu đã từng đi, tuổi, chứng chỉ còn hiệu lực.
// Đặt trong ListFilters (hàng lọc ở desktop, sheet ở điện thoại). value / onChange: đối tượng dạng EMPTY_FILTERS; áp dụng ngay khi đổi.
export function CrewFilterFields({ value, onChange }) {
  const [ageDraft, setAgeDraft] = useState(null)
  const ages = ageDraft && ageDraft.baseMin === value.ageMin && ageDraft.baseMax === value.ageMax
    ? ageDraft
    : { ageMin: value.ageMin, ageMax: value.ageMax }
  const ageError = ages.ageMin != null && ages.ageMax != null && ages.ageMin > ages.ageMax
  const setAge = (patch) => {
    const next = { ageMin: ages.ageMin, ageMax: ages.ageMax, ...patch }
    setAgeDraft({ ...next, baseMin: value.ageMin, baseMax: value.ageMax })
    if (next.ageMin != null && next.ageMax != null && next.ageMin > next.ageMax) return
    onChange({ ...value, ...next })
  }
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
    <>
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
          <InputNumber min={0} max={120} precision={0} placeholder="Từ" aria-label="Tuổi từ" status={ageError ? 'error' : undefined} aria-invalid={ageError} value={ages.ageMin} onChange={(v) => setAge({ ageMin: v ?? null })} />
          <span aria-hidden>–</span>
          <InputNumber min={0} max={120} precision={0} placeholder="Đến" aria-label="Tuổi đến" status={ageError ? 'error' : undefined} aria-invalid={ageError} value={ages.ageMax} onChange={(v) => setAge({ ageMax: v ?? null })} />
        </div>
        {ageError && <span role="alert" style={{ color: 'var(--danger)' }}>Tuổi bắt đầu không được lớn hơn tuổi kết thúc.</span>}
      </div>
      <label className="crew-filterbar__field crew-filterbar__field--wide" title="Còn hiệu lực hoặc sắp hết hạn; phải có đủ các loại đã chọn">
        <span>Chứng chỉ còn hiệu lực</span>
        <Select {...multi} placeholder="Chọn loại chứng chỉ" optionFilterProp="label" loading={certTypes.isLoading} value={value.certs} onChange={(v) => set({ certs: v })} options={(certTypes.data || []).map((c) => ({ value: c.id, label: c.name_vi }))} />
      </label>
    </>
  )
}
