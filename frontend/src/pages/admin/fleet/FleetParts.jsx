import { Link } from 'react-router-dom'
import Icon, { RightOutlined } from '@ant-design/icons'
import { filled, countFilled } from './fleetView'
import useScrollSpy from './useScrollSpy'
import '../seafarers/SeafarerForm.css'
import '../seafarers/SeafarerProfile.css'
import './fleet.css'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
export const ShipSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...stroke}>
    <path d="M12 3v9M12 5h5l-5 4M3 15l2 4h14l2-4-9-3z" />
    <path d="M2 21c2 0 2-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
  </svg>
)

// Ô đầu dòng: tàu là hình tàu, đối tác là hai chữ đầu của tên.
export function FleetTile({ text, large }) {
  return (
    <span className={`fl-tile${large ? ' fl-tile--lg' : ''}`} aria-hidden="true">
      {text || <Icon component={ShipSvg} />}
    </span>
  )
}

export function Crumb({ items }) {
  return (
    <nav className="crew-crumb" aria-label="Đường dẫn">
      {items.map((item, index) => (
        <span key={item.label} style={{ display: 'contents' }}>
          {index > 0 ? <RightOutlined aria-hidden /> : null}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}

// ---- Màn chi tiết: khối chỉ đọc ----

function ReadField({ label, value, span, kind }) {
  const cls = span && span < 12 ? ` sf-c${span}` : ''
  const empty = !filled(value)
  return (
    <div className={`sf-ro${cls}`}>
      <dt className="sf-ro__label">{label}</dt>
      <dd className={`sf-ro__value${kind === 'mono' ? ' fl-mono' : ''}`}>{empty ? <span className="sf-ro__empty">Chưa có</span> : value}</dd>
    </div>
  )
}

export function ReadPanel({ section }) {
  const { done, total } = countFilled(section)
  return (
    <section className="crew-panel">
      <div className="crew-panel__head">
        <h2 className="crew-panel__title">{section.title}</h2>
        {section.fields.length > 1 ? <span className="sf-panel__meta" style={{ paddingTop: 0 }}>{done}/{total}</span> : null}
      </div>
      <div className="crew-panel__body">
        <dl className="sf-grid">
          {section.fields.map(([label, value, span, kind]) => (
            <ReadField key={label} label={label} value={value} span={span} kind={kind} />
          ))}
        </dl>
      </div>
    </section>
  )
}

export function SidePanel({ title, action, children }) {
  return (
    <section className="crew-panel">
      <div className="crew-panel__head">
        <h2 className="crew-panel__title">{title}</h2>
        {action}
      </div>
      <div className="crew-panel__body">{children}</div>
    </section>
  )
}

// ---- Form: khung giống form thuyền viên (mục lục bên trái, khối đánh số bên phải) ----

export function FormHead({ crumbs, title, description }) {
  return (
    <div>
      <nav className="sf-crumb" aria-label="Đường dẫn">
        {crumbs.map((item, index) => (
          <span key={item.label} style={{ display: 'contents' }}>
            {index > 0 ? <RightOutlined aria-hidden /> : null}
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </span>
        ))}
      </nav>
      <h1 className="sf-head__title">{title}</h1>
      {description ? <p className="sf-head__desc">{description}</p> : null}
    </div>
  )
}

export function FormAside({ tile, name, sub, done, total, sections, stats, active, onGo }) {
  const percent = total ? Math.round((done / total) * 100) : 0
  return (
    <aside className="sf-aside" aria-label="Tóm tắt">
      <div className="sf-who">
        {tile}
        <div className="sf-who__text">
          <p className="sf-who__name">{name}</p>
          {sub ? <p className="sf-who__sub">{sub}</p> : null}
        </div>
      </div>
      <div className="sf-progress">
        <div className="sf-progress__top"><span>Đã điền</span><span>{done}/{total}</span></div>
        <div className="sf-bar"><span style={{ width: `${percent}%` }} /></div>
      </div>
      <nav className="sf-toc" aria-label="Các mục của form">
        {sections.map((section, index) => (
          <a key={section.key} href={`#sf-${section.key}`} aria-current={active === section.key ? 'true' : undefined} onClick={onGo(section.key)}>
            <span className="sf-toc__n">{index + 1}</span>
            {section.title}
            <span className="sf-toc__cnt">{stats[index]}</span>
          </a>
        ))}
      </nav>
    </aside>
  )
}

export function FormSection({ index, section, meta, children }) {
  return (
    <section className="sf-panel" id={`sf-${section.key}`} aria-labelledby={`sf-${section.key}-title`}>
      <div className="sf-panel__head">
        <span className="sf-step">{index + 1}</span>
        <div>
          <h2 className="sf-panel__title" id={`sf-${section.key}-title`}>{section.title}</h2>
          {section.desc ? <p className="sf-panel__desc">{section.desc}</p> : null}
        </div>
        <span className="sf-panel__meta">{meta}</span>
      </div>
      <div className="sf-panel__body">{children}</div>
    </section>
  )
}

// Chọn một giá trị, luôn có một giá trị được chọn (khác ChoiceGroup: không bỏ chọn được).
export function SegmentedPick({ value, onChange, options, label }) {
  return (
    <div className="sf-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" aria-pressed={value === option.value} onClick={() => onChange?.(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

// Khung form: tiêu đề, cột tóm tắt + mục lục bên trái, `children` (thường là <Form className="sf-sections">) bên phải.
export function FormFrame({ crumbs, title, description, tile, name, sub, sections, stats, done, total, children }) {
  const [active, setActive] = useScrollSpy(sections.map((section) => section.key))
  const goTo = (key) => (event) => {
    event.preventDefault()
    setActive(key)
    document.getElementById(`sf-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div className="ds-page">
      <FormHead crumbs={crumbs} title={title} description={description} />
      <div className="sf-layout">
        <FormAside tile={tile} name={name} sub={sub} done={done} total={total} sections={sections} stats={stats} active={active} onGo={goTo} />
        {children}
      </div>
    </div>
  )
}
