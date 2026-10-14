import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Skeleton, Tooltip } from 'antd'
import { EditOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useAuthStore from '../../../stores/authStore'
import { exportApi } from '../../../api/exportApi'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import DocFields from './DocFields'
import { DocDownload, PackDownload } from './DownloadButtons'
import FormPreview from './FormPreview'
import PreviewNav from './PreviewNav'
import { VESSEL_FIELD, editCount, setEdit, template } from './packModel'
import '../seafarers/SeafarerProfile.css'
import './exports.css'

// B4 Bộ giấy đã tạo: danh sách giấy bên trái, xem trước bên phải. Tải từng giấy hoặc cả bộ (PDF, Excel).
// Sửa thông tin điền thêm và sửa tay trên giấy qua draft, bấm Lưu mới ghi.
export default function PackDetailPage() {
  const { packId } = useParams()
  const user = useAuthStore((state) => state.user)
  const toast = useToast()
  const qc = useQueryClient()
  const [picked, setPicked] = useState(null)
  const [draft, setDraft] = useState(null)

  const { data: pack, isLoading, isError, error, refetch } = useQuery({ queryKey: ['export', packId], queryFn: () => exportApi.get(packId) })
  const save = useMutation({
    mutationFn: () => exportApi.update(packId, draft),
    onSuccess: (data) => {
      setDraft(null)
      qc.setQueryData(['export', packId], data)
      toast.success('Đã lưu thay đổi')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Không lưu được. Thử lại sau.'),
  })

  if (isLoading) return <div className="ds-page"><Skeleton active paragraph={{ rows: 8 }} /></div>
  if (isError) {
    return error?.response?.status === 404
      ? <EmptyState title="Không tìm thấy bộ giấy" description="Bộ giấy có thể đã bị xoá." action={<Link to="/exports">Về Bản xuất</Link>} />
      : <EmptyState isError title="Không tải được bộ giấy" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  }

  const doc = template(picked && pack.docs.includes(picked) ? picked : pack.docs[0])
  const mayEdit = ['admin', 'operator'].includes(user?.role)
  const shown = draft || { inputs: pack.inputs, edits: pack.edits || {} }
  const setInput = (label, value) => setDraft({ ...draft, inputs: { ...draft.inputs, [label]: value } })
  const saveFirst = draft ? 'Lưu hoặc huỷ thay đổi trước khi tải' : ''

  return (
    <div className="ds-page">
      <nav className="crew-crumb" aria-label="Đường dẫn">
        <Link to="/exports">Bản xuất</Link>
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
            {draft && (
              <div className="ps-edit">
                <p className="ps-edit__hint">
                  Điền thêm cho {doc.name}, hoặc bấm vào ô bất kỳ trên giấy để sửa tay (ô đã sửa có nền vàng{editCount(draft.edits, doc.key) ? `, đang có ${editCount(draft.edits, doc.key)} ô` : ''}). Bấm Lưu thay đổi để ghi lại.
                </p>
                <div className="pk-fields">
                  <label className="ds-field">
                    <span className="ds-field__label">{VESSEL_FIELD} · dùng cho cả bộ</span>
                    <Input allowClear placeholder="Để trống thì lấy theo hồ sơ" value={draft.inputs[VESSEL_FIELD] || ''} onChange={(event) => setInput(VESSEL_FIELD, event.target.value)} />
                  </label>
                </div>
                <DocFields docKey={doc.key} inputs={draft.inputs} onChange={setInput} />
              </div>
            )}
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
