import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Skeleton, Tooltip } from 'antd'
import { EditOutlined, MailOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCan } from '../../../hooks/usePermission'
import { exportApi } from '../../../api/exportApi'
import { opportunityApi } from '../../../api/opportunityApi'
import useSendToOwner from '../opportunities/useSendToOwner'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { DocDownload, PackDownload } from './DownloadButtons'
import FormPreview from './FormPreview'
import PreviewNav from './PreviewNav'
import { editCount, setEdit, template } from './packModel'
import '../seafarers/SeafarerProfile.css'
import './exports.css'

// B4 Bộ giấy đã tạo: danh sách giấy bên trái, xem trước bên phải. Tải từng giấy hoặc cả bộ (PDF, Excel).
// Sửa trực tiếp trên giấy qua draft, bấm Lưu mới ghi.
export default function PackDetailPage() {
  const { packId } = useParams()
  const can = useCan()
  const toast = useToast()
  const qc = useQueryClient()
  const [picked, setPicked] = useState(null)
  const [draft, setDraft] = useState(null)

  const { data: pack, isLoading, isError, error, refetch } = useQuery({ queryKey: ['export', packId], queryFn: () => exportApi.get(packId) })
  const { data: opportunity } = useQuery({
    queryKey: ['opportunities', 'item', String(pack?.opportunity_id)],
    queryFn: () => opportunityApi.get(pack.opportunity_id),
    enabled: !!pack?.opportunity_id,
  })
  const sendToOwner = useSendToOwner()
  const [sending, setSending] = useState(false)
  const save = useMutation({
    mutationFn: () => exportApi.update(packId, draft),
    onSuccess: (data) => {
      setDraft(null)
      qc.setQueryData(['export', packId], data)
      toast.success(`Đã lưu bộ giấy #${pack.code}`)
    },
    onError: (e) => toast.error('Không lưu được bộ giấy', { description: e.response?.data?.error || 'Thử lại sau ít phút.' }),
  })

  if (isLoading) return <div className="ds-page"><Skeleton active paragraph={{ rows: 8 }} /></div>
  if (isError) {
    return error?.response?.status === 404
      ? <EmptyState title="Không tìm thấy bộ giấy" description="Bộ giấy có thể đã bị xoá." action={<Link to="/exports">Về Bản xuất</Link>} />
      : <EmptyState isError title="Không tải được bộ giấy" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  }

  const doc = template(picked && pack.docs.includes(picked) ? picked : pack.docs[0])
  const mayEdit = can('export.create')
  const shown = draft || { inputs: pack.inputs, edits: pack.edits || {} }
  const saveFirst = draft ? 'Lưu hoặc huỷ thay đổi trước khi tải' : ''
  const candidate = opportunity?.candidates.find((c) => c.export_pack?.id === pack.id)
  async function send() {
    setSending(true)
    try { await sendToOwner(opportunity, [candidate]) } finally { setSending(false) }
  }

  return (
    <div className="ds-page">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        {pack.opportunity_id
          ? <><Link to="/opportunities">Cơ hội</Link><RightOutlined aria-hidden /><Link to={`/opportunities/${pack.opportunity_id}`}>{pack.opportunity_code}</Link></>
          : <Link to="/exports">Bản xuất</Link>}
        <RightOutlined aria-hidden />
        <span aria-current="page">#{pack.code}</span>
      </nav>

      <div className="crew-head">
        <div className="crew-head__text">
          <h1 className="crew-head__title">{pack.title} · <Link to={`/seafarers/${pack.seafarer_id}`}>{pack.seafarer_name}</Link></h1>
          <p className="crew-head__desc">
            #{pack.code} · {pack.docs.length} giấy{pack.ship_owner_name ? ` · nộp cho ${pack.ship_owner_name}` : ''} · tạo bởi {pack.created_by_email} lúc {dayjs(pack.created_at).format('HH:mm DD/MM')}
          </p>
        </div>
        <div className="crew-head__actions">
          {candidate && can('opportunity.send') && (
            <Tooltip title={saveFirst}>
              <Button icon={<MailOutlined />} disabled={!!draft} loading={sending} onClick={send}>Gửi cho chủ tàu</Button>
            </Tooltip>
          )}
          <Tooltip title={saveFirst}>
            <span><PackDownload pack={pack} type="primary" disabled={!!draft} /></span>
          </Tooltip>
        </div>
      </div>

      <div className="ps-layout">
        <ul className="ps-docs" aria-label="Giấy trong bộ">
          {pack.docs.map((key) => {
            const t = template(key)
            const edited = editCount(shown.edits, key)
            return (
              <li key={key}>
                <button type="button" aria-current={doc.key === key} onClick={() => setPicked(key)}>
                  <span className="ds-cell2__main" style={{ fontWeight: 400, whiteSpace: 'normal' }}>{t.name}</span>
                  <span className="ds-cell2__sub" style={{ whiteSpace: 'normal' }}>{t.signers.length ? `Ký tay: ${t.signers.join(', ')}` : 'Không cần ký'}{edited ? ` · Đã sửa tay ${edited} ô` : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <section className="crew-panel ps-preview" aria-label="Xem trước">
          <div className="crew-panel__head">
            <PreviewNav name="giấy" value={doc.key} onChange={setPicked} options={pack.docs.map((key) => ({ value: key, label: template(key).name }))} />
            <span className="pk-preview__end">
              {draft ? (
                <>
                  <Button disabled={save.isPending} onClick={() => setDraft(null)}>Huỷ</Button>
                  <Button type="primary" loading={save.isPending} onClick={() => save.mutate()}>Lưu thay đổi</Button>
                </>
              ) : (
                <>
                  {mayEdit && <Button icon={<EditOutlined />} onClick={() => setDraft({ inputs: pack.inputs, edits: pack.edits || {} })}>Sửa nội dung</Button>}
                  <DocDownload pack={pack} docKey={doc.key} docName={doc.name} />
                </>
              )}
            </span>
          </div>
          <div className="crew-panel__body">
            <FormPreview
              docKey={doc.key}
              seafarerId={pack.seafarer_id}
              shipOwnerId={pack.ship_owner_id}
              inputs={shown.inputs}
              edits={shown.edits[doc.key]}
              editable={!!draft}
              onEdit={(address, text) => setDraft((current) => ({ ...current, edits: setEdit(current.edits, doc.key, address, text) }))}
              label={`Xem trước ${doc.name}`}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
