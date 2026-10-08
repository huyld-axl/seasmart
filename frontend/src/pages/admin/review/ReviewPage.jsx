import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Skeleton } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ReloadOutlined,
  LockOutlined,
  MinusOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  CalendarOutlined,
  RightOutlined,
  UndoOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { seafarerApi } from '../../../api'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'
import { documentApi } from '../../../api/documentApi'
import Banner from '../../../components/ds/Banner'
import { DONE_STATES, canPublish, docStatus, fromApi, nextTodo, progress, reviewable, totalTodo } from './reviewModel'
import '../seafarers/SeafarerProfile.css'
import './ReviewPage.css'
import VesselMatchPanel from './VesselMatchPanel'
import useToast from '../../../components/ds/useToast'

const MARKS = {
  ACCEPTED: <CheckOutlined />,
  EDITED: <EditOutlined />,
  UNKNOWN: <QuestionCircleOutlined />,
  UNKNOWN_KEPT: <LockOutlined />,
  DATE_AMBIGUOUS: <CalendarOutlined />,
  REJECTED: <CloseOutlined />,
}

// Bản số hoá: ô giá trị theo trạng thái, xếp đúng thứ tự trên giấy.
function Paper({ doc, focus, onFocus }) {
  return (
    <div className="rv-paper rv-paper--so">
      <p className="rv-paper__title">
        {doc.title[0]}
        <i>{doc.title[1]}</i>
      </p>
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
            <span className="rv-dv" data-st={field.state}>
              <span>{['UNKNOWN', 'UNKNOWN_KEPT'].includes(field.state) && !field.value ? 'Không có trên giấy' : field.value}</span>
              {MARKS[field.state] && <span className="rv-dv__mark" aria-hidden>{MARKS[field.state]}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Bản gốc: ảnh hoặc PDF thật đã tải lên.
function OriginalFile({ doc, zoom }) {
  const { data: blob, isError } = useQuery({ queryKey: ['document-file', doc.id], queryFn: () => documentApi.file(doc.id), staleTime: Infinity })
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (isError) return <p className="rv-muted">Không tải được tệp gốc.</p>
  if (!url) return <Skeleton.Image active style={{ width: 320, height: 420 }} />
  if (doc.mime === 'application/pdf') return <iframe title={`Bản gốc ${doc.file}`} src={url} className="rv-file rv-file--pdf" />
  return <img src={url} alt={`Bản gốc ${doc.file}`} className="rv-file" style={{ width: `${zoom * 100}%` }} />
}

// Thanh hành động của ô đang chọn: dính đáy màn hình. Đổi ô thì dựng lại (key) để bỏ bản nháp.
function FieldBar({ field, onAction, onMatchVessel }) {
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
          {onMatchVessel && <Button icon={<SearchOutlined />} onClick={onMatchVessel}>Đối chiếu tàu</Button>}
        </div>
      )}
    </div>
  )
}

// Thông tin tàu đọc từ giấy, để đối chiếu với danh mục Tàu (B1).
function vesselOnPaper(doc) {
  const raw = (key) => doc.fields.find((f) => f.key === key)?.raw || ''
  return { name: raw('ship'), imo: raw('imo'), gt: raw('gt'), flag: raw('flag'), owner: raw('owner') }
}

