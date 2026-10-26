import { Button, Select, Tooltip } from 'antd'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { SegmentedPick } from '../fleet/FleetParts'
import { LEVEL_LABELS } from '../../../constants/opportunityVoyage'
import { TEMPLATES } from '../exports/packModel'
import { DOC_CATEGORIES, REQUIREMENT_GROUPS, requirementGroup } from './opportunityView'

const LEVEL_OPTIONS = Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))
const selectProps = { showSearch: { optionFilterProp: 'label' }, style: { width: '100%' } }

const BLANK = {
  doc: { kind: 'CERTIFICATE', _group: 'doc', level: 'REQUIRED', valid_until: 'LEAVE' },
  cert: { kind: 'CERTIFICATE', _group: 'cert', level: 'REQUIRED', valid_until: 'LEAVE' },
  expRank: { kind: 'EXPERIENCE', _group: 'exp', _by: 'rank', level: 'REQUIRED', valid_until: 'ANY', min_months: 12 },
  tpl: { kind: 'TEMPLATE', _group: 'tpl', level: 'REQUIRED', valid_until: 'ANY' },
}

// Bảng hồ sơ yêu cầu trong form cơ hội (value / onChange của Form.Item). Chỉ dùng ở màn cơ hội.
// certTypes: [{ id, name_vi, category }], ranks, vesselTypes: lookup.
export default function RequirementTable({ value = [], onChange, certTypes = [], ranks = [], vesselTypes = [], changed = false, footer }) {
  const categoryOf = (id) => certTypes.find((c) => c.id === id)?.category
  const set = (index, patch) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const remove = (index) => onChange(value.filter((_, i) => i !== index))
  const add = (key) => onChange([...value, { ...BLANK[key] }])

  // Danh mục có vài loại trùng tên: mỗi tên hiện một lần (giữ lại loại đang được chọn).
  const certOptions = (group, selected) => {
    const seen = new Set()
    return certTypes
      .filter((c) => (group === 'doc') === DOC_CATEGORIES.includes(c.category))
      .filter((c) => {
        const key = c.name_vi.trim().toLowerCase()
        if (seen.has(key) && c.id !== selected) return false
        seen.add(key)
        return true
      })
      .map((c) => ({ value: c.id, label: c.name_vi }))
  }
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
        options={certOptions(group, row.certificate_type_id)}
        placeholder={group === 'doc' ? 'Chọn giấy tờ' : 'Chọn chứng chỉ'}
        aria-label={group === 'doc' ? 'Giấy tờ' : 'Chứng chỉ'}
        onChange={(v) => set(index, { certificate_type_id: v, certificate_category: categoryOf(v) })}
      />
    )
  }

  return (
    <div className={`rq${changed ? ' rq--changed' : ''}`}>
      <div className="rq__head" role="row">
        <span>Yêu cầu</span>
        <span>Mức</span>
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
        <Button type="text" icon={<PlusOutlined />} onClick={() => add('expRank')}>Kinh nghiệm</Button>
        <Button type="text" icon={<PlusOutlined />} onClick={() => add('tpl')}>Mẫu giấy</Button>
        {footer ? <span className="rq__footer">{footer}</span> : null}
      </div>
    </div>
  )
}
