import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Skeleton } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  MinusOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  CalendarOutlined,
  RightOutlined,
  UndoOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { seafarerApi } from '../../../api'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'
import { DEMO_DOCS, DONE_STATES, docStatus, nextTodo, progress, totalTodo, updateField } from './reviewModel'
import '../seafarers/SeafarerProfile.css'
import './ReviewPage.css'

const MARKS = {
  ACCEPTED: <CheckOutlined />,
  EDITED: <EditOutlined />,
  UNKNOWN: <QuestionCircleOutlined />,
  UNKNOWN_KEPT: <LockOutlined />,
  DATE_AMBIGUOUS: <CalendarOutlined />,
  REJECTED: <CloseOutlined />,
}

// Một tờ giấy: bản gốc (nét chữ tay trên nền giấy) hoặc bản số hoá (ô giá trị theo trạng thái).
function Paper({ doc, mode, focus, onFocus, zoom = 1 }) {
  const original = mode === 'goc'
  return (
    <div className={original ? 'rv-paper rv-paper--goc' : 'rv-paper rv-paper--so'} style={original ? { zoom } : undefined}>
      <p className="rv-paper__title">
        {doc.title[0]}
        <i>{doc.title[1]}</i>
      </p>
      {doc.photo && <span className="rv-paper__photo" aria-hidden>{original ? 'Ảnh' : <UserOutlined />}</span>}
      <div className="rv-paper__fields">
        {doc.fields.map((field) => (
          <button
            type="button"
            key={field.key}
            className={['rv-pf', field.half && 'rv-pf--half', focus === field.key && 'rv-pf--focus'].filter(Boolean).join(' ')}
            aria-pressed={focus === field.key}
            onClick={() => onFocus(field.key)}
          >
            <span className="rv-pf__label">
              {field.label}
              <i>{field.english}</i>
            </span>
            {original ? (
              <span className={field.raw ? 'rv-ink' : 'rv-ink rv-ink--blank'}>{field.raw || ' '}</span>
            ) : (
              <span className="rv-dv" data-st={field.state}>
                <span>{['UNKNOWN', 'UNKNOWN_KEPT'].includes(field.state) && !field.value ? 'Không có trên giấy' : field.value}</span>
                {MARKS[field.state] && <span className="rv-dv__mark" aria-hidden>{MARKS[field.state]}</span>}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="rv-paper__stamps">
        {doc.stamps.map((stamp) => (
          <span key={stamp} className="rv-paper__stamp">
            {original && <span className="rv-seal" aria-hidden />}
            {stamp}
          </span>
        ))}
      </div>
    </div>
  )
}

// Thanh hành động của ô đang chọn: dính đáy màn hình. Đổi ô thì dựng lại (key) để bỏ bản nháp.
function FieldBar({ field, onAction }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(field.value)

  const decided = DONE_STATES.includes(field.state)
  const note = field.note || (decided ? 'Đã quyết ô này. Hoàn tác nếu muốn xem lại.' : 'AI đọc rõ. Kiểm lại với bản gốc rồi chấp nhận.')
  return (
    <div className="rv-bar" role="region" aria-label={`Ô ${field.label}`}>
      <div className="rv-bar__text">
        <p className="rv-bar__label">
          {field.label} <StatusBadge group="field" value={field.state} />
        </p>
        <p className="rv-bar__note">
          Trên giấy: <b className="rv-ink-inline">{field.raw || 'để trống'}</b> → {field.value || 'không có'}. {note}
        </p>
      </div>
      {editing ? (
        <form className="rv-bar__actions" onSubmit={(event) => { event.preventDefault(); onAction('edit', draft) }}>
          <Input autoFocus aria-label={`Giá trị ${field.label}`} value={draft} onChange={(event) => setDraft(event.target.value)} className="rv-bar__input" />
          <Button type="primary" htmlType="submit" disabled={!draft.trim()}>Lưu</Button>
          <Button onClick={() => setEditing(false)}>Huỷ</Button>
        </form>
      ) : (
        <div className="rv-bar__actions">
          {decided ? (
            <Button icon={<UndoOutlined />} onClick={() => onAction('undo')}>Hoàn tác</Button>
          ) : (
            <>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => onAction(field.value ? 'accept' : 'keepUnknown')}>
                {field.value ? `Chấp nhận${field.state === 'DATE_AMBIGUOUS' ? ` ${field.value}` : ''}` : 'Giữ UNKNOWN'}
              </Button>
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>{field.value ? 'Sửa' : 'Nhập tay'}</Button>
              {field.value && <Button icon={<CloseOutlined />} onClick={() => onAction('reject')}>Từ chối</Button>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [docs, setDocs] = useState(DEMO_DOCS)
  const [docKey, setDocKey] = useState('so-45')
  const [focus, setFocus] = useState('off')
  const [view, setView] = useState('so')
  const [zoom, setZoom] = useState(1)
  const [saved, setSaved] = useState(true)

  const { data: seafarer, isLoading, isError, refetch } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
  })

  if (isError) {
    return <EmptyState isError title="Không tải được giấy tờ" description="Mất kết nối tới máy chủ. Phần đã duyệt vẫn được giữ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  }

  const doc = docs.find((item) => item.key === docKey)
  const field = doc.fields.find((item) => item.key === focus)
  const count = progress(doc)
  const todo = totalTodo(docs)
  const name = seafarer?.full_name || ''

  function pickDoc(key) {
    const next = docs.find((item) => item.key === key)
    setDocKey(key)
    setFocus(nextTodo(next, null) || next.fields[0].key)
  }

  function act(action, value) {
    const updated = updateField(docs, docKey, focus, action, value)
    setDocs(updated)
    setSaved(false)
    setTimeout(() => setSaved(true), 400)
    if (action !== 'undo') {
      const following = nextTodo(updated.find((item) => item.key === docKey), focus)
      if (following) setFocus(following)
    }
  }

  return (
    <div className="ds-page rv">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        <Link to="/seafarers">Thuyền viên</Link>
        <RightOutlined aria-hidden />
        {isLoading ? <span>…</span> : <Link to={`/seafarers/${id}`}>{name}</Link>}
        <RightOutlined aria-hidden />
        <span aria-current="page">Duyệt giấy tờ</span>
      </nav>

      <div role="status" className="ds-banner ds-banner--warning">
        <ExclamationCircleOutlined className="ds-banner__icon" aria-hidden />
        <div className="ds-banner__body">
          <p className="ds-banner__title">Đang xem bằng giấy tờ mẫu</p>
          <p className="ds-banner__text">AI đọc giấy tờ chưa được nối, các ô dưới đây là dữ liệu giả để thử luồng duyệt. Kết quả duyệt chưa được lưu vào hồ sơ.</p>
        </div>
      </div>

      <div className="rv-head">
        <div className="rv-head__text">
          {isLoading ? <Skeleton.Input active size="small" style={{ width: 280 }} /> : <h1 className="rv-head__title">Duyệt giấy tờ của {name}</h1>}
          <p className="rv-head__desc">{docs.length} giấy tờ trong lần tải này</p>
        </div>
        <div>
          <div className="rv-head__actions">
            <span role="status" className="ds-save">{saved ? <><CheckOutlined aria-hidden /> Đã lưu</> : 'Đang lưu…'}</span>
            <Button type="primary" disabled={todo > 0} onClick={() => navigate(`/seafarers/${id}`)}>Đưa vào hồ sơ</Button>
          </div>
          <p className="rv-head__note">{todo > 0 ? `Còn ${todo} ô chưa duyệt` : 'Đã duyệt hết, đưa vào hồ sơ được'}</p>
        </div>
      </div>

      <div className="rv-docs" role="tablist" aria-label="Giấy tờ trong lần tải này">
        {docs.map((item) => {
          const p = progress(item)
          return (
            <button key={item.key} type="button" role="tab" aria-selected={item.key === docKey} onClick={() => pickDoc(item.key)}>
              <span className="rv-docs__name">{item.label}</span>
              <span className="rv-docs__meta">
                {item.page} · <StatusBadge group="document" value={docStatus(item)} />
                <span className="ds-num">{p.done}/{p.total}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="rv-seg" role="group" aria-label="Xem">
        <button type="button" aria-pressed={view === 'goc'} onClick={() => setView('goc')}>Bản gốc</button>
        <button type="button" aria-pressed={view === 'so'} onClick={() => setView('so')}>Bản số hoá</button>
      </div>

      <div className="rv-cmp" data-view={view}>
        <section className="rv-pane rv-pane--goc" aria-label="Bản gốc">
          <header className="rv-pane__head">
            <span className="rv-pane__title">Bản gốc</span>
            <span className="rv-muted rv-pane__file">{doc.file}</span>
            <span className="rv-pane__tools">
              <Button type="text" size="small" icon={<MinusOutlined />} aria-label="Thu nhỏ" disabled={zoom <= 0.75} onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))} />
              <span className="ds-num rv-muted">{Math.round(zoom * 100)}%</span>
              <Button type="text" size="small" icon={<PlusOutlined />} aria-label="Phóng to" disabled={zoom >= 1.5} onClick={() => setZoom((z) => Math.min(1.5, z + 0.25))} />
            </span>
          </header>
          <div className="rv-pane__stage">
            <Paper doc={doc} mode="goc" focus={focus} onFocus={setFocus} zoom={zoom} />
          </div>
        </section>
        <section className="rv-pane rv-pane--so" aria-label="Bản số hoá">
          <header className="rv-pane__head">
            <span className="rv-pane__title">Bản số hoá</span>
            <span className="rv-muted ds-num">{count.done} / {count.total} ô đã duyệt</span>
          </header>
          <div className="rv-pane__stage">
            <Paper doc={doc} mode="so" focus={focus} onFocus={setFocus} />
          </div>
        </section>
      </div>

      {field && <FieldBar key={`${docKey}-${field.key}-${field.state}-${field.value}`} field={field} onAction={act} />}
    </div>
  )
}
