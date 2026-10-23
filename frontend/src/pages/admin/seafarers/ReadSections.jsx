import { useEffect, useState } from 'react'
import { Button, Input, Skeleton, Tag } from 'antd'
import { countFilled, filled } from './readSectionUtils'

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

export function Panel({ index, section }) {
  return (
    <section className="sf-panel" id={`sf-${section.key}`} aria-labelledby={`sf-${section.key}-title`}>
      <div className="sf-panel__head">
        <span className="sf-step">{index + 1}</span>
        <div><h3 className="sf-panel__title" id={`sf-${section.key}-title`}>{section.title}</h3></div>
        <span className="sf-panel__meta">{countFilled(section)}</span>
      </div>
      <div className="sf-panel__body">
        {section.fields ? <Grid fields={section.fields} /> : null}
        {section.items ? (
          section.items.length ? (
            <div className="sf-items">
              {section.items.map((item) => (
                <div className="sf-item" key={item.title}>
                  <div className="sf-item__head">
                    <h4 className="sf-item__title">{item.title}</h4>
                    {item.tags?.map((tag) => <Tag key={tag} color={tag === 'Bảo lãnh' ? 'orange' : 'blue'}>{tag}</Tag>)}
                  </div>
                  <div className="sf-item__body"><Grid fields={item.fields} /></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="sf-ro__empty">{section.itemsEmpty}</p>
          )
        ) : null}
        {section.groups?.map((group) => (
          <div key={group.sub} className="sf-ro-group">
            <div className="sf-sub">{group.sub}</div>
            <Grid fields={group.fields} />
          </div>
        ))}
        {section.footnote ? <p className="sf-ro__empty" style={{ margin: '12px 0 0' }}>{section.footnote}</p> : null}
      </div>
    </section>
  )
}


export function ReadLayout({ sections, loading, label = 'hồ sơ' }) {
  const [active, setActive] = useState(sections[0]?.key)
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`sf-${s.key}`)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id.slice(3))
      },
      { rootMargin: '-96px 0px -60% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const goTo = (key) => (event) => {
    event.preventDefault()
    setActive(key)
    document.getElementById(`sf-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="sf-layout">
      <aside className="sf-aside" aria-label={`Tóm tắt ${label}`}>
        <nav className="sf-toc" aria-label={`Các mục của ${label}`}>
          {sections.map((s, i) => (
            <a key={s.key} href={`#sf-${s.key}`} aria-current={active === s.key ? 'true' : undefined} onClick={goTo(s.key)}>
              <span className="sf-toc__n">{i + 1}</span>
              {s.title}
              <span className="sf-toc__cnt">{countFilled(s)}</span>
            </a>
          ))}
        </nav>
      </aside>
      <div className="sf-sections">
        {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : sections.map((s, i) => <Panel key={s.key} index={i} section={s} />)}
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