export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [docKey, setDocKey] = useState(null)
  const [focus, setFocus] = useState(null)
  const [view, setView] = useState('so')
  const [zoom, setZoom] = useState(1)
  const [matching, setMatching] = useState(false)
  const toast = useToast()

  const { data: seafarer, isLoading } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
  })
  const docsQuery = useQuery({
    queryKey: ['documents', id],
    queryFn: () => documentApi.list(id),
    // Giấy đang được AI đọc: hỏi lại mỗi 3 giây tới khi xong.
    refetchInterval: (query) => (query.state.data?.data.some((doc) => doc.status === 'READING') ? 3000 : false),
  })
  const fail = (e) => toast.error(e.response?.data?.error || 'Không thực hiện được. Thử lại sau.')
  const putDoc = (updated) => qc.setQueryData(['documents', id], (old) => old && { ...old, data: old.data.map((doc) => (doc.id === updated.id ? updated : doc)) })
  const decide = useMutation({ mutationFn: ({ docId, key, action, value }) => documentApi.decide(docId, key, action, value), onSuccess: putDoc, onError: fail })
  const retry = useMutation({ mutationFn: (docId) => documentApi.retry(docId), onSuccess: putDoc, onError: fail })
  const remove = useMutation({
    mutationFn: (docId) => documentApi.remove(docId),
    onSuccess: () => { setDocKey(null); qc.invalidateQueries({ queryKey: ['documents', id] }); toast.success('Đã bỏ giấy') },
    onError: fail,
  })
  const publish = useMutation({
    mutationFn: () => documentApi.publish(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['seafarer', id] })
      qc.invalidateQueries({ queryKey: ['documents', id] })
      toast.success(`Đã đưa ${res.documents} giấy vào hồ sơ${res.certificates ? `, thêm ${res.certificates} chứng chỉ` : ''}`)
      navigate(`/seafarers/${id}`)
    },
    onError: fail,
  })

  const name = seafarer?.full_name || ''
  const crumb = (
    <nav className="crew-crumb" aria-label="Đường dẫn">
      <Link to="/seafarers">Thuyền viên</Link>
      <RightOutlined aria-hidden />
      {isLoading ? <span>…</span> : <Link to={`/seafarers/${id}`}>{name}</Link>}
      <RightOutlined aria-hidden />
      <span aria-current="page">Duyệt giấy tờ</span>
    </nav>
  )

  if (docsQuery.isLoading) return <div className="ds-page rv">{crumb}<Skeleton active paragraph={{ rows: 8 }} /></div>
  if (docsQuery.isError) {
    return <EmptyState isError title="Không tải được giấy tờ" description="Mất kết nối tới máy chủ. Phần đã duyệt vẫn được giữ." action={<Button onClick={() => docsQuery.refetch()}>Thử lại</Button>} />
  }

  const aiConfigured = docsQuery.data.ai_configured
  const docs = reviewable(docsQuery.data.data.map(fromApi))
  if (!docs.length) {
    return (
      <div className="ds-page rv">
        {crumb}
        <EmptyState title="Chưa có giấy tờ chờ duyệt" description={`Thả giấy tờ của ${name || 'thuyền viên'} vào hồ sơ, AI đọc xong sẽ hiện ở đây.`} action={<Link to={`/seafarers/${id}`}>Về hồ sơ</Link>} />
      </div>
    )
  }

  const doc = docs.find((item) => item.key === docKey) || docs[0]
  const readable = doc.fields.length > 0
  const field = doc.fields.find((item) => item.key === focus) || doc.fields.find((item) => !DONE_STATES.includes(item.state)) || doc.fields[0]
  const count = progress(doc)
  const todo = totalTodo(docs.filter((item) => item.fields.length))
  const reading = docs.filter((item) => item.status === 'READING').length

  function pickDoc(key) {
    const next = docs.find((item) => item.key === key)
    setDocKey(key)
    setFocus(nextTodo(next, null) || next.fields[0]?.key || null)
  }

  function act(action, value) {
    decide.mutate({ docId: doc.id, key: field.key, action, value }, {
      onSuccess: (updated) => {
        if (action === 'undo') return
        const following = nextTodo(fromApi(updated), field.key)
        if (following) setFocus(following)
      },
    })
  }

  const note = reading > 0 ? `AI đang đọc ${reading} giấy` : todo > 0 ? `Còn ${todo} ô chưa duyệt` : 'Đã duyệt hết, đưa vào hồ sơ được'

  return (
    <div className="ds-page rv">
      {crumb}

      {!aiConfigured && (
        <Banner title="AI đọc giấy tờ chưa được cấu hình" description="Máy chủ chưa có ANTHROPIC_API_KEY nên giấy tải lên chưa được đọc. Cấu hình xong thì bấm Đọc lại ở từng giấy." />
      )}

      <div className="rv-head">
        <div className="rv-head__text">
          {isLoading ? <Skeleton.Input active size="small" style={{ width: 280 }} /> : <h1 className="rv-head__title">Duyệt giấy tờ của {name}</h1>}
          <p className="rv-head__desc">{docs.length} giấy tờ chờ duyệt</p>
        </div>
        <div>
          <div className="rv-head__actions">
            <span role="status" className="ds-save">{decide.isPending ? 'Đang lưu…' : <><CheckOutlined aria-hidden /> Đã lưu</>}</span>
            <Button type="primary" disabled={!canPublish(docs)} loading={publish.isPending} onClick={() => publish.mutate()}>Đưa vào hồ sơ</Button>
          </div>
          <p className="rv-head__note">{note}</p>
        </div>
      </div>

      <div className="rv-docs" role="tablist" aria-label="Giấy tờ chờ duyệt">
        {docs.map((item) => {
          const p = progress(item)
          return (
            <button key={item.key} type="button" role="tab" aria-selected={item.key === doc.key} onClick={() => pickDoc(item.key)}>
              <span className="rv-docs__name">{item.fields.length ? item.label : item.file}</span>
              <span className="rv-docs__meta">
                {item.page && `${item.page} · `}<StatusBadge group="document" value={item.fields.length ? docStatus(item) : item.status} />
                {item.fields.length > 0 && <span className="ds-num">{p.done}/{p.total}</span>}
              </span>
            </button>
          )
        })}
      </div>

      {!readable && doc.status === 'FAILED' && (
        <Banner
          tone="error"
          title={`Chưa đọc được ${doc.file}`}
          description={doc.error}
          action={(
            <span style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => remove.mutate(doc.id)} loading={remove.isPending}>Bỏ giấy</Button>
              <Button icon={<ReloadOutlined />} loading={retry.isPending} disabled={!aiConfigured} onClick={() => retry.mutate(doc.id)}>Đọc lại</Button>
            </span>
          )}
        />
      )}
      {!readable && doc.status === 'READING' && <Banner tone="neutral" title={`AI đang đọc ${doc.file}`} description="Thường mất dưới một phút. Trang tự cập nhật khi đọc xong." />}

      <div className="rv-seg" role="group" aria-label="Xem">
        <button type="button" aria-pressed={view === 'goc'} onClick={() => setView('goc')}>Bản gốc</button>
        <button type="button" aria-pressed={view === 'so'} onClick={() => setView('so')}>Bản số hoá</button>
      </div>

      <div className="rv-cmp" data-view={view}>
        <section className="rv-pane rv-pane--goc" aria-label="Bản gốc">
          <header className="rv-pane__head">
            <span className="rv-pane__title">Bản gốc</span>
            <span className="rv-muted rv-pane__file">{doc.file}</span>
            {doc.mime !== 'application/pdf' && (
              <span className="rv-pane__tools">
                <Button type="text" size="small" icon={<MinusOutlined />} aria-label="Thu nhỏ" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} />
                <span className="ds-num rv-muted">{Math.round(zoom * 100)}%</span>
                <Button type="text" size="small" icon={<PlusOutlined />} aria-label="Phóng to" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.25))} />
              </span>
            )}
          </header>
          <div className="rv-pane__stage">
            <OriginalFile key={doc.id} doc={doc} zoom={zoom} />
          </div>
        </section>
        <section className="rv-pane rv-pane--so" aria-label="Bản số hoá">
          <header className="rv-pane__head">
            <span className="rv-pane__title">Bản số hoá</span>
            {readable && <span className="rv-muted ds-num">{count.done} / {count.total} ô đã duyệt</span>}
          </header>
          <div className="rv-pane__stage">
            {readable ? <Paper doc={doc} focus={field?.key} onFocus={setFocus} /> : <p className="rv-muted">Chưa có ô nào được đọc.</p>}
          </div>
        </section>
      </div>

      {field && (
        <FieldBar
          key={`${doc.key}-${field.key}-${field.state}-${field.value}`}
          field={field}
          onAction={act}
          onMatchVessel={field.key === 'ship' ? () => setMatching(true) : null}
        />
      )}

      {matching && (
        <VesselMatchPanel
          open
          paper={vesselOnPaper(doc)}
          context={`${doc.label} · ${name}`}
          onClose={() => setMatching(false)}
          onPick={(vessel) => {
            decide.mutate({ docId: doc.id, key: 'ship', action: 'edit', value: vessel.vessel_name })
            setMatching(false)
            toast.success(`Đã đối chiếu: ${vessel.vessel_name}${vessel.imo_number ? ` · IMO ${vessel.imo_number}` : ''}`)
          }}
        />
      )}
    </div>
  )
}
