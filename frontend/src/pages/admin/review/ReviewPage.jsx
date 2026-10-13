import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Checkbox, Skeleton } from 'antd'
import { CheckOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { seafarerApi } from '../../../api'
import { documentApi } from '../../../api/documentApi'
import Banner from '../../../components/ds/Banner'
import { EmptyState } from '../../../components/ds/Controls'
import DocTypeBar from '../../../components/ds/DocTypeBar'
import DocumentViewer from '../../../components/ds/DocumentViewer'
import FieldInput from '../../../components/ds/FieldInput'
import ReviewPager from '../../../components/ds/ReviewPager'
import VesselMatchChip from '../../../components/ds/VesselMatchChip'
import useToast from '../../../components/ds/useToast'
import { canContinue, certificateNeedsConfirm, decisionFor, docKind, fieldView, firstToReview, hasFields, nextToReview, pager, publishState, touchCount } from './reviewFlow'
import VesselMatchPanel from './VesselMatchPanel'
import '../seafarers/SeafarerProfile.css'
import './ReviewPage.css'

// Đổi loại trên màn: sổ thuyền viên → trang bố trí chức danh (mỗi trang một chuyến, loại hay gặp nhất).
const RETYPE = { book: 'seaman_book_duty', certificate: 'certificate', other: 'other' }
const VESSEL_STATUS = { MATCHED: 'VERIFIED', NOT_FOUND: 'NOT_FOUND', NOT_CHECKED: 'NOT_CHECKED' }

// Ảnh các trang của giấy: lấy ảnh có xác thực rồi hiện bằng blob.
function PageImage({ uploadId, pageNo, zoom, label }) {
  const { data: blob, isError } = useQuery({
    queryKey: ['page-image', uploadId, pageNo],
    queryFn: () => documentApi.pageImage(uploadId, pageNo, 'full'),
    staleTime: Infinity,
  })
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (isError) return <p className="rv-muted">Không tải được ảnh trang.</p>
  if (!url) return <Skeleton.Image active style={{ width: 320, height: 420 }} />
  return <img src={url} alt={label} className="rv-file" style={{ width: `${zoom * 100}%` }} />
}

export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { modal } = App.useApp()
  const [currentId, setCurrentId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [view, setView] = useState('so')
  const [zoom, setZoom] = useState(1)
  const [pageIdx, setPageIdx] = useState(0)
  const [matching, setMatching] = useState(false)
  const queryKey = ['documents', id]

  const { data: seafarer, isLoading: loadingSeafarer } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
  })
  const docsQuery = useQuery({
    queryKey,
    queryFn: () => documentApi.list(id),
    // Giấy đang được AI đọc: hỏi lại mỗi 3 giây tới khi xong.
    refetchInterval: (query) => (query.state.data?.data.some((doc) => doc.status === 'READING') ? 3000 : false),
  })

  const fail = (e) => toast.error(e.response?.data?.error || 'Không thực hiện được. Thử lại sau.')
  const putDoc = (updated) => qc.setQueryData(queryKey, (old) => old && { ...old, data: old.data.map((doc) => (doc.id === updated.id ? updated : doc)) })
  const refresh = () => qc.invalidateQueries({ queryKey })

  const decide = useMutation({ mutationFn: ({ docId, key, action, value }) => documentApi.decide(docId, key, action, value), onSuccess: putDoc, onError: fail })
  const retry = useMutation({ mutationFn: (docId) => documentApi.retry(docId), onSuccess: putDoc, onError: fail })
  const retype = useMutation({ mutationFn: ({ docId, docType }) => documentApi.retype(docId, docType), onSuccess: putDoc, onError: fail })
  const setVessel = useMutation({ mutationFn: ({ docId, vesselId }) => documentApi.setVessel(docId, { vesselId }), onSuccess: putDoc, onError: fail })
  const confirmOwner = useMutation({ mutationFn: (docId) => documentApi.confirmOwner(docId), onSuccess: putDoc, onError: fail })
  const remove = useMutation({ mutationFn: (docId) => documentApi.remove(docId), onSuccess: () => { toast.success('Đã bỏ giấy'); refresh() }, onError: fail })
  const publish = useMutation({
    mutationFn: () => documentApi.publish(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['seafarer', id] })
      qc.invalidateQueries({ queryKey: ['certificates', id] })
      qc.invalidateQueries({ queryKey: ['sea-services', id] })
      refresh()
      toast.success(`Đã đưa ${res.documents} giấy vào hồ sơ${res.certificates ? `, thêm ${res.certificates} chứng chỉ` : ''}${res.sea_services ? `, ${res.sea_services} chuyến đi tàu` : ''}`)
      navigate(`/seafarers/${id}`)
    },
    onError: fail,
  })

  const name = seafarer?.full_name || ''
  const crumb = (
    <nav className="crew-crumb" aria-label="Đường dẫn">
      <Link to="/seafarers">Thuyền viên</Link>
      <RightOutlined aria-hidden />
      {loadingSeafarer ? <span>…</span> : <Link to={`/seafarers/${id}`}>{name}</Link>}
      <RightOutlined aria-hidden />
      <span aria-current="page">Duyệt giấy tờ</span>
    </nav>
  )

  if (docsQuery.isLoading) return <div className="ds-page rv">{crumb}<Skeleton active paragraph={{ rows: 8 }} /></div>
  if (docsQuery.isError) {
    return <EmptyState isError title="Không tải được giấy tờ" description="Mất kết nối tới máy chủ. Phần bạn đã duyệt vẫn được giữ." action={<Button onClick={() => docsQuery.refetch()}>Thử lại</Button>} />
  }

  const aiConfigured = docsQuery.data.ai_configured
  const docs = docsQuery.data.data
  if (!docs.length) {
    return (
      <div className="ds-page rv">
        {crumb}
        <EmptyState title="Chưa có giấy nào để duyệt" description={`Tải giấy tờ của ${name || 'thuyền viên'} lên. Giấy đọc xong sẽ hiện ở đây, từng giấy một.`} action={<Link to={`/seafarers/${id}/upload`}>Tải giấy tờ lên</Link>} />
      </div>
    )
  }

  const doc = docs.find((item) => item.id === currentId) || docs.find((item) => item.id === firstToReview(docs)) || docs[0]
  const nav = pager(docs, doc.id)
  const kind = docKind(doc)
  const locked = doc.status === 'PUBLISHED'
  const pub = publishState(docs)
  const pages = doc.upload_id ? Array.from({ length: (doc.page_to || doc.page_from || 1) - (doc.page_from || 1) + 1 }, (_, i) => (doc.page_from || 1) + i) : []
  const pageNo = pages[Math.min(pageIdx, pages.length - 1)]
  const touch = touchCount(doc)

  function go(nextId) {
    if (!nextId) return
    setCurrentId(nextId)
    setDrafts({})
    setPageIdx(0)
    setMatching(false)
  }

  function commit(field) {
    const text = drafts[field.key]
    if (text === undefined) return
    setDrafts((current) => { const { [field.key]: _gone, ...rest } = current; return rest })
    const decision = decisionFor(field, text)
    if (decision) decide.mutate({ docId: doc.id, key: field.key, action: decision.action, value: decision.value })
  }

  // "Xong, giấy tiếp": ô đọc rõ được chấp nhận, ô trống giữ trống (bỏ qua là chấp nhận), rồi sang giấy còn việc.
  async function finishDoc() {
    try {
      let updated = await documentApi.acceptClear(doc.id)
      for (const field of updated.fields.filter((item) => item.state === 'UNKNOWN')) {
        updated = await documentApi.decide(doc.id, field.key, 'keepUnknown')
      }
      putDoc(updated)
      const next = nextToReview(docs.map((item) => (item.id === updated.id ? updated : item)), doc.id)
      if (next) go(next)
      else toast.success('Đã duyệt hết. Bấm "Đưa vào hồ sơ" để hoàn tất.')
    } catch (e) {
      fail(e)
    }
  }

  async function confirmCertificate() {
    try {
      const res = await documentApi.confirmCertificates([doc.id])
      refresh()
      if (res.blocked.length) {
        toast.error(res.blocked[0].reason)
        return
      }
      const next = nextToReview(docs.map((item) => (item.id === doc.id ? { ...item, status: 'COMPLETED' } : item)), doc.id)
      if (next) go(next)
      else toast.success('Đã duyệt hết. Bấm "Đưa vào hồ sơ" để hoàn tất.')
    } catch (e) {
      fail(e)
    }
  }

  function changeType(nextKind) {
    if (nextKind === kind) return
    modal.confirm({
      title: 'Đổi loại giấy?',
      content: 'AI sẽ đọc lại giấy này, khoảng 30 giây. Các ô bạn đã sửa trên giấy này sẽ mất.',
      okText: 'Đổi loại',
      cancelText: 'Huỷ',
      onOk: () => retype.mutateAsync({ docId: doc.id, docType: RETYPE[nextKind] }),
    })
  }

  const vesselStatus = VESSEL_STATUS[doc.vessel_match_status] || 'NOT_CHECKED'
  const shipField = doc.fields.find((field) => field.key === 'ship')

  let body
  if (doc.status === 'READING') {
    body = (
      <div className="rv-wait" aria-live="polite">
        <p><b>Đang xử lý giấy này</b></p>
        <p className="rv-muted">Khoảng 30 giây. Bạn xem bản gốc ở bên trái trong lúc chờ.</p>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    )
  } else if (doc.status === 'FAILED') {
    body = (
      <Banner
        tone="error"
        title="Không đọc được giấy này"
        description={doc.error || 'Các giấy khác vẫn đưa vào hồ sơ được; giấy này ở ngoài cho tới khi đọc xong.'}
        action={(
          <span className="rv-inline">
            <Button onClick={() => remove.mutate(doc.id)} loading={remove.isPending}>Bỏ giấy</Button>
            <Button icon={<ReloadOutlined />} loading={retry.isPending} disabled={!aiConfigured} onClick={() => retry.mutate(doc.id)}>Thử lại</Button>
          </span>
        )}
      />
    )
  } else if (!hasFields(doc)) {
    body = (
      <div className="rv-other">
        <p><b>Giấy này được lưu kèm hồ sơ, không cần duyệt.</b></p>
        <p className="rv-muted">Không phải sổ thuyền viên hay chứng chỉ nên không đọc từng ô. AI nhận sai thì bấm Đổi loại.</p>
        {nav.nextId && <Button type="primary" icon={<RightOutlined />} onClick={() => go(nav.nextId)}>Giấy tiếp</Button>}
      </div>
    )
  } else {
    body = (
      <>
        {doc.doc_type === 'seaman_book_duty' && <p className="rv-muted">Mọi ô của trang này vào chuyến đi tàu.</p>}
        <div className="rv-ins">
          {doc.fields.map((field) => {
            // Ô "Không thời hạn" là đúng/sai: hộp chọn thay cho ô nhập.
            if (field.key === 'noExpiry') {
              return (
                <Checkbox
                  key={`${doc.id}-${field.key}`}
                  checked={field.value === 'true'}
                  disabled={locked}
                  onChange={(event) => decide.mutate({ docId: doc.id, key: field.key, action: 'edit', value: String(event.target.checked) })}
                >
                  Không thời hạn
                </Checkbox>
              )
            }
            const view = fieldView(field, doc)
            const draft = drafts[field.key]
            return (
              <FieldInput
                key={`${doc.id}-${field.key}`}
                {...view}
                value={draft !== undefined ? draft : view.value}
                disabled={locked}
                onChange={(text) => setDrafts((current) => ({ ...current, [field.key]: text }))}
                onBlur={() => commit(field)}
                onConfirm={() => decide.mutate({ docId: doc.id, key: field.key, action: 'accept' })}
              >
                {field.key === 'ship' && shipField ? (
                  <VesselMatchChip status={vesselStatus} disabled={locked} onClick={() => setMatching(true)} />
                ) : null}
              </FieldInput>
            )
          })}
        </div>
        {!locked && (
          <div className="rv-foot">
            <span className="rv-muted rv-foot__note">{touch ? `${touch} ô tô vàng cần bạn xác nhận ✓` : ''}</span>
            {certificateNeedsConfirm(doc) ? (
              <Button type="primary" icon={<CheckOutlined />} disabled={touch > 0} onClick={confirmCertificate}>Đã so số, xác nhận</Button>
            ) : (
              <Button type="primary" icon={<RightOutlined />} iconPlacement="end" disabled={!canContinue(doc)} onClick={finishDoc}>Xong, giấy tiếp</Button>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="ds-page rv">
      {crumb}

      {!aiConfigured && (
        <Banner title="AI đọc giấy tờ chưa được cấu hình" description="Máy chủ chưa có khoá AI nên giấy tải lên chưa được đọc. Bạn vẫn xem được bản gốc." />
      )}
      {doc.owner_mismatch && !doc.owner_mismatch_confirmed && !locked && (
        <Banner
          title="Tên trên giấy khác hồ sơ"
          description="Giấy chưa vào hồ sơ được cho tới khi bạn quyết."
          action={(
            <span className="rv-inline">
              <Button onClick={() => remove.mutate(doc.id)}>Bỏ giấy</Button>
              <Button type="primary" loading={confirmOwner.isPending} onClick={() => confirmOwner.mutate(doc.id)}>Vẫn đúng người</Button>
            </span>
          )}
        />
      )}
      {locked && <Banner tone="neutral" title="Giấy này đã vào hồ sơ" description="Chỉ để xem. Muốn đổi dữ liệu thì sửa ở hồ sơ, kèm lý do." />}

      <div className="rv-head">
        <div className="rv-head__text">
          <h1 className="rv-head__title">Duyệt giấy tờ</h1>
        </div>
        <div className="rv-head__actions">
          <ReviewPager index={nav.index} total={nav.total} onPrev={() => go(nav.prevId)} onNext={() => go(nav.nextId)} />
          <Button
            type="primary"
            disabled={!pub.canPublish}
            loading={publish.isPending}
            title={pub.canPublish ? undefined : pub.reasons.join('. ')}
            onClick={() => publish.mutate()}
          >
            Đưa vào hồ sơ
          </Button>
        </div>
      </div>
      {!pub.canPublish && pub.reasons.length > 0 && <p className="rv-head__note rv-head__note--left">{pub.reasons.join(' · ')}</p>}

      <div className="rv-seg" role="group" aria-label="Xem">
        <button type="button" aria-pressed={view === 'goc'} onClick={() => setView('goc')}>Bản gốc</button>
        <button type="button" aria-pressed={view === 'so'} onClick={() => setView('so')}>Bản số hoá</button>
      </div>

      <div className="rv-cmp" data-view={view}>
        <section className="rv-pane rv-pane--goc" aria-label="Bản gốc">
          {pageNo ? (
            <DocumentViewer
              fileName={`${doc.file_name}${doc.page ? ` · ${doc.page}` : ''}`}
              page={Math.min(pageIdx, pages.length - 1) + 1}
              pageCount={pages.length}
              zoom={Math.round(zoom * 100)}
              onPrevPage={() => setPageIdx((i) => Math.max(0, i - 1))}
              onNextPage={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
              onZoomIn={() => setZoom((z) => Math.min(2, z + 0.25))}
              onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              <PageImage key={`${doc.upload_id}-${pageNo}`} uploadId={doc.upload_id} pageNo={pageNo} zoom={zoom} label={`Bản gốc ${doc.file_name}`} />
            </DocumentViewer>
          ) : (
            <p className="rv-muted">Giấy cũ chưa có ảnh trang.</p>
          )}
        </section>
        <section className="rv-pane rv-pane--so" aria-label="Bản số hoá">
          <DocTypeBar kind={kind} subtitle={doc.fields.length ? doc.label : undefined} disabled={locked || doc.status === 'READING'} onChangeType={changeType} />
          <div className="rv-pane__stage rv-form">{body}</div>
        </section>
      </div>

      {matching && (
        <VesselMatchPanel
          open
          paper={{ name: shipField?.raw || '', imo: '', gt: doc.fields.find((f) => f.key === 'gt')?.raw || '', flag: doc.fields.find((f) => f.key === 'flag')?.raw || '', owner: doc.fields.find((f) => f.key === 'owner')?.raw || '' }}
          context={`${doc.label} · ${name}`}
          onClose={() => setMatching(false)}
          onPick={(vessel) => {
            setVessel.mutate({ docId: doc.id, vesselId: vessel.id })
            setMatching(false)
            toast.success(`Đã đối chiếu: ${vessel.vessel_name}${vessel.imo_number ? ` · IMO ${vessel.imo_number}` : ''}`)
          }}
        />
      )}
    </div>
  )
}
