import { Button, InputNumber, Select, Tooltip } from 'antd'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { SegmentedPick } from '../fleet/FleetParts'
import { LEVEL_LABELS, VALID_UNTIL, VALID_UNTIL_LABELS } from '../../../constants/opportunityVoyage'
import { TEMPLATES } from '../exports/packModel'
import { DOC_CATEGORIES, REQUIREMENT_GROUPS, requirementGroup } from './opportunityView'

const LEVEL_OPTIONS = Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))
const VALID_OPTIONS = VALID_UNTIL.map((value) => ({ value, label: VALID_UNTIL_LABELS[value] }))
const selectProps = { showSearch: { optionFilterProp: 'label' }, style: { width: '100%' } }

const BLANK = {
  doc: { kind: 'CERTIFICATE', _group: 'doc', level: 'REQUIRED', valid_until: 'LEAVE' },
  cert: { kind: 'CERTIFICATE', _group: 'cert', level: 'REQUIRED', valid_until: 'LEAVE' },
  expRank: { kind: 'EXPERIENCE', _group: 'exp', _by: 'rank', level: 'REQUIRED', valid_until: 'ANY', min_months: 12 },
  expType: { kind: 'EXPERIENCE', _group: 'exp', _by: 'type', level: 'PREFERRED', valid_until: 'ANY', min_trips: 1 },
  tpl: { kind: 'TEMPLATE', _group: 'tpl', level: 'REQUIRED', valid_until: 'ANY' },
}

// Bảng hồ sơ yêu cầu trong form cơ hội (value / onChange của Form.Item). Chỉ dùng ở màn cơ hội.
// certTypes: [{ id, name_vi, category }], ranks, vesselTypes: lookup.
export default function RequirementTable({ value = [], onChange, certTypes = [], ranks = [], vesselTypes = [], changed = false, footer }) {
  const categoryOf = (id) => certTypes.find((c) => c.id === id)?.category
  const set = (index, patch) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const remove = (index) => onChange(value.filter((_, i) => i !== index))
  const add = (key) => onChange([...value, { ...BLANK[key] }])

  const certOptions = (group) => certTypes
    .filter((c) => (group === 'doc') === DOC_CATEGORIES.includes(c.category))
    .map((c) => ({ value: c.id, label: c.name_vi }))
  const rankOptions = ranks.map((r) => ({ value: r.id, label: r.name_vi }))
  const typeOptions = vesselTypes.map((t) => ({ value: t.id, label: t.name_vi }))
  const templateOptions = TEMPLATES.map((t) => ({ value: t.key, label: t.name }))

  const indexed = value.map((row, index) => ({ row, index, group: requirementGroup(row, categoryOf) }))

  function nameCell({ row, index, group }) {
    if (row.kind === 'TEMPLATE') {
      return <Select {...selectProps} value={row.template_key ?? undefined} options={templateOptions} placeholder="Chọn mẫu giấy" aria-label="Mẫu giấy" onChange={(v) => set(index, { template_key: v })} />
    }
    if (row.kind === 'EXPERIENCE') {
      const byRank = row._by ? row._by === 'rank' : !!row.rank_id
      return byRank
        ? <Select {...selectProps} value={row.rank_id ?? undefined} options={rankOptions} placeholder="Đã đi chức danh" aria-label="Chức danh đã đi" onChange={(v) => set(index, { rank_id: v, vessel_type_id: null })} />
        : <Select {...selectProps} value={row.vessel_type_id ?? undefined} options={typeOptions} placeholder="Đã đi loại tàu" aria-label="Loại tàu đã đi" onChange={(v) => set(index, { vessel_type_id: v, rank_id: null })} />
    }
    return (
      <Select
        {...selectProps}
        value={row.certificate_type_id ?? undefined}
        options={certOptions(group)}
        placeholder={group === 'doc' ? 'Chọn giấy tờ' : 'Chọn chứng chỉ'}
        aria-label={group === 'doc' ? 'Giấy tờ' : 'Chứng chỉ'}
        onChange={(v) => set(index, { certificate_type_id: v, certificate_category: categoryOf(v) })}
      />
    )
  }

  function conditionCell({ row, index }) {
    if (row.kind === 'TEMPLATE') return <span className="rq__muted">Điền từ hồ sơ khi tạo bản xuất</span>
    if (row.kind === 'EXPERIENCE') {
      const byRank = row._by ? row._by === 'rank' : !!row.rank_id
      return byRank ? (
        <InputNumber min={1} max={600} value={row.min_months} addonAfter="tháng" aria-label="Số tháng tối thiểu" onChange={(v) => set(index, { min_months: v })} />
      ) : (
        <InputNumber min={1} max={200} value={row.min_trips} addonAfter="chuyến" aria-label="Số chuyến tối thiểu" onChange={(v) => set(index, { min_trips: v })} />
      )
    }
    return (
      <span className="rq__cond">
        <Select value={row.valid_until} options={VALID_OPTIONS} aria-label="Còn hạn tới" onChange={(v) => set(index, { valid_until: v, plus_months: v === 'LEAVE_PLUS' ? row.plus_months || 6 : null })} />
        {row.valid_until === 'LEAVE_PLUS' ? <InputNumber min={1} max={60} value={row.plus_months} addonAfter="tháng" aria-label="Số tháng cộng thêm" onChange={(v) => set(index, { plus_months: v })} /> : null}
      </span>
    )
  }

  return (
    <div className={`rq${changed ? ' rq--changed' : ''}`}>
      <div className="rq__head" role="row">
        <span>Yêu cầu</span>
        <span>Mức</span>
        <span>Điều kiện</span>
        <span />
      </div>
      {REQUIREMENT_GROUPS.map((group) => {
        const rows = indexed.filter((item) => item.group === group.key)
        if (!rows.length) return null
        return (
          <div key={group.key} className="rq__group">
            <p className="rq__group-title">{group.title}</p>
            {rows.map((item) => (
              <div key={item.index} className="rq__row">
                {nameCell(item)}
                {item.row.kind === 'TEMPLATE'
                  ? <span />
                  : <SegmentedPick size="small" value={item.row.level} options={LEVEL_OPTIONS} label="Mức" onChange={(v) => set(item.index, { level: v })} />}
                {conditionCell(item)}
                <Tooltip title="Xoá yêu cầu">
                  <Button type="text" icon={<CloseOutlined />} aria-label="Xoá yêu cầu" onClick={() => remove(item.index)} />
                </Tooltip>
              </div>
            ))}
          </div>
        )
      })}
      {!value.length ? <p className="rq__empty">Chưa có yêu cầu nào. Thêm giấy tờ, chứng chỉ, kinh nghiệm hoặc mẫu giấy bên dưới.</p> : null}
      <div className="rq__add">
        <Button type="text" icon={<PlusOutlined />} onClick={() => add('doc')}>Giấy tờ</Button>
        <Button type="text" icon={<PlusOutlined />} onClick={() => add('cert')}>Chứng chỉ</Button>
        <Button type="text" icon={<PlusOutlined />} onClick={() => add('expRank')}>Kinh nghiệm theo chức danh</Button>
        <Button type="text" icon={<PlusOutlined />} onClick={() => add('expType')}>Kinh nghiệm theo loại tàu</Button>
        <Button type="text" icon={<PlusOutlined />} onClick={() => add('tpl')}>Mẫu giấy</Button>
        {footer ? <span className="rq__footer">{footer}</span> : null}
      </div>
    </div>
  )
}
