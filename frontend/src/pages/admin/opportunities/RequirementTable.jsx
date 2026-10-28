import { Button, InputNumber, Select, Tooltip } from 'antd'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { SegmentedPick } from '../fleet/FleetParts'
import { LEVEL_LABELS, VALID_UNTIL_LABELS } from '../../../constants/opportunityVoyage'
import { TEMPLATES } from '../exports/packModel'
import { CATEGORY } from '../seafarers/certificateView'
import { REQUIREMENT_GROUPS, requirementGroup } from './opportunityView'

const LEVEL_OPTIONS = Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))
const VALID_OPTIONS = Object.entries(VALID_UNTIL_LABELS).map(([value, label]) => ({ value, label }))
const EXP_BY = [{ value: 'rank', label: 'Chức danh' }, { value: 'type', label: 'Loại tàu' }]
const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' }, style: { width: '100%' } }

const BLANK = {
  doc: { kind: 'CERTIFICATE', level: 'REQUIRED', valid_until: 'LEAVE' },
  tpl: { kind: 'TEMPLATE', level: 'REQUIRED', valid_until: 'ANY' },
  exp: { kind: 'EXPERIENCE', _by: 'rank', level: 'REQUIRED', valid_until: 'ANY', min_months: 12 },
}

// Hồ sơ yêu cầu trong form cơ hội (value / onChange của Form.Item), chia ba khối: Giấy tờ, Biểu mẫu, Kinh nghiệm.
// Mỗi khối có nút Thêm riêng. Giấy tờ: loại giấy (nhóm theo Tuỳ thân, STCW, Y tế…), còn hạn tới mốc nào, mức.
// Biểu mẫu: mẫu cần nộp. Kinh nghiệm: số tháng theo chức danh hoặc số chuyến theo loại tàu, mức.
// certTypes: [{ id, name_vi, category }], ranks, vesselTypes: lookup.
export default function RequirementTable({ value = [], onChange, certTypes = [], ranks = [], vesselTypes = [], changed = false }) {
  const categoryOf = (id) => certTypes.find((c) => c.id === id)?.category
  const set = (index, patch) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const remove = (index) => onChange(value.filter((_, i) => i !== index))
  const add = (group) => onChange([...value, { ...BLANK[group] }])

  // Loại giấy nhóm theo danh mục; tên trùng chỉ hiện một lần (giữ lại loại đang được chọn).
  const docOptions = (selected) => {
    const seen = new Set()
    const unique = certTypes.filter((c) => {
      const key = c.name_vi.trim().toLowerCase()
      if (seen.has(key) && c.id !== selected) return false
      seen.add(key)
      return true
    })
    return Object.entries(CATEGORY)
      .map(([key, label]) => ({ label, options: unique.filter((c) => (c.category || 'OTHER') === key).map((c) => ({ value: c.id, label: c.name_vi })) }))
      .filter((group) => group.options.length)
  }
  const rankOptions = ranks.map((r) => ({ value: r.id, label: r.name_vi }))
  const typeOptions = vesselTypes.map((t) => ({ value: t.id, label: t.name_vi }))
  const usedTemplates = new Set(value.filter((r) => r.kind === 'TEMPLATE').map((r) => r.template_key))
  const templateOptions = (selected) => TEMPLATES.map((t) => ({ value: t.key, label: t.name, disabled: usedTemplates.has(t.key) && t.key !== selected }))

  const indexed = value.map((row, index) => ({ row, index, group: requirementGroup(row) }))
  const level = (row, index) => <SegmentedPick size="small" value={row.level} options={LEVEL_OPTIONS} label="Mức" onChange={(v) => set(index, { level: v })} />
  const removeButton = (index) => (
    <Tooltip title="Xoá yêu cầu">
      <Button type="text" icon={<CloseOutlined />} aria-label="Xoá yêu cầu" onClick={() => remove(index)} />
    </Tooltip>
  )

  function docRow({ row, index }) {
    return (
      <div key={index} className="rq__row">
        <div className="rq__fields">
          <Select
            {...selectProps}
            value={row.certificate_type_id ?? undefined}
            options={docOptions(row.certificate_type_id)}
            placeholder="Chọn giấy tờ"
            aria-label="Giấy tờ"
            onChange={(v) => set(index, { certificate_type_id: v, certificate_category: categoryOf(v) })}
          />
          <div className="rq__inline">
            <Select value={row.valid_until} options={VALID_OPTIONS} aria-label="Còn hạn tới" popupMatchSelectWidth={false} onChange={(v) => set(index, { valid_until: v, plus_months: v === 'LEAVE_PLUS' ? row.plus_months || 6 : null })} />
            {row.valid_until === 'LEAVE_PLUS' ? <InputNumber min={1} max={60} value={row.plus_months} suffix="tháng" aria-label="Số tháng sau ngày rời" onChange={(v) => set(index, { plus_months: v })} /> : null}
          </div>
        </div>
        {level(row, index)}
        {removeButton(index)}
      </div>
    )
  }

  function templateRow({ row, index }) {
    return (
      <div key={index} className="rq__row">
        <Select {...selectProps} value={row.template_key ?? undefined} options={templateOptions(row.template_key)} placeholder="Chọn biểu mẫu" aria-label="Biểu mẫu" onChange={(v) => set(index, { template_key: v })} />
        <span className="rq__muted">Phải nộp</span>
        {removeButton(index)}
      </div>
    )
  }

  function experienceRow({ row, index }) {
    const byRank = row._by ? row._by === 'rank' : !!row.rank_id || !row.vessel_type_id
    return (
      <div key={index} className="rq__row">
        <div className="rq__fields">
          <SegmentedPick
            size="small"
            value={byRank ? 'rank' : 'type'}
            options={EXP_BY}
            label="Kinh nghiệm theo"
            onChange={(v) => set(index, v === 'rank'
              ? { _by: 'rank', vessel_type_id: null, min_trips: null, min_months: row.min_months || 12 }
              : { _by: 'type', rank_id: null, min_months: null, min_trips: row.min_trips || 1 })}
          />
          <div className="rq__inline">
            {byRank
              ? <Select {...selectProps} value={row.rank_id ?? undefined} options={rankOptions} placeholder="Đã đi chức danh" aria-label="Chức danh đã đi" onChange={(v) => set(index, { rank_id: v })} />
              : <Select {...selectProps} value={row.vessel_type_id ?? undefined} options={typeOptions} placeholder="Đã đi loại tàu" aria-label="Loại tàu đã đi" onChange={(v) => set(index, { vessel_type_id: v })} />}
            {byRank
              ? <InputNumber min={1} max={600} value={row.min_months} suffix="tháng" aria-label="Số tháng tối thiểu" onChange={(v) => set(index, { min_months: v })} />
              : <InputNumber min={1} max={100} value={row.min_trips} suffix="chuyến" aria-label="Số chuyến tối thiểu" onChange={(v) => set(index, { min_trips: v })} />}
          </div>
        </div>
        {level(row, index)}
        {removeButton(index)}
      </div>
    )
  }

  const ROW = { doc: docRow, tpl: templateRow, exp: experienceRow }
  return (
    <div className={`rq${changed ? ' rq--changed' : ''}`}>
      {REQUIREMENT_GROUPS.map((group) => {
        const rows = indexed.filter((item) => item.group === group.key)
        return (
          <section key={group.key} className="rq__group" aria-label={group.title}>
            <div className="rq__group-head">
              <div>
                <p className="rq__group-title">{group.title} <span className="rq__count">{rows.length}</span></p>
                <p className="rq__group-hint">{group.hint}</p>
              </div>
              <Button size="small" icon={<PlusOutlined />} onClick={() => add(group.key)}>{group.add}</Button>
            </div>
            {rows.length ? rows.map((item) => ROW[group.key](item)) : <p className="rq__empty">{group.empty}</p>}
          </section>
        )
      })}
    </div>
  )
}
