import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon, { LeftOutlined, RightOutlined } from '@ant-design/icons'
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

// Cơ hội: hai vòng tròn đồng tâm và chấm giữa.
export const TargetSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
)

// Ô đầu dòng: tàu là hình tàu, đối tác là hai chữ đầu của tên.
export function FleetTile({ text, large, src, onClick, actionLabel, icon = ShipSvg }) {
  const className = `fl-tile${large ? ' fl-tile--lg' : ''}${src ? ' fl-tile--img' : ''}`
  const content = src ? <img src={src} alt="" /> : text || <Icon component={icon} />
  // Có onClick thì ô là nút bấm được (bấm ảnh logo để chọn ảnh mới), cùng kiểu ảnh chân dung ở form thuyền viên.
  if (onClick) {
    return (
      <button type="button" className={`${className} fl-tile--action`} aria-label={actionLabel} title="Bấm để chọn logo" onClick={onClick}>
        {content}
      </button>
    )
  }
  return (
    <span className={className} aria-hidden="true">
      {content}
    </span>
  )
}

// Quay lại màn vừa đi qua. Mở thẳng bằng link thì không có lịch sử trong app: ẩn nút, breadcrumb đã dẫn về danh sách.
export function BackButton() {
  const navigate = useNavigate()
  const { key } = useLocation()
  if (key === 'default') return null
  return (
    <button type="button" className="crew-crumb__back" onClick={() => navigate(-1)}>
      <LeftOutlined aria-hidden />Quay lại
    </button>
  )
}

// Breadcrumb theo cấu trúc dữ liệu (chủ tàu › tàu › chuyến › hợp đồng), không theo đường người dùng vừa đi.
export function Crumb({ items }) {
  return (
    <nav className="crew-crumb" aria-label="Đường dẫn">
      <BackButton />
      {items.map((item, index) => (
        <span key={`${index}-${item.label}`} style={{ display: 'contents' }}>
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
        {total > 0 && section.fields.length > 1 ? <span className="sf-panel__meta" style={{ paddingTop: 0 }}>{done}/{total}</span> : null}
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

export function FormAside({ tile, name, sub, note, done, total, sections, stats, active, onGo }) {
  const percent = total ? Math.round((done / total) * 100) : 0
  return (
    <aside className="sf-aside" aria-label="Tóm tắt">
      <div className="sf-who">
        {tile}
        <div className="sf-who__text">
          <p className="sf-who__name">{name}</p>
          {sub ? <p className="sf-who__sub">{sub}</p> : null}
          {note ? <p className="sf-who__sub">{note}</p> : null}
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

// `action`: nút đặt ở đầu khối, cạnh số mục đã điền (ví dụ nút Quét danh thiếp).
export function FormSection({ index, section, meta, action, children }) {
  return (
    <section className="sf-panel" id={`sf-${section.key}`} aria-labelledby={`sf-${section.key}-title`}>
      <div className="sf-panel__head">
        <span className="sf-step">{index + 1}</span>
        <div className="sf-panel__text">
          <h2 className="sf-panel__title" id={`sf-${section.key}-title`}>{section.title}</h2>
          {section.desc ? <p className="sf-panel__desc">{section.desc}</p> : null}
        </div>
        {action ? <div className="sf-panel__scans">{action}</div> : null}
        <span className="sf-panel__meta">{meta}</span>
      </div>
      <div className="sf-panel__body">{children}</div>
    </section>
  )
}

// Chọn một giá trị, luôn có một giá trị được chọn (khác ChoiceGroup: không bỏ chọn được).
// `size="small"` cho ô hẹp (ma trận vai trò).
export function SegmentedPick({ value, onChange, options, label, size, className = '' }) {
  return (
    <div className={`${size === 'small' ? 'sf-seg sf-seg--sm' : 'sf-seg'} ${className}`.trim()} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" aria-pressed={value === option.value} onClick={() => onChange?.(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

// Khung form: tiêu đề, cột tóm tắt + mục lục bên trái, `children` (thường là <Form className="sf-sections">) bên phải.
export function FormFrame({ crumbs, title, description, tile, name, sub, note, sections, stats, done, total, children }) {
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
        <FormAside tile={tile} name={name} sub={sub} note={note} done={done} total={total} sections={sections} stats={stats} active={active} onGo={goTo} />
        {children}
      </div>
    </div>
  )
}
