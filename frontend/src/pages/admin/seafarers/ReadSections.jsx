import { useState } from 'react'
import { Button, Input, Skeleton } from 'antd'
import { countFilled, filled } from './readSectionUtils'
import useScrollSpy from '../fleet/useScrollSpy'
import { FormToc } from '../fleet/FleetParts'
import InfoTable, { InfoList } from '../../../components/ds/InfoTable'

// Các khối chỉ đọc dùng chung cho màn chi tiết thuyền viên và đối tác: mục lục bên trái, các khối đánh số bên phải.
// Mỗi khối: { key, title, fields | groups | items, unit?, footnote? }; mỗi trường: [nhãn, giá trị, độ rộng 12 cột].
export function Info({ label, value, span }) {
  return (
    <div className={`sf-ro${span && span < 12 ? ` sf-c${span}` : ''}`}>
      <dt className="sf-ro__label">{label}</dt>
      <dd className="sf-ro__value">{filled(value) ? value : <span className="sf-ro__empty">Chưa có</span>}</dd>
    </div>
  )
}

export const Grid = ({ fields }) => (
  <dl className="sf-grid">
    {fields.map(([label, value, span]) => <Info key={label} label={label} value={value} span={span} />)}
  </dl>
)

// Khối chỉ đọc dạng bảng gọn: trường và nhóm thành InfoTable, bản ghi lặp thành InfoList.
export function Panel({ section, half = false }) {
  const tableFields = [
    ...(section.fields || []),
    ...(section.groups || []).flatMap((group) => [{ sub: group.sub }, ...group.fields]),
  ]
  return (
    <section className={`sf-panel sf-panel--ro${half ? ' sf-panel--half' : ''}`} id={`sf-${section.key}`} aria-labelledby={`sf-${section.key}-title`}>
      <div className="sf-panel__head">
        <h3 className="sf-panel__title" id={`sf-${section.key}-title`}>{section.title}</h3>
        {(!section.content || section.countLabel !== undefined) && <span className="sf-panel__meta">{countFilled(section)}</span>}
      </div>
      {section.content ? <div className="sf-panel__body">{section.content}</div> : null}
      {section.items ? (
        section.items.length ? <InfoList items={section.items} /> : <p className="sf-ro__empty sf-panel__none">{section.itemsEmpty}</p>
      ) : null}
      {tableFields.length ? <InfoTable fields={tableFields} pairs={half ? 1 : 2} /> : null}
      {section.footnote ? <p className="sf-ro__empty sf-panel__none">{section.footnote}</p> : null}
    </section>
  )
}

// Khối ngắn (chỉ có trường, ≤ 8 trường) đứng cạnh khối ngắn liền sau nó thành hai cột.
const isShort = (s) => s.fields && !s.items && !s.groups && !s.content && s.fields.length <= 8
function halfKeys(sections) {
  const keys = new Set()
  for (let i = 0; i < sections.length - 1; i++) {
    if (isShort(sections[i]) && isShort(sections[i + 1])) { keys.add(sections[i].key); keys.add(sections[i + 1].key); i++ }
  }
  return keys
}

export function ReadLayout({ sections, loading, label = 'hồ sơ' }) {
  const half = halfKeys(sections)
  const [active, setActive] = useScrollSpy(sections.map((s) => s.key), !loading)

  const goTo = (key) => (event) => {
    event.preventDefault()
    setActive(key)
    document.getElementById(`sf-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="sf-layout sf-layout--ro">
      <aside className="sf-aside" aria-label={`Tóm tắt ${label}`}>
        <FormToc activeKey={active} label={`Các mục của ${label}`}>
          {sections.map((s, i) => (
            <a key={s.key} href={`#sf-${s.key}`} aria-current={active === s.key ? 'true' : undefined} onClick={goTo(s.key)}>
              <span className="sf-toc__n">{i + 1}</span>
              {s.title}
              <span className="sf-toc__cnt">{countFilled(s)}</span>
            </a>
          ))}
        </FormToc>
      </aside>
      <div className="sf-sections">
        {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : sections.map((s) => <Panel key={s.key} section={s} half={half.has(s.key)} />)}
      </div>
    </div>
  )
}

// Ghi chú ở đầu màn chi tiết, sửa ngay tại chỗ. `onSave(text)` trả Promise; lưu xong ném lỗi thì giữ ô sửa.
export function NotePanel({ notes, canEdit, onSave, saving, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start = () => { setDraft(notes || ''); setEditing(true) }
  if (!filled(notes) && !editing && !canEdit) return null
  return (
    <div className={`sf-note ${className}`.trim()} role="note">
      <div className="sf-note__head">
        <span className="sf-note__title">Ghi chú</span>
        {canEdit && !editing && <Button type="link" size="small" onClick={start}>{filled(notes) ? 'Sửa' : 'Thêm'}</Button>}
      </div>
      {editing ? (
        <>
          <Input.TextArea value={draft} onChange={(e) => setDraft(e.target.value)} autoSize={{ minRows: 3, maxRows: 10 }} maxLength={2000} autoFocus />
          <div className="sf-note__actions">
            <Button size="small" onClick={() => setEditing(false)}>Huỷ</Button>
            <Button size="small" type="primary" loading={saving} disabled={draft.trim() === (notes || '').trim()} onClick={() => onSave(draft.trim() || null).then(() => setEditing(false), () => {})}>Lưu</Button>
          </div>
        </>
      ) : filled(notes) ? (
        <div className="sf-note__body">{notes}</div>
      ) : (
        <div className="sf-ro__empty">Chưa có ghi chú.</div>
      )}
    </div>
  )
}
