import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { CheckCircleFilled, EditOutlined, FileTextOutlined, SendOutlined } from '@ant-design/icons'
import { opportunityApi } from '../../../api/opportunityApi'
import { exportApi } from '../../../api/exportApi'
import { certificateApi } from '../../../api'
import SlidePanel from '../../../components/ds/SlidePanel'
import DocThumb from '../../../components/ds/DocThumb'
import { EmptyState } from '../../../components/ds/Controls'
import { DownloadIcon, UploadIcon } from '../../../components/ds/TransferIcons'
import useToast from '../../../components/ds/useToast'
import { useCan } from '../../../hooks/usePermission'
import { formatDate } from '../../../utils/format'
import { saveBlob, downloadError } from '../exports/download'
import { certImage } from '../seafarers/certFiles'
import DocPreview from '../seafarers/DocPreview'
import FillFormModal from './FillFormModal'
import { docState, formMissing, formName } from './submissionView'

// Hồ sơ nộp của một ứng viên (bảng trượt từ trang cơ hội): giấy tờ theo yêu cầu lấy từ tab Giấy tờ của thuyền viên,
// và biểu mẫu phải điền (bộ giấy của ứng viên). Giấy chưa có ảnh nạp ngay tại đây; biểu mẫu bấm Điền.
// Chưa đủ vẫn tải và gửi được; chỗ thiếu được nhắc.
export default function SubmissionPanel({ opportunityId, seafarerId, onClose, onSend }) {
  const qc = useQueryClient()
  const toast = useToast()
  const can = useCan()
  const fileInput = useRef(null)
  const [uploadFor, setUploadFor] = useState(null)
  const [previewAt, setPreviewAt] = useState(null)
  const [filling, setFilling] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const queryKey = ['opportunities', 'submission', opportunityId, seafarerId]
  const { data, isLoading, isError, refetch } = useQuery({ queryKey, queryFn: () => opportunityApi.submission(opportunityId, seafarerId) })
  const refresh = () => {
    qc.invalidateQueries({ queryKey })
    qc.invalidateQueries({ queryKey: ['opportunities', 'item', String(opportunityId)] })
  }

  const ensurePack = useMutation({
    mutationFn: () => opportunityApi.ensurePack(opportunityId, seafarerId),
    onSuccess: (next) => { qc.setQueryData(queryKey, next); refresh() },
  })
  const upload = useMutation({
    mutationFn: ({ certId, file }) => certificateApi.upload(seafarerId, certId, file),
    onSuccess: () => { toast.success('Đã nạp ảnh'); refresh(); qc.invalidateQueries({ queryKey: ['certificates', String(seafarerId)] }) },
    onError: (e) => toast.error('Không nạp được ảnh', { description: e.response?.data?.error || 'Thử lại sau ít phút.' }),
  })

  async function openForm(key) {
    try {
      const next = data.pack?.docs.includes(key) ? data : await ensurePack.mutateAsync()
      setFilling({ key, pack: next.pack })
    } catch (e) {
      toast.error('Không mở được biểu mẫu', { description: e.response?.data?.error || 'Thử lại sau ít phút.' })
    }
  }

  async function downloadAll() {
    setDownloading(true)
    try {
      const next = data.pack ? data : await ensurePack.mutateAsync()
      saveBlob(await exportApi.download(next.pack.id, 'pdf'), `${data.candidate.full_name}.zip`)
    } catch (e) {
      toast.error('Không tải được hồ sơ', { description: await downloadError(e) })
    } finally {
      setDownloading(false)
    }
  }

  const canEdit = can('seafarer.update')
  const canFill = can('export.create')
  let body
  if (isLoading) body = <Skeleton active paragraph={{ rows: 8 }} />
  else if (isError) body = <EmptyState isError title="Không tải được hồ sơ nộp" action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  else {
    const docs = data.docs
    const required = docs.filter((d) => d.level === 'REQUIRED')
    const okRequired = required.filter((d) => d.state === 'ok').length
    const withFile = docs.filter((d) => d.certificate?.has_file)
    const forms = data.forms.map((f) => ({ ...f, name: formName(f.key), missing: formMissing(f.key, data.pack) }))
    const filled = forms.filter((f) => f.missing && !f.missing.length).length
    const previewItems = withFile.map((d) => ({
      key: d.requirement_id, name: d.name, number: d.certificate.certificate_number || '',
      issuedOn: formatDate(d.certificate.issued_date), expiresOn: formatDate(d.certificate.expiry_date), noExpiry: Boolean(d.certificate.no_expiry || !d.certificate.expiry_date),
      image: certImage(seafarerId, d.certificate, 'full'),
    }))
    body = (
      <div className="sub-body">
        <section>
          <div className="sub-head">
            <h3 className="sub-title">Giấy tờ <span className={okRequired < required.length ? 'sub-frac sub-frac--bad' : 'sub-frac'}>{okRequired}/{required.length}</span> <span className="sub-muted">bắt buộc</span></h3>
            <Link className="sub-link" to={`/seafarers/${seafarerId}`} target="_blank">Mở tab Giấy tờ</Link>
          </div>
          {docs.length ? (
            <ul className="sub-list">
              {docs.map((d) => {
                const state = docState(d)
                const image = d.certificate ? certImage(seafarerId, d.certificate) : null
                const canUpload = canEdit && d.certificate && !d.certificate.has_file
                return (
                  <li key={d.requirement_id}>
                    <DocThumb
                      name={d.name}
                      cacheKey={image?.key}
                      load={image?.load}
                      onOpen={() => setPreviewAt(withFile.indexOf(d))}
                      onUpload={canUpload ? () => { setUploadFor(d.certificate.id); fileInput.current?.click() } : undefined}
                    />
                    <span className="ds-cell2 sub-grow">
                      <span className="ds-cell2__main">{d.name}{d.level === 'PREFERRED' ? <span className="sub-tag">Nên có</span> : null}</span>
                      {state.text ? <span className={`ds-cell2__sub sub-note sub-note--${state.tone}`}>{state.text}</span> : null}
                    </span>
                    {state.tone === 'ok' ? <CheckCircleFilled className="sub-ok" aria-label="Đủ" /> : null}
                    {canUpload ? <Button size="small" icon={<UploadIcon />} loading={upload.isPending && uploadFor === d.certificate.id} onClick={() => { setUploadFor(d.certificate.id); fileInput.current?.click() }}>Nạp ảnh</Button> : null}
                    {!d.certificate && canEdit ? <Link className="sub-link" to={`/seafarers/${seafarerId}`} target="_blank">Thêm ở hồ sơ</Link> : null}
                  </li>
                )
              })}
            </ul>
          ) : <p className="sub-muted">Hồ sơ yêu cầu chưa có giấy tờ nào.</p>}
        </section>
        <section>
          <div className="sub-head">
            <h3 className="sub-title">Biểu mẫu {forms.length ? <span className={filled < forms.length ? 'sub-frac sub-frac--warn' : 'sub-frac'}>{filled}/{forms.length}</span> : null}</h3>
          </div>
          {forms.length ? (
            <ul className="sub-list">
              {forms.map((f) => (
                <li key={f.key}>
                  <span className="ds-thumb ds-thumb--sm"><FileTextOutlined aria-hidden /></span>
                  <span className="ds-cell2 sub-grow">
                    <span className="ds-cell2__main">{f.name}</span>
                    <span className={`ds-cell2__sub sub-note ${f.missing?.length ? 'sub-note--warn' : ''}`}>
                      {!f.missing ? 'Chưa điền' : f.missing.length ? `Thiếu ${f.missing.length} ô: ${f.missing.join(', ')}` : 'Đã điền đủ'}
                    </span>
                  </span>
                  {f.missing && !f.missing.length ? <CheckCircleFilled className="sub-ok" aria-label="Đủ" /> : null}
                  {canFill ? <Button size="small" icon={<EditOutlined />} loading={ensurePack.isPending && filling === null} onClick={() => openForm(f.key)}>{f.missing ? 'Sửa' : 'Điền'}</Button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="sub-muted">Hồ sơ yêu cầu chưa có biểu mẫu. Thêm biểu mẫu ở tab Hồ sơ yêu cầu của cơ hội.</p>}
        </section>
        {okRequired < required.length || filled < forms.length ? <p className="sub-muted">Chưa đủ vẫn tải và gửi được; phần thiếu sẽ không có trong tệp.</p> : null}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="ds-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file && uploadFor) upload.mutate({ certId: uploadFor, file })
          }}
        />
        <DocPreview items={previewItems} index={previewAt} onIndex={setPreviewAt} onClose={() => setPreviewAt(null)} />
        {filling ? (
          <FillFormModal
            pack={filling.pack}
            docKey={filling.key}
            title={`${data.opportunity.code} · ${data.opportunity.vessel_name || data.opportunity.rank_name}`}
            seafarerName={data.candidate.full_name}
            onClose={() => setFilling(null)}
            onSaved={(pack) => { qc.setQueryData(queryKey, { ...data, pack }); refresh() }}
          />
        ) : null}
      </div>
    )
  }

  const summary = data ? `${data.opportunity.code} · ${[data.opportunity.rank_name, data.opportunity.vessel_name, data.opportunity.ship_owner_name].filter(Boolean).join(' · ')}` : ''
  return (
    <SlidePanel
      open
      size="wide"
      hasForm={false}
      title={data ? `Hồ sơ nộp · ${data.candidate.full_name}` : 'Hồ sơ nộp'}
      description={summary}
      onClose={onClose}
      footer={data ? (
        <>
          <Button icon={<DownloadIcon />} loading={downloading} onClick={downloadAll}>Tải hồ sơ</Button>
          {onSend && can('opportunity.send') ? <Button type="primary" icon={<SendOutlined />} onClick={() => onSend(data)}>Gửi cho chủ tàu</Button> : null}
        </>
      ) : null}
    >
      {body}
    </SlidePanel>
  )
}
