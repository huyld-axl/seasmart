import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Modal, Skeleton, Tooltip } from 'antd'
import { CopyOutlined, DownloadOutlined, EditOutlined, LockOutlined, MessageOutlined, RightOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useAuthStore from '../../../stores/authStore'
import { exportApi } from '../../../api/exportApi'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState, ProgressBar } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import A4Preview from './A4Preview'
import { template } from './packModel'
import { SELF_SIGN, crewPending, pendingInAppSigners, signLink, signProgress, signState } from './packView'
import { saveBlob } from './download'
import '../seafarers/SeafarerProfile.css'
import './exports.css'

// B4 Duyệt và ký (phương án A): danh sách giấy trái, xem trước giữa, chữ ký phải.
export default function PackSignPage() {
  const { packId } = useParams()
  const user = useAuthStore((state) => state.user)
  const toast = useToast()
  const qc = useQueryClient()
  const [picked, setPicked] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const { data: pack, isLoading, isError, error, refetch } = useQuery({ queryKey: ['export', packId], queryFn: () => exportApi.get(packId) })
  const done = (text) => (data) => {
    qc.setQueryData(['export', packId], data)
    qc.invalidateQueries({ queryKey: ['exports'] })
    toast.success(text)
  }
  const fail = (e) => toast.error(e.response?.data?.error || 'Không thực hiện được. Thử lại sau.')
  const approve = useMutation({ mutationFn: () => exportApi.approve(packId), onSuccess: done('Đã duyệt, bộ giấy chuyển sang bước ký'), onError: fail })
  const reject = useMutation({ mutationFn: () => exportApi.reject(packId, reason.trim()), onSuccess: (d) => { setRejecting(false); done('Đã trả lại bộ giấy')(d) }, onError: fail })
  const sign = useMutation({ mutationFn: (who) => exportApi.sign(packId, who), onSuccess: (d, who) => done(`Đã ký với tư cách ${who}`)(d), onError: fail })
  const { data: sms } = useQuery({ queryKey: ['sms-status'], queryFn: exportApi.smsStatus, staleTime: 5 * 60 * 1000 })
  const sendSms = useMutation({ mutationFn: () => exportApi.sendSms(packId), onSuccess: (res) => toast.success(`Đã gửi SMS tới ${res.sent_to}`), onError: fail })
  const download = useMutation({ mutationFn: () => exportApi.download(packId), onSuccess: (res) => saveBlob(res, `${pack.code}.zip`), onError: fail })

  if (isLoading) return <div className="ds-page"><Skeleton active paragraph={{ rows: 8 }} /></div>
  if (isError) {
    return error?.response?.status === 404
      ? <EmptyState title="Không tìm thấy bộ giấy" description="Bộ giấy có thể đã bị xoá." action={<Link to="/exports">Về Bản xuất</Link>} />
      : <EmptyState isError title="Không tải được bộ giấy" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  }

  const doc = template(picked && pack.docs.includes(picked) ? picked : pack.docs[0])
  const progress = signProgress(pack)
  const selfCreated = pack.created_by === user?.id
  const signsOf = (t) => Object.fromEntries(t.signers.map((who) => [who, signState(pack, t.key, who)]))
  const link = pack.sign_token ? signLink(pack.sign_token) : null

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); toast.success('Đã chép link ký') } catch { toast.error('Trình duyệt chặn chép, hãy bôi đen link để chép') }
  }

  let actions = null
  if (pack.status === 'PENDING_APPROVAL') {
    actions = selfCreated ? (
      <p className="lock-note"><LockOutlined aria-hidden />Bạn tạo bộ này nên không tự duyệt được. Nhờ người khác duyệt.</p>
    ) : (
      <>
        <Button onClick={() => setRejecting(true)}>Trả lại</Button>
        <Button type="primary" icon={<SendOutlined />} loading={approve.isPending} onClick={() => approve.mutate()}>Duyệt và gửi ký</Button>
      </>
    )
  } else if (pack.status === 'DONE') {
    actions = <Button type="primary" icon={<DownloadOutlined />} loading={download.isPending} onClick={() => download.mutate()}>Tải bộ (.zip)</Button>
  }

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
            <StatusBadge group="export" value={pack.status} /> #{pack.code} · {pack.docs.length} giấy · tạo bởi {pack.created_by_email} lúc {dayjs(pack.created_at).format('HH:mm DD/MM')}
          </p>
          {pack.status === 'REJECTED' && <p className="crew-head__desc">Lý do trả lại: {pack.reject_reason}</p>}
          {pack.status === 'STALE' && <p className="crew-head__desc">{pack.stale_reason}. Tạo bộ mới từ hồ sơ.</p>}
        </div>
        {actions && <div className="crew-head__actions">{actions}</div>}
      </div>

      {progress.total > 0 && (
        <div className="ps-progress">
          <ProgressBar label="Chữ ký đã có" done={progress.done} total={progress.total} />
        </div>
      )}

      <div className="ps-layout">
        <ul className="ps-docs" aria-label="Giấy trong bộ">
          {pack.docs.map((key) => {
            const t = template(key)
            const signs = Object.values(signsOf(t))
            return (
              <li key={key}>
                <button type="button" aria-current={doc.key === key} onClick={() => setPicked(key)}>
                  <span className="ds-cell2__main" style={{ fontWeight: 400, whiteSpace: 'normal' }}>{t.name}</span>
                  <span className="ds-cell2__sub">{t.signers.length ? `Đã ký ${signs.filter((s) => s === 'done').length}/${t.signers.length}` : 'Không cần ký'}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <section className="crew-panel ps-preview" aria-label="Xem trước">
          <div className="crew-panel__head">
            <h2 className="crew-panel__title">{doc.name}</h2>
          </div>
          <div className="crew-panel__body">
            <A4Preview docKey={doc.key} seafarer={pack.snapshot} inputs={pack.inputs} signs={signsOf(doc)} />
          </div>
        </section>

        <section className="crew-panel">
          <div className="crew-panel__head">
            <h2 className="crew-panel__title">Chữ ký</h2>
          </div>
          <div className="crew-panel__body">
            <ul className="signers">
              {doc.signers.map((who) => (
                <li key={who}>
                  <span className="ds-cell2">
                    <span className="ds-cell2__main" style={{ fontWeight: 400 }}>{who}</span>
                    <span className="ds-cell2__sub">{who === SELF_SIGN ? 'Ký online qua link' : 'Ký trong app'}</span>
                  </span>
                  <StatusBadge group="signature" value={signState(pack, doc.key, who) === 'done' ? 'SIGNED' : 'WAITING'} />
                </li>
              ))}
              <li>
                <span className="ds-cell2">
                  <span className="ds-cell2__main" style={{ fontWeight: 400 }}>Ô ngày tháng, điểm</span>
                  <span className="ds-cell2__sub">Để trống, điền tay khi in</span>
                </span>
                <StatusBadge group="signature" value="BY_HAND" />
              </li>
            </ul>
            {pack.status === 'SIGNING' && (
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {pendingInAppSigners(pack).map((who) => (
                  <Button key={who} type="primary" icon={<EditOutlined />} loading={sign.isPending && sign.variables === who} onClick={() => sign.mutate(who)}>
                    Ký với tư cách {who}
                  </Button>
                ))}
                {crewPending(pack) && link && (
                  <div className="ps-link">
                    <p className="rv-muted" style={{ margin: 0, fontSize: 12 }}>
                      Gửi link này cho {pack.seafarer_name} để ký trên điện thoại. Link hết hạn lúc {dayjs(pack.sign_token_expires_at).format('HH:mm DD/MM')}.
                    </p>
                    <p className="ps-link__url ds-mono">{link}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button size="small" icon={<CopyOutlined />} onClick={copyLink}>Chép link ký</Button>
                      <Tooltip title={sms?.configured ? '' : 'Chưa cấu hình gửi SMS trên máy chủ. Chép link rồi gửi tay.'}>
                        <Button size="small" icon={<MessageOutlined />} disabled={!sms?.configured} loading={sendSms.isPending} onClick={() => sendSms.mutate()}>Gửi SMS</Button>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={rejecting}
        title={`Trả lại #${pack.code}?`}
        okText="Trả lại"
        cancelText="Huỷ"
        okButtonProps={{ disabled: !reason.trim(), loading: reject.isPending }}
        onCancel={() => setRejecting(false)}
        onOk={() => reject.mutate()}
      >
        <label className="ds-field">
          <span className="ds-field__label">Lý do trả lại</span>
          <Input.TextArea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: thiếu Thư bảo lãnh của chủ tàu" />
        </label>
      </Modal>
    </div>
  )
}
